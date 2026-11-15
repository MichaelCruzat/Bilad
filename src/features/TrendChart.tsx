import {HStack, VStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';
import type {MonthlyObservation} from '../data/trends';
import {getAnnualSeries, getBaselineMean, type TrendResult} from '../lib/trendAnalysis';

type ChartSeries = {
  observations: MonthlyObservation[];
  result: TrendResult;
  regionName: string;
  source: string;
};

type TrendChartProps = ChartSeries & {
  unit: string;
  label: string;
  mode?: 'absolute' | 'anomaly';
  comparison?: ChartSeries;
};

type AnnualPoint = {year: number; value: number};

function linePath(points: AnnualPoint[], plotX: (year: number) => number, plotY: (value: number) => number, breakGaps = true): string {
  return points.map((point, index) =>
    `${index === 0 || (breakGaps && point.year > points[index - 1].year + 1) ? 'M' : 'L'} ${plotX(point.year).toFixed(1)} ${plotY(point.value).toFixed(1)}`,
  ).join(' ');
}

export function TrendChart({observations, result, regionName, source, unit, label, comparison, mode = 'absolute'}: TrendChartProps) {
  const primaryAnnual = getAnnualSeries(observations);
  const secondaryAnnual = comparison ? getAnnualSeries(comparison.observations) : [];
  const primaryBaseline = getBaselineMean(primaryAnnual);
  const secondaryBaseline = comparison ? getBaselineMean(secondaryAnnual) : null;
  const isAnomaly = mode === 'anomaly' && primaryBaseline !== null && (!comparison || secondaryBaseline !== null);
  const primary = primaryAnnual.map(point => ({...point, value: point.value - (isAnomaly ? primaryBaseline : 0)}));
  const secondary = secondaryAnnual.map(point => ({...point, value: point.value - (isAnomaly ? secondaryBaseline! : 0)}));
  const allYears = [...primary, ...secondary].map(point => point.year);
  const firstYear = Math.min(...allYears);
  const lastYear = Math.max(...allYears);
  const fitValue = (trend: TrendResult, year: number, baseline: number | null) =>
    trend.intercept + trend.slopePerYear * year - (isAnomaly ? baseline! : 0);
  const primaryFit = [
    {year: primary[0].year, value: fitValue(result, primary[0].year, primaryBaseline)},
    {year: primary[primary.length - 1].year, value: fitValue(result, primary[primary.length - 1].year, primaryBaseline)},
  ];
  const secondaryFit = comparison ? [
    {year: secondary[0].year, value: fitValue(comparison.result, secondary[0].year, secondaryBaseline)},
    {year: secondary[secondary.length - 1].year, value: fitValue(comparison.result, secondary[secondary.length - 1].year, secondaryBaseline)},
  ] : [];
  const allValues = [...primary, ...secondary, ...primaryFit, ...secondaryFit].map(point => point.value);
  const minimum = Math.min(...allValues);
  const maximum = Math.max(...allValues);
  const padding = Math.max(0.5, (maximum - minimum) * 0.12);
  const lower = minimum - padding;
  const upper = maximum + padding;
  const plotX = (year: number) => 62 + ((year - firstYear) / Math.max(1, lastYear - firstYear)) * 650;
  const plotY = (value: number) => 236 - ((value - lower) / (upper - lower)) * 196;
  const yTicks = [lower, isAnomaly ? 0 : (lower + upper) / 2, upper];
  const xTicks = Array.from(new Set([firstYear, firstYear + 5, firstYear + 10, firstYear + 15, firstYear + 20, lastYear]))
    .filter(year => year <= lastYear);
  const years = Array.from({length: lastYear - firstYear + 1}, (_, index) => firstYear + index);
  const primaryByYear = new Map(primary.map(point => [point.year, point.value]));
  const secondaryByYear = new Map(secondary.map(point => [point.year, point.value]));
  const hasMixedSources = Boolean(comparison && source !== comparison.source);

  return (
    <VStack gap={3}>
      <VStack as="section" aria-label="Scrollable trend chart" tabIndex={0} style={{overflowX: 'auto', maxWidth: '100%'}}>
        <svg role="img" aria-labelledby="trend-chart-title trend-chart-description" viewBox="0 0 760 290" style={{width: '100%', minWidth: '48rem', height: 'auto'}}>
          <title id="trend-chart-title">{label} annual trend chart</title>
          <desc id="trend-chart-description">
            Annual {isAnomaly ? 'anomalies relative to the 2000–2004 mean' : 'means'} from {firstYear} to {lastYear} for {regionName} ({source})
            {comparison ? ` and ${comparison.regionName} (${comparison.source})` : ''}. Missing years have gaps. Dashed lines show monthly-data linear fits. Annual values follow in a table.
          </desc>
          {yTicks.map(value => (
            <g key={value}>
              <line x1="62" x2="712" y1={plotY(value)} y2={plotY(value)} stroke="var(--color-border-emphasized)" strokeOpacity={isAnomaly && value === 0 ? 1 : 0.7} />
              <text x="51" y={plotY(value) + 4} textAnchor="end" fill="var(--color-text-secondary)" fontSize="12">{value.toFixed(1)}</text>
            </g>
          ))}
          {xTicks.map(year => (
            <text key={year} x={plotX(year)} y="268" textAnchor="middle" fill="var(--color-text-secondary)" fontSize="12">{year}</text>
          ))}
          <path d={linePath(primary, plotX, plotY)} fill="none" stroke="var(--color-text-primary)" strokeWidth="2.5" strokeLinejoin="round" />
          <path d={linePath(primaryFit, plotX, plotY, false)} fill="none" stroke="var(--color-text-primary)" strokeWidth="1.5" strokeDasharray="6 6" strokeOpacity="0.55" />
          {comparison && (
            <>
              <path d={linePath(secondary, plotX, plotY)} fill="none" stroke="var(--color-accent)" strokeWidth="2.5" strokeLinejoin="round" />
              <path d={linePath(secondaryFit, plotX, plotY, false)} fill="none" stroke="var(--color-accent)" strokeWidth="1.5" strokeDasharray="6 6" strokeOpacity="0.7" />
            </>
          )}
        </svg>
      </VStack>
      <Text type="supporting" color="secondary">On a narrow screen, scroll the chart sideways to inspect the axis.</Text>
      <HStack gap={4} wrap="wrap">
        <Text type="supporting">— {regionName} · {source}</Text>
        {comparison && <Text type="supporting" color="accent">— {comparison.regionName} · {comparison.source}</Text>}
        <Text type="supporting" color="secondary">
          {isAnomaly ? `Change from 2000–2004 mean (${unit})` : `Annual mean (${unit})`}. Dashed lines show the fitted monthly trends.
        </Text>
        {mode === 'anomaly' && !isAnomaly && <Text type="supporting">Reference period unavailable; showing absolute values.</Text>}
      </HStack>
      {hasMixedSources && <Text type="supporting" role="status">Mixed sources: the live and synthetic series should not be interpreted as equivalent evidence.</Text>}
      <details>
        <summary>Annual values and missing years</summary>
        <table style={{width: '100%', borderCollapse: 'collapse', marginTop: 'var(--spacing-3)'}}>
          <caption style={{textAlign: 'left', paddingBlock: 'var(--spacing-2)'}}>
            {isAnomaly ? 'Change from 2000–2004 mean' : 'Annual mean'} in {unit}. A dash means no complete year.
          </caption>
          <thead>
            <tr>
              <th scope="col" style={{textAlign: 'left', padding: 'var(--spacing-2)'}}>Year</th>
              <th scope="col" style={{textAlign: 'left', padding: 'var(--spacing-2)'}}>{regionName} ({source})</th>
              {comparison && <th scope="col" style={{textAlign: 'left', padding: 'var(--spacing-2)'}}>{comparison.regionName} ({comparison.source})</th>}
            </tr>
          </thead>
          <tbody>
            {years.map(year => (
              <tr key={year} style={{borderTop: '1px solid var(--color-border)'}}>
                <th scope="row" style={{textAlign: 'left', padding: 'var(--spacing-2)'}}>{year}</th>
                <td style={{padding: 'var(--spacing-2)'}}>{primaryByYear.get(year)?.toFixed(2) ?? '—'}</td>
                {comparison && <td style={{padding: 'var(--spacing-2)'}}>{secondaryByYear.get(year)?.toFixed(2) ?? '—'}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </VStack>
  );
}
