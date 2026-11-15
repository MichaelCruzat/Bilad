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
    dek: 'A decade-long drought, tested against an independent record.',
    iso3: 'CHL',
    variable: 'PRECTOTCORR',
    focus: {kind: 'region', region: 'central'},
    question: 'Did central Chile really lose a large share of its rainfall after 2010, or is the decline an artefact of one dataset?',
    context: [
      'Since 2010 central Chile, home to most of the country’s people and farms, has seen a run of dry years that climate scientists call the Mega Drought. Studies of rain gauges report annual deficits of roughly 20–40% over 2010–2018.',
      'Bilad starts from NASA’s MERRA-2 reanalysis, then cross-examines it against GPCP, a gauge-and-satellite precipitation record originally developed at NASA Goddard, sampled on exactly the same grid cells.',
    ],
    expected: 'corroborated',
    lesson:
      'Both records show the drop, so a processing artefact in the reanalysis is ruled out. They disagree on its size, roughly a quarter less rain in one and a third in the other, which is why the case reports a range. Both draw on rain gauges, so their agreement cannot rule out a problem shared by the gauges themselves.',
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
    dek: 'The same latitude, two different stories, less than 200 km apart.',
    iso3: 'CHL',
    variable: 'T2M_MAX',
    focus: {kind: 'contrast', latMin: -38, latMax: -18, labels: ['Coast (west-most cells)', 'Andes (east-most cells)']},
    question: 'Is all of Chile warming at the same pace, or does the same latitude tell different stories at the coast and in the mountains?',
    context: [
      'Station studies found that daytime temperatures along Chile’s subtropical coast barely rose, or even fell, while inland valleys and the Andes warmed. A cool ocean and strengthened coastal upwelling are leading explanations.',
      'Bilad compares the west-most and east-most grid cell of every row between 18°S and 38°S. Each pair shares a latitude and differs mainly in distance from the ocean and in elevation, which climbs steeply toward the Andes.',
    ],
    expected: 'unwitnessed',
    lesson:
      'A national average can hide opposite local trends. Resolution matters too: GISTEMP’s 2° grid is about as wide as Chile, so no independent gridded record can separate coast from mountains here, and Bilad leaves the case without a verdict.',
    references: [
      {label: 'Falvey & Garreaud (2009), Regional cooling in a warming world, Journal of Geophysical Research', url: 'https://doi.org/10.1029/2008JD010519'},
      {label: 'NASA POWER, MERRA-2 meteorology', url: 'https://power.larc.nasa.gov/docs/methodology/'},
    ],
  },
  {
    id: 'bangladesh-phantom-cooling',
    number: '03',
    title: 'Bangladesh’s phantom cooling',
    dek: 'A statistically significant trend that stations say is false.',
    iso3: 'BGD',
    variable: 'T2M',
    focus: {kind: 'nation'},
    question: 'MERRA-2 says Bangladesh has cooled significantly since 1981. Should anyone believe it?',
    context: [
      'Taken alone, the reanalysis series passes every standard test: a significant Mann–Kendall trend, a tight confidence interval, most of the land area significant after false-discovery control. A tool that stopped there would report a cooling nation.',
      'Weather stations tell the opposite story. And the reanalysis does not cool gradually: its temperature, humidity and soil moisture all jump around 1997–98. These are coupled inside one model, so together they point to a single change in what the model was fed. The timing matches a period when new satellite sounders (AMSU-A, first flown on NOAA-15 in 1998) entered the observing system that MERRA-2 assimilates.',
    ],
    expected: 'contradicted',
    lesson:
      'A significance test only compares a record with chance. It assumes the data were produced the same way from start to finish, which a reanalysis cannot promise. When a record jumps in one year and an independent record disagrees, the trend is telling you about the dataset.',
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
    context: [
      'Over equatorial East Africa, MERRA-2 and the station-based GISTEMP record agree that temperatures have risen since 1981. The question is the rate, which is what adaptation planning actually needs.',
      'A milder version appears in Morocco and Spain, where MERRA-2 also warms more slowly than stations but the two 95% ranges still overlap. Atlas temperature trends there may understate the warming.',
    ],
    expected: 'same-direction',
    lesson:
      'Two records can agree on the direction and still disagree on the size. The 95% ranges show whether two estimates are compatible; here they do not overlap. Station coverage in East Africa is sparse, so the station record carries its own uncertainty.',
    references: [
      {label: 'GISTEMP v4 (NASA GISS)', url: 'https://data.giss.nasa.gov/gistemp/'},
      {label: 'Gelaro et al. (2017), MERRA-2, Journal of Climate', url: 'https://doi.org/10.1175/JCLI-D-16-0758.1'},
    ],
  },
];

export function getCase(id: string): CaseDef | undefined {
  return CASES.find(c => c.id === id);
}
