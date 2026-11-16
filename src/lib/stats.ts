/**
 * TRACE statistics engine.
 *
 * Pure, dependency-free functions shared by the offline data pipeline
 * (`pipeline/`) and the browser (`src/`). Nothing here knows about NASA,
 * nations or React; every function takes plain numbers and returns plain
 * numbers, so the same code produces the shipped headline figures and the
 * figures a reader recomputes in their own browser.
 *
 * Methods and references:
 *  - Mann–Kendall trend test with tie correction (Mann 1945; Kendall 1975).
 *  - Hamed & Rao (1998) variance correction for serial correlation, applied
 *    to the ranks of the Sen-detrended series, significant lags only.
 *  - Theil–Sen slope (Theil 1950; Sen 1968) with the rank-based confidence
 *    interval of Gilbert (1987).
 *  - Pettitt (1979) non-parametric change-point test.
 *  - Benjamini & Hochberg (1995) false-discovery-rate control, used for
 *    field significance on maps as recommended by Wilks (2016).
 *  - Signal-to-noise ratio of the fitted change against interannual
 *    variability, the "emergence" measure of Hawkins & Sutton (2012).
 */

export const Z_975 = 1.959963984540054;

/** Standard normal CDF (Abramowitz & Stegun 7.1.26 via erf; |error| < 1.5e-7). */
export function normalCdf(z: number): number {
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x);
  return 0.5 * (1 + sign * erf);
}

export function median(sorted: ArrayLike<number>): number {
  const n = sorted.length;
  if (n === 0) return NaN;
  const mid = n >> 1;
  return n % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function mean(values: ArrayLike<number>): number {
  let sum = 0;
  let count = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (Number.isFinite(v)) {
      sum += v;
      count++;
    }
  }
  return count ? sum / count : NaN;
}

/**
 * Values are rounded to 1e-9 before testing. Annual means of quantised
 * monthly data can be exactly equal in real arithmetic yet differ in the
 * last floating-point bit depending on summation order, so without this a
 * tie in one implementation (or language) is not a tie in another.
 */
export const TIE_PRECISION = 1e9;

/** Drop pairs where y is not finite; round y so ties are detected identically everywhere. */
export function finitePairs(t: ArrayLike<number>, y: ArrayLike<number>): {t: number[]; y: number[]} {
  const outT: number[] = [];
  const outY: number[] = [];
  for (let i = 0; i < y.length; i++) {
    if (Number.isFinite(y[i]) && Number.isFinite(t[i])) {
      outT.push(t[i]);
      outY.push(Math.round(y[i] * TIE_PRECISION) / TIE_PRECISION);
    }
  }
  return {t: outT, y: outY};
}

function sign(v: number): number {
  return v > 0 ? 1 : v < 0 ? -1 : 0;
}

/** Mann–Kendall S statistic and tie-corrected variance. */
export function mannKendallS(y: ArrayLike<number>): {s: number; varS: number} {
  const n = y.length;
  let s = 0;
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) s += sign(y[j] - y[i]);
  }
  const ties = new Map<number, number>();
  for (let i = 0; i < n; i++) ties.set(y[i], (ties.get(y[i]) ?? 0) + 1);
  let tieTerm = 0;
  ties.forEach(t => {
    if (t > 1) tieTerm += t * (t - 1) * (2 * t + 5);
  });
  const varS = (n * (n - 1) * (2 * n + 5) - tieTerm) / 18;
  return {s, varS};
}

/** Continuity-corrected Z score and two-sided p-value for a given S and variance. */
export function mkZ(s: number, varS: number): {z: number; p: number} {
  if (varS <= 0) return {z: 0, p: 1};
  const z = s > 0 ? (s - 1) / Math.sqrt(varS) : s < 0 ? (s + 1) / Math.sqrt(varS) : 0;
  return {z, p: Math.min(1, 2 * (1 - normalCdf(Math.abs(z))))};
}

