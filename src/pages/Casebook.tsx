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
import {VARIABLES, getVariable} from '../data/variables';
import {cellsInBand, subsetAbsolute, subsetSeries} from '../lib/analysis';
import {agreement, trendTest, type Agreement} from '../lib/stats';
import {VERDICT_TEXT, witnessSeries, type Crosscheck} from '../lib/evidence';
import {useAsync, useCrosscheck, useIndex, useMediaQuery, useNation, useVariable} from '../lib/hooks';
import {loadBoundary, loadMeta, loadPreview, type DataIndex} from '../lib/nationData';
import {percent, signed, thousands} from '../lib/format';
import {atlasHref} from '../app/router';
import {NationMap, colorCells} from '../viz/NationMap';
import {Legend} from '../viz/Legend';
import {MiniMap, STRIP_LIMIT} from '../viz/MiniMap';
import {usePlayback} from '../viz/usePlayback';
import {divergingColor} from '../viz/color';
import {YearLedger} from '../viz/YearLedger';

const FULL = {from: 1981, to: 2024};
const YEARS = Array.from({length: 44}, (_, i) => 1981 + i);
const TONE: Record<string, 'success' | 'warning' | 'error' | 'neutral'> = {success: 'success', warning: 'warning', error: 'error', neutral: 'neutral'};
const REPO = 'https://github.com/MichaelCruzat/Bilad';

function Eyebrow({children}: {children: string}) {
  return (
    <Text type="code" color="accent" size="xsm">
      {children.toUpperCase()}
    </Text>
  );
}

export function Casebook() {
  const index = useIndex();
  const crosscheck = useCrosscheck();
  const ready = index.status === 'ready' && crosscheck.status === 'ready';
  return (
    <LayoutContent padding={8}>
      <VStack gap={10}>
        <Hero crosscheck={crosscheck.status === 'ready' ? crosscheck.data : null} />
        {ready ? (
          <>
            <ScaleFacts index={index.data} />
            <HowItWorks />
            <Validation index={index.data} crosscheck={crosscheck.data} />
            <CaseList />
            <Coverage index={index.data} crosscheck={crosscheck.data} />
          </>
        ) : (
          <HStack gap={2} vAlign="center">
            <Spinner size="sm" />
            <Text color="secondary">Loading the shipped NASA data…</Text>
          </HStack>
        )}
        <Footer />
      </VStack>
    </LayoutContent>
  );
}

