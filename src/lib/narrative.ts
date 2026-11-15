/**
 * Plain-language findings, generated deterministically from the numbers.
 * Every sentence maps to a statistic shown next to it.
 */
import {getVariable} from '../data/variables';
import {residualSd, yearsToSignificance, type SeriesAnalysis} from './stats';
import {pValue, signed} from './format';

export type Finding = {headline: string; significance: string; emergence: string; record: string};

export function describe(variable: string, unit: string, a: SeriesAnalysis, years: number[], series: ArrayLike<number>): Finding {
  const def = getVariable(variable);
  const digits = unit === '% of normal' ? 1 : def.digits;
  const t = a.trend;
  const span = years[years.length - 1] - years[0];
  const total = t.slope * span;
  const dir = t.slope > 0 ? def.up : def.down;
  const perDecade = `${signed(t.slope * 10, digits)} ${unit} per decade`;
  const range = `95% range ${signed(t.slopeLow * 10, digits)} to ${signed(t.slopeHigh * 10, digits)}`;
  const headline = Number.isFinite(t.slope)
    ? `${def.short}: ${perDecade} (${range}), ${signed(total, digits)} ${unit} across ${years[0]}–${years[years.length - 1]}.`
    : `${def.short}: not enough data in this window.`;

  let significance: string;
  if (t.p < 0.05) {
    significance = `The ${dir} trend is statistically significant after correcting for year-to-year persistence (Mann–Kendall, Hamed–Rao corrected p = ${pValue(t.p)}).`;
  } else {
    const sd = residualSd(years, series, t.slope, t.intercept);
    const more = yearsToSignificance(t.slope, sd, t.n, t.inflation);
    const wait = Number.isFinite(more)
      ? ` At the current rate and variability it would take roughly ${more} more year${more === 1 ? '' : 's'} of record to tell apart from chance.`
      : '';
    significance = `This is not yet distinguishable from natural year-to-year swings (corrected p = ${pValue(t.p)}).${wait}`;
  }

  const s = Math.abs(a.snr);
  const emergence = !Number.isFinite(s)
    ? ''
    : s >= 2
      ? `The change across the window is ${s.toFixed(1)}× the typical year-to-year swing: it has clearly emerged from the noise.`
      : s >= 1
        ? `The change across the window is ${s.toFixed(1)}× the typical year-to-year swing: it has emerged, but a single unusual year can still hide it.`
        : `The change across the window is smaller than a typical year-to-year swing (${s.toFixed(1)}×).`;

  const record = `${t.n} annual values; trend tests assume no step change in how the data were produced.`;
  return {headline, significance, emergence, record};
}
