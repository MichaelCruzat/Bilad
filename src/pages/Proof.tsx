import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {Divider} from '@astryxdesign/core/Divider';
import {Grid} from '@astryxdesign/core/Grid';
import {LayoutContent} from '@astryxdesign/core/Layout';
import {Link} from '@astryxdesign/core/Link';
import {MetadataList, MetadataListItem} from '@astryxdesign/core/MetadataList';
import {SegmentedControl, SegmentedControlItem} from '@astryxdesign/core/SegmentedControl';
import {Selector} from '@astryxdesign/core/Selector';
import {Spinner} from '@astryxdesign/core/Spinner';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {Heading, Text} from '@astryxdesign/core/Text';
import type {ReactNode} from 'react';
import {BASELINE, VARIABLES, getVariable} from '../data/variables';
import {trendUnit} from '../lib/analysis';
import {crossExamine, overallVerdict, PRODUCTS, VERDICT_TEXT, witnessSeries} from '../lib/evidence';
import {useCrosscheck, useIndex, useMediaQuery, useNation, useVariable} from '../lib/hooks';
import {analyzeSeries, mannKendallS, mkZ, pairwiseSlopes, stepScreen} from '../lib/stats';
import {num, percent, pPhrase, pValue, signed, thousands} from '../lib/format';
import {atlasHref} from '../app/router';
import {SeriesChart} from '../viz/SeriesChart';
import {GlobalProof} from './GlobalProof';

const FULL = {from: 1981, to: 2024};
const REPO = 'https://github.com/MichaelCruzat/TRACE';

/**
 * "How we know": one nation's record taken through every step that leads to
 * its verdict, with the numbers your browser computes at each step, then the
 * independent checks that back the method as a whole.
 */
export function Proof({params}: {params: URLSearchParams}) {
  return params.has('n') ? <NationalProof params={params} /> : <GlobalProof params={params} />;
}

/** Kept for existing links to the supplemental monthly national packs. */
function NationalProof({params}: {params: URLSearchParams}) {
  const index = useIndex();
  const narrow = useMediaQuery('(max-width: 900px)');
  const nations = index.status === 'ready' ? index.data.nations : [];
  const iso3 = nations.some(n => n.iso3 === params.get('n')) ? params.get('n')! : 'BGD';
  const variable = params.get('v') === 'PRECTOTCORR' ? 'PRECTOTCORR' : 'T2M';
  const go = (patch: Record<string, string>) => {
    const next = new URLSearchParams({n: iso3, v: variable, ...patch});
    window.history.replaceState(null, '', `#/proof?${next}`);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  };
  return (
    <LayoutContent padding={8}>
      <VStack gap={8}>
        <VStack gap={3} maxWidth="60rem">
          <Text type="label" color="accent">
            How we know
          </Text>
          <Heading level={1} type={narrow ? 'display-3' : 'display-2'}>
            How a trend earns its verdict, step by step
          </Heading>
          <Text type="large" color="secondary">
            Pick a nation. Your browser takes its record through seven checks and prints the calculations for that selection. The validation notes below explain the separate checks used to test the software.
          </Text>
        </VStack>
        <HStack gap={4} wrap="wrap" vAlign="center">
          {narrow ? (
            <Selector label="Nation" value={iso3} options={nations.map(n => ({value: n.iso3, label: n.name}))} onChange={v => v && go({n: v})} width="100%" />
          ) : (
            <SegmentedControl label="Nation" value={iso3} onChange={v => go({n: v})}>
              {nations.map(n => (
                <SegmentedControlItem key={n.iso3} value={n.iso3} label={n.name} />
              ))}
            </SegmentedControl>
          )}
          <SegmentedControl label="Variable" value={variable} onChange={v => go({v})}>
            <SegmentedControlItem value="T2M" label="Temperature" />
            <SegmentedControlItem value="PRECTOTCORR" label="Rainfall" />
          </SegmentedControl>
        </HStack>
        {index.status === 'error' ? (
          <Banner status="error" title="Could not load the nation list" description={index.error.message} endContent={<Button label="Retry" onClick={index.retry} />} />
        ) : index.status === 'ready' ? (
          <Walkthrough key={`${iso3}-${variable}`} iso3={iso3} variable={variable} />
        ) : (
          <Text color="secondary">Loading the nation list…</Text>
        )}
        <WhyBelieve headlines={index.status === 'ready' ? nations.length * VARIABLES.length : null} />
      </VStack>
    </LayoutContent>
  );
}

