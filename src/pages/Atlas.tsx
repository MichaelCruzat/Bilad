import {useMemo, useState} from 'react';
import {Button} from '@astryxdesign/core/Button';
import {Divider} from '@astryxdesign/core/Divider';
import {Layout, LayoutContent, LayoutPanel} from '@astryxdesign/core/Layout';
import {Link} from '@astryxdesign/core/Link';
import {Collapsible} from '@astryxdesign/core/Collapsible';
import {Selector} from '@astryxdesign/core/Selector';
import {Slider} from '@astryxdesign/core/Slider';
import {Spinner} from '@astryxdesign/core/Spinner';
import {HStack, StackItem, VStack} from '@astryxdesign/core/Stack';
import {Switch} from '@astryxdesign/core/Switch';
import {Heading, Text} from '@astryxdesign/core/Text';
import {Banner} from '@astryxdesign/core/Banner';
import {FIRST_YEAR, LAST_YEAR, VARIABLES, getVariable} from '../data/variables';
import {trendUnit} from '../lib/analysis';
import {useAsync, useIndex, useMediaQuery, useNation, useVariable} from '../lib/hooks';
import {loadWitness} from '../lib/evidence';
import {useAtlasParams} from '../app/router';
import {lat, lon, signed, num} from '../lib/format';
import {NationMap, colorCells, type MapLayer} from '../viz/NationMap';
import {Legend} from '../viz/Legend';
import {HelpTip, type Help} from '../features/HelpTip';
import {usePlayback} from '../viz/usePlayback';
import {EvidencePanel, type Selection} from '../features/EvidencePanel';

type Props = {iso3: string; params: URLSearchParams};

const LAYERS: {value: MapLayer; label: string; description: string}[] = [
  {value: 'change', label: 'Trend per decade', description: 'Theil–Sen slope, stippled where significant'},
  {value: 'year', label: 'One year at a time', description: 'Each year against the 1991–2020 normal, playable'},
  {value: 'emergence', label: 'Signal ÷ noise', description: 'Has the change emerged from natural swings?'},
  {value: 'normal', label: '1991–2020 normal', description: 'The baseline climate, for context'},
];

function intParam(params: URLSearchParams, key: string, fallback: number): number {
  const v = Number(params.get(key));
  return Number.isInteger(v) && params.has(key) ? v : fallback;
}

