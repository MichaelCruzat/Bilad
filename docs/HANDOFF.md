# TRACE handoff

The global continuation was merged through PR #1 (`48ae803`). This follow-up
adds homepage case files, a dedicated Impact page, zoomed regional outlines,
and the user's selected Midnight blue theme. The user's global direction supersedes the older
nation-led product plan. Treat the exact GitHub commit and its Actions results
as the release record; do not infer deployment from a local build alone.
GitHub has been renamed to `MichaelCruzat/TRACE`. The checkout folder and
internal theme slug still use Bilad for compatibility; public links use TRACE.

## Continuation review, 2026-11-15

The continuation preserves the TRACE direction recorded here. It fixes an
explicit World cell selection being expanded to a country, mismatched witness
coverage thresholds, camera selections made before the globe loaded, missing
request-error states, and flight cleanup. Globe rotation has a pause control,
and keyboard exploration announces cell descriptions. Regression tests cover
cell scope, witness coverage, retry, and animation cleanup.

The user's latest correction makes the product explicitly global. Home retains
the full acronym, purpose, worldwide scope, and observation window, with no
seeded nation. A pinned globe follows a three-stage evidence trail as the page
scrolls. Primary navigation is Explore, Impact, How we know, and Method. The
default proof route supports all covered land, any country, and linked cells;
the seven national packs remain supplemental deep links. The globe uses a
cached geographic texture with WebGL,
retaining a substantially faster batched 2D fallback. World-map hover feedback
reuses a cached scene, and annual colour scales are computed once per dataset.
See [PERFORMANCE.md](PERFORMANCE.md) for measured conditions and limitations.
See [GLOBAL-DIRECTION.md](GLOBAL-DIRECTION.md) for the controlling product scope.
An outline mismatch was traced to a standard 2:1 boundary projection being
painted into a 1152×720 native-grid texture. The corrected projection scales
latitude to the actual texture height; tests compare data and boundary points
across latitudes and verify antimeridian clipping.

The proof page now distinguishes calculations for the current selection from
software-validation notes. FDR is an expected fraction under assumptions,
not a cap on errors in one map. Claims about an unrecorded audit and five
alternative corrections were removed. The Python comparison rejects NaN and
infinite differences. The global summaries were rebuilt to apply the same
witness-jump guard as the interactive comparison: 123 temperature and 392
rainfall cells lose an artefact flag because both records contain a jump.
Slopes, intervals, p-values, and agreement classes are unchanged. Global
monthly-data validation is optional when the
build cache is absent, including in a clean CI checkout.

See [tasks/todo.md](../tasks/todo.md) for final checks and release status. The
older session results below are historical, not results for this working tree.

- Prior continuation: https://github.com/MichaelCruzat/TRACE/pull/1.
- CI runs on pull requests and only deploys on `main`.

## Homepage, impact, regions and theme follow-up

- The four case-file rows live in `src/features/CaseFiles.tsx` on Home.
  `#/?section=cases` scrolls there; `#/cases` remains a legacy alias. There
  is no separate Cases navigation tab. The full TRACE acronym stays in the hero.
- `#/impact` explains the problem, temperature cross-comparison, concrete
  intended uses for people, NASA and governments, and unproven institutional
  outcomes. NASA sources are linked in the page. Keep scientific caveats here
  rather than repeating the detailed explanation on Home.
- `public/data/admin1.json` contains only generalized Natural Earth line
  coordinates. At 3× zoom it loads once, then hides again below that scale.
  World and WebGL cache separate outline textures; the 2D globe fallback
  culls by viewport. The supplemental SVG map clips to its
  existing country geometry. All share the original map projection. There
  are no new region names, tooltips or climate aggregates.
- The source receipt is `public/data/admin1.meta.json`; reproduce the asset
  with `scripts/build-regional-boundaries.py` and the pinned/checksummed input.
  Administrative coverage follows Natural Earth and is not exhaustive.
- Midnight blue uses navy surfaces, cool-white text and blue controls.
  Canvas chrome reads colour tokens from the canvas element's computed
  style, which inherits the theme from its ancestors; reading them from the
  document root missed the theme. Scientific data palettes are unchanged.
- The route-transition wrapper added in `4b42b40` had no height, so the
  three-panel Atlas grew to the evidence panel (about 2,100px) and the
  national map was centred far below the fold. `App.tsx` now gives that
  wrapper full height on the Atlas and World routes only; Home keeps its
  page scroll for the pinned globe. A smoke check covers it.
- National maps take an optional `heightCap`. With it, the map fills the
  column width and takes its height from the nation's shape, up to the cap
  (140vh in the atlas, 110vh on case files, 80vh on phones). Chile is about
  1.7× larger than before; wide nations gain about 12% from narrower Atlas
  and World side panels (280/400px, 340/520px on wide screens).
