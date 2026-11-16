import {useEffect, useRef} from 'react';
import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {Center} from '@astryxdesign/core/Center';
import {CodeBlock} from '@astryxdesign/core/CodeBlock';
import {Divider} from '@astryxdesign/core/Divider';
import {Grid} from '@astryxdesign/core/Grid';
import {Layout, LayoutContent, LayoutPanel} from '@astryxdesign/core/Layout';
import {Link} from '@astryxdesign/core/Link';
import {List, ListItem} from '@astryxdesign/core/List';
import {Outline} from '@astryxdesign/core/Outline';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {pixel, proportional, Table} from '@astryxdesign/core/Table';
import {Heading, Text} from '@astryxdesign/core/Text';
import {VARIABLES} from '../data/variables';
import {VERDICT_ORDER, VERDICT_TEXT} from '../lib/evidence';
import {useMediaQuery} from '../lib/hooks';
import {VERDICT_COLORS} from '../viz/color';
import {Glossary} from '../features/Glossary';

/** summary: the section in one plain sentence; sources: indices into REFS. */
type Block = {id: string; title: string; summary: string; body: string[]; formula?: string; sources?: number[]};

const BLOCKS: Block[] = [
  {
    id: 'data',
    title: 'Data and footprint',
    summary: 'Every number starts from NASA POWER’s MERRA-2 grid, weighted by each cell’s true land area.',
    sources: [7],
    body: [
      'Monthly values come from the NASA POWER regional API, which serves the MERRA-2 reanalysis on its native 0.5° latitude × 0.625° longitude grid. The pipeline tiles each nation’s bounding box into requests of at most 10° × 10°, keeps every cell that overlaps the Natural Earth 1:50m boundary, and records the share of each cell that is land (a 9 × 9 lattice of test points) and its true area on the sphere.',
      'National and regional series are area-weighted by land area, so a coastal cell that is mostly sea counts for little. Cells are drawn clipped to the coastline.',
    ],
    formula: 'A_cell = R² · Δλ · |sin(φ + Δφ/2) − sin(φ − Δφ/2)| · land_fraction',
  },
  {
    id: 'anomalies',
    title: 'Anomalies',
    summary: 'Values are measured against each cell’s own 1991–2020 normal.',
    body: [
      'For each cell and calendar month, the 1991–2020 mean (the current WMO standard normal) is subtracted. A year’s anomaly is the mean of its monthly anomalies when at least 10 months are present. Precipitation is then expressed as a percentage of the cell’s own normal; hyper-arid cells (under 0.1 mm/day) are left out because a percentage of almost nothing is not meaningful.',
      'For a trend in annual means, removing the seasonal cycle changes the baseline, not the slope. It matters for the month-by-month analysis and for comparing places with different climates.',
    ],
  },
  {
    id: 'theil-sen',
    title: 'Trend size: Theil–Sen',
    summary: 'The trend is the median slope between every pair of years, so one extreme year cannot drag it.',
    sources: [2, 1],
    body: [
      'The slope is the median of the slopes between every pair of years. It is insensitive to a few extreme years. Its 95% interval follows Gilbert (1987), using the rank-order statistics of the pairwise slopes and the corrected Mann–Kendall variance below.',
    ],
    formula: 'β = median, over all pairs i < j, of (x_j − x_i) / (t_j − t_i)\nC = 1.96 √Var*(S);  lower = slope[(N − C)/2],  upper = slope[(N + C)/2 + 1]',
  },
  {
    id: 'mann-kendall',
    title: 'Significance: Mann–Kendall with Hamed–Rao correction',
    summary: 'A rank-based test asks whether later years tend to be higher or lower, corrected for runs of similar years.',
    sources: [0, 3],
    body: [
      'Mann–Kendall asks whether later years tend to be higher (or lower) than earlier ones, without assuming a straight line or normal errors. Climate series are persistent: a dry year makes the next one likelier to be dry. That shrinks the effective sample size, and the classic test then finds trends too often. TRACE inflates the variance of S by the Hamed–Rao factor, computed from the autocorrelation of the ranks of the detrended series at significant lags. The factor is never allowed below 1, so the correction can only make the test more cautious. The engine matches the pymannkendall reference implementation to five decimal places.',
    ],
    formula: 'S = sum over all pairs i < j of sign(x_j − x_i)\nVar*(S) = Var(S) · [1 + 2/(n(n−1)(n−2)) Σ_k (n−k)(n−k−1)(n−k−2) ρ_k],  floored at Var(S)',
  },
  {
    id: 'fdr',
    title: 'Field significance: false-discovery control',
    summary: 'Across a whole map, a 10% target false discovery rate decides which cells are stippled.',
    sources: [4, 5],
    body: [
      'When thousands of cells are tested at once, some will pass by luck. TRACE uses the Benjamini–Hochberg procedure with a 10% target false discovery rate to decide which cells to stipple. On a World map the cells tested together are every land cell; on a national map they are the nation’s cells for the chosen window. The 10% is the share of false alarms to expect among stippled cells over many repeated analyses, if the procedure’s assumptions hold. It is not a promise that this particular map has no more than 10% false alarms, nor the chance of any false alarm at all. Neighbouring cells are correlated, which can weaken that control, so the share of significant area describes the map rather than counting independent results. Wilks (2016) discusses this for climate maps.',
    ],
    formula: 'p_(1) ≤ … ≤ p_(m);  k* = max{k : p_(k) ≤ (k/m) · α_FDR};  significant ⇔ p ≤ p_(k*)',
  },
  {
    id: 'emergence',
    title: 'Emergence and time to significance',
    summary: 'Signal-to-noise shows how far a trend stands above year-to-year swings, and how many more years it would need to become significant.',
    sources: [6],
    body: [
      'Signal-to-noise compares the change across the window with the typical year-to-year swing (residual standard deviation around the trend), following Hawkins & Sutton (2012). For trends that are not yet significant, TRACE estimates how many more years at the same rate and noise it would take, from the standard error of a regression slope.',
    ],
    formula: 'S/N = β · (t_end − t_start) / σ_resid\nN(N² − 1) ≥ 12 · (1.96 σ / β)² · (n/n*)',
  },
  {
    id: 'integrity',
    title: 'Integrity screen: ramp or jump?',
    summary: 'A straight line is compared with a single step, to catch records that jump rather than drift.',
    body: [
      'A trend test assumes the data were produced the same way throughout. A reanalysis assimilates whatever satellites and stations exist each year, so its record can jump when they change. TRACE fits a straight line and a single step at the best break (each segment at least 8 years) and compares them with the Bayesian Information Criterion. A record is “step-dominated” when the step wins by more than 6 and no trend remains once it is removed. TRACE also flags years in which three or more of a nation’s seven variables jump together.',
      'A step is not proof of an artefact; regime shifts are real. The verdict depends on the witness.',
    ],
    formula: 'BIC = n ln(RSS/n) + k ln n,   k_trend = 3, k_step = 4;   step-dominated ⇔ ΔBIC > 6 and p_residual ≥ 0.05',
  },
  {
    id: 'witnesses',
    title: 'Cross-examination',
    summary: 'Each trend is measured again in an independent NASA record on the same footprint.',
    sources: [9, 10, 8],
    body: [
      'Temperature is compared with GISTEMP v4 (250 km smoothing, land stations only); precipitation with GPCP v2.3 (gauges and satellites; originally developed at NASA Goddard, now distributed by NOAA). Witnesses are stored per grid box, so the atlas can cross-examine any selection, from the whole nation down to one cell. Each witness is sampled at the centre of every TRACE cell and averaged with TRACE’s own weights, so the footprint is identical. The verdict compares direction, significance and overlap of the two 95% intervals: corroborated, same direction with a different size, only one record significant, not supported, contradicted, or no detectable trend.',
      'The witnesses are coarser (2° and 2.5°) and are themselves estimates. GPCP and MERRA-2’s corrected precipitation both draw on rain gauges, so their agreement cannot exclude a shared error.',
    ],
  },
];

