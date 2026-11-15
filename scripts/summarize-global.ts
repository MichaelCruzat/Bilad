/**
 * Global atlas products, computed with the browser's statistics engine.
 *
 *   node scripts/summarize-global.ts
 *
 * Reads the global grid packed by `python -m pipeline global` (cache) and the
 * witness boxes written by `python -m pipeline crosscheck`, and writes for each
 * variable into public/data/global/:
 *   <VAR>.stats.bin   per-cell columns (see LAYOUT below)
 *   <VAR>.annual.i16  per-cell annual anomalies, cells x years
 * plus summary.json with global, area-weighted headlines.
 */
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {BASELINE, FIRST_YEAR, LAST_YEAR, getVariable} from '../src/data/variables.ts';
import {
  agreement,
  annualAnomalies,
  fdrThreshold,
  monthlyClimatology,
  signalToNoise,
  stepScreen,
  trendTest,
  weightedMean,
  type Agreement,
  type TrendTest,
} from '../src/lib/stats.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, 'pipeline', '.cache', 'global');
const OUT = join(ROOT, 'public', 'data', 'global');
const YEARS = Array.from({length: LAST_YEAR - FIRST_YEAR + 1}, (_, i) => FIRST_YEAR + i);
const NY = YEARS.length;
const MONTHS = NY * 12;
const BASE: [number, number] = [BASELINE[0] - FIRST_YEAR, BASELINE[1] - FIRST_YEAR];
export const AGREEMENTS: Agreement[] = ['corroborated', 'same-direction', 'weakly-supported', 'contradicted', 'unsupported', 'no-signal'];
const ANNUAL_SCALE: Record<string, number> = {T2M: 0.01, PRECTOTCORR: 0.1};

type Witness = {boxes: number; years: number};

function readWitness(variable: string, nCells: number): {series: Float64Array[]; cellBox: Uint16Array} | null {
  const file = join(OUT, `witness-${variable}.bin`);
  const infoFile = join(OUT, 'witness.json');
  if (!existsSync(file) || !existsSync(infoFile)) return null;
  const info = JSON.parse(readFileSync(infoFile, 'utf8'));
  const w: Witness = info[variable];
  const buf = readFileSync(file);
  const q = new Int16Array(buf.buffer, buf.byteOffset, w.boxes * w.years);
  const cellBox = new Uint16Array(buf.buffer.slice(buf.byteOffset + w.boxes * w.years * 2, buf.byteOffset + w.boxes * w.years * 2 + nCells * 2));
  const series = Array.from({length: w.boxes}, (_, b) => Float64Array.from(q.subarray(b * w.years, (b + 1) * w.years), v => (v === info.missing ? NaN : v * info.scale)));
  return {series, cellBox};
}

/** Witness series in reading units: anomaly vs 1991–2020, or % of that normal. */
function witnessReading(series: Float64Array, relative: boolean): Float64Array {
  const base = Array.from(series.subarray(BASE[0], BASE[1] + 1)).filter(Number.isFinite);
  const normal = base.reduce((s, v) => s + v, 0) / base.length;
  return series.map(v => (relative ? ((v - normal) / normal) * 100 : v - normal));
}

