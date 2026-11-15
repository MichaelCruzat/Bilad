import {useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent} from 'react';
import {geoAzimuthalEqualArea, geoCentroid, geoPath, type GeoProjection} from 'd3-geo';
import type {Boundary, NationMeta} from '../lib/nationData';
import type {VariableAnalysis} from '../lib/analysis';
import {getVariable} from '../data/variables';
import {divergingColor, emergenceRamp, robustLimit} from './color';
import {lat as fmtLat, signed} from '../lib/format';
import {CHROME} from './chrome';

export type MapLayer = 'change' | 'emergence' | 'normal';

export type MapGeometry = {
  projection: GeoProjection;
  width: number;
  height: number;
  boundaryPath: string;
  cellPaths: string[];
  centers: [number, number][];
};

const PAD = 12;

export function useMapGeometry(meta: NationMeta, boundary: Boundary, maxW: number, maxH: number): MapGeometry {
  return useMemo(() => {
    const [lon0, lat0] = geoCentroid(boundary);
    const projection = geoAzimuthalEqualArea().rotate([-lon0, -lat0]).fitExtent([[0, 0], [maxW, maxH]], boundary);
    const path = geoPath(projection);
    const [[x0, y0], [x1, y1]] = path.bounds(boundary);
    const [tx, ty] = projection.translate();
    projection.translate([tx - x0 + PAD, ty - y0 + PAD]);
    const {dLat, dLon} = meta.grid;
    const cellPaths: string[] = [];
    const centers: [number, number][] = [];
    for (const c of meta.cells) {
      const corners: [number, number][] = [
        [c.lon - dLon / 2, c.lat - dLat / 2],
        [c.lon + dLon / 2, c.lat - dLat / 2],
        [c.lon + dLon / 2, c.lat + dLat / 2],
        [c.lon - dLon / 2, c.lat + dLat / 2],
      ];
      const pts = corners.map(p => projection(p)!);
      cellPaths.push(`M${pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L')}Z`);
      centers.push(projection([c.lon, c.lat])!);
    }
    return {
      projection,
      width: x1 - x0 + 2 * PAD,
      height: y1 - y0 + 2 * PAD,
      boundaryPath: geoPath(projection)(boundary) ?? '',
      cellPaths,
      centers,
    };
  }, [meta, boundary, maxW, maxH]);
}

export type CellColoring = {colors: string[]; limit: number; kind: 'diverging' | 'sequential'; min: number; max: number};

export function colorCells(analysis: VariableAnalysis, layer: MapLayer): CellColoring {
  const def = getVariable(analysis.variable);
  if (layer === 'normal') {
    let min = Infinity;
    let max = -Infinity;
    analysis.normal.forEach(v => {
      if (Number.isFinite(v)) {
        min = Math.min(min, v);
        max = Math.max(max, v);
      }
    });
    const colors = Array.from(analysis.normal, v => (Number.isFinite(v) ? emergenceRamp(0.08 + (0.92 * (v - min)) / (max - min || 1)) : '#202329'));
    return {colors, limit: 0, kind: 'sequential', min, max};
  }
  const values = layer === 'change' ? analysis.slope : analysis.snr;
  const limit = layer === 'change' ? robustLimit(values) : 3;
  return {colors: Array.from(values, v => divergingColor(def.palette, v, limit)), limit, kind: 'diverging', min: -limit, max: limit};
}

type Props = {
  meta: NationMeta;
  boundary: Boundary;
  analysis: VariableAnalysis;
  layer: MapLayer;
  showSignificance?: boolean;
  selected?: number | null;
  onSelect?: (cell: number | null) => void;
  onHover?: (cell: number | null) => void;
  band?: [number, number] | null;
  onBand?: (band: [number, number] | null) => void;
  /** Cells to emphasise; others are dimmed. */
  emphasis?: ReadonlySet<number> | null;
  showProfile?: boolean;
  maxHeight?: number;
  title: string;
};

const PROFILE_W = 150;
const PROFILE_GAP = 28;

