import {getVariable} from '../data/variables';
import {divergingColor} from './color';
import {CHROME, ticks} from './chrome';
import {num} from '../lib/format';
import {useWidth} from './useWidth';
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

/**
 * Annual anomalies as bars coloured by their own value (a stripe chart you
 * can read), the Theil–Sen line with its 95% fan, the independent witness as
 * a line, and the best single step when the integrity screen prefers it.
 */
export function SeriesChart({years, series, analysis, variable, unit, witness, witnessLabel, step, title, height = 220}: Props) {
  const def = getVariable(variable);
  const [ref, W] = useWidth<SVGSVGElement>(640);
  const H = height;
  const m = {l: 40, r: 12, t: 30, b: 26};
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
  const tickStep = yt.length > 1 ? yt[1] - yt[0] : 1;
  const tickDigits = (String(+tickStep.toPrecision(6)).split('.')[1] ?? '').length;
  const xt = years.filter(yr => yr % 10 === 0 || yr === years[0]);

  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label={title} style={{display: 'block'}}>
      <title>{title}</title>
      {yt.map(v => (
        <g key={v}>
          <line x1={m.l} x2={W - m.r} y1={y(v)} y2={y(v)} stroke={v === 0 ? CHROME.axis : CHROME.grid} strokeWidth={v === 0 ? 1 : 0.6} />
          <text x={m.l - 6} y={y(v) + 3.5} fontSize={10} fill={CHROME.muted} textAnchor="end" fontFamily={CHROME.font}>
            {num(v, tickDigits)}
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
      <text x={4} y={m.t - 4} fontSize={10} fill={CHROME.faint} fontFamily={CHROME.font}>
        {unit}
      </text>
      <g fontSize={11} fontFamily={CHROME.font}>
        {(() => {
          // Items flow left to right; widths estimated from character count.
          const items: {key: string; label: string; mark: 'bars' | 'trend' | 'witness'}[] = [
            {key: 'bars', label: 'yearly value', mark: 'bars'},
            {key: 'trend', label: trend.p < 0.05 ? 'Sen trend' : 'Sen trend (not significant)', mark: 'trend'},
            ...(witness ? [{key: 'witness', label: witnessLabel ?? 'Independent record', mark: 'witness' as const}] : []),
          ];
          let x = m.l;
          return items.map(item => {
            const x0 = x;
            x += 22 + item.label.length * 5.9 + 14;
            return (
              <g key={item.key}>
                {item.mark === 'bars' ? (
                  <>
                    <rect x={x0} y={5} width={6} height={10} rx={1} fill={divergingColor(def.palette, lim, lim)} />
                    <rect x={x0 + 8} y={5} width={6} height={10} rx={1} fill={divergingColor(def.palette, -lim, lim)} />
                  </>
                ) : (
                  <line x1={x0} x2={x0 + 16} y1={10} y2={10} stroke={item.mark === 'trend' ? CHROME.ink : CHROME.witness} strokeWidth={1.7} strokeDasharray={item.mark === 'trend' && trend.p >= 0.05 ? '5 4' : undefined} />
                )}
                <text x={x0 + 21} y={14} fill={CHROME.muted}>
                  {item.label}
                </text>
              </g>
            );
          });
        })()}
      </g>
    </svg>
  );
}
