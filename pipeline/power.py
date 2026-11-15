"""NASA POWER regional monthly requests: tiling, caching and decoding."""

from __future__ import annotations

import hashlib
import json
import math
import time
import urllib.error
import urllib.parse
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from .geometry import D_LAT, D_LON
from .net import urlopen
from .variables import FIRST_YEAR, LAST_YEAR, MONTHS

ENDPOINT = "https://power.larc.nasa.gov/api/temporal/monthly/regional"
MAX_TILE = 10  # degrees; POWER's regional limit
MIN_TILE = 2


@dataclass(frozen=True)
class Tile:
    lat_min: float
    lat_max: float
    lon_min: float
    lon_max: float


def _snap(value: float, step: float, up: bool) -> float:
    return (math.ceil if up else math.floor)(value / step) * step


def tiles_for(west: float, south: float, east: float, north: float) -> list[Tile]:
    """Cover a bounding box (grown by half a cell) with tiles of at most 10° x 10°."""
    lat_min = _snap(south - D_LAT / 2, D_LAT, False)
    lat_max = _snap(north + D_LAT / 2, D_LAT, True)
    lon_min = _snap(west - D_LON / 2, D_LON, False)
    lon_max = _snap(east + D_LON / 2, D_LON, True)
    tiles = []
    la = lat_min
    while la < lat_max:
        lo = lon_min
        while lo < lon_max:
            t_lat_max = min(la + MAX_TILE, lat_max)
            t_lon_max = min(lo + MAX_TILE, lon_max)
            # POWER rejects very thin boxes; widen them, extra cells are masked later.
            t_lat_min = t_lat_max - MIN_TILE if t_lat_max - la < MIN_TILE else la
            t_lon_min = t_lon_max - MIN_TILE if t_lon_max - lo < MIN_TILE else lo
            tiles.append(Tile(t_lat_min, t_lat_max, t_lon_min, t_lon_max))
            lo += MAX_TILE
        la += MAX_TILE
    return tiles


def _js_number(value: float) -> str:
    """Format like JavaScript's String(number), so request URLs (and cache keys) stay stable."""
    return str(int(value)) if float(value).is_integer() else repr(float(value))


def request_url(variable: str, tile: Tile) -> str:
    query = urllib.parse.urlencode({
        "parameters": variable,
        "community": "AG",
        "latitude-min": _js_number(tile.lat_min),
        "latitude-max": _js_number(tile.lat_max),
        "longitude-min": _js_number(tile.lon_min),
        "longitude-max": _js_number(tile.lon_max),
        "start": FIRST_YEAR,
        "end": LAST_YEAR,
        "format": "JSON",
    })
    return f"{ENDPOINT}?{query}"


def fetch(url: str, cache: Path, attempts: int = 4) -> dict:
    """GET a POWER response, reusing an on-disk copy keyed by the URL's hash."""
    cache.mkdir(parents=True, exist_ok=True)
    path = cache / f"{hashlib.sha256(url.encode()).hexdigest()[:32]}.json"
    if path.exists():
        return json.loads(path.read_text())
    for attempt in range(1, attempts + 1):
        try:
            with urlopen(url, timeout=180) as response:
                body = response.read().decode()
            data = json.loads(body)
            if "features" not in data:
                raise ValueError(str(data.get("messages", data))[:200])
            path.write_text(body)
            return data
        except (urllib.error.URLError, ValueError, TimeoutError) as error:
            if attempt == attempts:
                raise
            wait = 2 * attempt**2
            print(f"  retry {attempt} in {wait}s: {error}")
            time.sleep(wait)
    raise RuntimeError("unreachable")


def decode(data: dict, variable: str) -> dict[tuple[float, float], np.ndarray]:
    """Monthly series per grid point (lat, lon), NaN for POWER's fill value."""
    fill = data["header"]["fill_value"]
    out: dict[tuple[float, float], np.ndarray] = {}
    for feature in data["features"]:
        lon, lat = feature["geometry"]["coordinates"][:2]
        raw = feature["properties"]["parameter"].get(variable)
        if raw is None:
            raise ValueError(f"Response for {variable} is missing the parameter")
        series = np.full(MONTHS, np.nan)
        for key, value in raw.items():
            year, month = int(key[:4]), int(key[4:])
            if 1 <= month <= 12 and FIRST_YEAR <= year <= LAST_YEAR and value != fill:
                series[(year - FIRST_YEAR) * 12 + month - 1] = value
        out[(round(lat, 3), round(lon, 3))] = series
    return out
