import {useMemo} from 'react';
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
import {coBreaks, crossExamine, INDEPENDENCE, loadWitness, PRODUCTS, VERDICT_TEXT, witnessSeries, type Crosscheck, type WitnessGrid} from '../lib/evidence';
import {useAsync, useCrosscheck, useIndex, useNation, useVariable, type NationBundle} from '../lib/hooks';
import type {DataIndex} from '../lib/nationData';
import {analyzeSeries, stepScreen, trendTest} from '../lib/stats';
import {describe, findingContext} from '../lib/narrative';
import {digitsFor, num, percent, pPhrase, pValue, signed} from '../lib/format';
import {atlasHref} from '../app/router';
import {NationMap, colorCells} from '../viz/NationMap';
import {Legend} from '../viz/Legend';
import {Card} from '@astryxdesign/core/Card';
import {CHROME} from '../viz/chrome';
import {SeriesChart} from '../viz/SeriesChart';
import {VerdictStrip} from '../features/VerdictStrip';
import {LIMITATION, type WitnessState} from '../lib/evidence';

const FULL = {from: 1981, to: 2024};
const WORDS: Record<number, string> = {2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven'};

export function CaseFile({id}: {id: string}) {
  const def = getCase(id);
  const nation = useNation(def?.iso3 ?? 'CHL');
  const meta = nation.status === 'ready' ? nation.data.meta : null;
  const data = useVariable(meta, def?.variable ?? 'T2M', FULL);
  const crosscheck = useCrosscheck();
  const index = useIndex();
  const witnessGrid = useAsync(() => loadWitness(def?.iso3 ?? 'CHL'), [def?.iso3]);

  if (!def) {
    return (
      <LayoutContent padding={8}>
        <Banner status="warning" title="No such case" description="Choose a case from the homepage." endContent={<Button label="Case files" href="#/?section=cases" />} />
      </LayoutContent>
    );
  }
  const ready = nation.status === 'ready' && data.status === 'ready' && crosscheck.status === 'ready' && index.status === 'ready' && witnessGrid.status === 'ready';
  const failed = [nation, data, crosscheck, index, witnessGrid].find(s => s.status === 'error');
  return (
    <LayoutContent padding={8}>
      <VStack gap={8}>
        <VStack gap={3}>
          <HStack gap={2} vAlign="center" wrap="wrap">
            <Button label="All cases" variant="ghost" size="sm" href="#/?section=cases" />
            <Text type="label" color="accent">
              Case {def.number} · {nation.status === 'ready' ? nation.data.meta.name : def.iso3} · {getVariable(def.variable).label}
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
          <CaseBody def={def} bundle={nation.data} analysis={data.data.analysis} crosscheck={crosscheck.data} index={index.data} witnessGrid={witnessGrid.data} />
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

function CaseBody({def, bundle, analysis, crosscheck, index, witnessGrid}: {def: CaseDef; bundle: NationBundle; analysis: VariableAnalysis; crosscheck: Crosscheck; index: DataIndex; witnessGrid: WitnessGrid}) {
  const {meta, boundary} = bundle;
  const v = getVariable(def.variable);
  const unit = trendUnit(def.variable);
  const digits = digitsFor(unit, v.digits);
  const years = analysis.years;
  const chartUnit = unit === '% of normal' ? '%' : v.unit;

  const focus = useMemo(() => {
    if (def.focus.kind === 'region') {
      const r = meta.regions.find(x => x.id === (def.focus as {region: string}).region);
      if (!r) throw new Error(`Region ${(def.focus as {region: string}).region} is not defined for ${meta.iso3}`);
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
  const witness = def.focus.kind === 'contrast' ? null : witnessSeries(crosscheck, meta.iso3, def.variable, FULL, focus.region);
  const exam = witness ? crossExamine(years, focus.series, witness) : null;
  const finding = describe(def.variable, unit, result, years, focus.series, findingContext(exam, def.variable));
  const step = exam?.claimStep ?? stepScreen(years, focus.series);
  const product = PRODUCTS[def.variable];
  // Co-breaks only bear on a case when its own variable is one of the jumpers.
  const breaks = coBreaks(index, meta.iso3).filter(b => b.variables.includes(def.variable));
  const sharedBoxes = useMemo(() => {
    if (!focus.compare || !witnessGrid.T2M) return null;
    const box = witnessGrid.T2M.cellBox;
    const east = focus.cells!.filter(c => !focus.compare!.cells.includes(c));
    const pairs = focus.compare.cells.map((w, k) => box[w] === box[east[k]]);
    return {same: pairs.filter(Boolean).length, total: pairs.length};
  }, [focus, witnessGrid]);
  const coloring = colorCells(analysis, 'change');
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
  const witnessState: WitnessState = exam ? {kind: 'available', exam} : {kind: 'too-coarse', product: PRODUCTS.T2M.name};

  return (
    <VStack gap={8}>
      <VerdictStrip
        place={focus.name}
        variable={def.variable}
        window={FULL}
        result={result}
        unit={unit}
        witness={witnessState}
        step={step}
        resolution={focus.cells ? `${focus.cells.length} cells of 0.5° × 0.625°, area-weighted` : `${meta.cells.length} cells of 0.5° × 0.625°, area-weighted`}
        limitation={LIMITATION[def.variable]}
        next={{
          label: 'Investigate this yourself in the atlas',
          href: atlasHref(def.iso3, {v: def.variable, region: focus.region, band: def.focus.kind === 'contrast' ? `${def.focus.latMin},${def.focus.latMax}` : undefined}),
        }}
      />
      <Grid columns={{minWidth: 320, max: 2}} gap={8}>
        <VStack gap={3}>
          <Text type="label" color="accent">
            The claim
          </Text>
          {def.context.map(p => (
            <Text key={p.slice(0, 24)} type="large">
              {p}
            </Text>
          ))}
          {deficit && (
            <Text type="large">
              In MERRA-2, {focus.name} averaged {num(deficit.before, 0)} mm a year in 1981–2009 and {num(deficit.after, 0)} mm in 2010–2019: <Text weight="bold">{percent(deficit.share)} less rain</Text>
              {deficit.witnessDeficit !== null ? `. GPCP, on the same cells, shows ${percent(deficit.witnessDeficit)} less.` : '.'}
            </Text>
          )}
          {compareTest && (
            <Text type="large">
              Daytime highs in the {def.focus.kind === 'contrast' ? def.focus.labels[1].split(' (')[0] : ''} changed by <Text weight="bold">{signed(result.trend.slope * 10, digits)} °C per decade</Text> ({pPhrase(result.trend.p)}); at the coast, on the same rows, by{' '}
              <Text weight="bold">{signed(compareTest.slope * 10, digits)} °C</Text> ({pPhrase(compareTest.p)}).
            </Text>
          )}
        </VStack>
        <VStack gap={2} height="min(78vh, 46rem)">
          <NationMap
            meta={meta}
            boundary={boundary}
            context={bundle.context}
            analysis={analysis}
            layer="change"
            emphasis={emphasis}
            showProfile
            maxHeight={760}
            unitLabel={`${unit} per decade`}
            outlines={focus.compare ? [{cells: focus.compare.cells, color: CHROME.witness}, {cells: focus.cells!.filter(c => !focus.compare!.cells.includes(c)), color: CHROME.accent}] : []}
            title={`${meta.name}: ${v.short} trend per decade, 1981–2024${focus.cells ? `, ${focus.name} highlighted` : ''}`}
          />
          <Legend variable={def.variable} layer="change" coloring={coloring} unit={unit} />
          {focus.compare && <Text type="supporting">Outlined: coast cells (blue) and Andes cells (gold), one pair per grid row.</Text>}
        </VStack>
      </Grid>

      <VStack gap={3}>
        <Divider />
        <Text type="label" color="accent">
          The evidence
        </Text>
        <Heading level={3}>{finding.headline.replace(`${v.short}:`, `${focus.name}:`)}</Heading>
        <Text type="large" color="secondary">
          {finding.significance} {finding.emergence}
        </Text>
        <SeriesChart
          years={years}
          series={focus.series}
          analysis={result}
          variable={def.variable}
          unit={chartUnit}
          witness={witness ?? focus.compare?.series ?? null}
          witnessLabel={witness ? `${product.name} (independent record)` : focus.compare ? (def.focus as {labels: [string, string]}).labels[0] : undefined}
          step={step}
          height={360}
          title={`${focus.name}: annual anomaly, ${chartUnit}, 1981–2024`}
        />
        <Card variant="muted" padding={4}>
          <VStack gap={1}>
            <Text weight="semibold">How to read these numbers</Text>
            <Text color="secondary">
              The trend is the typical change per decade, estimated so that one extreme year cannot drag it. The 95% range is where the true trend probably lies; if it does not include zero, the direction is clear. The p-value is how often a trend this strong would appear by chance in a record with no real trend; below 0.05 is the usual bar, and TRACE uses a version that allows for dry or warm years clustering together.
            </Text>
          </VStack>
        </Card>
      </VStack>

      <Grid columns={{minWidth: 320, max: 2}} gap={8}>
        <VStack gap={3}>
          <Divider />
          <Text type="label" color="accent">
            Cross-examination
          </Text>
          {exam && verdict ? (
            <>
              <HStack gap={2} vAlign="center" wrap="wrap">
                <Heading level={3}>Witness: {product.name}</Heading>
                <Text weight="semibold">{verdict.label}</Text>
              </HStack>
              <Text color="secondary">{verdict.plain}</Text>
              <Text type="supporting">{INDEPENDENCE[def.variable]}</Text>
              <MetadataList columns={2}>
                <MetadataListItem label={`MERRA-2, ${unit}/decade`}>
                  <Text hasTabularNumbers>
                    {signed(exam.claim.slope * 10, digits)} [{signed(exam.claim.slopeLow * 10, digits)}, {signed(exam.claim.slopeHigh * 10, digits)}]
                  </Text>
                </MetadataListItem>
                <MetadataListItem label={`${product.name}, ${unit}/decade`}>
                  <Text hasTabularNumbers>
                    {signed(exam.witness.slope * 10, digits)} [{signed(exam.witness.slopeLow * 10, digits)}, {signed(exam.witness.slopeHigh * 10, digits)}]
                  </Text>
                </MetadataListItem>
                <MetadataListItem label="p, MERRA-2">{pValue(exam.claim.p)}</MetadataListItem>
                <MetadataListItem label={`p, ${product.name}`}>{pValue(exam.witness.p)}</MetadataListItem>
              </MetadataList>
            </>
          ) : (
            <>
              <HStack gap={2} vAlign="center">
                <Heading level={3}>No witness at this scale</Heading>
                <Text weight="semibold">Unwitnessed</Text>
              </HStack>
              <Text color="secondary">
                The coast and mountain cells compared here sit about 1.25–3.75° of longitude apart (1.9° typically), while GISTEMP’s grid boxes are 2° wide.
                {sharedBoxes ? ` In ${sharedBoxes.same} of ${sharedBoxes.total} rows the coast cell and the Andes cell fall in the same GISTEMP box, so the witness gives both the same value.` : ''} TRACE therefore gives no verdict here; published station studies are the context.
              </Text>
            </>
          )}
        </VStack>
        <VStack gap={3}>
          <Divider />
          <Text type="label" color="accent">
            Integrity screen
          </Text>
          <Heading level={3}>{step?.stepDominated ? `A jump in ${step.breakAt}, not a ramp` : 'Behaves like a gradual change'}</Heading>
          {step && (
            <Text color="secondary">
              {step.stepDominated
                ? `In ${step.breakAt} the record shifts by ${signed(step.step, digits)} ${chartUnit} at once. A one-time shift fits far better than a steady trend (score ${num(step.deltaBic, 1)}; above 6 counts as strong), and once it is taken out no trend is left (${pPhrase(step.residualTrendP)}).`
                : `The best single shift, in ${step.breakAt} (${signed(step.step, digits)} ${chartUnit}), fits no better than a steady trend (score ${num(step.deltaBic, 1)}; a jump needs above 6).`}
            </Text>
          )}
          {breaks.length > 0 && (
            <Text color="secondary">
              Across {meta.name}’s seven national series, {breaks.map(b => `${WORDS[b.variables.length] ?? b.variables.length} variables jump within a year of ${b.year} (${b.variables.map(x => getVariable(x).short.toLowerCase()).join(', ')})`).join('; ')}. These variables are coupled inside one model, so a shared jump suggests something changed in the data fed to it, though it does not prove it.{exam?.artifactSuspected ? ' The independent record shows no such jump.' : exam && (exam.verdict === 'corroborated' || exam.verdict === 'same-direction') ? ` ${product.name} shows the same change without that jump, so the verdict does not depend on it.` : ''}
            </Text>
          )}
        </VStack>
      </Grid>

      <VStack gap={3}>
        <Divider />
        <Text type="label" color="accent">
          Verdict
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
        <Text type="label" color="accent">
          Sources
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
  if (!verdict) return 'A contrast in one dataset, with no witness at this scale.';
  if (artifact) return 'A likely data artefact that needs investigation.';
  if (verdict === 'corroborated')
    return def.variable === 'PRECTOTCORR' ? 'Corroborated by a partly independent gauge-and-satellite record.' : 'An independent station record agrees.';
  if (verdict === 'same-direction') return 'Both records show the change; they disagree on how fast.';
  return `${VERDICT_TEXT[verdict as keyof typeof VERDICT_TEXT].label}.`;
}

function nextCase(def: CaseDef): CaseDef | undefined {
  const i = CASES.findIndex(c => c.id === def.id);
  return CASES[i + 1];
}
