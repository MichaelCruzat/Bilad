import {describe, expect, it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {witnessCellSlopes} from '../src/lib/globalData';
import {stepScreen} from '../src/lib/stats';

describe('witness cell trends', () => {
  it('shows a station slope for the same ten-year minimum used by the verdict classifier', () => {
    const boxes = [Float32Array.from({length: 44}, (_, i) => i < 10 ? i * 0.1 : NaN)];
    const slopes = witnessCellSlopes({boxes, cellBox: new Uint16Array([0])}, 1, 1981);
    expect(slopes[0]).toBeCloseTo(1, 5);
  });

  it('leaves station slopes blank below ten usable years', () => {
    const boxes = [Float32Array.from({length: 9}, (_, i) => i * 0.1)];
    expect(witnessCellSlopes({boxes, cellBox: new Uint16Array([0])}, 1, 1981)[0]).toBeNaN();
  });
});

it('never flags a shared jump as a reanalysis-only artefact in shipped global data', () => {
  const data = join(__dirname, '../public/data/global');
  const meta = JSON.parse(readFileSync(join(data, 'meta.json'), 'utf8'));
  const info = JSON.parse(readFileSync(join(data, 'witness.json'), 'utf8'));
  const summary = JSON.parse(readFileSync(join(data, 'summary.json'), 'utf8'));
  for (const variable of meta.variables) {
    const stats = readFileSync(join(data, `${variable}.stats.bin`));
    const flags = stats.subarray(meta.cells * 24, meta.cells * 25);
    const agreement = stats.subarray(meta.cells * 25, meta.cells * 26);
    const raw = readFileSync(join(data, `witness-${variable}.bin`));
    const w = info[variable];
    const q = new Int16Array(raw.buffer, raw.byteOffset, w.boxes * w.years);
    const mapping = new Uint16Array(raw.buffer.slice(raw.byteOffset + w.boxes * w.years * 2));
    const years = Array.from({length: w.years}, (_, i) => meta.grid.firstYear + i);
    const jumps = Array.from({length: w.boxes}, (_, b) => {
      const values = Float64Array.from(q.subarray(b * w.years, (b + 1) * w.years), v => v === info.missing ? NaN : v * info.scale);
      const baseline = Array.from(values.subarray(1991 - meta.grid.firstYear, 2021 - meta.grid.firstYear)).filter(Number.isFinite);
      const normal = baseline.reduce((s, v) => s + v, 0) / baseline.length;
      const reading = values.map(v => variable === 'PRECTOTCORR' ? (v - normal) / normal * 100 : v - normal);
      return Boolean(stepScreen(years, reading)?.stepDominated);
    });
    const contradictions = summary.agreements.indexOf('contradicted');
    const wrong: number[] = [];
    for (let c = 0; c < meta.cells; c++) {
      if ((flags[c] & 4) && (flags[c] & 2) && agreement[c] !== contradictions && jumps[mapping[c]]) wrong.push(c);
    }
    expect(wrong, `${variable}: shared-jump cells flagged as reanalysis-only artefacts`).toEqual([]);
  }
});
