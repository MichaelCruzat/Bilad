import {useMemo} from 'react';
import {Badge} from '@astryxdesign/core/Badge';
import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {Divider} from '@astryxdesign/core/Divider';
import {Grid} from '@astryxdesign/core/Grid';
import {LayoutContent} from '@astryxdesign/core/Layout';
import {Link} from '@astryxdesign/core/Link';
import {MetadataList, MetadataListItem} from '@astryxdesign/core/MetadataList';
import {Spinner} from '@astryxdesign/core/Spinner';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {Heading, Text} from '@astryxdesign/core/Text';
import {CASES, getCase, type CaseDef} from '../data/cases';
import {getVariable} from '../data/variables';
import {cellsInBand, rowEdges, subsetAbsolute, subsetSeries, trendUnit, type VariableAnalysis} from '../lib/analysis';
import {coBreaks, crossExamine, VERDICT_TEXT, witnessSeries, type Crosscheck} from '../lib/evidence';
import {useCrosscheck, useIndex, useNation, useVariable, type NationBundle} from '../lib/hooks';
import type {DataIndex} from '../lib/nationData';
import {analyzeSeries, stepScreen, trendTest} from '../lib/stats';
import {describe} from '../lib/narrative';
import {digitsFor, num, percent, pValue, signed} from '../lib/format';
import {atlasHref} from '../app/router';
import {NationMap} from '../viz/NationMap';
import {SeriesChart} from '../viz/SeriesChart';

const FULL = {from: 1981, to: 2024};
const TONE: Record<string, 'success' | 'warning' | 'error' | 'neutral'> = {success: 'success', warning: 'warning', error: 'error', neutral: 'neutral'};

export function CaseFile({id}: {id: string}) {
  const def = getCase(id);
  const nation = useNation(def?.iso3 ?? 'CHL');
  const meta = nation.status === 'ready' ? nation.data.meta : null;
  const data = useVariable(meta, def?.variable ?? 'T2M', FULL);
  const crosscheck = useCrosscheck();
  const index = useIndex();

  if (!def) {
    return (
      <LayoutContent padding={8}>
        <Banner status="warning" title="No such case" description="Return to the casebook to pick a case." endContent={<Button label="Casebook" href="#/" />} />
      </LayoutContent>
    );
  }
  const ready = nation.status === 'ready' && data.status === 'ready' && crosscheck.status === 'ready' && index.status === 'ready';
  const failed = [nation, data, crosscheck, index].find(s => s.status === 'error');
  return (
    <LayoutContent padding={8}>
      <VStack gap={8}>
        <VStack gap={3}>
          <HStack gap={2} vAlign="center" wrap="wrap">
            <Button label="Casebook" variant="ghost" size="sm" href="#/" />
            <Text type="supporting" color="accent">
              CASE {def.number} · {def.iso3} · {getVariable(def.variable).label.toUpperCase()}
            </Text>
          </HStack>
          <Heading level={1} type="display-2">
            {def.title}
          </Heading>
          <Text type="large" color="secondary">
            {def.question}
          </Text>
        </VStack>
        {failed && failed.status === 'error' ? (
          <Banner status="error" title="Could not load the evidence" description={failed.error.message} endContent={<Button label="Retry" onClick={failed.retry} />} />
        ) : ready ? (
          <CaseBody def={def} bundle={nation.data} analysis={data.data.analysis} crosscheck={crosscheck.data} index={index.data} />
        ) : (
          <HStack gap={2} vAlign="center">
            <Spinner size="sm" />
            <Text color="secondary">Loading NASA data and running the tests…</Text>
          </HStack>
        )}
      </VStack>
    </LayoutContent>
  );
}

