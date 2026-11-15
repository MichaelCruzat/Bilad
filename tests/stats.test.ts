import {describe, expect, it} from 'vitest';
import {
  agreement,
  annualAnomalies,
  fdrThreshold,
  monthlyClimatology,
  pettitt,
  signalToNoise,
  startYearSensitivity,
  stepScreen,
  trendTest,
  weightedMean,
  yearsToSignificance,
} from '../src/lib/stats';

// Reference values produced by pymannkendall 1.4 (original_test,
// hamed_rao_modification_test, sens_slope) on the same inputs.
const AR1 = [0.0, 0.0304, 0.1499, 0.0707, -0.1607, -0.1829, -0.3505, -0.1433, 0.3947, 0.2307, 0.0863, 0.3274, 0.4652, 0.4953, 0.2146, 0.2974, 0.5818, 0.178, 0.1703, -0.2592, -0.3673, -0.5996, -0.2713, -0.3421, 0.0789, 0.3483, 0.4427, -0.1811, -0.0154, 0.2567, 0.5047, 0.1942, 0.3016, 0.2356, 0.2493, 0.8288, 0.6829, 0.8222, 1.2039, 1.0396, 1.0752, 1.1758, 1.2412, 0.9093];
const SMALL = [3.1, 2.9, 3.4, 3.3, 3.0, 3.6, 3.5, 3.9, 3.7, 4.1, 3.8, 4.4, 4.0, 4.2, 4.6];
const idx = (n: number) => Array.from({length: n}, (_, i) => i);

describe('trendTest', () => {
  it('matches pymannkendall on an autocorrelated AR(1) series', () => {
    const r = trendTest(idx(AR1.length), AR1);
    expect(r.s).toBe(412);
    expect(r.slope).toBeCloseTo(0.023674848484848483, 10);
    expect(r.intercept).toBeCloseTo(-0.2758592424242424, 10);
    expect(r.pRaw).toBeCloseTo(3.225078843915874e-05, 6);
    expect(r.inflation).toBeCloseTo(32077.58513372932 / 9775.333333333334, 6);
    expect(r.p).toBeCloseTo(0.021745755806959366, 5);
  });

  it('never lets the serial-correlation correction shrink the variance', () => {
    // pymannkendall reports p = 0 here because n/n* < 1; Bilad clamps to 1.
    const r = trendTest(idx(SMALL.length), SMALL);
    expect(r.s).toBe(81);
    expect(r.slope).toBeCloseTo(0.10000000000000002, 10);
    expect(r.inflation).toBe(1);
    expect(r.p).toBeCloseTo(r.pRaw, 12);
    expect(r.pRaw).toBeCloseTo(7.527265841744679e-05, 6);
  });

  it('recovers an exact linear slope and brackets it', () => {
    const t = idx(30).map(i => 1990 + i);
    const y = t.map(v => 0.25 * (v - 1990) + 4);
    const r = trendTest(t, y);
    expect(r.slope).toBeCloseTo(0.25, 12);
    expect(r.slopeLow).toBeLessThanOrEqual(0.25);
    expect(r.slopeHigh).toBeGreaterThanOrEqual(0.25);
    expect(r.tau).toBe(1);
  });

  it('applies the tie correction to the variance', () => {
    const r = trendTest(idx(6), [1, 1, 2, 2, 3, 3]);
    // (6*5*17 - 3*(2*1*9)) / 18 = 25.33
    expect(r.s).toBe(12);
    expect(r.p).toBeLessThan(0.05);
  });

  it('skips missing values and refuses tiny samples', () => {
    expect(trendTest(idx(5), [1, NaN, NaN, NaN, 2]).n).toBe(2);
    expect(trendTest(idx(5), [1, NaN, NaN, NaN, 2]).p).toBe(1);
    expect(trendTest(idx(6), [1, NaN, 2, 3, 4, 5]).n).toBe(5);
  });
});

describe('pettitt', () => {
  it('locates a step change and reports a small p-value', () => {
    const t = idx(40).map(i => 1981 + i);
    const y = t.map((year, i) => (year < 2008 ? 10 : 7) + 0.3 * Math.sin(i * 1.7));
    const cp = pettitt(t, y)!;
    expect(cp.breakAt).toBe(2008);
    expect(cp.p).toBeLessThan(0.001);
    expect(cp.meanAfter).toBeLessThan(cp.meanBefore);
  });

  it('does not find a break in a flat, noisy series', () => {
    const t = idx(40);
    const y = t.map(i => Math.sin(i * 2.3) + Math.cos(i * 0.9));
    expect(pettitt(t, y)!.p).toBeGreaterThan(0.1);
  });
});

describe('fdrThreshold', () => {
  it('implements the Benjamini–Hochberg step-up rule', () => {
    expect(fdrThreshold([0.01, 0.02, 0.03, 0.04, 0.2], 0.05)).toBe(0.04);
    // Step-up: a later p below its line rescues earlier ones.
    expect(fdrThreshold([0.011, 0.04, 0.05, 0.9], 0.2)).toBe(0.05);
    expect(fdrThreshold([0.5, 0.6, 0.9], 0.1)).toBe(0);
  });
});

