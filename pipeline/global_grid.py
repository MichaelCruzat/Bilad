"""Global land grid from NASA POWER.

Covers every MERRA-2 cell (0.5° x 0.625°) that overlaps land between 60°S
and 84°N. Antarctica is left out: reanalysis surface fields there are poorly
constrained and the cells are tiny. Natural Earth polygons crossing the
antimeridian are split before planar land-overlap calculations.

Outputs:
  pipeline/.cache/global/<VAR>.i16   monthly values, cell-major (not shipped)
  public/data/global/cells.bin       cell table for the app
  public/data/global/meta.json       grid, counts, provenance
"""

from __future__ import annotations

import datetime as dt
import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
import shapely
from shapely.geometry import MultiPolygon, Polygon, box

from . import geometry
from . import power
from .build import quantise
from .variables import FIRST_YEAR, LAST_YEAR, MISSING, MONTHS, VARIABLES

LAT_MIN, LAT_MAX = -60, 84
GLOBAL_VARIABLES = ("T2M", "PRECTOTCORR")


def load_land(world_atlas_land: Path) -> MultiPolygon:
    topology = json.loads(world_atlas_land.read_text())
    arcs = geometry._decode_arcs(topology)
    parts: list[Polygon] = []
    for g in topology["objects"]["land"]["geometries"]:
        polygons = [g["arcs"]] if g["type"] == "Polygon" else g["arcs"]
        for polygon in polygons:
            rings = [geometry._ring(r, arcs) for r in polygon]
            parts.extend(geometry.split_antimeridian(Polygon(rings[0], rings[1:])))
    return MultiPolygon(parts)


def land_tiles(land: MultiPolygon) -> list[power.Tile]:
    shapely.prepare(land)
    tiles = []
    for la in range(LAT_MIN, LAT_MAX, 10):
        for lo in range(-180, 180, 10):
            t = power.Tile(la, min(la + 10, LAT_MAX), lo, lo + 10)
            if land.intersects(box(t.lon_min, t.lat_min, t.lon_max, t.lat_max)):
                tiles.append(t)
    return tiles


def build_global(root: Path, cache: Path, variables=GLOBAL_VARIABLES, workers: int = 3) -> None:
    land = load_land(root / "node_modules/world-atlas/land-50m.json")
    tiles = land_tiles(land)
    print(f"{len(tiles)} land tiles x {len(variables)} variables")
    out_cache = cache / "global"
    out_cache.mkdir(parents=True, exist_ok=True)

    series: dict[str, dict[tuple[float, float], np.ndarray]] = {}
    requests = []
    api, sources = "", set()
    for v in variables:
        urls = [power.request_url(v, t) for t in tiles]
        requests += [{"variable": v, "url": u} for u in urls]
        done = 0

        def get(url: str) -> dict:
            return power.fetch(url, cache)

        series[v] = {}
        with ThreadPoolExecutor(max_workers=workers) as pool:
            for data in pool.map(get, urls):
                api = data["header"]["api"]["version"]
                sources.update(data["header"]["sources"])
                series[v].update(power.decode(data, v))
                done += 1
                if done % 25 == 0:
                    print(f"  {v}: {done}/{len(urls)} tiles", flush=True)
        print(f"  {v}: {len(series[v])} grid points")

    points = sorted((p for p in series[variables[0]] if all(p in series[v] for v in variables) and LAT_MIN <= p[0] <= LAT_MAX), key=lambda p: (-p[0], p[1]))
    lats = np.array([p[0] for p in points])
    lons = np.array([p[1] for p in points])
    frac = geometry.land_fractions(land, lats, lons)
    keep = frac > 0
    lats, lons, frac = lats[keep], lons[keep], frac[keep]
    kept = [p for p, k in zip(points, keep) if k]
    area = np.array([geometry.cell_area_km2(la) for la in lats]) * frac
    print(f"{len(kept)} land cells")

    scale = {x.id: x.scale for x in VARIABLES}
    for v in variables:
        packed = np.concatenate([quantise(series[v][p], scale[v]) for p in kept])
        (out_cache / f"{v}.i16").write_bytes(packed.tobytes())

    public = root / "public" / "data" / "global"
    public.mkdir(parents=True, exist_ok=True)
    n = len(kept)
    # Column-major cell table: lat*100 (int16), lon*1000 (int32), land area km² (float32), land fraction*255 (uint8).
    blob = (
        np.round(lats * 100).astype("<i2").tobytes()
        + np.round(lons * 1000).astype("<i4").tobytes()
        + area.astype("<f4").tobytes()
        + np.round(frac * 255).astype("u1").tobytes()
    )
    (public / "cells.bin").write_bytes(blob)
    (out_cache / "cells.json").write_text(json.dumps({"lat": lats.tolist(), "lon": lons.tolist(), "area": area.round(1).tolist()}))
    meta = {
        "cells": n,
        "layout": [["lat", "int16", 0.01], ["lon", "int32", 0.001], ["areaKm2", "float32", 1], ["land", "uint8", 1 / 255]],
        "grid": {"dLat": geometry.D_LAT, "dLon": geometry.D_LON, "latMin": LAT_MIN, "latMax": LAT_MAX, "firstYear": FIRST_YEAR, "lastYear": LAST_YEAR, "months": MONTHS, "missing": MISSING},
        "variables": list(variables),
        "provenance": {"api": f"NASA POWER Monthly and Annual API v{api.lstrip('v')}", "sources": sorted(sources), "tiles": len(tiles), "requests": len(requests), "retrieved": dt.date.today().isoformat()},
    }
    (public / "meta.json").write_text(json.dumps(meta))
    (out_cache / "requests.json").write_text(json.dumps(requests))


