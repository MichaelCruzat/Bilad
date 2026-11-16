import {useEffect, useMemo, useRef, useState} from 'react';
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
import {getVariable} from '../data/variables';
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
import {INDEPENDENCE, LIMITATION, overallVerdict, PRODUCTS, toWitnessState, VERDICT_TEXT, VERDICT_ORDER, type WitnessState} from '../lib/evidence';
import {copyText, download} from '../lib/download';
import {VerdictStrip} from '../features/VerdictStrip';
import {Glossary} from '../features/Glossary';
import type {Async} from '../lib/hooks';
import {analyzeSeries} from '../lib/stats';
import {aggregateGlobal as aggregate, aggregateGlobalWitness as aggregateWitness} from '../lib/globalEvidence';
import {MotionStack} from '../features/MotionStack';
import {describe, findingContext} from '../lib/narrative';
import {lat as fmtLat, lon as fmtLon, num, percent, pPhrase, signed, thousands} from '../lib/format';
import {atlasHref, useAtlasParamsAt} from '../app/router';
import {WorldMap, type WorldLayer, type WorldMapControls} from '../viz/WorldMap';
import {SeriesChart} from '../viz/SeriesChart';
import {divergingColor, emergenceRamp, robustLimit, VERDICT_COLORS} from '../viz/color';
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

