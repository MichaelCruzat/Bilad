# TRACE — implementation record and agent handoff

Last reviewed: 2026-11-15. Repository: `MichaelCruzat/TRACE`.
Local checkout: `/Users/michaelc/Developer/Bilad`.
Public site: https://michaelcruzat.github.io/TRACE/.

This file records the work carried forward from Claude Code, the changes
implemented during the continuation, and how to verify them. A Git commit,
its CI results and the live build establish release status; an item written
here does not by itself prove deployment.

## What this project actually does

**TRACE means Tracking Regional Atmospheric Change on Earth.** It is a
global climate-evidence research app, built for NASA Space Apps 2026.
It examines NASA POWER/MERRA-2 temperature and rainfall over 54,425 land
cells, covering 60°S–84°N and 1981–2024. Users can explore any covered
country or cell, inspect a trend and its uncertainty, compare a second
record, examine possible discontinuities, and export the evidence.

Temperature is compared with GISTEMP v4 land-station estimates. Rainfall is
compared with GPCP v2.3, which shares some gauge inputs with MERRA-2 and is
only partly independent. The records are estimates; agreement does not
establish ground truth, and disagreement does not identify a cause.

The purpose is to make climate claims easier to inspect before people use
them in communication or adaptation assessments. Intended users include
researchers, educators, NASA data teams and government analysts. Institutional
adoption and policy benefits have not been demonstrated. TRACE does not
forecast, attribute causes, or replace a validated local risk model.

Seven older national packs provide extra variables and monthly diagnostics.
They supplement the global product; they do not define its geographic scope.

## Completed product and interface work

| Area | Result | Main files |
| --- | --- | --- |
| Global identity | Full acronym, purpose, date window and geographic limits on Home; no seeded country | `src/pages/Casebook.tsx`, `docs/GLOBAL-DIRECTION.md` |
| Homepage case files | Four flat case rows live on Home; individual investigations remain separate | `src/features/CaseFiles.tsx`, `src/pages/CaseFile.tsx` |
| Existing case links | `#/cases` and `#/?section=cases` open the homepage case section | `src/app/router.ts` |
| Impact tab | Explains the research problem, temperature cross-comparison, intended users and limits | `src/pages/Impact.tsx` |
| Global evidence | Any covered country or cell can be compared and exported; a linked cell stays a one-cell footprint | `src/pages/World.tsx`, `src/lib/globalEvidence.ts` |
| Calculation walkthrough | Global land, any country, or a linked cell; old national links retain monthly detail | `src/pages/GlobalProof.tsx`, `src/pages/Proof.tsx` |
| Geographic alignment | Globe outlines and cells use the actual texture aspect ratio, with antimeridian checks | `src/viz/globeTexture.ts`, `tests/globeTexture.test.ts` |
| Regional outlines | Label-free state/province lines appear after 3× zoom on global and supplemental maps | `src/lib/regionalBoundaries.ts`, `src/viz/GlobeMap.tsx`, `src/viz/WorldMap.tsx`, `src/viz/NationMap.tsx` |
| Selected colour direction | Midnight blue: navy surfaces, cool-white text, blue controls; data palettes keep their meaning | `themes/bilad/`, `src/themes/bilad/` |
| Native map colours | Canvas chrome resolves theme tokens from its own element and ancestry | `src/viz/chrome.ts` |
| Continuous homepage globe | Scrolling preserves the chosen data view and camera; rotation continues without scroll-triggered fades or fly-to resets | `src/pages/Casebook.tsx`, `scripts/smoke.mjs` |
| Motion accessibility | Pause control, keyboard selection/announcements, reduced motion and off-screen suspension | `src/viz/GlobeMap.tsx`, `src/features/MotionStack.tsx` |
| Loading failures | Error states and retry for missing globe, proof and witness downloads | page loaders and regression tests |

The latest instruction supersedes the earlier scroll-following design:
**scrolling must not switch globe layers, reposition the camera, stop its
rotation, or animate the globe container again.** Data-view buttons remain
explicit controls. Dragging, keyboard inspection or zooming may pause
rotation so the user can inspect a place. The pause button and reduced-motion
preference remain authoritative.

## Rendering and regional data work

- The globe paints the climate grid once to a geographic texture and uses
  WebGL to project it as the camera turns. A batched 2D fallback remains.
- The fallback omits redundant `closePath()` calls and limits fill batches
  to 128 polygons; those calls were a measured bottleneck.
- World-map hover/selection feedback reuses a cached geographic scene.
  The annual colour limit is calculated once per dataset using exact
  quickselect rather than sorting the entire array every year.
