# Bilad handoff

State of the project at the end of the first long working session (2026-11-15), for picking up in a new chat. Everything below is on the branch `rebuild/national-atlas`, pushed to GitHub. `main` and the live site still show the old v1 until the pull request is merged.

- Open the pull request: https://github.com/MichaelCruzat/Bilad/compare/main...rebuild/national-atlas (the `gh` CLI is not installed on this machine, so it was never opened from the terminal).
- CI runs on pull requests and only deploys on `main`.

## What Bilad is now

A global Earth-system trend detective for the NASA Space Apps 2026 challenge "Be An Earth System Trend Detective". It maps how every land cell on Earth (60°S–84°N, 54,425 MERRA-2 cells, 223 countries) changed from 1981 to 2024 using NASA POWER. It tests each trend properly, then checks it against a second, independent NASA record:

- GISTEMP v4 weather stations for temperature.
- GPCP v2.3 gauges and satellites for rainfall, which is only partly independent because both draw on rain gauges.

Trends the second record contradicts, or records that jump in one year when the witness does not, are flagged as likely data artefacts. That cross-examination is the differentiator. The flagship example is Bangladesh: the reanalysis shows a significant cooling (−0.19 °C/decade), which is a jump in 1997 contradicted by stations (+0.35 °C/decade).

Seven featured nations also ship with the full seven-variable atlas: Bangladesh, Chile, Kenya, Mexico, Morocco, the Philippines and Spain.

### Key numbers (all computed from shipped data)

- Global land temperature trend: +0.25 °C/decade; 71% of land warmed significantly after worldwide FDR; 5.0% of land flagged as likely artefact for temperature, 14.2% for rainfall.
- Chile: MERRA-2 +0.110 = GISTEMP +0.110 °C/decade. Central Chile rainfall: 34% (MERRA-2) and 23% (GPCP) less in 2010–19 than 1981–2009; −17.1 vs −11.2 % of normal per decade (corroborated).
- Kenya: +0.18 vs +0.34 °C/decade (same direction, different size). Chile coast vs Andes daytime highs: −0.01 vs +0.29 °C/decade (no witness verdict; 2° witness grid too coarse).
- Least trustworthy reanalysis records (share of land flagged): Honduras 94%, Bangladesh 91%, South Sudan 81%.

## Pages (hash routes)

| Route | What it is |
|---|---|
| `#/` | Home: big logo and wordmark, plain statement leading with the Bangladesh hook, full-width world verdict map, scale facts, how it works, validation receipts, case files, featured nations strip and ledger |
| `#/world?v=&layer=&year=&cell=&country=` | Global atlas on canvas: verdict / trend / year (playable) / normal layers, T2M and rainfall, zoom and pan, search any of 223 countries, click a cell, year strip under the map that drives the year layer, country rankings, verdict strip and cross-examination per country or cell |
| `#/atlas/<ISO3>?v=&layer=&from=&to=&cell=&band=&region=&sig=&year=` | Featured-nation atlas: seven variables, NASA GIBS relief basemap, zoom/pan, latitude profile with band brushing, year playback, verdict strip, copy link, download evidence JSON, diagnostics behind "Inspect" sections |
| `#/case/<id>` | Four case files: `chile-megadrought`, `chile-coast-andes`, `bangladesh-phantom-cooling`, `kenya-half-the-warming` |
| `#/brief/<ISO3>` | National evidence brief: all seven variables, trend with 95% range, corrected p, significant area, ramp-or-jump, change-point clue, witness, verdict; CSV and JSON downloads |
| `#/method?s=<section>` | "How to read a verdict" guide, then numbered linkable technical sections with formulas and references |

## Architecture

```
NASA POWER regional API ─► pipeline/ (Python): tiling, cache, land masks, packing
  ├─ python -m pipeline build <ISO3>|--all   featured nations → public/data/nations/<ISO3>/
  ├─ python -m pipeline context ...          NASA GIBS relief + neighbour borders per nation
  ├─ python -m pipeline global               every land cell → pipeline/.cache/global (not shipped) + public/data/global/cells.bin, country.bin, relief.jpg
  └─ python -m pipeline crosscheck           GISTEMP + GPCP → crosscheck.json, nations/<ISO3>/witness.json, global/witness-*.bin
scripts/summarize.ts        national headlines (index.json) + home previews, with src/lib/stats.ts
scripts/summarize-global.ts global per-cell stats (*.stats.bin, *.annual.i16, summary.json), same engine (~17 s)
pipeline/validate.py        independent Python recomputation (scipy, pymannkendall) of every nation headline + 400 random global cells
scripts/smoke.mjs           Playwright browser acceptance against the production build
```