- Charts share `src/viz/readout.tsx`. Pointing, tapping or arrowing through
  a chart draws a guide line and ring on the point, and a text line under the
  chart gives the exact values (announced to screen readers). The latitude
  profile shows a boxed row readout. The World verdict bar lists each share.
- Method uses an Astryx `Outline` in a left panel. Outline writes
  `#method-<section>` with `pushState`; the router maps that back to the
  Method page so reloads and shared links work.
- Verification and regional rendering costs are recorded in
  [PERFORMANCE.md](PERFORMANCE.md). For release state, use the exact commit's
  GitHub Actions results and live Pages build.

## What TRACE is now

The product exists to screen climate evidence before it enters communication
or adaptation assessments. Home explains why a significant trend can still
need scrutiny, and the intended benefits for researchers, NASA data users, and
government analysts. Institutional adoption and policy outcomes are not yet
demonstrated; [GLOBAL-DIRECTION.md](GLOBAL-DIRECTION.md) records that boundary.

A global Earth-system trend detective for the NASA Space Apps 2026 challenge "Be An Earth System Trend Detective". It maps how every land cell on Earth (60°S–84°N, 54,425 MERRA-2 cells, 223 countries) changed from 1981 to 2024 using NASA POWER. It tests each trend properly, then checks it against a second, independent NASA record:

- GISTEMP v4 weather stations for temperature.
- GPCP v2.3 gauges and satellites for rainfall, which is only partly independent because both draw on rain gauges.

Trends the second record contradicts, or records that jump in one year when the witness does not, are flagged as likely data artefacts. That cross-examination is the differentiator. The flagship example is Bangladesh: the reanalysis shows a significant cooling (−0.19 °C/decade), which is a jump in 1997 contradicted by stations (+0.35 °C/decade).

Seven featured nations also ship with the full seven-variable atlas: Bangladesh, Chile, Kenya, Mexico, Morocco, the Philippines and Spain.

### Key numbers (all computed from shipped data)

- Global land temperature trend: +0.25 °C/decade; 71% of land selected as warming at a 10% target FDR; 4.8% of land flagged as likely artefact for temperature, 13.5% for rainfall after the shared-jump correction.
- Chile: MERRA-2 +0.110 = GISTEMP +0.110 °C/decade. Central Chile rainfall: 34% (MERRA-2) and 23% (GPCP) less in 2010–19 than 1981–2009; −17.1 vs −11.2 % of normal per decade (corroborated).
- Kenya: +0.18 vs +0.34 °C/decade (same direction, different size). Chile coast vs Andes daytime highs: −0.01 vs +0.29 °C/decade (no witness verdict; 2° witness grid too coarse).
- Least trustworthy reanalysis records (share of land flagged): Honduras 94%, Bangladesh 91%, South Sudan 81%.

## Pages (hash routes)

| Route | What it is |
|---|---|
| `#/` | Global identity and scope, scroll-led interactive globe, evidence trail, global highlights, case files, and a direct route into Explore |
| `#/?section=cases` | Homepage case section; `#/cases` is a legacy alias |
| `#/impact` | Research significance, why cross-reference temperature, intended benefits and current limits |
| `#/proof?country=&cell=&v=` | Global statistical walkthrough: all covered land, any country, or one cell; `?n=<ISO3>` preserves older monthly-pack links |
| `#/world?v=&layer=&year=&cell=&country=` | Global atlas on canvas: verdict / trend / year (playable) / normal layers, T2M and rainfall, zoom and pan, search any of 223 countries, click a cell, year strip under the map that drives the year layer, country rankings, verdict strip and cross-examination per country or cell |
| `#/atlas/<ISO3>?v=&layer=&from=&to=&cell=&band=&region=&sig=&year=` | Featured-nation atlas: seven variables, NASA GIBS relief basemap, zoom/pan, latitude profile with band brushing, year playback, verdict strip, copy link, download evidence JSON, diagnostics behind "Inspect" sections |
| `#/case/<id>` | Four case files: `chile-megadrought`, `chile-coast-andes`, `bangladesh-phantom-cooling`, `kenya-half-the-warming` |
| `#/brief/<ISO3>` | National evidence brief: all seven variables, trend with 95% range, corrected p, significant area, ramp-or-jump, change-point clue, witness, verdict; CSV and JSON downloads |
| `#/method?s=<section>` | Sidebar outline; key settings, four verdict steps, verdict list, eight numbered calculations (summary, detail, formula, sources), variables table, limits and references. `#method-<section>` from the outline is an alias |

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
  - `src/viz/GlobeMap.tsx` and `globeRenderer.ts` (WebGL texture projection with a 2D fallback)
  - `src/viz/YearStrip.tsx`, `src/viz/MonthStrip.tsx`, `src/viz/SeriesChart.tsx`
  - `src/brand/Logo.tsx`: the `APP_NAME` constant, so a rename is one line
