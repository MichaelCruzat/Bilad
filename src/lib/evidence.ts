/**
 * Independent witnesses and integrity screens.
 *
 * A reanalysis trend is a claim; TRACE cross-examines it against an
 * observation-based NASA product on the same footprint (GISTEMP for
 * temperature, GPCP for precipitation) and screens it for step changes.
 */
import {BASELINE, getVariable} from '../data/variables';
import {agreement, stepScreen, trendTest, type Agreement, type StepScreen, type TrendTest} from './stats';
import type {DataIndex} from './nationData';
import type {Window} from './analysis';

export type WitnessSeries = {series: (number | null)[]; coverage: number[]};

export type Crosscheck = {
  generated: string;
  firstYear: number;
  lastYear: number;
  products: Record<string, {name: string; agency: string; unit: string; url: string}>;
  nations: Record<string, Record<string, WitnessSeries> & {regions?: Record<string, Record<string, WitnessSeries>>}>;
};

const base = `${import.meta.env.BASE_URL ?? './'}data/`;
let crosscheckPromise: Promise<Crosscheck> | null = null;

export function loadCrosscheck(): Promise<Crosscheck> {
  if (!crosscheckPromise) {
    crosscheckPromise = fetch(`${base}crosscheck.json`)
      .then(res => {
        if (!res.ok) throw new Error(`crosscheck.json: HTTP ${res.status}`);
        return res.json() as Promise<Crosscheck>;
      })
      .catch(error => {
        crosscheckPromise = null;
        throw error;
      });
  }
  return crosscheckPromise;
}

export const WITNESSED = ['T2M', 'PRECTOTCORR'] as const;

export function hasWitness(variable: string): boolean {
  return (WITNESSED as readonly string[]).includes(variable);
}

/**
 * Witness annual series for a window, in the same reading units as TRACE's
 * own series: °C anomaly vs 1991–2020 for temperature, % of the 1991–2020
 * normal for precipitation. Returns null when there is no witness.
 */
export function witnessSeries(xc: Crosscheck, iso3: string, variable: string, window: Window, region?: string): Float64Array | null {
  const nation = xc.nations[iso3];
  if (!nation || !hasWitness(variable)) return null;
  const source = region ? nation.regions?.[region]?.[variable] : (nation[variable] as WitnessSeries | undefined);
  if (!source) return null;
  const all = source.series.map(v => (v === null ? NaN : v));
  const baseVals = all.slice(BASELINE[0] - xc.firstYear, BASELINE[1] - xc.firstYear + 1).filter(Number.isFinite);
  const normal = baseVals.reduce((s, v) => s + v, 0) / baseVals.length;
  const def = getVariable(variable);
  const out = new Float64Array(window.to - window.from + 1);
  for (let i = 0; i < out.length; i++) {
    const v = all[window.from - xc.firstYear + i];
    out[i] = def.relative ? ((v - normal) / normal) * 100 : v - normal;
  }
  return out;
}

export type CrossExamination = {
  claim: TrendTest;
  witness: TrendTest;
  verdict: Agreement;
  claimStep: StepScreen | null;
  witnessStep: StepScreen | null;
  /** Reanalysis looks like a jump while the witness does not, or they disagree outright. */
  artifactSuspected: boolean;
};

export function crossExamine(years: number[], claimSeries: ArrayLike<number>, witness: ArrayLike<number>): CrossExamination {
  const claim = trendTest(years, claimSeries);
  const w = trendTest(years, witness);
  const verdict = agreement(claim, w);
  const claimStep = stepScreen(years, claimSeries);
  const witnessStep = stepScreen(years, witness);
  const artifactSuspected =
    verdict === 'contradicted' || Boolean(claimStep?.stepDominated && !witnessStep?.stepDominated && verdict !== 'corroborated');
  return {claim, witness: w, verdict, claimStep, witnessStep, artifactSuspected};
}