function summarize(variable: string, lat: number[], area: number[]) {
  const def = getVariable(variable);
  const n = lat.length;
  const buf = readFileSync(join(CACHE, `${variable}.i16`));
  const raw = new Int16Array(buf.buffer, buf.byteOffset, buf.byteLength / 2);
  const slope = new Float32Array(n).fill(NaN);
  const low = new Float32Array(n).fill(NaN);
  const high = new Float32Array(n).fill(NaN);
  const p = new Float32Array(n).fill(NaN);
  const snr = new Float32Array(n).fill(NaN);
  const normal = new Float32Array(n).fill(NaN);
  const flags = new Uint8Array(n);
  const agree = new Uint8Array(n).fill(255);
  const annualOut = new Int16Array(n * NY).fill(-32768);
  const tests: TrendTest[] = new Array(n);
  const anomaly: Float64Array[] = new Array(n);
  const scale = ANNUAL_SCALE[variable] ?? 0.01;

  for (let c = 0; c < n; c++) {
    const monthly = Float64Array.from(raw.subarray(c * MONTHS, (c + 1) * MONTHS), q => (q === -32768 ? NaN : q * def.scale));
    const clim = monthlyClimatology(monthly, BASE[0], BASE[1]);
    const mean = (clim.reduce((s, v) => s + v, 0) / 12) * def.display;
    normal[c] = mean;
    const abs = annualAnomalies(monthly, clim).map(v => v * def.display);
    anomaly[c] = abs;
    // Hyper-arid cells (< 0.1 mm/day) cannot be read as a share of normal.
    const reading = def.relative ? (mean >= 0.1 * def.display ? abs.map(v => (v / mean) * 100) : abs.map(() => NaN)) : abs;
    for (let y = 0; y < NY; y++) if (Number.isFinite(reading[y])) annualOut[c * NY + y] = Math.max(-32767, Math.min(32767, Math.round(reading[y] / scale)));
    const t = trendTest(YEARS, reading);
    tests[c] = t;
    if (t.n < 10) continue;
    slope[c] = t.slope * 10;
    low[c] = t.slopeLow * 10;
    high[c] = t.slopeHigh * 10;
    p[c] = t.p;
    snr[c] = signalToNoise(YEARS, reading, t);
    if (stepScreen(YEARS, reading)?.stepDominated) flags[c] |= 2;
  }

  const pStar = fdrThreshold(p);
  for (let c = 0; c < n; c++) if (pStar > 0 && p[c] <= pStar) flags[c] |= 1;

  const witness = readWitness(variable, n);
  if (witness) {
    const boxTests = witness.series.map(s => trendTest(YEARS, witnessReading(s, Boolean(def.relative))));
    for (let c = 0; c < n; c++) {
      if (!Number.isFinite(p[c])) continue;
      const wt = boxTests[witness.cellBox[c]];
      if (!wt || wt.n < 10) continue;
      const a = agreement(tests[c], wt);
      agree[c] = AGREEMENTS.indexOf(a);
      if (a === 'contradicted' || ((flags[c] & 2) !== 0 && a !== 'corroborated')) flags[c] |= 4;
    }
  }

  const columns = [slope, low, high, p, snr, normal].map(a => Buffer.from(a.buffer));
  writeFileSync(join(OUT, `${variable}.stats.bin`), Buffer.concat([...columns, Buffer.from(flags.buffer), Buffer.from(agree.buffer)]));
  writeFileSync(join(OUT, `${variable}.annual.i16`), Buffer.from(annualOut.buffer));

  // Global, area-weighted headlines.
  const total = area.reduce((s, a) => s + a, 0);
  const share = (pred: (c: number) => boolean) => area.reduce((s, a, c) => s + (pred(c) ? a : 0), 0) / total;
  const series = YEARS.map((_, y) => weightedMean(anomaly.map(a => a[y]), area));
  const globalNormal = weightedMean(normal, area);
  const reading = def.relative ? series.map(v => (v / globalNormal) * 100) : series;
  const g = trendTest(YEARS, reading);
  const agreeShares = Object.fromEntries(AGREEMENTS.map((name, k) => [name, share(c => agree[c] === k)]));
  console.log(`${variable}: ${n} cells, global land trend ${(g.slope * 10).toFixed(3)} per decade, ${(share(c => (flags[c] & 1) !== 0 && slope[c] > 0) * 100).toFixed(0)}% of land significantly up, ${(share(c => (flags[c] & 4) !== 0) * 100).toFixed(1)}% flagged`);
  return {
    cells: n,
    landAreaKm2: Math.round(total),
    pStar,
    series: reading.map(v => Math.round(v * 1000) / 1000),
    slopePerDecade: g.slope * 10,
    lowPerDecade: g.slopeLow * 10,
    highPerDecade: g.slopeHigh * 10,
    p: g.p,
    areaUp: share(c => (flags[c] & 1) !== 0 && slope[c] > 0),
    areaDown: share(c => (flags[c] & 1) !== 0 && slope[c] < 0),
    areaFlagged: share(c => (flags[c] & 4) !== 0),
    agreement: agreeShares,
    latitudes: {min: Math.min(...lat), max: Math.max(...lat)},
  };
}

const cells = JSON.parse(readFileSync(join(CACHE, 'cells.json'), 'utf8')) as {lat: number[]; lon: number[]; area: number[]};
const meta = JSON.parse(readFileSync(join(OUT, 'meta.json'), 'utf8')) as {variables: string[]};
const summary: Record<string, unknown> = {
  firstYear: FIRST_YEAR,
  lastYear: LAST_YEAR,
  baseline: BASELINE,
  agreements: AGREEMENTS,
  layout: {
    float32: ['slopePerDecade', 'lowPerDecade', 'highPerDecade', 'p', 'snr', 'normal'],
    uint8: ['flags (1 significant after FDR, 2 step-dominated, 4 artefact suspected)', 'agreement index, 255 none'],
    annualScale: ANNUAL_SCALE,
  },
  variables: {},
};
for (const v of meta.variables) (summary.variables as Record<string, unknown>)[v] = summarize(v, cells.lat, cells.area);
writeFileSync(join(OUT, 'summary.json'), JSON.stringify(summary));
console.log(`Wrote ${join(OUT, 'summary.json')}`);