- Statistics live in one TypeScript module, `src/lib/stats.ts`, shared by the summaries and the browser: Theil–Sen with Gilbert CI, Mann–Kendall with Hamed–Rao (variance inflation floored at 1), BH-FDR, Pettitt, BIC step screen, years-to-significance, and the agreement verdict. Values are rounded to 1e-9 before testing so ties match across languages.
- Evidence logic is in `src/lib/evidence.ts`: witness series, `WitnessState` (unsupported / loading / failed + retry / no-coverage / too-coarse / available), `overallVerdict`, `LIMITATION`.
- Main UI pieces:
  - `src/features/VerdictStrip.tsx` (answer first, five-field receipt)
  - `src/features/EvidencePanel.tsx`
  - `src/viz/NationMap.tsx` (SVG + d3-zoom)
  - `src/viz/WorldMap.tsx` (canvas, colour-batched)
  - `src/viz/YearStrip.tsx`, `src/viz/MonthStrip.tsx`, `src/viz/SeriesChart.tsx`
  - `src/brand/Logo.tsx`: the `APP_NAME` constant, so a rename is one line
- Theme: graphite with a mint accent, ivory text, Space Grotesk headings, IBM Plex Sans/Mono, set with the Astryx theme editor. Fonts load through `src/themes/bilad/bilad.fonts.css`.

## How to run (this machine)

Node and pnpm are not on the default PATH here. Prefix commands with:

```
export PATH=/Users/michaelc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/michaelc/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:$PATH
```

- The Python venv used during the session lived in the session scratchpad and will be gone. Recreate it: `python3 -m venv .venv && .venv/bin/pip install -r pipeline/requirements.txt`, then pass `PY=.venv/bin/python` to make.
- Python from python.org lacks certificates, so `pipeline/net.py` uses certifi.
- NASA POWER responses are cached in `pipeline/.cache/` (gitignored). That cache is about 900 files plus GISTEMP/GPCP netCDF. Rebuilding from cache takes minutes; from scratch, the global fetch is about 700 requests.

```
make dev                 # http://localhost:5173
make check PY=...        # TS + Python tests, lint, build, size budget, independent recomputation, browser smoke
make data NATIONS=PER    # add/rebuild a featured nation (registry: pipeline/nations.py)
make global PY=...       # rebuild the global atlas
pnpm exec astryx doctor --built .   # must have 0 failures before delivery
```

At the end of the session:

- 42 TypeScript tests, 16 Python tests, 10/10 browser checks.
- Lint and typecheck clean.
- Initial JS 212 KiB gzipped (budget 240); all-routes JS budget 520 KiB.
- Astryx doctor: 20 pass, 3 warn, 0 fail. The warnings are font-proof and source-purity false positives for SVG charts and generated theme imports.

## What was done, in order (commits on the branch)

1. Shared statistics engine with pymannkendall parity tests.
2. Data pipeline and national grids for six nations from NASA POWER.
3. Cross-examination against GISTEMP/GPCP, integrity screen, agreement verdicts. Bangladesh discovered to be a MERRA-2 artefact.
4. Casebook, case files, atlas, method page (replaced v1 entirely).
5. Fixes from independent code and judge reviews: a stale-async crash, regional rainfall method, profile/brush alignment, copy.
6. Pipeline moved to Python, with an independent Python validator, a Makefile, and CI on pull requests.
7. NASA GIBS relief basemaps and neighbour borders; new theme and fonts; GRIME-informed home layout (not copied).
8. Zoom and pan, colour transitions, full-width layout, logo and wordmark; the Philippines added.
9. Global atlas: 54,425 cells, World page, home hero on the world map. Antimeridian bug fixed: dropping wrapped polygons had silently removed Afro-Eurasia.
10. Copy pass with two independent reviewer agents applied; README and submission notes updated for global.
11. Benchmark P0/P1: verdict strip, typed witness states, copy link, evidence JSON, `#/brief/<ISO3>` with CSV/JSON, progressive disclosure, method reading guide, release-truth test.
12. Benchmark P2: browser smoke test in CI, demo PDF regenerated from the current build (`public/bilad-demo.pdf`, six pages).

