# Bilad

Bilad is an Earth System Trend Detective for NASA Space Apps 2026.

**Live site:** [michaelcruzat.github.io/Bilad](https://michaelcruzat.github.io/Bilad/) · [Six-slide judging demo](https://michaelcruzat.github.io/Bilad/bilad-demo.pdf). Pushes to `main` deploy through GitHub Actions after the project checks pass.

It helps a user compare one Earth-system variable at two locations, inspect 25 years of NASA POWER monthly data, estimate change per year, and check whether the pattern passes a statistical screen. Its first-run series is synthetic demo data, plainly labeled until live data is loaded.

## NASA challenge

Bilad responds to [Be An Earth System Trend Detective!](https://www.spaceappschallenge.org/2026/challenges/earth-system-trend-detective/).

The product is designed around the challenge's four questions:

- What is changing?
- Where is it changing?
- How much is it changing?
- Is the change statistically significant?

## Run locally

Requires Node.js 22+ and pnpm 11+. The optional asset-size checks use Python 3.9+.

    pnpm install
    pnpm dev

Quality checks:

    pnpm test
    pnpm lint
    pnpm build
    python3 -m unittest discover -s tests -p 'test_*.py'
    python3 scripts/bundle_budget.py

The app does not require a secret or backend. Once the page has loaded, the deterministic demo data remains usable if the NASA endpoint is unavailable. A first visit to the hosted site still needs a connection to download the page. "Load NASA POWER data" requests the public monthly endpoint for both selected locations; each result keeps its own live/demo source label.

The browser app uses TypeScript for the interactive analysis. A small, standard-library-only Python check measures the built JavaScript and CSS assets; CI rejects a large size regression. The GitHub Actions YAML runs both sets of checks and deploys the static HTML site. Successful NASA POWER requests are reused during a page session, while failures can be retried.

## Three-minute demo

1. Start with the default surface-temperature question: Atacama Desert versus Canadian Arctic.
2. Open the investigation desk. The field index shows each point coordinate; the comparison selector changes the second location.
3. Read the baseline-relative annual chart, open its annual-value table, then switch to absolute values to see the different temperature levels.
4. Load NASA POWER data. Check each source, complete-year count, NASA product, and exact request before interpreting the slopes, confidence intervals, and Mann–Kendall screens.
5. Read the method: a point is not a regional average, the five-year baseline is not a climate normal, and a detected trend does not establish its cause.

## Data and method

The prototype uses three NASA POWER variables:

- **Surface temperature (T2M)** — average air temperature at 2 meters, shown in °C.
- **Precipitation (PRECTOTCORR)** — bias-corrected average daily precipitation, shown in mm/day.
- **Solar energy (ALLSKY_SFC_SW_DWN)** — all-sky surface shortwave downward radiation. NASA POWER returns MJ/m²/day; Bilad divides by 3.6 and shows kWh/m²/day.

The analysis:

1. Fits an ordinary least-squares line to monthly observations from complete 12-month years. A live result needs at least 80% of the requested years. Below that threshold, the affected point uses labeled demo data.
2. Plots complete-year means either as absolute values or as differences from each location's 2000–2004 annual mean. Gaps remain gaps, and a table exposes every annual value. The five-year reference is a visual baseline, not a climate normal.
3. Reports the slope per year and an approximate 95% confidence interval. The interval assumes independent monthly residuals, an assumption climate data may violate.
4. Applies a Mann–Kendall monotonic-trend screen to annual means so repeating seasonal cycles do not dominate the screen. This screen and the slope interval can disagree.
5. Labels the result as a screening analysis, not a causal explanation, forecast, or scientific-grade conclusion.

If the public endpoint is unavailable, Bilad uses a deterministic, clearly labeled demo series. The fallback is there to keep the investigation judgeable; it is not presented as NASA data.

NASA POWER identifies its solar source products as SRB and SYN1DEG across this window; the [NASA POWER source documentation](https://power.larc.nasa.gov/docs/methodology/communities/) places the transition at January 2001, inside the short reference period. Bilad shows the products reported by each response and a link to the exact request. The transition is a reason to inspect the underlying product before making a scientific claim.

## NASA and source citations

- [NASA Space Apps 2026 home](https://www.spaceappschallenge.org/2026/)
- [NASA Space Apps project submission guide](https://www.spaceappschallenge.org/resources/project-submission-guide/)
- [NASA challenge statement](https://www.spaceappschallenge.org/2026/challenges/earth-system-trend-detective/)
- [NASA POWER](https://power.larc.nasa.gov/)
- [NASA POWER monthly API documentation](https://power.larc.nasa.gov/docs/services/api/temporal/monthly/)
- [NASA POWER temporal API overview](https://power.larc.nasa.gov/docs/services/api/temporal/)
- [NASA Earthdata](https://www.earthdata.nasa.gov/)
- [NASA Space Apps terms and conditions](https://www.spaceappschallenge.org/legal/)

The coordinate-field illustration is original SVG artwork. Its sample points reflect catalog coordinates; its curves are schematic, not measured geospatial data. The UI system is Astryx as included in the project dependencies. No artwork or copy was taken from the visual reference site.

## NASA rubric mapping

- **Impact:** makes Earth-system trend questions legible to students, educators, and the public.
- **Creativity:** uses an original field-atlas visual language and lets users compare both absolute values and baseline-relative change.
- **Validity:** shows the source, parameter, coordinate, time window, sample count, fitted slope, confidence interval, and significance screen.
- **Relevance:** directly follows the selected NASA challenge questions.
- **Presentation:** opens with a complete two-location example and a three-minute field guide; once loaded, it remains usable during a NASA endpoint outage.

## AI-use disclosure

AI assistance was used during development for code scaffolding, interface iteration, documentation drafting, test cases, and repository review. The project team remains responsible for the implementation, source choices, scientific framing, and final submission. NASA data and NASA documentation are credited directly in the app and this README.

## License

Bilad is released under the Apache License 2.0. See LICENSE.
