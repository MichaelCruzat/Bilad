# Bilad Capability Map

Bilad is an Earth-analog explorer for future lunar and Martian missions. The product turns open NASA Earth, Moon, and Mars data into a clear, explainable decision surface: find candidate places on Earth, understand why they are useful as analogs, and build a small mission rehearsal around them.

| Module | Responsibility | Depends on |
| --- | --- | --- |
| `platform-quality` | Responsive shell, accessibility, resilient loading, local fallback, GitHub Pages deployment | — |
| `data-provenance` | Candidate data model, NASA POWER retrieval, source citations, uncertainty and limitations | `platform-quality` |
| `analog-discovery` | Planet profile, map, candidate ranking, filters, explainable score | `data-provenance` |
| `mission-comparison` | Compare analog sites, tune priorities, create a mission rehearsal brief | `analog-discovery` |
| `story-and-submission` | Guided demo narrative, challenge alignment, README, sources, AI disclosure, licensing | `data-provenance`, `mission-comparison` |

Build order: `platform-quality` → `data-provenance` → `analog-discovery` → `mission-comparison` → `story-and-submission`.