def assign_countries(root: Path, cache: Path) -> None:
    """Give every global cell the country covering most of it (9 x 9 lattice vote).

    Writes public/data/global/countries.json (ISO numeric id and name per
    country index) and country.bin (uint16 index per cell, 65535 = none).
    """
    from shapely import STRtree, points

    cells = json.loads((cache / "global" / "cells.json").read_text())
    lats = np.array(cells["lat"])
    lons = np.array(cells["lon"])
    topology = json.loads((root / "node_modules/world-atlas/countries-50m.json").read_text())
    names, ids, shapes = [], [], []
    for g in topology["objects"]["countries"]["geometries"]:
        if "arcs" not in g:
            continue
        shapes.append(geometry.repair(geometry.decode_topojson(topology, str(g.get("id")))))
        ids.append(str(g.get("id")))
        names.append(g.get("properties", {}).get("name", ""))
    tree = STRtree(shapes)
    offsets = (np.arange(geometry.LATTICE) + 0.5) / geometry.LATTICE - 0.5
    oy, ox = np.meshgrid(offsets * geometry.D_LAT, offsets * geometry.D_LON, indexing="ij")
    n = len(lats)
    per = oy.size
    sample_lat = (lats[:, None] + oy.ravel()[None, :]).ravel()
    sample_lon = (lons[:, None] + ox.ravel()[None, :]).ravel()
    pt_idx, shape_idx = tree.query(points(sample_lon, sample_lat), predicate="within")
    votes = np.zeros((n, len(shapes)), dtype=np.uint8) if len(shapes) * n < 4e7 else None
    owner = np.full(n, 65535, dtype="<u2")
    if votes is not None:
        np.add.at(votes, (pt_idx // per, shape_idx), 1)
        has = votes.max(axis=1) > 0
        owner[has] = votes[has].argmax(axis=1)
    public = root / "public" / "data" / "global"
    (public / "country.bin").write_bytes(owner.tobytes())
    (public / "countries.json").write_text(json.dumps([{"id": i, "name": nm} for i, nm in zip(ids, names)], ensure_ascii=False))
    print(f"{int((owner != 65535).sum())} of {n} cells assigned to {len(set(owner[owner != 65535].tolist()))} countries")
