import {CHROME, ticks, textScale} from './chrome';
import {num, signed} from '../lib/format';
import {useWidth} from './useWidth';
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
  if (!points.length) return null;
  const lo = Math.min(0, ...points.map(p => p.slopeLow).filter(Number.isFinite));
  const hi = Math.max(0, ...points.map(p => p.slopeHigh).filter(Number.isFinite));
  const pad = (hi - lo) * 0.08 || 0.1;
  const y0 = lo - pad;
  const y1 = hi + pad;
  const first = points[0].start;
  const last = points[points.length - 1].start;
  const x = (s: number) => m.l + ((s - first) / Math.max(1, last - first)) * (W - m.l - m.r);
  const y = (v: number) => m.t + ((y1 - v) / (y1 - y0)) * (H - m.t - m.b);
  const sig = points.filter(p => p.p < 0.05).length;
  const sameSign = points.filter(p => Math.sign(p.slope) === Math.sign(points[0].slope)).length;
  const band =
    points.map((p, i) => `${i ? 'L' : 'M'}${x(p.start).toFixed(1)},${y(p.slopeHigh).toFixed(1)}`).join('') +
    [...points].reverse().map(p => `L${x(p.start).toFixed(1)},${y(p.slopeLow).toFixed(1)}`).join('') +
    'Z';
  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      role="img"
      aria-label={`${title}. ${sig} of ${points.length} start years give a significant trend; ${sameSign} keep the same sign.`}
      style={{display: 'block'}}
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
        <circle key={p.start} cx={x(p.start)} cy={y(p.slope)} r={2.6} fill={p.p < 0.05 ? CHROME.ink : CHROME.body} stroke={CHROME.ink} strokeWidth={1}>
          <title>{`Start ${p.start}: ${signed(p.slope, digits)} ${unit}/decade, p = ${p.p.toFixed(3)}`}</title>
        </circle>
      ))}
      {points
        .filter(p => p.start % 5 === 0 || p.start === first || p.start === last)
        .map(p => (
          <text key={p.start} x={x(p.start)} y={H - 7} fontSize={10 * TS} fill={CHROME.muted} textAnchor="middle" fontFamily={CHROME.font}>
            {p.start}
          </text>
        ))}
    </svg>
  );
}