describe('anomalies', () => {
  it('removes the seasonal cycle and tolerates a missing month', () => {
    const years = 4;
    const monthly = new Float64Array(years * 12);
    for (let y = 0; y < years; y++)
      for (let m = 0; m < 12; m++) monthly[y * 12 + m] = 10 + 5 * Math.sin((m / 12) * 2 * Math.PI) + y;
    monthly[3 * 12 + 5] = NaN;
    const clim = monthlyClimatology(monthly, 0, 1);
    const annual = annualAnomalies(monthly, clim);
    expect(Array.from(annual).map(v => +v.toFixed(6))).toEqual([-0.5, 0.5, 1.5, 2.5]);
    expect(Number.isNaN(annualAnomalies(monthly, clim, 12)[3])).toBe(true);
  });
});

describe('derived measures', () => {
  it('signal-to-noise grows with the trend relative to the noise', () => {
    const t = idx(40);
    const noise = t.map(i => 0.5 * Math.sin(i * 2.1));
    const weak = trendTest(t, t.map((i, k) => 0.005 * i + noise[k]));
    const strong = trendTest(t, t.map((i, k) => 0.05 * i + noise[k]));
    const sw = signalToNoise(t, t.map((i, k) => 0.005 * i + noise[k]), weak);
    const ss = signalToNoise(t, t.map((i, k) => 0.05 * i + noise[k]), strong);
    expect(Math.abs(ss)).toBeGreaterThan(2);
    expect(Math.abs(sw)).toBeLessThan(Math.abs(ss));
  });

  it('produces one estimate per admissible start year', () => {
    const t = idx(44).map(i => 1981 + i);
    const out = startYearSensitivity(t, t.map(v => v * 0.02), 20);
    expect(out).toHaveLength(25);
    expect(out[0].start).toBe(1981);
    expect(out.at(-1)!.start).toBe(2005);
    out.forEach(point => expect(point.slope).toBeCloseTo(0.02, 10));
  });

  it('weightedMean ignores missing values and renormalises', () => {
    expect(weightedMean([1, NaN, 3], [1, 5, 3])).toBeCloseTo(2.5, 12);
  });
});

describe('stepScreen', () => {
  const t = Array.from({length: 44}, (_, i) => 1981 + i);
  const wiggle = (i: number) => 0.15 * Math.sin(i * 1.9) + 0.1 * Math.cos(i * 0.7);

  it('flags a record that is a jump, not a ramp', () => {
    const y = t.map((year, i) => (year < 1998 ? 0.6 : -0.3) + wiggle(i));
    const s = stepScreen(t, y)!;
    expect(s.breakAt).toBe(1998);
    expect(s.step).toBeCloseTo(-0.9, 1);
    expect(s.deltaBic).toBeGreaterThan(6);
    expect(s.stepDominated).toBe(true);
    // The naive test would have called this a significant cooling trend.
    expect(trendTest(t, y).p).toBeLessThan(0.05);
  });

  it('leaves a genuine ramp alone', () => {
    const y = t.map((_, i) => 0.03 * i + wiggle(i));
    const s = stepScreen(t, y)!;
    expect(s.stepDominated).toBe(false);
    expect(s.residualTrendP).toBeLessThan(0.05);
  });
});

describe('yearsToSignificance', () => {
  it('is zero for a strong trend and grows as the signal weakens', () => {
    expect(yearsToSignificance(0.05, 0.3, 44)).toBe(0);
    const weak = yearsToSignificance(0.005, 0.3, 20);
    const weaker = yearsToSignificance(0.0025, 0.3, 20);
    expect(weak).toBeGreaterThan(0);
    expect(weaker).toBeGreaterThan(weak);
    expect(yearsToSignificance(0, 0.3, 20)).toBe(Infinity);
  });

  it('matches the closed form', () => {
    // N(N^2-1) >= 12 (1.96 * 0.3 / 0.01)^2 = 41,489  ->  N = 35
    expect(yearsToSignificance(0.01, 0.3, 30)).toBe(5);
  });
});

describe('agreement', () => {
  const tt = (slope: number, low: number, high: number, p: number) =>
    ({n: 44, slope, slopeLow: low, slopeHigh: high, intercept: 0, s: 0, tau: 0, p, pRaw: p, inflation: 1});
  it('classifies the cases Bilad reports', () => {
    expect(agreement(tt(0.011, 0.004, 0.018, 0.01), tt(0.011, 0.004, 0.018, 0.01))).toBe('corroborated');
    expect(agreement(tt(0.018, 0.01, 0.025, 0.001), tt(0.034, 0.028, 0.04, 0.001))).toBe('same-direction');
    expect(agreement(tt(-0.019, -0.036, -0.001, 0.03), tt(0.035, 0.027, 0.042, 0.001))).toBe('contradicted');
    expect(agreement(tt(0.02, -0.01, 0.05, 0.27), tt(-0.02, -0.06, 0.02, 0.26))).toBe('no-signal');
    expect(agreement(tt(0.02, 0.01, 0.03, 0.01), tt(0.01, -0.01, 0.03, 0.2))).toBe('weakly-supported');
    expect(agreement(tt(0.02, 0.01, 0.03, 0.01), tt(-0.01, -0.03, 0.01, 0.3))).toBe('unsupported');
  });
});