/**
 * One vocabulary for the witness comparison, used by every map legend, badge
 * and table. overallVerdict below reuses these labels and adds one of its own,
 * "Likely data artefact", when the integrity screen also fails.
 */
export const VERDICT_TEXT: Record<Agreement, {label: string; tone: 'success' | 'warning' | 'error' | 'neutral'; plain: string}> = {
  corroborated: {label: 'Corroborated', tone: 'success', plain: 'Both records show a significant change in the same direction, and their 95% ranges overlap.'},
  'same-direction': {label: 'Same direction, different size', tone: 'warning', plain: 'Both records agree on the direction, but not on how fast; their 95% ranges do not overlap.'},
  'weakly-supported': {label: 'Only one record significant', tone: 'warning', plain: 'One record shows a significant change; the other leans the same way without reaching significance.'},
  contradicted: {label: 'Contradicted', tone: 'error', plain: 'The two records show significant changes in opposite directions. Their sources, sampling or uncertainty need explaining before either is trusted here.'},
  unsupported: {label: 'Not supported', tone: 'error', plain: 'One record shows a significant change; the other leans the opposite way.'},
  'no-signal': {label: 'No detectable trend', tone: 'neutral', plain: 'Neither record shows a significant change over this window.'},
};

/** Labels in the order of the map's verdict palette (VERDICT_COLORS). */
export const VERDICT_ORDER: Agreement[] = ['corroborated', 'same-direction', 'weakly-supported', 'contradicted', 'unsupported', 'no-signal'];

export type CoBreak = {year: number; variables: string[]};

/**
 * Years in which several national series jump together. Independent
 * physical variables rarely change regime in the same year; when they do,
 * a change in the data system is a likely suspect.
 */
export function coBreaks(index: DataIndex, iso3: string, minVariables = 3): CoBreak[] {
  const nation = index.nations.find(n => n.iso3 === iso3);
  if (!nation) return [];
  const years = Array.from({length: index.lastYear - index.firstYear + 1}, (_, i) => index.firstYear + i);
  const breaks: {variable: string; year: number}[] = [];
  for (const [variable, stat] of Object.entries(nation.stats)) {
    const s = stepScreen(years, stat.series);
    if (s && s.deltaBic > 2) breaks.push({variable, year: s.breakAt});
  }
  const groups: CoBreak[] = [];
  for (const b of breaks.sort((x, y) => x.year - y.year)) {
    const g = groups.find(gr => Math.abs(gr.year - b.year) <= 1);
    if (g) g.variables.push(b.variable);
    else groups.push({year: b.year, variables: [b.variable]});
  }
  return groups.filter(g => g.variables.length >= minVariables);
}

/** Per-cell witness: one annual series per product grid box, and each TRACE cell's box. */
export type WitnessGrid = {
  firstYear: number;
  lastYear: number;
} & Record<string, {boxes: (number | null)[][]; cellBox: number[]}>;

const witnessMemo = new Map<string, Promise<WitnessGrid>>();

export function loadWitness(iso3: string): Promise<WitnessGrid> {
  let hit = witnessMemo.get(iso3);
  if (!hit) {
    hit = fetch(`${base}nations/${iso3}/witness.json`)
      .then(res => {
        if (!res.ok) throw new Error(`witness.json: HTTP ${res.status}`);
        return res.json() as Promise<WitnessGrid>;
      })
      .catch(error => {
        witnessMemo.delete(iso3);
        throw error;
      });
    witnessMemo.set(iso3, hit);
  }
  return hit;
}

/** Number of distinct witness grid boxes behind a set of cells (resolution check). */
export function witnessBoxes(w: WitnessGrid, variable: string, cells: number[]): number {
  const src = w[variable];
  return src ? new Set(cells.map(c => src.cellBox[c])).size : 0;
}

/**
 * Witness series for any set of cells, area-weighted with TRACE's own
 * weights and expressed like TRACE's series (anomaly vs 1991–2020; % of
 * normal for precipitation). Years with under half the area covered are NaN.
 */