/** All pairwise slopes, sorted ascending. */
export function pairwiseSlopes(t: ArrayLike<number>, y: ArrayLike<number>): Float64Array {
  const n = y.length;
  const out = new Float64Array((n * (n - 1)) / 2);
  let k = 0;
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) {
      const dt = t[j] - t[i];
      if (dt !== 0) out[k++] = (y[j] - y[i]) / dt;
    }
  }
  return out.subarray(0, k).sort();
}

function ranks(values: ArrayLike<number>): Float64Array {
  const n = values.length;
  const idx = Array.from({length: n}, (_, i) => i).sort((a, b) => values[a] - values[b]);
  const out = new Float64Array(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && values[idx[j + 1]] === values[idx[i]]) j++;
    const r = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) out[idx[k]] = r;
    i = j + 1;
  }
  return out;
}

/** Lag-k sample autocorrelation (biased estimator, as in Hamed & Rao). */
export function autocorrelation(x: ArrayLike<number>, lag: number): number {
  const n = x.length;
  const m = mean(x);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    den += (x[i] - m) ** 2;
    if (i + lag < n) num += (x[i] - m) * (x[i + lag] - m);
  }
  return den === 0 ? 0 : num / den;
}

/**
 * Hamed & Rao (1998) variance inflation factor n/n*.
 * Computed on ranks of the Sen-detrended series; only lags whose
 * autocorrelation is significant at 5% contribute. Clamped to >= 1 so the
 * correction can only make the test more conservative.
 */
export function hamedRaoFactor(t: ArrayLike<number>, y: ArrayLike<number>, slope: number): number {
  const n = y.length;
  if (n < 4) return 1;
  const detrended = new Float64Array(n);
  for (let i = 0; i < n; i++) detrended[i] = y[i] - slope * t[i];
  const r = ranks(detrended);
  const bound = Z_975 / Math.sqrt(n);
  let sum = 0;
  for (let k = 1; k < n - 2; k++) {
    const rho = autocorrelation(r, k);
    if (Math.abs(rho) > bound) sum += (n - k) * (n - k - 1) * (n - k - 2) * rho;
  }
  const factor = 1 + (2 / (n * (n - 1) * (n - 2))) * sum;
  return Math.max(1, factor);
}

export type TrendTest = {
  /** Number of finite observations used. */
  n: number;
  /** Theil–Sen slope, units per time step (per year for annual series). */
  slope: number;
  /** Gilbert (1987) 95% interval for the slope, using the corrected variance. */
  slopeLow: number;
  slopeHigh: number;
  intercept: number;
  s: number;
  tau: number;
  /** Two-sided p-value with Hamed–Rao serial-correlation correction. */
  p: number;
  /** Two-sided p-value of the classic (uncorrected) Mann–Kendall test. */
  pRaw: number;
  /** Variance inflation factor applied (>= 1). */
  inflation: number;
};

export function trendTest(tIn: ArrayLike<number>, yIn: ArrayLike<number>): TrendTest {
  const {t, y} = finitePairs(tIn, yIn);
  const n = y.length;
  if (n < 4) {
    return {n, slope: NaN, slopeLow: NaN, slopeHigh: NaN, intercept: NaN, s: 0, tau: 0, p: 1, pRaw: 1, inflation: 1};
  }
  const slopes = pairwiseSlopes(t, y);
  const slope = median(slopes);
  const {s, varS} = mannKendallS(y);
  const inflation = hamedRaoFactor(t, y, slope);
  const varCorrected = varS * inflation;
  const {p: pRaw} = mkZ(s, varS);
  const {p} = mkZ(s, varCorrected);

  const nSlopes = slopes.length;
  const c = Z_975 * Math.sqrt(varCorrected);
  const lowIdx = Math.max(0, Math.round((nSlopes - c) / 2) - 1);
  const highIdx = Math.min(nSlopes - 1, Math.round((nSlopes + c) / 2));
  const tSorted = Float64Array.from(t).sort();
  const ySorted = Float64Array.from(y).sort();
  const intercept = median(ySorted) - slope * median(tSorted);

  return {
    n,
    slope,
    slopeLow: slopes[lowIdx],
    slopeHigh: slopes[highIdx],
    intercept,
    s,
    tau: s / ((n * (n - 1)) / 2),
    p,
    pRaw,
    inflation,
  };
}

