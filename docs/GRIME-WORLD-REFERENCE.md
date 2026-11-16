# GRIME.world reference for Bilad

This file translates the public GRIME.world product and interface into an implementation reference for Claude Code. Use it as a design and product reference when improving Bilad. It is not a request to copy GRIME's branding, copy, domain model, or source code.

## Source and scope

- Product site: <https://grime.world/>
- Explorer: <https://grime.world/explore>
- Technical documentation: <https://grime.world/docs>
- Public source link shown by the site: <https://github.com/1inandy/GRIME>
- Reference inspected: 2026-11-15

The site presents GRIME as the **Garbage River Interception & Modeling Engine**, version 4, piloted on Ellerbe Creek in Durham, North Carolina. Its purpose is to identify and rank river locations where trash interception units should be deployed.

Bilad should borrow the same product qualities:

- an evidence-led operational atlas;
- a map or globe as the primary workspace;
- a compact control surface beside the map;
- visible provenance and validation;
- a strong difference between overview, exploration, and method documentation;
- an editorial visual system that makes technical analysis feel intentional.

Bilad should keep its own subject: Earth-system trends across nations. Do not replace Bilad's climate-analysis model with GRIME's trash-trap model.

## GRIME product model

GRIME turns geospatial observations into a ranked deployment recommendation.

1. Gather candidate places and geospatial parameters.
2. Apply hard feasibility gates.
3. Normalize available parameters and calculate four sub-scores.
4. Combine the sub-scores into a composite score.
5. Apply spatial constraints and upstream occlusion so nearby or downstream sites are not treated as independent opportunities.
6. Test whether rankings remain stable under perturbed weights.
7. Present the result in an interactive global explorer with a detailed methods page.

The public documentation reports 27 parameters, 6 parameter families, 4 sub-scores, 3 hard-gate categories, 89,518 places, 239 countries and territories, 460 pipeline-scored regions, and 10,822 sites. Treat these as GRIME's reported product figures, not Bilad requirements.

## GRIME's information architecture

### Landing page

The home page is a long-form narrative that moves from identity to evidence to exploration:

1. **Persistent header**
   - GRIME wordmark on the left.
   - Links for Docs and Explorer.
   - GitHub link on the far right.

2. **Hero**
   - Small metadata line: product name, version, and pilot location.
   - Oversized wordmark.
   - One short mission statement: rivers retain the evidence of what people discard, and the system identifies where to intercept it.
   - Primary action that opens the dashboard.
   - Large dark globe or sphere graphic with a bright teal atmospheric edge, sparse points, and thin network-like paths.
   - Vertical scroll cue at the right edge.

3. **Problem scale**
   - Large numeric facts about plastic entering aquatic ecosystems, unrecycled plastic, and plastic in the oceans.
   - Each statistic includes a source attribution.

4. **How it works**
   - Three sequential stages: Analyze, Deploy, Collect.
   - Each stage has a short label, a plain-language title, and a paragraph connecting the computation to the field decision.

5. **Validation**
   - Large proof numbers, such as agreement with observed trap sites and ranking robustness.
   - A link to the validation log or equivalent receipts.

6. **Global coverage**
   - Dataset scale and coverage claims.
   - Transition from narrative page to the Explorer.

7. **Footer**
   - Product identity, version, build location, awards, team, and source repository.

### Explorer

The Explorer is an application surface rather than a marketing page.

- A dark, map-first workspace fills most of the viewport.
- A contextual sidebar or rail holds search, mode, filters, ranking information, and the selected place.
- The top control row includes a map-data mode, a satellite toggle, a theme control, and the product version.
- A back control returns from a local city or place view to the global view.
- Search accepts cities and countries.
- The map is the primary interaction surface. Selecting a place or candidate updates the detail panel.
- The interface makes the distinction between global coverage, pipeline-scored regions, and shortlisted sites visible.
- Loading states are part of the product language. The Explorer explicitly communicates when global places or streams are loading.

The public text exposes a global map with 89,518 places and a city-level view with ranked candidate streams. The exact Explorer layout should be treated as a visual reference, not as a complete API contract.

### Docs

The Docs page is a technical reference, not a generic About page. It exposes the model in numbered sections:

