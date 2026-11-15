# Bilad

Bilad is an Earth System Trend Detective for NASA Space Apps 2026.

It helps a user select an Earth science variable and region, visualize a long-enough monthly time series, estimate how much the variable changes per year, and screen whether the pattern is statistically meaningful.

## NASA challenge

Bilad responds to [Be An Earth System Trend Detective!](https://www.spaceappschallenge.org/2026/challenges/earth-system-trend-detective/).

The product is designed around the challenge's four questions:

- What is changing?
- Where is it changing?
- How much is it changing?
- Is the change statistically significant?

## Run locally

Requires Node.js 22+ and pnpm 11+.

    pnpm install
    pnpm dev

Quality checks:

    pnpm test
    pnpm lint
    pnpm build

The app does not require a secret or backend. It opens with deterministic demo data so the story still works offline. The "Load NASA POWER data" action requests the public NASA POWER monthly endpoint for the selected variable and region.

## Three-minute demo

1. Start on the default Atacama temperature example.
2. Read the chart and the four evidence cards: direction, change per year, Mann–Kendall screen, and linear fit.
3. Switch to another variable, then inspect the Amazon Basin or Canadian Arctic.
4. Load NASA POWER data to replace the fallback series with the public monthly response.
5. Open "The detective's method" to see the parameter, coordinate, confidence interval, significance screen, source links, and the limits of the conclusion.

## Data and method

The prototype uses three NASA POWER variables:

- **Surface temperature (T2M)** — average air temperature at 2 meters, shown in °C.
- **Precipitation (PRECTOTCORR)** — bias-corrected average daily precipitation, shown in mm/day.
- **Solar energy (ALLSKY_SFC_SW_DWN)** — all-sky surface shortwave downward radiation, shown in kWh/m²/day.

The analysis:

1. Fits an ordinary least-squares line to the monthly observations.
2. Reports the slope per year and an approximate 95% confidence interval.
3. Applies a Mann–Kendall monotonic-trend screen to annual means so repeating seasonal cycles do not dominate the screen.
4. Labels the result as a screening analysis, not a causal explanation, forecast, or scientific-grade conclusion.

If the public endpoint is unavailable, Bilad uses a deterministic, clearly labeled demo series. The fallback is there to keep the investigation judgeable; it is not presented as NASA data.

## NASA and source citations

- [NASA Space Apps 2026 home](https://www.spaceappschallenge.org/2026/)
- [NASA challenge statement](https://www.spaceappschallenge.org/2026/challenges/earth-system-trend-detective/)
- [NASA POWER](https://power.larc.nasa.gov/)
- [NASA POWER monthly API documentation](https://power.larc.nasa.gov/docs/services/api/temporal/monthly/)
- [NASA POWER temporal API overview](https://power.larc.nasa.gov/docs/services/api/temporal/)
- [NASA Earthdata](https://www.earthdata.nasa.gov/)
- [NASA Space Apps terms and conditions](https://www.spaceappschallenge.org/legal/)

Icons are provided by [Heroicons](https://heroicons.com/) and used under the MIT license. The UI system is Astryx as included in the project dependencies.

## NASA rubric mapping

- **Impact:** makes Earth-system trend questions legible to students, educators, and the public.
- **Creativity:** turns statistical analysis into a guided detective workflow with an explicit verdict and limitations.
- **Validity:** shows the source, parameter, coordinate, time window, sample count, fitted slope, confidence interval, and significance screen.
- **Relevance:** directly follows the selected NASA challenge questions.
- **Presentation:** opens with a complete example and remains usable with no network connection.

## AI-use disclosure

AI assistance was used during development for code scaffolding, interface iteration, documentation drafting, test cases, and repository review. The project team remains responsible for the implementation, source choices, scientific framing, and final submission. NASA data and NASA documentation are credited directly in the app and this README.

## License

Bilad is released under the Apache License 2.0. See LICENSE.
