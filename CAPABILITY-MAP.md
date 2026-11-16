# TRACE Capability Map

TRACE screens temperature and rainfall trends across a global land grid, 60°S–84°N, 1981–2024. It combines statistical tests, jump warnings, source comparison, and exportable evidence. Agreement adds support; flags identify records needing investigation. The product contract is [GLOBAL-DIRECTION.md](docs/GLOBAL-DIRECTION.md).

| Module | Responsibility | Lives in | Depends on |
| --- | --- | --- | --- |
| `data-pipeline` | Global land grid plus supplemental national packs; NASA POWER tiling/cache, boundaries, land fractions, packing, and provenance | `pipeline/` (Python) | — |
| `witnesses` | GISTEMP v4 and partly independent GPCP v2.3, sampled on global and supplemental footprints | `pipeline/crosscheck.py` | `data-pipeline` |
| `statistics` | Theil–Sen, Hamed–Rao Mann–Kendall, Benjamini–Hochberg, Pettitt, BIC step screen, emergence, agreement verdicts | `src/lib/stats.ts` | — |
| `summaries` | Global per-cell statistics and national headlines, using the browser's engine | `scripts/summarize-global.ts`, `scripts/summarize.ts` | `statistics`, `data-pipeline` |
| `verification` | Independent recomputation of national headlines and optional cached global sample; regression and browser checks | `pipeline/validate.py`, `tests/`, `scripts/smoke.mjs` | all |
| `global-explorer` | Any covered country or cell, source comparison, year playback, shareable URL, and evidence export | `src/pages/World.tsx`, `src/lib/globalEvidence.ts`, `src/viz/WorldMap.tsx` | `statistics`, `witnesses` |
| `global-walkthrough` | All land, any country, or a linked cell through the calculation and its limits | `src/pages/GlobalProof.tsx` | `global-explorer` |
| `supplemental-atlas` | Extra variables, monthly diagnostics, profiles, briefs for seven national packs | `src/pages/Atlas.tsx`, `src/pages/Brief.tsx` | `statistics`, `witnesses` |
| `global-home` | Full identity, purpose and beneficiaries, pinned globe, scroll-led evidence trail, and global highlights | `src/pages/Casebook.tsx`, `src/features/MotionStack.tsx`, `src/viz/GlobeMap.tsx` | `summaries`, `witnesses` |
| `casebook` | Four guided examples and a method reference | `src/pages/Cases.tsx`, `src/pages/CaseFile.tsx`, `src/data/cases.ts` | `statistics`, `witnesses` |

Build order: data → witnesses → shared statistics → summaries → verification → global explorer/walkthrough → global home and guided examples. Supplemental packs extend the product without defining its geographic coverage.
