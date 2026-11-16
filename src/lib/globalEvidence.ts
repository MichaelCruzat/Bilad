import {BASELINE} from '../data/variables';
import type {GlobalCells, GlobalStats, GlobalWitness} from './globalData';
import {weightedMean} from './stats';

/** Area-weighted series over cells; for relative variables weight by normal too (total anomaly / total normal). */
export function aggregateGlobal(cells: GlobalCells, stats: GlobalStats, annual: Float32Array, ids: number[], relative: boolean): Float64Array {
  const ny = stats.years;
  const out = new Float64Array(ny);
  const w = ids.map(c => cells.area[c] * (relative ? Math.max(0, stats.normal[c]) : 1));
  for (let y = 0; y < ny; y++) out[y] = weightedMean(ids.map(c => annual[c * ny + y]), w);
  return out;
}

/** Witness series for a set of cells in the same reading units as TRACE's series. */
export function aggregateGlobalWitness(cells: GlobalCells, w: GlobalWitness, ids: number[], ny: number, firstYear: number, relative: boolean): Float64Array {
  const raw = new Float64Array(ny);
  const total = ids.reduce((s, c) => s + cells.area[c], 0);
  for (let y = 0; y < ny; y++) {
    let sum = 0;
    let ws = 0;
    for (const c of ids) {
      const v = w.boxes[w.cellBox[c]]?.[y];
      if (v !== undefined && Number.isFinite(v)) {
        sum += v * cells.area[c];
        ws += cells.area[c];
      }
    }
    raw[y] = ws >= total / 2 ? sum / ws : NaN;
  }
  const base = Array.from(raw.subarray(BASELINE[0] - firstYear, BASELINE[1] - firstYear + 1)).filter(Number.isFinite);
  const normal = base.reduce((s, v) => s + v, 0) / base.length;
  return raw.map(v => (relative ? ((v - normal) / normal) * 100 : v - normal));
}
