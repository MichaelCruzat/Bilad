import {getVariable} from '../data/variables';
import {divergingColor, robustLimit} from './color';
import {CHROME, textScale} from './chrome';
import {fdrThreshold, type TrendTest} from '../lib/stats';
import {num, signed} from '../lib/format';
import {useWidth} from './useWidth';

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type Props = {trends: TrendTest[]; variable: string; unit: string; digits: number; title: string};

/**
 * Twelve bars, one per calendar month, above or below zero. Outlined bars
 * pass a Benjamini–Hochberg test across the twelve months; the rest are
 * exploratory, so the chart does not invite reading meaning into chance.
 */
export function MonthStrip({trends, variable, unit, digits, title}: Props) {
  const def = getVariable(variable);
  const [ref, W] = useWidth<SVGSVGElement>(400);
  const H = 150;
  const TS = textScale();
  const m = {l: 36 * TS, r: 8, t: 10 * TS, b: 20 * TS};
  const lim = robustLimit(trends.map(t => t.slope));
  const pStar = fdrThreshold(trends.map(t => t.p), 0.1);
  const bw = (W - m.l - m.r) / 12;
  const y = (v: number) => m.t + ((lim - Math.max(-lim, Math.min(lim, v))) / (2 * lim)) * (H - m.t - m.b);
  const summary = trends.map((t, i) => `${NAMES[i]} ${signed(t.slope, digits)}${pStar > 0 && t.p <= pStar ? ' (significant)' : ''}`).join(', ');
  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label={`${title}. ${summary}. ${unit} per decade.`} style={{display: 'block'}}>
      <title>{title}</title>
      {[lim, 0, -lim].map(v => (
        <g key={v}>
          <line x1={m.l} x2={W - m.r} y1={y(v)} y2={y(v)} stroke={v === 0 ? CHROME.axis : CHROME.grid} />
          <text x={m.l - 6} y={y(v) + 3.5 * TS} fontSize={10 * TS} fill={CHROME.muted} textAnchor="end" fontFamily={CHROME.font}>
            {v === 0 ? '0' : signed(v, lim < 1 ? 2 : lim < 10 ? 1 : 0)}
          </text>
        </g>
      ))}
      {trends.map((t, i) => {
        const sig = pStar > 0 && t.p <= pStar;
        const v = Number.isFinite(t.slope) ? t.slope : 0;
        return (
          <g key={i}>
            <rect
              x={m.l + i * bw + bw * 0.18}
              width={bw * 0.64}
              y={Math.min(y(v), y(0))}
              height={Math.max(1, Math.abs(y(v) - y(0)))}
              fill={divergingColor(def.palette, v, lim)}
              stroke={sig ? CHROME.ink : 'none'}
              strokeWidth={1.2}
              rx={1}
            >
              <title>{`${NAMES[i]}: ${signed(t.slope, digits)} ${unit}/decade, p = ${num(t.p, 3)}`}</title>
            </rect>
            <text x={m.l + i * bw + bw / 2} y={H - 5} fontSize={10 * TS} fill={sig ? CHROME.ink : CHROME.muted} textAnchor="middle" fontFamily={CHROME.font}>
              {MONTHS[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
