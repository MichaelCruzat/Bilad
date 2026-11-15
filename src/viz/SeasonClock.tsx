import {getVariable} from '../data/variables';
import {divergingColor, robustLimit} from './color';
import {CHROME} from './chrome';
import {fdrThreshold, type TrendTest} from '../lib/stats';
import {signed} from '../lib/format';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type Props = {trends: TrendTest[]; variable: string; unit: string; title: string};

/**
 * Twelve monthly trends as a radial bar chart: bar length is the size of
 * the change, colour its direction. A ring marks months that pass a
 * Benjamini–Hochberg test across the twelve, so the clock does not invite
 * reading meaning into chance.
 */
export function SeasonClock({trends, variable, unit, title}: Props) {
  const def = getVariable(variable);
  const slopes = trends.map(t => t.slope);
  const lim = robustLimit(slopes);
  const pStar = fdrThreshold(trends.map(t => t.p), 0.1);
  const S = 240;
  const c = S / 2;
  const r0 = 30;
  const r1 = 100;
  const arc = (i: number, len: number) => {
    const a0 = ((i - 0.42) / 12) * 2 * Math.PI - Math.PI / 2;
    const a1 = ((i + 0.42) / 12) * 2 * Math.PI - Math.PI / 2;
    const r = r0 + len;
    const p = (rad: number, a: number) => `${(c + rad * Math.cos(a)).toFixed(1)},${(c + rad * Math.sin(a)).toFixed(1)}`;
    return `M${p(r0, a0)}L${p(r, a0)}A${r},${r} 0 0 1 ${p(r, a1)}L${p(r0, a1)}A${r0},${r0} 0 0 0 ${p(r0, a0)}Z`;
  };
  const summary = trends
    .map((t, i) => `${MONTHS[i]} ${signed(t.slope, def.digits)}${pStar > 0 && t.p <= pStar ? ' (significant)' : ''}`)
    .join(', ');
  return (
    <svg viewBox={`0 0 ${S} ${S}`} width="100%" style={{maxWidth: 280, display: 'block'}} role="img" aria-label={`${title}. ${summary}. Units: ${unit} per decade.`}>
      <title>{title}</title>
      <circle cx={c} cy={c} r={r0} fill="none" stroke={CHROME.axis} />
      <circle cx={c} cy={c} r={r1} fill="none" stroke={CHROME.grid} strokeDasharray="2 3" />
      {trends.map((t, i) => {
        const len = Number.isFinite(t.slope) ? (Math.min(Math.abs(t.slope), lim) / lim) * (r1 - r0) : 0;
        const sig = pStar > 0 && t.p <= pStar;
        return (
          <g key={i}>
            <path d={arc(i, Math.max(1, len))} fill={divergingColor(def.palette, t.slope, lim)} stroke={sig ? CHROME.ink : 'none'} strokeWidth={1.2}>
              <title>{`${MONTHS[i]}: ${signed(t.slope, def.digits)} ${unit}/decade, p = ${t.p.toFixed(3)}`}</title>
            </path>
            <text
              x={c + (r1 + 12) * Math.cos((i / 12) * 2 * Math.PI - Math.PI / 2)}
              y={c + (r1 + 12) * Math.sin((i / 12) * 2 * Math.PI - Math.PI / 2) + 3.5}
              fontSize={9.5}
              fill={sig ? CHROME.ink : CHROME.muted}
              textAnchor="middle"
              fontFamily={CHROME.font}
            >
              {MONTHS[i][0]}
            </text>
          </g>
        );
      })}
      <text x={c} y={c - 2} fontSize={9} fill={CHROME.muted} textAnchor="middle" fontFamily={CHROME.font}>
        ±{lim < 1 ? lim.toFixed(2) : lim.toFixed(lim < 10 ? 1 : 0)}
      </text>
      <text x={c} y={c + 10} fontSize={8} fill={CHROME.faint} textAnchor="middle" fontFamily={CHROME.font}>
        per decade
      </text>
    </svg>
  );
}