- Regional outlines are generalized Natural Earth admin-1 lines: 61,012
  vertices, no names/properties, one optional download after 3× zoom.
  Source, checksum, license and simplification live in
  `public/data/admin1.meta.json`. The builder is
  `scripts/build-regional-boundaries.py`.
- Global maps cache outline layers as textures. The 2D globe fallback culls
  off-screen lines; the national SVG clips them to its country geometry.
- In the recorded throttled local experiment, zoomed globe p95 intervals
  improved from 83–117 ms with live vector outlines to about 17 ms with the
  cached layer. World panning improved from 183–350 ms to about 33 ms.
  These are synthetic callback intervals, not a guarantee of device FPS.
- Cached relief and cached climate-grid experiments did not show a clear
  improvement and were reverted. Raw evidence and limitations are in
  `docs/PERFORMANCE.md` and `docs/regional-performance-results.json`.

## Claude checkpoints preserved during continuation

The continuation includes prior work recorded in these commits. Their
existence is evidence of implementation, not of external impact or NASA approval.

| Commit | Work retained |
| --- | --- |
| `48ae803` / PR #1 | Global TRACE scope, evidence purpose, corrected geographic projection, loading/selection/statistical wording fixes |
| `171f40d` | Homepage case files and dedicated Impact page |
| `961f73e` | Midnight theme, regional geometry/caching, larger maps, corrected route wrapper heights, chart readouts and Method outline |
| `11db215` | Contextual `?` help, clearer selected controls, phone navigation, HTML zoom buttons, verdict colours and chart layout fixes |
| `8f39f2d` | Plain-language review, country aliases, case summaries and clearer treatment of non-significant trends |

The review also found unfinished statistical experiments, modified global
summary binaries, and a draft findings generator in the working tree. Those
must be reconciled with the validator, tests and Method documentation before
they can be treated as an accepted method change. The continuation audits
them separately from the visual optimizations; a faster renderer does not
validate a new scientific rule.

## Verification and how to continue

Use Node 22+, pnpm 11+ and the Python virtual environment. On this machine:

```sh
export PATH=/Users/michaelc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH
pnpm test
pnpm lint
pnpm build
.venv/bin/python -m unittest discover -s tests -p 'test_*.py'
.venv/bin/python -m pipeline validate
.venv/bin/python scripts/bundle_budget.py
pnpm exec astryx doctor --built .
pnpm exec astryx doctor --built dist
pnpm smoke
SMOKE_WEBGL=1 pnpm smoke
```

At the pre-resumption checkpoint: 65 TypeScript tests, 17 Python tests and
27 browser checks passed; source and built Astryx checks had zero failures.
Those results predate the latest unfinished statistical drafts and must not
be represented as validating later changes. The scroll regression was
reproduced before its fix and passed afterwards in production Chrome.
Final verification for the release belongs below once all changes are integrated.

Follow `AGENTS.md` for Astryx usage. Edit theme settings through its editor
and inspect the resulting previews; do not hand-edit generated theme output.
Keep scientific numbers computed from shipped data and update the independent
validator when changing their definitions. Preserve existing user work in
the checkout; inspect the diff before editing or staging.

Current scope is defined by the user's corrections and
`docs/GLOBAL-DIRECTION.md`, then the current README and handoff. `SPEC.md`
and the nation-led portions of `tasks/plan.md` are historical. Avoid bringing
back a country shortlist, a standalone Cases tab, repeated technical ledgers
on Home, or automatic globe resets while scrolling.

## Stop point and release record

The user ended feature work and requested a 30-second recorded demo.
The scroll fix was committed as `4ce4983` and pushed to
`feature/home-impact-midnight-regions`. Later reviewed changes remain a
checkpoint pending final exact-commit CI and live verification; they must
not be described as deployed.

The continuation added a descriptive global temperature comparison to Impact,
corrected tied-rank/constant-input handling, retained the established
production classifiers, archived the unsupported statistical drafts with their
original binary patch, and added country camera fitting. The test checkpoint
passed 82 TypeScript and 19 Python tests, including independent all-land
slopes/p-values and rank correlations. Independent pipeline validation passed
all 49 national variable summaries plus 400 temperature and 383 rainfall
samples. An obsolete scroll-follow test action was removed after the full
browser run; its retained manual-view test passed on rerun.

The colour agent recommended retaining Midnight blue with stronger card
surfaces and secondary text. That optional refinement was not applied before
the user stopped feature work. No data ramps were recoloured.

Demo artifacts and narration are under `artifacts/demo/`.
