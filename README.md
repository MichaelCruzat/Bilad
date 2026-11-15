# Bilad

Bilad is a global Earth-system trend detective. It maps how every land cell on Earth, from 60°S to 84°N, has changed since 1981 using NASA POWER data. It tests each trend with methods built for autocorrelated climate records, then checks it against an independent NASA record before calling it real.

Built for the NASA Space Apps 2026 challenge [Be An Earth System Trend Detective!](https://www.spaceappschallenge.org/2026/challenges/earth-system-trend-detective/).

**Live site:** [michaelcruzat.github.io/Bilad](https://michaelcruzat.github.io/Bilad/)

*Bilad* (بلاد) is Arabic for "lands".

## What it finds

Across 54,425 land cells, temperature has risen by about 0.25 °C per decade since 1981, and 71% of the world's land has warmed beyond chance after a worldwide false-discovery test. Weather stations back that warming over most of the planet. On about 5% of land they contradict the reanalysis, and Bilad flags those trends instead of reporting them. South Asia is the largest such region.

The challenge asks what is changing, where, by how much, and whether the change is significant. Bilad also asks whether the change is real, because a significance test only checks the record it is given. The four case files end in four different outcomes:

| Case | Claim tested | Reanalysis (MERRA-2) | Independent witness | Verdict |
|---|---|---|---|---|
| 01 Central Chile's missing rain | Rainfall fell after 2010 | −17.1% of normal per decade; 34% less rain in 2010–19 than 1981–2009 | GPCP (partly independent: shares rain gauges): −11.2% per decade; 23% less | **Corroborated** |
| 02 Two Chiles | Coast and Andes warm differently | Daytime highs: coast −0.01 °C/decade (p = 0.87), Andes +0.29 (p < 0.001) | Witness grids (2°) are wider than Chile | **No witness at this scale** |
| 03 Bangladesh's phantom cooling | Bangladesh cooled since 1981 | −0.19 °C/decade, p = 0.03, 80% of land "significant"; behaves as a jump in 1997 (ΔBIC 18.7) | GISTEMP: +0.35 °C/decade | **Contradicted: a likely dataset artefact** |
| 04 Kenya | Kenya is warming | +0.18 °C/decade | GISTEMP: +0.34 °C/decade | **Same direction, different size** |

In MERRA-2, Bangladesh's temperature, humidity and soil moisture all jump around 1997–98, a period of large changes in the satellite observations the reanalysis assimilates, and weather stations show warming. A significant Mann–Kendall test alone would report that Bangladesh cooled.

## The product

- **World** (`#/world`): every land cell on a zoomable map over NASA Blue Marble relief, for temperature and rainfall.
  - The verdict layer shows, cell by cell, whether the station or gauge record backs the trend. Other layers show the trend itself, any single year (playable), and the 1991–2020 normal.
  - A strip of yearly global values sits under the map; pointing at a year shows it on the map.
  - Search any of 223 countries, or click a cell. Bilad builds that country's series from its cells and cross-examines it against the witness on the spot.
  - Rankings list the fastest-changing countries and the ones whose reanalysis record is least trustworthy.
- **Home** (`#/`): opens on the world verdict map at full width, then the scale of the shipped data, how Bilad works, validation figures, the four case files and the seven featured nations on one colour scale with their verdicts.
- **Case files** (`#/case/<id>`): claim → evidence → cross-examination → integrity screen → verdict, with sources. Every number is computed in the browser from the shipped data.
- **Atlas** (`#/atlas/<ISO3>`): any shipped nation and any of seven variables.
  - Every map sits on NASA GIBS Blue Marble shaded relief with neighbouring borders.
  - Each grid cell coloured by its trend, by one year's anomaly (with a play button), by its signal-to-noise ratio, or by its 1991–2020 normal.
  - Cells that survive false-discovery control are stippled.
  - A latitude profile beside the map shares its vertical axis; drag on it to define a band.
  - The evidence panel shows the whole nation, a band, or a single cell. It includes the annual series with its Theil–Sen trend, the independent witness for that exact selection (temperature and rainfall), the ramp-or-jump screen, a month-by-month "season clock", start-year sensitivity, the full test record and every NASA POWER request URL.
  - All atlas state lives in the URL, so any view can be shared.
- **Method** (`#/method`): formulas, assumptions, limitations and references.

Seven nations also ship with the full seven-variable atlas: Bangladesh, Chile, Kenya, Mexico, Morocco, the Philippines and Spain.

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
                         └► python -m pipeline global ──► every land cell, 60°S–84°N (cached; ~700 requests)
                                         scripts/summarize-global.ts ──► public/data/global/*.stats.bin, *.annual.i16, summary.json
GISTEMP v4, GPCP v2.3   ──► pipeline/crosscheck.py ──► public/data/crosscheck.json, nations/<ISO3>/witness.json
                                         │
                 scripts/summarize.ts ◄──┘  uses src/lib/stats.ts ──► public/data/index.json
                                         │
            browser (React + Astryx) ◄───┘  uses the same src/lib/stats.ts
                                         │
                 pipeline/validate.py ◄──┘  recomputes every headline with scipy + pymannkendall; CI fails on disagreement
```

The project uses Python, TypeScript and Make:

- **Python** for the data pipeline: tiling NASA POWER requests, Natural Earth boundaries (shapely), land fractions, packing, and reading netCDF witnesses (netCDF4). Python with numpy, shapely and netCDF4 is the standard Earth-science stack.
- **TypeScript** for the statistics engine (`src/lib/stats.ts`) and the interactive app. The same engine writes the shipped headlines and runs in the reader's browser, so the two always agree.
- **Python, again, as an independent check.** `pipeline/validate.py` rebuilds every nation-variable headline and a random sample of global cells from the raw binaries with different code (`scipy.stats.theilslopes`, `pymannkendall`, a separate Benjamini–Hochberg). Two implementations in two languages must agree before CI passes. Values are rounded to 1e-9 before testing in both, so ties are detected the same way despite different floating-point summation.
- **Make** as the single entry point.

Per-cell statistics for the whole globe are precomputed (17 seconds for both variables), so the World page only draws. A rerun of the heaviest featured nation (Mexico, 688 cells) takes about 55 ms in the browser and is cached, so a WebAssembly kernel was not worth its build complexity. The world map is drawn on a canvas, batched by colour, so all 54,425 cells pan and zoom smoothly.

## Run locally

Requires Node.js 22+, pnpm 11+ and Python 3.11+.

    make install     # pnpm install + pip install -r pipeline/requirements.txt
    make dev         # http://localhost:5173
    make check       # TypeScript + Python tests, lint, build, size budget, independent recomputation
    make global      # rebuild the global atlas (downloads once, then served from cache)

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

Values are MERRA-2 (NASA GMAO) served by NASA POWER at native resolution, quantised to Int16 for shipping. Every request URL is listed in the atlas's provenance panel and in each `meta.json`. Boundaries are Natural Earth 1:50m via world-atlas. Basemaps are NASA GIBS `BlueMarble_ShadedRelief_Bathymetry` (EPSG:4326), fetched by `python -m pipeline context` and drawn under a cylindrical projection centred on each nation, so the imagery lines up with the grid cells without resampling.

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
- [NASA GIBS](https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api) Blue Marble relief imagery.
- [Natural Earth](https://www.naturalearthdata.com/) boundaries via [world-atlas](https://github.com/topojson/world-atlas). UI built with Astryx; type set in Space Grotesk, IBM Plex Sans and IBM Plex Mono.

## Judging criteria

- **Impact:** gives students, educators and the public a way to tell a real Earth-system trend from a statistical or data artefact. The pipeline is nation-agnostic, so the same evidence can be produced for any country NASA POWER covers.
- **Creativity:** frames trend detection as cross-examination. Each claim faces an independent witness and an integrity screen, and the casebook deliberately includes a significant trend that is false.
- **Validity:** uses Theil–Sen, Hamed–Rao-corrected Mann–Kendall, field-wide FDR, a BIC step screen and two independent NASA products. The engine matches pymannkendall, and a Python re-implementation checks every shipped headline in CI.
- **Relevance:** answers the challenge's four questions with NASA Earth-science data, and adds whether the change is real.
- **Presentation:** four guided cases with four different outcomes, a shareable atlas, and a method page with the formulas.

## AI-use disclosure

AI assistance was used for code, data-pipeline scaffolding, interface iteration, documentation drafting, tests and review. The project team is responsible for the implementation, source choices, scientific framing and final submission. NASA data and documentation are credited in the app and in this README.

## License

Apache License 2.0. See [LICENSE](LICENSE).
