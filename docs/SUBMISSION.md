# NASA Space Apps submission notes

## Project page links

- **Final project:** [Bilad live site](https://michaelcruzat.github.io/Bilad/)
- **Code:** [Bilad on GitHub](https://github.com/MichaelCruzat/Bilad)
- **Demo:** the six-slide PDF in `public/bilad-demo.pdf` shows the previous version and needs re-recording before submission. The three-minute walkthrough below is the script.

Complete the remaining fields in the team's Project tab using the [2026 Project Submission Guide](https://www.spaceappschallenge.org/resources/project-submission-guide/).

## One-paragraph summary

Bilad is an Earth-system trend detective built to run for any nation (six are shipped). It maps 44 years of NASA POWER (MERRA-2) data across a country, cell by cell, and tests every trend with methods built for autocorrelated climate records: Theil–Sen slopes, Hamed–Rao-corrected Mann–Kendall tests, and false-discovery control across the map. It then asks a fifth question the challenge implies: is the change real? Each trend faces a ramp-or-jump integrity screen and is cross-examined against an independent NASA record (GISTEMP v4 stations, GPCP v2.3 precipitation) on the same footprint. The casebook shows four verdicts. Central Chile's post-2010 rainfall loss is corroborated. Chile's coast and Andes diverge at a scale no witness can resolve. Kenya's warming is real but underestimated. Bangladesh's statistically significant "cooling" is contradicted by stations and flagged as a dataset artefact. The Python pipeline is nation-agnostic: one registry line and one command add a country.

## Three-minute walkthrough

1. **Casebook (0:00–0:30).** Read the headline, "Central Chile has had 23–34% less rain since 2010. Bangladesh did not cool." Both trends come from the same NASA reanalysis and both pass a standard significance test; only one holds up against an independent record. Point at the map: Chile's rainfall trend, central Chile highlighted, stippled where it survives false-discovery control.
2. **Case 01 (0:30–1:15).** Claim, evidence, then cross-examination: GPCP, a partly independent gauge-and-satellite record, agrees (−11.2% versus −17.1% of normal per decade; 23% versus 34% less rain in 2010–19). Verdict: supported.
3. **Case 03 (1:15–2:00).** The reanalysis cools Bangladesh by −0.19 °C per decade, p = 0.03. The integrity screen shows a jump in 1997 rather than a ramp, with several variables jumping together, and GISTEMP shows +0.35 °C per decade. Verdict: a likely artefact. This is why the witness is not optional.
4. **Atlas (2:00–2:40).** Switch to Mexico, then rainfall. Drag on the latitude profile to define a band; click a cell; show the season clock and the start-year sensitivity chart. Every URL is shareable.
5. **Any nation (2:40–3:00).** Show the six-nation table and `make data NATIONS=…`. Close on the method page and the CI check that recomputes every headline in a second language.

## Challenge alignment

| Challenge question | Where Bilad answers it |
|---|---|
| What is changing? | Seven NASA POWER variables across atmosphere, hydrosphere and land surface |
| Where? | A gridded atlas for each nation, latitude bands, single cells, named regions |
| How much? | Theil–Sen slope per decade with a 95% interval; signal-to-noise; months that change most |
| Is it significant? | Hamed–Rao-corrected Mann–Kendall per series; Benjamini–Hochberg across the map; start-year sensitivity; years until significant |
| Is it real? (added) | BIC ramp-versus-jump screen, co-breaks across variables, independent NASA witness |

## Data notes

- NASA POWER monthly regional API, MERRA-2 native 0.5° × 0.625°, 1981–2024. Each request URL is kept in `meta.json` and shown in the atlas.
- GISTEMP v4 (250 km, land stations) and GPCP v2.3 monthly, sampled at the centre of each Bilad cell and averaged with Bilad's land-area weights.
- No key, backend or account is needed; the shipped data is static.

## Compliance

- NASA and third-party sources are credited in the app footer, the Method page, each case file and the README.
- Original code and documentation are under Apache 2.0. Boundaries are Natural Earth (public domain) via world-atlas.
- AI assistance is disclosed in the README.
- No personal data is collected; the site sets no cookies and requests nothing beyond its own static files and its web font.
