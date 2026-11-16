import {useEffect, useMemo, useRef, useState} from 'react';
import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {Divider} from '@astryxdesign/core/Divider';
import {Grid} from '@astryxdesign/core/Grid';
import {LayoutContent} from '@astryxdesign/core/Layout';
import {Link} from '@astryxdesign/core/Link';
import {SegmentedControl, SegmentedControlItem} from '@astryxdesign/core/SegmentedControl';
import {Spinner} from '@astryxdesign/core/Spinner';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {Heading, Text} from '@astryxdesign/core/Text';
import {MotionStack} from '../features/MotionStack';
import {Figure} from '../features/VerdictStrip';
import {useAsync, useMediaQuery} from '../lib/hooks';
import {loadWorld} from '../lib/nationData';
import {loadCountries, loadGlobalCells, loadGlobalMeta, loadGlobalStats, loadGlobalSummary, loadGlobalWitness, witnessCellSlopes} from '../lib/globalData';
import {VERDICT_ORDER, VERDICT_TEXT} from '../lib/evidence';
import {lat, lon, percent, signed} from '../lib/format';
import {divergingColor, NO_DATA, VERDICT_COLORS} from '../viz/color';
import {GlobeMap, type GlobeControls} from '../viz/GlobeMap';
import {prefersReducedMotion} from '../viz/usePlayback';

type Mode = 'claim' | 'witness' | 'verdict';
const GLOBE_LIMIT = 0.6;
const PHASES: {mode: Mode; title: string; text: string}[] = [
  {mode: 'claim', title: 'First, trace the change.', text: 'Start with 44 years of NASA’s reanalysis. Each land cell carries a temperature trend, from cooling blue to warming red.'},
  {mode: 'witness', title: 'Then, ask a second record.', text: 'Weather-station estimates cover the same ground at a coarser scale. The globe keeps the same colour scale so you can compare the two records.'},
  {mode: 'verdict', title: 'Follow the disagreement.', text: 'Agreement adds support. Opposite trends and abrupt jumps mark places to investigate. A flag asks for scrutiny; it does not establish a cause.'},
];