1. Composite scoring.
2. Manning's equation and velocity feasibility.
3. Upstream occlusion and diminishing returns.
4. Candidate placement constraints.
5. Sensitivity analysis.
6. DEM hydrological processing.
7. Full parameter reference.

Each section combines a short explanation, formulas or pseudocode, implementation details, and supporting figures. The page also exposes navigation anchors so a reader can jump to a specific method.

## Visual language to carry into Bilad

### Color and contrast

- Use a near-black charcoal background instead of flat white.
- Use teal or mint as the primary active and data accent.
- Use warm ivory for high-priority text and muted khaki or gray for supporting copy.
- Reserve bright accents for active controls, data highlights, links, and validation numbers.
- Keep the map and visualizations darker than the surrounding text so the evidence is the focus.
- Avoid adding a large collection of unrelated accent colors.

The screenshot provides a visual direction, not verified design tokens. Tune Bilad's existing theme against the reference rather than copying guessed hex values.

### Typography

- Use a terminal or technical monospace treatment for metadata, product labels, version strings, navigation utilities, and small uppercase labels.
- Use a large, heavy display face for the hero wordmark and major numeric readouts.
- Use a restrained sans-serif or readable UI face for explanations and method text.
- Use wide letter spacing and uppercase for small metadata labels.
- Keep body paragraphs short and readable against the dark background.

### Geometry and surface treatment

- Prefer thin outlines and low-radius rectangular controls.
- Use generous negative space around hero content.
- Make the map/globe graphic large enough to become the page's visual anchor.
- Combine precise linework with one organic geographic shape, such as a globe edge, terrain contour, or river path.
- Use glow sparingly. It should define atmosphere or an active data layer, not turn every element into neon.
- Use small squares, dots, and thin paths as data texture. Decorative marks must never be mistaken for measured data.

### Motion

Use restrained motion:

- slow globe or atmospheric movement in the hero;
- gentle point or network animation for loading or live-data context;
- short transitions when changing map layers or selecting a place;
- no motion that prevents reading, selecting, or keyboard navigation.

Respect reduced-motion preferences. Motion is a layer over the information architecture, not the information itself.

## GRIME's model, extracted for reference

### Composite score

GRIME documents four top-level sub-scores:

| Sub-score | Weight | Question |
| --- | ---: | --- |
| Generation | 0.30 | How much trash enters the waterway here? |
| Flow transport | 0.25 | How does water move trash to this point? |
| Downstream impact | 0.30 | What is at stake downstream? |
| Feasibility | 0.15 | Can a collection unit be deployed here? |

Each available parameter is normalized within the candidate set. Missing parameter columns are removed and the remaining weights are renormalized. Distance-like parameters are inverted so that closer is better. The composite is the weighted sum of the four sub-scores after hard gates.

This is a useful pattern for Bilad: make the aggregation visible, state the reference population used for normalization, and explain how missing inputs affect the result.

### Hydrology and physical feasibility

GRIME estimates velocity with Manning's open-channel equation and cross-checks it with discharge divided by channel cross-sectional area. The documented implementation uses a rectangular approximation, a bankfull depth related to channel width, local DEM slope, and a roughness coefficient. The final estimate combines the two velocity estimates geometrically.

The system uses physical feasibility as a gate and as a score. The documentation describes an upper velocity gate at 3.0 m/s, a preferred operating range, and channel-width limits. The home page and technical documentation do not state identical width ranges, so do not copy a single number without checking the current implementation.

### Upstream occlusion

The key interaction model is diminishing return along the same waterway. A selected upstream unit reduces the trash available to downstream candidates. GRIME uses a catch-efficiency parameter of 0.65 and greedily re-ranks candidates after each selection. This causes the system to distribute placements across waterways instead of selecting several nearby points on one stream.

For Bilad, the transferable lesson is to make dependent selections visibly affect one another. If Bilad adds comparison cells, regions, or evidence items, show the relationship instead of presenting every item as an independent card.

### Placement constraints

The documented placement model includes:

