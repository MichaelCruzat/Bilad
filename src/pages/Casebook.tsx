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
import {cellsInBand, subsetAbsolute} from '../lib/analysis';
import {agreement, trendTest, type Agreement} from '../lib/stats';
import {VERDICT_TEXT, witnessSeries, type Crosscheck} from '../lib/evidence';
import {useAsync, useCrosscheck, useIndex, useNation, useVariable} from '../lib/hooks';
import {loadBoundary, loadMeta, loadPreview, loadWorld, type DataIndex} from '../lib/nationData';
import {percent, signed, thousands} from '../lib/format';
import {atlasHref} from '../app/router';
import {MiniMap, STRIP_LIMIT} from '../viz/MiniMap';
import {divergingColor, VERDICT_COLORS} from '../viz/color';
import {APP_NAME, Wordmark} from '../brand/Logo';
import {WorldMap} from '../viz/WorldMap';
import {AspectRatio} from '@astryxdesign/core/AspectRatio';
import {globalReliefUrl, loadCountries, loadGlobalCells, loadGlobalMeta, loadGlobalStats, loadGlobalSummary} from '../lib/globalData';

const FULL = {from: 1981, to: 2024};
const YEARS = Array.from({length: 44}, (_, i) => 1981 + i);
const TONE: Record<string, 'success' | 'warning' | 'error' | 'neutral'> = {success: 'success', warning: 'warning', error: 'error', neutral: 'neutral'};
const REPO = 'https://github.com/MichaelCruzat/Bilad';
const WORDS: Record<number, string> = {5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine', 10: 'Ten'};

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
  const meta = useAsync(loadGlobalMeta, []);
  const summary = useAsync(loadGlobalSummary, []);
  const countries = useAsync(loadCountries, []);
  const world = useAsync(loadWorld, []);
  const bundle = useAsync(async () => ({cells: await loadGlobalCells(), stats: await loadGlobalStats('T2M')}), []);
  const ready = meta.status === 'ready' && summary.status === 'ready' && countries.status === 'ready' && bundle.status === 'ready';
  const g = summary.status === 'ready' ? summary.data.variables.T2M : null;
  const chile = useChileShare(crosscheck);
  return (
    <VStack gap={5}>
      <Eyebrow>{`${APP_NAME} · v2 · NASA POWER 1981–2024 · Space Apps 2026`}</Eyebrow>
      <HStack gap={10} wrap="wrap" vAlign="end">
        <VStack maxWidth="40rem" width="min(100%, 40rem)">
          <Heading level={1}>
            <Wordmark />
          </Heading>
        </VStack>
        <VStack gap={3} maxWidth="38rem">
          <Text type="large">
            Every place on Earth keeps a climate record. {APP_NAME} reads each one, finds what changed and by how much, and asks a second, independent record whether to believe it.
          </Text>
          <Text color="secondary">
            {g
              ? `Since 1981, ${percent(g.areaUp)} of the world’s land has warmed beyond chance. Across ${percent(g.areaFlagged, 0)} of it, weather stations contradict the reanalysis, so ${APP_NAME} flags the trend instead of reporting it.`
              : 'Loading every land cell on Earth…'}{' '}
            {chile ? `Central Chile has had ${chile} less rain since 2010; Bangladesh did not cool, whatever the reanalysis says.` : ''}
          </Text>
          <HStack gap={2} wrap="wrap">
            <Button label="Explore the world" variant="primary" href="#/world" />
            <Button label="Case 03: the phantom cooling" variant="secondary" href="#/case/bangladesh-phantom-cooling" />
          </HStack>
        </VStack>
      </HStack>
      <AspectRatio ratio={2.5}>
        <VStack height="100%">
          {ready ? (
            <WorldMap
              cells={bundle.data.cells}
              stats={bundle.data.stats}
              annual={null}
              layer="verdict"
              year={2024}
              firstYear={1981}
              extent={meta.data.extent ?? [-180, -60, 180, 84]}
              reliefUrl={globalReliefUrl}
              world={world.status === 'ready' ? world.data : null}
              selectedCell={null}
              selectedCountry={null}
              countryIds={countries.data.map(c => c.id)}
              onSelectCell={c => {
                if (c !== null) window.location.hash = `#/world?cell=${c}`;
              }}
              describeCell={c => {
                const country = bundle.data.cells.country[c];
                const a = bundle.data.stats.agreement[c];
                return [
                  country !== 65535 ? countries.data[country].name : 'Open water',
                  `${signed(bundle.data.stats.slope[c], 2)} °C per decade`,
                  a === 255 ? 'no station record here' : `stations: ${VERDICT_TEXT[summary.data.agreements[a]].label.toLowerCase()}`,
                  'click to cross-examine',
                ];
              }}
              title="World map: is each land cell’s warming trend backed by weather stations?"
            />
          ) : (
            <HStack gap={2} vAlign="center">
              <Spinner size="sm" />
              <Text color="secondary">Loading every land cell on Earth…</Text>
            </HStack>
          )}
        </VStack>
      </AspectRatio>
      <HStack gap={5} wrap="wrap" vAlign="center">
        {(['Corroborated by stations', 'Same direction, different size', 'Weakly supported', 'Contradicted', 'Not supported', 'No detectable trend'] as const).map((label, i) => (
          <HStack key={label} gap={2} vAlign="center">
            <svg width="12" height="12" aria-hidden="true">
              <rect width="12" height="12" rx="2" fill={VERDICT_COLORS[i]} />
            </svg>
            <Text type="supporting">{label}</Text>
          </HStack>
        ))}
      </HStack>
      <Text type="supporting">
        Temperature trend 1981–2024 for every land cell from 60°S to 84°N (NASA POWER, MERRA-2), checked cell by cell against GISTEMP weather stations, on NASA GIBS Blue Marble relief. Scroll to zoom, drag to pan, click a cell to open it.
      </Text>
    </VStack>
  );
}

