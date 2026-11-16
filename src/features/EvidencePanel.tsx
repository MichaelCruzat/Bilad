import {Glossary} from './Glossary';
import {useMemo, useState} from 'react';
import {Button} from '@astryxdesign/core/Button';
import {Collapsible} from '@astryxdesign/core/Collapsible';
import {Divider} from '@astryxdesign/core/Divider';
import {Link} from '@astryxdesign/core/Link';
import {MetadataList, MetadataListItem} from '@astryxdesign/core/MetadataList';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {Heading, Text} from '@astryxdesign/core/Text';
import {getVariable} from '../data/variables';
import {
  analysisFor,
  cellsInBand,
  seasonalTrends,
  sensitivityFor,
  seriesFor,
  subsetSeries,
  trendUnit,
  type VariableAnalysis,
} from '../lib/analysis';
import {analyzeSeries, stepScreen, startYearSensitivity} from '../lib/stats';
import {INDEPENDENCE, LIMITATION, PRODUCTS, toWitnessState, VERDICT_TEXT, witnessBoxes, witnessForCells, type WitnessGrid} from '../lib/evidence';
import type {Async} from '../lib/hooks';
import {copyText, download} from '../lib/download';
import {VerdictStrip} from './VerdictStrip';
import type {NationMeta, VariableGrid} from '../lib/nationData';
import {describe, findingContext} from '../lib/narrative';
import {digitsFor, lat, lon, percent, pPhrase, pValue, signed, num} from '../lib/format';
import {SeriesChart} from '../viz/SeriesChart';
import {MonthStrip} from '../viz/MonthStrip';
import {SensitivityChart} from '../viz/SensitivityChart';

export type Selection = {kind: 'nation'} | {kind: 'cell'; cell: number} | {kind: 'band'; band: [number, number]; regionId?: string; name?: string};

type Props = {
  meta: NationMeta;
  grid: VariableGrid;
  analysis: VariableAnalysis;
  witnessStatus: Async<WitnessGrid>;
  selection: Selection;
};


