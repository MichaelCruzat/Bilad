# Implementation Plan: Bilad V1

Source spec: [SPEC.md](../SPEC.md)

## Overview

Build Bilad as a static React/TypeScript experience that guides a user from the Earth System Trend Detective problem to transparent variable/region selection, NASA POWER time series, statistical trend screen, and plain-language verdict. Keep the first release self-contained with deterministic fallback data, optional live NASA POWER retrieval, visible limitations, and a GitHub Pages deployment path.

## Architecture decisions

- Keep the application client-only so the public demo needs no server, secret, or database.
- Separate live NASA POWER observations from deterministic fallback data so a failed network request never erases the core experience.
- Keep trend analysis pure and deterministic in `src/lib/trendAnalysis.ts`; UI components consume typed data and do not own scientific logic.
- Use Astryx for shell, layout, type, controls, cards, and status treatments; add only the domain-specific chart primitive the system does not provide.
- Keep the chart and semantic variable/region controls as the source of truth; no map-tile dependency is required for the scientific story.
- Use the browser URL for non-sensitive view state only if it improves demoability; no user data or auth state is required.

## Task list

### Phase 1: Foundation

- [x] Task 1: Bootstrap the Vite/React/TypeScript project and initialize Astryx.
- [ ] Task 2: Add typed variable/region/source data and deterministic trend utilities with tests.

### Checkpoint: Foundation

- [x] Astryx template is in use.
- [ ] `pnpm test`, `pnpm lint`, and `pnpm build` pass after the scope correction.
- [x] The app renders a stable shell without a network dependency.

### Phase 2: Core investigation

- [ ] Task 3: Build the briefing-to-explorer flow with variable/region selection, chart, trend verdict, and method surface.
- [ ] Task 4: Add NASA POWER enrichment, fallback states, variable definitions, limitations, and source links.

### Checkpoint: Core investigation

- [ ] A user can select a variable and region, inspect a time series, and understand the trend verdict.
- [ ] Live NASA POWER data is optional and failures remain recoverable.
- [ ] Keyboard and narrow viewport checks pass.

### Phase 3: Storytelling

- [ ] Task 5: Add the guided judge example, method/provenance surfaces, and submission-ready copy.

### Phase 4: Release readiness

- [ ] Task 6: Add README, source registry, license, AI disclosure, GitHub Pages workflow, and release checks.
- [ ] Task 7: Run browser acceptance, accessibility review, code review, and final simplification pass.

### Checkpoint: Release candidate

- [ ] Tests, lint, build, and browser smoke tests pass.
- [ ] All sources and limitations are visible.
- [ ] The app is ready for a GitHub push and public deployment.

## Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Astryx API or package setup differs from expected | High | Initialize from the CLI/template first; keep domain logic independent of UI primitives. |
| NASA POWER rate limit/CORS/network failure | High | Normalize responses behind a small client and provide deterministic fallback time series with freshness labels. |
| Statistical language overstates the prototype | High | Show the method, assumptions, confidence interval, and limitations next to every verdict. |
| Scope expands during the hackathon | Medium | Keep global raster analysis, causal attribution, ML classification, accounts, and native mobile explicitly deferred. |
