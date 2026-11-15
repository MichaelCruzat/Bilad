import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {analyzeVariable, cellsInBand, subsetSeries} from '../src/lib/analysis';
import {coBreaks, crossExamine, witnessSeries, type Crosscheck} from '../src/lib/evidence';
import {decodeGrid, type DataIndex, type NationMeta} from '../src/lib/nationData';

const DATA = join(__dirname, '..', 'public', 'data');
const index: DataIndex = JSON.parse(readFileSync(join(DATA, 'index.json'), 'utf8'));
const xc: Crosscheck = JSON.parse(readFileSync(join(DATA, 'crosscheck.json'), 'utf8'));
const FULL = {from: 1981, to: 2024};

function load(iso3: string, variable: string) {
  const meta: NationMeta = JSON.parse(readFileSync(join(DATA, 'nations', iso3, 'meta.json'), 'utf8'));
  const buf = readFileSync(join(DATA, 'nations', iso3, `${variable}.i16`));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const scale = meta.variables.find(v => v.id === variable)!.scale;
  return {meta, grid: decodeGrid(ab, scale, meta.grid.missing, meta.grid.months, variable)};
}

describe('shipped data', () => {
  it('ships six nations with seven variables each', () => {
    expect(index.nations.map(n => n.iso3).sort()).toEqual(['BGD', 'CHL', 'ESP', 'KEN', 'MAR', 'MEX']);
    index.nations.forEach(n => expect(Object.keys(n.stats)).toHaveLength(7));
  });

  it('browser recomputation reproduces the pipeline headline for every nation', () => {
    for (const n of index.nations) {
      const {meta, grid} = load(n.iso3, 'T2M');
      const a = analyzeVariable(meta, grid, FULL);
      expect(a.national.slopeDecade).toBeCloseTo(n.stats.T2M.slopePerDecade, 2);
      expect(a.areaUp).toBeCloseTo(n.stats.T2M.areaUp, 1);
    }
  });
});

describe('case verdicts', () => {
  const years = Array.from({length: 44}, (_, i) => 1981 + i);

  it('Bangladesh: reanalysis cooling is contradicted by GISTEMP and flagged', () => {
    const {meta, grid} = load('BGD', 'T2M');
    const a = analyzeVariable(meta, grid, FULL);
    const x = crossExamine(years, a.national.series, witnessSeries(xc, 'BGD', 'T2M', FULL)!);
    expect(x.claim.slope).toBeLessThan(0);
    expect(x.witness.slope).toBeGreaterThan(0);
    expect(x.verdict).toBe('contradicted');
    expect(x.artifactSuspected).toBe(true);
    expect(x.claimStep!.breakAt).toBeGreaterThanOrEqual(1996);
    expect(x.claimStep!.breakAt).toBeLessThanOrEqual(1999);
    const cb = coBreaks(index, 'BGD');
    expect(cb.some(g => g.year >= 1996 && g.year <= 1999 && g.variables.length >= 3)).toBe(true);
  });

  it('Chile: national warming agrees with GISTEMP', () => {
    const {meta, grid} = load('CHL', 'T2M');
    const a = analyzeVariable(meta, grid, FULL);
    const x = crossExamine(years, a.national.series, witnessSeries(xc, 'CHL', 'T2M', FULL)!);
    expect(x.verdict).toBe('corroborated');
    expect(x.artifactSuspected).toBe(false);
  });

  it('Central Chile: rainfall decline agrees with GPCP', () => {
    const {meta, grid} = load('CHL', 'PRECTOTCORR');
    const a = analyzeVariable(meta, grid, FULL);
    const central = meta.regions.find(r => r.id === 'central')!;
    const cells = cellsInBand(meta, central.latMin, central.latMax);
    const mine = subsetSeries(meta, a, cells);
    const x = crossExamine(years, mine, witnessSeries(xc, 'CHL', 'PRECTOTCORR', FULL, 'central')!);
    expect(x.claim.slope).toBeLessThan(0);
    expect(x.witness.slope).toBeLessThan(0);
    expect(['corroborated', 'same-direction']).toContain(x.verdict);
  });

  it('Kenya: same direction, but the reanalysis warms more slowly', () => {
    const {meta, grid} = load('KEN', 'T2M');
    const a = analyzeVariable(meta, grid, FULL);
    const x = crossExamine(years, a.national.series, witnessSeries(xc, 'KEN', 'T2M', FULL)!);
    expect(x.claim.slope).toBeGreaterThan(0);
    expect(x.witness.slope).toBeGreaterThan(x.claim.slope);
    expect(['same-direction', 'corroborated']).toContain(x.verdict);
  });
});