export type ChangePoint = {
  /** Index of the last observation of the first regime. */
  index: number;
  /** Time value of the first observation of the new regime. */
  breakAt: number;
  k: number;
  p: number;
  meanBefore: number;
  meanAfter: number;
};

/** Pettitt (1979) change-point test with the standard asymptotic p-value. */
export function pettitt(tIn: ArrayLike<number>, yIn: ArrayLike<number>): ChangePoint | null {
  const {t, y} = finitePairs(tIn, yIn);
  const n = y.length;
  if (n < 6) return null;
  let best = 0;
  let bestIdx = 0;
  // U_t = U_{t-1} + sum_j sgn(x_t - x_j)
  let u = 0;
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < n; j++) u += sign(y[i] - y[j]);
    if (Math.abs(u) > best) {
      best = Math.abs(u);
      bestIdx = i;
    }
  }
  const p = Math.min(1, 2 * Math.exp((-6 * best * best) / (n ** 3 + n ** 2)));
  return {
    index: bestIdx,
    breakAt: t[bestIdx + 1],
    k: best,
    p,
    meanBefore: mean(y.slice(0, bestIdx + 1)),
    meanAfter: mean(y.slice(bestIdx + 1)),
  };
}

/**
 * Benjamini–Hochberg FDR control. Returns the largest p-value threshold p*
 * such that every p <= p* is declared significant (0 when none are).
 * Wilks (2016) recommends alpha_FDR = 0.10 for a nominal 5% field test.
 */
export function fdrThreshold(pValues: ArrayLike<number>, alpha = 0.1): number {
  const ps = Array.from(pValues).filter(Number.isFinite).sort((a, b) => a - b);
  const m = ps.length;
  let threshold = 0;
  for (let k = 0; k < m; k++) {
    if (ps[k] <= ((k + 1) / m) * alpha) threshold = ps[k];
  }
  return threshold;
}

/** Sample standard deviation of residuals around a line (n - 2 dof). */
export function residualSd(t: ArrayLike<number>, y: ArrayLike<number>, slope: number, intercept: number): number {
  let ss = 0;
  let n = 0;
  for (let i = 0; i < y.length; i++) {
    if (!Number.isFinite(y[i])) continue;
    ss += (y[i] - (intercept + slope * t[i])) ** 2;
    n++;
  }
  return n > 2 ? Math.sqrt(ss / (n - 2)) : NaN;
}

/**
 * Signal-to-noise ratio: the fitted change across the window divided by the
 * standard deviation of interannual residuals. |S/N| >= 1 is the usual
 * "emerged" threshold and >= 2 "clearly emerged" (Hawkins & Sutton 2012).
 */
export function signalToNoise(t: ArrayLike<number>, y: ArrayLike<number>, trend: TrendTest): number {
  const {t: ft} = finitePairs(t, y);
  if (ft.length < 4 || !Number.isFinite(trend.slope)) return NaN;
  const span = ft[ft.length - 1] - ft[0];
  const sd = residualSd(t, y, trend.slope, trend.intercept);
  return sd > 0 ? (trend.slope * span) / sd : NaN;
}

/**
 * Monthly climatology for a year-major monthly series (length years*12).
 * `baseFrom`/`baseTo` are inclusive year offsets into the series.
 */
export function monthlyClimatology(monthly: ArrayLike<number>, baseFrom: number, baseTo: number): Float64Array {
  const clim = new Float64Array(12);
  for (let m = 0; m < 12; m++) {
    let sum = 0;
    let count = 0;
    for (let yr = baseFrom; yr <= baseTo; yr++) {
      const v = monthly[yr * 12 + m];
      if (Number.isFinite(v)) {
        sum += v;
        count++;
      }
    }
    clim[m] = count ? sum / count : NaN;
  }
  return clim;
}

