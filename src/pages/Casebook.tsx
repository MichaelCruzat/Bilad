import {useEffect, useRef, useState} from 'react';
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
import {Icon} from '@astryxdesign/core/Icon';
import {MotionStack} from '../features/MotionStack';
import {HelpTip, type Help} from '../features/HelpTip';
import {CaseFiles} from '../features/CaseFiles';
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

/** What each evidence-trail button puts on the globe. */
const PHASE_SUBJECT: Record<Mode, string> = {claim: 'the reanalysis', witness: 'the stations', verdict: 'the agreement map'};
const GLOBE_LIMIT = 0.6;
const PHASES: {mode: Mode; title: string; text: string}[] = [
  {mode: 'claim', title: 'Start with what the reanalysis says.', text: 'NASA’s MERRA-2 reanalysis rebuilds past weather by feeding satellite and weather-station observations into a weather model. Each land cell on the globe shows its temperature trend since 1981: blue where it has cooled, red where it has warmed.'},
  {mode: 'witness', title: 'Then ask a second witness.', text: 'GISTEMP, NASA’s temperature record built from thousands of weather stations, covers the same places on a coarser grid. The colours mean the same thing, so you can compare the two globes directly.'},
  {mode: 'verdict', title: 'Look where they disagree.', text: 'Where both records show the same change, the trend is well supported. Where they point in opposite directions, or one record jumps in a single year, the data deserve a closer look. A flag is a reason to check, not proof of what went wrong.'},
];

