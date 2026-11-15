# Bilad Capability Map

Bilad is an Earth System Trend Detective. The product turns open NASA Earth science data into a clear, explainable investigation: select a variable and region, inspect a long-enough time series, quantify the trend, and understand whether the signal passes a basic significance screen.

| Module | Responsibility | Depends on |
| --- | --- | --- |
| `platform-quality` | Responsive shell, accessibility, resilient loading, local fallback, GitHub Pages deployment | — |
| `data-provenance` | Variable/region data model, NASA POWER retrieval, source citations, uncertainty and limitations | `platform-quality` |
| `trend-explorer` | Variable and region selection, time-series chart, regression summary, Mann–Kendall screen | `data-provenance` |
| `investigation-brief` | Plain-language verdict, guided example, method and limitation surfaces | `trend-explorer` |
| `story-and-submission` | Challenge alignment, README, sources, AI disclosure, licensing, deployment | `data-provenance`, `investigation-brief` |

Build order: `platform-quality` → `data-provenance` → `trend-explorer` → `investigation-brief` → `story-and-submission`.
