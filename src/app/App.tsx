import {useMemo, useRef, useState} from 'react';
import {AppShell} from '@astryxdesign/core/AppShell';
import {Badge} from '@astryxdesign/core/Badge';
import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {Divider} from '@astryxdesign/core/Divider';
import {Grid} from '@astryxdesign/core/Grid';
import {Layout, LayoutContent} from '@astryxdesign/core/Layout';
import {NavIcon} from '@astryxdesign/core/NavIcon';
import {Icon} from '@astryxdesign/core/Icon';
import {
  SideNav,
  SideNavHeading,
  SideNavItem,
  SideNavSection,
} from '@astryxdesign/core/SideNav';
import {SegmentedControl, SegmentedControlItem} from '@astryxdesign/core/SegmentedControl';
import {Heading, Text} from '@astryxdesign/core/Text';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {
  BookOpenIcon,
  ChartBarIcon,
  GlobeAmericasIcon,
  LightBulbIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline';
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
import {fetchPowerSeries} from '../lib/nasaPower';
import {analyzeTrend, type TrendResult} from '../lib/trendAnalysis';

function Navigation() {
  return (
    <SideNav
      aria-label="Bilad navigation"
      collapsible
      header={
        <SideNavHeading
          heading="Bilad"
          icon={<NavIcon icon={<Icon icon={GlobeAmericasIcon} size="sm" />} />}
          headingHref="#top"
        />
      }
      footer={
        <SideNavSection title="Resources" isHeaderHidden>
          <SideNavItem label="NASA challenge" icon={BookOpenIcon} href={SOURCE_REGISTRY.challenge.url} />
        </SideNavSection>
      }>
      <SideNavSection title="Investigation" isHeaderHidden>
        <SideNavItem label="Briefing" icon={LightBulbIcon} href="#top" isSelected />
        <SideNavItem label="Trend explorer" icon={ChartBarIcon} href="#explore" />
        <SideNavItem label="Regions" icon={MapPinIcon} href="#regions" />
        <SideNavItem label="Method & sources" icon={BookOpenIcon} href="#method" />
      </SideNavSection>
    </SideNav>
  );
}

function formatNumber(value: number, digits = 2): string {
  return value.toFixed(digits);
}

function formatPValue(value: number): string {
  if (value < 0.001) return '< 0.001';
  return value.toFixed(3);
}

function TrendChart({
  observations,
  result,
  unit,
  label,
}: {
  observations: MonthlyObservation[];
  result: TrendResult;
  unit: string;
  label: string;
}) {
  const values = observations.map(observation => observation.value);
  const fittedValues = observations.map(
    observation => result.intercept + result.slopePerYear * (observation.year + (observation.month - 1) / 12),
  );
  const minimum = Math.min(...values, ...fittedValues);
  const maximum = Math.max(...values, ...fittedValues);
  const range = Math.max(0.001, maximum - minimum);
  const plotX = (index: number) => 36 + (index / Math.max(1, observations.length - 1)) * 688;
  const plotY = (value: number) => 228 - ((value - minimum) / range) * 196;
  const observedPath = observations
    .map((observation, index) => `${index === 0 ? 'M' : 'L'} ${plotX(index).toFixed(2)} ${plotY(observation.value).toFixed(2)}`)
    .join(' ');
  const fittedPath = fittedValues
    .map((value, index) => `${index === 0 ? 'M' : 'L'} ${plotX(index).toFixed(2)} ${plotY(value).toFixed(2)}`)
    .join(' ');

  return (
    <VStack gap={2}>
      <svg
        role="img"
        aria-labelledby="trend-chart-title trend-chart-description"
        viewBox="0 0 760 260"
        preserveAspectRatio="none">
        <title id="trend-chart-title">{label} monthly trend chart</title>
        <desc id="trend-chart-description">
          Observed monthly {unit} values with a fitted linear trend line from {result.startDate} to {result.endDate}.
        </desc>
        <line x1="36" y1="228" x2="724" y2="228" stroke="currentColor" strokeOpacity="0.25" />
        <line x1="36" y1="32" x2="36" y2="228" stroke="currentColor" strokeOpacity="0.25" />
        <path d={observedPath} fill="none" stroke="currentColor" strokeWidth="3" />
        <path d={fittedPath} fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="8 7" strokeOpacity="0.5" />
      </svg>
      <HStack gap={4}>
        <Text type="supporting">Solid: monthly observations</Text>
        <Text type="supporting">Dashed: fitted linear trend</Text>
      </HStack>
    </VStack>
  );
}

export default function App() {
  const [variableId, setVariableId] = useState<VariableId>('temperature');
  const [regionId, setRegionId] = useState<RegionId>('atacama');
  const [series, setSeries] = useState<MonthlyObservation[]>(() => getFallbackSeries('atacama', 'temperature'));
  const [sourceLabel, setSourceLabel] = useState('Deterministic demo fallback');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const requestVersion = useRef(0);

  const variable = VARIABLE_DEFINITIONS[variableId];
  const region = getRegion(regionId);
  const result = useMemo(() => analyzeTrend(series), [series]);

  const selectVariable = (value: string) => {
    const nextVariable = value as VariableId;
    requestVersion.current += 1;
    setVariableId(nextVariable);
    setSeries(getFallbackSeries(regionId, nextVariable));
    setSourceLabel('Deterministic demo fallback');
    setLoadError(null);
  };

  const selectRegion = (nextRegion: RegionId) => {
    requestVersion.current += 1;
    setRegionId(nextRegion);
    setSeries(getFallbackSeries(nextRegion, variableId));
    setSourceLabel('Deterministic demo fallback');
    setLoadError(null);
  };

  const loadLiveData = async () => {
    const requestVersionAtStart = requestVersion.current;
    setIsLoading(true);
    setLoadError(null);

    try {
      const liveSeries = await fetchPowerSeries(region, variable);
      if (requestVersionAtStart !== requestVersion.current) return;
      setSeries(liveSeries);
      setSourceLabel('NASA POWER live');
    } catch (error) {
      setSeries(getFallbackSeries(regionId, variableId));
      setSourceLabel('Deterministic demo fallback');
      setLoadError(error instanceof Error ? error.message : 'NASA POWER could not be reached.');
    } finally {
      setIsLoading(false);
    }
  };

  const useDemoData = () => {
    setSeries(getFallbackSeries(regionId, variableId));
    setSourceLabel('Deterministic demo fallback');
    setLoadError(null);
  };

  const directionText =
    result.direction === 'increasing'
      ? 'an increasing signal'
      : result.direction === 'decreasing'
        ? 'a decreasing signal'
        : 'a stable signal';
  const significanceText = result.significant
    ? 'passes the prototype significance screen'
    : 'does not pass the prototype significance screen';

  return (
    <AppShell contentPadding={0} height="auto" sideNav={<Navigation />} variant="elevated">
      <Layout
        height="auto"
        content={
          <LayoutContent padding={6}>
            <VStack gap={8}>
              <VStack gap={3} id="top">
                <Badge label="NASA Space Apps 2026 · Earth System Trend Detective" variant="blue" />
                <Heading level={1}>Find the signal in a changing Earth.</Heading>
                <Text type="large" color="secondary">
                  Bilad helps you choose an Earth-system variable, focus on a region, and test what the time series is really saying: what changed, where, by how much, and whether the signal is statistically meaningful.
                </Text>
                <HStack gap={2}>
                  <Button label="Start the investigation" variant="primary" href="#explore" />
                  <Button label="Read the method" variant="secondary" href="#method" />
                </HStack>
              </VStack>

              <Divider />

              <VStack gap={3} id="explore">
                <Heading level={2}>1. Choose a variable</Heading>
                <Text color="secondary">
                  Start with a measurable Earth-system quantity. Bilad keeps the definition and unit beside the result so the chart has scientific context.
                </Text>
                <SegmentedControl
                  label="Earth science variable"
                  value={variableId}
                  onChange={selectVariable}
                  layout="fill">
                  {VARIABLE_IDS.map(id => (
                    <SegmentedControlItem
                      key={id}
                      value={id}
                      label={VARIABLE_DEFINITIONS[id].shortLabel}
                    />
                  ))}
                </SegmentedControl>
                <Card variant="muted">
                  <VStack gap={2}>
                    <Heading level={3}>{variable.label}</Heading>
                    <Text>{variable.description}</Text>
                    <Text type="supporting">
                      Unit: {variable.unit}. {variable.interpretation}
                    </Text>
                  </VStack>
                </Card>
              </VStack>

              <VStack gap={3} id="regions">
                <Heading level={2}>2. Choose a region</Heading>
                <Text color="secondary">
                  Compare contrasting Earth contexts without pretending that one point represents an entire ecosystem or climate zone.
                </Text>
                <Grid columns={{minWidth: 220, max: 3}} gap={3}>
                  {REGIONS.map(item => (
                    <Card key={item.id} variant={item.id === regionId ? 'muted' : undefined}>
                      <VStack gap={2}>
                        <Badge label={item.subtitle} variant="blue" />
                        <Heading level={3}>{item.name}</Heading>
                        <Text color="secondary">{item.description}</Text>
                        <Button
                          label={item.id === regionId ? 'Selected region' : `Inspect ${item.name}`}
                          variant={item.id === regionId ? 'primary' : 'secondary'}
                          onClick={() => selectRegion(item.id)}
                        />
                      </VStack>
                    </Card>
                  ))}
                </Grid>
              </VStack>

              <VStack gap={3} id="analysis">
                <HStack gap={2}>
                  <Heading level={2}>3. Read the evidence</Heading>
                  <Badge label={sourceLabel} variant="blue" />
                </HStack>
                <Text color="secondary">
                  {variable.label} in {region.name} · {result.startDate} to {result.endDate} · {result.sampleCount} monthly observations
                </Text>
                <Card>
                  <VStack gap={3}>
                    <TrendChart observations={series} result={result} unit={variable.unit} label={variable.label} />
                    <HStack gap={2}>
                      <Button
                        label={isLoading ? 'Loading NASA POWER…' : 'Load NASA POWER data'}
                        variant="primary"
                        onClick={loadLiveData}
                        isDisabled={isLoading}
                      />
                      <Button label="Use demo data" variant="secondary" onClick={useDemoData} />
                    </HStack>
                    {loadError ? (
                      <Text type="supporting" color="secondary">
                        Live request unavailable, so Bilad kept the analysis usable with a deterministic fallback. {loadError}
                      </Text>
                    ) : (
                      <Text type="supporting" color="secondary">
                        The demo series is deterministic and clearly labeled. Load NASA POWER when you want the public monthly endpoint.
                      </Text>
                    )}
                  </VStack>
                </Card>

                <Grid columns={{minWidth: 190, max: 4}} gap={3}>
                  <Card variant="muted">
                    <VStack gap={1}>
                      <Text type="supporting">Trend verdict</Text>
                      <Heading level={3}>{result.significant ? 'Signal detected' : 'Signal needs caution'}</Heading>
                      <Text>{directionText} in {region.name}.</Text>
                    </VStack>
                  </Card>
                  <Card variant="muted">
                    <VStack gap={1}>
                      <Text type="supporting">Change per year</Text>
                      <Heading level={3}>{formatNumber(result.slopePerYear)} {variable.unit}/yr</Heading>
                      <Text>95% interval: {formatNumber(result.confidenceInterval.lower)} to {formatNumber(result.confidenceInterval.upper)}.</Text>
                    </VStack>
                  </Card>
                  <Card variant="muted">
                    <VStack gap={1}>
                      <Text type="supporting">Mann–Kendall screen</Text>
                      <Heading level={3}>{result.significant ? 'p < 0.05' : `p = ${formatPValue(result.pValue)}`}</Heading>
                      <Text>The signal {significanceText}.</Text>
                    </VStack>
                  </Card>
                  <Card variant="muted">
                    <VStack gap={1}>
                      <Text type="supporting">Linear fit</Text>
                      <Heading level={3}>R² {formatNumber(result.rSquared, 3)}</Heading>
                      <Text>How much of the variation a straight line describes.</Text>
                    </VStack>
                  </Card>
                </Grid>
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
