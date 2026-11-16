/**
 * Case files: guided investigations. Every number shown on a case page is
 * computed live from the shipped data; this file holds only the question,
 * the context from the literature, and what the case teaches. The expected
 * verdict is pinned by tests/data.test.ts so the copy cannot drift from the data.
 */
import type {Agreement} from '../lib/stats';

export type CaseFocus =
  | {kind: 'nation'}
  | {kind: 'region'; region: string}
  | {kind: 'contrast'; latMin: number; latMax: number; labels: [string, string]};

export type Reference = {label: string; url: string};

export type CaseDef = {
  id: string;
  number: string;
  title: string;
  dek: string;
  iso3: string;
  variable: string;
  focus: CaseFocus;
  question: string;
  /** The case in two plain sentences, for readers who stop at the top. */
  inShort: string;
  context: string[];
  /** Verdict when a witness exists; 'unwitnessed' when it cannot resolve the question. */
  expected: Agreement | 'unwitnessed';
  lesson: string;
  references: Reference[];
};

export const CASES: CaseDef[] = [
  {
    id: 'chile-megadrought',
    number: '01',
    title: 'Central Chile’s missing rain',
    dek: 'A decade-long drought, tested against a second record.',
    iso3: 'CHL',
    variable: 'PRECTOTCORR',
    focus: {kind: 'region', region: 'central'},
    question: 'Did central Chile really lose a large share of its rainfall after 2010, or is the decline an artefact of one dataset?',
    inShort: 'Both NASA’s reanalysis and an independent rain record show central Chile losing a large share of its rain since 2010: about a third in one, a quarter in the other. The drought is real; the records only disagree on how severe it is.',
    context: [
      'Since 2010 central Chile, home to most of the country’s people and farms, has seen a run of dry years that climate scientists call the megadrought. Studies of rain gauges report annual deficits of roughly 20–40% over 2010–2018.',
      'TRACE starts from NASA’s MERRA-2 reanalysis, then checks it against GPCP, a rainfall record built from rain gauges and satellites (originally developed at NASA Goddard), sampled at the centre of each of the same grid cells.',
    ],
    expected: 'corroborated',
    lesson:
      'Both records show the drop, so a processing artefact in the reanalysis is unlikely. They disagree on its size, about a third less rain in MERRA-2 (34%) and a quarter less in GPCP (23%), which is why the case reports a range. Both draw on rain gauges, so their agreement cannot rule out a problem shared by the gauges themselves.',
    references: [
      {label: 'Garreaud et al. (2017), The 2010–2015 megadrought in central Chile, Hydrology and Earth System Sciences', url: 'https://doi.org/10.5194/hess-21-6307-2017'},
      {label: 'Garreaud et al. (2020), The Central Chile Mega Drought (2010–2018), International Journal of Climatology', url: 'https://doi.org/10.1002/joc.6219'},
      {label: 'GPCP v2.3 monthly precipitation (NASA GSFC, distributed by NOAA PSL)', url: 'https://psl.noaa.gov/data/gridded/data.gpcp.html'},
    ],
  },
  {
    id: 'chile-coast-andes',
    number: '02',
    title: 'Two Chiles: a flat coast and warming Andes',
    dek: 'Same latitude, typically 120–380 km apart, two different trends.',
    iso3: 'CHL',
    variable: 'T2M_MAX',
    focus: {kind: 'contrast', latMin: -38, latMax: -18, labels: ['Coast (west-most cells)', 'Andes (east-most cells)']},
    question: 'Is all of Chile warming at the same pace, or do the coast and the mountains behave differently at the same latitude?',
    inShort: 'Daytime highs on Chile’s coast have barely changed since 1981, while the Andes at the same latitude have warmed (about −0.01 against +0.29 °C per decade). No independent record is detailed enough to check the difference, so TRACE gives no verdict.',
    context: [
      'Station studies found that daytime temperatures along Chile’s subtropical coast barely rose, or even fell, while inland valleys and the Andes warmed. A cool ocean and strengthened coastal upwelling are leading explanations.',
      'TRACE compares the west-most and east-most grid cell of every row between 18°S and 38°S. Each pair shares a latitude and differs mainly in distance from the ocean and in elevation, which climbs steeply towards the Andes.',
    ],
    expected: 'unwitnessed',
    lesson:
      'A national average can hide opposite local trends. GISTEMP’s 2° grid is also about as wide as Chile, so no independent gridded record can separate coast from mountains here, and TRACE leaves the case without a verdict.',
    references: [
      {label: 'Falvey & Garreaud (2009), Regional cooling in a warming world, Journal of Geophysical Research', url: 'https://doi.org/10.1029/2008JD010519'},
      {label: 'NASA POWER, MERRA-2 meteorology', url: 'https://power.larc.nasa.gov/docs/methodology/'},
    ],
  },
  {
    id: 'bangladesh-phantom-cooling',
    number: '03',
    title: 'Bangladesh’s phantom cooling',
    dek: 'Significant cooling in the reanalysis, contradicted by weather stations.',
    iso3: 'BGD',
    variable: 'T2M',
    focus: {kind: 'nation'},
    question: 'MERRA-2 says Bangladesh has cooled significantly since 1981. Should anyone believe it?',
    inShort: 'NASA’s reanalysis says Bangladesh has cooled since 1981; weather stations say it has warmed, by about +0.35 °C per decade. The reanalysis drops suddenly in 1997–98, so the cooling is most likely a problem in that dataset, not the climate.',
    context: [
      'Taken alone, the reanalysis passes every standard test. The trend is statistically significant (Mann–Kendall), its 95% range excludes zero, and most of the land area stays significant even after correcting for testing many cells at once. A tool that stopped there would report a cooling nation.',
      'Weather stations show warming. The reanalysis drop is not gradual either: temperature, humidity and soil moisture all jump in 1997–98. They come from one model, so one change in what it was fed could explain all three. The satellite observing system that MERRA-2 assimilates changed repeatedly in the late 1990s (new microwave sounders, AMSU-A, began flying in 1998), and the shift here starts in 1997, so TRACE cannot pin the cause. What it can show is that the jump appears only in the reanalysis, not in the station record.',
    ],
    expected: 'contradicted',
    lesson:
      'A significance test only compares a record with chance. It assumes the data were produced the same way from start to finish, which a reanalysis cannot promise. When a record jumps in one year and an independent record disagrees, the trend more likely records a change in the dataset than in the climate.',
    references: [
      {label: 'Gelaro et al. (2017), The Modern-Era Retrospective Analysis for Research and Applications, Version 2 (MERRA-2), Journal of Climate', url: 'https://doi.org/10.1175/JCLI-D-16-0758.1'},
      {label: 'Lenssen et al. (2019), Improvements in the GISTEMP uncertainty model, JGR Atmospheres', url: 'https://doi.org/10.1029/2018JD029522'},
      {label: 'GISTEMP v4 (NASA GISS)', url: 'https://data.giss.nasa.gov/gistemp/'},
    ],
  },
  {
    id: 'kenya-half-the-warming',
    number: '04',
    title: 'Kenya: right direction, half the speed',
    dek: 'When two records agree on the sign but not the size.',
    iso3: 'KEN',
    variable: 'T2M',
    focus: {kind: 'nation'},
    question: 'Both records say Kenya is warming. Do they agree on how fast?',
    inShort: 'Both records agree that Kenya is warming, but the reanalysis shows about half the station rate (+0.18 against +0.34 °C per decade). The direction is safe to use; the size of the warming needs care.',
    context: [
      'Over equatorial East Africa, MERRA-2 and the station-based GISTEMP record agree that temperatures have risen since 1981. They differ on the rate, and the rate is what adaptation planning needs.',
      'A milder version appears in Morocco and Spain, where MERRA-2 also warms more slowly than stations but the two 95% ranges still overlap. The Philippines is a stronger one: MERRA-2 warms at about a third of the station rate (+0.09 against +0.26 °C per decade). Atlas temperature trends there may understate the warming.',
    ],
    expected: 'same-direction',
    lesson:
      'Here the 95% ranges do not overlap, so the two estimates are not compatible. Station coverage in East Africa is sparse, so the station record carries its own uncertainty.',
    references: [
      {label: 'GISTEMP v4 (NASA GISS)', url: 'https://data.giss.nasa.gov/gistemp/'},
      {label: 'Gelaro et al. (2017), MERRA-2, Journal of Climate', url: 'https://doi.org/10.1175/JCLI-D-16-0758.1'},
    ],
  },
];

export function getCase(id: string): CaseDef | undefined {
  return CASES.find(c => c.id === id);
}
