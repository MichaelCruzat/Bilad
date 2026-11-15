import {getVariable} from '../data/variables';
import {divergingColor, robustLimit} from './color';
import {CHROME} from './chrome';
import {signed} from '../lib/format';
import {useWidth} from './useWidth';

type Props = {
  years: number[];
  series: ArrayLike<number>;
  variable: string;
  /** Rows after this year are drawn faintly (for a playing timeline). */
  current: number;
  unit: string;
  title: string;
};

/**
 * One row per year, top to bottom: a bar left of the axis for below normal,
 * right for above. Designed to stand beside a tall map and fill in as a
 * timeline plays, so a regime change reads as a block of colour.
 */
export function YearLedger({years, series, variable, current, unit, title}: Props) {
  const def = getVariable(variable);
  const [ref, W] = useWidth<SVGSVGElement>(220);
  const H = 600;
  const top = 8;
  const rowH = (H - top - 18) / years.length;
  const lim = robustLimit(series);
  const mid = W / 2 + 14;
  const half = W / 2 - 22;
  const x = (v: number) => mid + (Math.max(-lim, Math.min(lim, v)) / lim) * half;
  const ci = years.indexOf(current);
  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="none" role="img" aria-label={`${title}. Values through ${current} shown in full.`} style={{display: 'block'}}>
      <title>{title}</title>
      <line x1={mid} x2={mid} y1={top} y2={H - 18} stroke={CHROME.axis} />
      {years.map((yr, i) => {
        const v = series[i];
        if (!Number.isFinite(v)) return null;
        const y = top + i * rowH;
        const done = yr <= current;
        return (
          <g key={yr}>
            <rect x={Math.min(x(v), mid)} y={y + rowH * 0.15} width={Math.max(1, Math.abs(x(v) - mid))} height={rowH * 0.7} fill={divergingColor(def.palette, v, lim)} fillOpacity={done ? 1 : 0.12} rx={1} />
            {(yr % 10 === 0 || yr === years[0] || yr === years[years.length - 1]) && (
              <text x={0} y={y + rowH * 0.75} fontSize={10} fill={CHROME.faint} fontFamily={CHROME.mono}>
                {yr}
              </text>
            )}
          </g>
        );
      })}
      {ci >= 0 && Number.isFinite(series[ci]) && (
        <g>
          <rect x={30} y={top + ci * rowH} width={W - 30} height={rowH} fill="none" stroke={CHROME.ink} strokeOpacity={0.6} />
          <text x={W - 2} y={top + ci * rowH - 3} fontSize={10} fill={CHROME.ink} fontFamily={CHROME.mono} textAnchor="end">
            {signed(series[ci], 0)}
            {unit}
          </text>
        </g>
      )}
      <text x={mid - 6} y={H - 4} fontSize={10} fill={CHROME.faint} fontFamily={CHROME.mono} textAnchor="end">
        drier
      </text>
      <text x={mid + 6} y={H - 4} fontSize={10} fill={CHROME.faint} fontFamily={CHROME.mono}>
        wetter
      </text>
    </svg>
  );
}