function Hero({crosscheck}: {crosscheck: Crosscheck | null}) {
  const compact = useMediaQuery('(max-width: 720px)');
  const nation = useNation('CHL');
  const meta = nation.status === 'ready' ? nation.data.meta : null;
  const rain = useVariable(meta, 'PRECTOTCORR', FULL);
  const central = meta?.regions.find(r => r.id === 'central');
  const playback = usePlayback(1981, 2024, {autoplay: true, initial: 1981});

  const share = useMemo(() => {
    if (!meta || !central || rain.status !== 'ready') return null;
    const cells = cellsInBand(meta, central.latMin, central.latMax);
    const abs = subsetAbsolute(meta, rain.data.analysis, cells);
    const avg = (series: ArrayLike<number>, a: number, b: number) => {
      const v = YEARS.flatMap((y, i) => (y >= a && y <= b ? [series[i]] : []));
      return v.reduce((s, x) => s + x, 0) / v.length;
    };
    const w = crosscheck ? witnessSeries(crosscheck, 'CHL', 'PRECTOTCORR', FULL, 'central') : null;
    const witnessShare = w ? 1 - (100 + avg(w, 2010, 2019)) / (100 + avg(w, 1981, 2009)) : null;
    return {share: 1 - avg(abs, 2010, 2019) / avg(abs, 1981, 2009), witnessShare, series: subsetSeries(meta, rain.data.analysis, cells)};
  }, [meta, central, rain, crosscheck]);
  const range =
    share && share.witnessShare !== null
      ? `${percent(Math.min(share.share, share.witnessShare)).replace('%', '')}–${percent(Math.max(share.share, share.witnessShare))}`
      : 'a quarter to a third';

  return (
    <Grid columns={{minWidth: 340, max: 2}} gap={10}>
      <VStack gap={5} vAlign="center">
        <Eyebrow>Bilad · v2 · NASA POWER 1981–2024 · Space Apps 2026</Eyebrow>
        <Heading level={1} type={compact ? 'display-2' : 'display-1'}>
          Bilad
        </Heading>
        <Text type="large">
          Every nation keeps a record of its climate. Bilad finds where it changed, by how much, and whether the change survives an independent witness.
        </Text>
        <Text color="secondary">
          Central Chile has had {range} less rain since 2010. Bangladesh did not cool, even though the same NASA reanalysis says it did and both trends pass a standard significance test. Bilad tells the two apart.
        </Text>
        <HStack gap={2} wrap="wrap">
          <Button label="Open the atlas" variant="primary" href={atlasHref('CHL', {v: 'PRECTOTCORR', layer: 'year'})} />
          <Button label="Case 01: Chile’s missing rain" variant="secondary" href="#/case/chile-megadrought" />
          <Button label="Case 03: the phantom cooling" variant="ghost" href="#/case/bangladesh-phantom-cooling" />
        </HStack>
      </VStack>
      <VStack gap={2} height="40rem">
        <HStack gap={3} vAlign="center" hAlign="between" wrap="wrap">
          <VStack gap={0}>
            <Eyebrow>Chile · rainfall versus the 1991–2020 normal</Eyebrow>
            <Text type="display-2" hasTabularNumbers>
              {playback.year}
            </Text>
          </VStack>
          <Button size="sm" variant="secondary" label={playback.playing ? 'Pause' : 'Play'} onClick={() => playback.setPlaying(!playback.playing)} />
        </HStack>
        <StackItem size="fill">
          {nation.status === 'ready' && rain.status === 'ready' ? (
            <HStack gap={4} height="100%">
              <StackItem size="fill">
                <VStack height="100%">
                  <NationMap
                    meta={nation.data.meta}
                    boundary={nation.data.boundary}
                    context={nation.data.context}
                    analysis={rain.data.analysis}
                    layer="year"
                    year={playback.year}
                    showProfile={false}
                    maxHeight={620}
                    title={`Chile: rainfall in ${playback.year} as a share of the 1991–2020 normal`}
                  />
                </VStack>
              </StackItem>
              {share && (
                <VStack gap={1} width="45%" height="100%">
                  <Text type="code" size="xsm" color="secondary">
                    CENTRAL CHILE, EACH YEAR
                  </Text>
                  <StackItem size="fill">
                    <YearLedger years={YEARS} series={share.series} variable="PRECTOTCORR" current={playback.year} unit="%" title="Central Chile: rainfall each year as a share of the 1991–2020 normal" />
                  </StackItem>
                </VStack>
              )}
            </HStack>
          ) : (
            <HStack gap={2} vAlign="center">
              <Spinner size="sm" />
              <Text color="secondary">Loading 382 Chilean grid cells…</Text>
            </HStack>
          )}
        </StackItem>
        {rain.status === 'ready' && <Legend variable="PRECTOTCORR" layer="year" year={playback.year} coloring={colorCells(rain.data.analysis, 'year', playback.year)} unit="% of normal" />}
        <Text type="supporting">
          NASA POWER (MERRA-2) on NASA GIBS Blue Marble relief. Brown is drier than normal, teal wetter. Right: central Chile (30–38°S), one row per year. Watch the 2010s.
        </Text>
      </VStack>
    </Grid>
  );
}

function Fact({value, label}: {value: string; label: string}) {
  return (
    <VStack gap={1}>
      <Text type="display-2" hasTabularNumbers>
        {value}
      </Text>
      <Text type="supporting">{label}</Text>
    </VStack>
  );
}

function ScaleFacts({index}: {index: DataIndex}) {
  const cells = index.nations.reduce((s, n) => s + n.cells, 0);
  return (
    <VStack gap={4}>
      <Divider />
      <Grid columns={{minWidth: 150, max: 6}} gap={6}>
        <Fact value={String(index.nations.length)} label="nations, one pipeline" />
        <Fact value={thousands(cells)} label="grid cells, each weighted by its land area" />
        <Fact value={String(index.lastYear - index.firstYear + 1)} label={`years of monthly data, ${index.firstYear}–${index.lastYear}`} />
        <Fact value={String(VARIABLES.length)} label="Earth-system variables" />
        <Fact value="2" label="independent NASA witnesses: GISTEMP, GPCP" />
        <Fact value={String(CASES.length)} label="case files, four verdicts" />
      </Grid>
      <Text type="supporting">Counts of the dataset shipped with this site (public/data).</Text>
    </VStack>
  );
}

const STAGES = [
  ['01', 'Acquire', 'Monthly NASA POWER (MERRA-2) values for every 0.5° × 0.625° cell that touches the nation, each weighted by its true land area.'],
  ['02', 'Deseasonalise', 'Compare each month with its own 1991–2020 normal, so a dry summer is not mistaken for a trend; rainfall is read as a share of normal.'],
  ['03', 'Test', 'Theil–Sen trend and a Mann–Kendall test corrected for persistence in every cell, then false-discovery control across the whole map.'],
  ['04', 'Cross-check', 'Screen each record for jumps, then compare it with weather stations (GISTEMP) or gauges and satellites (GPCP) on the same cells.'],
  ['05', 'Explain', 'State what changed, where, how much, how sure, and whether a second record agrees, in plain words next to the numbers.'],
] as const;

