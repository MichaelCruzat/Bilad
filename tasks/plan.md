# Implementation Plan: Bilad V1

Source spec: [SPEC.md](../SPEC.md)

## Overview

Build Bilad as a static React/TypeScript experience that guides a user from the Earth-analog problem to a transparent Moon/Mars profile, ranked candidate locations, evidence, comparison, and a short mission rehearsal brief. Keep the first release self-contained with curated fallback data, optional NASA POWER enrichment, visible limitations, and a GitHub Pages deployment path.

## Architecture decisions

- Keep the application client-only so the public demo needs no server, secret, or database.
- Separate curated analog context from live NASA POWER observations so a failed network request never erases the core experience.
- Keep scoring pure and deterministic in `src/lib/scoring.ts`; UI components consume typed data and do not own scientific logic.
- Use Astryx for shell, layout, type, controls, cards, and status treatments; add only domain components that the system does not provide.
- Use a map as an enhancement, not the only interface. Candidate cards and a semantic list remain the source of truth.
- Use the browser URL for non-sensitive view state only if it improves demoability; no user data or auth state is required.

## Task list

### Phase 1: Foundation

- [ ] Task 1: Bootstrap the Vite/React/TypeScript project and initialize Astryx.
- [ ] Task 2: Add typed candidate/profile/source data and deterministic scoring utilities with tests.

### Checkpoint: Foundation

- [ ] Astryx template is in use.
- [ ] `pnpm test`, `pnpm lint`, and `pnpm build` pass.
- [ ] The app renders a stable shell without a network dependency.

### Phase 2: Core discovery

- [ ] Task 3: Build the briefing-to-discovery flow with Moon/Mars profile selection, ranking controls, candidate list, and map enhancement.
- [ ] Task 4: Add candidate detail with NASA POWER enrichment, fallback states, evidence, limitations, and source links.

### Checkpoint: Core discovery

- [ ] A user can select a profile, inspect six candidates, and understand the score.
- [ ] Live NASA POWER data is optional and failures remain recoverable.
- [ ] Keyboard and narrow viewport checks pass.

### Phase 3: Decision and storytelling

- [ ] Task 5: Add three-site comparison and mission rehearsal brief generation.
- [ ] Task 6: Add guided judge mode, method/provenance surfaces, and submission-ready copy.

### Phase 4: Release readiness

- [ ] Task 7: Add README, source registry, license, AI disclosure, GitHub Pages workflow, and release checks.
- [ ] Task 8: Run browser acceptance, accessibility review, code review, and final simplification pass.

### Checkpoint: Release candidate

- [ ] Tests, lint, build, and browser smoke tests pass.
- [ ] All sources and limitations are visible.
- [ ] The app is ready for a GitHub push and public deployment.

## Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Astryx API or package setup differs from expected | High | Initialize from the CLI/template first; keep domain logic independent of UI primitives. |
| NASA POWER rate limit/CORS/network failure | High | Normalize responses behind a small client and provide curated fallback values with freshness labels. |
| Map tiles fail or add excessive bundle weight | Medium | Keep the semantic candidate list as the primary interface and lazy-load the map enhancement. |
| Scientific claims overreach the available data | High | Show score dimensions, confidence, source freshness, and “screening aid” limitations in the product. |
| Scope expands during the hackathon | Medium | Keep accounts, global raster analysis, ML classification, and native mobile explicitly deferred. |

## Open questions

- Confirm the local event/team challenge selection if it differs from the analog-site challenge assumed in the spec.
- Revisit bilingual mode only after the core English demo path is complete.