export function Casebook({section}: {section?: 'cases'}) {
  const home = useRef<HTMLDivElement>(null);
  const caseFiles = useRef<HTMLElement>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => (section === 'cases' ? caseFiles.current : home.current)?.scrollIntoView?.({block: 'start'}));
    return () => cancelAnimationFrame(frame);
  }, [section]);
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
  const [mode, setMode] = useState<Mode>('claim');
  const [cell, setCell] = useState<number | null>(null);
  const [spinning, setSpinning] = useState(() => !prefersReducedMotion());
  const globe = useRef<GlobeControls | null>(null);
  const story = useRef<HTMLElement>(null);
  const figure = useRef<HTMLElement>(null);
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
    <VStack as="figure" ref={figure} gap={4} style={{position: narrow ? 'relative' : 'sticky', top: 'var(--spacing-6)', alignSelf: 'start', margin: 0, minWidth: 0, maxWidth: '100%'}}>
      <HStack gap={3} vAlign="center" hAlign="between" wrap="wrap">
        <HStack gap={1} vAlign="center">
          <Text type="label" color="accent">Temperature · 1981–2024</Text>
          <HelpTip help={globeHelp(mode)} />
        </HStack>
        <Text type="supporting">Rainfall trends are in Explore.</Text>
      </HStack>
      <SegmentedControl label="What the globe shows" value={mode} onChange={v => setMode(v as Mode)} layout="fill">
        <SegmentedControlItem value="claim" label={narrow ? 'Reanalysis' : 'Reanalysis says'} />
        <SegmentedControlItem value="witness" label={narrow ? 'Stations' : 'Stations say'} />
        <SegmentedControlItem value="verdict" label={narrow ? 'Agree?' : 'Do they agree?'} />
      </SegmentedControl>
      <VStack height={narrow ? '58vh' : 'min(56vh, 44rem)'}>
        {ready ? <GlobeMap cells={bundle.data.cells} colorOf={colorOf} colorKey={mode}
          world={world.status === 'ready' ? world.data : null}
          selectedCell={cell} selectedCountryId={null} onSelectCell={setCell}
          describeCell={describeCell} controls={globe}
          spinning={spinning} onSpinningChange={setSpinning}
          title="Globe of land temperature trends since 1981" />
        : failed?.status === 'error' ? <Banner status="error" title="Could not load the globe" description={failed.error.message} endContent={<Button label="Retry" onClick={failed.retry} />} />
        : <HStack gap={2} vAlign="center"><Spinner size="sm" /><Text>Loading the global record…</Text></HStack>}
      </VStack>
      <GlobeLegend mode={mode} />
      <HStack gap={2} wrap="wrap">
        <Button size="sm" variant="secondary" label="Zoom in" onClick={() => globe.current?.zoomBy(1.5)} />
        <Button size="sm" variant="secondary" label="Zoom out" onClick={() => globe.current?.zoomBy(1 / 1.5)} />
        <Button size="sm" variant="secondary" label={spinning ? 'Pause globe rotation' : 'Rotate globe'} onClick={() => setSpinning(v => !v)} />
      </HStack>
      {ready && cell !== null && <MotionStack key={cell} gap={3}>
        <Divider /><Heading level={2}>{describeCell(cell)[0]}</Heading>
        <HStack gap={6} wrap="wrap"><Text>Reanalysis {signed(bundle.data.stats.slope[cell], 2)} °C per decade</Text><Text>Stations {signed(bundle.data.witnessSlope[cell], 2)} °C per decade</Text></HStack>
        <Text weight="semibold">{describeCell(cell)[2]}</Text>
        <Button variant="primary" label="Investigate this cell" href={`#/world?cell=${cell}`} />
      </MotionStack>}
    </VStack>
  );
  return <LayoutContent ref={home} padding={8} isScrollable={false}><VStack gap={10}>
    <Grid columns={{minWidth: 440, max: 2}} gap={10}>
      <VStack gap={10}>
        <MotionStack gap={5} minHeight={narrow ? undefined : '72vh'}>
          <Text type="label" color="accent">An atlas of a changing Earth</Text>
          <Heading level={1} type="display-1">TRACE</Heading>
          <Text type="large" weight="semibold">Tracking Regional Atmospheric Change on Earth</Text>
          <Heading level={2} type={narrow ? 'display-3' : 'display-2'}>Check climate evidence before anyone acts on it.</Heading>
          {summary.status === 'ready' && (
            <Text type="large">
              Since 1981 the world’s land has warmed by about {totalWarming(summary.data.variables.T2M.slopePerDecade)} °C on average. TRACE shows where, and how far each local trend can be trusted.
            </Text>
          )}
          <Text type="large" color="secondary">Plans for water, farming and infrastructure depend on how temperature and rainfall are changing. But a trend that passes a statistical test can still come from a glitch in the data, or disagree with another record. TRACE checks for both across almost all of the world’s land.</Text>
          <HStack gap={4} wrap="wrap"><Text type="code">{ready ? bundle.data.cells.n.toLocaleString('en-US') : '54,425'} land cells</Text><Text type="code">1981–2024</Text><Text type="code">60°S–84°N</Text></HStack>
          <HStack gap={3} wrap="wrap"><Button variant="primary" label="Explore the world" href="#/world" /><Button variant="secondary" label="Follow the evidence ↓" onClick={() => story.current?.scrollIntoView({behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start'})} /></HStack>
          <Link href="#/?section=cases">Read the case files</Link>
          <Text type="supporting">Explore a country or a single 0.5° × 0.625° grid cell. The atlas includes 223 countries with covered cells between 60°S and 84°N; small places may not be resolved at this scale. TRACE was built for NASA Space Apps 2026 from open NASA data; it is not an official NASA product.</Text>
        </MotionStack>
        {narrow && globeFigure}
        <MotionStack reveal as="section" gap={4}>
          <Divider />
          <Text type="label" color="accent">Why this work matters</Text>
          <Heading level={2} type="display-3">Climate claims should be easy to check.</Heading>
          <Text type="large">TRACE puts the trend test, a check for sudden jumps and a second NASA record on one screen, so anyone can see the evidence behind a claim and judge how much weight it can bear.</Text>
          <HStack><Button variant="secondary" label="Who it’s for, and why" href="#/impact" /></HStack>
        </MotionStack>
        <VStack gap={8} ref={story}>
          {PHASES.map((phase, i) => <VStack as="section" key={phase.mode} aria-labelledby={`phase-${phase.mode}`}>
            <MotionStack reveal gap={4} minHeight={narrow ? undefined : '52vh'} vAlign="center">
              <Divider /><Text type="code" color="accent">0{i + 1} / The evidence trail</Text>
              <Heading id={`phase-${phase.mode}`} level={2} type="display-3">{phase.title}</Heading>
              <Text type="large" color="secondary">{phase.text}</Text>
              <HStack>
                <Button
                  variant={mode === phase.mode ? 'primary' : 'secondary'}
                  icon={mode === phase.mode ? <Icon icon="check" /> : undefined}
                  label={`${mode === phase.mode ? 'Showing' : 'Show'} ${PHASE_SUBJECT[phase.mode]} on the globe`}
                  onClick={() => {
                    setMode(phase.mode);
                    // On a phone the globe sits above the trail; bring it into view so the change is visible.
                    if (narrow) figure.current?.scrollIntoView({behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start'});
                  }}
                />
              </HStack>
            </MotionStack>
          </VStack>)}
        </VStack>
      </VStack>
      {!narrow && globeFigure}
    </Grid>
    <MotionStack reveal gap={6}>
      <Divider /><Text type="label" color="accent">The global temperature record</Text>
      <Grid columns={{minWidth: 240, max: 3}} gap={6}>
        <Figure value={summary.status === 'ready' ? signed(summary.data.variables.T2M.slopePerDecade, 2) : '…'} unit="°C per decade" caption={summary.status === 'ready' ? `About ${totalWarming(summary.data.variables.T2M.slopePerDecade)} °C in total since 1981, averaged over covered land and weighted by area.` : 'Average warming across covered land since 1981.'} />
        <Figure value={summary.status === 'ready' ? percent(summary.data.variables.T2M.areaUp) : '…'} unit="of land with a clear warming trend" caption="Still significant after allowing for testing tens of thousands of cells at once (10% false discovery rate)." />
        <Figure value={summary.status === 'ready' ? percent(summary.data.variables.T2M.agreement.corroborated + summary.data.variables.T2M.agreement['same-direction']) : '…'} unit="of land where stations agree" caption="Both records show a significant trend in the same direction." />
      </Grid>
      <Text type="supporting">The station record is an estimate too, on a coarser grid, so neither record is the final word for a single cell. Coverage stops at 60°S and 84°N.</Text>
      <HStack gap={3} wrap="wrap"><Button variant="primary" label="Open the global atlas" href="#/world" /><Button variant="secondary" label="How the global checks work" href="#/proof" /></HStack>
    </MotionStack>
    <VStack as="section" ref={caseFiles} aria-labelledby="case-files-heading" style={{scrollMarginBlockStart: 'var(--spacing-6)'}}>
      <MotionStack reveal><CaseFiles /></MotionStack>
    </VStack>
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

/** What the evidence globe shows in each view, then the data behind it. */
function globeHelp(mode: Mode): Help {
  const what: Record<Mode, string> = {
    claim: 'Each land cell’s temperature trend per decade since 1981 in NASA’s MERRA-2 reanalysis, from cooling blue to warming red.',
    witness: 'The same trend measured by an independent record, GISTEMP v4, built from weather stations on a coarser grid. Compare it with the reanalysis view: the colours mean the same thing.',
    verdict: 'Whether the two records agree for each land cell. Green: both show the same significant change. Red: they point in opposite directions, so the reanalysis there is suspect. The legend below lists every outcome. In practice: green means you can lean on the trend; yellow or olive means the direction holds but the size is uncertain; red or orange means do not rely on it until someone has looked into it.',
  };
  return {
    title: 'Evidence globe',
    what: what[mode],
    how: 'The globe keeps turning as you scroll. Choose a data view with the buttons; scrolling keeps your choice and camera position. Drag to turn it, use the zoom buttons, or pause rotation. Click a land cell to compare both records there. Keyboard: arrow keys turn the globe and Enter selects the cell under the crosshair. Direct map interaction pauses rotation so you can inspect a place.',
    detail: 'MERRA-2 from NASA POWER on its native 0.5° × 0.625° grid, 1981–2024. Witness: GISTEMP v4 (2°, 250 km smoothing, land stations), sampled at each cell’s centre. Trends: Theil–Sen; significance: Hamed–Rao-corrected Mann–Kendall. Verdicts compare direction, significance and overlap of the two 95% ranges.',
    method: mode === 'verdict' ? 'witnesses' : 'theil-sen',
  };
}

/** Total change over 1981–2024 from a per-decade trend, e.g. +0.25 → "1.1". */
function totalWarming(perDecade: number): string {
  return (perDecade * 4.3).toFixed(1);
}
