"""Build one nation: fetch NASA POWER tiles, mask cells to the boundary, pack.

Output in ``public/data/nations/<ISO3>/``:
  <VAR>.i16      little-endian Int16, cell-major, 528 months per cell
  meta.json      cells (lat, lon, land fraction, land area), grid, provenance
  boundary.json  GeoJSON boundary used for drawing and clipping
"""

from __future__ import annotations

import datetime as dt
import json
from pathlib import Path

import numpy as np

from . import geometry, power
from .nations import Nation
from .variables import FIRST_YEAR, LAST_YEAR, MISSING, MONTHS, VARIABLES


def quantise(series: np.ndarray, scale: float) -> np.ndarray:
    """Round half up (like JavaScript's Math.round) to Int16, MISSING for NaN."""
    q = np.floor(series / scale + 0.5)
    q = np.clip(q, -32767, 32767)
    return np.where(np.isfinite(series), q, MISSING).astype("<i2")


def build_nation(nation: Nation, root: Path, cache: Path) -> None:
    print(f"\n{nation.name} ({nation.iso3})")
    shape = geometry.load_boundary(nation, root / "node_modules/world-atlas/countries-50m.json")
    tiles = power.tiles_for(*geometry.bounds(shape))
    print(f"  {len(tiles)} tile(s) x {len(VARIABLES)} variables")

    grids: dict[str, dict[tuple[float, float], np.ndarray]] = {}
    requests, sources, api = [], set(), ""
    for variable in VARIABLES:
        grids[variable.id] = {}
        for tile in tiles:
            url = power.request_url(variable.id, tile)
            requests.append({"variable": variable.id, "url": url})
            data = power.fetch(url, cache)
            api = data["header"]["api"]["version"]
            sources.update(data["header"]["sources"])
            grids[variable.id].update(power.decode(data, variable.id))
        print(f"  {variable.id} ok")

    points = [p for p in grids[VARIABLES[0].id] if all(p in grids[v.id] for v in VARIABLES)]
    if nation.clip:
        points = [p for p in points if nation.clip.contains(*p)]
    lats = np.array([p[0] for p in points])
    lons = np.array([p[1] for p in points])
    land = geometry.land_fractions(shape, lats, lons)
    cells = [
        {"lat": float(la), "lon": float(lo), "land": round(float(f), 3), "areaKm2": round(geometry.cell_area_km2(la) * f)}
        for la, lo, f in zip(lats, lons, land)
        if f > 0
    ]
    cells.sort(key=lambda c: (-c["lat"], c["lon"]))
    print(f"  {len(cells)} land cells")

    out = root / "public" / "data" / "nations" / nation.iso3
    out.mkdir(parents=True, exist_ok=True)
    for variable in VARIABLES:
        packed = np.concatenate([quantise(grids[variable.id][(c["lat"], c["lon"])], variable.scale) for c in cells])
        (out / f"{variable.id}.i16").write_bytes(packed.tobytes())
    (out / "boundary.json").write_text(json.dumps(geometry.boundary_geojson(shape, nation.iso3), separators=(",", ":")))
    meta = {
        "iso3": nation.iso3,
        "name": nation.name,
        "rationale": nation.rationale,
        "regions": [{"id": r.id, "name": r.name, "latMin": r.lat_min, "latMax": r.lat_max} for r in nation.regions],
        "grid": {"dLat": geometry.D_LAT, "dLon": geometry.D_LON, "firstYear": FIRST_YEAR, "lastYear": LAST_YEAR, "months": MONTHS, "missing": MISSING},
        "cells": cells,
        "variables": [{"id": v.id, "scale": v.scale} for v in VARIABLES],
        "provenance": {
            "api": f"NASA POWER Monthly and Annual API v{api.lstrip('v')}",
            "sources": sorted(sources),
            "community": "AG",
            "retrieved": dt.date.today().isoformat(),
            "requests": requests,
        },
    }
    previous = out / "meta.json"
    if previous.exists():  # keep the basemap written by `python -m pipeline context`
        old = json.loads(previous.read_text())
        meta.update({k: old[k] for k in ("extent", "basemap") if k in old})
    (out / "meta.json").write_text(json.dumps(meta, separators=(",", ":"), ensure_ascii=False))