type Bundle = {cells: GlobalCells; stats: GlobalStats};


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
  const cell = cells && cellParam !== null && Number.isInteger(cellParam) && cellParam >= 0 && cellParam < cells.n ? cellParam : null;
  const countryIndex = useMemo(() => {
    // A picked cell is the analysis footprint, even if a country is in the URL.
    if (cell !== null) return null;
    if (countries.status !== 'ready') return null;
    if (countryParam !== null) {
      // Prefer the entry that has land cells when an id is shared.
      const matches = countries.data.flatMap((c, i) => (c.id === countryParam ? [i] : []));
      const i = cells ? (matches.find(k => cells.country.includes(k)) ?? matches[0]) : matches[0];
      if (i !== undefined) return i;
    }
    return null;
  }, [countries, countryParam, cell, cells]);

  // On a phone the result sits below the map and rankings: bring it into view
  // after a pick, so a tap visibly does something.
  const resultRef = useRef<HTMLDivElement>(null);
  const mapControls = useRef<WorldMapControls | null>(null);
  const picked = cellParam !== null || countryParam !== null;
  useEffect(() => {
    if (!narrow || !picked) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const id = window.setTimeout(() => resultRef.current?.scrollIntoView({behavior: reduce ? 'auto' : 'smooth', block: 'start'}), 150);
    return () => window.clearTimeout(id);
  }, [narrow, picked, cellParam, countryParam]);

  // Only countries with land cells, so every option has a unique id and a result.
  const countryOptions = useMemo(() => {
    if (countries.status !== 'ready' || !cells) return [];
    const has = new Set<number>();
    for (let c = 0; c < cells.n; c++) has.add(cells.country[c]);
    return countries.data
      .flatMap((c, i) => (has.has(i) ? [{value: c.id, label: c.name}] : []))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [countries, cells]);

  const needAnnual = layer === 'year' || cell !== null || countryIndex !== null;
  const annual = useAsync(() => loadGlobalAnnual(variable), [variable], needAnnual);
  const witness = useAsync(() => loadGlobalWitness(variable), [variable], cell !== null || countryIndex !== null);

  // The colour-scale ends, computed the same way the map computes them.
  const trendLimit = useMemo(() => (bundle.status === 'ready' ? robustLimit(bundle.data.stats.slope) : null), [bundle]);
  const yearLimit = useMemo(() => (annual.status === 'ready' ? robustLimit(annual.data) : null), [annual]);
  const normalRange = useMemo(() => {
    if (bundle.status !== 'ready') return null;
    let lo = Infinity;
    let hi = -Infinity;
    for (const v of bundle.data.stats.normal) if (Number.isFinite(v)) [lo, hi] = [Math.min(lo, v), Math.max(hi, v)];
    return [lo, hi] as const;
  }, [bundle]);

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
        options={countryOptions}
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
      <WorldLegend layer={layer} variable={variable} unit={unit} range={layer === 'trend' ? (trendLimit ? [-trendLimit, trendLimit] : null) : layer === 'year' ? (yearLimit ? [-yearLimit, yearLimit] : null) : normalRange} />
      <Text type="supporting">
        {layer === 'verdict'
          ? `Every land cell’s ${def.short.toLowerCase()} trend since ${first}, checked against ${PRODUCTS[variable].name} (${variable === 'PRECTOTCORR' ? 'rain gauges and satellites' : 'weather stations'}). Green: the witness agrees. Red: the witness shows a significant opposite trend. Orange: the witness leans the opposite way.`
          : layer === 'trend'
            ? `Trend in ${unit} per decade. Zoom in to see dots on cells selected at a 10% target false discovery rate worldwide.`
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
          <Text type="supporting">Drag to pan; scroll or use the buttons to zoom; click or tap any land cell.</Text>
        )}
        <HStack gap={1}>
          <Button size="sm" variant="secondary" label="Zoom in" onClick={() => mapControls.current?.zoomBy(1.6)} />
          <Button size="sm" variant="secondary" label="Zoom out" onClick={() => mapControls.current?.zoomBy(1 / 1.6)} />
          <Button size="sm" variant="ghost" label="Reset view" onClick={() => mapControls.current?.reset()} />
        </HStack>
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
                if (layer === 'year' && annual.status === 'ready') {
                  const v = annual.data[c * s.years + playback.year - first];
                  return [`${name} · ${fmtLat(bundle.data.cells.lat[c])} ${fmtLon(bundle.data.cells.lon[c])}`, `${playback.year}: ${signed(v, relative ? 0 : 2)} ${relative ? '% versus normal' : `${def.unit} versus the 1991–2020 normal`}`];
                }
                if (layer === 'normal') {
                  return [`${name} · ${fmtLat(bundle.data.cells.lat[c])} ${fmtLon(bundle.data.cells.lon[c])}`, `1991–2020 normal: ${num(s.normal[c], relative ? 0 : 1)} ${def.unit}`];
                }
                return [
                  `${name} · ${fmtLat(bundle.data.cells.lat[c])} ${fmtLon(bundle.data.cells.lon[c])}`,
                  `${signed(s.slope[c], relative ? 1 : 2)} ${unit} per decade${s.flags[c] & 1 ? ', significant' : ''}`,
                  a === 255 ? 'no witness here' : `vs ${PRODUCTS[variable].name}: ${VERDICT_TEXT[summary.data.agreements[a]].label.toLowerCase()}`,
                ];
              }}
              controls={mapControls}
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
          <Text type="label" color="secondary">
            {`Global land ${def.short.toLowerCase()}, each year. Point or drag to show a year on the map.`}
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

  const evidence = needAnnual && annual.status === 'error' ? (
    <Banner status="error" title="Could not load the annual record" description={annual.error.message} endContent={<Button label="Retry" onClick={annual.retry} />} />
  ) : ready ? (
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
  const evidencePanel = (
    <MotionStack gap={6} motionKey={`${variable}:${cell ?? countryParam ?? 'global'}:${annual.status}`}>
      {evidence}
      <Glossary compact />
    </MotionStack>
  );

  if (narrow) {
    return <Layout content={<LayoutContent padding={4}><VStack gap={6}>{controls}<Divider />{map}<Divider /><VStack ref={resultRef}>{evidencePanel}</VStack></VStack></LayoutContent>} />;
  }
  return (
    <Layout
      start={<LayoutPanel width={wide ? 360 : 300} padding={5} hasDivider label="World atlas controls" role="region">{controls}</LayoutPanel>}
      content={<LayoutContent padding={5} isScrollable={false} label="World map">{map}</LayoutContent>}
      end={<LayoutPanel width={wide ? 600 : 460} padding={5} hasDivider label="Evidence" role="region">{evidencePanel}</LayoutPanel>}
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
  // A ranking of change must not promote records the witness rejects: countries
  // with more than a quarter of their land flagged as a likely artefact sit out.
  const trusted = ranks.filter(r => r.flagged <= 0.25);
  const fastest = [...trusted].sort((a, b) => (relative ? Math.abs(b.slope) - Math.abs(a.slope) : b.slope - a.slope)).slice(0, 6);
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
        <Text type="label" color="secondary">
          {relative ? 'Largest rainfall change the witness does not reject' : 'Fastest warming the witness does not reject'}
        </Text>
        {fastest.map(r => row(r, `${signed(r.slope, relative ? 1 : 2)} ${relative ? '% of normal' : '°C'} per decade`))}
        <Text type="supporting">
          Average of the country’s cell trends. Countries with over a quarter of their land flagged as a likely artefact are left out. Opening a country tests its average series instead, so its figure differs slightly.
        </Text>
      </VStack>
      <VStack gap={1} width="min(100%, 24rem)">
        <Text type="label" color="secondary">
          Least trustworthy record: share of land flagged as a likely artefact
        </Text>
        {suspect.map(r => row(r, `${percent(r.flagged)} flagged`))}
        <Text type="supporting">A cell is flagged when the witness contradicts its trend, or its record behaves like a single jump that the witness does not corroborate.</Text>
      </VStack>
    </HStack>
  );
}

