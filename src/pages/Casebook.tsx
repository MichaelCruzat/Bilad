import {useMemo} from 'react';
import {Badge} from '@astryxdesign/core/Badge';
import {Button} from '@astryxdesign/core/Button';
import {Divider} from '@astryxdesign/core/Divider';
import {Grid} from '@astryxdesign/core/Grid';
import {LayoutContent} from '@astryxdesign/core/Layout';
import {Link} from '@astryxdesign/core/Link';
import {Spinner} from '@astryxdesign/core/Spinner';
import {HStack, StackItem, VStack} from '@astryxdesign/core/Stack';
import {Table, pixel, proportional, type TableColumn} from '@astryxdesign/core/Table';
import {Heading, Text} from '@astryxdesign/core/Text';
import {CASES} from '../data/cases';
import {getVariable} from '../data/variables';
import {cellsInBand, subsetAbsolute} from '../lib/analysis';
import {agreement, trendTest, type Agreement} from '../lib/stats';
import {VERDICT_TEXT, witnessSeries, type Crosscheck} from '../lib/evidence';
import {useCrosscheck, useIndex, useNation, useVariable} from '../lib/hooks';
import type {DataIndex} from '../lib/nationData';
import {percent, signed, thousands} from '../lib/format';
import {atlasHref} from '../app/router';
import {NationMap} from '../viz/NationMap';

const FULL = {from: 1981, to: 2024};
const TONE: Record<string, 'success' | 'warning' | 'error' | 'neutral'> = {success: 'success', warning: 'warning', error: 'error', neutral: 'neutral'};

export function Casebook() {
  const index = useIndex();
  const crosscheck = useCrosscheck();
  return (
    <LayoutContent padding={8}>
      <VStack gap={10}>
        <Hero />
        <CaseList />
        <Method />
        {index.status === 'ready' && crosscheck.status === 'ready' ? (
          <NationLedger index={index.data} crosscheck={crosscheck.data} />
        ) : (
          <HStack gap={2} vAlign="center">
            <Spinner size="sm" />
            <Text color="secondary">Loading the nation ledger…</Text>
          </HStack>
        )}
        <Credits />
      </VStack>
    </LayoutContent>
  );
}

function Hero() {
  const nation = useNation('CHL');
  const meta = nation.status === 'ready' ? nation.data.meta : null;
  const rain = useVariable(meta, 'PRECTOTCORR', FULL);
  const central = meta?.regions.find(r => r.id === 'central');

  const share = useMemo(() => {
    if (!meta || !central || rain.status !== 'ready') return null;
    const cells = cellsInBand(meta, central.latMin, central.latMax);
    const abs = subsetAbsolute(meta, rain.data.analysis, cells);
    const avg = (a: number, b: number) => {
      const v = rain.data.analysis.years.flatMap((y, i) => (y >= a && y <= b ? [abs[i]] : []));
      return v.reduce((s, x) => s + x, 0) / v.length;
    };
    return {share: 1 - avg(2010, 2019) / avg(1981, 2009), cells: new Set(cells)};
  }, [meta, central, rain]);

  return (
    <Grid columns={{minWidth: 340, max: 2}} gap={10}>
      <VStack gap={5} vAlign="center">
        <Text type="supporting" color="accent">
          BILAD · AN EARTH-SYSTEM TREND DETECTIVE · NASA SPACE APPS 2026
        </Text>
        <Heading level={1} type="display-1">
          Central Chile lost {share ? percent(share.share) : 'a third'} of its rain. Bangladesh did not cool.
        </Heading>
        <Text type="large" color="secondary">
          Both claims come out of the same NASA dataset, and both pass a standard significance test. Only one is true. Bilad maps 44 years of NASA Earth-system data across a nation, tests every trend properly, and cross-examines it against an independent NASA record before calling it real.
        </Text>
        <HStack gap={2} wrap="wrap">
          <Button label="Open case 01: Chile’s missing rain" variant="primary" href="#/case/chile-megadrought" />
          <Button label="Case 03: the phantom cooling" variant="secondary" href="#/case/bangladesh-phantom-cooling" />
          <Button label="Open the atlas" variant="ghost" href={atlasHref('CHL', {v: 'PRECTOTCORR', region: 'central'})} />
        </HStack>
      </VStack>
      <VStack gap={2} height="36rem">
        {nation.status === 'ready' && rain.status === 'ready' ? (
          <NationMap
            meta={nation.data.meta}
            boundary={nation.data.boundary}
            analysis={rain.data.analysis}
            layer="change"
            emphasis={share?.cells ?? null}
            maxHeight={600}
            title="Chile: rainfall trend per decade 1981–2024, percent of normal, central Chile highlighted; dots mark cells significant after false-discovery control"
          />
        ) : (
          <HStack gap={2} vAlign="center">
            <Spinner size="sm" />
            <Text color="secondary">Loading 382 Chilean grid cells…</Text>
          </HStack>
        )}
        <Text type="supporting">
          Rainfall trend 1981–2024, % of the 1991–2020 normal per decade (brown drier, teal wetter); central Chile highlighted. Dots: significant after false-discovery control. Beside the map, each cell’s trend against latitude.
        </Text>
      </VStack>
    </Grid>
  );
}

