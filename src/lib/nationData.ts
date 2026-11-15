/**
 * Browser loaders for pipeline output in public/data. Every fetch is
 * memoised for the session; a failed fetch is evicted so it can be retried.
 */
import type {Feature, MultiPolygon} from 'geojson';
import {getVariable} from '../data/variables';

export type Cell = {lat: number; lon: number; land: number; areaKm2: number};

export type NationMeta = {
  iso3: string;
  name: string;
  rationale: string;
  regions: {id: string; name: string; latMin: number; latMax: number}[];
  grid: {dLat: number; dLon: number; firstYear: number; lastYear: number; months: number; missing: number};
  cells: Cell[];
  variables: {id: string; scale: number}[];
  provenance: {api: string; sources: string[]; community: string; retrieved: string; requests: {variable: string; url: string}[]};
};

export type NationSummaryStat = {
  /** Area-weighted 1991–2020 normal, display units. */
  normal: number;
  /** National annual anomaly, display units. */
  series: number[];
  slopePerDecade: number;
  lowPerDecade: number;
  highPerDecade: number;
  p: number;
  snr: number;
  breakYear: number | null;
  areaUp: number;
  areaDown: number;
};

export type NationSummary = {
  iso3: string;
  name: string;
  rationale: string;
  cells: number;
  areaKm2: number;
  stats: Record<string, NationSummaryStat>;
};

export type DataIndex = {firstYear: number; lastYear: number; baseline: [number, number]; nations: NationSummary[]};

export type Boundary = Feature<MultiPolygon>;

/** Monthly values for one variable: `values[cell * months + month]`, in source units, NaN = missing. */
export type VariableGrid = {variable: string; months: number; values: Float32Array};

const base = `${import.meta.env.BASE_URL ?? './'}data/`;
const memo = new Map<string, Promise<unknown>>();

function once<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = memo.get(key);
  if (hit) return hit as Promise<T>;
  const promise = load().catch(error => {
    memo.delete(key);
    throw error;
  });
  memo.set(key, promise);
  return promise;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(base + path);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export const loadIndex = () => once('index', () => getJson<DataIndex>('index.json'));
export const loadMeta = (iso3: string) => once(`meta:${iso3}`, () => getJson<NationMeta>(`nations/${iso3}/meta.json`));
export const loadBoundary = (iso3: string) => once(`boundary:${iso3}`, () => getJson<Boundary>(`nations/${iso3}/boundary.json`));
export const loadWorld = () => once('world', () => getJson<unknown>('world-110m.json'));

export function decodeGrid(buffer: ArrayBuffer, scale: number, missing: number, months: number, variable: string): VariableGrid {
  const raw = new Int16Array(buffer);
  const values = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i++) values[i] = raw[i] === missing ? NaN : raw[i] * scale;
  return {variable, months, values};
}

export function loadGrid(meta: NationMeta, variable: string): Promise<VariableGrid> {
  return once(`grid:${meta.iso3}:${variable}`, async () => {
    const res = await fetch(`${base}nations/${meta.iso3}/${variable}.i16`);
    if (!res.ok) throw new Error(`${variable}: HTTP ${res.status}`);
    const scale = meta.variables.find(v => v.id === variable)?.scale ?? getVariable(variable).scale;
    return decodeGrid(await res.arrayBuffer(), scale, meta.grid.missing, meta.grid.months, variable);
  });
}

/** Monthly series for one cell (a view, not a copy). */
export function cellSeries(grid: VariableGrid, cell: number): Float32Array {
  return grid.values.subarray(cell * grid.months, (cell + 1) * grid.months);
}
