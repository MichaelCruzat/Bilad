import {useMemo} from 'react';
import {Badge} from '@astryxdesign/core/Badge';
import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {Divider} from '@astryxdesign/core/Divider';
import {Layout, LayoutContent, LayoutPanel} from '@astryxdesign/core/Layout';
import {MetadataList, MetadataListItem} from '@astryxdesign/core/MetadataList';
import {Selector} from '@astryxdesign/core/Selector';
import {Slider} from '@astryxdesign/core/Slider';
import {Spinner} from '@astryxdesign/core/Spinner';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {Heading, Text} from '@astryxdesign/core/Text';
import {BASELINE, getVariable} from '../data/variables';
import {FEATURED} from '../data/featured';
import {useAsync, useMediaQuery} from '../lib/hooks';
import {loadWorld} from '../lib/nationData';
import {
  globalReliefUrl,
  loadCountries,
  loadGlobalAnnual,
  loadGlobalCells,
  loadGlobalMeta,
  loadGlobalStats,
  loadGlobalSummary,
  loadGlobalWitness,
  type GlobalCells,
  type GlobalStats,
  type GlobalWitness,
} from '../lib/globalData';
import {INDEPENDENCE, LIMITATION, PRODUCTS, toWitnessState, VERDICT_TEXT} from '../lib/evidence';
import {VerdictStrip} from '../features/VerdictStrip';
import type {Async} from '../lib/hooks';
import {analyzeSeries, weightedMean} from '../lib/stats';
import {describe} from '../lib/narrative';
import {lat as fmtLat, lon as fmtLon, num, percent, pPhrase, signed} from '../lib/format';
import {atlasHref, useAtlasParamsAt} from '../app/router';
import {WorldMap, type WorldLayer} from '../viz/WorldMap';
import {SeriesChart} from '../viz/SeriesChart';
import {divergingColor, emergenceRamp, VERDICT_COLORS} from '../viz/color';
import {usePlayback} from '../viz/usePlayback';
import {YearStrip} from '../viz/YearStrip';
import {AspectRatio} from '@astryxdesign/core/AspectRatio';

const LAYERS: {value: WorldLayer; label: string; description: string}[] = [
  {value: 'verdict', label: 'Verdict against the witness', description: 'Does an independent record back the trend?'},
  {value: 'trend', label: 'Trend per decade', description: 'Theil–Sen slope, dots where significant'},
  {value: 'year', label: 'One year at a time', description: 'Each year against 1991–2020, playable'},
  {value: 'normal', label: '1991–2020 normal', description: 'The baseline climate, for context'},
];
const VARS = [
  {value: 'T2M', label: 'Temperature', description: 'Witness: GISTEMP weather stations'},
  {value: 'PRECTOTCORR', label: 'Rainfall', description: 'Witness: GPCP gauges and satellites'},
];
const TONE: Record<string, 'success' | 'warning' | 'error' | 'neutral'> = {success: 'success', warning: 'warning', error: 'error', neutral: 'neutral'};

type Bundle = {cells: GlobalCells; stats: GlobalStats};

/** Area-weighted series over cells; for relative variables weight by normal too (total anomaly / total normal). */
function aggregate(cells: GlobalCells, stats: GlobalStats, annual: Float32Array, ids: number[], relative: boolean): Float64Array {
  const ny = stats.years;
  const out = new Float64Array(ny);
  const w = ids.map(c => cells.area[c] * (relative ? Math.max(0, stats.normal[c]) : 1));
  for (let y = 0; y < ny; y++) out[y] = weightedMean(ids.map(c => annual[c * ny + y]), w);
  return out;
}

