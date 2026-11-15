import {useMemo, useRef, useState} from 'react';
import {AppShell} from '@astryxdesign/core/AppShell';
import {Button} from '@astryxdesign/core/Button';
import {Divider} from '@astryxdesign/core/Divider';
import {Grid} from '@astryxdesign/core/Grid';
import {Layout, LayoutContent} from '@astryxdesign/core/Layout';
import {SegmentedControl, SegmentedControlItem} from '@astryxdesign/core/SegmentedControl';
import {Section} from '@astryxdesign/core/Section';
import {Heading, Text} from '@astryxdesign/core/Text';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {
  getFallbackSeries,
  getRegion,
  REGIONS,
  SOURCE_REGISTRY,
  VARIABLE_DEFINITIONS,
  VARIABLE_IDS,
  type MonthlyObservation,
  type RegionId,
  type VariableId,
} from '../data/trends';
import {TrendChart} from '../features/TrendChart';
import {AtlasHero} from '../features/AtlasHero';
import {EvidenceReadout} from '../features/EvidenceReadout';
import {fetchPowerSeries, type PowerSeries} from '../lib/nasaPower';
import {analyzeTrend, getAnnualSeries, getBaselineMean} from '../lib/trendAnalysis';

function Navigation() {
  return (
    <HStack as="nav" aria-label="Bilad sections" paddingInline={6} paddingBlock={2} hAlign="between" vAlign="center" wrap="wrap"
      style={{borderBottom: '1px solid var(--color-border)', background: 'var(--color-background-body)'}}>
      <Text style={{fontWeight: 800, letterSpacing: '0.2em'}}>BILAD <Text color="accent" type="supporting">/ EARTH SYSTEM LAB</Text></Text>
      <HStack gap={1} wrap="wrap">
        <Button label="Explore" variant="ghost" href="#explore" size="sm" />
        <Button label="Method" variant="ghost" href="#method" size="sm" />
        <Button label="NASA challenge" variant="secondary" href={SOURCE_REGISTRY.challenge.url} size="sm" />
      </HStack>
    </HStack>
  );
}

function formatNumber(value: number, digits = 2): string {
  return value.toFixed(digits);
}