- Theme: Midnight blue, navy surfaces, cool-white text, blue accent, Source Serif 4 headings and IBM Plex Sans/Mono, set with the Astryx theme editor. Theme mode is dark. Fonts load through `src/themes/bilad/bilad.fonts.css`.

## How to run (this machine)

Node and pnpm are not on the default PATH here. Prefix commands with:

```
export PATH=/Users/michaelc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/michaelc/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:$PATH
```

- This checkout has `.venv`. On a new machine, create one with `python3 -m venv .venv && .venv/bin/pip install -r pipeline/requirements.txt`, then pass `PY=.venv/bin/python` to make.
- Python from python.org lacks certificates, so `pipeline/net.py` uses certifi.
- NASA POWER responses are cached in `pipeline/.cache/` (gitignored). That cache is about 900 files plus GISTEMP/GPCP netCDF. Rebuilding from cache takes minutes; from scratch, the global fetch is about 700 requests.

```
make dev                 # http://localhost:5173
make check PY=...        # TS + Python tests, lint, build, size budget, independent recomputation, browser smoke
make data NATIONS=PER    # add/rebuild a featured nation (registry: pipeline/nations.py)
make global PY=...       # rebuild the global atlas
pnpm exec astryx doctor --built .   # must have 0 failures before delivery
```

## Continuation verification, 2026-11-15

- 60 TypeScript tests and 17 Python tests pass; lint, typecheck, production
  build, and `git diff --check` pass.
- 24 production-browser acceptance checks pass, including scroll-driven
  globe stages, keyboard selection, forced 2D fallback, reduced motion,
  phone layouts, failures/retries, and global walkthroughs for India and
  Canada. A focused export check also confirms that a selected global cell
  downloads a one-cell receipt, 44-year series, finite trend, and exact URL.
- Independent Python recomputation agrees on all 49 supplemental headlines
  and the cached global sample: 400 temperature and 383 eligible rainfall
  cells. A clean CI checkout skips the optional global-cache sample.
- Compressed assets: 495.5 KiB all-route JS, 215.4 KiB initial JS, 48.0 KiB
  CSS, within the unchanged 520/240/55 KiB budgets.
- Astryx doctor: source 20 pass / 3 warn / 0 fail; built output 20 pass /
  2 warn / 0 fail. Warnings concern font-loading proof and native visual /
  generated-theme source patterns. Desktop and phone output was inspected.
- Final motion build: globe median 16.7 ms, p95 16.7–16.8 ms in software
  WebGL at 4× CPU throttle. World playback p95 33.3–33.4 ms in the original
  2D launch mode; a separate software-WebGL session retained larger World
  spikes. See the complete conditions and raw records in PERFORMANCE.md.

Historical verification before this continuation (not the current build):

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
12. Benchmark P2: browser smoke test in CI, demo PDF regenerated from the current build (`public/trace-demo.pdf`, six pages).

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
   - (Decided 2026-11-15: the project is now TRACE, Tracking Regional Atmospheric Change on Earth.)
2. **Hero "Real or fake?" switch** (Chile corroborated vs Bangladesh artefact). The user said to hold off and didn't fully understand the idea, so explain it before building.
3. **The user said they would send more design ideas.** Don't copy GRIME (see `docs/GRIME-WORLD-REFERENCE.md`, the user's file, untracked).
4. **Publish the reviewed changes and information.** The user explicitly authorized updating GitHub with the new implementation and project information, including the reference and benchmark documents. Verify CI before merging and check Pages after deployment.
5. **Global coverage is two variables** (T2M, rainfall), because those have witnesses. Adding more global variables is a cache/fetch run (`GLOBAL_VARIABLES` in `pipeline/global_grid.py`) plus summary changes; they would be single-dataset claims.
6. **Witness independence.** GPCP is only partly independent. A fully independent rainfall witness (GPM IMERG, 2000–) or groundwater (GRACE) needs a NASA Earthdata login.
7. **Phone layout.** It works, with no overflow, but the world map is small on phones, and the nation hero map was narrow for Chile.
8. **Data size.** `public/data` is about 30 MB. Home loads the cells, temperature statistics, station witness, and country geometry. Global annual series (about 4.8 MB per variable) load only on demand in World; the globe does not fetch the relief image.
9. **Doctor warnings** (non-blocking): theme font-proof and purity notes on SVG charts.
10. **GitHub pushes** from this machine sometimes fail once with "could not read Username", and retrying works.

## User preferences learned this session

- Wants a sophisticated, global, distinctive app, not a template or "AI slop", and not a copy of GRIME.
- Wants incremental commits and pushes that show progress.
- Wants independent agent reviews before calling work good, especially for copy.
- Wants copy that is humanized but still interesting and specific.
- Wants efficiency: fewer check-ins, bigger batches.
- Will choose the name; give options.
