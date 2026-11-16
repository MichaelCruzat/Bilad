"""Map context for each nation: NASA Blue Marble relief and neighbouring borders.

The relief image comes from NASA GIBS (Global Imagery Browse Services), WMS in
EPSG:4326, so its pixels are linear in longitude and latitude. The app draws
nations on a cylindrical projection that is also linear in both, which lets
the image sit under the grid cells without any resampling.

Writes into public/data/nations/<ISO3>/:
  relief.jpg     Blue Marble shaded relief with bathymetry for the map extent
  context.json   neighbouring country borders clipped to the extent
and records the extent in meta.json as "extent": [west, south, east, north].
"""

from __future__ import annotations

import json
import math
import urllib.parse
from pathlib import Path

import shapely
from shapely.geometry import box, mapping

from . import geometry
from .nations import Nation
from .net import urlopen

GIBS = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi"
LAYER = "BlueMarble_ShadedRelief_Bathymetry"
LONG_SIDE_PX = 1600


def extent_for(shape) -> tuple[float, float, float, float]:
    """Boundary bounds grown by 12% (at least 1°) and snapped to 0.5°."""
    west, south, east, north = shape.bounds
    pad_lat = max(1.0, (north - south) * 0.12)
    pad_lon = max(1.0, (east - west) * 0.12)
    snap = lambda v, up: (math.ceil if up else math.floor)(v * 2) / 2
    return (snap(west - pad_lon, False), snap(max(-89.5, south - pad_lat), False), snap(east + pad_lon, True), snap(min(89.5, north + pad_lat), True))


def relief_url(extent: tuple[float, float, float, float], long_side: int = LONG_SIDE_PX) -> tuple[str, int, int]:
    west, south, east, north = extent
    lat0 = math.radians((south + north) / 2)
    ratio = (east - west) * math.cos(lat0) / (north - south)  # displayed width / height
    width, height = (long_side, round(long_side / ratio)) if ratio >= 1 else (round(long_side * ratio), long_side)
    query = urllib.parse.urlencode({
        "SERVICE": "WMS", "REQUEST": "GetMap", "VERSION": "1.3.0", "LAYERS": LAYER, "STYLES": "",
        "CRS": "EPSG:4326", "BBOX": f"{south},{west},{north},{east}",  # WMS 1.3 EPSG:4326 axis order is lat,lon
        "WIDTH": width, "HEIGHT": height, "FORMAT": "image/jpeg",
    })
    return f"{GIBS}?{query}", width, height


def neighbours(world_atlas: Path, nation: Nation, extent) -> dict:
    """Other countries' borders inside the extent, as lines (never the clip edge).

    Each feature carries its name and a label point (inside the clipped
    country) so the app can letter it without guessing.
    """
    topology = json.loads(world_atlas.read_text())
    west, south, east, north = extent
    frame = box(*extent)
    inner = box(west + 0.01, south + 0.01, east - 0.01, north - 0.01)
    features = []
    for g in topology["objects"]["countries"]["geometries"]:
        if str(g.get("id")) == nation.atlas_id or "arcs" not in g:
            continue
        # Polygons crossing the antimeridian are cut there instead of wrapping the globe.
        shape = geometry.repair(geometry.decode_topojson(topology, str(g.get("id"))))
        if not shape.intersects(frame):
            continue
        clipped = shapely.clip_by_rect(shape, *extent)
        lines = shapely.intersection(shapely.simplify(shape.boundary, 0.01), inner)
        if lines.is_empty:
            continue
        lines = shapely.set_precision(lines, 0.001)
        label = clipped.representative_point() if not clipped.is_empty else None
        features.append({
            "type": "Feature",
            "properties": {
                "name": g.get("properties", {}).get("name", ""),
                "label": [round(label.x, 3), round(label.y, 3)] if label else None,
                "share": round(clipped.area / frame.area, 4),
            },
            "geometry": mapping(lines),
        })
    return {"type": "FeatureCollection", "features": features}


def build_context(nation: Nation, root: Path) -> None:
    world_atlas = root / "node_modules/world-atlas/countries-50m.json"
    shape = geometry.load_boundary(nation, world_atlas)
    extent = extent_for(shape)
    out = root / "public" / "data" / "nations" / nation.iso3
    url, width, height = relief_url(extent)
    with urlopen(url, timeout=120) as response:
        if not response.headers.get("Content-Type", "").startswith("image/"):
            raise RuntimeError(f"GIBS returned {response.headers.get('Content-Type')} for {nation.iso3}")
        (out / "relief.jpg").write_bytes(response.read())
    thumb_url, _, _ = relief_url(extent, 480)
    with urlopen(thumb_url, timeout=120) as response:
        (out / "relief-thumb.jpg").write_bytes(response.read())
    (out / "context.json").write_text(json.dumps(neighbours(world_atlas, nation, extent), separators=(",", ":"), ensure_ascii=False))
    meta_path = out / "meta.json"
    meta = json.loads(meta_path.read_text())
    meta["extent"] = list(extent)
    meta["basemap"] = {"source": f"NASA GIBS {LAYER}", "url": url, "width": width, "height": height}
    meta_path.write_text(json.dumps(meta, separators=(",", ":"), ensure_ascii=False))
    print(f"  {nation.iso3}: relief {width}x{height}, {len(json.loads((out / 'context.json').read_text())['features'])} neighbours")


def build_global_relief(root: Path) -> None:
    """Blue Marble relief for the global atlas extent (180°W–180°E, 60°S–84°N)."""
    extent = (-180.0, -60.0, 180.0, 84.0)
    query = urllib.parse.urlencode({
        "SERVICE": "WMS", "REQUEST": "GetMap", "VERSION": "1.3.0", "LAYERS": LAYER, "STYLES": "",
        "CRS": "EPSG:4326", "BBOX": f"{extent[1]},{extent[0]},{extent[3]},{extent[2]}",
        "WIDTH": 3000, "HEIGHT": 1200, "FORMAT": "image/jpeg",
    })
    url = f"{GIBS}?{query}"
    out = root / "public" / "data" / "global"
    out.mkdir(parents=True, exist_ok=True)
    with urlopen(url, timeout=180) as response:
        if not response.headers.get("Content-Type", "").startswith("image/"):
            raise RuntimeError("GIBS did not return an image for the global relief")
        (out / "relief.jpg").write_bytes(response.read())
    meta_path = out / "meta.json"
    meta = json.loads(meta_path.read_text())
    meta["extent"] = list(extent)
    meta["basemap"] = {"source": f"NASA GIBS {LAYER}", "url": url, "width": 3000, "height": 1200}
    meta_path.write_text(json.dumps(meta))
    print("  global relief 3000x1200")
