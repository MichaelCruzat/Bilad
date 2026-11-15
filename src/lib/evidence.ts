/**
 * Independent witnesses and integrity screens.
 *
 * A reanalysis trend is a claim; Bilad cross-examines it against an
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
 * Witness annual series for a window, in the same reading units as Bilad's
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

export const VERDICT_TEXT: Record<Agreement, {label: string; tone: 'success' | 'warning' | 'error' | 'neutral'; plain: string}> = {
  corroborated: {label: 'Corroborated', tone: 'success', plain: 'Both records show a significant change in the same direction, and their ranges overlap.'},
  'same-direction': {label: 'Same direction, different size', tone: 'warning', plain: 'Both records agree on the direction, but not on how fast; their 95% ranges do not overlap.'},
  'weakly-supported': {label: 'Weakly supported', tone: 'warning', plain: 'One record shows a significant change; the other leans the same way without reaching significance.'},
  contradicted: {label: 'Contradicted', tone: 'error', plain: 'The two records show significant changes in opposite directions. At least one of them is wrong here.'},
  unsupported: {label: 'Not supported', tone: 'error', plain: 'One record shows a significant change; the other leans the opposite way.'},
  'no-signal': {label: 'No detectable trend', tone: 'neutral', plain: 'Neither record shows a significant change over this window.'},
};

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
