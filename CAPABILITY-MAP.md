# Bilad Capability Map

Bilad is an Earth-system trend detective for any nation: it maps where NASA Earth-system variables have changed since 1981, tests whether each change is significant, and cross-examines it against an independent NASA record before calling it real.

| Module | Responsibility | Lives in | Depends on |
| --- | --- | --- | --- |
| `data-pipeline` | Nation registry, NASA POWER tiling and cache, boundaries and land fractions, Int16 packing, provenance | `pipeline/` (Python) | — |
| `witnesses` | GISTEMP v4 and GPCP v2.3 sampled on each nation's cells and named regions | `pipeline/crosscheck.py` | `data-pipeline` |
| `statistics` | Theil–Sen, Hamed–Rao Mann–Kendall, Benjamini–Hochberg, Pettitt, BIC step screen, emergence, agreement verdicts | `src/lib/stats.ts` | — |
| `summaries` | National headlines in `index.json`, computed with the browser's engine | `scripts/summarize.ts` | `statistics`, `data-pipeline` |
| `verification` | Independent Python recomputation of every headline; unit and integration tests | `pipeline/validate.py`, `tests/` | all |
| `atlas` | Map, latitude profile, evidence panel, URL state | `src/pages/Atlas.tsx`, `src/viz/`, `src/features/` | `statistics`, `witnesses` |
| `casebook` | Guided cases, home page, method page | `src/pages/`, `src/data/cases.ts` | `atlas` |

Build order: `data-pipeline` → `witnesses` → `statistics` → `summaries` → `verification` → `atlas` → `casebook`.
