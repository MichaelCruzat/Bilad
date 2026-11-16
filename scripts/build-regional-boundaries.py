"""Build label-free, generalized admin-1 lines from a pinned Natural Earth file.

Usage: .venv/bin/python scripts/build-regional-boundaries.py source.geojson
Source and license are recorded alongside the generated asset; no network is
needed to run the app. The source's names/properties are deliberately omitted.
"""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

from shapely.geometry import MultiLineString
from shapely.ops import linemerge

REVISION = "117488dc884bad03366ff727eca013e434615127"
SOURCE = f"https://raw.githubusercontent.com/nvkelso/natural-earth-vector/{REVISION}/geojson/ne_10m_admin_1_states_provinces_lines.geojson"
TOLERANCE = 0.025  # degrees: well below the climate grid's 0.5° latitude step
EXPECTED_SHA256 = "1a1f30ccaaf4cc9c4bde34266f0b8cbb955d3a4cf254b756912255f2ec7c75b6"


def split_dateline(points):
    parts, current = [], []
    for point in points:
        lon, lat = point[:2]
        if current and abs(lon - current[-1][0]) > 180:
            previous_lon, previous_lat = current[-1]
            adjusted = lon + (360 if lon < previous_lon else -360)
            edge = 180 if previous_lon > 0 else -180
            fraction = (edge - previous_lon) / (adjusted - previous_lon)
            crossing = previous_lat + fraction * (lat - previous_lat)
            current.append([edge, crossing])
            if len(current) > 1:
                parts.append(current)
            current = [[-edge, crossing]]
        current.append([lon, lat])
    if len(current) > 1:
        parts.append(current)
    return parts


def build(source: Path, destination: Path):
    raw = source.read_bytes()
    if hashlib.sha256(raw).hexdigest() != EXPECTED_SHA256:
        raise ValueError("Source differs from the pinned Natural Earth revision")
    data = json.loads(raw)
    raw_lines, lines, before = [], [], 0
    for feature in data["features"]:
        geometry = feature["geometry"]
        if not geometry:
            continue
        parts = [geometry["coordinates"]] if geometry["type"] == "LineString" else geometry["coordinates"]
        for coordinates in parts:
            for part in split_dateline(coordinates):
                if max(p[1] for p in part) < -60 or min(p[1] for p in part) > 84:
                    continue
                before += len(part)
                raw_lines.append(part)
    # Join degree-two fragments before generalizing: shipping tens of thousands
    # of two-point fragments adds objects and draw calls without adding detail.
    for line in linemerge(MultiLineString(raw_lines)).geoms:
        simplified = line.simplify(TOLERANCE, preserve_topology=True)
        points = [[round(x, 3), round(y, 3)] for x, y in simplified.coords]
        if len(set(map(tuple, points))) > 1:
            lines.append(points)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps({"type": "MultiLineString", "coordinates": lines}, separators=(",", ":")))
    meta = {
        "source": "Natural Earth 1:10m Admin-1 boundary lines",
        "sourceUrl": SOURCE,
        "sourceSha256": hashlib.sha256(raw).hexdigest(),
        "revision": REVISION,
        "license": "Public domain",
        "licenseUrl": "https://www.naturalearthdata.com/about/terms-of-use/",
        "simplificationDegrees": TOLERANCE,
        "coordinateDecimals": 3,
        "lines": len(lines),
        "sourceVertices": before,
        "vertices": sum(map(len, lines)),
        "bytes": destination.stat().st_size,
        "note": "Display context only; no labels or properties. Coverage and administrative definitions follow the source and may omit small or disputed areas. Climate statistics are unchanged.",
    }
    destination.with_suffix(".meta.json").write_text(json.dumps(meta, indent=2) + "\n")
    print(json.dumps(meta, indent=2))


if __name__ == "__main__":
    build(Path(sys.argv[1]), Path("public/data/admin1.json"))
