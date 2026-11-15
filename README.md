# Bilad

**An Earth-system trend detective for any nation.** Bilad maps 44 years (1981–2024) of NASA Earth-system data across a country, cell by cell. It tests every trend with methods built for autocorrelated climate records, then cross-examines the result against an independent NASA record before calling it real.

Built for the NASA Space Apps 2026 challenge [Be An Earth System Trend Detective!](https://www.spaceappschallenge.org/2026/challenges/earth-system-trend-detective/).

**Live site:** [michaelcruzat.github.io/Bilad](https://michaelcruzat.github.io/Bilad/)

*Bilad* (بلاد) is Arabic for "land" or "country".

## What it finds

The challenge asks what is changing, where, by how much, and whether the change is significant. Bilad adds a fifth question: **is it real?** A significance test only checks the record it is given. The four case files each end in a different verdict:

| Case | Claim tested | Reanalysis (MERRA-2) | Independent witness | Verdict |
|---|---|---|---|---|
| 01 Central Chile's missing rain | Rainfall fell after 2010 | −17.1% of normal per decade; 34% less rain in 2010–19 than 1981–2009 | GPCP (partly independent: shares rain gauges): −11.2% per decade; 23% less | **Corroborated** |
| 02 Two Chiles | Coast and Andes warm differently | Daytime highs: coast −0.01 °C/decade (p = 0.87), Andes +0.29 (p < 0.001) | Witness grids (2°) are wider than Chile | **No witness at this scale** |
| 03 Bangladesh's phantom cooling | Bangladesh cooled since 1981 | −0.19 °C/decade, p = 0.03, 80% of land "significant"; behaves as a jump in 1997 (ΔBIC 18.7) | GISTEMP: +0.35 °C/decade | **Contradicted: a likely dataset artefact** |
| 04 Kenya | Kenya is warming | +0.18 °C/decade | GISTEMP: +0.34 °C/decade | **Same direction, different size** |

Case 03 is the reason Bilad exists. A tool that stopped at a significant Mann–Kendall test would report that Bangladesh cooled. In MERRA-2, Bangladesh's daytime heat, humidity and soil moisture all jump around 1997–98, a period of large changes in the satellite observations the reanalysis assimilates. Weather stations show warming.

## The product

- **Casebook** (`#/`): opens on two claims from the same reanalysis ("Central Chile has had 23–34% less rain since 2010. Bangladesh did not cool.") beside a live map of Chile's rainfall trend, then lists the case files, the testing chain and a six-nation table of verdicts.
- **Case files** (`#/case/<id>`): claim → evidence → cross-examination → integrity screen → verdict, with sources. Every number is computed in the browser from the shipped data.
- **Atlas** (`#/atlas/<ISO3>`): any shipped nation and any of seven variables.
  - Each grid cell coloured by its trend, its signal-to-noise ratio, or its 1991–2020 normal.
  - Cells that survive false-discovery control are stippled.
  - A latitude profile beside the map shares its vertical axis; drag on it to define a band.
  - The evidence panel shows the whole nation, a band, or a single cell. It includes the annual series with its Theil–Sen trend, the independent witness for that exact selection (temperature and rainfall), the ramp-or-jump screen, a month-by-month "season clock", start-year sensitivity, the full test record and every NASA POWER request URL.
  - All atlas state lives in the URL, so any view can be shared.
- **Method** (`#/method`): formulas, assumptions, limitations and references.

Shipped nations: Chile (pilot), Bangladesh, Kenya, Mexico, Morocco and Spain. 1,765 grid cells, 7 variables, 528 months each.

## How a trend earns a verdict

| Step | Method | What it rules out |
|---|---|---|
| Measure | NASA POWER monthly MERRA-2 on its native 0.5° × 0.625° grid; each cell weighted by its true land area | Point samples standing in for a nation |
| Deseasonalise | Monthly anomalies against the WMO 1991–2020 normal; rainfall as % of each cell's own normal | The seasonal cycle swamping the trend; wet regions dominating |
| Test each cell | Theil–Sen slope with Gilbert (1987) interval; Mann–Kendall with Hamed–Rao (1998) correction for serial correlation | Outliers; persistence posing as a trend |
| Test the map | Benjamini–Hochberg false-discovery control, α = 0.10 (Wilks 2016) | Hundreds of tests producing "significant" cells by chance |
| Screen integrity | Straight line versus single step compared by BIC; co-breaks across a nation's seven variables | A change in satellites or processing posing as climate |
| Cross-examine | Same footprint in GISTEMP v4 (stations) and GPCP v2.3 (gauges + satellites, partly independent), for any selection down to one cell | Trusting a single dataset |

For trends that are not yet significant, Bilad estimates how many more years of record would be needed at the current rate and noise.

## Architecture

```
NASA POWER regional API ──► pipeline/ (Python) ──► public/data/nations/<ISO3>/*.i16, meta.json, boundary.json
GISTEMP v4, GPCP v2.3   ──► pipeline/crosscheck.py ──► public/data/crosscheck.json, nations/<ISO3>/witness.json
                                         │
                 scripts/summarize.ts ◄──┘  uses src/lib/stats.ts ──► public/data/index.json
                                         │
            browser (React + Astryx) ◄───┘  uses the same src/lib/stats.ts
                                         │
                 pipeline/validate.py ◄──┘  recomputes every headline with scipy + pymannkendall; CI fails on disagreement
```

Each language does the job it is best at:

- **Python** for the data pipeline: tiling NASA POWER requests, Natural Earth boundaries (shapely), land fractions, packing, and reading netCDF witnesses (netCDF4). Python with numpy, shapely and netCDF4 is the standard Earth-science stack.
- **TypeScript** for the statistics engine (`src/lib/stats.ts`) and the interactive app. The same engine writes the shipped headlines and runs in the reader's browser, so the two always agree.
- **Python, again, as an independent check.** `pipeline/validate.py` rebuilds all 42 nation-variable headlines from the raw binaries with different code (`scipy.stats.theilslopes`, `pymannkendall`, a separate Benjamini–Hochberg). Two implementations in two languages must agree before CI passes.
- **Make** as the single entry point.

A rerun of the heaviest nation's analysis (Mexico, 688 cells) takes about 55 ms in the browser and is cached per variable and window, so a compiled WebAssembly kernel was not worth its build complexity. Much larger nations would move the analysis to a Web Worker first.

## Run locally

Requires Node.js 22+, pnpm 11+ and Python 3.11+.

    make install     # pnpm install + pip install -r pipeline/requirements.txt
    make dev         # http://localhost:5173
    make check       # TypeScript + Python tests, lint, build, size budget, independent recomputation

The site is static and needs no key, account or backend. The shipped data is committed, so `make dev` works offline once installed.

## Add a nation

1. Add one entry to `pipeline/nations.py` (ISO3, ISO numeric code, name, optional clip box and named regions).
2. Run `make data NATIONS=PER`.

The pipeline tiles the boundary into NASA POWER requests (cached on disk), keeps every MERRA-2 cell that overlaps land, packs 1981–2024 monthly values for seven variables, refreshes the national summaries and samples both witnesses on the new footprint. The atlas, the nation table and the validator pick the new nation up automatically.

## Data

| Variable | NASA POWER parameter | Read as |
|---|---|---|
| Air temperature at 2 m | `T2M` | °C |
| Daily maximum / minimum temperature | `T2M_MAX`, `T2M_MIN` | °C |
| Precipitation, bias-corrected | `PRECTOTCORR` | % of 1991–2020 normal (mm/yr in the case files) |
| Root-zone soil wetness | `GWETROOT` | % saturation |
| Relative humidity at 2 m | `RH2M` | % |
| Wind speed at 2 m | `WS2M` | m/s |

Values are MERRA-2 (NASA GMAO) served by NASA POWER at native resolution, quantised to Int16 for shipping. Every request URL is listed in the atlas's provenance panel and in each `meta.json`. Boundaries are Natural Earth 1:50m via world-atlas.

## Limitations

- A detected trend says what changed, where and by how much. It does not say why. Bilad does not attribute causes, forecast or downscale.
- A 0.5° cell averages over valleys and peaks. Coastal cells that are mostly sea carry an ocean influence; they are weighted by land area and flagged when selected.
- MERRA-2's precipitation correction uses gauge analyses (satellite–gauge over Africa) and fades out poleward of about 42°, so rainfall trends in Patagonia rest more on the model. Soil wetness is modelled from that same precipitation, so it is not an independent witness to a rainfall trend.
- The witnesses are coarser (2° and 2.5°) and are estimates themselves. GPCP and MERRA-2's corrected precipitation both draw on rain gauges, so their agreement rules out a reanalysis artefact but not a problem shared by the gauges.
- Neighbouring reanalysis cells are not independent, so shares of significant area are descriptive.

## Sources

- [NASA Space Apps 2026 challenge statement](https://www.spaceappschallenge.org/2026/challenges/earth-system-trend-detective/) · [Space Apps terms](https://www.spaceappschallenge.org/legal/)
- [NASA POWER](https://power.larc.nasa.gov/) and its [monthly API](https://power.larc.nasa.gov/docs/services/api/temporal/monthly/); MERRA-2: Gelaro et al. (2017), [doi:10.1175/JCLI-D-16-0758.1](https://doi.org/10.1175/JCLI-D-16-0758.1); precipitation correction: Reichle et al. (2017), [doi:10.1175/JCLI-D-16-0570.1](https://doi.org/10.1175/JCLI-D-16-0570.1)
- [GISTEMP v4](https://data.giss.nasa.gov/gistemp/), NASA GISS; Lenssen et al. (2019), [doi:10.1029/2018JD029522](https://doi.org/10.1029/2018JD029522)
- [GPCP v2.3](https://psl.noaa.gov/data/gridded/data.gpcp.html), NASA GSFC via NOAA PSL; Adler et al. (2018), [doi:10.3390/atmos9040138](https://doi.org/10.3390/atmos9040138)
- Central Chile megadrought: Garreaud et al. (2017), [doi:10.5194/hess-21-6307-2017](https://doi.org/10.5194/hess-21-6307-2017); Garreaud et al. (2020), [doi:10.1002/joc.6219](https://doi.org/10.1002/joc.6219)
- Coastal cooling in Chile: Falvey & Garreaud (2009), [doi:10.1029/2008JD010519](https://doi.org/10.1029/2008JD010519)
- Methods: Mann (1945); Sen (1968); Gilbert (1987); Hamed & Rao (1998); Benjamini & Hochberg (1995); Wilks (2016); Hawkins & Sutton (2012). Full links are on the in-app Method page.
- [Natural Earth](https://www.naturalearthdata.com/) boundaries via [world-atlas](https://github.com/topojson/world-atlas). UI built with Astryx.

## Judging criteria

- **Impact:** gives students, educators and the public a way to tell a real Earth-system trend from a statistical or data artefact. The pipeline is nation-agnostic, so the same evidence can be produced for any country NASA POWER covers.
- **Creativity:** frames trend detection as cross-examination. Each claim faces an independent witness and an integrity screen, and the casebook deliberately includes a significant trend that is false.
- **Validity:** uses Theil–Sen, Hamed–Rao-corrected Mann–Kendall, field-wide FDR, a BIC step screen and two independent NASA products. The engine matches pymannkendall, and a Python re-implementation checks every shipped headline in CI.
- **Relevance:** answers the challenge's four questions with NASA Earth-science data, and adds whether the change is real.
- **Presentation:** four guided cases with four different verdicts, a shareable atlas, and a method page with the formulas.

## AI-use disclosure

AI assistance was used for code, data-pipeline scaffolding, interface iteration, documentation drafting, tests and review. The project team is responsible for the implementation, source choices, scientific framing and final submission. NASA data and documentation are credited in the app and in this README.

## License

Apache License 2.0. See [LICENSE](LICENSE).
