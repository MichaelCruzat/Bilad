/**
 * Plain-language findings, generated deterministically from the numbers.
 * Every sentence maps to a statistic shown next to it.
 */
import {getVariable} from '../data/variables';
import {residualSd, yearsToSignificance, type SeriesAnalysis} from './stats';
import {pPhrase, signed} from './format';

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
  // A straight-line total is meaningful for temperature; for a share of the
  // normal it reads as "rain fell 70%", so relative variables omit it.
  const totalText = unit === '% of normal' ? '' : `, ${signed(total, digits)} ${unit} across ${years[0]}–${years[years.length - 1]}`;
  const headline = Number.isFinite(t.slope)
    ? `${def.short}: ${perDecade} (${range})${totalText}.`
    : `${def.short}: not enough data in this window.`;

  let significance: string;
  if (t.p < 0.05) {
    significance = `The ${dir} trend is statistically significant, even allowing for warm or dry years that cluster (${pPhrase(t.p)}).`;
  } else {
    const sd = residualSd(years, series, t.slope, t.intercept);
    const more = yearsToSignificance(t.slope, sd, t.n, t.inflation);
    const wait = more < 1
      ? ' It sits close to the significance threshold; a few more years of records at this rate would likely settle it.'
      : !Number.isFinite(more) || more > 100
      ? ' Even if it continued at this rate, it would take more than a century of further records to tell apart from chance.'
      : ` If it continued at this rate, with the same year-to-year noise, it would take ${more < 10 ? `about ${more}` : `roughly ${Math.round(more / 10) * 10}`} more years of records to tell apart from chance.`;
    significance = `This is not yet distinguishable from natural year-to-year swings (corrected ${pPhrase(t.p)}).${wait}`;
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
