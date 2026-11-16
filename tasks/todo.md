# TRACE continuation checklist

Current scope: global temperature and rainfall, evidence exports and a worldwide
walkthrough for any covered country or cell. Seven national packs add variables
as supplemental deep links. The global correction in
[GLOBAL-DIRECTION.md](../docs/GLOBAL-DIRECTION.md) controls the primary product.

- [x] Review Claude's unfinished TRACE rename, globe home, and proof page.
- [x] Keep World cell selections to one cell instead of a national footprint.
- [x] Match the ten-year witness minimum for globe trends and verdicts.
- [x] Recover from failed proof, home, and annual-series requests with retry.
- [x] Move the camera to a selection made before the globe finishes loading.
- [x] Add rotation pause, keyboard announcements, and flight cleanup.
- [x] Correct FDR wording and remove unrecorded audit claims.
- [x] Reject non-finite validation differences instead of silently passing them.
- [x] Preserve binary UI fixtures and add regression tests.
- [x] Simplify repeated home content; restore case files on Home per the user's later correction.
- [x] Profile and optimize globe rotation and World year playback; retain a 2D fallback.
- [x] Replace sentence/verdict badges with text labels under the project UI rules.
- [x] Restore the full acronym and vital global context; remove seeded national home content.
- [x] Add a pinned scroll-led evidence trail, route transitions, and sliding selection feedback.
- [x] Extend the default statistical walkthrough to worldwide footprints and any covered country.
- [x] Align globe data and boundary texture projections; test latitudes and the antimeridian.
- [x] Complete final browser acceptance, visual review, and demo regeneration.
- [x] Record final verification results in the handoff.
- [x] Review, commit and release the global continuation through PR #1; verify Pages at `48ae803`.
- [x] Add a separate Impact tab explaining significance, cross-record checks, intended users and limits.
- [x] Add label-free regional outlines on zoom, with a shared lazy asset and projection alignment checks.
- [x] Apply the user's Midnight blue theme through the Astryx editor; adapt native map chrome.
- [x] Restore viewport height on the Atlas and World routes so the national map is not pushed below the fold.
- [x] Size national maps from the column width so Chile and other tall nations are no longer squeezed.
- [x] Enlarge the World map by narrowing the Explore side panels.
- [x] Give every chart point-level readouts (pointer, touch and keyboard) and label the World verdict shares.
- [x] Rebuild the Method page with a sidebar outline, verdict steps, structured calculation sections and a variables table.
- [x] Run a four-agent visual review across all routes and widths; fix button visibility, control fit, phone menu and legends.
- [x] Move on-page instructions into "?" help with plain and technical explanations for every map and chart.

Release evidence is the exact commit's GitHub Actions results and the live
Pages build. A local checklist is not proof that a later commit deployed.

The older V1 tasks below are historical. They are superseded by the current
README and [handoff](../docs/HANDOFF.md); their unchecked boxes are not an
assessment of the present implementation.

## Historical V1 task list

## Scope correction

The pasted NASA prompt is the source of truth for this release: **Be An Earth System Trend Detective!** The original analog-site slice is retained only as repository history; current work replaces it with variable selection, regional time series, and transparent trend analysis.

## Phase 1: Foundation

- [x] Task 1: Bootstrap the Vite/React/TypeScript project and initialize Astryx.
  - Acceptance: The app runs locally with the target commands; the first page comes from an Astryx template; TypeScript and linting are configured.
  - Verify: `pnpm install`, `pnpm lint`, `pnpm build`; open the page in a browser and confirm the shell renders.
  - Dependencies: None.
  - Files likely touched: `package.json`, `vite.config.ts`, `tsconfig*.json`, `src/main.tsx`, `src/app/App.tsx`.
  - Estimated scope: Medium. Completed in the foundation slice.

- [ ] Task 2: Add typed variable/region/source data and deterministic trend utilities with tests.
  - Acceptance: NASA POWER variables and contrasting regions are typed; linear trend, confidence interval, and Mann–Kendall screening are deterministic; source IDs resolve to a registry entry.
  - Verify: `pnpm test`, `pnpm lint`, `pnpm build`.
  - Dependencies: Task 1.
  - Files likely touched: `src/data/*`, `src/lib/trendAnalysis.ts`, `tests/trends.test.ts`.
  - Estimated scope: Medium.

## Checkpoint: Foundation

- [x] Tests, lint, and build passed before the scope correction.
- [ ] Tests, lint, and build pass after the scope correction.
- [x] The app renders without a network request.
- [ ] The trend model and fallback data are ready for review.

## Phase 2: Core investigation

- [ ] Task 3: Build the briefing-to-explorer flow with variable/region selection, chart, verdict, and method surface.
  - Acceptance: A user can select a variable and region, see the signal and fitted trend, and understand the plain-language verdict.
  - Verify: Component behavior tests plus browser smoke test at desktop and mobile widths.
  - Dependencies: Task 2.
  - Files likely touched: `src/app/*`, `src/features/explorer/*`, `src/components/*`, `tests/explorer.test.tsx`.
  - Estimated scope: Large; keep the chart domain-specific and the surrounding UI Astryx-based.

- [ ] Task 4: Add NASA POWER enrichment, fallback states, variable definitions, limitations, and source links.
  - Acceptance: Selected analyses show the NASA POWER series when available; API failure leaves a clearly labeled deterministic fallback visible.
  - Verify: Unit tests for response normalization/failure; browser smoke test with the API available and blocked.
  - Dependencies: Task 3.
  - Files likely touched: `src/lib/nasaPower.ts`, `src/features/provenance/*`, `src/app/*`, `tests/nasaPower.test.ts`.
  - Estimated scope: Medium.

## Checkpoint: Core investigation

- [ ] User can answer what changed, where, how much, and whether the prototype significance screen passes.
- [ ] Network failure does not block the primary flow.
- [ ] Keyboard navigation and narrow viewport layout are usable.

## Phase 3: Storytelling

- [ ] Task 5: Add the guided judge example, method/provenance surfaces, and submission-ready copy.
  - Acceptance: Judge mode presents the question, variable, region, method, result, limitation, and impact in a predictable sequence; sources are reachable from the analysis surface.
  - Verify: Browser smoke test follows the 3-minute path; links and headings are checked.
  - Dependencies: Task 4.
  - Files likely touched: `src/app/*`, `docs/*`, `README.md`.
  - Estimated scope: Medium.

## Phase 4: Release readiness

- [ ] Task 6: Add README, source registry, license, AI disclosure, GitHub Pages workflow, and release checks.
  - Acceptance: A fresh checkout can follow the README; sources, license, AI disclosure, and deployment workflow are present; CI runs test/lint/build.
  - Verify: Clean install/build; inspect workflow syntax; run `git diff --check` and secret scan.
  - Dependencies: Task 5.
  - Files likely touched: `README.md`, `LICENSE`, `docs/*`, `.github/workflows/deploy.yml`, `package.json`.
  - Estimated scope: Medium.

- [ ] Task 7: Run browser acceptance, accessibility review, code review, and final simplification pass.
  - Acceptance: Core flows work at desktop/mobile sizes, console is clean, visible focus exists, and no release-blocking review findings remain.
  - Verify: Browser smoke test, test/lint/build, review checklist.
  - Dependencies: Task 6.
  - Files likely touched: Only files required by findings.
  - Estimated scope: Medium.

## Checkpoint: Release candidate

- [ ] All acceptance criteria are met.
- [ ] GitHub push is ready.
