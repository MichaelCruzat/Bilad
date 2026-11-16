import {useMemo, type ReactNode} from 'react';
import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {Divider} from '@astryxdesign/core/Divider';
import {LayoutContent} from '@astryxdesign/core/Layout';
import {Link} from '@astryxdesign/core/Link';
import {Selector} from '@astryxdesign/core/Selector';
import {SegmentedControl, SegmentedControlItem} from '@astryxdesign/core/SegmentedControl';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {Heading, Text} from '@astryxdesign/core/Text';
import {MotionStack} from '../features/MotionStack';
import {VerdictStrip} from '../features/VerdictStrip';
import {useAtlasParamsAt} from '../app/router';
import {useAsync} from '../lib/hooks';
import {aggregateGlobal, aggregateGlobalWitness} from '../lib/globalEvidence';
import {loadCountries, loadGlobalAnnual, loadGlobalCells, loadGlobalMeta, loadGlobalStats, loadGlobalWitness} from '../lib/globalData';
import {crossExamine} from '../lib/evidence';
import {analyzeSeries, pairwiseSlopes} from '../lib/stats';
import {percent, pPhrase, signed, thousands, lat, lon} from '../lib/format';
import {SeriesChart} from '../viz/SeriesChart';

/** The same annual grid, footprint, and witness aggregation as the global explorer. */
export function GlobalProof({params}: {params: URLSearchParams}) {
  const variable = params.get('v') === 'PRECTOTCORR' ? 'PRECTOTCORR' : 'T2M';
  const set = useAtlasParamsAt('#/proof', params);
  const data = useAsync(async () => {
    const [meta, cells, stats, annual, witness, countries] = await Promise.all([
      loadGlobalMeta(), loadGlobalCells(), loadGlobalStats(variable),
      loadGlobalAnnual(variable), loadGlobalWitness(variable), loadCountries(),
    ]);
    return {meta, cells, stats, annual, witness, countries};
  }, [variable]);
  const country = params.get('country');
  const cell = params.has('cell') ? Number(params.get('cell')) : null;
  const selection = useMemo(() => {
    if (data.status !== 'ready') return null;
    const {meta, cells, stats, annual, witness, countries} = data.data;
    const has = new Set(cells.country);
    const countryIndex = country === null ? -1 : countries.findIndex((c, i) => c.id === country && has.has(i));
    const ids = cell !== null
      ? Number.isInteger(cell) && cell >= 0 && cell < cells.n ? [cell] : []
      : Array.from({length: cells.n}, (_, c) => c).filter(c => country === null || cells.country[c] === countryIndex);
    if (!ids.length) return null;
    const years = Array.from({length: stats.years}, (_, i) => meta.grid.firstYear + i);
    const relative = variable === 'PRECTOTCORR';
    const series = aggregateGlobal(cells, stats, annual, ids, relative);
    const other = aggregateGlobalWitness(cells, witness, ids, stats.years, years[0], relative);
    const exam = crossExamine(years, series, other);
    const result = analyzeSeries(years, series);
    const area = ids.reduce((sum, c) => sum + cells.area[c], 0);
    const significant = ids.reduce((sum, c) => sum + ((stats.flags[c] & 1) ? cells.area[c] : 0), 0) / area;
    const name = cell !== null ? `Cell at ${lat(cells.lat[cell])}, ${lon(cells.lon[cell])}` : countryIndex >= 0 ? countries[countryIndex].name : 'All covered land';
    return {ids, years, series, exam, result, area, significant, name};
  }, [data, country, cell, variable]);
  const options = useMemo(() => {
    if (data.status !== 'ready') return [];
    const has = new Set(data.data.cells.country);
    const seen = new Set<string>();
    return data.data.countries.flatMap((c, i) => {
      if (!has.has(i) || seen.has(c.id)) return [];
      seen.add(c.id);
      return [{value: c.id, label: c.name}];
    }).sort((a, b) => a.label.localeCompare(b.label));
  }, [data]);
  const relative = variable === 'PRECTOTCORR';
  const unit = relative ? '% of normal' : '°C';
  const explorer = new URLSearchParams({v: variable});
  if (cell !== null) explorer.set('cell', String(cell));
  else if (country !== null) explorer.set('country', country);

  return <LayoutContent padding={8}><VStack gap={8}>
    <MotionStack gap={3}>
      <Text type="label" color="accent">How we know · global evidence</Text>
      <Heading level={1} type="display-2">From a global record to a local verdict</Heading>
      <Text type="large" color="secondary">Follow the calculation for all covered land, any country, or a linked grid cell. These are the same annual data and tests used in Explore.</Text>
    </MotionStack>
    <HStack gap={4} wrap="wrap">
      <Selector label="Area to examine" hasSearch hasClear value={cell !== null ? null : country ?? 'all'} placeholder={cell !== null ? 'Linked grid cell' : 'All covered land'} options={[{value: 'all', label: 'All covered land'}, ...options]} onChange={v => set({country: !v || v === 'all' ? null : v, cell: null})} />
      <SegmentedControl label="Variable" value={variable} onChange={v => set({v})}><SegmentedControlItem value="T2M" label="Temperature" /><SegmentedControlItem value="PRECTOTCORR" label="Rainfall" /></SegmentedControl>
    </HStack>
    {data.status === 'error' ? <Banner status="error" title="Could not load the global walkthrough" description={data.error.message} endContent={<Button label="Retry" onClick={data.retry} />} />
      : data.status !== 'ready' ? <Text>Loading the global record and witness…</Text>
      : !selection ? <Banner status="warning" title="This selection has no covered land cells" endContent={<Button label="Examine all covered land" href="#/proof" />} />
      : <VStack gap={8}>
        <Heading level={2}>{selection.name}</Heading>
        <GlobalStep n="01" title="Set the footprint">
          <Text>{selection.ids.length.toLocaleString('en-US')} native cells, {thousands(selection.area)} km² of land. The grid spans 60°S–84°N; ocean and Antarctica are outside this land analysis. Country choices use the same worldwide grid.</Text>
          <Text type="supporting">Source: {data.data.meta.provenance.api}; retrieved {data.data.meta.provenance.retrieved}. Resolution: 0.5° × 0.625°.</Text>
        </GlobalStep>
        <GlobalStep n="02" title="Compare years on a common baseline">
          <Text>Monthly inputs were processed into annual departures from 1991–2020 before shipping. At least ten months are needed for a valid annual value. This page averages those annual cells by land area{relative ? ' and rainfall normal, yielding total rainfall anomaly divided by total normal' : ''}; it does not download or recompute the raw monthly global tiles.</Text>
          <SeriesChart years={selection.years} series={selection.series} analysis={selection.result} variable={variable} unit={relative ? '%' : unit} title={`${selection.name}, annual ${relative ? 'rainfall' : 'temperature'} anomaly`} />
        </GlobalStep>
        <GlobalStep n="03" title="Estimate the trend">
          <Text>Theil–Sen takes the median of {pairwiseSlopes(selection.years, selection.series).length.toLocaleString('en-US')} valid pairwise slopes. For this selection: {signed(selection.result.trend.slope * 10, relative ? 1 : 2)} {unit} per decade, with a 95% range from {signed(selection.result.trend.slopeLow * 10, relative ? 1 : 2)} to {signed(selection.result.trend.slopeHigh * 10, relative ? 1 : 2)}.</Text>
        </GlobalStep>
        <GlobalStep n="04" title="Test the trend, then check the map">
          <Text>Mann–Kendall, corrected for runs of similar years: {pPhrase(selection.result.trend.p)}. Variance inflation: {selection.result.trend.inflation.toFixed(2)}. Separately, {percent(selection.significant)} of the selected land has cell trends selected by the worldwide Benjamini–Hochberg procedure at a 10% target false discovery rate.</Text>
          <Text type="supporting">The worldwide map correction is not a new test of this area-average series. FDR describes an expected fraction under assumptions, not a guaranteed error cap in this map.</Text>
        </GlobalStep>
        <GlobalStep n="05" title="Look for a jump">
          <Text>{selection.exam.claimStep?.stepDominated ? `The integrity screen prefers a step near ${selection.exam.claimStep.breakAt}.` : 'The integrity screen does not flag this aggregate as step-dominated.'} This compares a step and a linear trend using BIC. A missing flag does not establish gradual change, and a detected step does not identify its cause.</Text>
        </GlobalStep>
        <GlobalStep n="06" title="Call the witness">
          <Text>{relative ? 'GPCP v2.3 combines gauges and satellites. It is partly independent: some gauge inputs are shared with MERRA-2.' : 'GISTEMP v4 uses weather-station estimates on a coarser 2° grid.'} The witness is sampled over the selected footprint and weighted by the same land areas. A yearly aggregate requires coverage of at least half that area. This comparison cannot resolve detail finer than the witness grid.</Text>
        </GlobalStep>
        <GlobalStep n="07" title="Read the result and its limits">
          <VerdictStrip place={selection.name} variable={variable} window={{from: selection.years[0], to: selection.years.at(-1)!}} result={selection.result} unit={unit} witness={selection.exam.witness.n >= 10 ? {kind: 'available', exam: selection.exam} : {kind: 'no-coverage'}} step={selection.exam.claimStep} resolution={`${selection.ids.length.toLocaleString('en-US')} cells, land-area weighted`} limitation="The records are estimates. Agreement supports a trend; disagreement and jump flags require investigation. This is not causal attribution." next={{label: 'Explore this footprint', href: `#/world?${explorer}`}} />
        </GlobalStep>
        <Divider />
        <Text type="supporting">Software checks: a separate Python implementation validates all 49 supplemental nation-variable headlines. When the global monthly cache exists, it also checks a repeatable sample of up to 400 global cells per variable; a clean CI checkout skips that sample. These checks test implementation agreement, not observational truth. <Link href="https://github.com/MichaelCruzat/TRACE/blob/main/pipeline/validate.py">Read the validator</Link>.</Text>
      </VStack>}
  </VStack></LayoutContent>;
}

function GlobalStep({n, title, children}: {n: string; title: string; children: ReactNode}) {
  return <MotionStack reveal gap={4}><Divider /><HStack gap={4} vAlign="start"><Text type="display-3" color="accent">{n}</Text><VStack gap={3}><Heading level={2}>{title}</Heading>{children}</VStack></HStack></MotionStack>;
}
