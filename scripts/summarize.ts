/**
 * Write public/data/index.json: national headline statistics for every
 * packed nation, computed with the same engine the browser uses
 * (src/lib/stats.ts), so the numbers on the home page and the numbers a
 * reader recomputes in the atlas are produced by one implementation.
 *
 *   node scripts/summarize.ts
 *
 * pipeline/validate.py then recomputes these headlines independently in Python.
 */
import {readdirSync, readFileSync, writeFileSync, existsSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {BASELINE, FIRST_YEAR, LAST_YEAR, VARIABLES} from '../src/data/variables.ts';
import {analyzeSeries, annualAnomalies, fdrThreshold, monthlyClimatology, trendTest, weightedMean} from '../src/lib/stats.ts';

type Cell = {lat: number; lon: number; land: number; areaKm2: number};
type Meta = {iso3: string; name: string; rationale: string; cells: Cell[]; grid: {months: number; missing: number}};

const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data');
const years = Array.from({length: LAST_YEAR - FIRST_YEAR + 1}, (_, i) => FIRST_YEAR + i);
const base: [number, number] = [BASELINE[0] - FIRST_YEAR, BASELINE[1] - FIRST_YEAR];

function summarize(iso3: string) {
  const dir = join(DATA, 'nations', iso3);
  const meta: Meta = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8'));
  const weights = meta.cells.map(c => c.areaKm2);
  const total = weights.reduce((a, b) => a + b, 0);
  const stats: Record<string, unknown> = {};
  for (const v of VARIABLES) {
    const buf = readFileSync(join(dir, `${v.id}.i16`));
    const raw = new Int16Array(buf.buffer, buf.byteOffset, buf.byteLength / 2);
    const normals: number[] = [];
    const annual = meta.cells.map((_, ci) => {
      const monthly = Float64Array.from(raw.subarray(ci * meta.grid.months, (ci + 1) * meta.grid.months), q => (q === meta.grid.missing ? NaN : q * v.scale));
      const clim = monthlyClimatology(monthly, base[0], base[1]);
      normals.push((clim.reduce((a, b) => a + b, 0) / 12) * v.display);
      return annualAnomalies(monthly, clim);
    });
    const tests = annual.map(a => trendTest(years, a));
    const pStar = fdrThreshold(tests.map(t => t.p));
    if (v.id === 'T2M') {
      // Light per-cell preview for the home page's nation strip.
      const preview = {
        variable: 'T2M',
        slope: tests.map(t => Math.round(t.slope * 10 * 1000) / 1000),
        significant: tests.map(t => (pStar > 0 && t.p <= pStar ? 1 : 0)),
      };
      writeFileSync(join(dir, 'preview.json'), JSON.stringify(preview));
    }
    let up = 0;
    let down = 0;
    tests.forEach((t, i) => {
      if (pStar > 0 && t.p <= pStar) {
        if (t.slope > 0) up += weights[i];
        else down += weights[i];
      }
    });
    const national = years.map((_, yi) => weightedMean(annual.map(a => a[yi]), weights));
    const a = analyzeSeries(years, national);
    stats[v.id] = {
      normal: weightedMean(normals, weights),
      series: national.map(x => Math.round(x * v.display * 1000) / 1000),
      slopePerDecade: a.trend.slope * 10 * v.display,
      lowPerDecade: a.trend.slopeLow * 10 * v.display,
      highPerDecade: a.trend.slopeHigh * 10 * v.display,
      p: a.trend.p,
      snr: a.snr,
      breakYear: a.changePoint && a.changePoint.p < 0.05 ? a.changePoint.breakAt : null,
      areaUp: up / total,
      areaDown: down / total,
    };
  }
  const t = stats.T2M as {slopePerDecade: number; areaUp: number};
  console.log(`${iso3}: T2M ${t.slopePerDecade.toFixed(3)} °C/decade, ${(t.areaUp * 100).toFixed(0)}% of area significantly warming`);
  return {iso3, name: meta.name, rationale: meta.rationale, cells: meta.cells.length, areaKm2: Math.round(total), stats};
}

const nations = readdirSync(join(DATA, 'nations')).filter(n => existsSync(join(DATA, 'nations', n, 'meta.json')));
const summaries = nations.map(summarize).sort((a, b) => a.name.localeCompare(b.name));
writeFileSync(join(DATA, 'index.json'), JSON.stringify({firstYear: FIRST_YEAR, lastYear: LAST_YEAR, baseline: BASELINE, nations: summaries}));
console.log(`Wrote ${join(DATA, 'index.json')}`);