export function Atlas({iso3, params}: Props) {
  const set = useAtlasParams(iso3, params);
  const index = useIndex();
  const nation = useNation(iso3);
  const witness = useAsync(() => loadWitness(iso3), [iso3]);
  const narrow = useMediaQuery('(max-width: 1100px)');
  const wide = useMediaQuery('(min-width: 1600px)');

  const variable = VARIABLES.some(v => v.id === params.get('v')) ? params.get('v')! : 'T2M';
  const layer = (LAYERS.find(l => l.value === params.get('layer'))?.value ?? 'change') as MapLayer;
  const from = Math.max(FIRST_YEAR, Math.min(LAST_YEAR - 14, intParam(params, 'from', FIRST_YEAR)));
  const to = Math.min(LAST_YEAR, Math.max(from + 14, intParam(params, 'to', LAST_YEAR)));
  const stipple = params.get('sig') !== '0';
  const cellParam = params.has('cell') ? Number(params.get('cell')) : null;
  const bandParam = params.get('band')?.split(',').map(Number);
  const regionParam = params.get('region');
  const [windowDraft, setWindowDraft] = useState<[number, number] | null>(null);

  const meta = nation.status === 'ready' ? nation.data.meta : null;
  const span = useMemo(() => ({from, to}), [from, to]);
  const data = useVariable(meta, variable, span);
  const def = getVariable(variable);
  const unit = trendUnit(variable);
  const playback = usePlayback(from, to, {initial: intParam(params, 'year', to)});
  const shownYear = Math.min(to, Math.max(from, playback.year));

  const region = meta?.regions.find(r => r.id === regionParam);
  const band: [number, number] | null = region
    ? [region.latMin, region.latMax]
    : bandParam && bandParam.length === 2 && bandParam.every(Number.isFinite)
      ? [bandParam[0], bandParam[1]]
      : null;
  const cell = meta && cellParam !== null && Number.isInteger(cellParam) && cellParam >= 0 && cellParam < meta.cells.length ? cellParam : null;
  const selection: Selection =
    cell !== null ? {kind: 'cell', cell} : band ? {kind: 'band', band, regionId: region?.id, name: region?.name} : {kind: 'nation'};

  if (nation.status === 'error') {
    return (
      <Layout
        content={
          <LayoutContent padding={8}>
            <Banner status="error" title={`Could not load ${iso3}`} description={nation.error.message} endContent={<Button label="Retry" onClick={nation.retry} />} />
          </LayoutContent>
        }
      />
    );
  }

  const nations = index.status === 'ready' ? index.data.nations : [];
  const legend =
    data.status === 'ready' ? <Legend variable={variable} layer={layer} coloring={colorCells(data.data.analysis, layer, shownYear)} unit={unit} year={shownYear} /> : null;

  const controls = (
    <VStack gap={5}>
      <Selector
        label="Nation"
        value={iso3}
        options={nations.map(n => ({value: n.iso3, label: n.name}))}
        onChange={v => {
          if (v) window.location.hash = `#/atlas/${v}?v=${variable}&layer=${layer}`;
        }}
        width="100%"
      />
      <Text type="supporting">
        These seven nations have all seven variables. For any other country, <Link href="#/world">open the World map</Link> (temperature and rainfall).
      </Text>
      <Selector
        label="Variable"
        value={variable}
        options={(['Atmosphere', 'Hydrosphere', 'Land surface'] as const).map(sphere => ({
          type: 'section' as const,
          title: sphere,
          options: VARIABLES.filter(v => v.sphere === sphere).map(v => ({value: v.id, label: v.short, description: v.label})),
        }))}
        onChange={v => v && set({v})}
        width="100%"
      />
      <Text type="supporting">{def.description}</Text>
      <VStack gap={2}>
        <Selector
          label="Map layer"
          value={layer}
          options={LAYERS.map(l => ({value: l.value, label: l.label, description: l.description}))}
          onChange={v => v && set({layer: v === 'change' ? null : v})}
          width="100%"
        />
        <Text type="supporting">
          {layer === 'change'
            ? `Theil–Sen trend in ${unit} per decade.`
            : layer === 'emergence'
              ? 'Signal-to-noise: change across the window divided by the typical year-to-year swing. Beyond ±1 the signal has emerged; beyond ±2 it is clear.'
              : layer === 'year'
                ? `Each cell’s departure from its 1991–2020 normal in a single year, on one colour scale for every year.`
                : `The 1991–2020 average, for context: where values are high or low to begin with.`}
        </Text>
        {layer === 'year' && (
          <VStack gap={2}>
            <Button
              size="sm"
              variant="primary"
              label={playback.playing ? 'Pause the years' : 'Play the years'}
              onClick={() => playback.setPlaying(!playback.playing)}
            />
            <Slider
              label="Year"
              isLabelHidden
              value={shownYear}
              min={from}
              max={to}
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
      </VStack>
      {!narrow && legend}
      <Switch
        label="Stipple significant cells"
        description="Dots mark cells significant at a 10% false discovery rate across the nation."
        value={stipple}
        onChange={(v: boolean) => set({sig: v ? null : 0})}
      />
      <Slider
        label="Analysis window"
        value={windowDraft ?? [from, to]}
        min={FIRST_YEAR}
        max={LAST_YEAR}
        minStepsBetweenThumbs={14}
        valueDisplay="text"
        formatValue={v => String(v)}
        onChange={(v: [number, number]) => setWindowDraft(v)}
        onChangeEnd={(v: [number, number]) => {
          setWindowDraft(null);
          set({from: v[0] === FIRST_YEAR ? null : v[0], to: v[1] === LAST_YEAR ? null : v[1]});
        }}
        width="100%"
      />
      <VStack gap={2}>
        <HStack gap={1} vAlign="center">
          <Text type="label">Focus</Text>
          <HelpTip help={FOCUS_HELP} />
        </HStack>
        <HStack gap={1} wrap="wrap">
          <Button size="sm" label="Whole nation" variant={selection.kind === 'nation' ? 'primary' : 'secondary'} onClick={() => set({cell: null, band: null, region: null})} />
          {meta?.regions.map(r => (
            <Button key={r.id} size="sm" label={r.name} variant={regionParam === r.id && cell === null ? 'primary' : 'secondary'} onClick={() => set({region: r.id, band: null, cell: null})} />
          ))}
        </HStack>
      </VStack>
    </VStack>
  );

  const mapArea = (
    <VStack gap={2}>
      <HStack gap={3} hAlign="between" vAlign="center" wrap="wrap">
        <Heading level={1}>
          {meta?.name ?? iso3} <Text color="secondary" type="large">· {def.short.toLowerCase()}, {from}–{to}</Text>
        </Heading>
        {layer === 'year' && (
          <Text type="display-3" hasTabularNumbers aria-live="polite">
            {shownYear}
          </Text>
        )}
      </HStack>
      <StackItem size="fill">
        <VStack>
        {nation.status === 'ready' && data.status === 'ready' ? (
          <NationMap
            heightCap={narrow ? '80vh' : '140vh'}
            meta={nation.data.meta}
            boundary={nation.data.boundary}
            context={nation.data.context}
            describeCell={c => {
              const a = data.data.analysis;
              const cell = nation.data.meta.cells[c];
              const value =
                layer === 'normal'
                  ? `${num(a.normal[c], def.digits)} ${def.unit} normal`
                  : layer === 'change'
                    ? `${signed(a.slope[c], unit === '% of normal' ? 1 : def.digits)} ${unit}/decade`
                    : layer === 'year'
                      ? `${shownYear}: ${signed(a.annual[c * a.years.length + shownYear - a.window.from], def.relative ? 0 : def.digits)} ${def.relative ? '% vs normal' : def.unit}`
                      : `signal/noise ${num(a.snr[c], 2)}`;
              return [`${lat(cell.lat)}  ${lon(cell.lon)}`, value, a.significant[c] ? 'significant at a 10% false discovery rate' : 'not significant'];
            }}
            analysis={data.data.analysis}
            layer={layer}
            year={shownYear}
            showSignificance={stipple}
            selected={cell}
            onSelect={c => set({cell: c})}
            band={band}
            unitLabel={layer === 'year' ? `${shownYear} anomaly, ${def.relative ? '% of normal' : def.unit}` : `${unit} per decade`}
            onBand={b => set({band: b ? b.join(',') : null, region: null, cell: null})}
            title={`${meta!.name}: ${def.short} ${layer === 'normal' ? '1991–2020 normal' : layer === 'change' ? `trend per decade, ${from}–${to}` : layer === 'year' ? `anomaly in ${shownYear}` : `signal-to-noise, ${from}–${to}`}`}
          />
        ) : data.status === 'error' ? (
          <Banner status="error" title="Could not load this variable" description={data.error.message} endContent={<Button label="Retry" onClick={data.retry} />} />
        ) : (
          <HStack gap={2} vAlign="center">
            <Spinner size="sm" />
            <Text color="secondary">Loading {def.short.toLowerCase()} for {meta?.cells.length ?? '…'} grid cells and running the tests…</Text>
          </HStack>
        )}
        </VStack>
      </StackItem>
    </VStack>
  );

  const evidence =
    meta && data.status === 'ready' ? (
      <EvidencePanel
        meta={meta}
        grid={data.data.grid}
        analysis={data.data.analysis}
        witnessStatus={witness}
        selection={selection}
      />
    ) : null;

  if (narrow) {
    return (
      <Layout
        content={
          <LayoutContent padding={4}>
            <VStack gap={6}>
              {mapArea}
              {legend}
              <Collapsible defaultIsOpen={false} trigger={<Text weight="semibold">Change nation, variable, map layer or years</Text>}>
                {controls}
              </Collapsible>
              <Divider />
              {evidence}
            </VStack>
          </LayoutContent>
        }
      />
    );
  }

  return (
    <Layout
      start={
        <LayoutPanel width={wide ? 340 : 280} padding={5} hasDivider label="Atlas controls" role="region">
          {controls}
        </LayoutPanel>
      }
      content={
        <LayoutContent padding={5} label="Map">
          {mapArea}
        </LayoutContent>
      }
      end={
        <LayoutPanel width={wide ? 520 : 400} padding={5} hasDivider label="Evidence" role="region">
          {evidence}
        </LayoutPanel>
      }
    />
  );
}

const FOCUS_HELP: Help = {
  title: 'Focus',
  what: 'Chooses what the evidence panel describes: the whole nation, a named region, a latitude band you draw, or a single grid cell. The trend, the tests and the witness comparison are all recomputed for that selection.',
  how: 'Pick a region button. Drag up or down on the latitude profile beside the map to draw a band. Click a cell, or focus the map and use the arrow keys, to inspect one cell. “Whole nation” resets the focus.',
  detail: 'Regional, band and national series are area-weighted means of their cells’ annual anomalies, and go through the same Theil–Sen, Hamed–Rao Mann–Kendall, integrity screen and witness comparison as any other selection. A single cell is compared with the witness value at its centre.',
  method: 'data',
};
