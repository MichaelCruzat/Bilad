"""Boundaries, land fractions and cell areas.

Boundaries come from world-atlas (Natural Earth 1:50m), which ships as
TopoJSON; ``decode_topojson`` turns one country into a shapely geometry.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
import shapely
import shapely.affinity
from shapely.geometry import MultiPolygon, Polygon, mapping

from .nations import Nation

EARTH_RADIUS_KM = 6371.0088
D_LAT = 0.5
D_LON = 0.625
LATTICE = 9  # land fraction sampled on a 9 x 9 lattice per cell
# A polygon that crosses the antimeridian (Fiji, the Aleutians) spans ~360°
# of longitude on a flat plane. Real continents stay well below this
# (Afro-Eurasia is ~197° wide), so anything wider is a wrap artefact.
WRAP_DEGREES = 300


def _decode_arcs(topology: dict) -> list[list[tuple[float, float]]]:
    """Delta-decode and de-quantise every arc in a TopoJSON topology."""
    sx, sy = topology["transform"]["scale"]
    tx, ty = topology["transform"]["translate"]
    arcs = []
    for arc in topology["arcs"]:
        x = y = 0
        points = []
        for dx, dy in arc:
            x += dx
            y += dy
            points.append((x * sx + tx, y * sy + ty))
        arcs.append(points)
    return arcs


def _ring(indices: list[int], arcs: list[list[tuple[float, float]]]) -> list[tuple[float, float]]:
    ring: list[tuple[float, float]] = []
    for index in indices:
        arc = arcs[index] if index >= 0 else arcs[~index][::-1]
        ring.extend(arc if not ring else arc[1:])
    return ring


def decode_topojson(topology: dict, atlas_id: str) -> MultiPolygon:
    arcs = _decode_arcs(topology)
    for geometry in topology["objects"]["countries"]["geometries"]:
        if str(geometry.get("id")) != atlas_id:
            continue
        polygons = [geometry["arcs"]] if geometry["type"] == "Polygon" else geometry["arcs"]
        shapes = []
        for polygon in polygons:
            rings = [_ring(r, arcs) for r in polygon]
            shapes.append(Polygon(rings[0], rings[1:]))
        return MultiPolygon(shapes)
    raise SystemExit(f"No boundary with id {atlas_id} in world-atlas")


def load_boundary(nation: Nation, world_atlas: Path) -> MultiPolygon:
    """The nation's boundary, keeping only polygons that reach into its clip."""
    shape = decode_topojson(json.loads(world_atlas.read_text()), nation.atlas_id)
    if nation.clip is None:
        return shape
    c = nation.clip
    kept = [p for p in shape.geoms if any(c.contains(lat, lon) for lon, lat in p.exterior.coords)]
    return MultiPolygon(kept)


def boundary_geojson(shape: MultiPolygon, iso3: str) -> dict:
    """GeoJSON Feature with coordinates rounded to 0.001° (about 100 m)."""
    shape = shapely.set_precision(shape, 0.001)
    geometry = mapping(shape if isinstance(shape, MultiPolygon) else MultiPolygon([shape]))
    return {"type": "Feature", "id": iso3, "properties": {}, "geometry": geometry}


def cell_area_km2(lat: float) -> float:
    """Area of one 0.5° x 0.625° cell centred at ``lat``, on a sphere."""
    rad = math.pi / 180
    return EARTH_RADIUS_KM**2 * D_LON * rad * abs(math.sin((lat + D_LAT / 2) * rad) - math.sin((lat - D_LAT / 2) * rad))


def land_fractions(shape: MultiPolygon, lats: np.ndarray, lons: np.ndarray) -> np.ndarray:
    """Share of each cell's sample lattice that falls inside the boundary."""
    offsets = (np.arange(LATTICE) + 0.5) / LATTICE - 0.5
    oy, ox = np.meshgrid(offsets * D_LAT, offsets * D_LON, indexing="ij")
    sample_lat = lats[:, None] + oy.ravel()[None, :]
    sample_lon = lons[:, None] + ox.ravel()[None, :]
    shapely.prepare(shape)
    inside = shapely.contains_xy(shape, sample_lon.ravel(), sample_lat.ravel()).reshape(sample_lat.shape)
    return inside.mean(axis=1)


def bounds(shape: MultiPolygon) -> tuple[float, float, float, float]:
    """(west, south, east, north)."""
    return shape.bounds


def _unwrap(ring: list[tuple[float, float]]) -> list[tuple[float, float]]:
    """Make a ring continuous across the antimeridian by undoing ±360° jumps."""
    out: list[tuple[float, float]] = []
    shift = 0.0
    prev = None
    for lon, lat in ring:
        if prev is not None:
            if lon - prev > 180:
                shift -= 360
            elif lon - prev < -180:
                shift += 360
        prev = lon
        out.append((lon + shift, lat))
    return out


def split_antimeridian(polygon: Polygon) -> list[Polygon]:
    """Repair a polygon that crosses the antimeridian into valid pieces in [-180, 180].

    Natural Earth stores some land (Afro-Eurasia, Fiji, the Aleutians) as one
    polygon whose longitudes jump between +180 and -180. On a plane that reads
    as a 360°-wide band, so it is unwrapped into one continuous shape and then
    cut at the antimeridian.
    """
    west, _, east, _ = polygon.bounds
    if east - west < WRAP_DEGREES:
        return [polygon]
    shell = _unwrap(list(polygon.exterior.coords))
    holes = [_unwrap(list(r.coords)) for r in polygon.interiors]
    fixed = shapely.make_valid(Polygon(shell, holes))
    pieces: list[Polygon] = []
    for offset in (-360, 0, 360):
        window = shapely.box(-180 - offset, -90, 180 - offset, 90)
        part = shapely.intersection(fixed, window)
        if part.is_empty:
            continue
        part = shapely.affinity.translate(part, xoff=offset)
        for g in getattr(part, "geoms", [part]):
            if isinstance(g, Polygon) and not g.is_empty and g.area > 0:
                pieces.append(g)
    return pieces


def repair(shape: MultiPolygon) -> MultiPolygon:
    """Split every antimeridian-crossing polygon of a shape."""
    parts: list[Polygon] = []
    for p in getattr(shape, "geoms", [shape]):
        parts.extend(split_antimeridian(p))
    return MultiPolygon(parts)
