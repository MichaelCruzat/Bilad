/**
 * Grid-wide analysis of one variable over one window. Pure: takes decoded
 * data, returns typed arrays. Used by the atlas, the brief and the tests.
 */
import {BASELINE, getVariable} from '../data/variables';
import {
  analyzeSeries,
  annualAnomalies,
  calendarMonth,
  fdrThreshold,
  monthlyClimatology,
  pettitt,
  signalToNoise,
  startYearSensitivity,
  trendTest,
  weightedMean,
  type SeriesAnalysis,
  type StartYearPoint,
  type TrendTest,
} from './stats';
import type {NationMeta, VariableGrid} from './nationData';

export type Window = {from: number; to: number};

/** Cells with fewer valid annual values than this are left out of the field test. */
export const MIN_YEARS = 10;

/** Unit in which trends of a variable are read. */
export function trendUnit(variable: string): string {
  const def = getVariable(variable);
  return def.relative ? '% of normal' : def.changeUnit ?? def.unit;
}

export type VariableAnalysis = {
  variable: string;
  window: Window;
  years: number[];
  /** Annual values as mapped: anomaly vs 1991–2020 in display units, or % of the cell's normal for relative variables. `annual[cell * years.length + y]`. */
  annual: Float32Array;
  /** Annual anomaly vs 1991–2020 in display units for every cell (never a percentage). */
  anomaly: Float32Array;
  /** Mean annual value over the baseline, display units (the "normal"). */
  normal: Float32Array;
  /** Theil–Sen slope and 95% bounds, display units per decade. */
  slope: Float32Array;
  low: Float32Array;
  high: Float32Array;
  /** Hamed–Rao corrected p-value. */
  p: Float32Array;
  snr: Float32Array;
  /** First year of the new regime, 0 when the Pettitt p >= 0.05. */
  breakYear: Int16Array;
  /** Benjamini–Hochberg threshold (0 when nothing passes). */
  pStar: number;
  significant: Uint8Array;
  /** cells: all; tested: with >= MIN_YEARS of data; naive: p < 0.05; fdr: pass BH. */
  counts: {cells: number; tested: number; naive: number; fdr: number};
  areaUp: number;
  areaDown: number;
  national: NationalAnalysis;
};

export type NationalAnalysis = {
  series: Float64Array;
  normal: number;
  analysis: SeriesAnalysis;
  slopeDecade: number;
  lowDecade: number;
  highDecade: number;
};

export function yearsOf(window: Window): number[] {
  return Array.from({length: window.to - window.from + 1}, (_, i) => window.from + i);
}

export function cellWeights(meta: NationMeta): Float64Array {
  return Float64Array.from(meta.cells, c => c.areaKm2);
}

/** Annual anomalies (display units) for every cell over the whole record. */
function fullAnnual(meta: NationMeta, grid: VariableGrid): {annual: Float32Array[]; normal: Float32Array} {
  const def = getVariable(grid.variable);
  const first = meta.grid.firstYear;
  const baseFrom = BASELINE[0] - first;
  const baseTo = BASELINE[1] - first;
  const normal = new Float32Array(meta.cells.length);
  const annual = meta.cells.map((_, ci) => {
    const monthly = grid.values.subarray(ci * grid.months, (ci + 1) * grid.months);
    const clim = monthlyClimatology(monthly, baseFrom, baseTo);
    let s = 0;
    for (let m = 0; m < 12; m++) s += clim[m];
    normal[ci] = (s / 12) * def.display;
    const a = annualAnomalies(monthly, clim);
    for (let i = 0; i < a.length; i++) a[i] *= def.display;
    return Float32Array.from(a);
  });
  return {annual, normal};
}

