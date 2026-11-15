import {useEffect, useMemo, useRef, useState, type KeyboardEvent} from 'react';
import {select} from 'd3-selection';
import 'd3-transition';
import {zoom as d3zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform} from 'd3-zoom';
import {feature, mesh} from 'topojson-client';
import type {Feature, MultiPolygon, Polygon} from 'geojson';
import type {GlobalCells, GlobalStats} from '../lib/globalData';
import {getVariable} from '../data/variables';
import {divergingColor, emergenceRamp, robustLimit, VERDICT_COLORS} from './color';
import {prefersReducedMotion} from './usePlayback';

export type WorldLayer = 'trend' | 'year' | 'verdict' | 'normal';

type Props = {
  cells: GlobalCells;
  stats: GlobalStats;
  /** Annual readings, needed only for the 'year' layer. */
  annual: Float32Array | null;
  layer: WorldLayer;
  year: number;
  firstYear: number;
  extent: [number, number, number, number];
  reliefUrl: string;
  world: unknown | null;
  selectedCell: number | null;
  selectedCountry: number | null;
  countryIds: string[];
  onSelectCell?: (cell: number | null) => void;
  describeCell?: (cell: number) => string[];
  title: string;
};

const BINS = 72;
const D_LAT = 0.5;
const D_LON = 0.625;

function cssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

/** Colour index (0..BINS-1, or 255 for no data / transparent) for every cell. */
function binCells(stats: GlobalStats, annual: Float32Array | null, layer: WorldLayer, year: number, firstYear: number): {bins: Uint8Array; palette: string[]; limit: number} {
  const n = stats.slope.length;
  const bins = new Uint8Array(n).fill(255);
  const def = getVariable(stats.variable);
  if (layer === 'verdict') {
    const palette = VERDICT_COLORS;
    for (let c = 0; c < n; c++) if (stats.agreement[c] !== 255) bins[c] = stats.agreement[c];
    return {bins, palette, limit: 0};
  }
  let values: ArrayLike<number>;
  if (layer === 'trend') values = stats.slope;
  else if (layer === 'normal') values = stats.normal;
  else {
    if (!annual) return {bins, palette: [], limit: 0};
    const y = year - firstYear;
    values = Float32Array.from({length: n}, (_, c) => annual[c * stats.years + y]);
  }
  if (layer === 'normal') {
    let lo = Infinity;
    let hi = -Infinity;
    for (let c = 0; c < n; c++) {
      if (!Number.isFinite(values[c])) continue;
      lo = Math.min(lo, values[c]);
      hi = Math.max(hi, values[c]);
    }
    const palette = Array.from({length: BINS}, (_, i) => emergenceRamp(0.08 + (0.92 * i) / (BINS - 1)));
    for (let c = 0; c < n; c++) if (Number.isFinite(values[c])) bins[c] = Math.round(((values[c] - lo) / (hi - lo || 1)) * (BINS - 1));
    return {bins, palette, limit: hi};
  }
  const limit = layer === 'year' && annual ? robustLimit(annual) : robustLimit(values);
  const palette = Array.from({length: BINS}, (_, i) => divergingColor(def.palette, -limit + (2 * limit * i) / (BINS - 1), limit));
  for (let c = 0; c < n; c++) {
    const v = values[c];
    if (Number.isFinite(v)) bins[c] = Math.round(((Math.max(-limit, Math.min(limit, v)) + limit) / (2 * limit)) * (BINS - 1));
  }
  return {bins, palette, limit};
}