function CaseList() {
  return (
    <VStack gap={4}>
      <VStack gap={1}>
        <Heading level={2}>Case files</Heading>
        <Text color="secondary">Four investigations, each ending in a different verdict. Every number on a case page is computed in your browser from the shipped NASA data.</Text>
      </VStack>
      <VStack gap={0}>
        {CASES.map(c => {
          const tone = c.expected === 'unwitnessed' ? 'neutral' : VERDICT_TEXT[c.expected].tone;
          const label = c.expected === 'unwitnessed' ? 'No witness at this scale' : VERDICT_TEXT[c.expected].label;
          return (
            <VStack key={c.id} gap={0}>
              <Divider />
              <HStack gap={5} paddingBlock={4} vAlign="center" wrap="wrap">
                <Text type="display-3" color="accent" hasTabularNumbers>
                  {c.number}
                </Text>
                <StackItem size="fill">
                <VStack gap={1}>
                  <Link href={`#/case/${c.id}`}>
                    <Text type="large" weight="semibold">
                      {c.title}
                    </Text>
                  </Link>
                  <Text color="secondary">
                    {c.dek} · {getVariable(c.variable).short}
                  </Text>
                </VStack>
                </StackItem>
                <Badge variant={TONE[tone]} label={label} />
              </HStack>
            </VStack>
          );
        })}
        <Divider />
      </VStack>
    </VStack>
  );
}

type Step = {step: string; method: string; rules: string} & Record<string, unknown>;

const STEPS: Step[] = [
  {step: '1. Measure', method: 'NASA POWER monthly MERRA-2, 0.5° × 0.625° cells, 1981–2024, each weighted by its true land area', rules: 'Point samples standing in for a whole nation'},
  {step: '2. Deseasonalise', method: 'Monthly anomalies against the WMO 1991–2020 normal, averaged into years', rules: 'The seasonal cycle swamping the trend'},
  {step: '3. Test each cell', method: 'Theil–Sen slope; Mann–Kendall with Hamed–Rao correction', rules: 'Outliers; one warm decade posing as a trend'},
  {step: '4. Test the map', method: 'Benjamini–Hochberg false-discovery control (α = 0.10)', rules: 'Hundreds of tests producing “significant” cells by chance'},
  {step: '5. Screen integrity', method: 'Step-versus-trend comparison (BIC) and co-breaks across variables', rules: 'A change in satellites or processing posing as climate'},
  {step: '6. Cross-examine', method: 'Same footprint in GISTEMP v4 (stations) and GPCP v2.3 (gauges + satellites)', rules: 'Trusting a single dataset'},
];

function Method() {
  const columns: TableColumn<Step>[] = [
    {key: 'step', header: 'Step', width: pixel(150)},
    {key: 'method', header: 'How', width: proportional(2)},
    {key: 'rules', header: 'What it rules out', width: proportional(1.4)},
  ];
  return (
    <VStack gap={4}>
      <VStack gap={1}>
        <Heading level={2}>How a trend earns a verdict</Heading>
        <Text color="secondary">
          The challenge asks what is changing, where, how much, and whether it is significant. Bilad adds a fifth question, whether the change is real, because a significance test only checks the record it is given.
        </Text>
      </VStack>
      <Table data={STEPS} columns={columns} idKey="step" density="balanced" />
      <Link href="#/method">Read the full method, formulas and limitations</Link>
    </VStack>
  );
}

type LedgerRow = {
  iso3: string;
  name: string;
  cells: number;
  area: number;
  merra: number;
  gistemp: number;
  verdict: Agreement;
  rainVerdict: Agreement;
} & Record<string, unknown>;

