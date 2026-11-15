import {useMemo, useRef, useState} from 'react';
import {AppShell} from '@astryxdesign/core/AppShell';
import {Badge} from '@astryxdesign/core/Badge';
import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {Divider} from '@astryxdesign/core/Divider';
import {Grid} from '@astryxdesign/core/Grid';
import {Layout, LayoutContent} from '@astryxdesign/core/Layout';
import {SegmentedControl, SegmentedControlItem} from '@astryxdesign/core/SegmentedControl';
import {Selector} from '@astryxdesign/core/Selector';
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
import {fetchPowerSeries} from '../lib/nasaPower';
import {analyzeTrend} from '../lib/trendAnalysis';

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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const requestVersion = useRef(0);

  const variable = VARIABLE_DEFINITIONS[variableId];
  const region = getRegion(regionId);
  const result = useMemo(() => analyzeTrend(series), [series]);
  const comparedResult = useMemo(() => comparedRegionId ? analyzeTrend(comparedSeries) : null, [comparedRegionId, comparedSeries]);
  const comparedRegion = comparedRegionId ? getRegion(comparedRegionId) : null;

  const selectVariable = (value: string) => {
    const nextVariable = value as VariableId;
    requestVersion.current += 1;
    setVariableId(nextVariable);
    setSeries(getFallbackSeries(regionId, nextVariable));
    if (comparedRegionId) setComparedSeries(getFallbackSeries(comparedRegionId, nextVariable));
    setSourceLabel('Deterministic demo fallback');
    setComparedSourceLabel('Deterministic demo fallback');
    setLoadError(null);
    setIsLoading(false);
  };

  const selectRegion = (nextRegion: RegionId) => {
    requestVersion.current += 1;
    setRegionId(nextRegion);
    setSeries(getFallbackSeries(nextRegion, variableId));
    if (nextRegion === comparedRegionId) setComparedRegionId(null);
    else if (comparedRegionId) setComparedSeries(getFallbackSeries(comparedRegionId, variableId));
    setSourceLabel('Deterministic demo fallback');
    setComparedSourceLabel('Deterministic demo fallback');
    setLoadError(null);
    setIsLoading(false);
  };

  const selectComparison = (value: string) => {
    requestVersion.current += 1;
    const nextRegion = value === 'none' ? null : value as RegionId;
    setComparedRegionId(nextRegion);
    if (nextRegion) setComparedSeries(getFallbackSeries(nextRegion, variableId));
    setComparedSourceLabel('Deterministic demo fallback');
    setLoadError(null);
    setIsLoading(false);
  };

  const loadLiveData = async () => {
    const requestVersionAtStart = ++requestVersion.current;
    setIsLoading(true);
    setLoadError(null);

    try {
      const [primaryRequest, comparisonRequest] = await Promise.allSettled([
        fetchPowerSeries(region, variable),
        comparedRegion ? fetchPowerSeries(comparedRegion, variable) : Promise.resolve(null),
      ]);
      if (requestVersionAtStart !== requestVersion.current) return;
      if (primaryRequest.status === 'fulfilled') {
        setSeries(primaryRequest.value);
        setSourceLabel('NASA POWER live');
      } else {
        setSeries(getFallbackSeries(regionId, variableId));
        setSourceLabel('Deterministic demo fallback');
      }
      if (comparedRegion) {
        if (comparisonRequest.status === 'fulfilled' && comparisonRequest.value) {
          setComparedSeries(comparisonRequest.value);
          setComparedSourceLabel('NASA POWER live');
        } else {
          setComparedSeries(getFallbackSeries(comparedRegion.id, variableId));
          setComparedSourceLabel('Deterministic demo fallback');
        }
      }
      if (primaryRequest.status === 'rejected' || comparisonRequest.status === 'rejected') {
        setLoadError('One or more live requests were unavailable. The affected location uses labeled demo data.');
      }
    } catch (error) {
      if (requestVersionAtStart !== requestVersion.current) return;
      setSeries(getFallbackSeries(regionId, variableId));
      setSourceLabel('Deterministic demo fallback');
      setLoadError(error instanceof Error ? error.message : 'NASA POWER could not be reached.');
    } finally {
      if (requestVersionAtStart === requestVersion.current) setIsLoading(false);
    }
  };

  const useDemoData = () => {
    requestVersion.current += 1;
    setSeries(getFallbackSeries(regionId, variableId));
    if (comparedRegionId) setComparedSeries(getFallbackSeries(comparedRegionId, variableId));
    setSourceLabel('Deterministic demo fallback');
    setComparedSourceLabel('Deterministic demo fallback');
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
              <VStack gap={6} id="explore">
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

              <VStack gap={4} id="regions">
                <HStack gap={4} hAlign="between" wrap="wrap">
                  <VStack gap={2}>
                    <Text type="supporting" color="accent" style={{letterSpacing: '0.2em'}}>02 / FIELD INDEX</Text>
                    <Heading level={2}>Choose the first sample point.</Heading>
                  </VStack>
                  <Selector
                    label="Comparison region"
                    value={comparedRegionId ?? 'none'}
                    onChange={selectComparison}
                    options={[
                      {value: 'none', label: 'No comparison'},
                      ...REGIONS.filter(item => item.id !== regionId).map(item => ({value: item.id, label: item.name})),
                    ]}
                    presentation="adaptive"
                  />
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

              <VStack gap={5} id="analysis">
                <VStack gap={2}>
                  <Text type="supporting" color="accent" style={{letterSpacing: '0.2em'}}>03 / EVIDENCE ROOM</Text>
                  <Heading level={2} type="display-2">Read the evidence.</Heading>
                  <Text type="large" color="secondary">
                    {variable.label} · {result.startDate} to {result.endDate} · shared {variable.unit} scale
                  </Text>
                </VStack>
                <Section variant="muted" padding={6}>
                  <VStack gap={4}>
                    <TrendChart
                      observations={series}
                      result={result}
                      unit={variable.unit}
                      label={variable.label}
                      regionName={region.name}
                      comparison={comparedRegion && comparedResult ? {
                        observations: comparedSeries,
                        result: comparedResult,
                        regionName: comparedRegion.name,
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
                      The initial series is synthetic demo data. Select “Load NASA POWER data” to request the public monthly endpoint. Live and demo sources are labeled separately below.
                    </Text>
                  </VStack>
                </Section>
                <Grid columns={{minWidth: 320, max: 2}} gap={6}>
                  <EvidenceReadout region={region} variable={variable} result={result} source={sourceLabel} primary />
                  {comparedRegion && comparedResult && (
                    <EvidenceReadout region={comparedRegion} variable={variable} result={comparedResult} source={comparedSourceLabel} primary={false} />
                  )}
                </Grid>
                <Text type="supporting" color="secondary">Point-based screening results on a common 2000–2024 window. Neither a different slope nor a significant screen identifies a cause.</Text>
              </VStack>

              <Card variant="muted" id="method">
                <VStack gap={3}>
                  <Heading level={2}>The detective’s method</Heading>
                  <Text>
                    Bilad fits a straight line to the monthly series to estimate change per year, then uses an approximate 95% confidence interval and a Mann–Kendall monotonic-trend screen on annual means to reduce seasonal interference. A significant result says the series has a detectable pattern in this screening analysis; it does not explain the cause.
                  </Text>
                  <Text type="supporting">
                    The current investigation uses {variable.parameter} from NASA POWER at {formatNumber(region.latitude, 1)}° latitude, {formatNumber(region.longitude, 1)}° longitude. The fallback is synthetic demo data, not a substitute for the live source.
                  </Text>
                  <HStack gap={2}>
                    <Button label="NASA challenge source" variant="secondary" href={SOURCE_REGISTRY.challenge.url} />
                    <Button label="NASA POWER source" variant="secondary" href={SOURCE_REGISTRY.power.url} />
                    <Button label="NASA Earthdata context" variant="secondary" href={SOURCE_REGISTRY.earthdata.url} />
                  </HStack>
                </VStack>
              </Card>

              <Card id="example">
                <VStack gap={3}>
                  <Badge label="Three-minute judge path" variant="blue" />
                  <Heading level={2}>Start with the default Atacama temperature example.</Heading>
                  <Text>
                    The first screen is already a complete example: a variable, a region, a long-enough series, a fitted trend, a significance screen, and a limitation. Change either selector to see the investigation re-run with a different question.
                  </Text>
                  <HStack gap={2}>
                    <Button label="Jump to the chart" variant="primary" href="#analysis" />
                    <Button label="Jump to method" variant="secondary" href="#method" />
                  </HStack>
                </VStack>
              </Card>
            </VStack>
          </LayoutContent>
        }
      />
    </AppShell>
  );
}
