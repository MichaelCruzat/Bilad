/**
 * Headline findings for Home, Impact and Explore, computed with the app's own
 * modules (aggregation, trend tests, cross-examination) so the numbers on the
 * page are exactly what the explorer would show for the same selection.
 *
 *   node scripts/global-findings.mjs      (after scripts/summarize-global.ts)
 *
 * Writes public/data/global/findings.json:
 *   - all covered land: trends with sample sizes, verdict, interval overlap, rate ratio
 *   - every country with at least 12 cells: its national verdict, grouped
 *   - each country's witness coverage (area-weighted gridded cell-year
 *     availability) and its descriptive rank correlation with flagged land share
 */
import {readFileSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(ROOT, 'public');

// The loaders fetch './data/global/…'; serve those from disk.
globalThis.fetch = async url => {
  const buf = readFileSync(join(PUBLIC, String(url).replace(/^.*?data\//, 'data/')));
  return {
    ok: true,
    status: 200,
    json: async () => JSON.parse(buf.toString('utf8')),
    text: async () => buf.toString('utf8'),
    arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  };
};

const vite = await createServer({root: ROOT, logLevel: 'error', server: {middlewareMode: true}, appType: 'custom'});
try {
  const g = await vite.ssrLoadModule('/src/lib/globalData.ts');
  const {aggregateGlobal, aggregateGlobalWitness} = await vite.ssrLoadModule('/src/lib/globalEvidence.ts');
  const {crossExamine} = await vite.ssrLoadModule('/src/lib/crossExamine.ts');
  const {spearman} = await vite.ssrLoadModule('/src/lib/rank.ts');
  const [meta, cells, countries] = await Promise.all([g.loadGlobalMeta(), g.loadGlobalCells(), g.loadCountries()]);
  const out = {
    window: [meta.grid.firstYear, meta.grid.lastYear],
    metadata: {
      coverage: 'Land-area-weighted fraction of gridded cell-years with finite witness values over the analysis window. Coverage measures gridded availability, not station density or source reliability.',
      coverageVsFlagged: 'Descriptive Spearman correlation between coverage and flagged land share across countries with at least 12 MERRA-2 cells, using average ranks for ties. This correlation cannot establish product quality. Null means insufficient pairs, constant vectors or non-finite inputs.',
      intervalsOverlap: 'Whether the two marginal 95% slope intervals overlap, computed before rounding. Overlap does not establish equal rates. Null means an interval is unavailable or invalid.',
      ratio: 'MERRA-2 point estimate divided by the witness point estimate, using unrounded slopes. Null means either estimate is non-finite or zero, or the ratio is non-finite or zero.',
    },
    variables: {},
  };
  const trend = t => ({
    perDecade: round(t.slope * 10),
    low: round(t.slopeLow * 10),
    high: round(t.slopeHigh * 10),
    p: Number.isFinite(t.p) ? t.p : null,
    n: t.n,
  });

  for (const variable of meta.variables) {
    const relative = variable === 'PRECTOTCORR';
    const [stats, annual, witness] = await Promise.all([g.loadGlobalStats(variable), g.loadGlobalAnnual(variable), g.loadGlobalWitness(variable)]);
    const years = Array.from({length: stats.years}, (_, i) => meta.grid.firstYear + i);
    out.window = [years[0], years.at(-1)];
    const exam = ids => crossExamine(years, aggregateGlobal(cells, stats, annual, ids, relative), aggregateGlobalWitness(cells, witness, ids, stats.years, years[0], relative));

    const all = exam(Array.from({length: cells.n}, (_, c) => c));
    const byCountry = new Map();
    for (let c = 0; c < cells.n; c++) {
      const k = cells.country[c];
      if (k === 65535) continue;
      if (!byCountry.has(k)) byCountry.set(k, []);
      byCountry.get(k).push(c);
    }

    const groups = {corroborated: [], slower: [], faster: [], weak: [], against: [], artefact: [], none: []};
    const coverage = {};
    const pairs = [];
    for (const [k, ids] of byCountry) {
      const country = countries[k];
      let area = 0, covered = 0, flagged = 0;
      for (const c of ids) {
        const box = witness.cellBox[c];
        const series = box === 65535 ? null : witness.boxes[box];
        const n = series ? series.reduce((m, v) => m + (Number.isFinite(v) ? 1 : 0), 0) : 0;
        area += cells.area[c];
        covered += (cells.area[c] * n) / stats.years;
        if (stats.flags[c] & 4) flagged += cells.area[c];
      }
      coverage[country.id] = round(covered / area);
      if (ids.length < 12) continue;
      pairs.push([covered / area, flagged / area]);
      const x = exam(ids);
      if (x.witness.n < 10) continue;
      const entry = {id: country.id, name: country.name, claim: round(x.claim.slope * 10), witness: round(x.witness.slope * 10)};
      if (x.artifactSuspected) groups.artefact.push(entry);
      else if (x.verdict === 'corroborated') groups.corroborated.push(entry);
      else if (x.verdict === 'same-direction') (Math.abs(x.claim.slope) < Math.abs(x.witness.slope) ? groups.slower : groups.faster).push(entry);
      else if (x.verdict === 'weakly-supported') groups.weak.push(entry);
      else if (x.verdict === 'contradicted' || x.verdict === 'unsupported') groups.against.push(entry);
      else groups.none.push(entry);
    }
    for (const list of Object.values(groups)) list.sort((a, b) => a.name.localeCompare(b.name));

    out.variables[variable] = {
      allLand: {
        claim: trend(all.claim),
        witness: trend(all.witness),
        verdict: all.verdict,
        intervalsOverlap: intervalsOverlap(all.claim, all.witness),
        ratio: rateRatio(all.claim.slope, all.witness.slope),
      },
      countriesExamined: Object.values(groups).reduce((n, l) => n + l.length, 0),
      groups,
      coverage,
      coverageVsFlagged: round(spearman(pairs.map(p => p[0]), pairs.map(p => p[1]))),
    };
    const v = out.variables[variable];
    console.log(`${variable}: all land ${v.allLand.claim.perDecade} vs ${v.allLand.witness.perDecade} (${all.verdict}); ${v.countriesExamined} countries: ${Object.entries(groups).map(([k, l]) => `${k} ${l.length}`).join(', ')}; coverage vs flagged ρ = ${v.coverageVsFlagged}`);
  }
  writeFileSync(join(PUBLIC, 'data', 'global', 'findings.json'), JSON.stringify(out));
  console.log('Wrote public/data/global/findings.json');
} finally {
  await vite.close();
}

function round(v) {
  if (!Number.isFinite(v)) return null;
  const rounded = Math.round(v * 1000) / 1000;
  return Number.isFinite(rounded) ? rounded : null;
}

function intervalsOverlap(a, b) {
  const bounds = [a.slopeLow, a.slopeHigh, b.slopeLow, b.slopeHigh];
  if (!bounds.every(Number.isFinite) || a.slopeLow > a.slopeHigh || b.slopeLow > b.slopeHigh) return null;
  return a.slopeLow <= b.slopeHigh && b.slopeLow <= a.slopeHigh;
}

function rateRatio(claim, witness) {
  if (!Number.isFinite(claim) || !Number.isFinite(witness) || claim === 0 || witness === 0) return null;
  const ratio = claim / witness;
  return Number.isFinite(ratio) && ratio !== 0 ? ratio : null;
}
