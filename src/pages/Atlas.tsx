import {useMemo, useState} from 'react';
import {Button} from '@astryxdesign/core/Button';
import {Divider} from '@astryxdesign/core/Divider';
import {Layout, LayoutContent, LayoutPanel} from '@astryxdesign/core/Layout';
import {SegmentedControl, SegmentedControlItem} from '@astryxdesign/core/SegmentedControl';
import {Selector} from '@astryxdesign/core/Selector';
import {Slider} from '@astryxdesign/core/Slider';
import {Spinner} from '@astryxdesign/core/Spinner';
import {HStack, StackItem, VStack} from '@astryxdesign/core/Stack';
import {Switch} from '@astryxdesign/core/Switch';
import {Heading, Text} from '@astryxdesign/core/Text';
import {Banner} from '@astryxdesign/core/Banner';
import {FIRST_YEAR, LAST_YEAR, VARIABLES, getVariable} from '../data/variables';
import {trendUnit} from '../lib/analysis';
import {useCrosscheck, useIndex, useMediaQuery, useNation, useVariable} from '../lib/hooks';
import {useAtlasParams} from '../app/router';
import {lat, lon, signed, num} from '../lib/format';
import {NationMap, colorCells, type MapLayer} from '../viz/NationMap';
import {Legend} from '../viz/Legend';
import {EvidencePanel, type Selection} from '../features/EvidencePanel';

type Props = {iso3: string; params: URLSearchParams};

const LAYERS: {value: MapLayer; label: string}[] = [
  {value: 'change', label: 'Change'},
  {value: 'emergence', label: 'Emergence'},
  {value: 'normal', label: 'Normal'},
];

function intParam(params: URLSearchParams, key: string, fallback: number): number {
  const v = Number(params.get(key));
  return Number.isFinite(v) && params.has(key) ? v : fallback;
}