- different spacing rules for same-stream and cross-stream candidates;
- geodesic distance calculations;
- exclusion of unsuitable underground segments;
- portal candidates at entrances and exits of eligible culverts;
- waterway-type penalties and bonuses;
- minimum way length rules;
- intermittency filtering;
- per-fetch quality limits so later map pans do not bypass the initial quality bar.

This is a model of explicit constraints. Bilad should use the same clarity for analysis limits: show the time window, spatial resolution, missing-data treatment, significance rule, and provenance near the result.

### Robustness and validation

GRIME uses Dirichlet perturbations of the four sub-score weights to measure how often top-ranked candidates remain near the top. It also exposes validation receipts comparing candidates with observed trap sites and provides a validation log.

For Bilad, prioritize:

- a visible validation section on the home page;
- a methods page with formulas and assumptions;
- independent data cross-checks;
- a clear distinction between a shipped figure, a recomputed figure, and an interpretation;
- links to the underlying source or validation record.

## Bilad implementation translation

Use GRIME's structure as a reference for Bilad's existing national atlas.

### Bilad home page

Adapt the GRIME landing sequence as follows:

1. **Identity**: Bilad, version or data window, and the NASA Space Apps challenge.
2. **Hero statement**: a short explanation that Bilad finds where Earth-system variables changed and whether the pattern survives statistical and independent-record checks.
3. **Scale facts**: nations, grid cells, years, variables, and validated case studies. Every value needs a source or a clear statement that it is a shipped dataset count.
4. **How it works**: Acquire, deseasonalize, test, cross-check, and explain.
5. **Validation**: Chile megadrought and the independent-record comparisons.
6. **Global or national coverage**: the countries currently shipped and the path to the Atlas.

### Bilad Atlas

Keep the map as the dominant surface and place controls in a compact rail:

- country selector;
- variable selector;
- layer selector for trend, significance, emergence, change point, or compound hot-dry signal;
- analysis-window controls;
- legend and units;
- selected nation, cell, or latitude-band detail;
- source and provenance information.

The selected map item should update the detail panel without losing the surrounding map context. Prefer one dense evidence panel over a gallery of decorative cards.

### Bilad method page

Follow GRIME's numbered technical-documentation model. Keep sections linkable and use formulas, implementation notes, assumptions, and source links. Include the claims Bilad does not make: no causal attribution, no forecast, and no precision below the source grid.

### Bilad technical constraints

- Continue using the existing Vite, React, TypeScript, Astryx, and SVG visualization stack.
- Keep the current national data pipeline and TypeScript statistics engine as the source of Bilad behavior.
- Use Astryx components and theme tokens for layout, controls, typography, and status treatments.
- Do not introduce a second visual system or a new mapping framework only to imitate GRIME.
- Preserve keyboard access, reduced-motion support, readable headings, and narrow viewport behavior.
- Keep data-derived marks distinct from atmospheric decoration.
- Make failure, incomplete data, and fallback behavior visible.

## Suggested build order for a GRIME-inspired Bilad refresh

1. Define the dark atlas theme and typography tokens in the existing Bilad theme.
2. Rework the home page into the identity, evidence, method, validation, and Atlas sequence.
3. Make the Atlas map the dominant viewport and consolidate controls into a clear rail.
4. Add subtle globe/map atmosphere and loading transitions without changing the analysis model.
5. Add provenance and validation receipts beside the relevant figures.
6. Rework the Method page into numbered, linkable technical sections.
7. Verify desktop and narrow layouts, keyboard navigation, reduced motion, and Astryx doctor output.

## Do not copy

- GRIME's wordmark, exact logo treatment, or exact text.
- GRIME's trash, river, deployment, or plastic facts as Bilad content.
- GRIME's parameter weights or physical thresholds as climate-analysis logic.
- Unverified pixel values inferred from a screenshot.
- Decorative globe points or paths as if they were measured climate observations.
- A generic dashboard full of cards. GRIME's strongest pattern is the relationship between the map, the control rail, and the evidence detail.

## Reference links

- [GRIME home](https://grime.world/)
- [GRIME Explorer](https://grime.world/explore)
- [GRIME technical documentation](https://grime.world/docs)
- [GRIME validation log](https://github.com/1inandy/GRIME/blob/main/VALIDATION_LOG.md)
