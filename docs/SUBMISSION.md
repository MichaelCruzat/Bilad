# NASA Space Apps submission notes

## Challenge alignment

Bilad addresses **Be An Earth System Trend Detective!** by making the investigation path explicit:

1. Select a variable.
2. Select a region.
3. Visualize its change over time.
4. Quantify the fitted trend.
5. Screen whether the pattern is statistically meaningful.
6. Explain what the result does and does not prove.

## Judge walkthrough

Open the app and use the default Atacama / surface-temperature example.

- The briefing names the challenge and frames the four questions.
- The variable card defines the selected NASA POWER parameter and unit.
- The region cards make "where" explicit and show that a coordinate is a screening point, not a whole ecosystem.
- The evidence chart shows monthly observations and a fitted line.
- The cards summarize change per year, an approximate confidence interval, Mann–Kendall p-value, and R².
- The method card explains annual-mean screening, the live endpoint, the deterministic fallback, and the limits of causal interpretation.

Then switch variables or regions to show that the same scientific workflow generalizes across Earth-system contexts.

## Data notes

NASA POWER is a public NASA data service. Bilad requests monthly point data for one variable at a time using a latitude, longitude, start year, end year, and JSON format. The default window is 2000–2024 so the prototype has a stable long time series while remaining light enough for a browser demo.

The live response is normalized in src/lib/nasaPower.ts. Invalid values and NASA POWER missing-data sentinels are removed. A response with fewer than three usable observations is treated as unavailable and the app keeps the deterministic fallback visible.

## Limitations

- A single point is not a complete regional or global analysis.
- A linear slope and Mann–Kendall screen do not establish causation.
- NASA POWER blends model and observational inputs depending on the parameter and period.
- The fallback series is synthetic demo data and must never be described as an observation.
- Scientific users should inspect the underlying NASA data product and perform domain-specific quality control before drawing conclusions.

## AI disclosure

AI assistance was used for development scaffolding, implementation support, test drafting, documentation, and review. Human responsibility remains with the project team for the final code, source interpretation, scientific language, and submission.
