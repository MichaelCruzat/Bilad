"""Independent checks of derived findings from the shipped binary inputs."""
import json
from pathlib import Path
import unittest

import numpy as np
from scipy.stats import spearmanr, theilslopes

from pipeline.validate import corrected_p, tie_round


DATA = Path(__file__).resolve().parent.parent / "public" / "data" / "global"


class GlobalFindings(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.findings = json.loads((DATA / "findings.json").read_text())
        cls.meta = json.loads((DATA / "meta.json").read_text())
        cls.witness_info = json.loads((DATA / "witness.json").read_text())
        cls.n = cls.meta["cells"]
        cls.years = np.arange(*[cls.meta["grid"]["firstYear"], cls.meta["grid"]["lastYear"] + 1])
        cls.weights = np.frombuffer((DATA / "cells.bin").read_bytes(), dtype="<f4", count=cls.n, offset=6 * cls.n).astype(float)
        cls.countries = np.fromfile(DATA / "country.bin", dtype="<u2")

    def witness(self, variable):
        info = self.witness_info[variable]
        count = info["boxes"] * info["years"]
        raw = (DATA / f"witness-{variable}.bin").read_bytes()
        packed = np.frombuffer(raw, dtype="<i2", count=count).reshape(info["boxes"], info["years"])
        # The browser stores decoded readings as Float32, then aggregates in double precision.
        values = (packed.astype(float) * 0.01).astype(np.float32).astype(float)
        values[packed == -32768] = np.nan
        boxes = np.frombuffer(raw, dtype="<u2", count=self.n, offset=2 * count)
        return values, boxes

    def test_global_temperature_slopes_and_p_against_independent_code(self):
        packed = np.fromfile(DATA / "T2M.annual.i16", dtype="<i2").reshape(self.n, -1)
        annual = (packed.astype(float) * 0.01).astype(np.float32).astype(float)
        annual[packed == -32768] = np.nan
        finite = np.isfinite(annual)
        claim = np.nansum(annual * self.weights[:, None], axis=0) / (finite * self.weights[:, None]).sum(axis=0)
        values, boxes = self.witness("T2M")
        witness = []
        for year in range(len(self.years)):
            available = boxes < len(values)
            readings = np.full(self.n, np.nan)
            readings[available] = values[boxes[available], year]
            ok = np.isfinite(readings)
            area = self.weights[ok].sum()
            witness.append(np.dot(readings[ok], self.weights[ok]) / area if area >= self.weights.sum() / 2 else np.nan)
        witness = np.array(witness)
        witness -= np.nanmean(witness[10:40])  # 1991–2020 baseline

        record = self.findings["variables"]["T2M"]["allLand"]
        for name, series in [("claim", claim), ("witness", witness)]:
            ok = np.isfinite(series)
            expected = theilslopes(tie_round(series[ok]), self.years[ok]).slope * 10
            self.assertEqual(record[name]["n"], int(ok.sum()))
            self.assertAlmostEqual(record[name]["perDecade"], expected, delta=0.00051)
            self.assertAlmostEqual(record[name]["p"], corrected_p(series), delta=2e-6)

    def test_coverage_correlations_handle_ties_and_constant_input(self):
        for variable in ["T2M", "PRECTOTCORR"]:
            values, boxes = self.witness(variable)
            years_available = np.zeros(self.n)
            ok = boxes < len(values)
            years_available[ok] = np.isfinite(values).sum(axis=1)[boxes[ok]]
            flags = np.frombuffer((DATA / f"{variable}.stats.bin").read_bytes(), dtype="u1", count=self.n, offset=24 * self.n)
            coverage, flagged = [], []
            for country in np.unique(self.countries):
                mask = self.countries == country
                if country == 65535 or mask.sum() < 12:
                    continue
                area = self.weights[mask].sum()
                coverage.append(np.dot(self.weights[mask], years_available[mask]) / len(self.years) / area)
                flagged.append(self.weights[mask & ((flags & 4) != 0)].sum() / area)
            expected = None if np.ptp(coverage) == 0 or np.ptp(flagged) == 0 else spearmanr(coverage, flagged).statistic
            actual = self.findings["variables"][variable]["coverageVsFlagged"]
            if expected is None:
                self.assertIsNone(actual)
            else:
                self.assertAlmostEqual(actual, expected, delta=0.00051)


if __name__ == "__main__":
    unittest.main()
