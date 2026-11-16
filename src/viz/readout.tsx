import {useState, type KeyboardEvent, type PointerEvent} from 'react';
import {Text} from '@astryxdesign/core/Text';
import {CHROME} from './chrome';

/**
 * Point-level readouts shared by the charts: point at, tap or arrow through
 * a chart to see the exact values under a guide line. Native <title>
 * tooltips appear late and never on touch, so each chart draws its own.
 */
export function useChartHover(count: number, indexAt: (svgX: number, svgY: number) => number | null) {
  const [index, setIndex] = useState<number | null>(null);
  const locate = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = indexAt(e.clientX - r.left, e.clientY - r.top);
    setIndex(i !== null && i >= 0 && i < count ? i : null);
  };
  return {
    index,
    setIndex,
    handlers: {
      onPointerMove: locate,
      onPointerDown: locate,
      // Touch lifts fire a leave; keep the tapped point on screen until the next tap.
      onPointerLeave: (e: PointerEvent<SVGSVGElement>) => e.pointerType === 'mouse' && setIndex(null),
      onBlur: () => setIndex(null),
      onKeyDown: (e: KeyboardEvent<SVGSVGElement>) => {
        const step = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
        if (e.key === 'Escape') return setIndex(null);
        if (!step || !count) return;
        e.preventDefault();
        setIndex(i => (i === null ? (step > 0 ? 0 : count - 1) : Math.min(count - 1, Math.max(0, i + step))));
      },
    },
  };
}

type ReadoutProps = {
  /** Anchor point in chart pixels (the data point being read). */
  x: number;
  y: number;
  lines: string[];
  /** Chart box the label must stay inside. */
  width: number;
  height: number;
  fontSize: number;
  /** Draw the vertical guide from top to bottom of the plot. */
  guide?: {top: number; bottom: number};
};

/** A boxed label beside the point, flipped to stay inside the chart. */
export function Readout({x, y, lines, width, height, fontSize, guide}: ReadoutProps) {
  const lineH = fontSize * 1.35;
  const padX = fontSize * 0.6;
  const boxW = Math.max(...lines.map(l => l.length)) * fontSize * 0.56 + padX * 2;
  const boxH = lines.length * lineH + fontSize * 0.5;
  const gap = fontSize * 0.8;
  const bx = x + gap + boxW <= width ? x + gap : Math.max(0, x - gap - boxW);
  const by = Math.min(Math.max(0, y - boxH / 2), Math.max(0, height - boxH));
  return (
    <g pointerEvents="none" aria-hidden="true">
      {guide && <line x1={x} x2={x} y1={guide.top} y2={guide.bottom} stroke={CHROME.ink} strokeOpacity={0.45} strokeDasharray="2 3" />}
      <circle cx={x} cy={y} r={fontSize * 0.36} fill="none" stroke={CHROME.ink} strokeWidth={1.4} />
      <rect x={bx} y={by} width={boxW} height={boxH} rx={4} fill={CHROME.body} fillOpacity={0.94} stroke={CHROME.axis} />
      {lines.map((l, k) => (
        <text key={k} x={bx + padX} y={by + fontSize * 0.25 + lineH * (k + 0.78)} fontSize={fontSize} fill={k ? CHROME.muted : CHROME.ink} fontWeight={k ? undefined : 600} fontFamily={CHROME.font}>
          {l}
        </text>
      ))}
    </g>
  );
}

/** Guide line and ring on the point being read; the values go in ReadoutText. */
export function ReadoutMark({x, y, top, bottom, r = 4}: {x: number; y: number; top: number; bottom: number; r?: number}) {
  return (
    <g pointerEvents="none" aria-hidden="true">
      <line x1={x} x2={x} y1={top} y2={bottom} stroke={CHROME.ink} strokeOpacity={0.5} strokeDasharray="2 3" />
      <circle cx={x} cy={y} r={r} fill="none" stroke={CHROME.ink} strokeWidth={1.5} />
    </g>
  );
}

/**
 * The values under the pointer, as a line of text below the chart so the
 * label never covers the data. Announced politely for keyboard readers.
 */
export function ReadoutText({lines, hint}: {lines: string[] | null; hint: string}) {
  return (
    <Text type="supporting" hasTabularNumbers aria-live="polite">
      {lines ? (
        <>
          <Text type="supporting" weight="semibold" color="primary">
            {lines[0]}
          </Text>
          {lines.slice(1).map(l => ` · ${l}`).join('')}
        </>
      ) : (
        hint
      )}
    </Text>
  );
}
