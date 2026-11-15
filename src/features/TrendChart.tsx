import {HStack, VStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';
import type {MonthlyObservation} from '../data/trends';
import {getAnnualSeries, type TrendResult} from '../lib/trendAnalysis';

type ChartSeries = {
  observations: MonthlyObservation[];
  result: TrendResult;
  regionName: string;
};

type TrendChartProps = ChartSeries & {
  unit: string;
  label: string;
  comparison?: ChartSeries;
};

export function TrendChart({observations, result, regionName, unit, label, comparison}: TrendChartProps) {
  const primary = getAnnualSeries(observations);
  const secondary = comparison ? getAnnualSeries(comparison.observations) : [];
  const allValues = [...primary, ...secondary].map(point => point.value);
  const minimum = Math.min(...allValues);
  const maximum = Math.max(...allValues);
  const padding = Math.max(0.5, (maximum - minimum) * 0.12);
  const lower = minimum - padding;
  const upper = maximum + padding;
  const allYears = [...primary, ...secondary].map(point => point.year);
  const firstYear = Math.min(...allYears);
  const lastYear = Math.max(...allYears);
  const plotX = (year: number) => 62 + ((year - firstYear) / Math.max(1, lastYear - firstYear)) * 650;
  const plotY = (value: number) => 236 - ((value - lower) / (upper - lower)) * 196;
  const path = (points: {year: number; value: number}[]) => points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${plotX(point.year).toFixed(1)} ${plotY(point.value).toFixed(1)}`)
    .join(' ');
  const fit = (points: {year: number; value: number}[], trend: TrendResult) => path([
    {year: points[0].year, value: trend.intercept + trend.slopePerYear * points[0].year},
    {year: points[points.length - 1].year, value: trend.intercept + trend.slopePerYear * points[points.length - 1].year},
  ]);
  const yTicks = [0, 0.5, 1].map(fraction => lower + (upper - lower) * fraction);
  const xTicks = Array.from(new Set([firstYear, firstYear + 5, firstYear + 10, firstYear + 15, firstYear + 20, lastYear]))
    .filter(year => year <= lastYear);

  return (
    <VStack gap={3}>
      <svg role="img" aria-labelledby="trend-chart-title trend-chart-description" viewBox="0 0 760 290" style={{width: '100%', height: 'auto'}}>
        <title id="trend-chart-title">{label} annual trend chart</title>
        <desc id="trend-chart-description">
          Annual means from {firstYear} to {lastYear} for {regionName}
          {comparison ? ` and ${comparison.regionName}` : ''}. Dashed lines show monthly-data linear fits.
        </desc>
        {yTicks.map(value => (
          <g key={value}>
            <line x1="62" x2="712" y1={plotY(value)} y2={plotY(value)} stroke="var(--color-border-emphasized)" strokeOpacity="0.7" />
            <text x="51" y={plotY(value) + 4} textAnchor="end" fill="var(--color-text-secondary)" fontSize="12">{value.toFixed(1)}</text>
          </g>
        ))}
        {xTicks.map(year => (
          <text key={year} x={plotX(year)} y="268" textAnchor="middle" fill="var(--color-text-secondary)" fontSize="12">{year}</text>
        ))}
        <path d={path(primary)} fill="none" stroke="var(--color-text-primary)" strokeWidth="2.5" strokeLinejoin="round" />
        <path d={fit(primary, result)} fill="none" stroke="var(--color-text-primary)" strokeWidth="1.5" strokeDasharray="6 6" strokeOpacity="0.55" />
        {comparison && (
          <>
            <path d={path(secondary)} fill="none" stroke="var(--color-accent)" strokeWidth="2.5" strokeLinejoin="round" />
            <path d={fit(secondary, comparison.result)} fill="none" stroke="var(--color-accent)" strokeWidth="1.5" strokeDasharray="6 6" strokeOpacity="0.7" />
          </>
        )}
      </svg>
      <HStack gap={4} wrap="wrap">
        <Text type="supporting">— {regionName}</Text>
        {comparison && <Text type="supporting" color="accent">— {comparison.regionName}</Text>}
        <Text type="supporting" color="secondary">Annual mean ({unit}); dashed = fitted monthly trend</Text>
      </HStack>
    </VStack>
  );
}
