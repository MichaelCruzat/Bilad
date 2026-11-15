"""Independent cross-check series for every shipped nation.

MERRA-2 (via NASA POWER) is a reanalysis: a model constrained by
observations, and its record can jump when the assimilated observing system
changes. This script extracts national annual series from two NASA
observation-based products so the app can show whether a reanalysis trend
is corroborated:

  * GISTEMP v4, 250 km smoothing, land stations only (NASA GISS)
    https://data.giss.nasa.gov/gistemp/
  * GPCP v2.3 monthly precipitation, gauge + satellite (NASA GSFC),
    distributed by NOAA PSL  https://psl.noaa.gov/data/gridded/data.gpcp.html

Each product is sampled at the centre of every Bilad grid cell (the product
cell that contains it) and averaged with Bilad's own area weights, so the
footprint is identical to the reanalysis national series. Only series are
written here; all statistics run in the shared TypeScript engine.

Run with ``python -m pipeline crosscheck`` (downloads both products once).
"""

from __future__ import annotations

import datetime as dt
import json
from pathlib import Path

import netCDF4
import numpy as np

from .variables import FIRST_YEAR as FIRST, LAST_YEAR as LAST
MIN_MONTHS = 10


def monthly_index(time_var) -> list[tuple[int, int]]:
    dates = netCDF4.num2date(time_var[:], time_var.units, only_use_cftime_datetimes=False)
    return [(d.year, d.month) for d in dates]


def nearest(axis: np.ndarray, value: float, periodic: bool = False) -> int:
    diff = np.abs(axis - value)
    if periodic:
        diff = np.minimum(diff, 360 - diff)
    return int(np.argmin(diff))


def national_series(field, ym, lats, lons, cells, lon360: bool, fill_check) -> tuple[list, list]:
    """Annual national mean (area-weighted, renormalised over cells with data) and coverage."""
    li = np.array([nearest(lats, c["lat"]) for c in cells])
    lo = np.array([nearest(lons, (c["lon"] % 360) if lon360 else c["lon"], periodic=True) for c in cells])
    w = np.array([c["areaKm2"] for c in cells], dtype=float)
    pairs = sorted(set(zip(li.tolist(), lo.tolist())))
    pair_index = {p: k for k, p in enumerate(pairs)}
    cell_to_pair = np.array([pair_index[(a, b)] for a, b in zip(li.tolist(), lo.tolist())])
    pi = np.array([p[0] for p in pairs])
    pj = np.array([p[1] for p in pairs])

    out, coverage = [], []
    for year in range(FIRST, LAST + 1):
        idx = [k for k, (y, _) in enumerate(ym) if y == year]
        if not idx:
            out.append(None)
            coverage.append(0.0)
            continue
        block = np.ma.filled(field[idx][:, pi, pj].astype(float), np.nan)  # months x pairs
        block[~fill_check(block)] = np.nan
        valid = np.sum(np.isfinite(block), axis=0)
        with np.errstate(invalid="ignore"):
            sums = np.nansum(block, axis=0)
        annual_pair = np.where(valid >= MIN_MONTHS, sums / np.maximum(valid, 1), np.nan)
        annual_cell = annual_pair[cell_to_pair]
        ok = np.isfinite(annual_cell)
        cov = float(w[ok].sum() / w.sum())
        coverage.append(round(cov, 3))
        out.append(round(float(np.sum(annual_cell[ok] * w[ok]) / w[ok].sum()), 4) if cov >= 0.5 else None)
    return out, coverage


def run(gistemp: Path, gpcp: Path, data: Path) -> None:
    gis = netCDF4.Dataset(gistemp)
    gis_field = gis.variables["tempanomaly"]
    gis_field.set_auto_mask(True)
    gis_ym = monthly_index(gis.variables["time"])

    gp = netCDF4.Dataset(gpcp)
    gp_field = gp.variables["precip"]
    gp_field.set_auto_mask(True)
    gp_ym = monthly_index(gp.variables["time"])

    nations = sorted(p.name for p in (data / "nations").iterdir() if (p / "meta.json").exists())
    result = {
        "generated": dt.date.today().isoformat(),
        "firstYear": FIRST,
        "lastYear": LAST,
        "products": {
            "T2M": {
                "name": "GISTEMP v4 (250 km, land stations)",
                "agency": "NASA GISS",
                "unit": "°C anomaly",
                "url": "https://data.giss.nasa.gov/gistemp/",
            },
            "PRECTOTCORR": {
                "name": "GPCP v2.3 monthly precipitation",
                "agency": "NASA GSFC (via NOAA PSL)",
                "unit": "mm/day",
                "url": "https://psl.noaa.gov/data/gridded/data.gpcp.html",
            },
        },
        "nations": {},
    }

    for iso in nations:
        meta = json.loads((data / "nations" / iso / "meta.json").read_text())
        cells = meta["cells"]
        t_series, t_cov = national_series(
            gis_field, gis_ym, gis.variables["lat"][:], gis.variables["lon"][:], cells, False,
            lambda b: np.isfinite(b) & (np.abs(b) < 50),
        )
        p_series, p_cov = national_series(
            gp_field, gp_ym, gp.variables["lat"][:], gp.variables["lon"][:], cells, True,
            lambda b: np.isfinite(b) & (b >= 0) & (b < 200),
        )
        entry = {
            "T2M": {"series": t_series, "coverage": t_cov},
            "PRECTOTCORR": {"series": p_series, "coverage": p_cov},
            "regions": {},
        }
        for region in meta.get("regions", []):
            sub = [c for c in cells if region["latMin"] <= c["lat"] <= region["latMax"]]
            if not sub:
                continue
            rt, rtc = national_series(
                gis_field, gis_ym, gis.variables["lat"][:], gis.variables["lon"][:], sub, False,
                lambda b: np.isfinite(b) & (np.abs(b) < 50),
            )
            rp, rpc = national_series(
                gp_field, gp_ym, gp.variables["lat"][:], gp.variables["lon"][:], sub, True,
                lambda b: np.isfinite(b) & (b >= 0) & (b < 200),
            )
            entry["regions"][region["id"]] = {
                "T2M": {"series": rt, "coverage": rtc},
                "PRECTOTCORR": {"series": rp, "coverage": rpc},
            }
        result["nations"][iso] = entry
        print(f"{iso}: GISTEMP years {sum(v is not None for v in t_series)}, GPCP years {sum(v is not None for v in p_series)}")

    (data / "crosscheck.json").write_text(json.dumps(result))
    print(f"Wrote {data / 'crosscheck.json'}")