function WorldLegend({layer, variable, unit, range}: {layer: WorldLayer; variable: string; unit: string; range: readonly [number, number] | null}) {
  const def = getVariable(variable);
  if (layer === 'verdict') {
    const labels = VERDICT_ORDER.map(v => VERDICT_TEXT[v].label);
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
      {range && (
        <HStack gap={2} hAlign="between">
          <Text type="supporting" hasTabularNumbers>
            {layer === 'normal' ? num(range[0], 0) : `${signed(range[0], Math.abs(range[0]) < 1 ? 2 : 0)} or less`}
          </Text>
          <Text type="supporting">0</Text>
          <Text type="supporting" hasTabularNumbers>
            {layer === 'normal' ? num(range[1], 0) : `${signed(range[1], Math.abs(range[1]) < 1 ? 2 : 0)} or more`}
          </Text>
        </HStack>
      )}
      <HStack gap={2} hAlign="between">
        <Text type="supporting">{layer === 'normal' ? 'low' : def.down}</Text>
        <Text type="supporting">{layer === 'normal' ? def.unit : layer === 'trend' ? `${unit} per decade` : layer === 'year' ? `${def.relative ? '%' : def.unit} versus the 1991–2020 normal` : unit}</Text>
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
        <Text type="label" color="accent">
          Every land cell, 60°S to 84°N
        </Text>
        <Heading level={2}>The world since {first}</Heading>
        <Text>
          Across {g.cells.toLocaleString('en-US')} land cells, the area-weighted average {def.short.toLowerCase()} trend is <Text weight="bold">{signed(g.slopePerDecade, relative ? 1 : 2)} {unit} per decade</Text> ({pPhrase(g.p)}, {g.p < 0.05 ? 'significant' : 'not significant'}).
        </Text>
      </VStack>
      <MetadataList columns={2}>
        <MetadataListItem label={`Land with a significant trend towards ${def.up}`}>{percent(g.areaUp)}</MetadataListItem>
        <MetadataListItem label={`Land with a significant trend towards ${def.down}`}>{percent(g.areaDown)}</MetadataListItem>
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
    if (cell !== null) return [cell];
    if (countryIndex === null) return [];
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
  const state = toWitnessState(variable, witnessStatus, years, series, () =>
    witnessStatus.status === 'ready' ? aggregateWitness(cells, witnessStatus.data, ids, stats.years, first, relative) : null,
  );
  const exam = state.kind === 'available' ? state.exam : null;
  const finding = describe(variable, unit, result, years, series, findingContext(exam, variable));
  const witnessSeries = exam && witnessStatus.status === 'ready' ? aggregateWitness(cells, witnessStatus.data, ids, stats.years, first, relative) : null;
  const area = ids.reduce((s, c) => s + cells.area[c], 0);
  const share = (pred: (c: number) => boolean) => ids.reduce((s, c) => s + (pred(c) ? cells.area[c] : 0), 0) / area;
  const iso3 = countryId ? FEATURED[countryId] : undefined;
  const verdict = exam ? VERDICT_TEXT[exam.verdict] : null;
  return (
    <VStack gap={4}>
      <VStack gap={1}>
        <Text type="label" color="accent">
          {def.label}
        </Text>
        <Heading level={2}>{countryName ?? `Cell at ${fmtLat(cells.lat[cell!])}, ${fmtLon(cells.lon[cell!])}`}</Heading>
        <Text type="supporting">
          {ids.length} grid {ids.length === 1 ? 'cell' : 'cells'}, {thousands(area)} km² of land{countryName && cell !== null ? `; selected cell ${fmtLat(cells.lat[cell])}, ${fmtLon(cells.lon[cell])}` : ''}.
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
        fieldScope="global"
        resolution={`${ids.length} ${ids.length === 1 ? 'cell' : 'cells'} of 0.5° × 0.625° (global grid), area-weighted`}
        limitation={LIMITATION[variable]}
        next={iso3 ? {label: `Open the full ${countryName} atlas`, href: atlasHref(iso3)} : undefined}
      />
      <SelectionActions
        name={countryName ?? `cell ${fmtLat(cells.lat[cell!])} ${fmtLon(cells.lon[cell!])}`}
        variable={variable}
        unit={unit}
        years={years}
        series={series}
        witness={witnessSeries}
        result={result}
        state={state}
        cells={ids.length}
        brief={iso3}
      />
      {iso3 && countryIndex !== null && (
        <Text type="supporting">
          The world map gives each cell to the country that covers most of it. The {countryName} atlas and case files count every cell that overlaps the border, weighted by the share of land inside it, so their cell count and figures differ slightly.
        </Text>
      )}
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
        witnessLabel={`${PRODUCTS[variable].name} (witness)`}
        step={exam?.claimStep ?? null}
        title={`${countryName ?? 'Cell'}: annual ${def.short.toLowerCase()} anomaly`}
      />
      {exam && verdict && (
        <VStack gap={2}>
          <Divider />
          <HStack gap={2} vAlign="center" wrap="wrap">
            <Heading level={3}>Cross-examination</Heading>
            <Text weight="semibold">{verdict.label}</Text>
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
          <MetadataListItem label={`Land with a significant trend towards ${def.up}`}>{percent(share(c => (stats.flags[c] & 1) !== 0 && stats.slope[c] > 0))}</MetadataListItem>
          <MetadataListItem label={`Land with a significant trend towards ${def.down}`}>{percent(share(c => (stats.flags[c] & 1) !== 0 && stats.slope[c] < 0))}</MetadataListItem>
          <MetadataListItem label="Land flagged as a likely artefact">{percent(share(c => (stats.flags[c] & 4) !== 0))}</MetadataListItem>
        </MetadataList>
      )}
    </VStack>
  );
}

/** Share or keep what the panel shows: the link, and the evidence as a file. */
function SelectionActions({name, variable, unit, years, series, witness, result, state, cells, brief}: {
  name: string;
  variable: string;
  unit: string;
  years: number[];
  series: Float64Array;
  witness: Float64Array | null;
  result: ReturnType<typeof analyzeSeries>;
  state: WitnessState;
  cells: number;
  brief?: string;
}) {
  const [copied, setCopied] = useState(false);
  const t = result.trend;
  const verdict = overallVerdict(t.p, state, Boolean(state.kind === 'available' && state.exam.claimStep?.stepDominated));
  const evidence = () => ({
    place: name,
    variable,
    window: {from: years[0], to: years[years.length - 1]},
    unit: `${unit} per decade`,
    trend: round(t.slope * 10),
    low95: round(t.slopeLow * 10),
    high95: round(t.slopeHigh * 10),
    pCorrected: round(t.p),
    verdict: verdict.label,
    verdictMeaning: verdict.sentence,
    witness:
      state.kind === 'available'
        ? {record: PRODUCTS[variable].long, trend: round(state.exam.witness.slope * 10), pCorrected: round(state.exam.witness.p), comparison: VERDICT_TEXT[state.exam.verdict].label}
        : state.kind,
    grid: `${cells} MERRA-2 cells of 0.5° × 0.625° from the global grid, weighted by land area`,
    source: 'NASA POWER (MERRA-2), monthly; annual means of monthly anomalies against 1991–2020',
    method: 'Theil–Sen slope with 95% interval; Mann–Kendall test corrected for runs of similar years (Hamed–Rao)',
    limitation: LIMITATION[variable],
    series: years.map((y, i) => ({year: y, value: round(series[i]), witness: witness ? round(witness[i]) : null})),
    view: window.location.href,
  });
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return (
    <HStack gap={2} wrap="wrap">
      <Button
        size="sm"
        variant="secondary"
        label={copied ? 'Link copied' : 'Copy link to this view'}
        onClick={async () => {
          if (await copyText(window.location.href)) {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }
        }}
      />
      <Button size="sm" variant="secondary" label="Download evidence (JSON)" onClick={() => download(`trace-${slug}-${variable}-${years[0]}-${years[years.length - 1]}.json`, JSON.stringify(evidence(), null, 2), 'application/json')} />
      {brief && <Button size="sm" variant="ghost" label="National brief, all seven variables" href={`#/brief/${brief}`} />}
    </HStack>
  );
}

const round = (v: number) => (Number.isFinite(v) ? Number(v.toPrecision(4)) : null);