/**
 * Annual anomalies: mean of the monthly anomalies within each year,
 * kept only when at least `minMonths` months are present. Averaging
 * anomalies, not raw values, keeps a missing month from biasing the year.
 */
export function annualAnomalies(monthly: ArrayLike<number>, clim: ArrayLike<number>, minMonths = 10): Float64Array {
  const years = Math.floor(monthly.length / 12);
  const out = new Float64Array(years);
  for (let yr = 0; yr < years; yr++) {
    let sum = 0;
    let count = 0;
    for (let m = 0; m < 12; m++) {
      const v = monthly[yr * 12 + m];
      if (Number.isFinite(v) && Number.isFinite(clim[m])) {
        sum += v - clim[m];
        count++;
      }
    }
    out[yr] = count >= minMonths ? sum / count : NaN;
  }
  return out;
}

/** Values for one calendar month across years (length = years). */
export function calendarMonth(monthly: ArrayLike<number>, month: number): Float64Array {
  const years = Math.floor(monthly.length / 12);
  const out = new Float64Array(years);
  for (let yr = 0; yr < years; yr++) out[yr] = monthly[yr * 12 + month];
  return out;
}

export type SeriesAnalysis = {
  trend: TrendTest;
  snr: number;
  changePoint: ChangePoint | null;
};

export function analyzeSeries(t: ArrayLike<number>, y: ArrayLike<number>): SeriesAnalysis {
  const trend = trendTest(t, y);
  return {trend, snr: signalToNoise(t, y, trend), changePoint: pettitt(t, y)};
}

export type StartYearPoint = {start: number; slope: number; slopeLow: number; slopeHigh: number; p: number};

/**
 * Start-year sensitivity: re-estimate the trend for every start year that
 * still leaves at least `minLength` years before the fixed end. A finding
 * that only holds for one convenient start year is a fragile finding.
 */
export function startYearSensitivity(t: ArrayLike<number>, y: ArrayLike<number>, minLength = 20): StartYearPoint[] {
  const out: StartYearPoint[] = [];
  for (let i = 0; i + minLength <= t.length; i++) {
    const tr = trendTest(Array.prototype.slice.call(t, i), Array.prototype.slice.call(y, i));
    out.push({start: t[i], slope: tr.slope, slopeLow: tr.slopeLow, slopeHigh: tr.slopeHigh, p: tr.p});
  }
  return out;
}

/** Weighted mean ignoring non-finite values (weights renormalised). */
export function weightedMean(values: ArrayLike<number>, weights: ArrayLike<number>): number {
  let sum = 0;
  let wsum = 0;
  for (let i = 0; i < values.length; i++) {
    if (Number.isFinite(values[i]) && weights[i] > 0) {
      sum += values[i] * weights[i];
      wsum += weights[i];
    }
  }
  return wsum ? sum / wsum : NaN;
}

function ols(t: ArrayLike<number>, y: ArrayLike<number>): {slope: number; intercept: number; rss: number} {
  const n = y.length;
  let mt = 0, my = 0;
  for (let i = 0; i < n; i++) {
    mt += t[i];
    my += y[i];
  }
  mt /= n;
  my /= n;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (t[i] - mt) * (y[i] - my);
    sxx += (t[i] - mt) ** 2;
  }
  const slope = sxx ? sxy / sxx : 0;
  const intercept = my - slope * mt;
  let rss = 0;
  for (let i = 0; i < n; i++) rss += (y[i] - intercept - slope * t[i]) ** 2;
  return {slope, intercept, rss};
}

export type StepScreen = {
  /** First year of the new regime under the best single-step model. */
  breakAt: number;
  /** Mean after minus mean before. */
  step: number;
  bicTrend: number;
  bicStep: number;
  /** BIC(trend) - BIC(step); > 6 is a heuristic warning, not a calibrated error rate. */
  deltaBic: number;
  /** Corrected Mann–Kendall p of the series after removing the two regime means. */
  residualTrendP: number;
  /** True when a step explains the record better than a trend and no trend survives inside the regimes. */
  stepDominated: boolean;
};