function HowItWorks() {
  return (
    <VStack gap={5}>
      <Eyebrow>How Bilad works</Eyebrow>
      <Heading level={2} type="display-3">
        From a NASA record to a verdict
      </Heading>
      <Grid columns={{minWidth: 190, max: 5}} gap={6}>
        {STAGES.map(([n, title, body]) => (
          <VStack key={n} gap={2}>
            <Divider />
            <Text type="code" color="accent">
              {n}
            </Text>
            <Heading level={3}>{title}</Heading>
            <Text type="supporting">{body}</Text>
          </VStack>
        ))}
      </Grid>
      <Link href="#/method">Read the method, with formulas</Link>
    </VStack>
  );
}

function Validation({index, crosscheck}: {index: DataIndex; crosscheck: Crosscheck}) {
  const pair = (iso3: string) => {
    const n = index.nations.find(x => x.iso3 === iso3)!;
    return {claim: trendTest(YEARS, n.stats.T2M.series), witness: trendTest(YEARS, witnessSeries(crosscheck, iso3, 'T2M', FULL)!)};
  };
  const chl = pair('CHL');
  const bgd = pair('BGD');
  const headlines = index.nations.length * VARIABLES.length;
  return (
    <VStack gap={5}>
      <Eyebrow>Validation</Eyebrow>
      <Grid columns={{minWidth: 240, max: 3}} gap={8}>
        <VStack gap={2}>
          <Text type="display-2" hasTabularNumbers color="accent">
            {signed(chl.claim.slope * 10, 2)} = {signed(chl.witness.slope * 10, 2)}
          </Text>
          <Text type="supporting">°C per decade in Chile: the reanalysis and weather stations (GISTEMP) agree to two decimals.</Text>
          <Link href="#/atlas/CHL">See the atlas</Link>
        </VStack>
        <VStack gap={2}>
          <Text type="display-2" hasTabularNumbers>
            {signed(bgd.claim.slope * 10, 2)} / {signed(bgd.witness.slope * 10, 2)}
          </Text>
          <Text type="supporting">°C per decade in Bangladesh: a significant reanalysis cooling that stations contradict, caught by the integrity screen.</Text>
          <Link href="#/case/bangladesh-phantom-cooling">Read case 03</Link>
        </VStack>
        <VStack gap={2}>
          <Text type="display-2" hasTabularNumbers color="accent">
            {headlines} / {headlines}
          </Text>
          <Text type="supporting">shipped headlines recomputed in Python (scipy, pymannkendall) with separate code; the build fails if any disagree.</Text>
          <Link href={`${REPO}/blob/main/pipeline/validate.py`}>The validator</Link>
        </VStack>
      </Grid>
    </VStack>
  );
}

