# NASA Space Apps submission notes

## Project page links

- **Link to Project Demo:** [Six-slide English demo](https://michaelcruzat.github.io/Bilad/bilad-demo.pdf)
- **Link to Final Project:** [Bilad live site](https://michaelcruzat.github.io/Bilad/)
- **Code:** [Bilad on GitHub](https://github.com/MichaelCruzat/Bilad)

Use these in the team’s Project tab and complete the remaining form fields before submitting for judging. The [2026 Project Submission Guide](https://www.spaceappschallenge.org/resources/project-submission-guide/) covers the form, judging criteria, and deadline.

## Challenge alignment

Bilad addresses **Be An Earth System Trend Detective!** by making the investigation path explicit:

1. Select a variable.
2. Select a primary point and an optional comparison point.
3. Visualize annual means as absolute values or change from a 2000–2004 reference.
4. Quantify the fitted trend.
5. Screen whether the pattern is statistically meaningful.
6. Explain what the result does and does not prove.

## Judge walkthrough

Open the [Bilad live site](https://michaelcruzat.github.io/Bilad/) and use the default Atacama / Canadian Arctic surface-temperature comparison. GitHub Actions publishes pushes to `main` after the checks pass.

- The briefing names the challenge and frames the four questions.
- The variable card defines the selected NASA POWER parameter and unit.
- The field index makes "where" explicit and shows that a coordinate is a screening point, not a whole ecosystem.
- The chart shows complete-year means and fitted monthly-data trends. Open “Annual values and missing years” for the accessible values and any gaps. The baseline-relative switch makes regional changes comparable while the absolute view preserves measured levels or synthetic demo levels, as labeled.
- Two readouts summarize change per year, an approximate confidence interval, Mann–Kendall p-value, R², usable coverage, each location's source, and the exact NASA request when live.
- The method section explains the five-year reference, annual-mean screening, the live endpoint, the deterministic fallback, and the limits of causal interpretation.

Then switch variables or regions to show that the same scientific workflow generalizes across Earth-system contexts. The field illustration is original and its curves are schematic; it does not reproduce the visual reference or claim to map measured patterns.

## Data notes

NASA POWER is a public NASA data service. Bilad requests monthly point data for one variable at each selected location using a latitude, longitude, start year, end year, and JSON format. The default window is 2000–2024 so the prototype has a stable long time series while remaining light enough for a browser demo.

The live response is normalized in `src/lib/nasaPower.ts`. Bilad checks the declared NASA unit, removes invalid values and missing-data sentinels, and converts solar MJ/m²/day to kWh/m²/day. Annual means require all 12 months. A live result needs at least 80% complete years in the requested window. Below that threshold, the affected point uses labeled demo data. Each request has a 25-second limit and can be retried while the other point finishes independently.

NASA POWER reports the underlying product names in each response. The solar series crosses the SRB-to-SYN1DEG transition at January 2001, inside the five-year visual reference; see [NASA POWER's source notes](https://power.larc.nasa.gov/docs/methodology/communities/). The app links to the exact point request for reproduction.

## Limitations

- A single point is not a complete regional or global analysis.
- A linear slope and Mann–Kendall screen do not establish causation.
- NASA POWER blends model and observational inputs depending on the parameter and period.
- The fallback series is synthetic demo data and must never be described as an observation.
- The 2000–2004 reference is a short visual baseline, not a climate normal. If either point lacks any of its five reference years, Bilad falls back to absolute values and says so.
- The approximate slope interval assumes independent monthly residuals, which may not hold. It can disagree with the annual Mann–Kendall screen.
- Scientific users should inspect the underlying NASA data product and perform domain-specific quality control before drawing conclusions.

## AI disclosure

AI assistance was used for development scaffolding, implementation support, test drafting, documentation, and review. Human responsibility remains with the project team for the final code, source interpretation, scientific language, and submission.