## Benchmark checklist (docs/HACKATHON-WINNER-BENCHMARK.md)

| Item | Status |
|---|---|
| Release truth: one nation count everywhere, enforced by test | Done (seven featured nations plus global) |
| Verdict strip on the first result screen | Done (case files, atlas, world selection) |
| Typed witness states incl. failed + retry | Done; unit and browser tests |
| Rehearsable judge path home → case → witness/integrity → atlas | Done; in `docs/SUBMISSION.md`; covered by smoke test |
| Progressive disclosure of diagnostics | Done |
| National brief with CSV/JSON | Done (`#/brief/<ISO3>`) |
| Copy link + download evidence | Done (atlas) |
| Evidence receipt (source, period, resolution, test, limitation) | Done (in verdict strip) |
| Method "How to read a verdict" | Done |
| Orphaned scaffolding | `yearRamp` and `BIVARIATE` removed; `breakYear` now surfaced only as "change-point clue, not a cause" in the brief |
| Browser acceptance in CI | Done (`scripts/smoke.mjs`) |
| Demo PDF from the current flow | Done |
| Benchmark said "not a new global product" | Deliberately not followed: the user explicitly asked for global coverage |

## Still to do / open items

1. **App name.** The user asked for curveball name ideas (weather/climate/change themed) to choose from or adapt. Renaming is one constant (`APP_NAME` in `src/brand/Logo.tsx`) plus copy. Ideas offered:
   - Hindcast: the meteorology term for checking a model against what actually happened, which is what the app does.
   - Weatherproof: "is this trend weatherproof?"
   - Telltale: a tell that gives a false trend away.
   - Alibi: every trend needs one.
   - Second Sky: a second record of the same sky.
   - Isobar: a line of equal pressure; a clean, scientific single word.
   - Driftmark: drift is a slow change, and a mark flags it.
   - Noisefloor: the level a signal must rise above.
   - Groundtruth: the remote-sensing term for checking against measurements.
   - Shiftwatch: watching for shifts, and for fake ones.
   - Tandem: two records riding together.
   - Bilad: keep it. It's Arabic for "lands", which fits a global atlas.
2. **Hero "Real or fake?" switch** (Chile corroborated vs Bangladesh artefact). The user said to hold off and didn't fully understand the idea, so explain it before building.
3. **The user said they would send more design ideas.** Don't copy GRIME (see `docs/GRIME-WORLD-REFERENCE.md`, the user's file, untracked).
4. **Merge the PR** after review, so the live site updates. `docs/GRIME-WORLD-REFERENCE.md` and `docs/HACKATHON-WINNER-BENCHMARK.md` are the user's untracked files; ask before committing them.
5. **Global coverage is two variables** (T2M, rainfall), because those have witnesses. Adding more global variables is a cache/fetch run (`GLOBAL_VARIABLES` in `pipeline/global_grid.py`) plus summary changes; they would be single-dataset claims.
6. **Witness independence.** GPCP is only partly independent. A fully independent rainfall witness (GPM IMERG, 2000–) or groundwater (GRACE) needs a NASA Earthdata login.
7. **Phone layout.** It works, with no overflow, but the world map is small on phones, and the nation hero map was narrow for Chile.
8. **Data size.** `public/data` is about 30 MB. Home loads about 2.5 MB of global data (cells + T2M stats + relief); annual series (about 4.8 MB per variable) load only on demand.
9. **Doctor warnings** (non-blocking): theme font-proof and purity notes on SVG charts.
10. **GitHub pushes** from this machine sometimes fail once with "could not read Username", and retrying works.

## User preferences learned this session

- Wants a sophisticated, global, distinctive app, not a template or "AI slop", and not a copy of GRIME.
- Wants incremental commits and pushes that show progress.
- Wants independent agent reviews before calling work good, especially for copy.
- Wants copy that is humanized but still interesting and specific.
- Wants efficiency: fewer check-ins, bigger batches.
- Will choose the name; give options.