const REFS = [
  ['Mann (1945), Nonparametric tests against trend, Econometrica', 'https://doi.org/10.2307/1907187'],
  ['Gilbert (1987), Statistical Methods for Environmental Pollution Monitoring, Van Nostrand Reinhold (book)', ''],
  ['Sen (1968), Estimates of the regression coefficient based on Kendall’s tau, JASA', 'https://doi.org/10.1080/01621459.1968.10480934'],
  ['Hamed & Rao (1998), A modified Mann–Kendall trend test for autocorrelated data, Journal of Hydrology', 'https://doi.org/10.1016/S0022-1694(97)00125-X'],
  ['Benjamini & Hochberg (1995), Controlling the false discovery rate, JRSS B', 'https://doi.org/10.1111/j.2517-6161.1995.tb02031.x'],
  ['Wilks (2016), “The stippling shows statistically significant grid points”, BAMS', 'https://doi.org/10.1175/BAMS-D-15-00267.1'],
  ['Hawkins & Sutton (2012), Time of emergence of climate signals, GRL', 'https://doi.org/10.1029/2011GL050087'],
  ['Gelaro et al. (2017), MERRA-2, Journal of Climate', 'https://doi.org/10.1175/JCLI-D-16-0758.1'],
  ['Reichle et al. (2017), Land surface precipitation in MERRA-2, Journal of Climate', 'https://doi.org/10.1175/JCLI-D-16-0570.1'],
  ['Lenssen et al. (2019), GISTEMP uncertainty model, JGR Atmospheres', 'https://doi.org/10.1029/2018JD029522'],
  ['Adler et al. (2018), The Global Precipitation Climatology Project v2.3, Atmosphere', 'https://doi.org/10.3390/atmos9040138'],
];

