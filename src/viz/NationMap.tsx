import {useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent} from 'react';
import {select} from 'd3-selection';
import 'd3-transition';
import {zoom as d3zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform} from 'd3-zoom';
import {prefersReducedMotion} from './usePlayback';
import {geoBounds, geoPath, geoProjection, type GeoProjection} from 'd3-geo';
import {reliefUrl, type Boundary, type Context, type NationMeta} from '../lib/nationData';
import type {VariableAnalysis} from '../lib/analysis';
import {getVariable} from '../data/variables';
import {divergingColor, emergenceRamp, NO_DATA, robustLimit} from './color';
import {lat as fmtLat, num, signed} from '../lib/format';
import {CHROME, rootPx} from './chrome';
import {Readout} from './readout';
import {HelpTip, type Help} from '../features/HelpTip';
import {Button} from '@astryxdesign/core/Button';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {fullName} from '../lib/names';
import {regionalLinesInBounds, useRegionalBoundaries, type Bounds} from '../lib/regionalBoundaries';

export type MapLayer = 'change' | 'emergence' | 'normal' | 'year';

export type MapGeometry = {
  projection: GeoProjection;
  width: number;
  height: number;
  boundaryPath: string;
  cellPaths: string[];
  centers: [number, number][];
  /** Where relief.jpg sits, in SVG units. */
  image: {x: number; y: number; width: number; height: number} | null;
  neighbours: {path: string; name: string; label: [number, number] | null}[];
};

/**
 * Cylindrical projection with its standard parallel at the middle of the
 * extent: linear in longitude and latitude, so NASA GIBS imagery (EPSG:4326)
 * sits under the grid cells without resampling, and true to scale along the
 * central parallel. Statistics never depend on the projection; every cell
 * carries its true area.
 */
function nationProjection(lon0: number, lat0: number): GeoProjection {
  const k = Math.cos((lat0 * Math.PI) / 180);
  const raw = Object.assign((x: number, y: number): [number, number] => [x * k, y], {
    invert: (x: number, y: number): [number, number] => [x / k, y],
  });
  return geoProjection(raw).rotate([-lon0, 0]);
}

export function useMapGeometry(meta: NationMeta, boundary: Boundary, maxW: number, maxH: number, context?: Context | null): MapGeometry {
  return useMemo(() => {
    const [bw, bs, be, bn] = geoBounds(boundary).flat() as number[];
    const [w, s, e, n] = meta.extent ?? [bw - 0.5, bs - 0.5, be + 0.5, bn + 0.5];
    const projection = nationProjection((w + e) / 2, (s + n) / 2);
    projection.fitExtent([[0, 0], [maxW, maxH]], {type: 'MultiPoint', coordinates: [[w, s], [e, s], [e, n], [w, n]]});
    const [x0, y0] = projection([w, n])!;
    const [x1, y1] = projection([e, s])!;
    const [tx, ty] = projection.translate();
    projection.translate([tx - x0, ty - y0]);
    const path = geoPath(projection);
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
    const width = x1 - x0;
    const height = y1 - y0;
    const neighbours = (context?.features ?? []).map(f => {
      const centre = f.properties.label ? projection(f.properties.label) : null;
      const inside = centre && centre[0] > 40 && centre[0] < width - 40 && centre[1] > 16 && centre[1] < height - 16;
      return {path: path(f) ?? '', name: f.properties.name, label: f.properties.share > 0.04 && inside ? (centre as [number, number]) : null};
    });
    return {
      projection,
      width,
      height,
      boundaryPath: path(boundary) ?? '',
      cellPaths,
      centers,
      image: meta.extent ? {x: 0, y: 0, width, height} : null,
      neighbours,
    };
  }, [meta, boundary, maxW, maxH, context]);
}

export type CellColoring = {colors: string[]; limit: number; kind: 'diverging' | 'sequential'; min: number; max: number};