/** "23–34%": central Chile's post-2010 rainfall deficit in MERRA-2 and GPCP. */
function useChileShare(crosscheck: Crosscheck | null): string | null {
  const nation = useNation('CHL');
  const meta = nation.status === 'ready' ? nation.data.meta : null;
  const rain = useVariable(meta, 'PRECTOTCORR', FULL);
  return useMemo(() => {
    const central = meta?.regions.find(r => r.id === 'central');
    if (!meta || !central || rain.status !== 'ready' || !crosscheck) return null;
    const cells = cellsInBand(meta, central.latMin, central.latMax);
    const abs = subsetAbsolute(meta, rain.data.analysis, cells);
    const avg = (series: ArrayLike<number>, a: number, b: number) => {
      const v = YEARS.flatMap((y, i) => (y >= a && y <= b ? [series[i]] : []));
      return v.reduce((s, x) => s + x, 0) / v.length;
    };
    const w = witnessSeries(crosscheck, 'CHL', 'PRECTOTCORR', FULL, 'central');
    if (!w) return null;
    const m2 = 1 - avg(abs, 2010, 2019) / avg(abs, 1981, 2009);
    const gp = 1 - (100 + avg(w, 2010, 2019)) / (100 + avg(w, 1981, 2009));
    return `${percent(Math.min(m2, gp)).replace('%', '')}–${percent(Math.max(m2, gp))}`;
  }, [meta, rain, crosscheck]);
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
        {WORDS[rows.length] ?? rows.length} nations in detail, one pipeline
      </Heading>
      <Text color="secondary">
        Warming per grid cell since 1981, every nation on the same scale ({signed(-STRIP_LIMIT, 1)} to {signed(STRIP_LIMIT, 1)} °C per decade), dots where the trend survives false-discovery control. The badge is the national verdict against weather stations.
      </Text>
      <Grid columns={{minWidth: 160, max: 7}} gap={5}>
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
        MERRA-2 matches stations closely in Chile and Mexico. It warms more slowly than stations in Morocco and Spain (ranges still overlap) and in Kenya (they do not), and it reverses sign in Bangladesh, where its record jumps in 1997–98. Rainfall is compared with a record that shares some rain gauges with MERRA-2. These nations ship with full detail; adding one is a registry line and <Text type="code">make data NATIONS=PER</Text>.
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