function Walkthrough({iso3, variable}: {iso3: string; variable: string}) {
  const nation = useNation(iso3);
  const meta = nation.status === 'ready' ? nation.data.meta : null;
  const data = useVariable(meta, variable, FULL);
  const crosscheck = useCrosscheck();
  const failed = [nation, data, crosscheck].find(s => s.status === 'error');
  if (failed?.status === 'error') {
    return <Banner status="error" title="Could not load the walkthrough" description={failed.error.message} endContent={<Button label="Retry" onClick={failed.retry} />} />;
  }
  if (!meta || data.status !== 'ready' || crosscheck.status !== 'ready') {
    return (
      <HStack gap={2} vAlign="center">
        <Spinner size="sm" />
        <Text color="secondary">Loading the record and running the tests…</Text>
      </HStack>
    );
  }
  const def = getVariable(variable);
  const unit = trendUnit(variable);
  const digits = unit === '% of normal' ? 1 : def.digits;
  const chartUnit = unit === '% of normal' ? '%' : def.unit;
  const a = data.data.analysis;
  const years = a.years;
  const series = a.national.series;
  const result = analyzeSeries(years, series);
  const t = result.trend;
  const slopes = pairwiseSlopes(years, series);
  const {s, varS} = mannKendallS(series);
  const zClassic = mkZ(s, varS).z;
  const zCorrected = mkZ(s, varS * t.inflation).z;
  const step = stepScreen(years, series);
  const witness = witnessSeries(crosscheck.data, iso3, variable, FULL);
  const exam = witness ? crossExamine(years, series, witness) : null;
  const product = PRODUCTS[variable];
  const verdict = exam ? overallVerdict(t.p, {kind: 'available', exam}, Boolean(exam.claimStep?.stepDominated)) : null;
  const requests = meta.provenance.requests.filter(r => r.variable === variable).length;
  const area = meta.cells.reduce((sum, c) => sum + c.areaKm2, 0);
  const sig = t.p < 0.05;
  let increasing = 0;
  let decreasing = 0;
  for (let i = 0; i < series.length - 1; i++)
    for (let j = i + 1; j < series.length; j++) {
      if (series[j] > series[i]) increasing++;
      else if (series[j] < series[i]) decreasing++;
    }

  return (
    <VStack gap={6}>
      <Step n={1} title="Gather the record" asks="What did NASA’s reanalysis record here, month by month?">
        <Text>
          {meta.name} is covered by {thousands(meta.cells.length)} grid cells of 0.5° × 0.625°, {thousands(area)} km² of land in all. For each cell TRACE downloaded {def.label.toLowerCase()} for every month from January 1981 to December 2024 ({(FULL.to - FULL.from + 1) * 12} months), in {requests} requests to the NASA POWER service. Cells on the border count only for the share of their area that is land inside {meta.name}.
        </Text>
        <MetadataList orientation="horizontal">
          <MetadataListItem label="Source">{meta.provenance.api}</MetadataListItem>
          <MetadataListItem label="Retrieved">{meta.provenance.retrieved}</MetadataListItem>
          <MetadataListItem label="Monthly values used">{thousands(meta.cells.length * (FULL.to - FULL.from + 1) * 12)}</MetadataListItem>
        </MetadataList>
      </Step>

      <Step n={2} title="Take out the seasons" asks="Is a year warmer (or wetter) than usual, rather than just summer?">
        <Text>
          Each month is compared with the same calendar month’s {BASELINE[0]}–{BASELINE[1]} average. At least ten monthly departures are required for an annual value. Cells are averaged by land area into one national series of {years.length} values{def.relative ? '; the national rainfall anomaly is divided by the area-weighted national normal and expressed as a percentage' : ''}. Removing the seasonal cycle sets a common reference; it does not by itself establish a trend.
        </Text>
        <SeriesChart years={years} series={series} analysis={result} variable={variable} unit={chartUnit} witness={null} step={null} height={300} title={`${meta.name}: annual departure from the ${BASELINE[0]}–${BASELINE[1]} normal, ${chartUnit}`} />
        <Text type="supporting">
          First year {years[0]}: {signed(series[0], digits)} {chartUnit}. Last year {years[years.length - 1]}: {signed(series[series.length - 1], digits)} {chartUnit}.
        </Text>
      </Step>

      <Step n={3} title="Measure the trend" asks="How fast is it changing, without letting one extreme year decide?">
        <Text>
          TRACE draws a line between every pair of years: {years.length} years make {thousands(slopes.length)} pairs. Each pair gives a slope. The trend is the middle (median) of all {thousands(slopes.length)} slopes, so one freak year moves it very little. This is the Theil–Sen estimate.
        </Text>
        <MetadataList orientation="horizontal">
          <MetadataListItem label="Steepest falling pair">{`${signed(slopes[0] * 10, digits)} ${unit} per decade`}</MetadataListItem>
          <MetadataListItem label="Steepest rising pair">{`${signed(slopes[slopes.length - 1] * 10, digits)} ${unit} per decade`}</MetadataListItem>
          <MetadataListItem label="Median: the trend">
            <Text weight="bold">{`${signed(t.slope * 10, digits)} ${unit} per decade`}</Text>
          </MetadataListItem>
          <MetadataListItem label="95% range">{`${signed(t.slopeLow * 10, digits)} to ${signed(t.slopeHigh * 10, digits)}`}</MetadataListItem>
        </MetadataList>
        <Text type="supporting">The 95% range comes from counting off a set number of slopes either side of the median (Gilbert’s method), using the corrected variance from step 4.</Text>
      </Step>

      <Step n={4} title="Test it against chance" asks="Could a record with no real trend produce this by luck?">
        <Text>
          The Mann–Kendall test counts the pairs of years where the later year is higher ({thousands(increasing)}) and lower ({thousands(decreasing)}). The difference, S = {num(s, 0)}, is what a trend looks like. Without a trend S would scatter around zero with a known spread; how far S sits from zero gives the p-value. Warm or dry years tend to come in runs, which makes a lucky S more likely, so TRACE widens the spread by a correction factor measured from the record itself (Hamed and Rao).
        </Text>
        <MetadataList orientation="horizontal">
          <MetadataListItem label="S">{num(s, 0)}</MetadataListItem>
          <MetadataListItem label="Spread without a trend, √Var(S)">{num(Math.sqrt(varS), 1)}</MetadataListItem>
          <MetadataListItem label="Classic test">{`z = ${num(zClassic, 2)}, ${pPhrase(t.pRaw)}`}</MetadataListItem>
          <MetadataListItem label="Runs correction">{`spread × √${num(t.inflation, 2)}`}</MetadataListItem>
          <MetadataListItem label="Corrected test">
            <Text weight="bold">{`z = ${num(zCorrected, 2)}, ${pPhrase(t.p)}`}</Text>
          </MetadataListItem>
        </MetadataList>
        <Rule pass={sig}>
          {sig
            ? `Significant: p is below 0.05, so a trend this strong would come up by chance in fewer than 1 in 20 trendless records.`
            : `Not significant: p is ${pValue(t.p)}, at or above 0.05. This test does not detect a trend at the selected threshold.`}
        </Rule>
      </Step>

      <Step n={5} title="Check the map as a whole" asks="With many cells tested, how many pass by luck alone?">
        <Text>
          If all {a.counts.tested} cells had no trend and the individual tests were calibrated, about {Math.round(a.counts.tested * 0.05)} would pass a 5% test on average. TRACE applies Benjamini–Hochberg to the cells in this nation at a target false discovery rate of 10%. This controls an expected fraction across repeated analyses under the procedure’s assumptions; it does not cap the false alarms in this particular map. Neighbouring cells are dependent, so the target is not an unconditional guarantee. Here {a.pStar > 0 ? `the selected threshold is p ≤ ${pValue(a.pStar)}` : 'no cells meet the selection rule'}. The target differs from the 5% threshold for a single series, so marked cells can outnumber those passing individually.
        </Text>
        <MetadataList orientation="horizontal">
          <MetadataListItem label="Cells tested">{String(a.counts.tested)}</MetadataListItem>
          <MetadataListItem label="Pass one by one (p < 0.05)">{String(a.counts.naive)}</MetadataListItem>
          <MetadataListItem label="Significant at a 10% false discovery rate">
            <Text weight="bold">{String(a.counts.fdr)}</Text>
          </MetadataListItem>
          <MetadataListItem label="Land significantly up / down">{`${percent(a.areaUp)} / ${percent(a.areaDown)}`}</MetadataListItem>
        </MetadataList>
      </Step>

      <Step n={6} title="Screen for a jump" asks="Did the record drift, or shift all at once?">
        {step ? (
          <>
            <Text>
              A reanalysis can jump when new satellites join the data it is fed. TRACE fits two models to the {years.length} values: a steady ramp, and two flat levels with a single jump between them. It scores both with the Bayesian Information Criterion (BIC), which rewards fit and penalises the extra parameter. The best jump is in {step.breakAt}, of {signed(step.step, digits)} {chartUnit}.
            </Text>
            <MetadataList orientation="horizontal">
              <MetadataListItem label="Score, ramp">{num(step.bicTrend, 1)}</MetadataListItem>
              <MetadataListItem label="Score, jump">{num(step.bicStep, 1)}</MetadataListItem>
              <MetadataListItem label="Difference (above 6 favours the jump)">
                <Text weight="bold">{num(step.deltaBic, 1)}</Text>
              </MetadataListItem>
              <MetadataListItem label="Trend left once the jump is removed">{pPhrase(step.residualTrendP)}</MetadataListItem>
            </MetadataList>
            <Rule pass={!step.stepDominated}>
              {step.stepDominated
                ? `Jump-shaped: the step fits better than a ramp, and the residual trend is not significant. This heuristic warning does not establish that no trend remains or identify its cause.`
                : `No sudden jump flagged: the record does not meet both tests, though that alone does not prove a steady ramp.`}
            </Rule>
          </>
        ) : (
          <Text>The record is too short to screen.</Text>
        )}
      </Step>

      <Step n={7} title="Call the witness" asks="Does a second, independently built record show the same change?">
        {exam && verdict ? (
          <>
            <Text>
              {product.long} is sampled at the centres of the same cells and weighted the same way, then taken through steps 2 to 4. Its coarser grid cannot resolve differences within one witness box. {variable === 'T2M' ? 'It is built from weather-station thermometers rather than the reanalysis.' : 'It combines rain gauges and satellites; MERRA-2 also leans on gauges, so it is only partly independent.'}
            </Text>
            <Grid columns={{minWidth: 260, max: 2}} gap={5}>
              <Card variant="muted" padding={4}>
                <VStack gap={1}>
                  <Text type="supporting">Reanalysis (MERRA-2)</Text>
                  <Text type="display-3" hasTabularNumbers>
                    {signed(exam.claim.slope * 10, digits)}
                  </Text>
                  <Text type="supporting">{`${unit} per decade, range ${signed(exam.claim.slopeLow * 10, digits)} to ${signed(exam.claim.slopeHigh * 10, digits)}, ${pPhrase(exam.claim.p)}`}</Text>
                </VStack>
              </Card>
              <Card variant="muted" padding={4}>
                <VStack gap={1}>
                  <Text type="supporting">{product.name}</Text>
                  <Text type="display-3" hasTabularNumbers>
                    {signed(exam.witness.slope * 10, digits)}
                  </Text>
                  <Text type="supporting">{`${unit} per decade, range ${signed(exam.witness.slopeLow * 10, digits)} to ${signed(exam.witness.slopeHigh * 10, digits)}, ${pPhrase(exam.witness.p)}`}</Text>
                </VStack>
              </Card>
            </Grid>
            <Text>
              The rule: if both are significant, point the same way and their 95% ranges overlap, the trend is corroborated. If they point opposite ways and both are significant, it is contradicted. Here: {exam.claim.p < 0.05 ? 'the reanalysis is significant' : 'the reanalysis is not significant'}, {exam.witness.p < 0.05 ? 'the witness is significant' : 'the witness is not significant'}, they {Math.sign(exam.claim.slope) === Math.sign(exam.witness.slope) ? 'point the same way' : 'point opposite ways'}
              {Math.sign(exam.claim.slope) === Math.sign(exam.witness.slope) ? `, and their ranges ${exam.claim.slopeLow <= exam.witness.slopeHigh && exam.witness.slopeLow <= exam.claim.slopeHigh ? 'overlap' : 'do not overlap'}` : ''}: <Text weight="bold">{VERDICT_TEXT[exam.verdict].label.toLowerCase()}</Text>.
            </Text>
          </>
        ) : (
          <Text>No witness covers this record.</Text>
        )}
      </Step>

      {verdict && (
        <Card variant="muted" padding={6}>
          <VStack gap={3}>
            <Text type="label" color="accent">
              Verdict for {meta.name}
            </Text>
            <HStack gap={3} vAlign="center" wrap="wrap">
              <Heading level={2}>{verdict.label}</Heading>
              <Text weight="semibold">{sig ? 'Significant in the reanalysis' : 'Not significant in the reanalysis'}</Text>
            </HStack>
            <Text type="large">{verdict.sentence}</Text>
            <HStack gap={2} wrap="wrap">
              <Button variant="primary" label={`Explore ${meta.name} in the atlas`} href={atlasHref(iso3, {v: variable})} />
              <Button variant="secondary" label="National brief" href={`#/brief/${iso3}`} />
            </HStack>
          </VStack>
        </Card>
      )}
    </VStack>
  );
}

