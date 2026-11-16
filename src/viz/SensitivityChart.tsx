import {CHROME, ticks, textScale} from './chrome';
import {num, pPhrase, signed} from '../lib/format';
import {useWidth} from './useWidth';
import {ReadoutMark, ReadoutText, useChartHover} from './readout';
import type {Help} from '../features/HelpTip';
import {VStack} from '@astryxdesign/core/Stack';
import type {StartYearPoint} from '../lib/stats';

type Props = {points: StartYearPoint[]; unit: string; digits: number; title: string};

/**
 * Trend estimate (per decade) against the first year of the record, with
 * its 95% interval. Filled dots pass the corrected test. A finding worth
 * keeping holds its sign and significance whichever start year you choose.
 */
export function SensitivityChart({points, unit, digits, title}: Props) {
  const [ref, W] = useWidth<SVGSVGElement>(640);
  const H = 150;
  const TS = textScale();
  const m = {l: 40 * TS, r: 12, t: 10 * TS, b: 24 * TS};
  const first = points[0]?.start ?? 0;
  const last = points[points.length - 1]?.start ?? 0;
  const x = (s: number) => m.l + ((s - first) / Math.max(1, last - first)) * (W - m.l - m.r);
  const hover = useChartHover(points.length, sx => {
    let best = 0;
    points.forEach((p, i) => {
      if (Math.abs(x(p.start) - sx) < Math.abs(x(points[best].start) - sx)) best = i;
    });
    return best;
  });
  if (!points.length) return null;
  const hov = hover.index;
  const lo = Math.min(0, ...points.map(p => p.slopeLow).filter(Number.isFinite));
  const hi = Math.max(0, ...points.map(p => p.slopeHigh).filter(Number.isFinite));
  const pad = (hi - lo) * 0.08 || 0.1;
  const y0 = lo - pad;
  const y1 = hi + pad;
  const y = (v: number) => m.t + ((y1 - v) / (y1 - y0)) * (H - m.t - m.b);
  const sig = points.filter(p => p.p < 0.05).length;
  const sameSign = points.filter(p => Math.sign(p.slope) === Math.sign(points[0].slope)).length;
  const band =
    points.map((p, i) => `${i ? 'L' : 'M'}${x(p.start).toFixed(1)},${y(p.slopeHigh).toFixed(1)}`).join('') +
    [...points].reverse().map(p => `L${x(p.start).toFixed(1)},${y(p.slopeLow).toFixed(1)}`).join('') +
    'Z';
  return (
    <VStack gap={1}>
    <svg
      ref={ref}
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      role="group"
      aria-label={`${title}. ${sig} of ${points.length} start years give a significant trend; ${sameSign} keep the same sign.`}
      tabIndex={0}
      style={{display: 'block', cursor: 'crosshair'}}
      {...hover.handlers}
    >
      <title>{title}</title>
      {ticks(y0, y1, 3).map(v => (
        <g key={v}>
          <line x1={m.l} x2={W - m.r} y1={y(v)} y2={y(v)} stroke={v === 0 ? CHROME.axis : CHROME.grid} strokeWidth={v === 0 ? 1 : 0.6} />
          <text x={m.l - 6} y={y(v) + 3.5 * TS} fontSize={10 * TS} fill={CHROME.muted} textAnchor="end" fontFamily={CHROME.font}>
            {num(v, digits)}
          </text>
        </g>
      ))}
      <path d={band} fill={CHROME.ink} fillOpacity={0.08} />
      <path d={points.map((p, i) => `${i ? 'L' : 'M'}${x(p.start).toFixed(1)},${y(p.slope).toFixed(1)}`).join('')} fill="none" stroke={CHROME.ink} strokeWidth={1.4} />
      {points.map(p => (
        <circle key={p.start} cx={x(p.start)} cy={y(p.slope)} r={2.6} fill={p.p < 0.05 ? CHROME.ink : CHROME.body} stroke={CHROME.ink} strokeWidth={1} />
      ))}
      {points
        .filter(p => p.start % 5 === 0 || p.start === first || p.start === last)
        .map(p => (
          <text key={p.start} x={x(p.start)} y={H - 7} fontSize={10 * TS} fill={CHROME.muted} textAnchor={p.start === last ? 'end' : p.start === first ? 'start' : 'middle'} fontFamily={CHROME.font}>
            {p.start}
          </text>
        ))}
      {hov !== null && <ReadoutMark x={x(points[hov].start)} y={y(Number.isFinite(points[hov].slope) ? points[hov].slope : 0)} top={m.t} bottom={H - m.b} r={4} />}
    </svg>
    <ReadoutText lines={hov === null ? null : [`Start ${points[hov].start}`, `${signed(points[hov].slope, digits)} ${unit}/decade`, `95% range ${signed(points[hov].slopeLow, digits)} to ${signed(points[hov].slopeHigh, digits)}`, pPhrase(points[hov].p)]} help={SENSITIVITY_HELP} />
    </VStack>
  );
}

const SENSITIVITY_HELP: Help = {
  title: 'Does the start year matter?',
  what: 'Each dot is the trend you would get if the record began in that year and ran to the end. A finding worth relying on keeps the same direction whichever start year you pick; one that flips depends on where the record starts. Filled dots are statistically significant; the shaded band is the 95% range.',
  how: 'Point at, tap or arrow through the start years to read each estimate below the chart.',
  detail: 'Theil–Sen trend per decade re-estimated from every start year that still leaves a long enough window (10 to 20 years, depending on the record). Dots are filled when the Hamed–Rao-corrected Mann–Kendall test gives p < 0.05; the band is the Gilbert (1987) 95% interval.',
  method: 'theil-sen',
};