export function analyzeVariable(meta: NationMeta, grid: VariableGrid, window: Window, alphaFdr = 0.1): VariableAnalysis {
  const nCells = meta.cells.length;
  const years = yearsOf(window);
  const ny = years.length;
  const offset = window.from - meta.grid.firstYear;
  const {annual: full, normal} = fullAnnual(meta, grid);
  const annual = new Float32Array(nCells * ny);
  const anomaly = new Float32Array(nCells * ny);
  const slope = new Float32Array(nCells);
  const low = new Float32Array(nCells);
  const high = new Float32Array(nCells);
  const p = new Float32Array(nCells);
  const snr = new Float32Array(nCells);
  const breakYear = new Int16Array(nCells);

  const def = getVariable(grid.variable);
  // Too dry to express change as a percentage (< 0.1 mm/day, i.e. hyper-arid).
  const minNormal = 0.1 * def.display;
  for (let c = 0; c < nCells; c++) {
    const raw = full[c].subarray(offset, offset + ny);
    anomaly.set(raw, c * ny);
    const y = def.relative ? raw.map(v => (normal[c] >= minNormal ? (v / normal[c]) * 100 : NaN)) : raw;
    annual.set(y, c * ny);
    const t = trendTest(years, y);
    if (t.n < MIN_YEARS) {
      slope[c] = low[c] = high[c] = snr[c] = NaN;
      p[c] = NaN;
      continue;
    }
    slope[c] = t.slope * 10;
    low[c] = t.slopeLow * 10;
    high[c] = t.slopeHigh * 10;
    p[c] = t.p;
    snr[c] = signalToNoise(years, y, t);
    const cp = pettitt(years, y);
    breakYear[c] = cp && cp.p < 0.05 ? cp.breakAt : 0;
  }

  const pStar = fdrThreshold(p, alphaFdr);
  const significant = new Uint8Array(nCells);
  const weights = cellWeights(meta);
  const total = weights.reduce((a, b) => a + b, 0);
  let naive = 0;
  let fdr = 0;
  let up = 0;
  let down = 0;
  let tested = 0;
  for (let c = 0; c < nCells; c++) {
    if (!Number.isFinite(p[c])) continue;
    tested++;
    if (p[c] < 0.05) naive++;
    if (pStar > 0 && p[c] <= pStar) {
      significant[c] = 1;
      fdr++;
      if (slope[c] > 0) up += weights[c];
      else down += weights[c];
    }
  }

  // National series: area-weighted anomaly in physical units; for relative
  // variables, divided by the area-weighted normal (so dry cells do not dominate).
  const series = new Float64Array(ny);
  const column = new Float64Array(nCells);
  const nationalNormal = weightedMean(normal, weights);
  for (let yi = 0; yi < ny; yi++) {
    for (let c = 0; c < nCells; c++) column[c] = full[c][offset + yi];
    const v = weightedMean(column, weights);
    series[yi] = def.relative ? (v / nationalNormal) * 100 : v;
  }
  const nat = analyzeSeries(years, series);

  return {
    variable: grid.variable,
    window,
    years,
    annual,
    anomaly,
    normal,
    slope,
    low,
    high,
    p,
    snr,
    breakYear,
    pStar,
    significant,
    counts: {cells: nCells, tested, naive, fdr},
    areaUp: up / total,
    areaDown: down / total,
    national: {
      series,
      normal: nationalNormal,
      analysis: nat,
      slopeDecade: nat.trend.slope * 10,
      lowDecade: nat.trend.slopeLow * 10,
      highDecade: nat.trend.slopeHigh * 10,
    },
  };
}

/** Annual series (display units) for one cell, or the nation when cell is null. */
export function seriesFor(a: VariableAnalysis, cell: number | null): Float64Array {
  if (cell === null) return a.national.series;
  const ny = a.years.length;
  return Float64Array.from(a.annual.subarray(cell * ny, (cell + 1) * ny));
}

export function analysisFor(a: VariableAnalysis, cell: number | null): SeriesAnalysis {
  if (cell === null) return a.national.analysis;
  return analyzeSeries(a.years, seriesFor(a, cell));
}

export function sensitivityFor(a: VariableAnalysis, cell: number | null): StartYearPoint[] {
  const minLength = Math.min(20, Math.max(10, a.years.length - 5));
  return startYearSensitivity(a.years, seriesFor(a, cell), minLength).map(pt => ({
    ...pt,
    slope: pt.slope * 10,
    slopeLow: pt.slopeLow * 10,
    slopeHigh: pt.slopeHigh * 10,
  }));
}

/**
 * Per-calendar-month trend (display units per decade) for a cell or the
 * area-weighted nation. Answers "which part of the year is changing".
 */
