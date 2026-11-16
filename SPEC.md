# Spec: TRACE — Earth System Trend Detective V1

Status: superseded. V2 (national atlas, casebook, independent witnesses, Python pipeline) is described in [tasks/plan.md](tasks/plan.md) and the [README](README.md). This file records the V1 scope for history.

## Objective

Build a public, deployment-ready web application for NASA Space Apps 2026 challenge [Be An Earth System Trend Detective!](https://www.spaceappschallenge.org/2026/challenges/earth-system-trend-detective/).

TRACE helps students, educators, and Earth-science audiences answer four questions: **What is changing, where is it changing, by how much, and is the change statistically meaningful?** It turns NASA Earth science variables and regions into transparent, readable investigations rather than mysterious charts or unsupported conclusions.

The experience must feel like a guided investigation:

1. Explain the trend-detective problem in plain language.
2. Choose an Earth science variable and a region.
3. Load a long-enough monthly time series from NASA POWER, with a deterministic demo fallback when the network is unavailable.
4. Show the trend magnitude, direction, confidence interval, and Mann–Kendall significance screen.
5. Explain the variable, time window, data source, method, and limitations beside the result.
6. Include a guided example so a judge can understand the full story in roughly three minutes.

## Users

- Earth-science audiences who need an interpretable starting point for regional trend research.
- Educators and students who need a tactile way to understand Earth-system variables and statistical evidence.
- NASA Space Apps judges who should be able to see the problem, data, method, result, and impact without a walkthrough from the team.

## NASA alignment and submission compliance

| Criterion | TRACE evidence |
| --- | --- |
| Impact | Makes difficult Earth-system data legible to mission teams, educators, and the public; helps people ask better questions about a changing planet. |
| Creativity | Treats trend analysis as an investigation: users choose the variable and place, inspect the signal, and see how statistical evidence changes the verdict. |
| Validity | Uses NASA-sourced data where available, reports the time window and sample count, exposes the calculation, and labels the result as a screening analysis rather than a causal claim. |
| Relevance | Names the selected NASA challenge in the product, README, and demo narrative; the workflow directly answers what, where, how much, and whether significant. |
| Presentation | Provides a guided example, a clear first-run story, accessible visual hierarchy, and a README with a 3-minute demo script. |

The repository and product must also satisfy the NASA terms and project-submission expectations:

- Cite every NASA, third-party, open-source, image, and icon source used.
- Include license documentation for original project materials and third-party dependencies.
- Include a clear AI-use disclosure in the project documentation and submission copy.
- Do not include private or personally identifying information.
- Keep the demo runnable from a public GitHub repository with no paid service or secret required.

Primary references:

- [2026 NASA Space Apps home](https://www.spaceappschallenge.org/2026/)
- [Official challenge statement](https://www.spaceappschallenge.org/2026/challenges/earth-system-trend-detective/)
- [NASA Space Apps terms and conditions](https://www.spaceappschallenge.org/legal/)
- [NASA POWER project](https://power.larc.nasa.gov/)

## Product scope

### In scope for V1

- A single responsive web experience with a strong briefing state and clear navigation between the explorer, guided example, and method/source views.
- A typed catalog for NASA POWER surface temperature, precipitation, and solar energy, with plain-language definitions and units.
- A region catalog covering contrasting contexts including the Atacama, Amazon, Sahel, Arctic, and New York/Chesapeake region.
- An optional second point for comparing the same variable and window, with independent live/demo provenance labels.
- An annual chart switch between absolute values and differences from each point's 2000–2004 annual mean; the reference is explicitly not a climate normal.
- Live NASA POWER monthly retrieval for the selected variable and region, with deterministic local fallback data and an explicit fallback label when the network is unavailable.
- A trend chart with a fitted line, sample count, time window, slope per year, approximate 95% confidence interval, and a Mann–Kendall significance screen.
- A verdict view answering what changed, where, how much, and whether the signal passes the prototype significance screen.
- Method, source, variable-definition, and limitation panels reachable from the main analysis surface.
- A guided example that walks through a variable, two locations, the series and source labels, the method, and the impact in roughly three minutes.
- An original field-atlas visual language: coordinate-grid artwork, editorial hierarchy, and a dense explorer rather than a generic card gallery. Decorative paths must never be presented as measured data.

### Deferred to V2

- Full global raster analysis, machine-learning classification, causal attribution, or scientific-grade forecasting.
- Satellite-specific ingestion beyond the NASA POWER monthly API.
- User accounts, server-side persistence, collaboration, and native mobile packaging.
- Integration with restricted, credentialed, or rate-limited NASA services that would make the public demo fragile.

## Technical approach

### Stack

- Vite + React + TypeScript for a static, GitHub Pages-friendly client.
- Astryx as the UI system and component source of truth. Use Astryx components and tokens for layout, typography, controls, cards, and status treatments.
- A small domain-specific SVG chart because the installed UI system does not provide a scientific time-series chart.
- Vitest for deterministic analysis/data utilities and UI behavior tests.
- Browser smoke testing through the available browser automation surface; agent-browser is preferred when installed, otherwise the available browser surface is used.
- GitHub Actions to build the static site and deploy the `dist` artifact to GitHub Pages.

### Project structure

```text
src/
  app/              Application shell and route-level composition
  data/             Variable catalog, region catalog, source registry
  features/         Explorer, guided example, provenance surfaces
  lib/              Trend analysis, NASA POWER client, formatting, resilience helpers
tests/              Unit and behavior tests
public/             Static metadata/icons only; no build output
docs/               Submission narrative, demo script, data notes
```

### Data model and scientific honesty

Each result is a screening analysis, not a causal explanation or forecast. The app shows the raw time window, sample count, fitted slope, approximate 95% confidence interval, and Mann–Kendall significance screen. Live NASA POWER observations are separated from deterministic demo fallback data, and the UI must never imply that one variable proves why a trend occurred.

Planned source families:

- NASA challenge statement for the trend-detective framing.
- NASA POWER for monthly point-based solar radiation, temperature, and precipitation time series.
- NASA Earthdata documentation for Earth-science data context and future mission-specific expansion.

The client must handle network failure, API rate limits, malformed responses, and missing fields with a useful local fallback. No secret API key may be required to run the default demo.

## Commands

```bash
pnpm install
pnpm dev
pnpm test
pnpm lint
pnpm build
```

## Code and UI quality bar

- Use semantic landmarks and headings so the story is readable without the chart.
- Every interactive element must be keyboard reachable, visibly focused, labeled, and usable at a narrow viewport.
- Keep the primary content path usable with JavaScript data calls disabled.
- Use Astryx components/tokens and a small number of domain-specific primitives; do not introduce a bespoke design system.
- Keep copy direct and evidence-led. Avoid unexplained “AI” claims, false precision, or causal language.
- Keep the initial bundle and dependency count appropriate for a public hackathon demo; no backend is needed for V1.

## Testing strategy

### Automated

- Unit tests for linear trend fitting, confidence intervals, Mann–Kendall screening, formatting, and NASA POWER response normalization.
- Component/behavior tests for selecting a variable and region, switching the analysis, loading/fallback states, and exposing the method and limitations.
- Build and lint in CI.

### Manual browser acceptance

1. Load the app with network available and verify the first-run briefing, variable/region selection, chart, verdict, and guided example.
2. Load with NASA POWER unavailable and verify the local fallback renders without blocking core use.
3. Verify keyboard-only navigation through the explorer and method surfaces.
4. Verify the layout at desktop and mobile widths.
5. Verify that every visible source link resolves and that the README demo path matches the UI.

## Boundaries

- Always: keep NASA and third-party sources visible; keep scientific limitations visible; preserve a no-network fallback; run tests and a production build before a release checkpoint; keep secrets out of the repository.
- Ask first: changing the selected NASA challenge; adding a paid service or required API key; adding authentication or a backend; changing the deployment target.
- Never: claim a trend is causal from prototype analysis alone; hide failed data loads; include private information; use unlicensed third-party visuals; remove failing tests to make CI green.

## Success criteria

- A first-time user can select a variable and region within 30 seconds.
- A user can answer what changed, where, and how much from one analysis surface.
- A user can explain what the significance screen does and does not prove.
- The app works with live NASA POWER data when available and remains demonstrable with the local fallback when it is not.
- `pnpm test`, `pnpm lint`, and `pnpm build` pass locally and in GitHub Actions.
- The repo is deployable as a public static site and includes NASA source citations, a license, AI-use disclosure, setup instructions, and a 3-minute demo narrative.
- The UI meets the NASA rubric dimensions above with a clear, judgeable prototype—not just a landing page or data dump.

## Scope correction

The initial foundation slice was drafted against a different 2026 challenge. The pasted official challenge prompt is the source of truth for this release, so the analog-site scope was replaced before the public release checkpoint. The retained foundation is the Astryx shell, typed React architecture, testing setup, source-first documentation, and no-network resilience pattern.