export function WorldMap({cells, stats, annual, layer, year, firstYear, extent, reliefUrl, world, selectedCell, selectedCountry, countryIds, onSelectCell, describeCell, title}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const zoomer = useRef<ZoomBehavior<HTMLCanvasElement, unknown> | null>(null);
  const [size, setSize] = useState<{w: number; h: number}>({w: 960, h: 420});
  const [zt, setZt] = useState<ZoomTransform>(zoomIdentity);
  const [hover, setHover] = useState<number | null>(null);
  const [relief, setRelief] = useState<HTMLImageElement | null>(null);
  const reduced = useMemo(() => prefersReducedMotion(), []);
  const [west, south, east, north] = extent;

  // Fit the extent into the canvas, letterboxed and centred.
  const s = Math.min(size.w / (east - west), size.h / (north - south));
  const ox = (size.w - (east - west) * s) / 2;
  const oy = (size.h - (north - south) * s) / 2;
  const X = (lon: number) => ox + (lon - west) * s;
  const Y = (lat: number) => oy + (north - lat) * s;

  const index = useMemo(() => {
    const m = new Map<number, number>();
    for (let c = 0; c < cells.n; c++) m.set(Math.round(cells.lat[c] * 2) * 10000 + Math.round(cells.lon[c] / D_LON), c);
    return m;
  }, [cells]);

  const coloured = useMemo(() => binCells(stats, annual, layer, year, firstYear), [stats, annual, layer, year, firstYear]);
  const byBin = useMemo(() => {
    const groups: number[][] = Array.from({length: Math.max(coloured.palette.length, 1)}, () => []);
    coloured.bins.forEach((b, c) => b !== 255 && groups[b]?.push(c));
    return groups;
  }, [coloured]);

  const borders = useMemo(() => {
    if (!world) return null;
    const topo = world as Parameters<typeof mesh>[0] & {objects: {countries: Parameters<typeof mesh>[1]}};
    return mesh(topo, topo.objects.countries, (a, b) => a !== b);
  }, [world]);
  const coast = useMemo(() => {
    if (!world) return null;
    const topo = world as Parameters<typeof mesh>[0] & {objects: {countries: Parameters<typeof mesh>[1]}};
    return mesh(topo, topo.objects.countries, (a, b) => a === b);
  }, [world]);
  const countryShape = useMemo(() => {
    if (!world || selectedCountry === null) return null;
    const topo = world as Parameters<typeof feature>[0] & {objects: {countries: Parameters<typeof feature>[1]}};
    const all = feature(topo, topo.objects.countries) as unknown as {features: Feature<Polygon | MultiPolygon>[]};
    return all.features.find(f => String(f.id) === countryIds[selectedCountry]) ?? null;
  }, [world, selectedCountry, countryIds]);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setRelief(img);
    img.src = reliefUrl;
  }, [reliefUrl]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setSize({w: Math.round(r.width), h: Math.round(r.height)});
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const z = d3zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([1, 40])
      .extent([[0, 0], [size.w, size.h]])
      .translateExtent([[0, 0], [size.w, size.h]])
      .on('zoom', e => setZt(e.transform));
    zoomer.current = z;
    select(el).call(z);
    return () => {
      select(el).on('.zoom', null);
    };
  }, [size]);

  // Draw.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const dpr = window.devicePixelRatio || 1;
    if (el.width !== size.w * dpr) el.width = size.w * dpr;
    if (el.height !== size.h * dpr) el.height = size.h * dpr;
    const ctx = el.getContext('2d');
    if (!ctx) return;
    const frame = requestAnimationFrame(() => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, el.width, el.height);
      ctx.setTransform(dpr * zt.k, 0, 0, dpr * zt.k, dpr * zt.x, dpr * zt.y);
      ctx.save();
      ctx.beginPath();
      ctx.rect(X(west), Y(north), (east - west) * s, (north - south) * s);
      ctx.clip();
      if (relief) {
        ctx.save();
        ctx.filter = 'saturate(0.45) brightness(0.45)';
        ctx.drawImage(relief, X(west), Y(north), (east - west) * s, (north - south) * s);
        ctx.restore();
      }
      const cw = D_LON * s;
      const ch = D_LAT * s;
      ctx.globalAlpha = layer === 'verdict' ? 0.88 : 0.93;
      byBin.forEach((list, b) => {
        if (!list.length) return;
        ctx.fillStyle = coloured.palette[b];
        ctx.beginPath();
        for (const c of list) ctx.rect(X(cells.lon[c]) - cw / 2, Y(cells.lat[c]) - ch / 2, cw + 0.15 / zt.k, ch + 0.15 / zt.k);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      const line = (geom: {coordinates: number[][][]} | null, width: number, color: string) => {
        if (!geom) return;
        ctx.strokeStyle = color;
        ctx.lineWidth = width / zt.k;
        ctx.beginPath();
        for (const part of geom.coordinates) {
          // Lift the pen where a line jumps across the antimeridian.
          part.forEach(([lo, la], i) => {
            if (i && Math.abs(lo - part[i - 1][0]) < 180) ctx.lineTo(X(lo), Y(la));
            else ctx.moveTo(X(lo), Y(la));
          });
        }
        ctx.stroke();
      };
      const faint = cssVar('--color-text-disabled', '#9aa');
      const ink = cssVar('--color-text-primary', '#eee');
      line(coast as unknown as {coordinates: number[][][]}, 0.7, faint);
      line(borders as unknown as {coordinates: number[][][]}, 0.5, faint);
      // Stipple significant cells once cells are large enough to read.
      if (layer === 'trend' && ch * zt.k > 7) {
        ctx.fillStyle = ink;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        for (let c = 0; c < cells.n; c++) {
          if (!(stats.flags[c] & 1)) continue;
          const x = X(cells.lon[c]);
          const y = Y(cells.lat[c]);
          ctx.moveTo(x + 1.4 / zt.k, y);
          ctx.arc(x, y, 1.4 / zt.k, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (countryShape) {
        ctx.strokeStyle = ink;
        ctx.lineWidth = 1.6 / zt.k;
        ctx.beginPath();
        const polys = countryShape.geometry.type === 'Polygon' ? [countryShape.geometry.coordinates] : countryShape.geometry.coordinates;
        for (const poly of polys)
          for (const ring of poly)
            ring.forEach(([lo, la], i) => {
              if (i && Math.abs(lo - ring[i - 1][0]) < 180) ctx.lineTo(X(lo), Y(la));
              else ctx.moveTo(X(lo), Y(la));
            });
        ctx.stroke();
      }
      ctx.restore();
      for (const c of [selectedCell, hover]) {
        if (c === null) continue;
        ctx.strokeStyle = ink;
        ctx.lineWidth = 1.6 / zt.k;
        ctx.strokeRect(X(cells.lon[c]) - cw / 2, Y(cells.lat[c]) - ch / 2, cw, ch);
      }
      // Tooltip in screen space.
      if (hover !== null && describeCell) {
        const lines = describeCell(hover);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.font = '12px "IBM Plex Mono", ui-monospace, monospace';
        const w = Math.max(...lines.map(l => ctx.measureText(l).width)) + 18;
        const h = lines.length * 16 + 10;
        const [sx, sy] = zt.apply([X(cells.lon[hover]), Y(cells.lat[hover])]);
        const tx = Math.min(Math.max(6, sx + 12), size.w - w - 6);
        const ty = Math.min(Math.max(6, sy - h - 10), size.h - h - 6);
        ctx.fillStyle = cssVar('--color-background-body', '#111');
        ctx.globalAlpha = 0.92;
        ctx.fillRect(tx, ty, w, h);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = cssVar('--color-border-emphasized', '#444');
        ctx.lineWidth = 1;
        ctx.strokeRect(tx + 0.5, ty + 0.5, w - 1, h - 1);
        lines.forEach((l, k) => {
          ctx.fillStyle = k === 0 ? ink : cssVar('--color-text-secondary', '#bbb');
          ctx.fillText(l, tx + 9, ty + 19 + k * 16);
        });
      }
    });
    return () => cancelAnimationFrame(frame);
    // X, Y and s are derived from size and extent.
  }, [size, zt, relief, byBin, coloured, borders, coast, countryShape, hover, selectedCell, layer, stats, cells, describeCell, extent]);

  const cellAt = (mx: number, my: number): number | null => {
    const [bx, by] = zt.invert([mx, my]);
    const lon = (bx - ox) / s + west;
    const lat = north - (by - oy) / s;
    const c = index.get(Math.round(lat * 2) * 10000 + Math.round(lon / D_LON));
    return c === undefined ? null : c;
  };

  const zoomBy = (f: number) => {
    const el = canvasRef.current;
    if (el && zoomer.current) select(el).transition().duration(reduced ? 0 : 320).call(zoomer.current.scaleBy, f);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLCanvasElement>) => {
    const el = canvasRef.current;
    if (!el || !zoomer.current) return;
    const pan: Record<string, [number, number]> = {ArrowLeft: [60, 0], ArrowRight: [-60, 0], ArrowUp: [0, 60], ArrowDown: [0, -60]};
    if (e.key === '+' || e.key === '=') zoomBy(1.6);
    else if (e.key === '-' || e.key === '_') zoomBy(1 / 1.6);
    else if (e.key === '0') select(el).transition().duration(reduced ? 0 : 420).call(zoomer.current.transform, zoomIdentity);
    else if (pan[e.key]) {
      e.preventDefault();
      select(el).transition().duration(reduced ? 0 : 200).call(zoomer.current.translateBy, pan[e.key][0] / zt.k, pan[e.key][1] / zt.k);
    } else if (e.key === 'Escape') onSelectCell?.(null);
  };

  return (
    <canvas
      ref={canvasRef}
      role="application"
      aria-label={`${title}. Drag or use arrow keys to pan, scroll or plus and minus to zoom, 0 to reset, click a cell to inspect it.`}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerMove={e => {
        const r = e.currentTarget.getBoundingClientRect();
        const c = cellAt(e.clientX - r.left, e.clientY - r.top);
        if (c !== hover) setHover(c);
      }}
      onPointerLeave={() => setHover(null)}
      onClick={e => {
        const r = e.currentTarget.getBoundingClientRect();
        onSelectCell?.(cellAt(e.clientX - r.left, e.clientY - r.top));
      }}
      style={{display: 'block', width: '100%', height: '100%', touchAction: 'none', cursor: hover !== null ? 'pointer' : 'grab', outline: 'none'}}
    >
      {title}
    </canvas>
  );
}