/** The settings every verdict shares, shown before the detail. */
const SETTINGS: [label: string, value: string][] = [
  ['Observation window', '1981–2024'],
  ['Baseline normal', '1991–2020'],
  ['Trend significance', 'p below 0.05'],
  ['Map-wide FDR target', '10%'],
];

/** The four questions behind every verdict, each linked to its technical section. */
const STEPS: {term: string; text: string; section: string}[] = [
  {term: 'Trend', text: 'The typical change per decade, measured so one extreme year cannot drag it. The 95% range is where the true trend probably lies; if it excludes zero, the direction is clear.', section: 'theil-sen'},
  {term: 'Significance', text: 'A trend this strong would rarely appear by chance in a record with no real trend (p below 0.05), even allowing for warm or dry years that cluster.', section: 'mann-kendall'},
  {term: 'Integrity screen', text: 'Does the record drift steadily, or drop all at once? A sudden jump that the witness does not share usually means the data changed, not the climate.', section: 'integrity'},
  {term: 'Witness', text: 'A second NASA record built differently (weather stations for temperature, gauges and satellites for rainfall). If it agrees, the trend is corroborated; if it points the other way, the first record is suspect.', section: 'witnesses'},
];

const EXTRA_VERDICTS: {label: string; plain: string; color: string}[] = [
  {label: 'Likely data artefact', plain: 'The witness contradicts the trend, or the record jumps in one year while the witness does not share or corroborate the jump. This is a screening flag, not a finding about which data source caused the disagreement. On the maps it shares the red of Contradicted.', color: VERDICT_COLORS[3]},
  {label: 'Single dataset, or no verdict at this scale', plain: 'No witness exists for this variable, or the witness grid is too coarse to tell the places apart. The trend may be real, but it has not been cross-examined. On the maps it shares the colour of No detectable trend.', color: VERDICT_COLORS[5]},
];

const number = (i: number) => String(i + 1).padStart(2, '0');
const sectionNumber = (id: string) => number(BLOCKS.findIndex(b => b.id === id));

/** Short sidebar names where a full section title would be cut off. */
const NAV_LABELS: Record<string, string> = {emergence: 'Emergence', witnesses: 'Cross-examination'};

const OUTLINE = [
  {id: 'method-steps', label: 'How a verdict is reached', level: 2},
  {id: 'method-verdicts', label: 'What the verdicts mean', level: 2},
  {id: 'method-calculations', label: 'The calculations', level: 2},
  ...BLOCKS.map((b, i) => ({id: `method-${b.id}`, label: `${number(i)}  ${NAV_LABELS[b.id] ?? b.title.split(':')[0]}`, level: 3})),
  {id: 'method-variables', label: 'Variables', level: 2},
  {id: 'method-limits', label: 'What TRACE does not claim', level: 2},
  {id: 'method-references', label: 'References', level: 2},
];

