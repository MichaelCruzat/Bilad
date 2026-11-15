# Spec: Bilad — Earth Analogs for the Next Frontier V1

Status: proposed

## Objective

Build a public, deployment-ready web application for the 2026 NASA Space Apps Challenge challenge [Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars](https://www.spaceappschallenge.org/2026/challenges/permanent-moon-base-locations-and-mars/).

Bilad helps mission planners, educators, and curious members of the public answer one question: **Where on Earth can we rehearse living beyond Earth?** It combines a curated set of terrestrial analog locations with NASA Earth observations and planetary context, then makes the reasoning visible instead of presenting a mysterious ranking.

The experience must feel like a mission briefing rather than a generic dashboard:

1. Start with a short, visual explanation of the Earth-analog problem.
2. Choose a Moon or Mars mission profile and adjust priorities such as aridity, temperature range, solar availability, terrain, and isolation.
3. Explore a map and ranked candidate cards.
4. Open a candidate to see the evidence, NASA-derived live weather/solar context, confidence, limitations, and relevant planetary analog.
5. Compare up to three candidates and produce a concise mission rehearsal brief.
6. Switch to a guided “judge mode” that demonstrates the core story in roughly three minutes.

### Users

- Mission-planning and Earth-science audiences who need an interpretable starting point for analog-site research.
- Educators and students who need a tactile way to understand why Earth analogs matter.
- NASA Space Apps judges who should be able to see the problem, data, method, prototype, and impact without a walkthrough from the team.

## NASA alignment and submission compliance

The project will explicitly map its experience to the current Space Apps expectations:

| Criterion | Bilad evidence |
| --- | --- |
| Impact | Makes difficult Earth/Moon/Mars analog research legible to mission teams, educators, and the public; frames terrestrial testing as a step toward safer exploration. |
| Creativity | Treats analog discovery as a mission rehearsal: users tune priorities, see how the ranking changes, and leave with a testable field brief. |
| Validity | Uses NASA-sourced data where available, shows the scoring dimensions, reports data freshness and uncertainty, and labels the prototype as a screening aid rather than a landing-site recommendation. |
| Relevance | Names the selected NASA challenge in the product, README, and demo narrative; candidate profiles are tied to lunar/Martian operational analog questions. |
| Presentation | Provides a guided judge mode, a clear first-run story, accessible visual hierarchy, and a README with a 3-minute demo script. |

The repository and product must also satisfy the current NASA terms and project-submission expectations:

- Cite every NASA, third-party, open-source, image, map, and icon source used.
- Include license documentation for original project materials and third-party dependencies.
- Include a clear AI-use disclosure in the project documentation and submission copy.
- Do not include private or personally identifying information.
- Keep the demo runnable from a public GitHub repository with no paid service or secret required.

Primary references:

- [2026 NASA Space Apps home](https://www.spaceappschallenge.org/2026/)
- [Official challenge statement](https://www.spaceappschallenge.org/2026/challenges/permanent-moon-base-locations-and-mars/)
- [NASA Space Apps terms and conditions](https://www.spaceappschallenge.org/legal/)
- [NASA Space Apps awards context](https://www.spaceappschallenge.org/2025/awards/)

## Product scope

### In scope for V1

- A single responsive web experience with a strong landing/briefing state and clear navigation between discovery, comparison, method, and about/source views.
- A curated candidate dataset for terrestrial analogs, including at least six locations spanning arid, polar, volcanic, and cratered terrains. Each candidate has coordinates, target profile, short narrative, evidence dimensions, data-quality notes, and sources.
- Moon and Mars profile presets with transparent weighted scoring. Users can alter the weights and immediately see the ranking change.
- A map view with candidate markers, selected-site focus, keyboard-accessible candidate list, and a non-map fallback so core content is usable if tiles or network data fail.
- Live NASA POWER retrieval for the selected candidate’s recent solar/temperature/precipitation context, with a cached/local fallback and explicit “prototype snapshot” labeling when live data is unavailable.
- Candidate detail view: “why it matches,” “what it does not prove,” evidence cards, data freshness, source links, and a compact mission rehearsal prompt.
- Compare view for up to three candidates with aligned dimensions, trade-offs, and a shareable/exportable mission brief.
- Guided judge mode that walks through the problem, method, one candidate, a comparison, and the impact in roughly three minutes.
- README, license, source registry, AI-use disclosure, local setup instructions, GitHub Pages deployment workflow, and a manual demo script.

### Deferred to V2

- User accounts, server-side persistence, collaboration, or team workspaces.
- Full global raster analysis, machine-learning classification, or scientific-grade landing-site recommendations.
- Offline map tile packaging and a native mobile app.
- Integration with restricted, credentialed, or rate-limited NASA services that would make the public demo fragile.

## Technical approach

### Stack

- Vite + React + TypeScript for a static, GitHub Pages-friendly client.
- Astryx as the UI system and component source of truth. The implementation will start from an Astryx template, use Astryx tokens/components for layout and controls, and avoid one-off visual primitives where the library provides an equivalent.
- A lightweight map adapter (MapLibre or Leaflet, selected after checking the installed Astryx/Vite compatibility) with a non-map candidate-list fallback.
- Vitest for deterministic scoring/data utilities and a small set of UI behavior tests.
- Browser smoke testing through the available browser automation surface; the agent-browser CLI is preferred when installed, otherwise the same user flows will be verified through the available browser surface.
- GitHub Actions to build the static site and deploy the `dist` artifact to GitHub Pages.

### Project structure

```text
src/
  app/              Application shell and route-level composition
  components/       Astryx-based shared UI pieces
  data/             Candidate profiles, planetary profiles, source registry
  features/
    discovery/      Map, filters, ranking, candidate cards
    comparison/     Side-by-side comparison and mission brief
    briefing/       Guided judge mode and narrative states
    provenance/     Method, sources, limitations, data freshness
  lib/              Scoring, NASA POWER client, formatting, resilience helpers
  styles/           Astryx initialization/theme glue only
tests/              Unit and behavior tests
public/             Static metadata/icons only; no build output
docs/               Submission narrative, demo script, data notes
```

### Data model and scientific honesty

Each candidate is a screening profile, not a definitive site recommendation. The score is a decision aid with an explicit formula, visible dimensions, and a confidence note. Live NASA POWER fields are separated from curated analog context, and the UI must never imply that a single weather time series proves geological or operational equivalence.

Planned source families:

- NASA challenge statement for the analog-site framing.
- NASA POWER for point-based solar radiation, temperature, and precipitation context.
- NASA Earthdata / mission documentation for Earth observation context and future data-expansion notes.
- NASA planetary mission/terrain documentation for Moon/Mars comparison context.
- Open map tiles and geospatial libraries, cited and attributed in the repository.

The client must handle network failure, API rate limits, malformed responses, and missing fields with a useful local fallback. No secret API key may be required to run the default demo.

## Commands

These commands are the target contract; they may be adjusted to the exact package manager after Astryx initialization:

```bash
pnpm install
pnpm dev
pnpm test
pnpm lint
pnpm build
```

## Code and UI quality bar

- Use semantic landmarks and headings so the story is readable without the map.
- Every interactive element must be keyboard reachable, visibly focused, labeled, and usable at a narrow viewport.
- Keep the primary content path usable with JavaScript data calls disabled.
- Use Astryx components/tokens and a small number of domain-specific primitives; do not introduce a bespoke design system.
- Keep copy direct and evidence-led. Avoid unexplained “AI” claims, false precision, or science-fiction framing that obscures the actual prototype.
- Keep the initial bundle and dependency count appropriate for a public hackathon demo; no backend is needed for V1.

## Testing strategy

### Automated

- Unit tests for weight normalization, score calculation, profile switching, sorting, formatting, and NASA POWER response normalization.
- Component/behavior tests for selecting a candidate, changing the mission profile, changing weights, comparing candidates, loading/fallback states, and generating a mission brief.
- Build and lint in CI.

### Manual browser acceptance

1. Load the app with network available and verify the first-run briefing, map/list discovery, candidate detail, comparison, and judge mode.
2. Load with NASA POWER unavailable and verify the local fallback renders without blocking core use.
3. Verify keyboard-only navigation through the discovery and comparison flows.
4. Verify the layout at desktop and mobile widths, including the non-map list view.
5. Verify that every visible source/attribution link resolves and that the README demo path matches the UI.

## Boundaries

- Always: keep NASA and third-party sources visible; keep scientific limitations visible; preserve a no-network fallback; run tests and a production build before a release checkpoint; keep secrets out of the repository.
- Ask first: changing the selected NASA challenge; adding a paid service or required API key; adding authentication or a backend; changing the deployment target; pushing to GitHub.
- Never: claim a site is scientifically validated from prototype scores alone; hide failed data loads; include private information; use unlicensed third-party visuals; remove failing tests to make CI green.

## Success criteria

- A first-time user can understand the problem and select a Moon or Mars mission profile within 30 seconds.
- A user can identify and inspect at least six terrestrial analog candidates without reading the README.
- A user can explain why the top candidate ranked highly, what data supports that explanation, and what the score does not prove.
- A user can compare up to three sites and produce a mission rehearsal brief in under two minutes.
- The app works with live NASA POWER data when available and remains demonstrable with the local fallback when it is not.
- `pnpm test`, `pnpm lint`, and `pnpm build` pass locally and in GitHub Actions.
- The repo is deployable as a public static site and includes NASA source citations, a license, AI-use disclosure, setup instructions, and a 3-minute demo narrative.
- The UI meets the NASA rubric dimensions above with a clear, judgeable prototype—not just a landing page or a data dump.

## Open questions

- Confirm the local event/team’s final challenge selection if it differs from the official analog-site challenge assumed here.
- Confirm whether the team wants an explicit Arabic/English bilingual mode; the product name supports it, but adding a full localization layer would be a separate scope decision.
