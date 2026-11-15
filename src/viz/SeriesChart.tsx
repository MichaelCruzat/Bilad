import {getVariable} from '../data/variables';
import {divergingColor} from './color';
import {CHROME, ticks} from './chrome';
import {num} from '../lib/format';
import type {SeriesAnalysis, StepScreen} from '../lib/stats';

type Props = {
  years: number[];
  series: ArrayLike<number>;
  analysis: SeriesAnalysis;
  variable: string;
  unit: string;
  /** Independent record on the same footprint, same units. */
  witness?: ArrayLike<number> | null;
  witnessLabel?: string;
  step?: StepScreen | null;
  title: string;
  height?: number;
};

const W = 640;

/**
 * Annual anomalies as bars coloured by their own value (a stripe chart you
 * can read), the Theil–Sen line with its 95% fan, the independent witness as
 * a line, and the best single step when the integrity screen prefers it.
 */
export function SeriesChart({years, series, analysis, variable, unit, witness, witnessLabel, step, title, height = 220}: Props) {
  const def = getVariable(variable);
  const H = height;
  const m = {l: 40, r: 12, t: 14, b: 26};
  const vals = Array.from(series).filter(Number.isFinite);
  const wVals = witness ? Array.from(witness).filter(Number.isFinite) : [];
  const all = [...vals, ...wVals, 0];
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const pad = (hi - lo) * 0.1 || 1;
  const y0 = lo - pad;
  const y1 = hi + pad;
  const x = (yr: number) => m.l + ((yr - years[0] + 0.5) / years.length) * (W - m.l - m.r);
  const y = (v: number) => m.t + ((y1 - v) / (y1 - y0)) * (H - m.t - m.b);
  const bw = ((W - m.l - m.r) / years.length) * 0.78;
  const lim = Math.max(Math.abs(lo), Math.abs(hi));
  const {trend} = analysis;
  const tMid = (years[0] + years[years.length - 1]) / 2;
  const line = (slope: number) => {
    // Pivot the bounds on the Sen line's value at mid-window so the fan opens both ways.
    const yMid = trend.intercept + trend.slope * tMid;
    return [years[0], years[years.length - 1]].map(yr => [x(yr), y(yMid + slope * (yr - tMid))] as const);
  };
  const sen = line(trend.slope);
  const fanLo = line(trend.slopeLow);
  const fanHi = line(trend.slopeHigh);
  const yt = ticks(y0, y1, 4);
  const xt = years.filter(yr => yr % 10 === 0 || yr === years[0]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={title} style={{display: 'block'}}>
      <title>{title}</title>
      {yt.map(v => (
        <g key={v}>
          <line x1={m.l} x2={W - m.r} y1={y(v)} y2={y(v)} stroke={v === 0 ? CHROME.axis : CHROME.grid} strokeWidth={v === 0 ? 1 : 0.6} />
          <text x={m.l - 6} y={y(v) + 3.5} fontSize={10} fill={CHROME.muted} textAnchor="end" fontFamily={CHROME.font}>
            {num(v, Math.abs(y1 - y0) < 4 ? 1 : 0)}
          </text>
        </g>
      ))}
      {xt.map(yr => (
        <text key={yr} x={x(yr)} y={H - 8} fontSize={10} fill={CHROME.muted} textAnchor="middle" fontFamily={CHROME.font}>
          {yr}
        </text>
      ))}
      {years.map((yr, i) => {
        const v = series[i];
        if (!Number.isFinite(v)) return null;
        return (
          <rect key={yr} x={x(yr) - bw / 2} width={bw} y={Math.min(y(v), y(0))} height={Math.max(0.6, Math.abs(y(v) - y(0)))} fill={divergingColor(def.palette, v, lim)} rx={0.8}>
            <title>{`${yr}: ${num(v, 2)} ${unit}`}</title>
          </rect>
        );
      })}
      {Number.isFinite(trend.slopeLow) && (
        <path
          d={`M${fanLo[0][0]},${fanLo[0][1]}L${fanLo[1][0]},${fanLo[1][1]}L${fanHi[1][0]},${fanHi[1][1]}L${fanHi[0][0]},${fanHi[0][1]}Z`}
          fill={CHROME.ink}
          fillOpacity={0.08}
        />
      )}
      {Number.isFinite(trend.slope) && (
        <line x1={sen[0][0]} y1={sen[0][1]} x2={sen[1][0]} y2={sen[1][1]} stroke={CHROME.ink} strokeWidth={1.8} strokeDasharray={trend.p < 0.05 ? undefined : '5 4'} />
      )}
      {witness && (
        <path
          d={years
            .map((yr, i) => (Number.isFinite(witness[i]) ? `${i && Number.isFinite(witness[i - 1]) ? 'L' : 'M'}${x(yr).toFixed(1)},${y(witness[i]).toFixed(1)}` : ''))
            .join('')}
          fill="none"
          stroke={CHROME.witness}
          strokeWidth={1.6}
        />
      )}
      {step?.stepDominated && (
        <g>
          <line x1={x(step.breakAt) - bw * 0.64} x2={x(step.breakAt) - bw * 0.64} y1={m.t} y2={H - m.b} stroke={CHROME.accent} strokeDasharray="3 3" />
          <text x={x(step.breakAt) - bw * 0.64 + 4} y={m.t + 9} fontSize={10} fill={CHROME.accent} fontFamily={CHROME.font}>
            jump in {step.breakAt}
          </text>
        </g>
      )}
      <g fontSize={10} fontFamily={CHROME.font}>
        <line x1={W - m.r - 190} x2={W - m.r - 174} y1={m.t + 2} y2={m.t + 2} stroke={CHROME.ink} strokeWidth={1.8} strokeDasharray={trend.p < 0.05 ? undefined : '5 4'} />
        <text x={W - m.r - 170} y={m.t + 5.5} fill={CHROME.muted}>
          {trend.p < 0.05 ? 'Sen trend' : 'Sen trend (not significant)'}
        </text>
        {witness && (
          <>
            <line x1={W - m.r - 190} x2={W - m.r - 174} y1={m.t + 16} y2={m.t + 16} stroke={CHROME.witness} strokeWidth={1.6} />
            <text x={W - m.r - 170} y={m.t + 19.5} fill={CHROME.muted}>
              {witnessLabel ?? 'Independent record'}
            </text>
          </>
        )}
      </g>
    </svg>
  );
}
