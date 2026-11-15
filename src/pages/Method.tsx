import {CodeBlock} from '@astryxdesign/core/CodeBlock';
import {VERDICT_ORDER, VERDICT_TEXT} from '../lib/evidence';
import {VERDICT_COLORS} from '../viz/color';
import {Divider} from '@astryxdesign/core/Divider';
import {Grid} from '@astryxdesign/core/Grid';
import {LayoutContent} from '@astryxdesign/core/Layout';
import {Link} from '@astryxdesign/core/Link';
import {VStack} from '@astryxdesign/core/Stack';
import {Heading, Text} from '@astryxdesign/core/Text';
import {useEffect} from 'react';
import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {HStack} from '@astryxdesign/core/Stack';
import {VARIABLES} from '../data/variables';

type Block = {id: string; title: string; body: string[]; formula?: string};

const BLOCKS: Block[] = [
  {
    id: 'data',
    title: 'Data and footprint',
    body: [
      'Monthly values come from the NASA POWER regional API, which serves the MERRA-2 reanalysis on its native 0.5° latitude × 0.625° longitude grid. The pipeline tiles each nation’s bounding box into requests of at most 10° × 10°, keeps every cell that overlaps the Natural Earth 1:50m boundary, and records the share of each cell that is land (a 9 × 9 lattice of test points) and its true area on the sphere.',
      'National and regional series are area-weighted by land area, so a coastal cell that is mostly sea counts for little. Cells are drawn clipped to the coastline.',
    ],
    formula: 'A_cell = R² · Δλ · |sin(φ + Δφ/2) − sin(φ − Δφ/2)| · land_fraction',
  },
  {
    id: 'anomalies',
    title: 'Anomalies',
    body: [
      'For each cell and calendar month, the 1991–2020 mean (the current WMO standard normal) is subtracted. A year’s anomaly is the mean of its monthly anomalies when at least 10 months are present. Precipitation is then expressed as a percentage of the cell’s own normal; hyper-arid cells (under 0.1 mm/day) are left out because a percentage of almost nothing is not meaningful.',
      'For a trend in annual means, removing the seasonal cycle changes the baseline, not the slope. It matters for the month-by-month analysis and for comparing places with different climates.',
    ],
  },
  {
    id: 'theil-sen',
    title: 'Trend size: Theil–Sen',
    body: [
      'The slope is the median of the slopes between every pair of years. It is insensitive to a few extreme years. Its 95% interval follows Gilbert (1987), using the rank-order statistics of the pairwise slopes and the corrected Mann–Kendall variance below.',
    ],
    formula: 'β = median, over all pairs i < j, of (x_j − x_i) / (t_j − t_i)\nC = 1.96 √Var*(S);  lower = slope[(N − C)/2],  upper = slope[(N + C)/2 + 1]',
  },
  {
    id: 'mann-kendall',
    title: 'Significance: Mann–Kendall with Hamed–Rao correction',
    body: [
      'Mann–Kendall asks whether later years tend to be higher (or lower) than earlier ones, without assuming a straight line or normal errors. Climate series are persistent: a dry year makes the next one likelier to be dry. That shrinks the effective sample size, and the classic test then finds trends too often. Bilad inflates the variance of S by the Hamed–Rao factor, computed from the autocorrelation of the ranks of the detrended series at significant lags. The factor is never allowed below 1, so the correction can only make the test more cautious. The engine matches the pymannkendall reference implementation to five decimal places.',
    ],
    formula: 'S = sum over all pairs i < j of sign(x_j − x_i)\nVar*(S) = Var(S) · [1 + 2/(n(n−1)(n−2)) Σ_k (n−k)(n−k−1)(n−k−2) ρ_k],  floored at Var(S)',
  },
  {
    id: 'fdr',
    title: 'Field significance: false-discovery control',
    body: [
      'Testing 54,425 cells at 5% would produce thousands of “significant” cells by chance alone. Bilad applies the Benjamini–Hochberg procedure across the map with a false discovery rate α_FDR = 0.10, which Wilks (2016) shows controls the field-wide error near the nominal 5% for spatially correlated climate fields. Only cells that survive are stippled. Neighbouring reanalysis cells are not independent, so shares of significant area are descriptive, not independent votes.',
    ],
    formula: 'p_(1) ≤ … ≤ p_(m);  k* = max{k : p_(k) ≤ (k/m) · α_FDR};  significant ⇔ p ≤ p_(k*)',
  },
  {
    id: 'emergence',
    title: 'Emergence and time to significance',
    body: [
      'Signal-to-noise compares the change across the window with the typical year-to-year swing (residual standard deviation around the trend), following Hawkins & Sutton (2012). For trends that are not yet significant, Bilad estimates how many more years at the same rate and noise it would take, from the standard error of a regression slope.',
    ],
    formula: 'S/N = β · (t_end − t_start) / σ_resid\nN(N² − 1) ≥ 12 · (1.96 σ / β)² · (n/n*)',
  },
  {
    id: 'integrity',
    title: 'Integrity screen: ramp or jump?',
    body: [
      'A trend test assumes the data were produced the same way throughout. A reanalysis assimilates whatever satellites and stations exist each year, so its record can jump when they change. Bilad fits a straight line and a single step at the best break (each segment at least 8 years) and compares them with the Bayesian Information Criterion. A record is “step-dominated” when the step wins by more than 6 and no trend remains once it is removed. Bilad also flags years in which three or more of a nation’s seven variables jump together.',
      'A step is not proof of an artefact; regime shifts are real. The verdict depends on the witness.',
    ],
    formula: 'BIC = n ln(RSS/n) + k ln n,   k_trend = 3, k_step = 4;   step-dominated ⇔ ΔBIC > 6 and p_residual ≥ 0.05',
  },
  {
    id: 'witnesses',
    title: 'Cross-examination',
    body: [
      'Temperature is compared with GISTEMP v4 (250 km smoothing, land stations only); precipitation with GPCP v2.3 (gauges and satellites; originally developed at NASA Goddard, now distributed by NOAA). Witnesses are stored per grid box, so the atlas can cross-examine any selection, from the whole nation down to one cell. Each witness is sampled at the centre of every Bilad cell and averaged with Bilad’s own weights, so the footprint is identical. The verdict compares direction, significance and overlap of the two 95% intervals: corroborated, same direction with a different size, only one record significant, not supported, contradicted, or no detectable trend.',
      'The witnesses are coarser (2° and 2.5°) and are themselves estimates. GPCP and MERRA-2’s corrected precipitation both draw on rain gauges, so their agreement rules out a reanalysis artefact but not a problem shared by the gauges.',
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

export function Method({section}: {section?: string | null}) {
  useEffect(() => {
    if (section) document.getElementById(`method-${section}`)?.scrollIntoView({block: 'start'});
  }, [section]);
  return (
    <LayoutContent padding={8}>
      <VStack gap={8}>
        <VStack gap={3}>
          <Text type="supporting" color="accent">
            METHOD
          </Text>
          <Heading level={1} type="display-2">
            How Bilad decides whether a trend is real
          </Heading>
          <Text type="large" color="secondary">
            All statistics run in one TypeScript module that both the offline pipeline and your browser use, so the shipped figures and the ones you recompute agree. It is open source and unit-tested against a reference implementation.
          </Text>
        </VStack>
        <Card variant="muted" padding={5}>
          <VStack gap={2}>
            <Heading level={2}>How to read a verdict</Heading>
            <Text>
              <Text weight="semibold">Trend</Text>: the typical change per decade, measured so one extreme year cannot drag it. The 95% range is where the true trend probably lies; if it excludes zero, the direction is clear.
            </Text>
            <Text>
              <Text weight="semibold">Significant</Text>: a trend this strong would rarely appear by chance in a record with no real trend (p below 0.05), even allowing for warm or dry years that cluster.
            </Text>
            <Text>
              <Text weight="semibold">Witness</Text>: a second NASA record built differently (weather stations for temperature, gauges and satellites for rainfall). If it agrees, the trend is corroborated; if it points the other way, the first record is suspect.
            </Text>
            <Text>
              <Text weight="semibold">Integrity screen</Text>: does the record drift steadily, or drop all at once? A sudden jump that the witness does not share usually means the data changed, not the climate.
            </Text>
            <Text color="secondary">
              Worked example: Bangladesh’s reanalysis shows a significant cooling, but the record drops 0.74 °C in a single year (1997) and weather stations show warming of +0.35 °C per decade. Verdict: a likely data artefact.
            </Text>
            <HStack gap={2}>
              <Button size="sm" variant="secondary" label="Open case 03" href="#/case/bangladesh-phantom-cooling" />
            </HStack>
          </VStack>
        </Card>
        <VStack gap={3}>
          <Heading level={2} id="method-verdicts">
            What the verdicts mean
          </Heading>
          <Text color="secondary">Each trend is compared with a second, independently built record (the witness). These are the outcomes, and the colour each one takes on the maps.</Text>
          <Grid columns={{minWidth: 300, max: 2}} gap={4}>
            {VERDICT_ORDER.map((v, i) => (
              <HStack key={v} gap={3} vAlign="start">
                <svg width="16" height="16" aria-hidden="true">
                  <rect width="16" height="16" rx="3" fill={VERDICT_COLORS[i]} />
                </svg>
                <VStack gap={0.5}>
                  <Text weight="semibold">{VERDICT_TEXT[v].label}</Text>
                  <Text type="supporting">{VERDICT_TEXT[v].plain}</Text>
                </VStack>
              </HStack>
            ))}
            <HStack gap={3} vAlign="start">
              <svg width="16" height="16" aria-hidden="true">
                <rect width="16" height="16" rx="3" fill={VERDICT_COLORS[3]} />
              </svg>
              <VStack gap={0.5}>
                <Text weight="semibold">Likely data artefact</Text>
                <Text type="supporting">The witness contradicts the trend, or the record jumps in one year while the witness does not. The change most likely comes from how the data were produced.</Text>
              </VStack>
            </HStack>
            <HStack gap={3} vAlign="start">
              <svg width="16" height="16" aria-hidden="true">
                <rect width="16" height="16" rx="3" fill={VERDICT_COLORS[5]} />
              </svg>
              <VStack gap={0.5}>
                <Text weight="semibold">Single dataset, or no verdict at this scale</Text>
                <Text type="supporting">No witness exists for this variable, or the witness grid is too coarse to tell the places apart. The trend may be real, but it has not been cross-examined.</Text>
              </VStack>
            </HStack>
          </Grid>
        </VStack>
        <VStack gap={1}>
          {BLOCKS.map((b, i) => (
            <HStack key={b.id} gap={3}>
              <Text type="code" color="accent">
                {String(i + 1).padStart(2, '0')}
              </Text>
              <Link href={`#/method?s=${b.id}`}>{b.title}</Link>
            </HStack>
          ))}
        </VStack>
        {BLOCKS.map((b, i) => (
          <VStack key={b.title} gap={3}>
            <Divider />
            <HStack gap={3} vAlign="center">
              <Text type="code" color="accent">
                {String(i + 1).padStart(2, '0')}
              </Text>
              <Heading level={2} id={`method-${b.id}`}>
                {b.title}
              </Heading>
            </HStack>
            {b.body.map(p => (
              <Text key={p.slice(0, 30)} color="secondary">
                {p}
              </Text>
            ))}
            {b.formula && <CodeBlock code={b.formula} language="plaintext" title="Formula" />}
          </VStack>
        ))}
        <VStack gap={3}>
          <Divider />
          <Heading level={2}>Variables</Heading>
          <Grid columns={{minWidth: 260, max: 2}} gap={5}>
            {VARIABLES.map(v => (
              <VStack key={v.id} gap={1}>
                <Text weight="semibold">
                  {v.label} <Text type="code">{v.id}</Text>
                </Text>
                <Text type="supporting">{v.description}</Text>
              </VStack>
            ))}
          </Grid>
        </VStack>
        <VStack gap={3}>
          <Divider />
          <Heading level={2}>What Bilad does not claim</Heading>
          <Text color="secondary">
            A detected trend says what changed, where and by how much. It does not say why. Bilad does not attribute causes, forecast, or downscale below the reanalysis grid; a 0.5° cell averages over valleys and peaks. Trends near the poleward edge of MERRA-2’s precipitation correction (beyond about 42°) rest more on the model. Treat each result as a screen: it shows which places and datasets deserve a closer look.
          </Text>
        </VStack>
        <VStack gap={2}>
          <Divider />
          <Heading level={2}>References</Heading>
          {REFS.map(([label, url]) =>
            url ? (
              <Link key={url} href={url}>
                {label}
              </Link>
            ) : (
              <Text key={label}>{label}</Text>
            ),
          )}
        </VStack>
      </VStack>
    </LayoutContent>
  );
}