function CaseBody({def, bundle, analysis, crosscheck, index}: {def: CaseDef; bundle: NationBundle; analysis: VariableAnalysis; crosscheck: Crosscheck; index: DataIndex}) {
  const {meta, boundary} = bundle;
  const v = getVariable(def.variable);
  const unit = trendUnit(def.variable);
  const digits = digitsFor(unit, v.digits);
  const years = analysis.years;
  const chartUnit = unit === '% of normal' ? '%' : v.unit;

  const focus = useMemo(() => {
    if (def.focus.kind === 'region') {
      const r = meta.regions.find(x => x.id === (def.focus as {region: string}).region)!;
      const cells = cellsInBand(meta, r.latMin, r.latMax);
      return {name: r.name, cells, series: subsetSeries(meta, analysis, cells), region: r.id, compare: null as null | {cells: number[]; series: Float64Array}};
    }
    if (def.focus.kind === 'contrast') {
      const {west, east} = rowEdges(meta, def.focus.latMin, def.focus.latMax);
      return {
        name: def.focus.labels[1],
        cells: [...west, ...east],
        series: subsetSeries(meta, analysis, east),
        region: undefined,
        compare: {cells: west, series: subsetSeries(meta, analysis, west)},
      };
    }
    return {name: meta.name, cells: null, series: analysis.national.series, region: undefined, compare: null};
  }, [def, meta, analysis]);

  const result = analyzeSeries(years, focus.series);
  const finding = describe(def.variable, unit, result, years, focus.series);
  const witness = def.focus.kind === 'contrast' ? null : witnessSeries(crosscheck, meta.iso3, def.variable, FULL, focus.region);
  const exam = witness ? crossExamine(years, focus.series, witness) : null;
  const step = exam?.claimStep ?? stepScreen(years, focus.series);
  const product = crosscheck.products[def.variable];
  const breaks = coBreaks(index, meta.iso3);
  const emphasis = focus.cells ? new Set(focus.cells) : null;
  const compareTest = focus.compare ? trendTest(years, focus.compare.series) : null;

  // Key fact for regional rainfall: absolute deficit of 2010–2019 against 1981–2009.
  const deficit = useMemo(() => {
    if (def.focus.kind !== 'region' || !focus.cells) return null;
    const abs = subsetAbsolute(meta, analysis, focus.cells);
    const mean = (a: number, b: number) => {
      const vals = years.flatMap((yr, i) => (yr >= a && yr <= b ? [abs[i]] : []));
      return vals.reduce((s, x) => s + x, 0) / vals.length;
    };
    const before = mean(1981, 2009);
    const after = mean(2010, 2019);
    let witnessDeficit: number | null = null;
    if (witness) {
      const wb = years.flatMap((yr, i) => (yr <= 2009 ? [witness[i]] : []));
      const wa = years.flatMap((yr, i) => (yr >= 2010 && yr <= 2019 ? [witness[i]] : []));
      const m = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
      witnessDeficit = 1 - (100 + m(wa)) / (100 + m(wb));
    }
    return {before, after, share: 1 - after / before, witnessDeficit};
  }, [def, focus, meta, analysis, years, witness]);

  const verdict = exam ? VERDICT_TEXT[exam.verdict] : null;

  return (
    <VStack gap={8}>
      <Grid columns={{minWidth: 320, max: 2}} gap={8}>
        <VStack gap={3}>
          <Text type="supporting" color="accent">
            THE CLAIM
          </Text>
          {def.context.map(p => (
            <Text key={p.slice(0, 24)}>{p}</Text>
          ))}
          {deficit && (
            <Text type="large">
              In MERRA-2, {focus.name} averaged {num(deficit.before, 0)} mm a year in 1981–2009 and {num(deficit.after, 0)} mm in 2010–2019: <Text weight="bold">{percent(deficit.share)} less rain</Text>
              {deficit.witnessDeficit !== null ? `. GPCP, on the same cells, shows ${percent(deficit.witnessDeficit)} less.` : '.'}
            </Text>
          )}
          {compareTest && (
            <Text type="large">
              Daytime highs in the {def.focus.kind === 'contrast' ? def.focus.labels[1].split(' (')[0].toLowerCase() : ''} changed by <Text weight="bold">{signed(result.trend.slope * 10, digits)} °C per decade</Text> (p {pValue(result.trend.p)}); at the coast, on the same rows, by{' '}
              <Text weight="bold">{signed(compareTest.slope * 10, digits)} °C</Text> (p {pValue(compareTest.p)}).
            </Text>
          )}
        </VStack>
        <VStack gap={2} height="30rem">
          <NationMap
            meta={meta}
            boundary={boundary}
            analysis={analysis}
            layer="change"
            emphasis={emphasis}
            showProfile
            maxHeight={520}
            title={`${meta.name}: ${v.short} trend per decade, 1981–2024${focus.cells ? `, ${focus.name} highlighted` : ''}`}
          />
        </VStack>
      </Grid>

      <VStack gap={3}>
        <Divider />
        <Text type="supporting" color="accent">
          THE EVIDENCE
        </Text>
        <Text weight="semibold">{finding.headline.replace(`${v.short}:`, `${focus.name}:`)}</Text>
        <Text color="secondary">
          {finding.significance} {finding.emergence}
        </Text>
        <SeriesChart
          years={years}
          series={focus.series}
          analysis={result}
          variable={def.variable}
          unit={chartUnit}
          witness={witness ?? focus.compare?.series ?? null}
          witnessLabel={witness ? `${product.name.split(' (')[0]} (independent)` : focus.compare ? (def.focus as {labels: [string, string]}).labels[0] : undefined}
          step={step}
          height={240}
          title={`${focus.name}: annual anomaly, ${chartUnit}, 1981–2024`}
        />
      </VStack>

      <Grid columns={{minWidth: 320, max: 2}} gap={8}>
        <VStack gap={3}>
          <Divider />
          <Text type="supporting" color="accent">
            CROSS-EXAMINATION
          </Text>
          {exam && verdict ? (
            <>
              <HStack gap={2} vAlign="center" wrap="wrap">
                <Heading level={3}>Witness: {product.name}</Heading>
                <Badge variant={TONE[verdict.tone]} label={verdict.label} />
              </HStack>
              <Text color="secondary">{verdict.plain}</Text>
              <MetadataList columns={2}>
                <MetadataListItem label={`MERRA-2, ${unit}/decade`}>
                  <Text hasTabularNumbers>
                    {signed(exam.claim.slope * 10, digits)} [{signed(exam.claim.slopeLow * 10, digits)}, {signed(exam.claim.slopeHigh * 10, digits)}]
                  </Text>
                </MetadataListItem>
                <MetadataListItem label={`${product.name.split(' ')[0]}, ${unit}/decade`}>
                  <Text hasTabularNumbers>
                    {signed(exam.witness.slope * 10, digits)} [{signed(exam.witness.slopeLow * 10, digits)}, {signed(exam.witness.slopeHigh * 10, digits)}]
                  </Text>
                </MetadataListItem>
                <MetadataListItem label="p, MERRA-2">{pValue(exam.claim.p)}</MetadataListItem>
                <MetadataListItem label={`p, ${product.name.split(' ')[0]}`}>{pValue(exam.witness.p)}</MetadataListItem>
              </MetadataList>
            </>
          ) : (
            <>
              <HStack gap={2} vAlign="center">
                <Heading level={3}>No witness at this scale</Heading>
                <Badge variant="neutral" label="Unwitnessed" />
              </HStack>
              <Text color="secondary">
                The coast and mountain cells compared here sit about 1.5–2.5° of longitude apart. GISTEMP’s grid boxes are 2° wide and GPCP’s 2.5°, so each independent record blends both into one value. Bilad therefore gives no verdict here and relies on published station studies for context.
              </Text>
            </>
          )}
        </VStack>
        <VStack gap={3}>
          <Divider />
          <Text type="supporting" color="accent">
            INTEGRITY SCREEN
          </Text>
          <Heading level={3}>{step?.stepDominated ? `A jump in ${step.breakAt}, not a ramp` : 'Behaves like a gradual change'}</Heading>
          {step && (
            <Text color="secondary">
              Best single step: {step.breakAt}, {signed(step.step, digits)} {chartUnit}. ΔBIC {num(step.deltaBic, 1)} (above 6 favours a jump); trend remaining once the step is removed: p {pValue(step.residualTrendP)}.
            </Text>
          )}
          {breaks.length > 0 && (
            <Text color="secondary">
              Across all seven national {meta.name} series, {breaks.map(b => `${b.variables.length} jump within a year of ${b.year} (${b.variables.join(', ')})`).join('; ')}. Independent physical variables rarely change regime in the same year; a change in the observing system is a common cause.
            </Text>
          )}
        </VStack>
      </Grid>

      <VStack gap={3}>
        <Divider />
        <Text type="supporting" color="accent">
          VERDICT
        </Text>
        <Heading level={2}>{verdictHeadline(def, exam?.verdict, exam?.artifactSuspected)}</Heading>
        <Text type="large">{def.lesson}</Text>
        <HStack gap={2} wrap="wrap">
          <Button
            label="Investigate this yourself"
            variant="primary"
            href={atlasHref(def.iso3, {v: def.variable, region: focus.region, band: def.focus.kind === 'contrast' ? `${def.focus.latMin},${def.focus.latMax}` : undefined})}
          />
          {nextCase(def) && <Button label={`Next: ${nextCase(def)!.title}`} variant="secondary" href={`#/case/${nextCase(def)!.id}`} />}
        </HStack>
      </VStack>

      <VStack gap={2}>
        <Divider />
        <Text type="supporting" color="accent">
          SOURCES
        </Text>
        {def.references.map(r => (
          <Link key={r.url} href={r.url}>
            {r.label}
          </Link>
        ))}
      </VStack>
    </VStack>
  );
}

function verdictHeadline(def: CaseDef, verdict?: string, artifact?: boolean): string {
  if (!verdict) return 'A real contrast, resolved only by the reanalysis.';
  if (artifact) return 'Not climate: a likely artefact of the dataset.';
  if (verdict === 'corroborated') return 'Real: two independent records agree.';
  if (verdict === 'same-direction') return 'Real direction, uncertain size.';
  return VERDICT_TEXT[verdict as keyof typeof VERDICT_TEXT].label;
}

function nextCase(def: CaseDef): CaseDef | undefined {
  const i = CASES.findIndex(c => c.id === def.id);
  return CASES[i + 1];
}