export function Atlas({iso3, params}: Props) {
  const set = useAtlasParams(iso3, params);
  const index = useIndex();
  const nation = useNation(iso3);
  const crosscheck = useCrosscheck();
  const narrow = useMediaQuery('(max-width: 1100px)');

  const variable = VARIABLES.some(v => v.id === params.get('v')) ? params.get('v')! : 'T2M';
  const layer = (LAYERS.find(l => l.value === params.get('layer'))?.value ?? 'change') as MapLayer;
  const from = Math.max(FIRST_YEAR, Math.min(LAST_YEAR - 14, intParam(params, 'from', FIRST_YEAR)));
  const to = Math.min(LAST_YEAR, Math.max(from + 14, intParam(params, 'to', LAST_YEAR)));
  const stipple = params.get('sig') !== '0';
  const cellParam = params.has('cell') ? Number(params.get('cell')) : null;
  const bandParam = params.get('band')?.split(',').map(Number);
  const regionParam = params.get('region');
  const [windowDraft, setWindowDraft] = useState<[number, number] | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  const meta = nation.status === 'ready' ? nation.data.meta : null;
  const span = useMemo(() => ({from, to}), [from, to]);
  const data = useVariable(meta, variable, span);
  const def = getVariable(variable);
  const unit = trendUnit(variable);

  const region = meta?.regions.find(r => r.id === regionParam);
  const band: [number, number] | null = region
    ? [region.latMin, region.latMax]
    : bandParam && bandParam.length === 2 && bandParam.every(Number.isFinite)
      ? [bandParam[0], bandParam[1]]
      : null;
  const cell = meta && cellParam !== null && cellParam >= 0 && cellParam < meta.cells.length ? cellParam : null;
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
        <SegmentedControl label="Map layer" value={layer} onChange={v => set({layer: v === 'change' ? null : v})} layout="fill">
          {LAYERS.map(l => (
            <SegmentedControlItem key={l.value} value={l.value} label={l.label} />
          ))}
        </SegmentedControl>
        <Text type="supporting">
          {layer === 'change'
            ? `Theil–Sen trend in ${unit} per decade.`
            : layer === 'emergence'
              ? 'Change across the window divided by the typical year-to-year swing. Beyond ±1 the signal has emerged; beyond ±2 it is clear.'
              : `The 1991–2020 average, for context: where the ${def.short.toLowerCase()} is high or low to begin with.`}
        </Text>
      </VStack>
      {data.status === 'ready' && (
        <Legend variable={variable} layer={layer} coloring={colorCells(data.data.analysis, layer)} unit={unit} />
      )}
      <Switch
        label="Stipple significant cells"
        description="Dots mark cells that survive false-discovery-rate control across the whole map."
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
        <Text type="label">Focus</Text>
        <HStack gap={1} wrap="wrap">
          <Button size="sm" label="Whole nation" variant={selection.kind === 'nation' ? 'primary' : 'secondary'} onClick={() => set({cell: null, band: null, region: null})} />
          {meta?.regions.map(r => (
            <Button key={r.id} size="sm" label={r.name} variant={regionParam === r.id && cell === null ? 'primary' : 'secondary'} onClick={() => set({region: r.id, band: null, cell: null})} />
          ))}
        </HStack>
        <Text type="supporting">Drag on the latitude profile beside the map to define your own band. Click a cell, or focus the map and use the arrow keys, to inspect one grid cell.</Text>
      </VStack>
    </VStack>
  );

  const hoverCell = hover !== null && meta && data.status === 'ready' ? hover : null;
  const mapArea = (
    <VStack gap={2} height="100%">
      <HStack gap={3} hAlign="between" vAlign="center" wrap="wrap">
        <Heading level={1}>
          {meta?.name ?? iso3} <Text color="secondary" type="large">· {def.short.toLowerCase()}, {from}–{to}</Text>
        </Heading>
        <Text type="supporting" hasTabularNumbers aria-live="polite">
          {hoverCell !== null && data.status === 'ready'
            ? `${lat(meta!.cells[hoverCell].lat)} ${lon(meta!.cells[hoverCell].lon)} · ${
                layer === 'normal'
                  ? `${num(data.data.analysis.normal[hoverCell], def.digits)} ${def.unit}`
                  : layer === 'change'
                    ? `${signed(data.data.analysis.slope[hoverCell], unit === '% of normal' ? 1 : def.digits)} ${unit}/decade`
                    : `S/N ${num(data.data.analysis.snr[hoverCell], 2)}`
              }${data.data.analysis.significant[hoverCell] ? ' · significant' : ''}`
            : 'Hover a cell to read its value'}
        </Text>
      </HStack>
      <StackItem size="fill">
        <VStack height={narrow ? '28rem' : '100%'}>
        {nation.status === 'ready' && data.status === 'ready' ? (
          <NationMap
            meta={nation.data.meta}
            boundary={nation.data.boundary}
            analysis={data.data.analysis}
            layer={layer}
            showSignificance={stipple}
            selected={cell}
            onSelect={c => set({cell: c})}
            onHover={setHover}
            band={band}
            onBand={b => set({band: b ? b.join(',') : null, region: null, cell: null})}
            title={`${meta!.name}: ${def.short} ${layer === 'normal' ? '1991–2020 normal' : layer === 'change' ? `trend per decade, ${from}–${to}` : `signal-to-noise, ${from}–${to}`}`}
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
        crosscheck={crosscheck.status === 'ready' ? crosscheck.data : null}
        selection={selection}
      />
    ) : null;

  if (narrow) {
    return (
      <Layout
        content={
          <LayoutContent padding={4}>
            <VStack gap={6}>
              {controls}
              <Divider />
              {mapArea}
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
        <LayoutPanel width={280} padding={5} hasDivider label="Atlas controls" role="region">
          {controls}
        </LayoutPanel>
      }
      content={
        <LayoutContent padding={5} isScrollable={false} label="Map">
          {mapArea}
        </LayoutContent>
      }
      end={
        <LayoutPanel width={460} padding={5} hasDivider label="Evidence" role="region">
          {evidence}
        </LayoutPanel>
      }
    />
  );
}
