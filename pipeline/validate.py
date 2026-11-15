"""Independent recomputation of every shipped headline.

``scripts/summarize.ts`` writes ``index.json`` with Bilad's TypeScript
engine. This module rebuilds the same numbers from the raw packed binaries
with different code (numpy, ``scipy.stats.theilslopes`` and
``pymannkendall``) and fails if any headline disagrees. Two implementations
in two languages that agree are much harder to get wrong than one.

Checked per nation and variable:
  * national area-weighted annual anomaly series (1991–2020 normal)
  * Theil–Sen slope of that series
  * Hamed–Rao corrected Mann–Kendall p-value (Bilad floors the variance
    inflation at 1; the reference value is adjusted the same way)
  * share of land with a significant rise / fall after Benjamini–Hochberg
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pymannkendall as mk
from scipy import stats

from .variables import FIRST_YEAR, LAST_YEAR, VARIABLES

DISPLAY = {"PRECTOTCORR": 365.25, "GWETROOT": 100.0}
BASE = (1991 - FIRST_YEAR, 2020 - FIRST_YEAR)
YEARS = np.arange(FIRST_YEAR, LAST_YEAR + 1)


def annual_anomalies(monthly: np.ndarray) -> np.ndarray:
    """(cells, years*12) -> (cells, years): mean monthly anomaly, >= 10 months per year."""
    m = monthly.reshape(monthly.shape[0], -1, 12)
    clim = np.nanmean(m[:, BASE[0] : BASE[1] + 1, :], axis=1)
    anomalies = m - clim[:, None, :]
    counts = np.isfinite(anomalies).sum(axis=2)
    with np.errstate(invalid="ignore"):
        annual = np.nansum(anomalies, axis=2) / np.maximum(counts, 1)
    return np.where(counts >= 10, annual, np.nan)


def corrected_p(series: np.ndarray) -> float:
    """Hamed–Rao p with the variance inflation floored at 1, as Bilad does."""
    series = series[np.isfinite(series)]
    original = mk.original_test(series)
    modified = mk.hamed_rao_modification_test(series)
    return original.p if modified.var_s < original.var_s else modified.p


def bh_threshold(p: np.ndarray, alpha: float = 0.1) -> float:
    p = np.sort(p[np.isfinite(p)])
    passing = p <= alpha * np.arange(1, p.size + 1) / p.size
    return float(p[np.nonzero(passing)[0].max()]) if passing.any() else 0.0


def check_nation(data: Path, iso3: str, summary: dict) -> list[str]:
    meta = json.loads((data / "nations" / iso3 / "meta.json").read_text())
    weights = np.array([c["areaKm2"] for c in meta["cells"]], dtype=float)
    months = meta["grid"]["months"]
    problems = []
    for variable in VARIABLES:
        raw = np.fromfile(data / "nations" / iso3 / f"{variable.id}.i16", dtype="<i2").reshape(-1, months)
        monthly = np.where(raw == meta["grid"]["missing"], np.nan, raw * variable.scale)
        annual = annual_anomalies(monthly)
        display = DISPLAY.get(variable.id, 1.0)

        ok = np.isfinite(annual)
        national = np.nansum(annual * weights[:, None], axis=0) / np.sum(ok * weights[:, None], axis=0)
        shipped = summary["stats"][variable.id]

        series_error = np.max(np.abs(national * display - np.array(shipped["series"])))
        slope = stats.theilslopes(national, YEARS).slope * 10 * display
        p = corrected_p(national)

        cell_p = np.array([corrected_p(a) if np.isfinite(a).sum() >= 10 else np.nan for a in annual])
        cell_slope = np.array([stats.theilslopes(a[np.isfinite(a)], YEARS[np.isfinite(a)]).slope if np.isfinite(a).sum() >= 10 else np.nan for a in annual])
        threshold = bh_threshold(cell_p)
        significant = np.isfinite(cell_p) & (cell_p <= threshold) & (threshold > 0)
        up = weights[significant & (cell_slope > 0)].sum() / weights.sum()
        down = weights[significant & (cell_slope < 0)].sum() / weights.sum()

        checks = {
            "series": (series_error, 0.002 * max(1.0, display / 100)),
            "slope": (abs(slope - shipped["slopePerDecade"]), 1e-6 + 1e-6 * abs(slope)),
            "p": (abs(p - shipped["p"]), 1e-4),
            "areaUp": (abs(up - shipped["areaUp"]), 0.02),
            "areaDown": (abs(down - shipped["areaDown"]), 0.02),
        }
        failed = [f"{name} off by {err:.2g} (tolerance {tol:.2g})" for name, (err, tol) in checks.items() if err > tol]
        status = "ok" if not failed else "MISMATCH: " + "; ".join(failed)
        print(f"  {variable.id:<12} slope {slope:+9.3f}/decade  p {p:.3g}  up {up:5.1%}  down {down:5.1%}  {status}")
        problems += [f"{iso3} {variable.id}: {f}" for f in failed]
    return problems


def run(data: Path) -> int:
    index = json.loads((data / "index.json").read_text())
    problems: list[str] = []
    for summary in index["nations"]:
        print(summary["name"])
        problems += check_nation(data, summary["iso3"], summary)
    if problems:
        print(f"\n{len(problems)} headline(s) disagree between the TypeScript and Python implementations:")
        print("\n".join(f"  {p}" for p in problems))
        return 1
    print("\nAll headlines agree between the TypeScript engine and the independent Python recomputation.")
    return 0