export function NationMap({
  meta,
  boundary,
  analysis,
  layer,
  showSignificance = true,
  selected = null,
  onSelect,
  onHover,
  band = null,
  onBand,
  emphasis = null,
  showProfile = true,
  maxHeight = 620,
  title,
}: Props) {
  const clipId = useId().replace(/:/g, '');
  const geo = useMapGeometry(meta, boundary, 560, maxHeight);
  const coloring = useMemo(() => colorCells(analysis, layer), [analysis, layer]);
  const [hover, setHover] = useState<number | null>(null);
  const [drag, setDrag] = useState<[number, number] | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const profileX0 = geo.width + PROFILE_GAP;
  const totalW = showProfile ? profileX0 + PROFILE_W + 8 : geo.width;
  const totalH = geo.height + (showProfile ? 22 : 0);
  const values = layer === 'normal' ? analysis.normal : layer === 'change' ? analysis.slope : analysis.snr;
  const pLim = layer === 'normal' ? Math.max(Math.abs(coloring.min), Math.abs(coloring.max)) : coloring.limit;
  const px = (v: number) =>
    layer === 'normal'
      ? profileX0 + ((v - coloring.min) / (coloring.max - coloring.min || 1)) * PROFILE_W
      : profileX0 + PROFILE_W / 2 + (Math.max(-pLim, Math.min(pLim, v)) / pLim) * (PROFILE_W / 2);

  const inBand = (c: number) => !band || (meta.cells[c].lat >= band[0] && meta.cells[c].lat <= band[1]);
  const dimmed = (c: number) => (emphasis ? !emphasis.has(c) : !inBand(c));

  const cellLayer = useMemo(
    () =>
      geo.cellPaths.map((d, i) => (
        <path key={i} d={d} data-i={i} fill={coloring.colors[i]} stroke={CHROME.body} strokeWidth={0.4} />
      )),
    [geo, coloring],
  );

  const stipple = useMemo(() => {
    if (!showSignificance || layer === 'normal') return null;
    return geo.centers.map(([x, y], i) =>
      analysis.significant[i] ? <circle key={i} cx={x} cy={y} r={1.3} fill={CHROME.ink} fillOpacity={0.85} pointerEvents="none" /> : null,
    );
  }, [geo, analysis, showSignificance, layer]);

  // Zonal (row) means, area-weighted, for the profile line.
  const rows = useMemo(() => {
    const byLat = new Map<number, {sum: number; w: number; y: number}>();
    meta.cells.forEach((c, i) => {
      const v = values[i];
      if (!Number.isFinite(v)) return;
      const row = byLat.get(c.lat) ?? {sum: 0, w: 0, y: 0};
      row.sum += v * c.areaKm2;
      row.w += c.areaKm2;
      row.y = geo.projection([geo.projection.invert!([geo.width / 2, 0])![0], c.lat])![1];
      byLat.set(c.lat, row);
    });
    return [...byLat.entries()].sort((a, b) => b[0] - a[0]).map(([latV, r]) => ({lat: latV, mean: r.sum / r.w, y: r.y}));
  }, [meta, values, geo]);

  const yToLat = (y: number) => geo.projection.invert!([geo.width / 2, y])![1];
  const latToY = (l: number) => geo.projection([geo.projection.invert!([geo.width / 2, 0])![0], l])![1];

  const eventCell = (e: PointerEvent<SVGElement>) => {
    const i = (e.target as SVGElement).getAttribute('data-i');
    return i === null ? null : Number(i);
  };

  const svgPoint = (e: PointerEvent<SVGElement>) => {
    const svg = svgRef.current!;
    const rect = svg.getBoundingClientRect();
    const scale = Math.max(totalW / rect.width, totalH / rect.height);
    const offsetY = (rect.height * scale - totalH) / 2;
    return (e.clientY - rect.top) * scale - offsetY;
  };

  const onKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    if (!onSelect) return;
    const moves: Record<string, [number, number]> = {ArrowUp: [1, 0], ArrowDown: [-1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1]};
    if (e.key === 'Escape') {
      onSelect(null);
      return;
    }
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    if (selected === null) {
      onSelect(0);
      return;
    }
    const c = meta.cells[selected];
    const target = meta.cells.findIndex(
      o => Math.abs(o.lat - (c.lat + m[0] * meta.grid.dLat)) < 1e-6 && Math.abs(o.lon - (c.lon + m[1] * meta.grid.dLon)) < 1e-6,
    );
    if (target >= 0) onSelect(target);
  };

  const shown = hover ?? selected;
  const bandY = band ? [latToY(band[1]), latToY(band[0])] : null;
  const dragY = drag ? [Math.min(drag[0], drag[1]), Math.max(drag[0], drag[1])] : null;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${totalW.toFixed(0)} ${totalH.toFixed(0)}`}
      preserveAspectRatio="xMidYMid meet"
      width="100%"
      height="100%"
      role="application"
      aria-label={`${title}. Use arrow keys to move between grid cells, Escape to clear.`}
      tabIndex={onSelect ? 0 : -1}
      onKeyDown={onKeyDown}
      style={{display: 'block', maxHeight: '100%', touchAction: 'none', outline: 'none'}}
    >
      <title>{title}</title>
      <defs>
        <clipPath id={`clip-${clipId}`}>
          <path d={geo.boundaryPath} />
        </clipPath>
      </defs>
      <path d={geo.boundaryPath} fill={CHROME.land} />
      <g
        clipPath={`url(#clip-${clipId})`}
        onPointerMove={e => {
          const c = eventCell(e);
          if (c !== hover) {
            setHover(c);
            onHover?.(c);
          }
        }}
        onPointerLeave={() => {
          setHover(null);
          onHover?.(null);
        }}
        onClick={e => {
          const c = eventCell(e as unknown as PointerEvent<SVGElement>);
          if (c !== null && onSelect) onSelect(c === selected ? null : c);
        }}
        style={{cursor: onSelect ? 'pointer' : 'default'}}
      >
        {cellLayer}
        {(band || emphasis) &&
          geo.cellPaths.map((d, i) => (dimmed(i) ? <path key={i} d={d} fill={CHROME.body} fillOpacity={0.62} pointerEvents="none" /> : null))}
        {stipple}
      </g>
      <path d={geo.boundaryPath} fill="none" stroke={CHROME.muted} strokeOpacity={0.55} strokeWidth={0.8} pointerEvents="none" />
      {shown !== null && (
        <path d={geo.cellPaths[shown]} fill="none" stroke={CHROME.ink} strokeWidth={1.6} pointerEvents="none" />
      )}

      {showProfile && (
        <g aria-hidden="true">
          <line x1={px(layer === 'normal' ? coloring.min : 0)} x2={px(layer === 'normal' ? coloring.min : 0)} y1={PAD} y2={geo.height - PAD} stroke={CHROME.axis} strokeWidth={0.8} />
          {bandY && <rect x={profileX0 - 6} width={PROFILE_W + 12} y={bandY[0]} height={Math.max(2, bandY[1] - bandY[0])} fill={CHROME.ink} fillOpacity={0.08} stroke={CHROME.ink} strokeOpacity={0.4} />}
          {geo.centers.map(([, y], i) =>
            Number.isFinite(values[i]) ? (
              <circle key={i} cx={px(values[i])} cy={y} r={1.4} fill={coloring.colors[i]} fillOpacity={dimmed(i) ? 0.25 : 0.9} />
            ) : null,
          )}
          <path
            d={rows.map((r, k) => `${k ? 'L' : 'M'}${px(r.mean).toFixed(1)},${r.y.toFixed(1)}`).join('')}
            fill="none"
            stroke={CHROME.ink}
            strokeWidth={1.3}
          />
          {shown !== null && Number.isFinite(values[shown]) && (
            <circle cx={px(values[shown])} cy={geo.centers[shown][1]} r={3.2} fill="none" stroke={CHROME.ink} strokeWidth={1.2} />
          )}
          {dragY && <rect x={profileX0 - 6} width={PROFILE_W + 12} y={dragY[0]} height={dragY[1] - dragY[0]} fill={CHROME.ink} fillOpacity={0.15} />}
          <text x={profileX0} y={geo.height + 14} fontSize={9} fill={CHROME.muted}>
            {layer === 'normal' ? 'low' : signed(-pLim, pLim < 1 ? 2 : 1)}
          </text>
          <text x={profileX0 + PROFILE_W} y={geo.height + 14} fontSize={9} fill={CHROME.muted} textAnchor="end">
            {layer === 'normal' ? 'high' : signed(pLim, pLim < 1 ? 2 : 1)}
          </text>
          {[...new Set(rows.filter((_, k) => k % Math.max(1, Math.ceil(rows.length / 8)) === 0).map(r => r.lat))].map(l => (
            <text key={l} x={totalW - 2} y={latToY(l) + 3} fontSize={8.5} fill={CHROME.faint} textAnchor="end">
              {fmtLat(l).replace('.00', '')}
            </text>
          ))}
        </g>
      )}
      {showProfile && onBand && (
        <rect
          x={profileX0 - 6}
          y={PAD}
          width={PROFILE_W + 12}
          height={geo.height - 2 * PAD}
          fill="transparent"
          style={{cursor: 'ns-resize'}}
          aria-label="Drag to select a latitude band"
          onPointerDown={e => {
            (e.target as Element).setPointerCapture(e.pointerId);
            const y = svgPoint(e);
            setDrag([y, y]);
          }}
          onPointerMove={e => drag && setDrag([drag[0], svgPoint(e)])}
          onPointerUp={() => {
            if (!drag) return;
            const [a, b] = [Math.min(drag[0], drag[1]), Math.max(drag[0], drag[1])];
            setDrag(null);
            if (b - a < 4) {
              onBand(null);
              return;
            }
            const north = yToLat(a);
            const south = yToLat(b);
            onBand([Math.round(south * 2) / 2, Math.round(north * 2) / 2]);
          }}
        />
      )}
    </svg>
  );
}
