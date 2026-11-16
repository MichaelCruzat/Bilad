import {fullName} from './names';
/**
 * Loaders for the global atlas (public/data/global), written by
 * `make global`. Everything is column-major binary so ~70,000 cells load
 * as a handful of typed arrays.
 */
import {median, pairwiseSlopes, type Agreement} from './stats';

const base = `${import.meta.env.BASE_URL ?? './'}data/global/`;
const memo = new Map<string, Promise<unknown>>();

function once<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = memo.get(key);
  if (hit) return hit as Promise<T>;
  const p = load().catch(e => {
    memo.delete(key);
    throw e;
  });
  memo.set(key, p);
  return p;
}

async function bytes(name: string): Promise<ArrayBuffer> {
  const res = await fetch(base + name);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  return res.arrayBuffer();
}

async function json<T>(name: string): Promise<T> {
  const res = await fetch(base + name);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export type GlobalMeta = {
  cells: number;
  grid: {dLat: number; dLon: number; latMin: number; latMax: number; firstYear: number; lastYear: number};
  variables: string[];
  extent: [number, number, number, number];
  provenance: {api: string; sources: string[]; tiles: number; requests: number; retrieved: string};
};

export type GlobalCells = {n: number; lat: Float32Array; lon: Float32Array; area: Float32Array; land: Float32Array; country: Uint16Array};

export type Country = {id: string; name: string};

export type GlobalStats = {
  variable: string;
  slope: Float32Array;
  low: Float32Array;
  high: Float32Array;
  p: Float32Array;
  snr: Float32Array;
  normal: Float32Array;
  /** 1 significant after FDR, 2 step-dominated, 4 artefact suspected. */
  flags: Uint8Array;
  /** Index into `AGREEMENTS`, 255 when no witness. */
  agreement: Uint8Array;
  years: number;
};

export type GlobalSummary = {
  firstYear: number;
  lastYear: number;
  agreements: Agreement[];
  variables: Record<
    string,
    {
      cells: number;
      landAreaKm2: number;
      series: number[];
      slopePerDecade: number;
      lowPerDecade: number;
      highPerDecade: number;
      p: number;
      areaUp: number;
      areaDown: number;
      areaFlagged: number;
      agreement: Record<Agreement, number>;
    }
  >;
};

export type GlobalWitness = {boxes: Float32Array[]; cellBox: Uint16Array};

export const loadGlobalMeta = () => once('meta', () => json<GlobalMeta>('meta.json'));
export const loadGlobalSummary = () => once('summary', () => json<GlobalSummary>('summary.json'));

export const loadCountries = () =>
  once('countries', async () => (await json<Country[]>('countries.json')).map(c => ({...c, name: fullName(c.name)})));
export const globalReliefUrl = `${base}relief.jpg`;

export function loadGlobalCells(): Promise<GlobalCells> {
  return once('cells', async () => {
    const meta = await loadGlobalMeta();
    const n = meta.cells;
    const [buf, countryBuf] = await Promise.all([bytes('cells.bin'), bytes('country.bin')]);
    const lat = Float32Array.from(new Int16Array(buf, 0, n), v => v / 100);
    const lon = Float32Array.from(new Int32Array(buf.slice(n * 2, n * 6)), v => v / 1000);
    const area = new Float32Array(buf.slice(n * 6, n * 10));
    const land = Float32Array.from(new Uint8Array(buf, n * 10, n), v => v / 255);
    return {n, lat, lon, area, land, country: new Uint16Array(countryBuf)};
  });
}

export function loadGlobalStats(variable: string): Promise<GlobalStats> {
  return once(`stats:${variable}`, async () => {
    const [meta, summary] = await Promise.all([loadGlobalMeta(), loadGlobalSummary()]);
    const n = meta.cells;
    const years = summary.lastYear - summary.firstYear + 1;
    const buf = await bytes(`${variable}.stats.bin`);
    const col = (k: number) => new Float32Array(buf.slice(k * n * 4, (k + 1) * n * 4));
    return {
      variable,
      slope: col(0),
      low: col(1),
      high: col(2),
      p: col(3),
      snr: col(4),
      normal: col(5),
      flags: new Uint8Array(buf, 6 * n * 4, n),
      agreement: new Uint8Array(buf, 6 * n * 4 + n, n),
      years,
    };
  });
}

export function loadGlobalWitness(variable: string): Promise<GlobalWitness> {
  return once(`witness:${variable}`, async () => {
    const [meta, info] = await Promise.all([loadGlobalMeta(), json<Record<string, {boxes: number; years: number} | number>>('witness.json')]);
    const w = info[variable] as {boxes: number; years: number};
    const buf = await bytes(`witness-${variable}.bin`);
    const q = new Int16Array(buf, 0, w.boxes * w.years);
    const boxes = Array.from({length: w.boxes}, (_, b) => Float32Array.from(q.subarray(b * w.years, (b + 1) * w.years), v => (v === -32768 ? NaN : v * 0.01)));
    const cellBox = new Uint16Array(buf.slice(w.boxes * w.years * 2, w.boxes * w.years * 2 + meta.cells * 2));
    return {boxes, cellBox};
  });
}

/** Annual readings (°C anomaly or % of normal), cells x years, NaN missing. Loaded on demand. */
export function loadGlobalAnnual(variable: string): Promise<Float32Array> {
  return once(`annual:${variable}`, async () => {
    const scale = variable === 'PRECTOTCORR' ? 0.1 : 0.01;
    return Float32Array.from(new Int16Array(await bytes(`${variable}.annual.i16`)), v => (v === -32768 ? NaN : v * scale));
  });
}

/**
 * The witness's own trend at every cell, in units per decade: a Theil–Sen
 * slope for each witness grid box (boxes with under ten years are left out,
 * matching the shipped verdict classifier),
 * copied to the cells that sample it. Used to draw what the stations say on
 * the same scale as the reanalysis.
 */
export function witnessCellSlopes(w: GlobalWitness, cells: number, firstYear: number): Float32Array {
  const perBox = w.boxes.map(series => {
    const t: number[] = [];
    const y: number[] = [];
    series.forEach((v, i) => {
      if (Number.isFinite(v)) {
        t.push(firstYear + i);
        y.push(v);
      }
    });
    return y.length < 10 ? NaN : median(pairwiseSlopes(t, y)) * 10;
  });
  const out = new Float32Array(cells);
  for (let c = 0; c < cells; c++) out[c] = perBox[w.cellBox[c]] ?? NaN;
  return out;
}
