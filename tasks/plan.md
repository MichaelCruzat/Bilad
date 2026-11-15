# Bilad v2 — National Earth-System Trend Atlas

Challenge: NASA Space Apps 2026, "Be An Earth System Trend Detective!"
(what is changing, where, how much, is it statistically significant).

## Why v1 is being replaced

v1 compared five hard-coded points over 25 years, opened on synthetic data,
fitted OLS to autocorrelated monthly values, and answered "where" with a
dropdown. It had no map, no field significance, and no story beyond hedging copy.

## Product

*Bilad* (Arabic: "land, country") produces a climate-change ledger for a nation:
a gridded map of where each Earth-system variable has changed since 1981, by how
much, and whether the change survives a field-significance test, plus a
printable national evidence brief. The pipeline is nation-agnostic: adding a
country is one registry entry and one command, so the same evidence can be
produced for any nation — the long-term use is supporting National Adaptation
Plans, national meteorological services in data-poor countries, educators and
journalists.

Pilot: Chile (4,300 km, Atacama to Patagonia; documented 2010– "megadrought" is
the validation target). Also shipped: Kenya, Morocco, Bangladesh, Spain, Mexico.

## Users and jobs

1. Analyst / adaptation planner: "Which parts of my country are drying, and is
   that robust?" → atlas + brief.
2. Educator / student: "What does a significant trend actually mean?" →
   guided story, method page, start-year sensitivity.
3. Judge: understands problem, data, method, validation in three minutes.

## Data (offline pipeline, `pipeline/build.ts`)

- NASA POWER monthly *regional* API (MERRA-2 native 0.5° × 0.625°), 1981–2024.
- Variables: T2M, T2M_MAX, T2M_MIN, PRECTOTCORR, GWETROOT (root-zone soil
  wetness), RH2M, WS2M.
- Nation boundary: Natural Earth 1:50m (world-atlas). Bounding box tiled into
  ≤10°×10° requests. Each grid cell's land fraction (9×9 sample lattice) and
  true spherical area are recorded; cells are area-weighted.
- Output: quantised Int16 binaries per variable + meta.json with every request
  URL (provenance) + national summary in index.json.

## Statistics (`src/lib/stats.ts`, shared by pipeline and browser, tested)

- Anomalies vs WMO 1991–2020 normal, per calendar month; annual mean of anomalies.
- Theil–Sen slope + Gilbert (1987) 95% interval.
- Mann–Kendall with Hamed–Rao (1998) serial-correlation correction (clamped ≥1).
  Parity-tested against pymannkendall.
- Field significance: Benjamini–Hochberg FDR, α_FDR = 0.10 (Wilks 2016).
- Pettitt change-point test.
- Signal-to-noise (Hawkins & Sutton 2012): fitted change / interannual σ.
- Start-year sensitivity: trend re-estimated for every start year leaving ≥20 yrs.
- Per-calendar-month trends ("which season is changing").
- Compound hot–dry signal: bivariate classes of T2M_MAX S/N × (−GWETROOT S/N).

## Experience (stages)

1. **Home** — globe of shipped nations coloured by national warming rate; a
   data-derived headline strip; how-it-works (Acquire → Deseasonalise → Test →
   Control false discoveries); nation ledger table; Chile validation teaser.
2. **Atlas** `#/n/CHL` — controls rail (variable, layer: trend / significance /
   emergence S/N / change-point year / compound hot-dry; analysis window);
   SVG map (equal-area projection centred on the nation) with FDR stippling and a
   latitude profile sharing the map's y-axis; detail panel for the nation or a
   selected cell: anomaly series + Sen line + Pettitt break, season clock,
   start-year sensitivity, test table, provenance.
3. **Brief** `#/n/CHL/brief` — printable national evidence ledger: every variable's
   national trend, CI, corrected p, % of area significantly up/down, change year,
   deterministic plain-language findings, CSV export.
4. **Method & validation** `#/method` — formulas, assumptions, references;
   reproduction of the Central Chile megadrought from MERRA-2 vs the literature
   (Garreaud et al. 2017, 2020), reported honestly whether or not it reproduces.

## Stack

Vite + React 19 + TypeScript, Astryx UI, d3-geo + topojson for projection,
hand-written SVG charts, Vitest. Static site on GitHub Pages; no backend, no key.

## Build stages (one commit + push each, branch `rebuild/national-atlas`)

1. Statistics engine + tests ✅
2. Data pipeline + six nations of real NASA POWER data
3. App data layer, analysis worker, routing
4. Atlas: map, layers, detail panel charts
5. Home: globe, story, ledger
6. Brief + method/validation
7. Remove v1, docs, doctor, review
