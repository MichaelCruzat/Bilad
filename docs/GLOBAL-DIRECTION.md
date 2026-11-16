# TRACE: global product and motion contract

The user's 2026-11-15 correction supersedes the earlier nation-led homepage.
TRACE means **Tracking Regional Atmospheric Change on Earth**. “Regional”
describes a selection on a worldwide grid; it does not restrict the product
to a shortlist of countries.

The primary product covers 54,425 land cells from 60°S to 84°N, 1981–2024,
for temperature and rainfall. Any covered cell or country can be investigated.
GISTEMP v4 checks temperature; GPCP v2.3 checks rainfall and shares some gauge
inputs with MERRA-2. Seven older national packs offer extra variables; they
are supplemental detail, not the navigation model or definition of coverage.

## Why the app exists

Climate evidence can be misleading even when a trend test returns a small
p-value: serial correlation, abrupt data discontinuities, coarse spatial
sampling, and disagreement between products can change its interpretation.
TRACE joins statistical tests, an integrity screen, a second record, source
provenance, and exports in one global workflow. It helps users identify claims
that need scrutiny before they enter climate communication or planning.

People and researchers can examine and reproduce evidence without building a
pipeline. NASA data users can compare products on a common footprint and
identify places needing product investigation. Public agencies can use the
exports as a reviewable input to further warming or rainfall assessments.
These are intended uses: institutional adoption and policy outcomes have not
been demonstrated. TRACE does not forecast, attribute causes, or replace
validated local risk models. Home states the purpose; the dedicated Impact
tab explains the need, cross-record comparison, intended benefits and limits.

Impact still needs to be measured through analyst time to a reviewed result,
correct interpretation of uncertainty, reproducibility by other teams, and
independently investigated disagreement cases. Coverage counts, a polished
globe, and matching implementations are not evidence of policy impact.

Home must retain the acronym, purpose, observation window, geographic limits,
and a clear route into global exploration. It must not open on Bangladesh or
another country, or imply that only a few nations are supported. Country case
files remain examples of the global method and live on the homepage, rather
than occupying a separate navigation tab. Preserve `#/cases` as a link to
the homepage case section.

The interaction reference is [GRIME](https://grime.world/): a large geographic
visual, continuity across scroll, and a clear transition into an explorer.
The user selected Midnight blue: navy surfaces, cool-white serif headings,
IBM Plex body/monospace text and blue controls. Data colours retain their
scientific meaning. It does not copy GRIME's branding or prose.

Show state/province boundaries only after zooming to 3×, without region names,
tooltips or extra statistics. Use generalized Natural Earth admin-1 lines,
load the shared geometry once on demand, cache global-map outlines in textures,
and cull off-screen lines in the 2D globe fallback. Project the
outlines with the climate grid's existing transform. The outlines are
geographic context only. They add no statistics by region, and the climate
grid is too coarse to resolve administrative boundaries.

Motion should carry meaning: the globe changes from a reanalysis claim to a
station witness to an agreement map as the reader follows the evidence.
Sections and selected evidence slide into place using transform and opacity.
The page keeps native scrolling, readable text, keyboard access, a rotation
pause, and reduced-motion support. No scroll hijacking, hidden essential
content, synthetic live-data effects, or animation of the statistics.

Global exploration, evidence export, and a worldwide statistical walkthrough
are the main path. Legacy national deep links remain usable. Documentation,
tests, and GitHub must describe the actual supported global scope.
