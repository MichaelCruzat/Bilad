import {describe, expect, it} from 'vitest';
import {getFallbackSeries} from '../src/data/trends';
import {analyzeTrend, getAnnualSeries, getBaselineMean} from '../src/lib/trendAnalysis';

describe('Bilad trend analysis', () => {
  it('uses complete years and leaves partial years out of the annual comparison', () => {
    const annual = getAnnualSeries([
      {date: '2002-01', year: 2002, month: 1, value: 9},
      ...Array.from({length: 12}, (_, index) => ({date: `2001-${String(index + 1).padStart(2, '0')}`, year: 2001, month: index + 1, value: 8})),
      ...Array.from({length: 12}, (_, index) => ({date: `2000-${String(index + 1).padStart(2, '0')}`, year: 2000, month: index + 1, value: 4})),
    ]);

    expect(annual).toEqual([{year: 2000, value: 4}, {year: 2001, value: 8}]);
    expect(() => analyzeTrend(Array.from({length: 3}, (_, index) => ({date: `2000-0${index + 1}`, year: 2000, month: index + 1, value: index})))).toThrow('three complete years');
  });

  it('uses only 2000–2004 annual values as the anomaly reference', () => {
    expect(getBaselineMean([
      {year: 2000, value: 2},
      {year: 2001, value: 4},
      {year: 2002, value: 6},
      {year: 2003, value: 8},
      {year: 2004, value: 10},
      {year: 2005, value: 20},
    ])).toBe(6);
    expect(getBaselineMean([{year: 2000, value: 2}, {year: 2004, value: 10}])).toBeNull();
  });
  it('estimates an increasing linear trend and reports a significant monotonic signal', () => {
    const observations = Array.from({length: 60}, (_, index) => {
      const year = 2000 + Math.floor(index / 12);
      const month = (index % 12) + 1;
      const yearsSinceStart = year - 2000 + (month - 1) / 12;

      return {
        date: `${year}-${String(month).padStart(2, '0')}`,
        year,
        month,
        value: 10 + yearsSinceStart * 2,
      };
    });

    const result = analyzeTrend(observations);

    expect(result.slopePerYear).toBeCloseTo(2, 6);
    expect(result.direction).toBe('increasing');
    expect(result.significant).toBe(true);
    expect(result.confidenceInterval.lower).toBeLessThan(2);
    expect(result.confidenceInterval.upper).toBeGreaterThan(2);
  });

  it('does not call a flat series significant', () => {
    const observations = Array.from({length: 36}, (_, index) => {
      const year = 2010 + Math.floor(index / 12);
      const month = (index % 12) + 1;

      return {
        date: `${year}-${String(month).padStart(2, '0')}`,
        year,
        month,
        value: 4,
      };
    });

    const result = analyzeTrend(observations);

    expect(result.slopePerYear).toBe(0);
    expect(result.direction).toBe('stable');
    expect(result.pValue).toBe(1);
    expect(result.significant).toBe(false);
  });

  it('ships a long-enough deterministic fallback series for the default example', () => {
    const result = analyzeTrend(getFallbackSeries('atacama', 'temperature'));

    expect(result.sampleCount).toBe(300);
    expect(result.startDate).toBe('2000-01');
    expect(result.endDate).toBe('2024-12');
    expect(Number.isFinite(result.slopePerYear)).toBe(true);
  });
});
