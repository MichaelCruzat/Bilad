"""Check that the static site's compressed assets stay within a small budget.

Pages are code-split, so two JavaScript figures matter: what a first visit
downloads ("initial-js": the chunks index.html loads or preloads) and the
total across every route ("js").
"""

import gzip
import re
import sys
from pathlib import Path
from typing import Mapping


DEFAULT_LIMITS = {"initial-js": 240 * 1024, "js": 450 * 1024, "css": 55 * 1024}

_ENTRY = re.compile(r'(?:src|href)="\./assets/([^"]+\.js)"')


def measure_assets(build_directory: Path) -> dict[str, int]:
    assets_directory = build_directory / "assets"
    if not assets_directory.is_dir():
        raise FileNotFoundError(f"Built assets not found in {assets_directory}")

    def gz(path: Path) -> int:
        return len(gzip.compress(path.read_bytes(), mtime=0))

    totals = {}
    for extension in ("js", "css"):
        files = list(assets_directory.glob(f"*.{extension}"))
        if not files:
            raise FileNotFoundError(f"No .{extension} files found in {assets_directory}")
        totals[extension] = sum(gz(path) for path in files)

    index = build_directory / "index.html"
    if index.is_file():
        entries = set(_ENTRY.findall(index.read_text(encoding="utf-8")))
        totals["initial-js"] = sum(gz(assets_directory / name) for name in entries if (assets_directory / name).is_file())
    return totals


def over_budget(
    measured: Mapping[str, int], limits: Mapping[str, int]
) -> dict[str, tuple[int, int]]:
    return {
        extension: (size, limits[extension])
        for extension, size in measured.items()
        if extension in limits and size > limits[extension]
    }


def main() -> int:
    try:
        measured = measure_assets(Path("dist"))
    except FileNotFoundError as error:
        print(error, file=sys.stderr)
        return 2

    for extension, size in measured.items():
        print(f"{extension.upper()}: {size / 1024:.1f} KiB gzipped")

    exceeded = over_budget(measured, DEFAULT_LIMITS)
    for extension, (size, limit) in exceeded.items():
        print(
            f"{extension.upper()} exceeds its budget: {size / 1024:.1f} KiB > {limit / 1024:.1f} KiB",
            file=sys.stderr,
        )
    return 1 if exceeded else 0


if __name__ == "__main__":
    raise SystemExit(main())