/**
 * Integrity screen. A reanalysis record can jump when the observing system
 * that feeds it changes; such a jump masquerades as a trend. This compares a
 * straight-line model with a single step (best break, segments >= `minSegment`
 * years, so late-record acceleration is not mistaken for a jump)
 * by BIC, and re-tests for trend once the step is removed. Pettitt alone cannot
 * make this distinction, because any trending series has a "break" mid-record.
 */
export function stepScreen(tIn: ArrayLike<number>, yIn: ArrayLike<number>, minSegment = 8): StepScreen | null {
  const {t, y} = finitePairs(tIn, yIn);
  const n = y.length;
  if (n < 2 * minSegment) return null;
  const trend = ols(t, y);
  let bestRss = Infinity;
  let bestK = minSegment;
  let bestBefore = 0;
  let bestAfter = 0;
  for (let k = minSegment; k <= n - minSegment; k++) {
    let a = 0, b = 0;
    for (let i = 0; i < k; i++) a += y[i];
    for (let i = k; i < n; i++) b += y[i];
    a /= k;
    b /= n - k;
    let rss = 0;
    for (let i = 0; i < n; i++) rss += (y[i] - (i < k ? a : b)) ** 2;
    if (rss < bestRss) {
      bestRss = rss;
      bestK = k;
      bestBefore = a;
      bestAfter = b;
    }
  }
  const bic = (rss: number, k: number) => n * Math.log(Math.max(rss, 1e-12) / n) + k * Math.log(n);
  // Trend: intercept, slope, variance. Step: two means, break location, variance.
  const bicTrend = bic(trend.rss, 3);
  const bicStep = bic(bestRss, 4);
  const residual = y.map((v, i) => v - (i < bestK ? bestBefore : bestAfter));
  const residualTrendP = trendTest(t, residual).p;
  const deltaBic = bicTrend - bicStep;
  return {
    breakAt: t[bestK],
    step: bestAfter - bestBefore,
    bicTrend,
    bicStep,
    deltaBic,
    residualTrendP,
    stepDominated: deltaBic > 6 && residualTrendP >= 0.05,
  };
}

/**
 * Approximate further years of record needed before a trend of the current
 * size, against the current interannual noise, would reach 5% significance:
 * smallest N with |b| / (sigma * sqrt(12 / (N (N^2 - 1)))) >= 1.96 * sqrt(inflation).
 * Returns 0 when already significant and Infinity for a zero slope.
 */
export function yearsToSignificance(slope: number, sigma: number, n: number, inflation = 1): number {
  if (!Number.isFinite(slope) || !Number.isFinite(sigma) || slope === 0) return Infinity;
  const target = 12 * ((Z_975 * sigma) / Math.abs(slope)) ** 2 * inflation;
  let N = Math.max(n, 3);
  if (N * (N * N - 1) >= target) return 0;
  while (N * (N * N - 1) < target && N < 10000) N++;
  return N >= 10000 ? Infinity : N - n;
}

export type Agreement = 'corroborated' | 'same-direction' | 'weakly-supported' | 'contradicted' | 'no-signal' | 'unsupported';

/**
 * Compare a reanalysis trend with an independent, observation-based one.
 *  corroborated      both significant, same sign, 95% intervals overlap
 *  same-direction    both significant, same sign, intervals do not overlap
 *  weakly-supported  one significant, the other same sign but not significant
 *  contradicted      opposite signs, both significant
 *  unsupported       opposite signs, only one significant
 *  no-signal         neither is significant
 */
export function agreement(a: TrendTest, b: TrendTest, alpha = 0.05): Agreement {
  const sa = a.p < alpha;
  const sb = b.p < alpha;
  const same = Math.sign(a.slope) === Math.sign(b.slope);
  if (!sa && !sb) return 'no-signal';
  if (!same) return sa && sb ? 'contradicted' : 'unsupported';
  if (sa && sb) return a.slopeLow <= b.slopeHigh && b.slopeLow <= a.slopeHigh ? 'corroborated' : 'same-direction';
  return 'weakly-supported';
}
