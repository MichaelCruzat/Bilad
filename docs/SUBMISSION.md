# NASA Space Apps submission notes

## Project page links

- **Final project:** [TRACE live site](https://michaelcruzat.github.io/TRACE/)
- **Code:** [TRACE on GitHub](https://github.com/MichaelCruzat/TRACE)
- **Demo:** `public/trace-demo.pdf`, captured from the current build (data window 1981–2024). The three-minute walkthrough below is the script.

Complete the remaining fields in the team's Project tab using the [2026 Project Submission Guide](https://www.spaceappschallenge.org/resources/project-submission-guide/).

## One-paragraph summary

TRACE is a global Earth-system trend detective: it covers every land cell from 60°S to 84°N, with seven nations in full detail. It maps 44 years of NASA POWER (MERRA-2) data across the globe, cell by cell, and tests every trend with methods built for autocorrelated climate records: Theil–Sen slopes, Hamed–Rao-corrected Mann–Kendall tests, and false-discovery control across the map. It then checks whether each change is real: each trend faces a ramp-or-jump integrity screen and is cross-examined against an independent NASA record (GISTEMP v4 stations, GPCP v2.3 precipitation) on the same footprint. The casebook shows four outcomes. Central Chile's post-2010 rainfall loss is corroborated. Chile's coast and Andes diverge at a scale no witness can resolve. Kenya's warming is real but underestimated. Bangladesh's statistically significant "cooling" is contradicted by stations and flagged as a data artefact. The Python pipeline is nation-agnostic: one registry line and one command add a country.

## Three-minute walkthrough

1. **Home (0:00–0:30).** Introduce TRACE: Tracking Regional Atmospheric Change on Earth. Show the worldwide coverage, 1981–2024 window, and latitude limits. Scroll the evidence trail: the same globe moves from reanalysis to station estimates to agreement. Pick any land cell or choose Explore the world. No country is preselected.
2. **Explore (0:30–1:15).** Search for India on the worldwide grid. Show the weak reanalysis warming against stronger station warming, the uncertainty, and the witness verdict. This country has no supplemental monthly pack; its evidence still works globally.
3. **Global walkthrough (1:15–2:00).** Select Canada and rainfall in How we know. Follow the footprint, baseline, trend estimate, significance, jump check, and GPCP comparison. State the shared-gauge limitation and distinguish global map FDR from a test of the area-average series.
4. **One cell (2:00–2:40).** Pick a cell in Explore. Its evidence is for one cell, not the containing country. Copy the exact URL and download its evidence. Explain what an agency analyst could inspect or pass on for further review.
5. **A warning worth investigating (2:40–3:00).** Optionally open Case 03: Bangladesh's significant cooling is contradicted by stations and flagged for investigation. Close on Method and the validation limits. This is evidence screening; policy outcomes and institutional adoption are not claimed.

## Coverage

Every land cell from 60°S to 84°N (54,425 cells, 223 countries) for temperature and rainfall, plus seven featured nations with all seven variables: Bangladesh, Chile, Kenya, Mexico, Morocco, the Philippines and Spain.

## Challenge alignment

| Challenge question | Where TRACE answers it |
|---|---|
| What is changing? | Seven NASA POWER variables across atmosphere, hydrosphere and land surface |
| Where? | A gridded atlas for each nation, latitude bands, single cells, named regions |
| How much? | Theil–Sen slope per decade with a 95% interval; signal-to-noise; months that change most |
| Is it significant? | Hamed–Rao-corrected Mann–Kendall per series; Benjamini–Hochberg across the map; start-year sensitivity; years until significant |
| Is it real? (added) | BIC ramp-versus-jump screen, co-breaks across variables, independent NASA witness |

## Data notes

- NASA POWER monthly regional API, MERRA-2 native 0.5° × 0.625°, 1981–2024. Each request URL is kept in `meta.json` and shown in the atlas.
- GISTEMP v4 (250 km, land stations) and GPCP v2.3 monthly, sampled at the centre of each TRACE cell and averaged with TRACE's land-area weights.
- No key, backend or account is needed; the shipped data is static.

## Compliance

- NASA and third-party sources are credited in the app footer, the Method page, each case file and the README.
- Original code and documentation are under Apache 2.0. Boundaries are Natural Earth (public domain) via world-atlas.
- AI assistance is disclosed in the README.
- No personal data is collected; the site sets no cookies and requests nothing beyond its own static files and its web font.
