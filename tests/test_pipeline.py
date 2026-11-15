"""Unit tests for the Python pipeline (run: python -m unittest discover -s tests)."""

import math
import re
import unittest
from pathlib import Path

import numpy as np
from shapely.geometry import MultiPolygon, box

from pipeline import geometry, power
from pipeline.build import quantise
from pipeline.nations import NATIONS
from pipeline.validate import bh_threshold
from pipeline.variables import MISSING, VARIABLES

ROOT = Path(__file__).resolve().parent.parent


class Tiling(unittest.TestCase):
    def test_tiles_cover_the_box_and_respect_power_limits(self):
        tiles = power.tiles_for(-76.4, -56.0, -66.4, -17.5)
        self.assertTrue(all(t.lat_max - t.lat_min <= 10 and t.lon_max - t.lon_min <= 10 for t in tiles))
        self.assertTrue(all(t.lat_max - t.lat_min >= 2 and t.lon_max - t.lon_min >= 2 for t in tiles))
        self.assertLessEqual(min(t.lat_min for t in tiles), -56.25)
        self.assertGreaterEqual(max(t.lat_max for t in tiles), -17.25)

    def test_request_urls_format_numbers_like_javascript(self):
        url = power.request_url("T2M", power.Tile(-40.0, -30.0, -76.875, -66.25))
        self.assertIn("latitude-min=-40&latitude-max=-30", url)
        self.assertIn("longitude-min=-76.875&longitude-max=-66.25", url)


class Geometry(unittest.TestCase):
    def test_cells_tile_the_sphere_exactly(self):
        lats = np.arange(-89.75, 90, 0.5)
        total = sum(geometry.cell_area_km2(lat) for lat in lats) * (360 / geometry.D_LON)
        self.assertAlmostEqual(total / (4 * math.pi * geometry.EARTH_RADIUS_KM**2), 1.0, places=9)

    def test_land_fraction_of_half_covered_cells(self):
        # A strip from 10.0°E to 10.3125°E covers the west half of the cell centred
        # on 10.3125°E and the east half of the cell centred on 10.0°E.
        shape = MultiPolygon([box(10.0, -1.0, 10.3125, 1.0)])
        fractions = geometry.land_fractions(shape, np.array([0.0, 0.0, 5.0]), np.array([10.3125, 10.0, 10.0]))
        for half in fractions[:2]:
            self.assertGreater(half, 0.4)
            self.assertLess(half, 0.6)
        self.assertEqual(fractions[2], 0.0)

    def test_topojson_decoder_handles_reversed_arcs(self):
        topology = {
            "transform": {"scale": [1, 1], "translate": [0, 0]},
            "arcs": [[[0, 0], [2, 0], [0, 2]], [[0, 0], [0, 2], [2, 0]]],
            "objects": {"countries": {"geometries": [{"type": "Polygon", "id": "001", "arcs": [[0, ~1]]}]}},
        }
        shape = geometry.decode_topojson(topology, "001")
        self.assertAlmostEqual(shape.area, 4.0)


class Packing(unittest.TestCase):
    def test_quantise_rounds_half_up_and_marks_missing(self):
        packed = quantise(np.array([0.125, -0.125, np.nan, 1e9]), 0.01)
        self.assertEqual(packed.tolist(), [13, -12, MISSING, 32767])
        self.assertEqual(packed.dtype.str, "<i2")


class Validation(unittest.TestCase):
    def test_benjamini_hochberg_step_up(self):
        self.assertEqual(bh_threshold(np.array([0.01, 0.02, 0.03, 0.04, 0.2]), 0.05), 0.04)
        self.assertEqual(bh_threshold(np.array([0.5, 0.6]), 0.1), 0.0)


class Consistency(unittest.TestCase):
    def test_variables_match_the_app_catalogue(self):
        source = (ROOT / "src" / "data" / "variables.ts").read_text()
        ts = dict(re.findall(r"id: '(\w+)',[\s\S]*?scale: ([\d.]+),", source))
        self.assertEqual({v.id: v.scale for v in VARIABLES}, {k: float(s) for k, s in ts.items()})

    def test_every_registered_nation_is_shipped(self):
        for nation in NATIONS:
            self.assertTrue((ROOT / "public" / "data" / "nations" / nation.iso3 / "meta.json").exists(), nation.iso3)


if __name__ == "__main__":
    unittest.main()