export function witnessForCells(w: WitnessGrid, variable: string, weights: ArrayLike<number>, cells: number[], window: Window): Float64Array | null {
  const src = w[variable];
  if (!src || !hasWitness(variable) || !cells.length) return null;
  const nYears = w.lastYear - w.firstYear + 1;
  const total = cells.reduce((s, c) => s + weights[c], 0);
  const all = new Float64Array(nYears);
  for (let y = 0; y < nYears; y++) {
    let sum = 0;
    let wsum = 0;
    for (const c of cells) {
      const v = src.boxes[src.cellBox[c]][y];
      if (v !== null) {
        sum += v * weights[c];
        wsum += weights[c];
      }
    }
    all[y] = wsum >= total / 2 ? sum / wsum : NaN;
  }
  const baseVals = Array.from(all.subarray(BASELINE[0] - w.firstYear, BASELINE[1] - w.firstYear + 1)).filter(Number.isFinite);
  const normal = baseVals.reduce((s, v) => s + v, 0) / baseVals.length;
  const relative = Boolean(getVariable(variable).relative);
  const out = new Float64Array(window.to - window.from + 1);
  for (let i = 0; i < out.length; i++) {
    const v = all[window.from - w.firstYear + i];
    out[i] = relative ? ((v - normal) / normal) * 100 : v - normal;
  }
  return out;
}

/** How independent each witness is from MERRA-2. */
export const INDEPENDENCE: Record<string, string> = {
  T2M: 'Independent: built from weather-station thermometers, not from the reanalysis.',
  PRECTOTCORR:
    'Partly independent: GPCP combines rain gauges and satellites, and MERRA-2’s corrected rainfall also leans on gauge analyses, so the two share some of the same gauges. Agreement adds support but cannot exclude a shared error.',
};

/** Name of the witness for a variable, or a generic phrase when it has none. */
export function productName(variable: string): string {
  return PRODUCTS[variable]?.name ?? 'The independent record';
}

export const PRODUCTS: Record<string, {name: string; long: string; agency: string; url: string}> = {
  T2M: {name: 'GISTEMP v4', long: 'GISTEMP v4 (250 km smoothing, land stations)', agency: 'NASA GISS', url: 'https://data.giss.nasa.gov/gistemp/'},
  PRECTOTCORR: {
    name: 'GPCP v2.3',
    long: 'GPCP v2.3 monthly precipitation (gauges + satellites)',
    agency: 'GPCP, originally developed at NASA Goddard; distributed by NOAA PSL',
    url: 'https://psl.noaa.gov/data/gridded/data.gpcp.html',
  },
};

/**
 * What TRACE knows about the independent witness for one selection. Each
 * state renders differently, so a failed download never reads as "no witness".
 */
export type WitnessState =
  | {kind: 'unsupported'}
  | {kind: 'loading'}
  | {kind: 'failed'; message: string; retry: () => void}
  | {kind: 'no-coverage'}
  | {kind: 'too-coarse'; product: string}
  | {kind: 'available'; exam: CrossExamination};

/** Build the witness state from the load status and, when ready, the witness series. */
export function toWitnessState(
  variable: string,
  status: {status: 'loading'} | {status: 'error'; error: Error; retry: () => void} | {status: 'ready'},
  years: number[],
  claim: ArrayLike<number>,
  witness: () => ArrayLike<number> | null,
): WitnessState {
  if (!hasWitness(variable)) return {kind: 'unsupported'};
  if (status.status === 'loading') return {kind: 'loading'};
  if (status.status === 'error') return {kind: 'failed', message: status.error.message, retry: status.retry};
  const w = witness();
  if (!w || Array.from(w).filter(Number.isFinite).length < 10) return {kind: 'no-coverage'};
  return {kind: 'available', exam: crossExamine(years, claim, w)};
}