function Step({n, title, asks, children}: {n: number; title: string; asks: string; children: ReactNode}) {
  return (
    <VStack gap={3}>
      <Divider />
      <HStack gap={4} vAlign="start">
        <Text type="display-3" color="accent" hasTabularNumbers>
          {n}
        </Text>
        <VStack gap={3}>
          <VStack gap={1}>
            <Heading level={2}>{title}</Heading>
            <Text type="large" color="secondary">
              {asks}
            </Text>
          </VStack>
          {children}
        </VStack>
      </HStack>
    </VStack>
  );
}

function Rule({pass, children}: {pass: boolean; children: ReactNode}) {
  return (
    <HStack gap={2} vAlign="center" wrap="wrap">
      <Text weight="semibold">{pass ? 'Passes' : 'Flag'}</Text>
      <Text weight="semibold">{children}</Text>
    </HStack>
  );
}

/** Independent reasons to trust the method, each one checkable. */
function WhyBelieve({headlines}: {headlines: number | null}) {
  return (
    <VStack gap={5}>
      <Divider />
      <Text type="label" color="accent">
        Why believe these numbers
      </Text>
      <Heading level={2} type="display-3">
        Checked by separate code, against separate data
      </Heading>
      <Grid columns={{minWidth: 300, max: 2}} gap={6}>
        <Receipt title="Two implementations, one answer" link={{label: 'The validator', href: `${REPO}/blob/main/pipeline/validate.py`}}>
          A separate Python implementation recomputes {headlines ?? 'the featured nations’'} national headlines from the packed monthly data with NumPy, SciPy and pymannkendall. It compares the annual series, slope, corrected p-value and shares of significant land with the shipped summary. CI runs this check and fails on differences above the documented tolerances. This checks implementation agreement; it cannot establish that the source observations are correct.
        </Receipt>
        <Receipt title="A repeatable sample of global cells" link={{label: 'Global validation code', href: `${REPO}/blob/main/pipeline/validate.py`}}>
          When the cached global monthly data is present, the validator selects up to 400 cells per variable with a fixed random seed and independently recomputes slopes and corrected p-values. Cells with insufficient records or rainfall normals are skipped. This is a sample check, not a recomputation of every global statistic. A clean CI checkout lacks that cache and reports the global check as skipped.
        </Receipt>
        <Receipt title="Cases checked against shipped data" link={{label: 'Data and case tests', href: `${REPO}/blob/main/tests/data.test.ts`}}>
          Tests recompute the Chile, Bangladesh and Kenya cases from the same data the app loads. They check the direction of the trends, witness agreement and the Bangladesh jump flag. The walkthrough above exposes the current values, including outcomes that disagree with the reanalysis.
        </Receipt>
        <Receipt title="A significant record can still be suspect" link={{label: 'Read case 03', href: '#/case/bangladesh-phantom-cooling'}}>
          Bangladesh’s reanalysis cooling passes the trend test, but weather stations show warming and the integrity screen flags a jump. Those checks support a suspected dataset artefact. They do not identify which observation or processing change caused it.
        </Receipt>
        <Receipt title="A real drought holds up in both records" link={{label: 'Read case 01', href: '#/case/chile-megadrought'}}>
          The central Chile case compares the reanalysis with GPCP on the same footprint and links the result to published megadrought studies. Both records show less rainfall. Because they share some gauge inputs, their agreement is supporting evidence rather than fully independent confirmation.
        </Receipt>
        <Receipt title="Choices that lean cautious" link={{label: 'The tests', href: `${REPO}/tree/main/tests`}}>
          Two-sided tests; a correction for runs of similar years that can only widen the uncertainty, never narrow it; 95% ranges built from that widened spread; and a unit test that pins the engine to pymannkendall to five decimal places on an autocorrelated series.
        </Receipt>
      </Grid>
      <Card variant="muted" padding={5}>
        <VStack gap={2}>
          <Heading level={3}>What these checks cannot do</Heading>
          <Text color="secondary">
            A detected trend does not explain its cause or predict the future. The 10% false discovery rate is the share of false alarms to expect under the method’s assumptions, not a limit on this map’s errors. Neighbouring cells are correlated, so verdict shares describe the map rather than counting independent results. Agreement with GPCP cannot rule out a problem shared by the rain gauges. A jump can come from a real shift in climate or from a change in the dataset, so it needs further investigation and a second record.
          </Text>
        </VStack>
      </Card>
    </VStack>
  );
}

function Receipt({title, link, children}: {title: string; link: {label: string; href: string}; children: ReactNode}) {
  return (
    <VStack gap={2}>
      <Heading level={3}>{title}</Heading>
      <Text color="secondary">{children}</Text>
      <Link href={link.href}>{link.label}</Link>
    </VStack>
  );
}
