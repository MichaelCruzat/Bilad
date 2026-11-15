import {HStack, VStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';
import type {MonthlyObservation} from '../data/trends';
import type {TrendResult} from '../lib/trendAnalysis';

type TrendChartProps = {
  observations: MonthlyObservation[];
  result: TrendResult;
  unit: string;
  label: string;
};

export function TrendChart({observations, result, unit, label}: TrendChartProps) {
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