export default function App() {
  const [variableId, setVariableId] = useState<VariableId>('temperature');
  const [regionId, setRegionId] = useState<RegionId>('atacama');
  const [comparedRegionId, setComparedRegionId] = useState<RegionId | null>('arctic');
  const [series, setSeries] = useState<MonthlyObservation[]>(() => getFallbackSeries('atacama', 'temperature'));
  const [comparedSeries, setComparedSeries] = useState<MonthlyObservation[]>(() => getFallbackSeries('arctic', 'temperature'));
  const [sourceLabel, setSourceLabel] = useState('Deterministic demo fallback');
  const [comparedSourceLabel, setComparedSourceLabel] = useState('Deterministic demo fallback');
  const [sourceDetails, setSourceDetails] = useState<Pick<PowerSeries, 'sources' | 'requestUrl'> | null>(null);
  const [comparedSourceDetails, setComparedSourceDetails] = useState<Pick<PowerSeries, 'sources' | 'requestUrl'> | null>(null);
  const [chartMode, setChartMode] = useState<'anomaly' | 'absolute'>('anomaly');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const requestVersion = useRef(0);

  const variable = VARIABLE_DEFINITIONS[variableId];
  const region = getRegion(regionId);
  const result = useMemo(() => analyzeTrend(series), [series]);
  const comparedResult = useMemo(() => comparedRegionId ? analyzeTrend(comparedSeries) : null, [comparedRegionId, comparedSeries]);
  const comparedRegion = comparedRegionId ? getRegion(comparedRegionId) : null;
  const hasReference = getBaselineMean(getAnnualSeries(series)) !== null &&
    (!comparedRegion || getBaselineMean(getAnnualSeries(comparedSeries)) !== null);
  const effectiveChartMode = chartMode === 'anomaly' && hasReference ? 'anomaly' : 'absolute';
  const hasMixedSources = Boolean(comparedRegion && sourceLabel !== comparedSourceLabel);

  const selectVariable = (value: string) => {
    const nextVariable = value as VariableId;
    requestVersion.current += 1;
    setVariableId(nextVariable);
    setSeries(getFallbackSeries(regionId, nextVariable));
    if (comparedRegionId) setComparedSeries(getFallbackSeries(comparedRegionId, nextVariable));
    setSourceLabel('Deterministic demo fallback');
    setComparedSourceLabel('Deterministic demo fallback');
    setSourceDetails(null);
    setComparedSourceDetails(null);
    setLoadError(null);
    setIsLoading(false);
  };

  const selectRegion = (nextRegion: RegionId) => {
    if (nextRegion === regionId) return;
    requestVersion.current += 1;
    setRegionId(nextRegion);
    setSeries(getFallbackSeries(nextRegion, variableId));
    if (nextRegion === comparedRegionId) setComparedRegionId(null);
    else if (comparedRegionId) setComparedSeries(getFallbackSeries(comparedRegionId, variableId));
    setSourceLabel('Deterministic demo fallback');
    setComparedSourceLabel('Deterministic demo fallback');
    setSourceDetails(null);
    setComparedSourceDetails(null);
    setLoadError(null);
    setIsLoading(false);
  };

  const selectComparison = (value: string) => {
    requestVersion.current += 1;
    const nextRegion = value === 'none' ? null : value as RegionId;
    setComparedRegionId(nextRegion);
    if (nextRegion) setComparedSeries(getFallbackSeries(nextRegion, variableId));
    setComparedSourceLabel('Deterministic demo fallback');
    setComparedSourceDetails(null);
    setLoadError(null);
    setIsLoading(false);
  };

  const loadLiveData = async () => {
    const requestVersionAtStart = ++requestVersion.current;
    setIsLoading(true);
    setLoadError(null);

    let pending = comparedRegion ? 2 : 1;
    const finish = () => {
      pending -= 1;
      if (pending === 0 && requestVersionAtStart === requestVersion.current) setIsLoading(false);
    };
    const primaryRequest = fetchPowerSeries(region, variable).then(
      live => {
        if (requestVersionAtStart !== requestVersion.current) return;
        setSeries(live.observations);
        setSourceLabel('NASA POWER live');
        setSourceDetails({sources: live.sources, requestUrl: live.requestUrl});
      },
      () => {
        if (requestVersionAtStart !== requestVersion.current) return;
        setSeries(getFallbackSeries(regionId, variableId));
        setSourceLabel('Deterministic demo fallback');
        setSourceDetails(null);
        setLoadError('One or more live requests were unavailable. The affected location uses labeled demo data.');
      },
    ).finally(finish);
    const comparisonRequest = comparedRegion ? fetchPowerSeries(comparedRegion, variable).then(
      live => {
        if (requestVersionAtStart !== requestVersion.current) return;
        setComparedSeries(live.observations);
        setComparedSourceLabel('NASA POWER live');
        setComparedSourceDetails({sources: live.sources, requestUrl: live.requestUrl});
      },
      () => {
        if (requestVersionAtStart !== requestVersion.current) return;
        setComparedSeries(getFallbackSeries(comparedRegion.id, variableId));
        setComparedSourceLabel('Deterministic demo fallback');
        setComparedSourceDetails(null);
        setLoadError('One or more live requests were unavailable. The affected location uses labeled demo data.');
      },
    ).finally(finish) : Promise.resolve();
    await Promise.all([primaryRequest, comparisonRequest]);
  };

  const useDemoData = () => {
    requestVersion.current += 1;
    setSeries(getFallbackSeries(regionId, variableId));
    if (comparedRegionId) setComparedSeries(getFallbackSeries(comparedRegionId, variableId));
    setSourceLabel('Deterministic demo fallback');
    setComparedSourceLabel('Deterministic demo fallback');
    setSourceDetails(null);
    setComparedSourceDetails(null);
    setLoadError(null);
    setIsLoading(false);
  };

  return (
    <AppShell contentPadding={0} height="auto" topNav={<Navigation />} variant="surface">
      <AtlasHero primaryId={regionId} comparisonId={comparedRegionId} />
      <Layout
        height="auto"
        content={
          <LayoutContent padding={8}>
            <VStack gap={8}>
              <VStack gap={6} id="explore" style={{scrollMarginTop: 'calc(var(--spacing-10) + var(--spacing-6))'}}>
                <Text type="supporting" color="accent" style={{letterSpacing: '0.2em'}}>01 / INVESTIGATION DESK</Text>
                <Grid columns={{minWidth: 300, max: 2}} gap={8}>
                  <VStack gap={3}>
                    <Heading level={2} type="display-2">Build a question.</Heading>
                    <Text type="large" color="secondary">
                      Pick what to measure, then choose two places. The same window and unit keep the comparison honest.
                    </Text>
                  </VStack>
                  <Section variant="muted" padding={6}>
                    <VStack gap={4}>
                      <Text type="supporting" color="accent">VARIABLE / {variable.parameter}</Text>
                      <SegmentedControl label="Earth science variable" value={variableId} onChange={selectVariable} layout="fill">
                        {VARIABLE_IDS.map(id => (
                          <SegmentedControlItem key={id} value={id} label={VARIABLE_DEFINITIONS[id].shortLabel} />
                        ))}
                      </SegmentedControl>
                      <Heading level={3}>{variable.label}</Heading>
                      <Text>{variable.description}</Text>
                      <Text type="supporting" color="secondary">{variable.unit} · {variable.interpretation}</Text>
                    </VStack>
                  </Section>
                </Grid>
              </VStack>

              <VStack gap={4} id="regions" style={{scrollMarginTop: 'calc(var(--spacing-10) + var(--spacing-6))'}}>
                <HStack gap={4} hAlign="between" wrap="wrap">
                  <VStack gap={2}>
                    <Text type="supporting" color="accent" style={{letterSpacing: '0.2em'}}>02 / FIELD INDEX</Text>
                    <Heading level={2}>Choose the first sample point.</Heading>
                  </VStack>
                  <VStack gap={1}>
                    <label htmlFor="comparison-region"><Text type="supporting">Comparison region</Text></label>
                    <select
                      id="comparison-region"
                      value={comparedRegionId ?? 'none'}
                      onChange={event => selectComparison(event.target.value)}
                      style={{
                        color: 'var(--color-text-primary)',
                        background: 'var(--color-background-card)',
                        border: '1px solid var(--color-border-emphasized)',
                        borderRadius: 'var(--radius-element)',
                        padding: 'var(--spacing-2) var(--spacing-3)',
                        minHeight: 'var(--size-element-md)',
                        font: 'inherit',
                        maxWidth: '100%',
                      }}>
                      <option value="none">No comparison</option>
                      {REGIONS.filter(item => item.id !== regionId).map(item => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </select>
                  </VStack>
                </HStack>
                <Text color="secondary">A named region is a way to locate the question. Each result is one coordinate, not a regional average.</Text>
                <Divider />
                {REGIONS.map((item, index) => (
                  <VStack gap={3} key={item.id}>
                    <HStack gap={4} hAlign="between" vAlign="center" wrap="wrap">
                      <Text type="supporting" color="accent">{String(index + 1).padStart(2, '0')}</Text>
                      <VStack gap={1} style={{flex: 1, minWidth: '16rem'}}>
                        <Heading level={3}>{item.name}</Heading>
                        <Text color="secondary">{item.subtitle} · {item.description}</Text>
                      </VStack>
                      <Text type="supporting" color="secondary">{item.latitude.toFixed(1)}°, {item.longitude.toFixed(1)}°</Text>
                      <Button
                        label={item.id === regionId ? 'Selected region' : `Inspect ${item.name}`}
                        variant={item.id === regionId ? 'primary' : 'ghost'}
                        onClick={() => selectRegion(item.id)}
                      />
                    </HStack>
                    <Divider />
                  </VStack>
                ))}
              </VStack>

              <VStack gap={5} id="analysis" style={{scrollMarginTop: 'calc(var(--spacing-10) + var(--spacing-6))'}}>
                <VStack gap={2}>
                  <Text type="supporting" color="accent" style={{letterSpacing: '0.2em'}}>03 / EVIDENCE ROOM</Text>
                  <Heading level={2} type="display-2">Read the evidence.</Heading>
                  <Text type="large" color="secondary">
                    {variable.label} · selected 2000–2024 window · shared {variable.unit} scale
                  </Text>
                </VStack>
                <HStack gap={4} hAlign="between" vAlign="center" wrap="wrap">
                  <Text type="supporting" color="accent">VIEW / {hasMixedSources ? 'MIXED SOURCES' : sourceLabel.includes('demo') ? 'DEMO' : 'NASA POWER'} / {effectiveChartMode === 'anomaly' ? 'CHANGE FROM REFERENCE' : 'ABSOLUTE LEVEL'}</Text>
                  <SegmentedControl label="Chart scale" value={effectiveChartMode} onChange={value => setChartMode(value as 'anomaly' | 'absolute')}>
                    <SegmentedControlItem value="anomaly" label="Change from baseline" isDisabled={!hasReference} />
                    <SegmentedControlItem value="absolute" label="Absolute values" />
                  </SegmentedControl>
                </HStack>
                <Section variant="muted" padding={6}>
                  <VStack gap={4}>
                    <TrendChart
                      observations={series}
                      result={result}
                      unit={variable.unit}
                      label={variable.label}
                      mode={chartMode}
                      regionName={region.name}
                      source={sourceLabel}
                      comparison={comparedRegion && comparedResult ? {
                        observations: comparedSeries,
                        result: comparedResult,
                        regionName: comparedRegion.name,
                        source: comparedSourceLabel,
                      } : undefined}
                    />
                    <HStack gap={2} wrap="wrap">
                      <Button
                        label={isLoading ? 'Loading NASA POWER…' : 'Load NASA POWER data'}
                        variant="primary"
                        onClick={loadLiveData}
                        isDisabled={isLoading}
                      />
                      <Button label="Use demo data" variant="secondary" onClick={useDemoData} />
                    </HStack>
                    {loadError && <Text type="supporting" color="secondary" role="status">{loadError}</Text>}
                    <Text type="supporting" color="secondary">
                      Bilad opens with synthetic demo data. Load NASA POWER to analyze the selected sample points.
                    </Text>
                  </VStack>
                </Section>
                <Grid columns={{minWidth: 320, max: 2}} gap={6}>
                  <EvidenceReadout region={region} variable={variable} result={result} source={sourceLabel} details={sourceDetails} primary />
                  {comparedRegion && comparedResult && (
                    <EvidenceReadout region={comparedRegion} variable={variable} result={comparedResult} source={comparedSourceLabel} details={comparedSourceDetails} primary={false} />
                  )}
                </Grid>
                <Text type="supporting" color="secondary">Each readout shows the usable span and complete years. A slope and significance screen describe a pattern. Explaining its cause requires more evidence.</Text>
              </VStack>

              <VStack gap={5} id="method" style={{scrollMarginTop: 'calc(var(--spacing-10) + var(--spacing-6))'}}>
                <Text type="supporting" color="accent" style={{letterSpacing: '0.2em'}}>04 / METHOD & SOURCES</Text>
                <Heading level={2} type="display-2">A trend is a clue, not a cause.</Heading>
                <Grid columns={{minWidth: 300, max: 2}} gap={8}>
                  <VStack gap={3}>
                    <Heading level={3}>How the signal is screened</Heading>
                    <Text color="secondary">
                      Bilad fits a straight line to monthly values from complete 12-month years to estimate change per year. The chart shows those annual means, or each location’s change from its 2000–2004 annual mean when all five reference years exist. That short reference is a visual baseline, not a climate normal. A Mann–Kendall screen runs on annual means to reduce seasonal interference.
                    </Text>
                    <Text color="secondary">
                      The fitted slope interval is approximate and assumes independent monthly residuals. Climate series can violate that assumption; the interval and annual significance screen can disagree. Treat both as prompts for deeper analysis.
                    </Text>
                  </VStack>
                  <VStack gap={3}>
                    <Heading level={3}>What this point represents</Heading>
                    <Text color="secondary">
                      This investigation requests NASA POWER {variable.parameter} at {formatNumber(region.latitude, 1)}° latitude, {formatNumber(region.longitude, 1)}° longitude. A point is not a regional average. Bilad does not attribute causes or make forecasts.
                    </Text>
                    <Text color="secondary">
                      Demo values are synthetic and deterministic. Live values come from NASA POWER when the public endpoint responds. Check the source label on each region before interpreting a comparison.
                    </Text>
                    {variableId === 'solar' && <Text color="secondary">NASA POWER supplies solar values in MJ/m²/day; Bilad converts them to kWh/m²/day. The solar source changes from SRB to SYN1DEG at January 2001, within the visual reference period. Inspect the source products and exact request under each live result.</Text>}
                  </VStack>
                </Grid>
                <Divider />
                <HStack gap={2} wrap="wrap">
                  <Button label="Challenge statement" variant="secondary" href={SOURCE_REGISTRY.challenge.url} />
                  <Button label="NASA POWER API" variant="secondary" href={SOURCE_REGISTRY.powerApi.url} />
                  <Button label="NASA Earthdata" variant="ghost" href={SOURCE_REGISTRY.earthdata.url} />
                </HStack>
              </VStack>

              <Section variant="muted" padding={8}>
                <VStack gap={5} id="example" style={{scrollMarginTop: 'calc(var(--spacing-10) + var(--spacing-6))'}}>
                  <Text type="supporting" color="accent" style={{letterSpacing: '0.2em'}}>THREE-MINUTE FIELD GUIDE</Text>
                  <Heading level={2} type="display-2">From a question to a qualified finding.</Heading>
                  <Grid columns={{minWidth: 240, max: 3}} gap={6}>
                    <VStack gap={2}>
                      <Text color="accent">01 / FRAME</Text>
                      <Text>Start with surface temperature in the Atacama and Canadian Arctic. Both use the same 25-year window.</Text>
                    </VStack>
                    <VStack gap={2}>
                      <Text color="accent">02 / VERIFY</Text>
                      <Text>Load NASA POWER. Check each source label, then read the annual traces, slopes, and p-values.</Text>
                    </VStack>
                    <VStack gap={2}>
                      <Text color="accent">03 / QUALIFY</Text>
                      <Text>Explain the point-sample limit and why a detected pattern cannot reveal its cause.</Text>
                    </VStack>
                  </Grid>
                  <Button label="Return to the evidence" variant="primary" href="#analysis" />
                </VStack>
              </Section>
            </VStack>
          </LayoutContent>
        }
      />
    </AppShell>
  );
}