function NationLedger({index, crosscheck}: {index: DataIndex; crosscheck: Crosscheck}) {
  const years = Array.from({length: index.lastYear - index.firstYear + 1}, (_, i) => index.firstYear + i);
  const rows: LedgerRow[] = index.nations.map(n => {
    const t = trendTest(years, n.stats.T2M.series);
    const w = trendTest(years, witnessSeries(crosscheck, n.iso3, 'T2M', FULL)!);
    // Rainfall is compared in % of the 1991–2020 normal on both sides.
    const rainPct = n.stats.PRECTOTCORR.series.map(v => (v / n.stats.PRECTOTCORR.normal) * 100);
    const rainW = witnessSeries(crosscheck, n.iso3, 'PRECTOTCORR', FULL)!;
    const rt = trendTest(years, rainPct);
    const rw = trendTest(years, rainW);
    return {
      iso3: n.iso3,
      name: n.name,
      cells: n.cells,
      area: n.areaKm2,
      merra: t.slope * 10,
      gistemp: w.slope * 10,
      verdict: agreement(t, w),
      rainVerdict: agreement(rt, rw),
    };
  });
  const verdictCell = (v: Agreement) => <Badge variant={TONE[VERDICT_TEXT[v].tone]} label={VERDICT_TEXT[v].label} />;
  const columns: TableColumn<LedgerRow>[] = [
    {key: 'name', header: 'Nation', width: proportional(1.2), renderCell: r => <Link href={atlasHref(r.iso3)}>{r.name}</Link>},
    {key: 'cells', header: 'Grid cells', align: 'end', width: pixel(96), renderCell: r => <Text hasTabularNumbers>{thousands(r.cells)}</Text>},
    {key: 'merra', header: 'Warming, MERRA-2', align: 'end', width: proportional(1), renderCell: r => <Text hasTabularNumbers>{signed(r.merra, 2)} °C/dec</Text>},
    {key: 'gistemp', header: 'Warming, GISTEMP', align: 'end', width: proportional(1), renderCell: r => <Text hasTabularNumbers>{signed(r.gistemp, 2)} °C/dec</Text>},
    {key: 'verdict', header: 'Temperature verdict', width: proportional(1.4), renderCell: r => verdictCell(r.verdict)},
    {key: 'rainVerdict', header: 'Rainfall verdict (vs GPCP)', width: proportional(1.4), renderCell: r => verdictCell(r.rainVerdict)},
  ];
  return (
    <VStack gap={4}>
      <VStack gap={1}>
        <Heading level={2}>Six nations, one pipeline</Heading>
        <Text color="secondary">
          The same code builds every nation: boundary, grid, land weights, tests and cross-examination. Adding a country is one line in a registry and one command, so the ledger can grow to any nation NASA POWER covers.
        </Text>
      </VStack>
      <Table data={rows} columns={columns} idKey="iso3" density="balanced" hasHover />
      <Grid columns={{minWidth: 300, max: 2}} gap={6}>
        <Text type="supporting">
          National, area-weighted trends 1981–2024. The pattern matters: MERRA-2 matches stations in Chile and Mexico, runs slow in Kenya, Morocco and Spain, and reverses sign in Bangladesh, where its record jumps in 1997–98. That is why Bilad never shows a reanalysis trend without its witness.
        </Text>
        <VStack gap={1}>
          <Text type="supporting">Add a nation:</Text>
          <Text type="code">make data NATIONS=PER</Text>
          <Text type="supporting">after one registry line in pipeline/nations.py.</Text>
        </VStack>
      </Grid>
    </VStack>
  );
}

function Credits() {
  return (
    <VStack gap={2}>
      <Divider />
      <Text type="supporting">
        Data: <Link href="https://power.larc.nasa.gov/">NASA POWER</Link> (MERRA-2, NASA GMAO) · <Link href="https://data.giss.nasa.gov/gistemp/">GISTEMP v4</Link> (NASA GISS) ·{' '}
        <Link href="https://psl.noaa.gov/data/gridded/data.gpcp.html">GPCP v2.3</Link> (NASA GSFC via NOAA PSL) · boundaries from <Link href="https://www.naturalearthdata.com/">Natural Earth</Link>. Built for the{' '}
        <Link href="https://www.spaceappschallenge.org/2026/challenges/earth-system-trend-detective/">Earth System Trend Detective</Link> challenge. Open source under Apache 2.0; AI assistance is disclosed in the README.
      </Text>
    </VStack>
  );
}