export function Casebook() {
  const narrow = useMediaQuery('(max-width: 1000px)');
  const summary = useAsync(loadGlobalSummary, []);
  const countries = useAsync(loadCountries, []);
  const world = useAsync(loadWorld, []);
  const bundle = useAsync(async () => {
    const meta = await loadGlobalMeta();
    const [cells, stats, witness] = await Promise.all([loadGlobalCells(), loadGlobalStats('T2M'), loadGlobalWitness('T2M')]);
    return {cells, stats, witnessSlope: witnessCellSlopes(witness, cells.n, meta.grid.firstYear)};
  }, []);
  const ready = bundle.status === 'ready' && summary.status === 'ready' && countries.status === 'ready';
  const failed = [bundle, summary, countries].find(s => s.status === 'error');
  const [mode, setMode] = useState<Mode>('verdict');
  const [follow, setFollow] = useState(true);
  const [cell, setCell] = useState<number | null>(null);
  const [spinning, setSpinning] = useState(() => !prefersReducedMotion());
  const globe = useRef<GlobeControls | null>(null);
  const sections = useRef<(HTMLElement | null)[]>([]);
  const story = useRef<HTMLElement>(null);
  const focus = useMemo(() => mode === 'claim' ? {lon: -25, lat: 20} : mode === 'witness' ? {lon: 60, lat: 18} : null, [mode]);
  useEffect(() => {
    if (!follow || narrow || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        const i = sections.current.indexOf(entry.target as HTMLElement);
        if (i >= 0) setMode(PHASES[i].mode);
      }
    }, {rootMargin: '-25% 0px -45% 0px', threshold: 0});
    sections.current.forEach(node => node && observer.observe(node));
    return () => observer.disconnect();
  }, [follow, narrow]);
  const colorOf = (c: number) => {
    if (!ready) return null;
    const {stats, witnessSlope} = bundle.data;
    if (mode === 'verdict') return stats.agreement[c] === 255 ? NO_DATA : VERDICT_COLORS[stats.agreement[c]];
    const v = mode === 'claim' ? stats.slope[c] : witnessSlope[c];
    return Number.isFinite(v) ? divergingColor('temperature', v, GLOBE_LIMIT) : NO_DATA;
  };
  const describeCell = (c: number): string[] => {
    if (!ready) return [];
    const {cells, stats, witnessSlope} = bundle.data;
    const country = countries.data[cells.country[c]];
    const a = stats.agreement[c];
    return [
      `${country?.name ?? 'Land cell'} · ${lat(cells.lat[c])} ${lon(cells.lon[c])}`,
      `Reanalysis ${signed(stats.slope[c], 2)} · stations ${signed(witnessSlope[c], 2)} °C per decade`,
      stats.flags[c] & 4 ? 'Likely data artefact' : a === 255 ? 'No witness here' : VERDICT_TEXT[summary.data.agreements[a]].label,
    ];
  };
  const globeFigure = (
    <VStack as="figure" gap={4} style={{position: narrow ? 'relative' : 'sticky', top: 'var(--spacing-6)', alignSelf: 'start', margin: 0}}>
      <HStack gap={3} vAlign="center" hAlign="between" wrap="wrap">
        <Text type="label" color="accent">Temperature · 1981–2024</Text>
        <Text type="supporting">Rainfall is also available in Explore.</Text>
      </HStack>
      <SegmentedControl label="What the globe shows" value={mode} onChange={v => { setFollow(false); setMode(v as Mode); }} layout="fill">
        <SegmentedControlItem value="claim" label="Reanalysis says" />
        <SegmentedControlItem value="witness" label="Stations say" />
        <SegmentedControlItem value="verdict" label="Do they agree?" />
      </SegmentedControl>
      <MotionStack motionKey={mode} height={narrow ? '58vh' : 'min(56vh, 44rem)'}>
        {ready ? <GlobeMap cells={bundle.data.cells} colorOf={colorOf} colorKey={mode}
          world={world.status === 'ready' ? world.data : null}
          selectedCell={cell} selectedCountryId={null} onSelectCell={c => { setFollow(false); setCell(c); }}
          describeCell={describeCell} controls={globe} focus={focus}
          spinning={spinning} onSpinningChange={setSpinning} onInteract={() => setFollow(false)}
          title="Globe of land temperature trends since 1981" />
        : failed?.status === 'error' ? <Banner status="error" title="Could not load the globe" description={failed.error.message} endContent={<Button label="Retry" onClick={failed.retry} />} />
        : <HStack gap={2} vAlign="center"><Spinner size="sm" /><Text>Loading the global record…</Text></HStack>}
      </MotionStack>
      <GlobeLegend mode={mode} />
      <HStack gap={2} wrap="wrap">
        <Button size="sm" variant="secondary" label="Zoom in" onClick={() => { setFollow(false); globe.current?.zoomBy(1.5); }} />
        <Button size="sm" variant="secondary" label="Zoom out" onClick={() => { setFollow(false); globe.current?.zoomBy(1 / 1.5); }} />
        <Button size="sm" variant="secondary" label={spinning ? 'Pause globe rotation' : 'Rotate globe'} onClick={() => { setFollow(false); setSpinning(v => !v); }} />
        {!narrow && <Button size="sm" variant="ghost" label={follow ? 'Scroll follows the evidence' : 'Follow the scroll'} onClick={() => setFollow(v => !v)} />}
      </HStack>
      {ready && cell !== null && <MotionStack key={cell} gap={3}>
        <Divider /><Heading level={2}>{describeCell(cell)[0]}</Heading>
        <HStack gap={6} wrap="wrap"><Text>Reanalysis {signed(bundle.data.stats.slope[cell], 2)} °C per decade</Text><Text>Stations {signed(bundle.data.witnessSlope[cell], 2)} °C per decade</Text></HStack>
        <Text weight="semibold">{describeCell(cell)[2]}</Text>
        <Button variant="primary" label="Investigate this cell" href={`#/world?cell=${cell}`} />
      </MotionStack>}
    </VStack>
  );
  return <LayoutContent padding={8} isScrollable={false}><VStack gap={10}>
    <Grid columns={{minWidth: 440, max: 2}} gap={10}>
      <VStack gap={10}>
        <MotionStack gap={5} minHeight={narrow ? undefined : '72vh'}>
          <Text type="label" color="accent">An atlas of a changing Earth</Text>
          <Heading level={1} type="display-1">TRACE</Heading>
          <Text type="large" weight="semibold">Tracking Regional Atmospheric Change on Earth</Text>
          <Heading level={2} type={narrow ? 'display-3' : 'display-2'}>Check the evidence before it becomes a decision.</Heading>
          <Text type="large" color="secondary">Water, farming, and infrastructure plans depend on how temperature and rainfall are changing. A significant trend can still reflect a data discontinuity or conflict with another record. TRACE makes those warnings visible, worldwide.</Text>
          <HStack gap={4} wrap="wrap"><Text type="code">{ready ? bundle.data.cells.n.toLocaleString('en-US') : '54,425'} land cells</Text><Text type="code">1981–2024</Text><Text type="code">60°S–84°N</Text></HStack>
          <HStack gap={3} wrap="wrap"><Button variant="primary" label="Explore the world" href="#/world" /><Button variant="secondary" label="Follow the evidence ↓" onClick={() => story.current?.scrollIntoView({behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start'})} /></HStack>
          <Text type="supporting">A region can be a country or a single grid cell. Coverage spans global land, including every country with cells in this latitude range.</Text>
        </MotionStack>
        {narrow && globeFigure}
        <MotionStack reveal as="section" gap={5}>
          <Divider />
          <Text type="label" color="accent">Why this work matters</Text>
          <Heading level={2} type="display-3">Make climate claims easier to examine.</Heading>
          <Text type="large">TRACE puts trend tests, jump warnings, and a second NASA record in one workflow. The result is a reviewable starting point: where the records agree, where they conflict, and what needs further investigation.</Text>
          <VStack gap={3}>
            <Heading level={3}>For people and researchers</Heading>
            <Text color="secondary">Investigate a country or land cell without writing an analysis pipeline. Follow each result to its sources, uncertainty, and method; export the evidence for further work.</Text>
            <Divider />
            <Heading level={3}>For NASA data users</Heading>
            <Text color="secondary">Compare differently constructed NASA products on one footprint. Disagreements and abrupt changes provide places to investigate product limitations, while the open code makes the checks reproducible.</Text>
            <Divider />
            <Heading level={3}>For governments and public agencies</Heading>
            <Text color="secondary">Screen evidence of long-term warming or rainfall change before using it in an adaptation assessment. Analysts can share the record, assumptions, and uncertainty instead of passing on an unexplained map.</Text>
          </VStack>
          <Text type="supporting">This prototype supports evidence review. It does not forecast conditions, attribute causes, or replace a validated local risk assessment. Institutional use and policy outcomes have not been demonstrated.</Text>
        </MotionStack>
        <VStack gap={8} ref={story}>
          {PHASES.map((phase, i) => <VStack as="section" key={phase.mode} ref={node => { sections.current[i] = node; }} aria-labelledby={`phase-${phase.mode}`}>
            <MotionStack reveal gap={4} minHeight={narrow ? undefined : '52vh'} vAlign="center">
              <Divider /><Text type="code" color="accent">0{i + 1} / The evidence trail</Text>
              <Heading id={`phase-${phase.mode}`} level={2} type="display-3">{phase.title}</Heading>
              <Text type="large" color="secondary">{phase.text}</Text>
              <HStack><Button variant="ghost" label={`Show ${phase.mode === 'claim' ? 'the reanalysis' : phase.mode === 'witness' ? 'the stations' : 'the agreement map'}`} onClick={() => { setFollow(false); setMode(phase.mode); }} /></HStack>
            </MotionStack>
          </VStack>)}
        </VStack>
      </VStack>
      {!narrow && globeFigure}
    </Grid>
    <MotionStack reveal gap={6}>
      <Divider /><Text type="label" color="accent">The global temperature record</Text>
      <Grid columns={{minWidth: 240, max: 3}} gap={6}>
        <Figure value={summary.status === 'ready' ? signed(summary.data.variables.T2M.slopePerDecade, 2) : '…'} unit="°C per decade" caption="Area-weighted land temperature trend, 1981–2024." />
        <Figure value={summary.status === 'ready' ? percent(summary.data.variables.T2M.areaUp) : '…'} unit="of land selected as warming" caption="At a 10% target false discovery rate across the global map." />
        <Figure value={summary.status === 'ready' ? percent(summary.data.variables.T2M.agreement.corroborated + summary.data.variables.T2M.agreement['same-direction']) : '…'} unit="of land backed by stations" caption="Same-direction, significant trends in both records." />
      </Grid>
      <Text type="supporting">Witnesses are coarser estimates, not ground truth at each cell. GPCP rainfall shares some rain-gauge inputs with MERRA-2. Coverage ends at 60°S and 84°N.</Text>
      <HStack gap={3} wrap="wrap"><Button variant="primary" label="Open the global atlas" href="#/world" /><Button variant="secondary" label="How the global checks work" href="#/proof" /></HStack>
    </MotionStack>
    <Divider /><HStack gap={4} wrap="wrap"><Link href="https://github.com/MichaelCruzat/TRACE">Source</Link><Link href="#/method">Method</Link><Text type="supporting">NASA Space Apps · TRACE</Text></HStack>
  </VStack></LayoutContent>;
}

function GlobeLegend({mode}: {mode: Mode}) {
  if (mode === 'verdict') {
    return (
      <HStack gap={4} wrap="wrap">
        {VERDICT_ORDER.map((v, i) => (
          <HStack key={v} gap={2} vAlign="center">
            <svg width="12" height="12" aria-hidden="true">
              <rect width="12" height="12" rx="2" fill={VERDICT_COLORS[i]} />
            </svg>
            <Text type="supporting">{VERDICT_TEXT[v].label}</Text>
          </HStack>
        ))}
      </HStack>
    );
  }
  return (
    <HStack gap={3} vAlign="center" wrap="wrap">
      <Text type="supporting" hasTabularNumbers>
        {signed(-GLOBE_LIMIT, 1)} or cooler
      </Text>
      <svg width="200" height="12" aria-hidden="true">
        {Array.from({length: 40}, (_, i) => (
          <rect key={i} x={i * 5} y={0} width={5} height={12} fill={divergingColor('temperature', -GLOBE_LIMIT + (2 * GLOBE_LIMIT * i) / 39, GLOBE_LIMIT)} />
        ))}
      </svg>
      <Text type="supporting" hasTabularNumbers>
        {signed(GLOBE_LIMIT, 1)} °C per decade or warmer
      </Text>
      <Text type="supporting">
        {mode === 'claim' ? 'Trend in the MERRA-2 reanalysis.' : 'Trend in GISTEMP v4 weather-station temperatures.'}
      </Text>
    </HStack>
  );
}
