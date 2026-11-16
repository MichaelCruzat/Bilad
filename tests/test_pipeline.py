"""Unit tests for the Python pipeline (run: python -m unittest discover -s tests)."""

import math
import re
import unittest
from pathlib import Path

import numpy as np
from shapely.geometry import MultiPolygon, Polygon, box

from pipeline import geometry, power
from pipeline.build import quantise
from pipeline.nations import NATIONS
from pipeline.validate import bh_threshold, check_nation
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


class Antimeridian(unittest.TestCase):
    def test_a_polygon_crossing_the_date_line_is_cut_not_dropped(self):
        # A small island straddling 180°: stored with a jump from +179.5 to -179.5.
        island = Polygon([(179.5, -16.5), (-179.5, -16.5), (-179.5, -16.0), (179.5, -16.0)])
        pieces = geometry.split_antimeridian(island)
        self.assertEqual(len(pieces), 2)
        self.assertAlmostEqual(sum(p.area for p in pieces), 0.5, places=6)
        self.assertTrue(all(-180 <= p.bounds[0] and p.bounds[2] <= 180 for p in pieces))

    def test_a_wide_continent_is_kept_whole(self):
        eurasia_like = Polygon([(-17.0, 10.0), (179.0, 10.0), (179.0, 70.0), (-17.0, 70.0)])
        self.assertEqual(geometry.split_antimeridian(eurasia_like), [eurasia_like])


class Packing(unittest.TestCase):
    def test_quantise_rounds_half_up_and_marks_missing(self):
        packed = quantise(np.array([0.125, -0.125, np.nan, 1e9]), 0.01)
        self.assertEqual(packed.tolist(), [13, -12, MISSING, 32767])
        self.assertEqual(packed.dtype.str, "<i2")


class Validation(unittest.TestCase):
    def test_a_nonfinite_shipped_statistic_fails_validation(self):
        import contextlib
        import io
        import json

        data = ROOT / 'public' / 'data'
        summary = next(n for n in json.loads((data / 'index.json').read_text())['nations'] if n['iso3'] == 'BGD')
        summary['stats']['T2M']['p'] = float('nan')
        with contextlib.redirect_stdout(io.StringIO()):
            problems = check_nation(data, 'BGD', summary)
        self.assertTrue(any('BGD T2M: p' in problem for problem in problems), problems)

    def test_benjamini_hochberg_step_up(self):
        self.assertEqual(bh_threshold(np.array([0.01, 0.02, 0.03, 0.04, 0.2]), 0.05), 0.04)
        self.assertEqual(bh_threshold(np.array([0.5, 0.6]), 0.1), 0.0)


class Consistency(unittest.TestCase):
    def test_variables_match_the_app_catalogue(self):
        source = (ROOT / "src" / "data" / "variables.ts").read_text()
        ts = dict(re.findall(r"id: '(\w+)',[\s\S]*?scale: ([\d.]+),", source))
        self.assertEqual({v.id: v.scale for v in VARIABLES}, {k: float(s) for k, s in ts.items()})

    def test_named_regions_partition_each_nation(self):
        import json
        for nation in NATIONS:
            if not nation.regions:
                continue
            meta = json.loads((ROOT / "public" / "data" / "nations" / nation.iso3 / "meta.json").read_text())
            for cell in meta["cells"]:
                hits = [r.id for r in nation.regions if r.lat_min <= cell["lat"] <= r.lat_max]
                self.assertEqual(len(hits), 1, (nation.iso3, cell["lat"], hits))

    def test_every_registered_nation_is_shipped(self):
        for nation in NATIONS:
            self.assertTrue((ROOT / "public" / "data" / "nations" / nation.iso3 / "meta.json").exists(), nation.iso3)


if __name__ == "__main__":
    unittest.main()