export function seasonalTrends(meta: NationMeta, grid: VariableGrid, window: Window, cell: number | number[] | null): TrendTest[] {
  const def = getVariable(grid.variable);
  const years = yearsOf(window);
  const offset = window.from - meta.grid.firstYear;
  let monthly: Float64Array;
  if (typeof cell === 'number') {
    monthly = Float64Array.from(grid.values.subarray(cell * grid.months, (cell + 1) * grid.months));
  } else {
    const ids = cell ?? meta.cells.map((_, i) => i);
    const weights = ids.map(c => meta.cells[c].areaKm2);
    monthly = new Float64Array(grid.months);
    const column = new Float64Array(ids.length);
    for (let m = 0; m < grid.months; m++) {
      ids.forEach((c, k) => (column[k] = grid.values[c * grid.months + m]));
      monthly[m] = weightedMean(column, weights);
    }
  }
  return Array.from({length: 12}, (_, month) => {
    const y = calendarMonth(monthly, month).subarray(offset, offset + years.length);
    const t = trendTest(years, y);
    // Relative variables: per-month change as % of that month's own normal.
    let f = 10 * def.display;
    if (def.relative) {
      const base = calendarMonth(monthly, month).subarray(BASELINE[0] - meta.grid.firstYear, BASELINE[1] - meta.grid.firstYear + 1);
      let s = 0, n = 0;
      base.forEach(v => { if (Number.isFinite(v)) { s += v; n++; } });
      const m = n ? s / n : NaN;
      f = m >= 0.1 ? 1000 / m : NaN;
    }
    return {...t, slope: t.slope * f, slopeLow: t.slopeLow * f, slopeHigh: t.slopeHigh * f};
  });
}

/** Mean of anomalies over a block of years relative to another block (display units). */
export function periodDifference(series: ArrayLike<number>, years: number[], a: Window, b: Window): number {
  const pick = (w: Window) => {
    const vals: number[] = [];
    years.forEach((yr, i) => {
      if (yr >= w.from && yr <= w.to) vals.push(series[i]);
    });
    return vals;
  };
  const mean = (v: number[]) => v.reduce((s, x) => s + x, 0) / v.length;
  return mean(pick(b)) - mean(pick(a));
}

/** Indices of cells whose latitude falls in [latMin, latMax]. */
export function cellsInBand(meta: NationMeta, latMin: number, latMax: number): number[] {
  return meta.cells.flatMap((c, i) => (c.lat >= latMin && c.lat <= latMax ? [i] : []));
}

/**
 * Area-weighted annual series over a subset of cells, built exactly like the
 * national series (and like the witnesses): the weighted anomaly, divided by
 * the weighted normal for relative variables. Every cell counts, including
 * hyper-arid ones that cannot be mapped as a percentage.
 */
export function subsetSeries(meta: NationMeta, a: VariableAnalysis, cells: number[]): Float64Array {
  const relative = Boolean(getVariable(a.variable).relative);
  const ny = a.years.length;
  const out = new Float64Array(ny);
  const w = cells.map(c => meta.cells[c].areaKm2);
  const normal = weightedMean(cells.map(c => a.normal[c]), w);
  for (let yi = 0; yi < ny; yi++) {
    const v = weightedMean(cells.map(c => a.anomaly[c * ny + yi]), w);
    out[yi] = relative ? (v / normal) * 100 : v;
  }
  return out;
}

/**
 * Area-weighted annual series in physical display units (for example mm/yr)
 * over a subset of cells, rebuilt from each cell's normal and anomaly.
 */
export function subsetAbsolute(meta: NationMeta, a: VariableAnalysis, cells: number[]): Float64Array {
  const ny = a.years.length;
  const out = new Float64Array(ny);
  const w = cells.map(c => meta.cells[c].areaKm2);
  for (let yi = 0; yi < ny; yi++) {
    out[yi] = weightedMean(cells.map(c => a.normal[c] + a.anomaly[c * ny + yi]), w);
  }
  return out;
}

/** West-most and east-most cell of every grid row within a latitude band. */
export function rowEdges(meta: NationMeta, latMin: number, latMax: number): {west: number[]; east: number[]} {
  const rows = new Map<number, number[]>();
  meta.cells.forEach((c, i) => {
    if (c.lat < latMin || c.lat > latMax) return;
    rows.set(c.lat, [...(rows.get(c.lat) ?? []), i]);
  });
  const west: number[] = [];
  const east: number[] = [];
  rows.forEach(ids => {
    if (ids.length < 3) return;
    ids.sort((x, y) => meta.cells[x].lon - meta.cells[y].lon);
    west.push(ids[0]);
    east.push(ids[ids.length - 1]);
  });
  return {west, east};
}
