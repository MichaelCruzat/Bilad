import type {MonthlyObservation} from '../data/trends';

export type TrendDirection = 'increasing' | 'decreasing' | 'stable';

export type TrendResult = {
  sampleCount: number;
  annualCount: number;
  startDate: string;
  endDate: string;
  slopePerYear: number;
  intercept: number;
  rSquared: number;
  confidenceInterval: {
    lower: number;
    upper: number;
  };
  mannKendallTau: number;
  mannKendallZ: number;
  pValue: number;
  direction: TrendDirection;
  significant: boolean;
};

function normalCdf(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const magnitude = Math.abs(value) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * magnitude);
  const approximation =
    1 -
    (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-magnitude * magnitude));

  return 0.5 * (1 + sign * approximation);
}

function getTieCounts(values: number[]): number[] {
  const counts = new Map<number, number>();
  values.forEach(value => counts.set(value, (counts.get(value) ?? 0) + 1));
  return Array.from(counts.values()).filter(count => count > 1);
}

export function getAnnualSeries(observations: MonthlyObservation[]): {year: number; value: number}[] {
  const annual = new Map<number, Map<number, number>>();
  observations.forEach(observation => {
    const values = annual.get(observation.year) ?? new Map<number, number>();
    if (Number.isFinite(observation.value)) values.set(observation.month, observation.value);
    annual.set(observation.year, values);
  });

  return Array.from(annual.entries())
    .filter(([, values]) => values.size === 12)
    .sort(([left], [right]) => left - right)
    .map(([year, values]) => ({year, value: Array.from(values.values()).reduce((sum, value) => sum + value, 0) / 12}));
}

export function getBaselineMean(annual: {year: number; value: number}[]): number | null {
  const reference = annual.filter(point => point.year >= 2000 && point.year <= 2004);
  if (reference.length !== 5 || new Set(reference.map(point => point.year)).size !== 5) return null;
  return reference.reduce((sum, point) => sum + point.value, 0) / reference.length;
}

function mannKendall(values: number[]): Pick<TrendResult, 'mannKendallTau' | 'mannKendallZ' | 'pValue'> {
  let score = 0;

  for (let left = 0; left < values.length - 1; left += 1) {
    for (let right = left + 1; right < values.length; right += 1) {
      if (values[right] > values[left]) score += 1;
      if (values[right] < values[left]) score -= 1;
    }
  }

  const sampleCount = values.length;
  const ties = getTieCounts(values);
  const tieCorrection = ties.reduce((sum, count) => sum + count * (count - 1) * (2 * count + 5), 0);
  const variance =
    (sampleCount * (sampleCount - 1) * (2 * sampleCount + 5) - tieCorrection) / 18;
  const z = variance === 0 ? 0 : score > 0 ? (score - 1) / Math.sqrt(variance) : score < 0 ? (score + 1) / Math.sqrt(variance) : 0;
  const tau = score / (sampleCount * (sampleCount - 1) / 2);
  const pValue = z === 0 ? 1 : Math.max(0, Math.min(1, 2 * (1 - normalCdf(Math.abs(z)))));

  return {mannKendallTau: tau, mannKendallZ: z, pValue};
}

export function analyzeTrend(observations: MonthlyObservation[]): TrendResult {
  const valid = observations
    .filter(observation => Number.isFinite(observation.value))
    .sort((left, right) => left.date.localeCompare(right.date));
  const annual = getAnnualSeries(valid);
  const eligibleYears = new Set(annual.map(point => point.year));
  const clean = valid.filter(observation => eligibleYears.has(observation.year));

  if (annual.length < 3) {
    throw new Error('At least three complete years are required to analyze a trend.');
  }

  const x = clean.map(observation => observation.year + (observation.month - 1) / 12);
  const y = clean.map(observation => observation.value);
  const meanX = x.reduce((sum, value) => sum + value, 0) / x.length;
  const meanY = y.reduce((sum, value) => sum + value, 0) / y.length;
  const sumXX = x.reduce((sum, value) => sum + (value - meanX) ** 2, 0);
  const sumXY = x.reduce((sum, value, index) => sum + (value - meanX) * (y[index] - meanY), 0);
  const slopePerYear = sumXX === 0 ? 0 : sumXY / sumXX;
  const intercept = meanY - slopePerYear * meanX;
  const predicted = x.map(value => intercept + slopePerYear * value);
  const residualSumSquares = y.reduce((sum, value, index) => sum + (value - predicted[index]) ** 2, 0);
  const totalSumSquares = y.reduce((sum, value) => sum + (value - meanY) ** 2, 0);
  const rSquared = totalSumSquares === 0 ? 0 : Math.max(0, Math.min(1, 1 - residualSumSquares / totalSumSquares));
  const residualVariance = clean.length > 2 ? residualSumSquares / (clean.length - 2) : 0;
  const standardError = sumXX === 0 ? 0 : Math.sqrt(residualVariance / sumXX);
  const margin = 1.96 * standardError;
  const mannKendallResult = mannKendall(annual.map(observation => observation.value));

  return {
    sampleCount: clean.length,
    annualCount: annual.length,
    startDate: clean[0].date,
    endDate: clean[clean.length - 1].date,
    slopePerYear,
    intercept,
    rSquared,
    confidenceInterval: {lower: slopePerYear - margin, upper: slopePerYear + margin},
    ...mannKendallResult,
    direction: slopePerYear > 0.00001 ? 'increasing' : slopePerYear < -0.00001 ? 'decreasing' : 'stable',
    significant: mannKendallResult.pValue < 0.05,
  };
}
