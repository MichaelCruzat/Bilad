import {getVariable} from '../data/variables';
import {divergingColor, robustLimit} from './color';
import {CHROME, textScale} from './chrome';
import {signed} from '../lib/format';
import {useWidth} from './useWidth';
import {ReadoutMark, ReadoutText, useChartHover} from './readout';
import {VStack} from '@astryxdesign/core/Stack';

type Props = {
  years: number[];
  series: ArrayLike<number>;
  variable: string;
  unit: string;
  /** Highlighted year, or null when no year is being shown. */
  current: number | null;
  onPick: (year: number) => void;
  title: string;
};

/**
 * One bar per year, left to right. Point, drag or use the arrow keys to
 * pick a year: the map follows. It doubles as a chart of the global record.
 */
export function YearStrip({years, series, variable, unit, current, onPick, title}: Props) {
  const def = getVariable(variable);
  const [ref, W] = useWidth<SVGSVGElement>(800);
  const TS = textScale();
  const H = Math.round(60 + 32 * TS);
  const m = {l: 34 * TS, r: 8, t: 14 * TS, b: 18 * TS};
  const lim = robustLimit(series);
  const bw = (W - m.l - m.r) / years.length;
  const y = (v: number) => m.t + ((lim - Math.max(-lim, Math.min(lim, v))) / (2 * lim)) * (H - m.t - m.b);
  const pick = (clientX: number, rect: DOMRect) => {
    const i = Math.floor((clientX - rect.left - m.l) / bw);
    if (i >= 0 && i < years.length) onPick(years[i]);
  };
  const ci = current === null ? -1 : years.indexOf(current);
  const hover = useChartHover(years.length, sx => Math.floor((sx - m.l) / bw));
  const hi = hover.index;
  const hv = hi === null ? NaN : series[hi];
  return (
    <VStack gap={1}>
    <svg
      ref={ref}
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      role="slider"
      aria-label={title}
      aria-valuemin={years[0]}
      aria-valuemax={years[years.length - 1]}
      aria-valuenow={current ?? undefined}
      tabIndex={0}
      style={{display: 'block', cursor: 'ew-resize', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none'}}
      onPointerDown={e => {
        e.currentTarget.setPointerCapture(e.pointerId);
        pick(e.clientX, e.currentTarget.getBoundingClientRect());
        hover.handlers.onPointerDown(e);
      }}
      onPointerMove={e => {
        if (e.buttons) pick(e.clientX, e.currentTarget.getBoundingClientRect());
        hover.handlers.onPointerMove(e);
      }}
      onPointerLeave={hover.handlers.onPointerLeave}
      onBlur={hover.handlers.onBlur}
      onKeyDown={e => {
        const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!step) return;
        e.preventDefault();
        const at = current ?? years[years.length - 1];
        onPick(Math.min(years[years.length - 1], Math.max(years[0], at + step)));
      }}
    >
      <title>{title}</title>
      <line x1={m.l} x2={W - m.r} y1={y(0)} y2={y(0)} stroke={CHROME.axis} />
      <text x={m.l - 6} y={y(lim) + 4 * TS} fontSize={10 * TS} fill={CHROME.faint} textAnchor="end" fontFamily={CHROME.font}>
        {signed(lim, lim < 1 ? 1 : 0)}
      </text>
      <text x={m.l - 6} y={y(-lim) + 4 * TS} fontSize={10 * TS} fill={CHROME.faint} textAnchor="end" fontFamily={CHROME.font}>
        {signed(-lim, lim < 1 ? 1 : 0)}
      </text>
      {years.map((yr, i) => {
        const v = series[i];
        if (!Number.isFinite(v)) return null;
        return (
          <rect key={yr} x={m.l + i * bw + bw * 0.12} width={bw * 0.76} y={Math.min(y(v), y(0))} height={Math.max(1, Math.abs(y(v) - y(0)))} rx={1} fill={divergingColor(def.palette, v, lim)} fillOpacity={ci < 0 || i === ci ? 1 : 0.55} />
        );
      })}
      {years.filter(yr => yr % 10 === 0 || yr === years[0] || yr === years[years.length - 1]).map(yr => (
        <text key={yr} x={m.l + (yr - years[0] + 0.5) * bw} y={H - 4} fontSize={10 * TS} fill={CHROME.muted} textAnchor="middle" fontFamily={CHROME.font}>
          {yr}
        </text>
      ))}
      {ci >= 0 && <rect x={m.l + ci * bw} y={m.t - 6} width={bw} height={H - m.t - m.b + 8} fill="none" stroke={CHROME.ink} strokeOpacity={0.8} rx={2} />}
      {hi !== null && <ReadoutMark x={m.l + (hi + 0.5) * bw} y={y(Number.isFinite(hv) ? hv : 0)} top={m.t} bottom={H - m.b} r={3.5} />}
    </svg>
    <ReadoutText lines={hi === null ? null : [String(years[hi]), Number.isFinite(hv) ? `${signed(hv, 2)} ${unit}` : 'no data']} hint="Point at a bar to read that year's value." />
    </VStack>
  );
}
