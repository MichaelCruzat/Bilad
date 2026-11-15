/**
 * Bilad data pipeline.
 *
 *   node pipeline/build.ts CHL KEN ...     build the named nations
 *   node pipeline/build.ts --all           build every nation in the registry
 *
 * For each nation it:
 *   1. takes the Natural Earth 1:50m boundary (world-atlas) and an optional clip;
 *   2. tiles the bounding box into <= 10 x 10 degree NASA POWER regional requests;
 *   3. downloads 1981–2024 monthly values for every variable (cached on disk);
 *   4. keeps MERRA-2 grid cells that overlap the boundary, recording each
 *      cell's land fraction and true area on the sphere;
 *   5. packs values as little-endian Int16 (cell-major, 528 months per cell);
 *   6. computes national headline statistics with the same engine the
 *      browser uses, so shipped numbers and recomputed numbers agree.
 */
import {mkdirSync, readFileSync, writeFileSync, existsSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {geoBounds, geoContains} from 'd3-geo';
import {feature} from 'topojson-client';
import type {Feature, MultiPolygon, Polygon, Position} from 'geojson';
import {NATIONS, getNationConfig, type NationConfig} from './nations.ts';
import {VARIABLES, FIRST_YEAR, LAST_YEAR, BASELINE, type VariableDef} from '../src/data/variables.ts';
import {
  annualAnomalies,
  fdrThreshold,
  monthlyClimatology,
  analyzeSeries,
  trendTest,
  weightedMean,
} from '../src/lib/stats.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, 'pipeline', '.cache');
const OUT = join(ROOT, 'public', 'data');
const DLAT = 0.5;
const DLON = 0.625;
const YEARS = LAST_YEAR - FIRST_YEAR + 1;
const MONTHS = YEARS * 12;
const MISSING = -32768;
const POWER = 'https://power.larc.nasa.gov/api/temporal/monthly/regional';
const EARTH_RADIUS_KM = 6371.0088;

type Geo = Feature<Polygon | MultiPolygon>;

type Tile = {latMin: number; latMax: number; lonMin: number; lonMax: number};

function loadBoundary(cfg: NationConfig): Geo {
  const topo = JSON.parse(readFileSync(join(ROOT, 'node_modules/world-atlas/countries-50m.json'), 'utf8'));
  const all = feature(topo, topo.objects.countries) as unknown as {features: Geo[]};
  const found = all.features.find(f => String(f.id) === cfg.atlasId);
  if (!found) throw new Error(`No boundary for ${cfg.iso3} (${cfg.atlasId})`);
  if (!cfg.clip) return found;
  const {latMin, latMax, lonMin, lonMax} = cfg.clip;
  const inClip = (ring: Position[]) => ring.some(([lon, lat]) => lat >= latMin && lat <= latMax && lon >= lonMin && lon <= lonMax);
  const polys = found.geometry.type === 'Polygon' ? [found.geometry.coordinates] : found.geometry.coordinates;
  const kept = polys.filter(poly => inClip(poly[0]));
  return {...found, geometry: {type: 'MultiPolygon', coordinates: kept}};
}

function roundGeometry(geo: Geo): Geo {
  const r = (p: Position) => [Math.round(p[0] * 1000) / 1000, Math.round(p[1] * 1000) / 1000];
  const polys = geo.geometry.type === 'Polygon' ? [geo.geometry.coordinates] : geo.geometry.coordinates;
  return {
    type: 'Feature',
    id: geo.id,
    properties: {},
    geometry: {type: 'MultiPolygon', coordinates: polys.map(poly => poly.map(ring => ring.map(r)))},
  };
}

function snap(value: number, step: number, mode: 'floor' | 'ceil'): number {
  return Math[mode](value / step) * step;
}

function tilesFor(bounds: [[number, number], [number, number]]): Tile[] {
  const [[w, s], [e, n]] = bounds;
  const latMin = snap(s - DLAT / 2, DLAT, 'floor');
  const latMax = snap(n + DLAT / 2, DLAT, 'ceil');
  const lonMin = snap(w - DLON / 2, DLON, 'floor');
  const lonMax = snap(e + DLON / 2, DLON, 'ceil');
  const tiles: Tile[] = [];
  for (let la = latMin; la < latMax; la += 10) {
    for (let lo = lonMin; lo < lonMax; lo += 10) {
      const t = {latMin: la, latMax: Math.min(la + 10, latMax), lonMin: lo, lonMax: Math.min(lo + 10, lonMax)};
      // POWER rejects very thin boxes; widen them, extra cells are masked out later.
      if (t.latMax - t.latMin < 2) t.latMin = t.latMax - 2;
      if (t.lonMax - t.lonMin < 2) t.lonMin = t.lonMax - 2;
      tiles.push(t);
    }
  }
  return tiles;
}

function requestUrl(variable: string, t: Tile): string {
  const q = new URLSearchParams({
    parameters: variable,
    community: 'AG',
    'latitude-min': String(t.latMin),
    'latitude-max': String(t.latMax),
    'longitude-min': String(t.lonMin),
    'longitude-max': String(t.lonMax),
    start: String(FIRST_YEAR),
    end: String(LAST_YEAR),
    format: 'JSON',
  });
  return `${POWER}?${q}`;
}

type PowerFeature = {geometry: {coordinates: [number, number, number]}; properties: {parameter: Record<string, Record<string, number>>}};
type PowerResponse = {features: PowerFeature[]; header: {api: {version: string}; sources: string[]; fill_value: number}};

async function fetchCached(url: string): Promise<PowerResponse> {
  mkdirSync(CACHE, {recursive: true});
  const file = join(CACHE, `${createHash('sha256').update(url).digest('hex').slice(0, 32)}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, {signal: AbortSignal.timeout(180_000)});
      const body = await res.text();
      if (!res.ok) throw new Error(`${res.status} ${body.slice(0, 200)}`);
      writeFileSync(file, body);
      return JSON.parse(body);
    } catch (error) {
      if (attempt === 4) throw error;
      const wait = 2000 * attempt ** 2;
      console.warn(`  retry ${attempt} in ${wait / 1000}s: ${(error as Error).message}`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
  throw new Error('unreachable');
}

function cellArea(lat: number): number {
  const rad = Math.PI / 180;
  return EARTH_RADIUS_KM ** 2 * DLON * rad * Math.abs(Math.sin((lat + DLAT / 2) * rad) - Math.sin((lat - DLAT / 2) * rad));
}

/** Fraction of a 9 x 9 sample lattice inside the boundary. */
function landFraction(geo: Geo, lat: number, lon: number): number {
  const N = 9;
  let inside = 0;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const la = lat - DLAT / 2 + ((i + 0.5) / N) * DLAT;
      const lo = lon - DLON / 2 + ((j + 0.5) / N) * DLON;
      if (geoContains(geo, [lo, la])) inside++;
    }
  }
  return inside / (N * N);
}

const key = (lat: number, lon: number) => `${lat.toFixed(3)}|${lon.toFixed(3)}`;

async function buildNation(cfg: NationConfig) {
  console.log(`\n${cfg.name} (${cfg.iso3})`);
  const geo = loadBoundary(cfg);
  const bounds = geoBounds(geo) as [[number, number], [number, number]];
  const tiles = tilesFor(bounds);
  console.log(`  ${tiles.length} tile(s) × ${VARIABLES.length} variables`);

  const values = new Map<string, Map<string, Float64Array>>();
  const requests: {variable: string; url: string}[] = [];
  let apiVersion = '';
  const sources = new Set<string>();

  for (const v of VARIABLES) {
    for (const tile of tiles) {
      const url = requestUrl(v.id, tile);
      requests.push({variable: v.id, url});
      const data = await fetchCached(url);
      apiVersion = data.header.api.version;
      data.header.sources.forEach(s => sources.add(s));
      const fill = data.header.fill_value;
      for (const f of data.features) {
        const [lon, lat] = f.geometry.coordinates;
        const k = key(lat, lon);
        if (!values.has(k)) values.set(k, new Map());
        const series = new Float64Array(MONTHS).fill(NaN);
        const raw = f.properties.parameter[v.id];
        if (!raw) throw new Error(`Response for ${v.id} is missing the parameter`);
        for (const [ym, val] of Object.entries(raw)) {
          const year = Number(ym.slice(0, 4));
          const month = Number(ym.slice(4));
          if (month < 1 || month > 12 || year < FIRST_YEAR || year > LAST_YEAR) continue;
          series[(year - FIRST_YEAR) * 12 + month - 1] = val === fill ? NaN : val;
        }
        values.get(k)!.set(v.id, series);
      }
    }
    process.stdout.write(`  ${v.id} ✓\n`);
  }

  const clip = cfg.clip;
  const cells: {lat: number; lon: number; land: number; areaKm2: number}[] = [];
  for (const k of values.keys()) {
    const [lat, lon] = k.split('|').map(Number);
    if (clip && (lat < clip.latMin || lat > clip.latMax || lon < clip.lonMin || lon > clip.lonMax)) continue;
    const land = landFraction(geo, lat, lon);
    if (land <= 0) continue;
    if (!VARIABLES.every(v => values.get(k)!.has(v.id))) continue;
    cells.push({lat, lon, land: Math.round(land * 1000) / 1000, areaKm2: Math.round(cellArea(lat) * land)});
  }
  cells.sort((a, b) => b.lat - a.lat || a.lon - b.lon);
  console.log(`  ${cells.length} land cells`);

  const dir = join(OUT, 'nations', cfg.iso3);
  mkdirSync(dir, {recursive: true});
  for (const v of VARIABLES) {
    const buf = new Int16Array(cells.length * MONTHS);
    cells.forEach((c, ci) => {
      const series = values.get(key(c.lat, c.lon))!.get(v.id)!;
      for (let m = 0; m < MONTHS; m++) {
        const q = series[m];
        buf[ci * MONTHS + m] = Number.isFinite(q) ? Math.max(-32767, Math.min(32767, Math.round(q / v.scale))) : MISSING;
      }
    });
    writeFileSync(join(dir, `${v.id}.i16`), Buffer.from(buf.buffer));
  }
  writeFileSync(join(dir, 'boundary.json'), JSON.stringify(roundGeometry(geo)));

  const summary = summarize(cfg, cells, values);
  const meta = {
    iso3: cfg.iso3,
    name: cfg.name,
    rationale: cfg.rationale,
    regions: cfg.regions ?? [],
    grid: {dLat: DLAT, dLon: DLON, firstYear: FIRST_YEAR, lastYear: LAST_YEAR, months: MONTHS, missing: MISSING},
    cells,
    variables: VARIABLES.map(v => ({id: v.id, scale: v.scale})),
    provenance: {
      api: `NASA POWER Monthly and Annual API v${apiVersion}`,
      sources: [...sources],
      community: 'AG',
      retrieved: new Date().toISOString().slice(0, 10),
      requests,
    },
  };
  writeFileSync(join(dir, 'meta.json'), JSON.stringify(meta));
  return summary;
}

function summarize(cfg: NationConfig, cells: {lat: number; lon: number; areaKm2: number}[], values: Map<string, Map<string, Float64Array>>) {
  const years = Array.from({length: YEARS}, (_, i) => FIRST_YEAR + i);
  const weights = cells.map(c => c.areaKm2);
  const base: [number, number] = [BASELINE[0] - FIRST_YEAR, BASELINE[1] - FIRST_YEAR];
  const stats: Record<string, unknown> = {};
  for (const v of VARIABLES as readonly VariableDef[]) {
    const normals: number[] = [];
    const annual = cells.map(c => {
      const monthly = values.get(key(c.lat, c.lon))!.get(v.id)!;
      const clim = monthlyClimatology(monthly, base[0], base[1]);
      normals.push((clim.reduce((a, b) => a + b, 0) / 12) * v.display);
      return annualAnomalies(monthly, clim);
    });
    const tests = annual.map(a => trendTest(years, a));
    const pStar = fdrThreshold(tests.map(t => t.p));
    let up = 0;
    let down = 0;
    const total = weights.reduce((a, b) => a + b, 0);
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
  const area = Math.round(weights.reduce((a, b) => a + b, 0));
  const t = stats.T2M as {slopePerDecade: number; areaUp: number};
  console.log(`  T2M ${t.slopePerDecade.toFixed(3)} °C/decade, ${(t.areaUp * 100).toFixed(0)}% of area significant warming`);
  return {iso3: cfg.iso3, name: cfg.name, rationale: cfg.rationale, cells: cells.length, areaKm2: area, stats};
}

async function main() {
  const args = process.argv.slice(2);
  const targets = args.includes('--all') ? NATIONS : args.map(getNationConfig);
  if (!targets.length) {
    console.error('Usage: node pipeline/build.ts <ISO3...> | --all');
    process.exit(1);
  }
  mkdirSync(OUT, {recursive: true});
  const indexFile = join(OUT, 'index.json');
  const index: {nations: Record<string, unknown>[]} = existsSync(indexFile) ? JSON.parse(readFileSync(indexFile, 'utf8')) : {nations: []};
  for (const cfg of targets) {
    const summary = await buildNation(cfg);
    index.nations = index.nations.filter(n => n.iso3 !== cfg.iso3).concat(summary);
  }
  index.nations.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  writeFileSync(indexFile, JSON.stringify({firstYear: FIRST_YEAR, lastYear: LAST_YEAR, baseline: BASELINE, nations: index.nations}));
  console.log(`\nWrote ${indexFile}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