export type Verdict = {label: string; tone: 'success' | 'warning' | 'error' | 'neutral'; sentence: string};

/** One deterministic verdict from significance, the integrity screen and the witness. */
export function overallVerdict(p: number, witness: WitnessState, stepDominated: boolean): Verdict {
  const significant = p < 0.05;
  if (witness.kind === 'available') {
    const {exam} = witness;
    if (exam.artifactSuspected)
      return {
        label: 'Likely data artefact',
        tone: 'error',
        sentence:
          exam.verdict === 'contradicted'
            ? 'The independent record shows a significant change in the opposite direction. That points to a problem in the data, though it does not say which record is at fault.'
            : 'The reanalysis changes in one sudden jump that the independent record does not share. Check where the data came from before reading this as a lasting trend.',
      };
    const claimSig = exam.claim.p < 0.05;
    switch (exam.verdict) {
      case 'corroborated':
        return {label: 'Corroborated', tone: 'success', sentence: 'An independent record shows a significant change in the same direction, and the two 95% ranges overlap.'};
      case 'same-direction':
        return {label: 'Same direction, different size', tone: 'warning', sentence: 'Both records agree on the direction but not on how fast, so treat the size of the change with caution.'};
      case 'weakly-supported':
        return claimSig
          ? {label: 'Only one record significant', tone: 'warning', sentence: 'MERRA-2 shows a significant change; the independent record leans the same way but is not significant.'}
          : {label: 'Only one record significant', tone: 'warning', sentence: 'The independent record shows a significant change that MERRA-2 barely registers, so the reanalysis likely understates it here.'};
      case 'contradicted':
        return {label: 'Contradicted', tone: 'error', sentence: 'The two records show significant changes in opposite directions.'};
      case 'unsupported':
        return claimSig
          ? {label: 'Not supported', tone: 'error', sentence: 'MERRA-2 shows a significant change, but the independent record leans the opposite way.'}
          : {label: 'Not supported', tone: 'error', sentence: 'The independent record shows a significant change in the opposite direction to MERRA-2’s weak trend.'};
      default:
        return {label: 'No detectable trend', tone: 'neutral', sentence: 'Neither record shows a significant change over this window.'};
    }
  }
  if (witness.kind === 'failed') return {label: 'Verdict pending', tone: 'neutral', sentence: 'The independent record could not be loaded, so the trend has not been cross-examined yet.'};
  if (witness.kind === 'too-coarse') return {label: 'No verdict at this scale', tone: 'neutral', sentence: 'The independent record is coarser than the places compared, so it cannot judge this contrast.'};
  if (witness.kind === 'loading') return {label: 'Checking the witness…', tone: 'neutral', sentence: 'Loading the independent record.'};
  if (!significant) return {label: 'Not significant', tone: 'neutral', sentence: 'The change cannot yet be told apart from natural year-to-year swings.'};
  if (stepDominated) return {label: 'Significant, but jump-shaped', tone: 'warning', sentence: 'The record behaves like a single jump, and no independent record is available to check it.'};
  return {label: 'Significant, single-dataset claim', tone: 'warning', sentence: 'The trend passes the tests, but no independent record covers it yet.'};
}

/** The one limitation shown with each verdict, by variable. */
export const LIMITATION: Record<string, string> = {
  T2M: 'A 0.5° cell averages valleys and peaks; a trend says what changed, not why.',
  T2M_MAX: 'Single reanalysis; no independent record in this release.',
  T2M_MIN: 'Single reanalysis; no independent record in this release.',
  PRECTOTCORR: 'GPCP shares some rain gauges with MERRA-2, and the correction fades poleward of about 42°.',
  GWETROOT: 'Modelled from MERRA-2’s own rainfall, so it cannot confirm a rainfall trend.',
  RH2M: 'Single reanalysis; no independent record in this release.',
  WS2M: 'Single reanalysis; no independent record in this release.',
};