export function EvidencePanel({meta, grid, analysis, witnessStatus, selection}: Props) {
  const [copied, setCopied] = useState(false);
  const witnessGrid = witnessStatus.status === 'ready' ? witnessStatus.data : null;
  const def = getVariable(analysis.variable);
  const unit = trendUnit(analysis.variable);
  const digits = digitsFor(unit, def.digits);
  const years = analysis.years;

  const view = useMemo(() => {
    if (selection.kind === 'cell') {
      const series = seriesFor(analysis, selection.cell);
      return {
        series,
        result: analysisFor(analysis, selection.cell),
        sensitivity: sensitivityFor(analysis, selection.cell),
        seasons: seasonalTrends(meta, grid, analysis.window, selection.cell),
      };
    }
    if (selection.kind === 'band') {
      const cells = cellsInBand(meta, selection.band[0], selection.band[1]);
      const series = subsetSeries(meta, analysis, cells);
      const result = analyzeSeries(years, series);
      const minLength = Math.min(20, Math.max(10, years.length - 5));
      const sensitivity = startYearSensitivity(years, series, minLength).map(p => ({...p, slope: p.slope * 10, slopeLow: p.slopeLow * 10, slopeHigh: p.slopeHigh * 10}));
      return {series, result, sensitivity, seasons: seasonalTrends(meta, grid, analysis.window, cells), cells};
    }
    return {
      series: analysis.national.series,
      result: analysis.national.analysis,
      sensitivity: sensitivityFor(analysis, null),
      seasons: seasonalTrends(meta, grid, analysis.window, null),
    };
  }, [meta, grid, analysis, selection, years]);

  const selectedCells =
    selection.kind === 'cell' ? [selection.cell] : selection.kind === 'band' ? (view.cells ?? []) : meta.cells.map((_, i) => i);
  const weights = useMemo(() => meta.cells.map(c => c.areaKm2), [meta]);
  const state = toWitnessState(analysis.variable, witnessStatus, years, view.series, () =>
    witnessGrid ? witnessForCells(witnessGrid, analysis.variable, weights, selectedCells, analysis.window) : null,
  );
  const witness = state.kind === 'available' && witnessGrid ? witnessForCells(witnessGrid, analysis.variable, weights, selectedCells, analysis.window) : null;
  const boxes = witness && witnessGrid ? witnessBoxes(witnessGrid, analysis.variable, selectedCells) : 0;
  const product = PRODUCTS[analysis.variable];
  const exam = state.kind === 'available' ? state.exam : null;
  const step = exam?.claimStep ?? stepScreen(years, view.series);
  const finding = describe(analysis.variable, unit, view.result, years, view.series, findingContext(exam, analysis.variable));
  const t = view.result.trend;

  const place =
    selection.kind === 'cell'
      ? `Grid cell ${lat(meta.cells[selection.cell].lat)}, ${lon(meta.cells[selection.cell].lon)}`
      : selection.kind === 'band'
        ? selection.name ?? `${lat(selection.band[0])} to ${lat(selection.band[1])}`
        : `${meta.name}, whole nation`;
  const cellInfo = selection.kind === 'cell' ? meta.cells[selection.cell] : null;

  return (
    <VStack gap={5}>
      <VStack gap={2}>
        <Text type="label" color="accent">
          {def.sphere} · {def.label}
        </Text>
        <Heading level={2}>{place}</Heading>
        {cellInfo && (
          <Text type="supporting">
            {thousandsKm(cellInfo.areaKm2)} of land in this 0.5° × 0.625° cell ({percent(cellInfo.land)} land).
            {cellInfo.land < 0.5 ? ' Mostly sea: its values carry a strong ocean influence.' : ''}
          </Text>
        )}
        {selection.kind === 'band' && <Text type="supporting">{view.cells?.length ?? 0} grid cells, area-weighted.</Text>}
      </VStack>

      <VerdictStrip
        place={place}
        variable={analysis.variable}
        window={analysis.window}
        result={view.result}
        unit={unit}
        witness={state}
        step={step}
        fieldSignificant={selection.kind === 'cell' ? analysis.significant[selection.cell] === 1 : undefined}
        resolution={selection.kind === 'cell' ? '0.5° × 0.625° cell' : `${selectedCells.length} cells of 0.5° × 0.625°, area-weighted`}
        limitation={LIMITATION[analysis.variable]}
        next={{label: `Open the ${meta.name} brief: all seven variables`, href: `#/brief/${meta.iso3}`}}
      />
      <HStack gap={2} wrap="wrap">
        <Button
          size="sm"
          variant="secondary"
          label={copied ? 'Link copied' : 'Copy link to this view'}
          onClick={async () => {
            if (await copyText(window.location.href)) {
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            }
          }}
        />
        <Button
          size="sm"
          variant="secondary"
          label="Download evidence (JSON)"
          onClick={() =>
            download(
              `trace-${meta.iso3}-${selection.kind === 'nation' ? 'nation' : place.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${analysis.variable}-${analysis.window.from}-${analysis.window.to}.json`,
              JSON.stringify(
                {
                  place,
                  nation: meta.iso3,
                  variable: analysis.variable,
                  unit: `${unit} per decade`,
                  window: analysis.window,
                  baseline: '1991–2020',
                  resolution: '0.5° × 0.625° MERRA-2 cells, area-weighted',
                  cells: selectedCells.length,
                  trend: {perDecade: t.slope * 10, low95: t.slopeLow * 10, high95: t.slopeHigh * 10, pCorrected: t.p, pClassic: t.pRaw, tau: t.tau, signalToNoise: view.result.snr},
                  integrity: step ? {stepDominated: step.stepDominated, breakAt: step.breakAt, deltaBic: step.deltaBic, residualTrendP: step.residualTrendP} : null,
                  witness:
                    state.kind === 'available'
                      ? {product: product.long, verdict: state.exam.verdict, perDecade: state.exam.witness.slope * 10, pCorrected: state.exam.witness.p, artefactSuspected: state.exam.artifactSuspected}
                      : {status: state.kind},
                  series: Array.from(view.series, (v, i) => ({year: years[i], value: Number.isFinite(v) ? v : null})),
                  limitation: LIMITATION[analysis.variable],
                  source: {api: meta.provenance.api, retrieved: meta.provenance.retrieved, requests: meta.provenance.requests.filter(r => r.variable === analysis.variable).map(r => r.url)},
                  view: window.location.href,
                },
                null,
                2,
              ),
              'application/json',
            )
          }
        />
      </HStack>
      <VStack gap={2}>
        <Text color="secondary">{finding.significance}</Text>
        {finding.emergence && <Text color="secondary">{finding.emergence}</Text>}
      </VStack>

      <SeriesChart
        years={years}
        series={view.series}
        analysis={view.result}
        variable={analysis.variable}
        unit={unit === '% of normal' ? '%' : def.unit}
        witness={witness}
        witnessLabel={product ? `${product.name} (independent record)` : undefined}
        step={step}
        title={`Annual ${def.short.toLowerCase()} anomaly versus 1991–2020, ${unit === '% of normal' ? 'per cent of normal' : def.unit}, ${place}`}
      />
      <Text type="supporting">
        Bars: each year’s departure from the 1991–2020 normal{unit === '% of normal' ? ', as a percentage of that normal' : ''}. Line: Theil–Sen trend, shaded by its 95% range; dashed when not significant.
      </Text>

      {exam && product && (
        <VStack gap={3}>
          <Divider />
          <HStack gap={2} vAlign="center" wrap="wrap">
            <Heading level={3}>Cross-examination</Heading>
            <Text weight="semibold">{VERDICT_TEXT[exam.verdict].label}</Text>
          </HStack>
          <Text color="secondary">
            {VERDICT_TEXT[exam.verdict].plain} Witness: <Link href={product.url}>{product.long}</Link>, {product.agency}, sampled on the same grid cells ({boxes} witness grid {boxes === 1 ? 'box' : 'boxes'}).
            {boxes <= 2 && selection.kind !== 'nation' ? ' At this scale the witness is much coarser than the selection, so treat the comparison as rough.' : ''}
          </Text>
          <Text type="supporting">{INDEPENDENCE[analysis.variable]}</Text>
          <MetadataList columns={2}>
            <MetadataListItem label="MERRA-2 (claim)">
              <Text hasTabularNumbers>
                {signed(exam.claim.slope * 10, digits)} [{signed(exam.claim.slopeLow * 10, digits)}, {signed(exam.claim.slopeHigh * 10, digits)}] · {pPhrase(exam.claim.p)}
              </Text>
            </MetadataListItem>
            <MetadataListItem label={`${product.name} (witness)`}>
              <Text hasTabularNumbers>
                {signed(exam.witness.slope * 10, digits)} [{signed(exam.witness.slopeLow * 10, digits)}, {signed(exam.witness.slopeHigh * 10, digits)}] · {pPhrase(exam.witness.p)}
              </Text>
            </MetadataListItem>
          </MetadataList>
          {exam.artifactSuspected && (
            <Text color="accent">
              Data integrity flag: the reanalysis record {exam.claimStep?.stepDominated ? `behaves like a jump in ${exam.claimStep.breakAt} rather than a steady trend, ` : ''}and the witness does not support it. Check provenance before using this trend as climate evidence.
            </Text>
          )}
        </VStack>
      )}


      <Divider />
      <Collapsible defaultIsOpen={false} trigger={<Text weight="semibold">Inspect integrity: a steady ramp or a single jump?</Text>}>
      <VStack gap={2}>
        {step ? (
          <Text color="secondary">
            {step.stepDominated
              ? `A single jump in ${step.breakAt} (${signed(step.step, digits)} ${unit === '% of normal' ? '%' : def.unit}) explains this record better than a steady trend (ΔBIC ${num(step.deltaBic, 1)}), and no trend remains once the jump is removed. ${
                  exam && (exam.verdict === 'corroborated' || exam.verdict === 'same-direction')
                    ? 'The independent record shows the same change, so this looks like a genuine shift whose timing and shape are uncertain, rather than a data artefact.'
                    : exam
                      ? 'The independent record does not show the same change, which points to how the data were produced rather than to the climate.'
                      : 'Regime shifts happen, but so do changes in satellites and processing; without an independent record this cannot be settled.'
                }`
              : step.deltaBic > 2
                ? `There is some evidence of a jump around ${step.breakAt} (ΔBIC ${num(step.deltaBic, 1)}), but a trend survives within the two periods, so the record is not explained by the jump alone.`
                : `The record does not meet both jump-flag criteria (ΔBIC ${num(step.deltaBic, 1)}). This does not establish a steady ramp.`}
          </Text>
        ) : (
          <Text color="secondary">Window too short to screen for a step change.</Text>
        )}
      </VStack>
      </Collapsible>

      <Collapsible defaultIsOpen={false} trigger={<Text weight="semibold">Inspect robustness: which months, and does the start year matter?</Text>}>
      <VStack gap={2}>
        <Heading level={3}>Which months are changing?</Heading>
        <MonthStrip trends={view.seasons} variable={analysis.variable} unit={unit} digits={digits} title={`Trend by calendar month, ${place}`} />
        <Text type="supporting">
          Each bar is the trend for one calendar month, in {unit} per decade{def.relative ? ' of that month’s own normal' : ''}. Outlined bars are significant at a 10% false discovery rate across all twelve months; the others are exploratory.
        </Text>
      </VStack>
      <VStack gap={2}>
        <Heading level={3}>Does the start year matter?</Heading>
        <SensitivityChart points={view.sensitivity} unit={unit} digits={digits} title={`Trend per decade by first year of record, ${place}`} />
        <Text type="supporting">
          The trend re-estimated for every start year that leaves at least {Math.min(20, Math.max(10, years.length - 5))} years. Filled dots are significant. {robustness(view.sensitivity)}
        </Text>
      </VStack>
      </Collapsible>

      <Collapsible defaultIsOpen={false} trigger={<Text weight="semibold">Inspect the test record</Text>}>
      <VStack gap={2}>
        <MetadataList columns={2}>
          <MetadataListItem label="Window">{`${years[0]}–${years[years.length - 1]} (${t.n} years)`}</MetadataListItem>
          <MetadataListItem label={`Sen slope, ${unit}/decade`}>
            <Text hasTabularNumbers>{signed(t.slope * 10, digits)}</Text>
          </MetadataListItem>
          <MetadataListItem label="95% interval (Gilbert)">
            <Text hasTabularNumbers>
              {signed(t.slopeLow * 10, digits)} to {signed(t.slopeHigh * 10, digits)}
            </Text>
          </MetadataListItem>
          <MetadataListItem label="Kendall’s τ">
            <Text hasTabularNumbers>{num(t.tau, 3)}</Text>
          </MetadataListItem>
          <MetadataListItem label="p, classic Mann–Kendall">
            <Text hasTabularNumbers>{pValue(t.pRaw)}</Text>
          </MetadataListItem>
          <MetadataListItem label="p, Hamed–Rao corrected">
            <Text hasTabularNumbers>{pValue(t.p)}</Text>
          </MetadataListItem>
          <MetadataListItem label="Correction for runs of similar years (n/n*)">
            <Text hasTabularNumbers>{num(t.inflation, 2)}</Text>
          </MetadataListItem>
          <MetadataListItem label="Signal ÷ noise">
            <Text hasTabularNumbers>{num(view.result.snr, 2)}</Text>
          </MetadataListItem>
        </MetadataList>
        {selection.kind === 'nation' && (
          <Text type="supporting">
            Field significance: {analysis.counts.tested} cells tested; {analysis.counts.naive} pass p &lt; 0.05 one by one, {analysis.counts.fdr} are significant at a 10% false discovery rate across the map (Benjamini–Hochberg, α = 0.10, p* = {pValue(analysis.pStar)}). Neighbouring reanalysis cells are not independent, so treat area shares as descriptive. Land with a significant trend towards {def.up}: {percent(analysis.areaUp)}; towards {def.down}: {percent(analysis.areaDown)}.
          </Text>
        )}
      </VStack>
      </Collapsible>

      <Collapsible defaultIsOpen={false} trigger={<Text weight="semibold">{`Inspect provenance: ${meta.provenance.requests.filter(r => r.variable === analysis.variable).length} NASA POWER requests`}</Text>}>
        <VStack gap={2}>
          <Text type="supporting">
            {meta.provenance.api}, sources {meta.provenance.sources.join(', ')}, retrieved {meta.provenance.retrieved}. Values were quantised to {def.scale} {def.sourceUnit} for shipping.
          </Text>
          {meta.provenance.requests
            .filter(r => r.variable === analysis.variable)
            .map(r => (
              <Link key={r.url} href={r.url}>
                <Text type="code" size="xsm" wordBreak="break-all">
                  {r.url}
                </Text>
              </Link>
            ))}
        </VStack>
      </Collapsible>

      <Collapsible defaultIsOpen={false} trigger={<Text weight="semibold">Read limitations</Text>}>
        <VStack gap={1}>
          <Text type="supporting">{LIMITATION[analysis.variable]}</Text>
          <Text type="supporting">A trend says what changed, where and by how much. It does not say why, and it is not a forecast.</Text>
          <Text type="supporting">Neighbouring reanalysis cells are not independent, so shares of significant area are descriptive.</Text>
          <Text type="supporting">Values were quantised to {def.scale} {def.sourceUnit} for shipping; the tests run on the annual means.</Text>
        </VStack>
      </Collapsible>

      <Collapsible defaultIsOpen={false} trigger={<Text weight="semibold">Terms and abbreviations</Text>}>
        <Glossary compact />
      </Collapsible>
    </VStack>
  );
}

function thousandsKm(km2: number): string {
  return `${Math.round(km2).toLocaleString('en-US')} km²`;
}

function robustness(points: {slope: number; p: number}[]): string {
  if (!points.length) return '';
  const sig = points.filter(p => p.p < 0.05).length;
  const sign = Math.sign(points[0].slope);
  const same = points.filter(p => Math.sign(p.slope) === sign).length;
  if (sig === points.length) return 'Significant whichever start year you pick.';
  if (sig === 0) return 'Not significant for any start year.';
  return `Significant for ${sig} of ${points.length} start years, with the same sign in ${same}.${sig <= 2 ? ' A claim that only works from one or two start years is weak.' : ''}`;
}
