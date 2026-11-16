import {useMemo, useState} from 'react';
import {Card} from '@astryxdesign/core/Card';
import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {LayoutContent} from '@astryxdesign/core/Layout';
import {MetadataList, MetadataListItem} from '@astryxdesign/core/MetadataList';
import {Spinner} from '@astryxdesign/core/Spinner';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {Table, proportional, type TableColumn} from '@astryxdesign/core/Table';
import {Heading, Text} from '@astryxdesign/core/Text';
import {BASELINE, FIRST_YEAR, LAST_YEAR, VARIABLES} from '../data/variables';
import {analyzeVariable, trendUnit, type VariableAnalysis} from '../lib/analysis';
import {LIMITATION, loadWitness, overallVerdict, PRODUCTS, toWitnessState, VERDICT_TEXT, witnessForCells, type WitnessState} from '../lib/evidence';
import {useAsync, useMediaQuery, useNation} from '../lib/hooks';
import {FEATURED} from '../data/featured';
import {loadGrid} from '../lib/nationData';
import {stepScreen} from '../lib/stats';
import {digitsFor, percent, pValue, signed} from '../lib/format';
import {copyText, download, toCsv} from '../lib/download';
import {atlasHref} from '../app/router';

const WINDOW = {from: FIRST_YEAR, to: LAST_YEAR};

type Row = {
  id: string;
  variable: string;
  unit: string;
  slope: number;
  low: number;
  high: number;
  p: number;
  areaUp: number;
  areaDown: number;
  integrity: string;
  changePoint: string;
  /** Ramp-or-jump and change point folded into one phrase, one year at most. */
  shape: string;
  witness: string;
  verdict: string;
  tone: 'success' | 'warning' | 'error' | 'neutral';
  digits: number;
} & Record<string, unknown>;

/** National evidence brief: every variable's verdict on one page, downloadable. */
export function Brief({iso3}: {iso3: string}) {
  if (!Object.values(FEATURED).includes(iso3)) {
    return (
      <LayoutContent padding={8}>
        <Banner
          status="info"
          title={`No national brief for “${iso3}”`}
          description={`Briefs cover the seven nations with all seven variables: ${FEATURED_NAMES}. Every other country has temperature and rainfall verdicts on the World map, with a link and an evidence download.`}
          endContent={
            <HStack gap={2}>
              <Button label="Find it on the World map" variant="primary" href="#/world" />
              <Button label="Casebook" variant="secondary" href="#/" />
            </HStack>
          }
        />
      </LayoutContent>
    );
  }
  return <BriefBody iso3={iso3} />;
}

const FEATURED_NAMES = 'Bangladesh, Chile, Kenya, Mexico, Morocco, the Philippines and Spain';