function CaseList() {
  return (
    <VStack gap={4}>
      <Eyebrow>Case files</Eyebrow>
      <Heading level={2} type="display-3">
        Four investigations, four verdicts
      </Heading>
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

function NationTile({iso3, name, verdict}: {iso3: string; name: string; verdict: Agreement}) {
  const data = useAsync(() => Promise.all([loadMeta(iso3), loadBoundary(iso3), loadPreview(iso3)]), [iso3]);
  return (
    <VStack gap={2}>
      <VStack height="13rem">
        {data.status === 'ready' ? (
          <MiniMap meta={data.data[0]} boundary={data.data[1]} preview={data.data[2]} title={`${name}: warming trend per grid cell, 1981–2024`} />
        ) : (
          <Spinner size="sm" />
        )}
      </VStack>
      <HStack gap={2} vAlign="center" hAlign="between" wrap="wrap">
        <Link href={atlasHref(iso3)}>
          <Text weight="semibold">{name}</Text>
        </Link>
        <Badge variant={TONE[VERDICT_TEXT[verdict].tone]} label={VERDICT_TEXT[verdict].label} />
      </HStack>
    </VStack>
  );
}

type LedgerRow = {iso3: string; name: string; cells: number; merra: number; gistemp: number; verdict: Agreement; rainVerdict: Agreement} & Record<string, unknown>;

function Coverage({index, crosscheck}: {index: DataIndex; crosscheck: Crosscheck}) {
  const rows: LedgerRow[] = index.nations.map(n => {
    const t = trendTest(YEARS, n.stats.T2M.series);
    const w = trendTest(YEARS, witnessSeries(crosscheck, n.iso3, 'T2M', FULL)!);
    const rainPct = n.stats.PRECTOTCORR.series.map(v => (v / n.stats.PRECTOTCORR.normal) * 100);
    const rt = trendTest(YEARS, rainPct);
    const rw = trendTest(YEARS, witnessSeries(crosscheck, n.iso3, 'PRECTOTCORR', FULL)!);
    return {iso3: n.iso3, name: n.name, cells: n.cells, merra: t.slope * 10, gistemp: w.slope * 10, verdict: agreement(t, w), rainVerdict: agreement(rt, rw)};
  });
  const verdictCell = (v: Agreement) => <Badge variant={TONE[VERDICT_TEXT[v].tone]} label={VERDICT_TEXT[v].label} />;
  const columns: TableColumn<LedgerRow>[] = [
    {key: 'name', header: 'Nation', width: proportional(1.2), renderCell: r => <Link href={atlasHref(r.iso3)}>{r.name}</Link>},
    {key: 'cells', header: 'Grid cells', align: 'end', width: pixel(96), renderCell: r => <Text hasTabularNumbers>{thousands(r.cells)}</Text>},
    {key: 'merra', header: 'Warming, MERRA-2', align: 'end', width: proportional(1), renderCell: r => <Text hasTabularNumbers>{signed(r.merra, 2)} °C/dec</Text>},
    {key: 'gistemp', header: 'Warming, GISTEMP', align: 'end', width: proportional(1), renderCell: r => <Text hasTabularNumbers>{signed(r.gistemp, 2)} °C/dec</Text>},
    {key: 'verdict', header: 'Temperature verdict', width: proportional(1.4), renderCell: r => verdictCell(r.verdict)},
    {key: 'rainVerdict', header: 'Rainfall verdict (vs GPCP, partly independent)', width: proportional(1.5), renderCell: r => verdictCell(r.rainVerdict)},
  ];
  return (
    <VStack gap={5}>
      <Eyebrow>Coverage</Eyebrow>
      <Heading level={2} type="display-3">
        Six nations, one pipeline
      </Heading>
      <Text color="secondary">
        Warming per grid cell since 1981, every nation on the same scale ({signed(-STRIP_LIMIT, 1)} to {signed(STRIP_LIMIT, 1)} °C per decade), dots where the trend survives false-discovery control. The badge is the national verdict against weather stations.
      </Text>
      <Grid columns={{minWidth: 170, max: 6}} gap={5}>
        {rows.map(r => (
          <NationTile key={r.iso3} iso3={r.iso3} name={r.name} verdict={r.verdict} />
        ))}
      </Grid>
      <HStack gap={2} vAlign="center">
        <svg width="160" height="10" aria-hidden="true">
          {Array.from({length: 32}, (_, i) => (
            <rect key={i} x={i * 5} y={0} width={5} height={10} fill={divergingColor('temperature', -STRIP_LIMIT + (2 * STRIP_LIMIT * i) / 31, STRIP_LIMIT)} />
          ))}
        </svg>
        <Text type="supporting">°C per decade</Text>
      </HStack>
      <Table data={rows} columns={columns} idKey="iso3" density="balanced" hasHover />
      <Text type="supporting">
        MERRA-2 matches stations closely in Chile and Mexico. It warms more slowly than stations in Morocco and Spain (ranges still overlap) and in Kenya (they do not), and it reverses sign in Bangladesh, where its record jumps in 1997–98. Rainfall is compared with a record that shares some rain gauges with MERRA-2. Six nations ship today; adding one is a registry line and <Text type="code">make data NATIONS=PER</Text>.
      </Text>
      <HStack gap={2}>
        <Button label="Open the atlas" variant="primary" href={atlasHref('CHL')} />
      </HStack>
    </VStack>
  );
}

function Footer() {
  return (
    <VStack gap={2}>
      <Divider />
      <HStack gap={4} hAlign="between" wrap="wrap">
        <Text type="code" size="xsm">
          BILAD v2 · BUILT FOR NASA SPACE APPS 2026
        </Text>
        <Link href={REPO}>Source on GitHub</Link>
      </HStack>
      <Text type="supporting">
        Data: <Link href="https://power.larc.nasa.gov/">NASA POWER</Link> (MERRA-2, NASA GMAO) · <Link href="https://data.giss.nasa.gov/gistemp/">GISTEMP v4</Link> (NASA GISS) ·{' '}
        <Link href="https://psl.noaa.gov/data/gridded/data.gpcp.html">GPCP v2.3</Link> (via NOAA PSL) · <Link href="https://earthdata.nasa.gov/gibs">NASA GIBS</Link> Blue Marble relief · boundaries from{' '}
        <Link href="https://www.naturalearthdata.com/">Natural Earth</Link>. Built for the{' '}
        <Link href="https://www.spaceappschallenge.org/2026/challenges/earth-system-trend-detective/">Earth System Trend Detective</Link> challenge. Apache 2.0; AI assistance is disclosed in the README.
      </Text>
    </VStack>
  );
}