const yearLimits = new WeakMap<VariableAnalysis, number>();

/** Values shown for a layer: per-cell trend, S/N, normal, or one year's anomaly. */
export function layerValues(analysis: VariableAnalysis, layer: MapLayer, year?: number): ArrayLike<number> {
  if (layer === 'normal') return analysis.normal;
  if (layer === 'change') return analysis.slope;
  if (layer === 'emergence') return analysis.snr;
  const ny = analysis.years.length;
  const yi = Math.max(0, Math.min(ny - 1, (year ?? analysis.window.to) - analysis.window.from));
  return Float32Array.from({length: analysis.normal.length}, (_, c) => analysis.annual[c * ny + yi]);
}

export function colorCells(analysis: VariableAnalysis, layer: MapLayer, year?: number): CellColoring {
  const def = getVariable(analysis.variable);
  if (layer === 'year') {
    // One colour scale for every year, so an animation compares like with like.
    let limit = yearLimits.get(analysis);
    if (limit === undefined) {
      limit = robustLimit(analysis.annual);
      yearLimits.set(analysis, limit);
    }
    const values = layerValues(analysis, 'year', year);
    return {colors: Array.from(values, v => divergingColor(def.palette, v, limit)), limit, kind: 'diverging', min: -limit, max: limit};
  }
  if (layer === 'normal') {
    let min = Infinity;
    let max = -Infinity;
    analysis.normal.forEach(v => {
      if (Number.isFinite(v)) {
        min = Math.min(min, v);
        max = Math.max(max, v);
      }
    });
    const colors = Array.from(analysis.normal, v => (Number.isFinite(v) ? emergenceRamp(0.08 + (0.92 * (v - min)) / (max - min || 1)) : NO_DATA));
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
  /**
   * CSS height limit. When set, the map fills its column's width and takes
   * its height from the nation's shape up to this limit, so tall nations
   * such as Chile grow down the page instead of shrinking to fit a box.
   * Without it, the map fits inside its parent's height.
   */
  heightCap?: string;
  /** Unit caption under the latitude profile, e.g. "°C per decade". */
  unitLabel?: string;
  /** Cell groups drawn with a coloured outline (for contrasts). */
  outlines?: {cells: number[]; color: string}[];
  /** Neighbouring borders for context. */
  context?: Context | null;
  /** Lines for the floating hover tooltip. */
  describeCell?: (cell: number) => string[];
  /** Year shown by the 'year' layer. */
  year?: number;
  /** Show +/−/reset buttons on the map. */
  showZoomControls?: boolean;
  title: string;
};

/** Inset for the profile's vertical extent. */
const PAD = 12;
const PROFILE_W = 150;
const PROFILE_GAP = 28;
const LABEL_W = 58;

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
  heightCap,
  unitLabel,
  outlines = [],
  context = null,
  describeCell,
  year,
  showZoomControls = true,
  title,
}: Props) {
  const clipId = useId().replace(/:/g, '');
  const geo = useMapGeometry(meta, boundary, 560, maxHeight, context);
  const coloring = useMemo(() => colorCells(analysis, layer, year), [analysis, layer, year]);
  const [hover, setHover] = useState<number | null>(null);
  const [drag, setDrag] = useState<[number, number] | null>(null);
  const [profileY, setProfileY] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<SVGGElement>(null);
  const zoomer = useRef<ZoomBehavior<SVGGElement, unknown> | null>(null);
  const [zt, setZt] = useState<ZoomTransform>(zoomIdentity);
  const regional = useRegionalBoundaries(zt.k);
  const regionalPath = useMemo(() => {
    if (!regional) return null;
    const bounds = meta.extent ?? geoBounds(boundary).flat() as Bounds;
    return geoPath(geo.projection)({type: 'MultiLineString', coordinates: regionalLinesInBounds(regional, bounds).map(line => line.points)});
  }, [regional, geo, meta, boundary]);
  const reduced = useMemo(() => prefersReducedMotion(), []);
  // Screen pixels per SVG unit, so labels and buttons keep a readable,
  // tappable size however large or small the map is drawn.
  const [screen, setScreen] = useState(1);

  // Zoom and pan on the map only (the latitude profile stays put).
  useEffect(() => {
    const el = zoomRef.current;
    if (!el) return;
    const behaviour = d3zoom<SVGGElement, unknown>()
      .scaleExtent([1, 14])
      .extent([[0, 0], [geo.width, geo.height]])
      .translateExtent([[0, 0], [geo.width, geo.height]])
      .on('zoom', event => setZt(event.transform));
    zoomer.current = behaviour;
    select(el).call(behaviour).on('dblclick.zoom', null);
    select(el).call(behaviour.transform, zoomIdentity);
    return () => {
      select(el).on('.zoom', null);
    };
  }, [geo]);

  const zoomBy = (factor: number) => {
    const el = zoomRef.current;
    if (el && zoomer.current) select(el).transition().duration(reduced ? 0 : 320).call(zoomer.current.scaleBy, factor);
  };
  const zoomReset = () => {
    const el = zoomRef.current;
    if (el && zoomer.current) select(el).transition().duration(reduced ? 0 : 420).call(zoomer.current.transform, zoomIdentity);
  };
  const zoomTo = (cell: number) => {
    const el = zoomRef.current;
    if (!el || !zoomer.current) return;
    const [cx, cy] = geo.centers[cell];
    const k = Math.max(zt.k, 4);
    const t = zoomIdentity.translate(geo.width / 2 - cx * k, geo.height / 2 - cy * k).scale(k);
    select(el).transition().duration(reduced ? 0 : 520).call(zoomer.current.transform, t);
  };

  const profileX0 = geo.width + PROFILE_GAP;
  const totalW = showProfile ? profileX0 + PROFILE_W + LABEL_W : geo.width;
  const totalH = geo.height + (showProfile ? 40 : 0);
  useEffect(() => {
    const el = svgRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setScreen(Math.min(r.width / totalW, r.height / totalH));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [totalW, totalH]);
  /** SVG units for a size in screen pixels that follows the page's root size. */
  const u = (screenPx: number) => (screenPx * (rootPx() / 16)) / screen;
  /** Profile labels: readable, but never wider than the room beside the profile. */
  const profileFont = Math.min(u(12), 15);
  const values = useMemo(() => layerValues(analysis, layer, year), [analysis, layer, year]);
  const pLim = layer === 'normal' ? Math.max(Math.abs(coloring.min), Math.abs(coloring.max)) : coloring.limit;
  const px = (v: number) =>
    layer === 'normal'
      ? profileX0 + ((v - coloring.min) / (coloring.max - coloring.min || 1)) * PROFILE_W
      : profileX0 + PROFILE_W / 2 + (Math.max(-pLim, Math.min(pLim, v)) / pLim) * (PROFILE_W / 2);

  const inBand = (c: number) => !band || (meta.cells[c].lat >= band[0] && meta.cells[c].lat <= band[1]);
  const dimmed = (c: number) => (emphasis ? !emphasis.has(c) : !inBand(c));

  const fillTransition = useMemo(() => (reduced ? undefined : {transition: 'fill 280ms ease-out'}), [reduced]);
  const cellLayer = useMemo(
    () =>
      geo.cellPaths.map((d, i) => (
        <path key={i} d={d} data-i={i} fill={coloring.colors[i]} stroke={CHROME.body} strokeWidth={0.4} vectorEffect="non-scaling-stroke" style={fillTransition} />
      )),
    [geo, coloring, fillTransition],
  );

  const stipple = useMemo(() => {
    if (!showSignificance || layer === 'normal' || layer === 'year') return null;
    return geo.centers.map(([x, y], i) =>
      analysis.significant[i] ? <circle key={i} cx={x} cy={y} r={1.5 / zt.k} fill={CHROME.ink} fillOpacity={0.85} pointerEvents="none" /> : null,
    );
  }, [geo, analysis, showSignificance, layer, zt.k]);

  // The profile is a pure latitude axis (along the central meridian), so dots,
  // the zonal line and the brush all agree even where parallels curve on the map.
  const yToLat = (y: number) => geo.projection.invert!([geo.width / 2, y])![1];
  const latToY = (l: number) => geo.projection([geo.projection.invert!([geo.width / 2, 0])![0], l])![1];

  // Zonal (row) means, area-weighted, for the profile line.
  const rows = useMemo(() => {
    const byLat = new Map<number, {sum: number; w: number; n: number}>();
    meta.cells.forEach((c, i) => {
      const v = values[i];
      if (!Number.isFinite(v)) return;
      const row = byLat.get(c.lat) ?? {sum: 0, w: 0, n: 0};
      row.sum += v * c.areaKm2;
      row.w += c.areaKm2;
      row.n += 1;
      byLat.set(c.lat, row);
    });
    return [...byLat.entries()].sort((a, b) => b[0] - a[0]).map(([latV, r]) => ({lat: latV, mean: r.sum / r.w, cells: r.n}));
  }, [meta, values]);
  const profileRow =
    profileY === null || drag || !rows.length
      ? null
      : rows.reduce((best, r) => (Math.abs(latToY(r.lat) - profileY) < Math.abs(latToY(best.lat) - profileY) ? r : best));


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
    if (e.key === '+' || e.key === '=') return zoomBy(1.6);
    if (e.key === '-' || e.key === '_') return zoomBy(1 / 1.6);
    if (e.key === '0') return zoomReset();
    if (e.key === 'Enter' && selected !== null) return zoomTo(selected);
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

  const svg = (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${totalW.toFixed(0)} ${totalH.toFixed(0)}`}
      preserveAspectRatio="xMidYMid meet"
      width="100%"
      height={heightCap ? undefined : '100%'}
      role="application"
      aria-label={`${title}. Arrow keys move between grid cells, Enter zooms to the selected cell, plus and minus zoom, 0 resets, Escape clears.`}
      tabIndex={onSelect ? 0 : -1}
      onKeyDown={onKeyDown}
      style={{display: 'block', height: heightCap ? 'auto' : undefined, maxHeight: heightCap ?? '100%', touchAction: 'none', outline: 'none'}}
    >
      <title>{title}</title>
      <defs>
        <clipPath id={`clip-${clipId}`}>
          <path d={geo.boundaryPath} />
        </clipPath>
      </defs>
      <filter id={`relief-${clipId}`} colorInterpolationFilters="sRGB">
        <feColorMatrix type="saturate" values="0.12" />
          <feComponentTransfer>
            <feFuncR type="linear" slope="0.36" intercept="0.03" />
            <feFuncG type="linear" slope="0.4" intercept="0.05" />
            <feFuncB type="linear" slope="0.45" intercept="0.08" />
          </feComponentTransfer>
      </filter>
      <filter id={`glow-${clipId}`} x="-10%" y="-10%" width="120%" height="120%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <linearGradient id={`fadex-${clipId}`} x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#fff" stopOpacity="0" />
        <stop offset="0.06" stopColor="#fff" stopOpacity="1" />
        <stop offset="0.94" stopColor="#fff" stopOpacity="1" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
      <linearGradient id={`fadey-${clipId}`} x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity="0" />
        <stop offset="0.05" stopColor="#fff" stopOpacity="1" />
        <stop offset="0.95" stopColor="#fff" stopOpacity="1" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
      <mask id={`fade-${clipId}`} maskContentUnits="userSpaceOnUse">
        <rect x={0} y={0} width={geo.width} height={geo.height} fill={`url(#fadex-${clipId})`} />
      </mask>
      <mask id={`fade2-${clipId}`} maskContentUnits="userSpaceOnUse">
        <rect x={0} y={0} width={geo.width} height={geo.height} fill={`url(#fadey-${clipId})`} />
      </mask>
      <clipPath id={`frame-${clipId}`}>
        <rect x={0} y={0} width={geo.width} height={geo.height} />
      </clipPath>
      <g ref={zoomRef} clipPath={`url(#frame-${clipId})`} style={{cursor: onSelect ? 'pointer' : 'grab'}}>
      <rect x={0} y={0} width={geo.width} height={geo.height} fill="transparent" />
      <g transform={zt.toString()}>
      {geo.image ? (
        <g mask={`url(#fade-${clipId})`}>
          <g mask={`url(#fade2-${clipId})`}>
            <image href={reliefUrl(meta.iso3)} x={geo.image.x} y={geo.image.y} width={geo.image.width} height={geo.image.height} preserveAspectRatio="none" filter={`url(#relief-${clipId})`} />
          </g>
        </g>
      ) : (
        <path d={geo.boundaryPath} fill={CHROME.land} />
      )}
      {geo.neighbours.map((n, i) => (
        <g key={i} pointerEvents="none">
          <path d={n.path} fill="none" stroke={CHROME.faint} strokeOpacity={0.45} strokeWidth={0.7} vectorEffect="non-scaling-stroke" />
          {n.label && (
            <text x={n.label[0]} y={n.label[1]} fontSize={Math.min(u(11), 16) / zt.k} fill={CHROME.muted} fillOpacity={0.9} textAnchor="middle" fontFamily="var(--font-family-heading)" fontStyle="italic">
              {fullName(n.name)}
            </text>
          )}
        </g>
      ))}
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
        onDoubleClick={e => {
          const c = eventCell(e as unknown as PointerEvent<SVGElement>);
          if (c !== null) zoomTo(c);
        }}
      >
        <g filter={`url(#glow-${clipId})`} opacity={0.94}>
          {cellLayer}
        </g>
        {(band || emphasis) &&
          geo.cellPaths.map((d, i) => (dimmed(i) ? <path key={i} d={d} fill={CHROME.body} fillOpacity={0.62} pointerEvents="none" /> : null))}
        {stipple}
        {regionalPath && <path d={regionalPath} fill="none" stroke={CHROME.ink} strokeOpacity={0.55} strokeWidth={0.65} vectorEffect="non-scaling-stroke" pointerEvents="none" />}
      </g>
      <path d={geo.boundaryPath} fill="none" stroke={CHROME.ink} strokeOpacity={0.7} strokeWidth={0.9} vectorEffect="non-scaling-stroke" pointerEvents="none" />
      {outlines.map(group =>
        group.cells.map(c => <path key={`${group.color}-${c}`} d={geo.cellPaths[c]} fill="none" stroke={group.color} strokeWidth={1.4} vectorEffect="non-scaling-stroke" pointerEvents="none" />),
      )}
      {shown !== null && (
        <path d={geo.cellPaths[shown]} fill="none" stroke={CHROME.ink} strokeWidth={1.8} vectorEffect="non-scaling-stroke" pointerEvents="none" />
      )}
      </g>
      </g>

      {hover !== null && describeCell && (() => {
        const lines = describeCell(hover);
        const [cx, cy] = zt.apply(geo.centers[hover]);
        const fs = u(13);
        const w = Math.max(...lines.map(l => l.length)) * fs * 0.63 + fs * 1.6;
        const h = lines.length * fs * 1.3 + fs * 0.9;
        const x = Math.min(Math.max(4, cx + 10), geo.width - w - 4);
        const y = Math.min(Math.max(4, cy - h - 8), geo.height - h - 4);
        return (
          <g pointerEvents="none">
            <rect x={x} y={y} width={w} height={h} rx={4} fill={CHROME.body} fillOpacity={0.92} stroke={CHROME.axis} />
            {lines.map((l, k) => (
              <text key={k} x={x + fs * 0.7} y={y + fs * 1.5 + k * fs * 1.3} fontSize={fs} fill={k === 0 ? CHROME.ink : CHROME.muted} fontFamily={CHROME.mono}>
                {l}
              </text>
            ))}
          </g>
        );
      })()}
      {showProfile && (
        <g aria-hidden="true">
          <line x1={px(layer === 'normal' ? coloring.min : 0)} x2={px(layer === 'normal' ? coloring.min : 0)} y1={PAD} y2={geo.height - PAD} stroke={CHROME.axis} strokeWidth={0.8} />
          {bandY && <rect x={profileX0 - 6} width={PROFILE_W + 12} y={bandY[0]} height={Math.max(2, bandY[1] - bandY[0])} fill={CHROME.ink} fillOpacity={0.08} stroke={CHROME.ink} strokeOpacity={0.4} />}
          {meta.cells.map((cell, i) =>
            Number.isFinite(values[i]) ? (
              <circle key={i} cx={px(values[i])} cy={latToY(cell.lat)} r={1.4} fill={coloring.colors[i]} fillOpacity={dimmed(i) ? 0.25 : 0.9} />
            ) : null,
          )}
          <path
            d={rows.map((r, k) => `${k ? 'L' : 'M'}${px(r.mean).toFixed(1)},${latToY(r.lat).toFixed(1)}`).join('')}
            fill="none"
            stroke={CHROME.ink}
            strokeWidth={1.3}
          />
          {shown !== null && Number.isFinite(values[shown]) && (
            <circle cx={px(values[shown])} cy={latToY(meta.cells[shown].lat)} r={3.2} fill="none" stroke={CHROME.ink} strokeWidth={1.2} />
          )}
          {dragY && <rect x={profileX0 - 6} width={PROFILE_W + 12} y={dragY[0]} height={dragY[1] - dragY[0]} fill={CHROME.ink} fillOpacity={0.15} />}
          <text x={profileX0} y={geo.height + profileFont * 1.2} fontSize={profileFont} fill={CHROME.muted}>
            {layer === 'normal' ? 'low' : signed(-pLim, pLim < 1 ? 2 : 1)}
          </text>
          <text x={profileX0 + PROFILE_W} y={geo.height + profileFont * 1.2} fontSize={profileFont} fill={CHROME.muted} textAnchor="end">
            {layer === 'normal' ? 'high' : signed(pLim, pLim < 1 ? 2 : 1)}
          </text>
          <text x={profileX0 + PROFILE_W / 2} y={geo.height + profileFont * 2.5} fontSize={profileFont} fill={CHROME.muted} textAnchor="middle">
            {layer === 'emergence' ? 'signal ÷ noise' : unitLabel ?? ''}
          </text>
          {latTicks(rows.map(r => r.lat)).map(l => (
            <g key={l}>
              <line x1={profileX0 + PROFILE_W + 4} x2={profileX0 + PROFILE_W + 8} y1={latToY(l)} y2={latToY(l)} stroke={CHROME.axis} />
              <text x={totalW - 2} y={latToY(l) + profileFont * 0.35} fontSize={profileFont} fill={CHROME.muted} textAnchor="end">
                {fmtLat(l).replace('.00', '')}
              </text>
            </g>
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
          onPointerMove={e => {
            if (drag) setDrag([drag[0], svgPoint(e)]);
            else setProfileY(svgPoint(e));
          }}
          onPointerLeave={e => e.pointerType === 'mouse' && setProfileY(null)}
          onPointerCancel={() => setDrag(null)}
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
      {showProfile && (
        <rect
          x={profileX0 - 6}
          y={PAD}
          width={PROFILE_W + 12}
          height={geo.height - 2 * PAD}
          fill="transparent"
          pointerEvents={onBand ? 'none' : undefined}
          onPointerMove={e => setProfileY(svgPoint(e))}
          onPointerDown={e => setProfileY(svgPoint(e))}
          onPointerLeave={e => e.pointerType === 'mouse' && setProfileY(null)}
        />
      )}
      {showProfile && profileRow && (
        <g pointerEvents="none" aria-hidden="true">
          <line x1={profileX0 - 6} x2={profileX0 + PROFILE_W + 6} y1={latToY(profileRow.lat)} y2={latToY(profileRow.lat)} stroke={CHROME.ink} strokeOpacity={0.5} strokeDasharray="2 3" />
          <Readout
            x={px(profileRow.mean)}
            y={latToY(profileRow.lat)}
            lines={[
              `${fmtLat(profileRow.lat)} row`,
              `${layer === 'normal' ? num(profileRow.mean, pLim < 1 ? 2 : 1) : signed(profileRow.mean, pLim < 1 ? 2 : 1)} ${layer === 'emergence' ? 'signal ÷ noise' : unitLabel ?? ''}`.trim(),
              `area-weighted mean of ${profileRow.cells} cell${profileRow.cells === 1 ? '' : 's'}`,
            ]}
            width={totalW}
            height={totalH}
            fontSize={profileFont}
          />
        </g>
      )}
    </svg>
  );
  return (
    <VStack gap={2}>
      <HStack gap={1} hAlign="between" vAlign="center">
        <HelpTip help={nationMapHelp(showProfile, Boolean(onSelect), Boolean(onBand))} />
        {showZoomControls && (
          <HStack gap={1}>
            <Button size="sm" variant="secondary" label="Zoom in" onClick={() => zoomBy(1.6)} />
            <Button size="sm" variant="secondary" label="Zoom out" onClick={() => zoomBy(1 / 1.6)} />
            <Button size="sm" variant="secondary" label="Reset view" onClick={zoomReset} />
          </HStack>
        )}
      </HStack>
      {svg}
    </VStack>
  );
}

/** Whole-degree latitude ticks at a step that gives about six labels. */
function latTicks(lats: number[]): number[] {
  if (!lats.length) return [];
  const lo = Math.min(...lats);
  const hi = Math.max(...lats);
  const step = [1, 2, 5, 10].find(s => (hi - lo) / s <= 7) ?? 10;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) out.push(v);
  return out;
}

/** What the national map and its latitude profile show, then their basis. */
function nationMapHelp(profile: boolean, selectable: boolean, bandable: boolean): Help {
  return {
    title: 'National map',
    what: `Each square is one grid cell, roughly 55 by 70 km at the equator, coloured by the selected layer using the legend. Dots inside cells mark trends that are statistically significant across the whole map.${
      profile ? ' The panel on the right plots every cell’s value against latitude: each dot is a cell, and the line is the average along each row, so a north–south pattern stands out.' : ''
    } Outlines of neighbouring countries, and state or province lines when you zoom in, are there for orientation only.`,
    how: `Point at a cell to read its value.${selectable ? ' Click or tap a cell to make the evidence describe just that cell, or focus the map and move between cells with the arrow keys; Escape clears it.' : ''} Zoom with the buttons, the wheel, a pinch, or + and − on the keyboard; 0 resets.${
      profile ? ' Point at the latitude profile to read a row.' : ''
    }${bandable ? ' Drag up or down on the profile to select a latitude band.' : ''}`,
    detail: 'MERRA-2 reanalysis from NASA POWER on its native 0.5° × 0.625° grid, cells clipped to the coastline and weighted by their land area. Stippling: Benjamini–Hochberg at a 10% false discovery rate across the nation’s cells for the selected analysis window. Profile rows are area-weighted means. Administrative lines are generalized Natural Earth admin-1 boundaries and are not used in any statistic.',
    method: 'data',
  };
}