function BriefBody({iso3}: {iso3: string}) {
  const narrow = useMediaQuery('(max-width: 900px)');
  const [copied, setCopied] = useState(false);
  const nation = useNation(iso3);
  const meta = nation.status === 'ready' ? nation.data.meta : null;
  const analyses = useAsync(async () => {
    const grids = await Promise.all(VARIABLES.map(v => loadGrid(meta!, v.id)));
    return grids.map(g => analyzeVariable(meta!, g, WINDOW));
  }, [iso3], meta !== null);
  const witness = useAsync(() => loadWitness(iso3), [iso3]);

  const rows = useMemo<Row[] | null>(() => {
    if (!meta || analyses.status !== 'ready') return null;
    const all = meta.cells.map((_, i) => i);
    const weights = meta.cells.map(c => c.areaKm2);
    return analyses.data.map((a: VariableAnalysis) => {
      const def = VARIABLES.find(v => v.id === a.variable)!;
      const unit = trendUnit(a.variable);
      const t = a.national.analysis.trend;
      const step = stepScreen(a.years, a.national.series);
      const state: WitnessState = toWitnessState(a.variable, witness, a.years, a.national.series, () =>
        witness.status === 'ready' ? witnessForCells(witness.data, a.variable, weights, all, WINDOW) : null,
      );
      const v = overallVerdict(t.p, state, Boolean(step?.stepDominated));
      const cp = a.national.analysis.changePoint;
      return {
        id: a.variable,
        variable: def.label,
        unit,
        slope: t.slope * 10,
        low: t.slopeLow * 10,
        high: t.slopeHigh * 10,
        p: t.p,
        areaUp: a.areaUp,
        areaDown: a.areaDown,
        integrity: step ? (step.stepDominated ? `Jump in ${step.breakAt}` : 'No step-dominated flag') : 'n/a',
        changePoint: cp && cp.p < 0.05 ? String(cp.breakAt) : 'none',
        shape: step?.stepDominated
          ? `Jump in ${step.breakAt}`
          : cp && cp.p < 0.05
            ? `No jump flag; possible shift ${cp.breakAt} (a clue, not a cause)`
            : step
              ? 'No step-dominated flag'
              : 'n/a',
        witness:
          state.kind === 'available'
            ? `${PRODUCTS[a.variable].name} (${VERDICT_TEXT[state.exam.verdict].label.toLowerCase()})`
            : state.kind === 'unsupported'
              ? 'None in this release'
              : state.kind === 'failed'
                ? 'Unavailable (retry)'
                : state.kind === 'loading'
                  ? 'Loading'
                  : 'No coverage',
        verdict: v.label,
        tone: v.tone,
        digits: digitsFor(unit, def.digits),
      };
    });
  }, [meta, analyses, witness]);

  if (nation.status === 'error' || analyses.status === 'error') {
    const failed = nation.status === 'error' ? nation : analyses.status === 'error' ? analyses : null;
    return (
      <LayoutContent padding={8}>
        <Banner status="error" title={`Could not build the ${iso3} brief`} description={failed?.error.message} endContent={failed ? <Button label="Retry" onClick={failed.retry} /> : undefined} />
      </LayoutContent>
    );
  }

  const columns: TableColumn<Row>[] = [
    {key: 'variable', header: 'Variable', width: proportional(1.1, {minWidth: 150})},
    {key: 'verdict', header: 'Verdict', width: proportional(1.5, {minWidth: 260}), renderCell: r => <Text weight="semibold">{r.verdict}</Text>},
    {key: 'slope', header: 'Trend per decade [95% range]', width: proportional(1.7, {minWidth: 220}), renderCell: r => <Text hasTabularNumbers>{`${signed(r.slope, r.digits)} [${signed(r.low, r.digits)}, ${signed(r.high, r.digits)}] ${r.unit}`}</Text>},
    {key: 'p', header: 'p-value', align: 'end', width: proportional(0.5, {minWidth: 80}), renderCell: r => <Text hasTabularNumbers>{pValue(r.p)}</Text>},
    {key: 'areaUp', header: 'Land up / down', width: proportional(0.8, {minWidth: 120}), renderCell: r => <Text hasTabularNumbers>{`${percent(r.areaUp)} / ${percent(r.areaDown)}`}</Text>},
    {key: 'witness', header: 'Independent record', width: proportional(1.3, {minWidth: 170})},
    {key: 'shape', header: 'Ramp or jump', width: proportional(1.3, {minWidth: 170})},
  ];

  const receipt = meta
    ? {
        nation: meta.name,
        iso3: meta.iso3,
        window: WINDOW,
        baseline: BASELINE,
        grid: '0.5° × 0.625° MERRA-2 cells, weighted by land area',
        cells: meta.cells.length,
        source: meta.provenance.api,
        retrieved: meta.provenance.retrieved,
        method: 'Annual means of monthly anomalies; Theil–Sen slope with Gilbert 95% interval; Mann–Kendall with Hamed–Rao correction; Benjamini–Hochberg field control (alpha 0.10); BIC ramp-versus-jump screen; Pettitt change point (a clue, not attribution).',
        limitations: [
          'A trend says what changed, where and by how much; it does not say why and is not a forecast.',
          'GPCP shares some rain gauges with MERRA-2, so rainfall agreement is only partly independent.',
          'Neighbouring reanalysis cells are not independent; area shares are descriptive.',
        ],
      }
    : null;

  return (
    <LayoutContent padding={8}>
      <VStack gap={6}>
        <VStack gap={2}>
          <Text type="label" color="accent">
            National evidence brief
          </Text>
          <Heading level={1} type="display-3">
            {meta?.name ?? iso3}, {WINDOW.from}–{WINDOW.to}
          </Heading>
          <Text type="large" color="secondary">Every variable TRACE tracks for this nation: its trend, its tests, its independent record where one exists, and one verdict. Your browser recomputes each number from the NASA data, so the downloads match what you see.</Text>
        </VStack>
        {rows && receipt ? (
          <>
            {narrow ? (
              <VStack gap={4}>
                {rows.map(r => (
                  <Card key={r.id} variant="muted" padding={4}>
                    <VStack gap={2}>
                      <HStack gap={2} vAlign="center" wrap="wrap">
                        <Text weight="semibold">{r.variable}</Text>
                        <Text weight="semibold">{r.verdict}</Text>
                      </HStack>
                      <Text hasTabularNumbers>{`${signed(r.slope, r.digits)} ${r.unit} per decade [${signed(r.low, r.digits)}, ${signed(r.high, r.digits)}], p ${pValue(r.p).startsWith('<') ? pValue(r.p) : `= ${pValue(r.p)}`}`}</Text>
                      <Text type="supporting">{`Independent record: ${r.witness}. ${r.shape}. Land significant up / down: ${percent(r.areaUp)} / ${percent(r.areaDown)}.`}</Text>
                    </VStack>
                  </Card>
                ))}
              </VStack>
            ) : (
              <Table data={rows} columns={columns} idKey="id" density="balanced" />
            )}
            <HStack gap={2} wrap="wrap">
              <Button
                label="Download CSV"
                variant="primary"
                onClick={() =>
                  download(
                    `trace-brief-${iso3}.csv`,
                    toCsv([
                      ['nation', 'iso3', 'variable', 'variable_label', 'unit', 'trend_per_decade', 'low95', 'high95', 'p_corrected', 'share_of_land_significant_up', 'share_of_land_significant_down', 'ramp_or_jump', 'change_point_clue_year', 'independent_record', 'verdict'],
                      ...rows.map(r => [receipt.nation, iso3, r.id, r.variable, `${r.unit} per decade`, round(r.slope), round(r.low), round(r.high), round(r.p), round(r.areaUp), round(r.areaDown), r.integrity, r.changePoint, r.witness, r.verdict]),
                      [],
                      ['source', receipt.source],
                      ['retrieved', receipt.retrieved],
                      ['grid', receipt.grid],
                      ['baseline', `${BASELINE[0]}-${BASELINE[1]}`],
                    ]),
                    'text/csv',
                  )
                }
              />
              <Button
                label="Download JSON"
                variant="secondary"
                onClick={() => download(`trace-brief-${iso3}.json`, JSON.stringify({...receipt, variables: rows.map(r => ({variable: r.id, label: r.variable, unit: `${r.unit} per decade`, trend: round(r.slope), low95: round(r.low), high95: round(r.high), pCorrected: round(r.p), areaUp: round(r.areaUp), areaDown: round(r.areaDown), rampOrJump: r.integrity, changePointClue: r.changePoint, independentRecord: r.witness, verdict: r.verdict}))}, null, 2), 'application/json')}
              />
              <Button
                label={copied ? 'Link copied' : 'Copy link to this brief'}
                variant="secondary"
                onClick={async () => {
                  if (await copyText(window.location.href)) {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }
                }}
              />
              <Button label="Open the atlas" variant="ghost" href={atlasHref(iso3)} />
            </HStack>
            <Text type="supporting">“Land up / down” is the share of the nation’s land with a significant trend in each direction, after the map-wide false-discovery check.</Text>
            <MetadataList columns={2}>
              <MetadataListItem label="Source">{receipt.source}</MetadataListItem>
              <MetadataListItem label="Retrieved">{receipt.retrieved}</MetadataListItem>
              <MetadataListItem label="Grid">{`${receipt.grid} (${receipt.cells} cells)`}</MetadataListItem>
              <MetadataListItem label="Baseline">{`${BASELINE[0]}–${BASELINE[1]} normal (World Meteorological Organization standard period)`}</MetadataListItem>
              <MetadataListItem label="Method">{receipt.method}</MetadataListItem>
              <MetadataListItem label="Limitations">{receipt.limitations.join(' ')}</MetadataListItem>
            </MetadataList>
            <Text type="supporting">Rainfall: {LIMITATION.PRECTOTCORR} Soil moisture: {LIMITATION.GWETROOT}</Text>
          </>
        ) : (
          <HStack gap={2} vAlign="center">
            <Spinner size="sm" />
            <Text color="secondary">Running seven variables through the tests…</Text>
          </HStack>
        )}
      </VStack>
    </LayoutContent>
  );
}

/** Four significant figures: enough for any downstream use, readable in a spreadsheet. */
const round = (v: number) => (Number.isFinite(v) ? Number(v.toPrecision(4)) : null);
