import {useId} from 'react';
import {getVariable} from '../data/variables';
import {divergingColor, emergenceRamp} from './color';
import {CHROME} from './chrome';
import {num, signed} from '../lib/format';
import type {MapLayer, CellColoring} from './NationMap';

type Props = {variable: string; layer: MapLayer; coloring: CellColoring; unit: string};

export function Legend({variable, layer, coloring, unit}: Props) {
  const id = useId().replace(/:/g, '');
  const def = getVariable(variable);
  const stops = Array.from({length: 24}, (_, i) => i / 23);
  const color = (t: number) =>
    layer === 'normal' ? emergenceRamp(0.08 + 0.92 * t) : divergingColor(def.palette, -1 + 2 * t, 1);
  const digits = coloring.limit < 1 ? 2 : coloring.limit < 10 ? 1 : 0;
  const labels =
    layer === 'normal'
      ? [num(coloring.min, def.digits > 1 ? 1 : 0), '', num(coloring.max, def.digits > 1 ? 1 : 0)]
      : [signed(-coloring.limit, digits), '0', signed(coloring.limit, digits)];
  const caption =
    layer === 'change' ? `${unit} per decade` : layer === 'emergence' ? 'signal ÷ year-to-year noise' : `1991–2020 normal, ${def.unit}`;
  return (
    <svg viewBox="0 0 240 46" width="100%" role="img" aria-label={`Legend: ${caption}, from ${labels[0]} to ${labels[2]}`}>
      <defs>
        <linearGradient id={`lg-${id}`}>
          {stops.map(t => (
            <stop key={t} offset={t} stopColor={color(t)} />
          ))}
        </linearGradient>
      </defs>
      <rect x={0} y={4} width={240} height={10} rx={2} fill={`url(#lg-${id})`} />
      {labels.map((l, i) => (
        <text key={i} x={i * 120} y={27} fontSize={10} fill={CHROME.muted} textAnchor={i === 0 ? 'start' : i === 1 ? 'middle' : 'end'} fontFamily={CHROME.font}>
          {l}
        </text>
      ))}
      <text x={0} y={42} fontSize={10} fill={CHROME.faint} fontFamily={CHROME.font}>
        {caption}
      </text>
    </svg>
  );
}
