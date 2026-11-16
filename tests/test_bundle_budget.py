import gzip
import tempfile
import unittest
from pathlib import Path

from scripts.bundle_budget import measure_assets, over_budget


class BundleBudgetTests(unittest.TestCase):
    def test_measures_all_javascript_and_css_chunks_but_not_source_maps(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            assets = Path(temporary_directory) / "assets"
            assets.mkdir()
            (assets / "app.js").write_bytes(b"const answer = 42;" * 20)
            (assets / "vendor.js").write_bytes(b"const vendor = true;" * 30)
            (assets / "app.js.map").write_bytes(b"not a JavaScript asset" * 100)
            (assets / "app.css").write_bytes(b"body { color: black; }" * 10)

            measured = measure_assets(Path(temporary_directory))

            self.assertEqual(
                measured["js"],
                sum(
                    len(gzip.compress((assets / name).read_bytes(), mtime=0))
                    for name in ("app.js", "vendor.js")
                ),
            )
            self.assertEqual(
                measured["css"],
                len(gzip.compress((assets / "app.css").read_bytes(), mtime=0)),
            )

    def test_measures_the_initial_load_from_index_html(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            assets = root / "assets"
            assets.mkdir()
            (assets / "index-a1.js").write_bytes(b"const shell = 1;" * 40)
            (assets / "vendor-b2.js").write_bytes(b"const shared = 2;" * 40)
            (assets / "Atlas-c3.js").write_bytes(b"const lazyRoute = 3;" * 400)
            (assets / "index.css").write_bytes(b"body{}")
            (root / "index.html").write_text(
                '<script type="module" src="./assets/index-a1.js"></script>'
                '<link rel="modulepreload" href="./assets/vendor-b2.js">'
            )

            measured = measure_assets(root)

            initial = sum(
                len(gzip.compress((assets / name).read_bytes(), mtime=0))
                for name in ("index-a1.js", "vendor-b2.js")
            )
            self.assertEqual(measured["initial-js"], initial)
            self.assertGreater(measured["js"], measured["initial-js"])

    def test_reports_only_assets_that_exceed_their_limit(self):
        limits = {"js": 100, "css": 60}

        self.assertEqual(
            over_budget({"js": 101, "css": 50}, limits), {"js": (101, 100)}
        )
        self.assertFalse(over_budget({"js": 100, "css": 60}, limits))

    def test_requires_a_built_site(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            with self.assertRaises(FileNotFoundError):
                measure_assets(Path(temporary_directory))


if __name__ == "__main__":
    unittest.main()
