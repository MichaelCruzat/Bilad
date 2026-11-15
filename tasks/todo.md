# Bilad V1 Task List

## Phase 1: Foundation

- [x] Task 1: Bootstrap the Vite/React/TypeScript project and initialize Astryx.
  - Acceptance: The app runs locally with the target commands; the first page comes from an Astryx template; TypeScript and linting are configured.
  - Verify: `pnpm install`, `pnpm lint`, `pnpm build`; open the page in a browser and confirm the shell renders.
  - Dependencies: None.
  - Files likely touched: `package.json`, `vite.config.ts`, `tsconfig*.json`, `src/main.tsx`, `src/app/App.tsx`.
  - Estimated scope: Medium. Completed in the foundation slice.

- [ ] Task 2: Add typed candidate/profile/source data and deterministic scoring utilities with tests.
  - Acceptance: Six analog candidates and Moon/Mars profiles are typed; score normalization and ranking are deterministic; source IDs resolve to a registry entry.
  - Verify: `pnpm test`, `pnpm lint`, `pnpm build`.
  - Dependencies: Task 1.
  - Files likely touched: `src/data/*`, `src/lib/scoring.ts`, `tests/scoring.test.ts`.
  - Estimated scope: Medium.

## Checkpoint: Foundation

- [ ] Tests, lint, and build pass.
- [ ] The app renders without a network request.
- [ ] Local commit is ready for review before continuing.

## Phase 2: Core discovery

- [ ] Task 3: Build the briefing-to-discovery flow with Moon/Mars profile selection, ranking controls, candidate list, and map enhancement.
  - Acceptance: A user can select a profile, adjust at least three priorities, see ranked cards update, and use a list fallback independent of the map.
  - Verify: Component behavior tests plus browser smoke test at desktop and mobile widths.
  - Dependencies: Task 2.
  - Files likely touched: `src/app/*`, `src/features/discovery/*`, `src/components/*`, `tests/discovery.test.tsx`.
  - Estimated scope: Large; split into list/ranking and map enhancement if needed.

- [ ] Task 4: Add candidate detail with NASA POWER enrichment, fallback states, evidence, limitations, and source links.
  - Acceptance: Selected candidates show evidence and limitations; live NASA POWER data is normalized; API failure leaves a clearly labeled fallback visible.
  - Verify: Unit tests for response normalization/failure; browser smoke test with the API available and blocked.
  - Dependencies: Task 3.
  - Files likely touched: `src/lib/nasaPower.ts`, `src/features/provenance/*`, `src/features/discovery/*`, `tests/nasaPower.test.ts`.
  - Estimated scope: Medium.

## Checkpoint: Core discovery

- [ ] User can inspect six candidates and explain the score.
- [ ] Network failure does not block the primary flow.
- [ ] Keyboard navigation and narrow viewport layout are usable.

## Phase 3: Decision and storytelling

- [ ] Task 5: Add three-site comparison and mission rehearsal brief generation.
  - Acceptance: A user can compare up to three candidates, see aligned dimensions/trade-offs, and copy or download a brief.
  - Verify: Component behavior tests; manual copy/download check.
  - Dependencies: Task 4.
  - Files likely touched: `src/features/comparison/*`, `src/lib/brief.ts`, `tests/comparison.test.tsx`.
  - Estimated scope: Medium.

- [ ] Task 6: Add guided judge mode, method/provenance surfaces, and submission-ready copy.
  - Acceptance: Judge mode presents the problem, method, candidate, comparison, and impact in a predictable sequence; sources and limitations are reachable from every relevant surface.
  - Verify: Browser smoke test follows the 3-minute path; links and headings are checked.
  - Dependencies: Task 5.
  - Files likely touched: `src/features/briefing/*`, `src/features/provenance/*`, `src/app/*`, `tests/briefing.test.tsx`.
  - Estimated scope: Medium.

## Phase 4: Release readiness

- [ ] Task 7: Add README, source registry, license, AI disclosure, GitHub Pages workflow, and release checks.
  - Acceptance: A fresh checkout can follow the README; sources, license, AI disclosure, and deployment workflow are present; CI runs test/lint/build.
  - Verify: Clean install/build; inspect workflow syntax; run `git diff --check` and secret scan.
  - Dependencies: Task 6.
  - Files likely touched: `README.md`, `LICENSE`, `docs/*`, `.github/workflows/deploy.yml`, `package.json`.
  - Estimated scope: Medium.

- [ ] Task 8: Run browser acceptance, accessibility review, code review, and final simplification pass.
  - Acceptance: Core flows work at desktop/mobile sizes, console is clean, visible focus exists, and no release-blocking review findings remain.
  - Verify: Browser smoke test, test/lint/build, review checklist.
  - Dependencies: Task 7.
  - Files likely touched: Only files required by findings.
  - Estimated scope: Medium.

## Checkpoint: Release candidate

- [ ] All acceptance criteria are met.
- [ ] GitHub push is ready for user confirmation.