/** Witness series for a set of cells in the same reading units as Bilad's series. */
function aggregateWitness(cells: GlobalCells, w: GlobalWitness, ids: number[], ny: number, firstYear: number, relative: boolean): Float64Array {
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

export function World({params}: {params: URLSearchParams}) {
  const set = useAtlasParamsAt('#/world', params);
  const narrow = useMediaQuery('(max-width: 1100px)');
  const wide = useMediaQuery('(min-width: 1600px)');
  const variable = VARS.some(v => v.value === params.get('v')) ? params.get('v')! : 'T2M';
  const layer = (LAYERS.find(l => l.value === params.get('layer'))?.value ?? 'verdict') as WorldLayer;
  const def = getVariable(variable);
  const relative = Boolean(def.relative);
  const unit = relative ? '% of normal' : def.unit;

  const meta = useAsync(loadGlobalMeta, []);
  const summary = useAsync(loadGlobalSummary, []);
  const countries = useAsync(loadCountries, []);
  const world = useAsync(loadWorld, []);
  const bundle = useAsync<Bundle>(async () => ({cells: await loadGlobalCells(), stats: await loadGlobalStats(variable)}), [variable]);

  const first = summary.status === 'ready' ? summary.data.firstYear : 1981;
  const last = summary.status === 'ready' ? summary.data.lastYear : 2024;
  const playback = usePlayback(first, last, {initial: Number(params.get('year')) || last});

  const cellParam = params.has('cell') ? Number(params.get('cell')) : null;
  const countryParam = params.get('country');
  const cells = bundle.status === 'ready' ? bundle.data.cells : null;
  const cell = cells && cellParam !== null && cellParam >= 0 && cellParam < cells.n ? cellParam : null;
  const countryIndex = useMemo(() => {
    if (countries.status !== 'ready') return null;
    if (countryParam !== null) {
      const i = countries.data.findIndex(c => c.id === countryParam);
      if (i >= 0) return i;
    }
    if (cell !== null && cells && cells.country[cell] !== 65535) return cells.country[cell];
    return null;
  }, [countries, countryParam, cell, cells]);

  const needAnnual = layer === 'year' || cell !== null || countryIndex !== null;
  const annual = useAsync(() => loadGlobalAnnual(variable), [variable], needAnnual);
  const witness = useAsync(() => loadGlobalWitness(variable), [variable], cell !== null || countryIndex !== null);

  const failed = [meta, summary, countries, bundle].find(s => s.status === 'error');
  if (failed && failed.status === 'error') {
    return (
      <Layout content={<LayoutContent padding={8}><Banner status="error" title="Could not load the global atlas" description={failed.error.message} endContent={<Button label="Retry" onClick={failed.retry} />} /></LayoutContent>} />
    );
  }
  const ready = meta.status === 'ready' && summary.status === 'ready' && countries.status === 'ready' && bundle.status === 'ready';

  const controls = (
    <VStack gap={5}>
      <Selector
        label="Find a country"
        hasSearch
        placeholder="Any of 223 countries"
        value={countryIndex !== null && countries.status === 'ready' ? countries.data[countryIndex].id : null}
        options={countries.status === 'ready' ? [...countries.data].sort((a, b) => a.name.localeCompare(b.name)).map(c => ({value: c.id, label: c.name})) : []}
        onChange={v => set({country: v || null, cell: null})}
        hasClear
        width="100%"
      />
      <Selector label="Variable" value={variable} options={VARS} onChange={v => v && set({v})} width="100%" />
      <Selector label="Map layer" value={layer} options={LAYERS} onChange={v => v && set({layer: v === 'verdict' ? null : v})} width="100%" />
      {layer === 'year' && (
        <VStack gap={2}>
          <Button size="sm" variant="primary" label={playback.playing ? 'Pause the years' : 'Play the years'} onClick={() => playback.setPlaying(!playback.playing)} />
          <Slider
            label="Year"
            isLabelHidden
            value={playback.year}
            min={first}
            max={last}
            valueDisplay="text"
            formatValue={v => String(v)}
            onChange={(v: number) => {
              playback.setPlaying(false);
              playback.setYear(v);
            }}
            width="100%"
          />
        </VStack>
      )}
      <WorldLegend layer={layer} variable={variable} unit={unit} />
      <Text type="supporting">
        {layer === 'verdict'
          ? `Every land cell’s ${def.short.toLowerCase()} trend since ${first}, checked against ${PRODUCTS[variable].name}. Green: stations agree. Red: stations show a significant opposite trend. Orange: stations lean the opposite way.`
          : layer === 'trend'
            ? `Theil–Sen trend in ${unit} per decade. Zoom in to see dots on cells that pass a worldwide false-discovery test.`
            : layer === 'year'
              ? `Each cell’s departure from its 1991–2020 normal in ${playback.year}, on one colour scale for every year.`
              : `The 1991–2020 average, for context.`}
      </Text>
    </VStack>
  );

  const map = (
    <VStack gap={2} height="100%">
      <HStack gap={3} vAlign="center" hAlign="between" wrap="wrap">
        <Heading level={1}>
          The world <Text color="secondary" type="large">· {def.short.toLowerCase()}, {first}–{last}</Text>
        </Heading>
        {layer === 'year' ? (
          <Text type="display-3" hasTabularNumbers>
            {playback.year}
          </Text>
        ) : (
          <Text type="supporting">Drag to pan, scroll to zoom, click any land cell</Text>
        )}
      </HStack>
      <AspectRatio ratio={2.5}>
        <VStack height="100%">
          {ready ? (
            <WorldMap
              cells={bundle.data.cells}
              stats={bundle.data.stats}
              annual={annual.status === 'ready' ? annual.data : null}
              layer={layer}
              year={playback.year}
              firstYear={first}
              extent={meta.data.extent ?? [-180, -60, 180, 84]}
              reliefUrl={globalReliefUrl}
              world={world.status === 'ready' ? world.data : null}
              selectedCell={cell}
              selectedCountry={countryIndex}
              countryIds={countries.data.map(c => c.id)}
              onSelectCell={c => set({cell: c, country: null})}
              describeCell={c => {
                const s = bundle.data.stats;
                const country = bundle.data.cells.country[c];
                const name = country !== 65535 ? countries.data[country].name : 'Open water';
                const a = s.agreement[c];
                return [
                  `${name} · ${fmtLat(bundle.data.cells.lat[c])} ${fmtLon(bundle.data.cells.lon[c])}`,
                  `${signed(s.slope[c], relative ? 1 : 2)} ${unit}/decade${s.flags[c] & 1 ? ', significant' : ''}`,
                  a === 255 ? 'no witness here' : `vs ${PRODUCTS[variable].name}: ${VERDICT_TEXT[summary.data.agreements[a]].label.toLowerCase()}`,
                ];
              }}
              title={`World map of ${def.short.toLowerCase()}: ${LAYERS.find(l => l.value === layer)!.label.toLowerCase()}`}
            />
          ) : (
            <HStack gap={2} vAlign="center">
              <Spinner size="sm" />
              <Text color="secondary">Loading every land cell on Earth…</Text>
            </HStack>
          )}
        </VStack>
      </AspectRatio>
      {summary.status === 'ready' && (
        <VStack gap={1}>
          <Text type="code" size="xsm" color="secondary">
            {`GLOBAL LAND ${def.short.toUpperCase()}, EACH YEAR · POINT OR DRAG TO SHOW A YEAR ON THE MAP`}
          </Text>
          <YearStrip
            years={Array.from({length: last - first + 1}, (_, i) => first + i)}
            series={summary.data.variables[variable].series}
            variable={variable}
            unit={relative ? '%' : def.unit}
            current={layer === 'year' ? playback.year : null}
            onPick={y => {
              playback.setPlaying(false);
              playback.setYear(y);
              if (layer !== 'year') set({layer: 'year'});
            }}
            title={`Global land ${def.short.toLowerCase()} each year against the 1991–2020 normal. Pick a year to show it on the map.`}
          />
        </VStack>
      )}
      {ready && (
        <Rankings
          cells={bundle.data.cells}
          stats={bundle.data.stats}
          countries={countries.data}
          variable={variable}
          onPick={id => set({country: id, cell: null})}
        />
      )}
    </VStack>
  );

  const evidence = ready ? (
    countryIndex !== null || cell !== null ? (
      <Selection
        bundle={bundle.data}
        annual={annual.status === 'ready' ? annual.data : null}
        witnessStatus={witness}
        countryIndex={countryIndex}
        countryName={countryIndex !== null ? countries.data[countryIndex].name : null}
        countryId={countryIndex !== null ? countries.data[countryIndex].id : null}
        cell={cell}
        variable={variable}
        first={first}
      />
    ) : (
      <GlobalPanel summary={summary.data} variable={variable} first={first} last={last} />
    )
  ) : null;

  if (narrow) {
    return <Layout content={<LayoutContent padding={4}><VStack gap={6}>{controls}<Divider />{map}<Divider />{evidence}</VStack></LayoutContent>} />;
  }
  return (
    <Layout
      start={<LayoutPanel width={wide ? 320 : 272} padding={5} hasDivider label="World atlas controls" role="region">{controls}</LayoutPanel>}
      content={<LayoutContent padding={5} isScrollable={false} label="World map">{map}</LayoutContent>}
      end={<LayoutPanel width={wide ? 500 : 410} padding={5} hasDivider label="Evidence" role="region">{evidence}</LayoutPanel>}
    />
  );
}

type Rank = {index: number; id: string; name: string; slope: number; flagged: number; cells: number};

function Rankings({cells, stats, countries, variable, onPick}: {cells: GlobalCells; stats: GlobalStats; countries: {id: string; name: string}[]; variable: string; onPick: (id: string) => void}) {
  const def = getVariable(variable);
  const relative = Boolean(def.relative);
  const ranks = useMemo(() => {
    const acc = new Map<number, {area: number; slopeArea: number; slopeW: number; flagged: number; cells: number}>();
    for (let c = 0; c < cells.n; c++) {
      const k = cells.country[c];
      if (k === 65535) continue;
      const a = acc.get(k) ?? {area: 0, slopeArea: 0, slopeW: 0, flagged: 0, cells: 0};
      a.area += cells.area[c];
      a.cells += 1;
      if (Number.isFinite(stats.slope[c])) {
        a.slopeArea += stats.slope[c] * cells.area[c];
        a.slopeW += cells.area[c];
      }
      if (stats.flags[c] & 4) a.flagged += cells.area[c];
      acc.set(k, a);
    }
    const list: Rank[] = [];
    acc.forEach((a, k) => {
      if (a.cells < 12 || !a.slopeW) return;
      list.push({index: k, id: countries[k].id, name: countries[k].name, slope: a.slopeArea / a.slopeW, flagged: a.flagged / a.area, cells: a.cells});
    });
    return list;
  }, [cells, stats, countries]);
  const fastest = [...ranks].sort((a, b) => (relative ? Math.abs(b.slope) - Math.abs(a.slope) : b.slope - a.slope)).slice(0, 6);
  const suspect = [...ranks].sort((a, b) => b.flagged - a.flagged).slice(0, 6);
  const row = (r: Rank, value: string) => (
    <HStack key={r.id} gap={3} hAlign="between" vAlign="center">
      <Button size="sm" variant="ghost" label={r.name} onClick={() => onPick(r.id)} />
      <Text hasTabularNumbers type="supporting">
        {value}
      </Text>
    </HStack>
  );
  return (
    <HStack gap={8} wrap="wrap">
      <VStack gap={1} width="min(100%, 24rem)">
        <Text type="code" size="xsm" color="secondary">
          {relative ? 'LARGEST RAINFALL CHANGE, AVERAGE CELL TREND' : 'FASTEST WARMING, AVERAGE CELL TREND'}
        </Text>
        {fastest.map(r => row(r, `${signed(r.slope, relative ? 1 : 2)} ${relative ? '%' : '°C'}/decade`))}
      </VStack>
      <VStack gap={1} width="min(100%, 24rem)">
        <Text type="code" size="xsm" color="secondary">
          LEAST TRUSTWORTHY RECORD, LAND FLAGGED AGAINST THE WITNESS
        </Text>
        {suspect.map(r => row(r, `${percent(r.flagged)} flagged`))}
      </VStack>
    </HStack>
  );
}

function WorldLegend({layer, variable, unit}: {layer: WorldLayer; variable: string; unit: string}) {
  const def = getVariable(variable);
  if (layer === 'verdict') {
    const labels = ['Corroborated', 'Same direction, different size', 'Weakly supported', 'Contradicted', 'Not supported', 'No detectable trend'];
    return (
      <VStack gap={1}>
        {labels.map((l, i) => (
          <HStack key={l} gap={2} vAlign="center">
            <svg width="14" height="14" aria-hidden="true">
              <rect width="14" height="14" rx="2" fill={VERDICT_COLORS[i]} />
            </svg>
            <Text type="supporting">{l}</Text>
          </HStack>
        ))}
      </VStack>
    );
  }
  const steps = Array.from({length: 32}, (_, i) => i / 31);
  return (
    <VStack gap={1}>
      <svg width="100%" height="12" viewBox="0 0 320 12" preserveAspectRatio="none" aria-hidden="true">
        {steps.map(t => (
          <rect key={t} x={t * 310} y={0} width={11} height={12} fill={layer === 'normal' ? emergenceRamp(0.08 + 0.92 * t) : divergingColor(def.palette, -1 + 2 * t, 1)} />
        ))}
      </svg>
      <HStack gap={2} hAlign="between">
        <Text type="supporting">{layer === 'normal' ? 'low' : def.down}</Text>
        <Text type="supporting">{layer === 'normal' ? def.unit : layer === 'trend' ? `${unit} per decade` : unit}</Text>
        <Text type="supporting">{layer === 'normal' ? 'high' : def.up}</Text>
      </HStack>
    </VStack>
  );
}

function GlobalPanel({summary, variable, first, last}: {summary: Awaited<ReturnType<typeof loadGlobalSummary>>; variable: string; first: number; last: number}) {
  const def = getVariable(variable);
  const g = summary.variables[variable];
  const relative = Boolean(def.relative);
  const unit = relative ? '% of normal' : def.unit;
  const order = summary.agreements;
  return (
    <VStack gap={5}>
      <VStack gap={2}>
        <Text type="code" color="accent" size="xsm">
          EVERY LAND CELL, 60°S TO 84°N
        </Text>
        <Heading level={2}>The world since {first}</Heading>
        <Text>
          Across {g.cells.toLocaleString('en-US')} land cells, {def.short.toLowerCase()} has changed by <Text weight="bold">{signed(g.slopePerDecade, relative ? 1 : 2)} {unit} per decade</Text> on average ({pPhrase(g.p)}), area-weighted.
        </Text>
      </VStack>
      <MetadataList columns={2}>
        <MetadataListItem label={`Land with significant ${def.up}`}>{percent(g.areaUp)}</MetadataListItem>
        <MetadataListItem label={`Land with significant ${def.down}`}>{percent(g.areaDown)}</MetadataListItem>
        <MetadataListItem label="Witness backs the trend">{percent(g.agreement.corroborated + g.agreement['same-direction'])}</MetadataListItem>
        <MetadataListItem label="Flagged as a likely artefact">{percent(g.areaFlagged, 1)}</MetadataListItem>
      </MetadataList>
      <VStack gap={1}>
        <Text type="label">How the trend fares against {PRODUCTS[variable].name}, share of land</Text>
        <svg width="100%" height="18" viewBox="0 0 100 18" preserveAspectRatio="none" role="img" aria-label={order.map(k => `${VERDICT_TEXT[k].label} ${percent(g.agreement[k])}`).join(', ')}>
          {(() => {
            let x = 0;
            return order.map((k, i) => {
              const w = g.agreement[k] * 100;
              const r = <rect key={k} x={x} y={0} width={w} height={18} fill={VERDICT_COLORS[i]} />;
              x += w;
              return r;
            });
          })()}
        </svg>
        <Text type="supporting">Land with no witness coverage or too few years is left out of the bar.</Text>
      </VStack>
      <SeriesChart
        years={Array.from({length: last - first + 1}, (_, i) => first + i)}
        series={g.series}
        analysis={analyzeSeries(Array.from({length: last - first + 1}, (_, i) => first + i), g.series)}
        variable={variable}
        unit={relative ? '%' : def.unit}
        title={`Global land ${def.short.toLowerCase()} anomaly, area-weighted, ${first}–${last}`}
      />
      <Text type="supporting">Click any land cell, or search for a country, to cross-examine it.</Text>
    </VStack>
  );
}

function Selection({
  bundle,
  annual,
  witnessStatus,
  countryIndex,
  countryName,
  countryId,
  cell,
  variable,
  first,
}: {
  bundle: Bundle;
  annual: Float32Array | null;
  witnessStatus: Async<GlobalWitness>;
  countryIndex: number | null;
  countryName: string | null;
  countryId: string | null;
  cell: number | null;
  variable: string;
  first: number;
}) {
  const {cells, stats} = bundle;
  const def = getVariable(variable);
  const relative = Boolean(def.relative);
  const unit = relative ? '% of normal' : def.unit;
  const ids = useMemo(() => {
    if (countryIndex === null) return cell !== null ? [cell] : [];
    const out: number[] = [];
    for (let c = 0; c < cells.n; c++) if (cells.country[c] === countryIndex) out.push(c);
    return out;
  }, [cells, countryIndex, cell]);
  const years = Array.from({length: stats.years}, (_, i) => first + i);
  if (!annual) {
    return (
      <HStack gap={2} vAlign="center">
        <Spinner size="sm" />
        <Text color="secondary">Loading 44 years for {countryName ?? 'this cell'}…</Text>
      </HStack>
    );
  }
  const series = aggregate(cells, stats, annual, ids, relative);
  const result = analyzeSeries(years, series);
  const finding = describe(variable, unit, result, years, series);
  const state = toWitnessState(variable, witnessStatus, years, series, () =>
    witnessStatus.status === 'ready' ? aggregateWitness(cells, witnessStatus.data, ids, stats.years, first, relative) : null,
  );
  const exam = state.kind === 'available' ? state.exam : null;
  const witnessSeries = exam && witnessStatus.status === 'ready' ? aggregateWitness(cells, witnessStatus.data, ids, stats.years, first, relative) : null;
  const area = ids.reduce((s, c) => s + cells.area[c], 0);
  const share = (pred: (c: number) => boolean) => ids.reduce((s, c) => s + (pred(c) ? cells.area[c] : 0), 0) / area;
  const iso3 = countryId ? FEATURED[countryId] : undefined;
  const verdict = exam ? VERDICT_TEXT[exam.verdict] : null;
  return (
    <VStack gap={4}>
      <VStack gap={1}>
        <Text type="code" color="accent" size="xsm">
          {def.label.toUpperCase()}
        </Text>
        <Heading level={2}>{countryName ?? `${fmtLat(cells.lat[cell!])}, ${fmtLon(cells.lon[cell!])}`}</Heading>
        <Text type="supporting">
          {ids.length} grid {ids.length === 1 ? 'cell' : 'cells'}, {num(area, 0)} km² of land{countryName && cell !== null ? `; selected cell ${fmtLat(cells.lat[cell])}, ${fmtLon(cells.lon[cell])}` : ''}.
        </Text>
      </VStack>
      <VerdictStrip
        place={countryName ?? 'This cell'}
        variable={variable}
        window={{from: first, to: first + stats.years - 1}}
        result={result}
        unit={unit}
        witness={state}
        step={exam?.claimStep ?? null}
        fieldSignificant={countryIndex === null && cell !== null ? (stats.flags[cell] & 1) !== 0 : undefined}
        resolution={`${ids.length} cells of 0.5° × 0.625° (global grid), area-weighted`}
        limitation={LIMITATION[variable]}
        next={iso3 ? {label: `Open the full ${countryName} atlas`, href: atlasHref(iso3)} : undefined}
      />
      <VStack gap={2}>
        <Text color="secondary">
          {finding.significance} {finding.emergence}
        </Text>
      </VStack>
      <SeriesChart
        years={years}
        series={series}
        analysis={result}
        variable={variable}
        unit={relative ? '%' : def.unit}
        witness={witnessSeries}
        witnessLabel={`${PRODUCTS[variable].name} (independent record)`}
        step={exam?.claimStep ?? null}
        title={`${countryName ?? 'Cell'}: annual ${def.short.toLowerCase()} anomaly`}
      />
      {exam && verdict && (
        <VStack gap={2}>
          <Divider />
          <HStack gap={2} vAlign="center" wrap="wrap">
            <Heading level={3}>Cross-examination</Heading>
            <Badge variant={TONE[verdict.tone]} label={verdict.label} />
          </HStack>
          <Text color="secondary">{verdict.plain}</Text>
          {exam.artifactSuspected && <Text color="accent">The reanalysis record looks like a data artefact here: treat its trend with suspicion.</Text>}
          <Text type="supporting">{INDEPENDENCE[variable]}</Text>
          <MetadataList columns={2}>
            <MetadataListItem label={`MERRA-2, ${unit}/decade`}>
              <Text hasTabularNumbers>{signed(exam.claim.slope * 10, relative ? 1 : 2)} · {pPhrase(exam.claim.p)}</Text>
            </MetadataListItem>
            <MetadataListItem label={`${PRODUCTS[variable].name}, ${unit}/decade`}>
              <Text hasTabularNumbers>{signed(exam.witness.slope * 10, relative ? 1 : 2)} · {pPhrase(exam.witness.p)}</Text>
            </MetadataListItem>
          </MetadataList>
        </VStack>
      )}
      {countryIndex !== null && (
        <MetadataList columns={2}>
          <MetadataListItem label={`Land with significant ${def.up}`}>{percent(share(c => (stats.flags[c] & 1) !== 0 && stats.slope[c] > 0))}</MetadataListItem>
          <MetadataListItem label={`Land with significant ${def.down}`}>{percent(share(c => (stats.flags[c] & 1) !== 0 && stats.slope[c] < 0))}</MetadataListItem>
          <MetadataListItem label="Cells flagged as artefacts">{percent(share(c => (stats.flags[c] & 4) !== 0))}</MetadataListItem>
        </MetadataList>
      )}
    </VStack>
  );
}
