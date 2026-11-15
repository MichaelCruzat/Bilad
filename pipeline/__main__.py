"""Command line: ``python -m pipeline <command>``.

  build CHL KEN ... | --all   fetch NASA POWER and pack nations
  crosscheck                  sample GISTEMP and GPCP on every nation's cells
  validate                    recompute shipped headlines independently (scipy, pymannkendall)
"""

from __future__ import annotations

import argparse
import gzip
import shutil
import urllib.request
from pathlib import Path

from .nations import NATIONS, get_nation

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "pipeline" / ".cache"
GISTEMP_URL = "https://data.giss.nasa.gov/pub/gistemp/gistemp250_GHCNv4.nc.gz"
GPCP_URL = "https://downloads.psl.noaa.gov/Datasets/gpcp/precip.mon.mean.nc"


def download(url: str, name: str) -> Path:
    """Download once into the cache; gunzip when the URL ends in .gz."""
    CACHE.mkdir(parents=True, exist_ok=True)
    target = CACHE / name
    if target.exists():
        return target
    print(f"Downloading {url}")
    tmp = target.with_suffix(target.suffix + ".part")
    with urllib.request.urlopen(url, timeout=600) as response, open(tmp, "wb") as out:
        if url.endswith(".gz"):
            with gzip.GzipFile(fileobj=response) as gz:
                shutil.copyfileobj(gz, out)
        else:
            shutil.copyfileobj(response, out)
    tmp.rename(target)
    return target


def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m pipeline", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    build = sub.add_parser("build", help="fetch and pack nations")
    build.add_argument("nations", nargs="*")
    build.add_argument("--all", action="store_true")
    cross = sub.add_parser("crosscheck", help="extract independent witness series")
    cross.add_argument("--gistemp", type=Path)
    cross.add_argument("--gpcp", type=Path)
    sub.add_parser("validate", help="independently recompute shipped headlines")
    args = parser.parse_args()

    if args.command == "build":
        from .build import build_nation

        targets = NATIONS if args.all else [get_nation(n) for n in args.nations]
        if not targets:
            parser.error("name at least one nation or pass --all")
        for nation in targets:
            build_nation(nation, ROOT, CACHE)
    elif args.command == "crosscheck":
        from .crosscheck import run

        run(args.gistemp or download(GISTEMP_URL, "gistemp250_GHCNv4.nc"), args.gpcp or download(GPCP_URL, "gpcp_precip.mon.mean.nc"), ROOT / "public" / "data")
    elif args.command == "validate":
        from .validate import run as validate

        raise SystemExit(validate(ROOT / "public" / "data"))


if __name__ == "__main__":
    main()
