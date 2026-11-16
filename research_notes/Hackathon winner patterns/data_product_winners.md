# Hackathon winner patterns

## 1. How winners turn analysis into a decision or user workflow

### Takeaway

The strongest Earth-system hackathon projects do not present “a map of data.” They frame one user, one place, one recurring decision, and one next action. The map is the spatial input/output surface for that decision; charts, alerts, and narratives explain why the recommendation should be trusted.

### Cited Findings

- **[Observed — 2Plant / NVS-knot, NASA Space Apps 2024 Galactic Impact winner]** The project reduces pre-planting risk to two explicit questions: whether soil moisture is sufficient for crop germination and whether the field is safe for planting equipment. It returns daily assessments for each 100 m portion of a field at least two weeks forward, a moisture-sufficiency risk score, a saturation-risk score, and a four-level planting-window timeline (“poor,” “fair,” “good,” “best”). A “second opinion” view exposes raw soil moisture, uncertainty, spatial differentiation, and risk zones. — [NASA project page](https://www.spaceappschallenge.org/nasa-space-apps-2024/find-a-team/nvs-knot/?tab=project); [NASA winner announcement](https://www.nasa.gov/learning-resources/stem-engagement-at-nasa/nasa-international-space-apps-challenge-announces-2024-global-winners/)

- **[Observed — 2Plant product presentation]** The companion product description says the prototype is a map where farmers or agronomists locate their field, inspect charts and parameters, and receive a final recommendation from satellite, weather, and hydrology inputs. — [VITech case study](https://vitechteam.com/blog/how-vitech-s-agtech-innovation-won-the-nasa-space-apps-challenge)

- **[Observed — WaterWise / GaamaRamma, NASA Space Apps 2024 Best Use of Data winner]** NASA describes the goal as helping farmers manage water availability under drought, pests, and disease. The public project record describes the user workflow as: draw a field on a map, enter crop and irrigation details, then receive a seven-day watering schedule. The output is operational—daily water needs, system run time, and field hydration status—rather than a raw evapotranspiration layer. — [NASA winner announcement](https://www.nasa.gov/learning-resources/stem-engagement-at-nasa/nasa-international-space-apps-challenge-announces-2024-global-winners/); [WaterWise project record, including links back to the official submission](https://www.crafterwiki.com/projects/waterwise/)

- **[Observed — Landsat Connect / AsturExplorers, NASA Space Apps 2024 Best Mission Concept winner]** NASA describes a simple web app that lets a user track Landsat satellites, access surface-reflectance data, choose a target location, and receive notifications when a satellite passes over that area. The public project record expands the workflow to saving a location, selecting notification lead time and channel, viewing a 3×3 pixel grid with metadata and spectral signature when data is ready, filtering by cloud cover, and exporting CSV or PDF. — [NASA winner announcement](https://www.nasa.gov/learning-resources/stem-engagement-at-nasa/nasa-international-space-apps-challenge-announces-2024-global-winners/); [Landsat Connect project record](https://www.crafterwiki.com/projects/landsat-connect/)

- **[Observed — Project AEDES, NASA Space Apps 2019 Best Use of Data winner]** AEDES is explicitly targeted at public-health and local-government agencies. Its portal correlates disease cases and deaths with climate data, Google search trends, and satellite maps; the stated outputs are advance indicators of dengue emergence and likely hotspots so officials can prioritize aid, supplies, and proactive fumigation. The repository documents three model outputs: predicted cases, predicted deaths, and likely hotspots based on stagnant-water detection. — [Maintained AEDES repository](https://github.com/Cirrolytix/aedes_dpg); [NASA winner story](https://www.nasa.gov/general/nasa-space-apps-covid-19-challenge-winners-share-stories-of-innovation/)

- **[Observed — SkySense / Team Twisters, NASA Space Apps 2025 Best Use of Technology winner]** NASA describes a web app that combines Earth-observation data and AI to produce ultra-local weather predictions, risk assessments for rain, wind, temperature, humidity, and visibility, and the safest time windows for an activity. The public repository is available as a small React/Vite project with a backend, which makes the technical artifact inspectable even though its README is minimal. — [NASA 2025 winner announcement](https://www.nasa.gov/learning-resources/stem-engagement-at-nasa/nasa-announces-2025-international-space-apps-challenge-global-winners/); [public SkySense repository](https://github.com/vsemill/skysense)

- **[Observed — QUEÑARIS, NASA Space Apps 2025 Local Impact winner]** NASA anchors the project in Arequipa’s water scarcity and the degradation of queñua forests, then connects NASA satellite data, drones, native microorganisms, and AI to site selection, tree growth, and ecosystem monitoring. A Peruvian news report describes the map as a stack of actionable indicators—vegetation cover, fire alerts, elevation, and distance to water—and says the system identifies sites near water sources and with suitable slopes. — [NASA 2025 winner announcement](https://www.nasa.gov/learning-resources/stem-engagement-at-nasa/nasa-announces-2025-international-space-apps-challenge-global-winners/); [Agencia Andina report](https://andina.pe/agencia/noticia-equipo-arequipa-es-ganador-global-del-nasa-international-space-apps-challenge-2025-1056159.aspx); [public QUEÑARIS demo](https://quenaris.vercel.app/)

- **[Observed — TerraTales, NASA Space Apps 2024 Best Storytelling winner]** TerraTales organizes climate data around three representative regions—Egypt, Brazil, and Germany—using a recurring story in which “Mother Earth” meets her children to discuss change. It then adds an interactive game about daily choices and a forecast section showing potential future impacts if action is not taken. The team’s project page says country-specific narration includes Egyptian Arabic. — [NASA winner announcement](https://www.nasa.gov/learning-resources/stem-engagement-at-nasa/nasa-international-space-apps-challenge-announces-2024-global-winners/); [TerraTales project page](https://www.spaceappschallenge.org/nasa-space-apps-2024/find-a-team/terratales/?tab=project); [TerraTales live site](https://terratalesjourney.netlify.app/)

### Inferences

- **[Interpretation]** For Bilad, every atlas layer should terminate in a “so what?” object: a trend statement, a risk classification, a watchlist, an alert, a report, or a recommended next step. A useful test is: “Who is looking, what place are they looking at, what decision is due, and what can they do next?” This inference is supported by 2Plant’s planting-window output, WaterWise’s irrigation schedule, Landsat Connect’s alert/export workflow, AEDES’s resource-prioritization use case, and QUEÑARIS’s site-selection workflow. — [2Plant project page](https://www.spaceappschallenge.org/nasa-space-apps-2024/find-a-team/nvs-knot/?tab=project); [WaterWise project record](https://www.crafterwiki.com/projects/waterwise/); [AEDES repository](https://github.com/Cirrolytix/aedes_dpg); [QUEÑARIS report](https://andina.pe/agencia/noticia-equipo-arequipa-es-ganador-global-del-nasa-international-space-apps-challenge-2025-1056159.aspx)

- **[Interpretation]** The map should act as a control surface for the user’s question, not as the hero image. The recurring winning pattern is “select a field/place → see a localized metric or forecast → receive an action or alert.” Bilad can apply this with saved places, district or watershed selection, time-window comparison, and an explicit “monitor / investigate / act” state.

- **[Interpretation]** A national atlas benefits from two modes: a fast public mode that translates a trend into plain language, and an analyst mode that exposes layers, dates, methods, and downloads. TerraTales and SkySense show the value of the fast mode; 2Plant, AEDES, and Landsat Connect show the value of a more operational mode.

### Gaps

- The live demos for several 2024/2025 winners are not reliably crawlable in text, so this research cannot independently verify every interaction described in the project pages. The notes distinguish NASA’s official summaries from public project records and maintained repositories where possible.

- The winning projects generally describe intended users and outputs more clearly than they publish evidence of sustained real-world adoption. Bilad should treat “prototype won a hackathon” as evidence of a compelling concept, not evidence of production impact.

## 2. How winners show uncertainty, provenance, methods, and validation without overwhelming users

### Takeaway

Trust is surfaced at the point of decision. The best example, 2Plant, keeps the main answer simple while offering a “second opinion” for users who need raw values, uncertainty, spatial detail, and risk context. Provenance is made legible through short source lists and method notes; validation is expressed as a small number of concrete error or comparison measures.

### Cited Findings

- **[Observed — 2Plant’s uncertainty design]** The project page says its production pipeline propagates error and reports uncertainty, fuses remote-sensing observations with model estimates, and uses data assimilation to reduce uncertainty in forecast soil moisture. It reports an average root-zone soil-moisture error of about 0.03 m³/m³ with variation by soil texture, and an RMSE of 0.64 mm in daily evapotranspiration against eddy-covariance tower measurements. The product-level “second opinion” view is where direct moisture reporting, uncertainty, spatial differentiation, and risk-zone context appear. — [NVS-knot / 2Plant project page](https://www.spaceappschallenge.org/nasa-space-apps-2024/find-a-team/nvs-knot/?tab=project)

- **[Observed — 2Plant connects scientific validation to a user decision]** The same page ties the validation evidence to the product questions: whether soil moisture is sufficient for germination and whether the field is safe for heavy equipment. That keeps the technical evidence subordinate to a practical decision instead of presenting a detached model score. — [NVS-knot / 2Plant project page](https://www.spaceappschallenge.org/nasa-space-apps-2024/find-a-team/nvs-knot/?tab=project)

- **[Observed — TerraTales discloses its data and model choices]** The project page names the NASA GHG Center as the main source, identifies the Air-Sea CO₂ Flux and SEDAC population-density datasets, and states that it used a CNN-LSTM model for the former and linear regression for the latter. A team-member write-up also acknowledges that limited ocean data reduced forecast accuracy. — [TerraTales project page](https://www.spaceappschallenge.org/nasa-space-apps-2024/find-a-team/terratales/?tab=project); [team-member write-up](https://www.linkedin.com/posts/fatma-s-elsharkawy_out-of-over-300-teams-terratales-is-a-nasa-activity-7248767067657555969-nJ9d)

- **[Observed — AEDES makes provenance operational]** The maintained repository names the source classes—Sentinel/Copernicus satellite data, DOST-PAGASA weather data, Google Trends, and Department of Health surveillance data—and describes the model chain from cases to deaths to hotspot detection. It also documents how to reproduce the forecast/export workflow locally and lists open licenses. — [AEDES repository](https://github.com/Cirrolytix/aedes_dpg)

- **[Observed — NASA’s judging rubric treats scientific validity and data integration as product requirements]** The 2025 guidance asks judges whether a project is scientifically grounded, technically feasible, usable, and user-friendly. It separately asks whether NASA data is integral to the solution rather than a superficial addition, and whether the project clearly communicates its challenge, method, and significance. — [NASA 2025 judging guidance](https://spaceapps-v2-staging.s3.amazonaws.com/media/documents/Final_Space_Apps_2025_Judging_Guidelines_for_web.pdf)

- **[Observed — NASA requires disclosure and accessible links]** The same guidance says a submission must use NASA open data, declare AI use, keep project links accessible without passwords, and keep the demo to no more than seven slides or thirty seconds for global judging. — [NASA 2025 judging guidance](https://spaceapps-v2-staging.s3.amazonaws.com/media/documents/Final_Space_Apps_2025_Judging_Guidelines_for_web.pdf)

- **[Observed — civic-tech continuity is documented as part of quality]** Civic Hack DC’s 2025 archive, which is a civic-tech comparator rather than a winning project, evaluates impact, novelty, amplification, open-source practices, usability/design, and continuity potential. Its archive preserves project snapshots, datasets, evaluations, slides, and problem briefs; the repository explains that snapshots are kept so code remains usable if upstream repositories disappear. — [Civic Hack DC 2025 archive](https://github.com/civictechdc/hackdc2025)

- **[Observed — finalist feedback exposes how uncertainty can become clutter]** In an ADB climate-visualization finalist’s public Observable notebook, a reviewer suggested a preview of the data and concrete example numbers because the introduction was general. The discussion also considers whether small multiples, checkboxes, connected points, or error bands would make comparisons clearer. — [ADB finalist notebook and review discussion](https://observablehq.com/@iskoxenvi/effects-of-climate-change-on-the-asean-fishing-industry); [ADB finalist results](https://challenges.adb.org/en/challenges/dataviz4climate/pages/challenge-results?lang=en)

### Inferences

- **[Interpretation]** Bilad should use progressive disclosure: show one headline trend and one confidence cue by default; put source versions, date ranges, model notes, validation charts, and raw layers behind a “How do we know?” drawer or analyst panel. This follows 2Plant’s separation between a simple risk timeline and a deeper “second opinion,” while avoiding the finalist feedback’s concern about cluttered comparisons.

- **[Interpretation]** A useful trust card for each atlas insight can be limited to five fields: source(s), observation period, spatial/temporal resolution, method or transformation, and validation/limitation. This is enough to answer “where did this come from?” without turning the first screen into a methods paper.

- **[Interpretation]** Use uncertainty as a decision modifier, not a decorative error bar. For example: “High heat trend, medium confidence; sparse station coverage” or “Flood-risk signal elevated, but cloud cover reduced observation quality.” The UI should explain what uncertainty changes about the recommended action.

- **[Interpretation]** Bilad should publish a small “evidence ladder” for each indicator: raw observation → derived metric → model or trend estimate → validation/benchmark → known limitation. AEDES’s documented data/model chain and 2Plant’s reported comparison against tower measurements provide concrete models for this ladder.

### Gaps

- Most projects do not publish a complete uncertainty budget, calibration notebook, independent evaluation set, or user study. The strongest available evidence is self-reported by teams on project pages or repositories; it should be treated as a transparency pattern, not as independently audited validation.

- TerraTales discloses a data limitation but does not provide enough public detail in the accessible sources to judge forecast calibration, confidence intervals, or out-of-sample performance. That is a useful warning for Bilad: naming a model is not the same as validating it.

## 3. What makes the interaction and three-minute explanation compelling — and what to avoid

### Takeaway

The winning presentation pattern is a compressed narrative: name a concrete problem, show the user doing one thing, reveal the decision output, then earn trust with a compact method/provenance proof and end on the future or action enabled. NASA’s own pitch guide describes the same sequence at thirty seconds; a three-minute Bilad explanation can expand each beat without losing the one-sentence core.

### Cited Findings

- **[Observed — NASA’s official pitch structure]** NASA’s project-submission guide says the short demo is separate from the final project and should provide a high-level summary plus a demonstration. It recommends a five-beat sequence: introduce the team, lead into the challenge, name the solution and problem, describe the user experience and data contribution, then “look into the future.” The guide emphasizes strong visuals, readable slides, a tutorial or prototype walkthrough, and a clear story chosen before the last minute. — [NASA 2022 Project Submission Guide](https://spaceapps-prod.s3.amazonaws.com/media/documents/Space_Apps_2022_Project_Submission_Guide.pdf)

- **[Observed — official judging is fast and holistic]** NASA’s 2025 guidance limits the global demo to seven slides or thirty seconds and scores impact, creativity, validity, relevance, and presentation. A local-event guidance page gives a three-minute team pitch followed by two minutes for judges to score or ask a question. The exact limit varies by event/year, but the shared pattern is that the product must be understood quickly. — [NASA 2025 judging guidance](https://spaceapps-v2-staging.s3.amazonaws.com/media/documents/Final_Space_Apps_2025_Judging_Guidelines_for_web.pdf); [NASA local pitch guidance example](https://www.spaceappschallenge.org/2025/local-events/isa-town/)

- **[Observed — TerraTales uses a narrative arc, not a dashboard tour]** The project starts with character-based regional climate stories, then turns the user into a participant through a choice-based game, then shows forecast consequences. The project page says its purpose is to simplify climate data for a broad audience and motivate action; it also uses native-language narration for at least one region. — [TerraTales project page](https://www.spaceappschallenge.org/nasa-space-apps-2024/find-a-team/terratales/?tab=project)

- **[Observed — Landsat Connect makes the interaction memorable through a trigger]** Its central interaction is not “browse all satellite data”; it is “pin a place, get notified before the satellite passes, then compare ground measurements with the captured pixels.” That creates a clear before/after demo moment and gives the map a job. — [NASA winner announcement](https://www.nasa.gov/learning-resources/stem-engagement-at-nasa/nasa-international-space-apps-challenge-announces-2024-global-winners/); [Landsat Connect project record](https://www.crafterwiki.com/projects/landsat-connect/)

- **[Observed — QUEÑARIS makes local impact legible]** NASA and the Peruvian reporting describe one city, one threatened ecosystem, one water-security consequence, and a platform that combines multiple data scales to choose and monitor restoration sites. The project’s public demo is linked separately from the submission description. — [NASA 2025 winner announcement](https://www.nasa.gov/learning-resources/stem-engagement-at-nasa/nasa-announces-2025-international-space-apps-challenge-global-winners/); [Agencia Andina report](https://andina.pe/agencia/noticia-equipo-arequipa-es-ganador-global-del-nasa-international-space-apps-challenge-2025-1056159.aspx); [QUEÑARIS demo](https://quenaris.vercel.app/)

- **[Observed — ADB finalists were asked to tell a data story, not just submit a chart]** The ADB Visualizing Climate Change & Resilience final showcase gave each of five finalist teams seven minutes for a data story followed by eight minutes of Q&A. The finalists’ briefs include vulnerability/resilience in Bangladesh, fisheries and sea temperature, plastic waste, and nature-based visual storytelling. — [ADB challenge results](https://challenges.adb.org/en/challenges/dataviz4climate/pages/challenge-results?lang=en)

- **[Observed — public repositories make the project credible after the pitch]** AEDES includes architecture and functional documentation, local setup steps, data files, export scripts, awards, and licenses. Civic Hack DC’s archive likewise preserves submissions, evaluations, datasets, slides, snapshots, and continuity plans. — [AEDES repository](https://github.com/Cirrolytix/aedes_dpg); [Civic Hack DC 2025 archive](https://github.com/civictechdc/hackdc2025)

### Inferences

- **[Interpretation — recommended Bilad three-minute script]** A strong Bilad walkthrough can be organized as:
  1. **0:00–0:25 — The stake:** name a person or institution, a national place, and a concrete Earth-system change.
  2. **0:25–1:10 — The question:** choose a district, watershed, city, or indicator and show the time window the user cares about.
  3. **1:10–1:55 — The answer:** reveal one trend statement, map pattern, or risk classification and the next action it supports.
  4. **1:55–2:30 — The proof:** open the compact “How do we know?” panel with source, date, method, uncertainty, and one validation comparison.
  5. **2:30–3:00 — The consequence:** show the report/alert/watchlist/export or policy conversation that becomes possible.
  This expands NASA’s 30-second structure while preserving its order: challenge → solution → user experience/data → future value. — [NASA Project Submission Guide](https://spaceapps-prod.s3.amazonaws.com/media/documents/Space_Apps_2022_Project_Submission_Guide.pdf)

- **[Interpretation — screenshots that sell the product]** Bilad’s launch/demo materials should show three complementary screenshots: (1) a place/time selection state, (2) the resulting map plus a single plain-language insight and action, and (3) the evidence drawer with provenance, uncertainty, and validation. This is more persuasive than three map screenshots because it shows input, decision, and trust in sequence. The pattern is grounded in WaterWise’s field-to-schedule workflow, Landsat Connect’s pin-to-alert workflow, and 2Plant’s answer-plus-second-opinion structure. — [WaterWise project record](https://www.crafterwiki.com/projects/waterwise/); [Landsat Connect project record](https://www.crafterwiki.com/projects/landsat-connect/); [2Plant project page](https://www.spaceappschallenge.org/nasa-space-apps-2024/find-a-team/nvs-knot/?tab=project)

- **[Interpretation — onboarding should be task-shaped]** The first-run experience should ask one question such as “What place or system do you want to understand?” and then offer a small set of useful roles or tasks—monitor a district, compare a watershed, investigate a heat trend, prepare a briefing, or download evidence. Do not begin with a blank national map and a long layer catalog. Winners repeatedly begin with a field, location, activity, audience, or narrative protagonist.

- **[Interpretation — common weaknesses to avoid]** The evidence suggests Bilad should explicitly avoid:
  - a generic climate introduction with no preview number or concrete place; an ADB finalist’s reviewer made exactly this criticism of a public data story. — [Observable review discussion](https://observablehq.com/@iskoxenvi/effects-of-climate-change-on-the-asean-fishing-industry)
  - a decorative map with no decision, alert, comparison, or export; the winning workflows above make the map perform a job. — [2Plant](https://www.spaceappschallenge.org/nasa-space-apps-2024/find-a-team/nvs-knot/?tab=project); [Landsat Connect](https://www.crafterwiki.com/projects/landsat-connect/); [WaterWise](https://www.crafterwiki.com/projects/waterwise/)
  - a black-box “AI forecast” with no data lineage, limitation, or validation; NASA’s rubric asks whether the science is valid and whether the data is integral, while 2Plant and AEDES publish a method/evidence chain. — [NASA 2025 judging guidance](https://spaceapps-v2-staging.s3.amazonaws.com/media/documents/Final_Space_Apps_2025_Judging_Guidelines_for_web.pdf); [2Plant](https://www.spaceappschallenge.org/nasa-space-apps-2024/find-a-team/nvs-knot/?tab=project); [AEDES](https://github.com/Cirrolytix/aedes_dpg)
  - too many layers, countries, or series shown at once; the ADB finalist discussion explicitly considers checkboxes, small multiples, and other ways to reduce clutter. — [Observable finalist discussion](https://observablehq.com/@iskoxenvi/effects-of-climate-change-on-the-asean-fishing-industry)
  - inaccessible demos, password-protected links, or undisclosed AI use; NASA lists these as minimum submission requirements. — [NASA 2025 judging guidance](https://spaceapps-v2-staging.s3.amazonaws.com/media/documents/Final_Space_Apps_2025_Judging_Guidelines_for_web.pdf)
  - a one-off prototype with no path to reuse; the civic-tech comparator treats open-source practice, usability, and continuity as explicit quality dimensions and preserves frozen snapshots so work remains available. — [Civic Hack DC 2025 archive](https://github.com/civictechdc/hackdc2025)

### Gaps

- The public sources rarely expose actual onboarding analytics, retention, task completion, or accessibility testing. Bilad should validate these locally with a small set of target users rather than infer usability from awards.

- The public winner pages vary in quality: some include a live demo and detailed method notes, while others expose only a summary. A final Bilad presentation should therefore make the evidence package itself a product feature: stable demo URL, screenshot deck, short walkthrough, source manifest, reproducibility notes, and an explicit limitations page.

- The research found strong examples of decision support and storytelling, but fewer public examples of a national atlas with a unified cross-domain ontology. Bilad’s differentiator can be the consistent way it links atmosphere, land, water, hazards, ecosystems, and human systems across the same place/time/provenance model.