function Swatch({color}: {color: string}) {
  return (
    <svg width="14" height="14" aria-hidden="true">
      <rect width="14" height="14" rx="3" fill={color} />
    </svg>
  );
}

function Sources({indices}: {indices: number[]}) {
  return (
    <Text type="supporting">
      Sources:{' '}
      {indices.map((r, k) => {
        const [label, url] = REFS[r];
        const short = label.split(',')[0];
        return (
          <Text key={r} type="supporting">
            {k ? '; ' : ''}
            {url ? <Link href={url}>{short}</Link> : short}
          </Text>
        );
      })}
    </Text>
  );
}

function Article({narrow}: {narrow: boolean}) {
  return (
    <Center axis="horizontal" maxWidth={920}>
      <VStack gap={10} width="100%">
        <VStack gap={4}>
          <Text type="label" color="accent">
            Method
          </Text>
          <Heading level={1} type={narrow ? 'display-3' : 'display-2'}>
            How TRACE decides whether a trend is real
          </Heading>
          <Text type="large">
            Every verdict rests on four checks: the size of the trend, its significance, an integrity screen for sudden jumps, and an independent witness. All statistics run in one TypeScript module that both the offline pipeline and your browser use, so the shipped figures and the ones you recompute agree. It is open source and unit-tested against a reference implementation.
          </Text>
          <Grid columns={{minWidth: 150, max: 4}} gap={3}>
            {SETTINGS.map(([label, value]) => (
              <Card key={label} variant="muted" padding={4}>
                <VStack gap={1}>
                  <Text type="supporting">{label}</Text>
                  <Text type="large" weight="semibold" hasTabularNumbers>
                    {value}
                  </Text>
                </VStack>
              </Card>
            ))}
          </Grid>
        </VStack>

        <VStack gap={4}>
          <Heading level={2} id="method-steps">
            How a verdict is reached
          </Heading>
          <Grid columns={{minWidth: 300, max: 2}} gap={4}>
            {STEPS.map((step, i) => (
              <Card key={step.term} padding={5}>
                <VStack gap={2}>
                  <HStack gap={2} vAlign="center">
                    <Text type="code" color="accent">
                      {number(i)}
                    </Text>
                    <Heading level={3}>{step.term}</Heading>
                  </HStack>
                  <Text>{step.text}</Text>
                  <Link href={`#/method?s=${step.section}`}>
                    Section {sectionNumber(step.section)}: {BLOCKS.find(b => b.id === step.section)!.title}
                  </Link>
                </VStack>
              </Card>
            ))}
          </Grid>
          <Card variant="muted" padding={5}>
            <VStack gap={2}>
              <Text type="label" color="accent">
                Worked example
              </Text>
              <Text>
                Bangladesh’s reanalysis shows a significant cooling, but the record steps down by 0.74 °C from 1997 onward and weather stations show warming of +0.35 °C per decade. Verdict: a likely data artefact.
              </Text>
              <HStack gap={2}>
                <Button size="sm" variant="secondary" label="Open case 03" href="#/case/bangladesh-phantom-cooling" />
              </HStack>
            </VStack>
          </Card>
        </VStack>

        <VStack gap={3}>
          <Heading level={2} id="method-verdicts">
            What the verdicts mean
          </Heading>
          <Text color="secondary">Each trend is compared with a second, independently built record (the witness). These are the outcomes, and the colour each one takes on the maps.</Text>
          <List hasDividers edge="flush">
            {VERDICT_ORDER.map((v, i) => (
              <ListItem key={v} align="first-line" startContent={<Swatch color={VERDICT_COLORS[i]} />} label={<Text weight="semibold">{VERDICT_TEXT[v].label}</Text>} description={<Text type="supporting">{VERDICT_TEXT[v].plain}</Text>} />
            ))}
            {EXTRA_VERDICTS.map(v => (
              <ListItem key={v.label} align="first-line" startContent={<Swatch color={v.color} />} label={<Text weight="semibold">{v.label}</Text>} description={<Text type="supporting">{v.plain}</Text>} />
            ))}
          </List>
        </VStack>

        <VStack gap={6}>
          <VStack gap={2}>
            <Heading level={2} id="method-calculations">
              The calculations
            </Heading>
            <Text color="secondary">Each step in order, with its formula and the papers it follows.</Text>
          </VStack>
          {BLOCKS.map((b, i) => (
            <VStack key={b.id} gap={3}>
              <Divider />
              <HStack gap={3} vAlign="center">
                <Text type="code" color="accent">
                  {number(i)}
                </Text>
                <Heading level={3} id={`method-${b.id}`}>
                  {b.title}
                </Heading>
              </HStack>
              <Text type="large" weight="semibold">
                {b.summary}
              </Text>
              {b.body.map(paragraph => (
                <Text key={paragraph.slice(0, 30)}>{paragraph}</Text>
              ))}
              {b.formula && <CodeBlock code={b.formula} language="plaintext" title="Formula" width="100%" isWrapped />}
              {b.sources && <Sources indices={b.sources} />}
            </VStack>
          ))}
        </VStack>

        <VStack gap={3}>
          <Heading level={2} id="method-variables">
            Variables
          </Heading>
          <Text color="secondary">Seven variables ship for the featured nations; the global atlas covers temperature and rainfall.</Text>
          {narrow ? (
            <List hasDividers edge="flush">
              {VARIABLES.map(v => (
                <ListItem
                  key={v.id}
                  label={
                    <Text weight="semibold">
                      {v.label} <Text type="code">{v.id}</Text>
                    </Text>
                  }
                  description={<Text type="supporting">{v.description}</Text>}
                />
              ))}
            </List>
          ) : (
          <Card padding={0}>
          <Table
            data={VARIABLES.map(v => ({id: v.id, label: v.label, description: v.description}))}
            idKey="id"
            verticalAlign="top"
            columns={[
              {key: 'label', header: 'Variable', width: proportional(1, {minWidth: 140}), renderCell: row => <Text weight="semibold">{row.label}</Text>},
              {key: 'id', header: 'NASA POWER code', width: pixel(160), renderCell: row => <Text type="code">{row.id}</Text>},
              {key: 'description', header: 'What it measures', width: proportional(2, {minWidth: 180})},
            ]}
          />
          </Card>
          )}
        </VStack>

        <Card variant="muted" padding={6}>
          <VStack gap={2}>
            <Heading level={2} id="method-limits">
              What TRACE does not claim
            </Heading>
            <Text>
              A detected trend says what changed, where and by how much. It does not say why. TRACE does not attribute causes, forecast, or downscale below the reanalysis grid; a 0.5° cell averages over valleys and peaks. Trends near the poleward edge of MERRA-2’s precipitation correction (beyond about 42°) rest more on the model. Treat each result as a screen: it shows which places and datasets deserve a closer look.
            </Text>
          </VStack>
        </Card>

        <VStack gap={3}>
          <Heading level={2} id="method-references">
            References
          </Heading>
          <List listStyle="decimal" density="compact" edge="flush">
            {REFS.map(([label, url]) => (
              <ListItem key={label} label={url ? <Link href={url}>{label}</Link> : <Text>{label}</Text>} />
            ))}
          </List>
        </VStack>
        <Glossary />
      </VStack>
    </Center>
  );
}

export function Method({section}: {section?: string | null}) {
  const narrow = useMediaQuery('(max-width: 1100px)');
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (section) document.getElementById(`method-${section}`)?.scrollIntoView({block: 'start'});
  }, [section]);
  if (narrow) {
    return (
      <Layout
        content={
          <LayoutContent padding={8} label="Method">
            <Article narrow />
          </LayoutContent>
        }
      />
    );
  }
  return (
    <Layout
      start={
        <LayoutPanel width={280} padding={5} hasDivider label="On this page" role="region">
          <VStack gap={3}>
            <Text type="label" color="secondary">
              On this page
            </Text>
            <Outline items={OUTLINE} density="compact" label="Method sections" scrollContainerRef={scroller} offset={96} />
          </VStack>
        </LayoutPanel>
      }
      content={
        <LayoutContent padding={8} label="Method" ref={scroller}>
          <Article narrow={false} />
        </LayoutContent>
      }
    />
  );
}
