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
import {rootPx} from './chrome';

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
  /** Filled with zoom handles so the page can offer on-screen zoom buttons. */
  controls?: {current: WorldMapControls | null};
};

export type WorldMapControls = {zoomBy: (factor: number) => void; reset: () => void};

const BINS = 72;
const D_LAT = 0.5;
const D_LON = 0.625;

function cssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

/** Colour index (0..BINS-1, or 255 for no data / transparent) for every cell. */
function binCells(stats: GlobalStats, annual: Float32Array | null, layer: WorldLayer, year: number, firstYear: number, annualLimit: number): {bins: Uint8Array; palette: string[]; limit: number} {
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
  const limit = layer === 'year' ? annualLimit : robustLimit(values);
  const palette = Array.from({length: BINS}, (_, i) => divergingColor(def.palette, -limit + (2 * limit * i) / (BINS - 1), limit));
  for (let c = 0; c < n; c++) {
    const v = values[c];
    if (Number.isFinite(v)) bins[c] = Math.round(((Math.max(-limit, Math.min(limit, v)) + limit) / (2 * limit)) * (BINS - 1));
  }
  return {bins, palette, limit};
}

export function WorldMap({cells, stats, annual, layer, year, firstYear, extent, reliefUrl, world, selectedCell, selectedCountry, countryIds, onSelectCell, describeCell, title, controls}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const zoomer = useRef<ZoomBehavior<HTMLCanvasElement, unknown> | null>(null);
  const [size, setSize] = useState<{w: number; h: number}>({w: 960, h: 420});
  const [zt, setZt] = useState<ZoomTransform>(zoomIdentity);
  const [hover, setHover] = useState<number | null>(null);
  const [relief, setRelief] = useState<HTMLImageElement | null>(null);
  const reduced = useMemo(() => prefersReducedMotion(), []);
  // Keyboard focus: a crosshair marks the cell at the centre, which Enter opens.
  const [keyboard, setKeyboard] = useState(false);
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

  // The playback colour scale spans all years and does not change with the frame.
  const annualLimit = useMemo(() => annual ? robustLimit(annual) : 1, [annual]);
  const coloured = useMemo(() => binCells(stats, annual, layer, year, firstYear, annualLimit), [stats, annual, layer, year, firstYear, annualLimit]);
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
  // Hover and keyboard feedback reuse the rendered map. Only data, camera or
  // country-outline changes invalidate the geographic layer.
  const sceneKey = useMemo(() => ({}), [size, zt, relief, byBin, coloured, borders, coast, countryShape, layer, stats, cells, extent]);
  const scene = useRef<{key: object; image: HTMLCanvasElement} | null>(null);

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
      const cw = D_LON * s;
      const ch = D_LAT * s;
      const ink = cssVar('--color-text-primary', '#eee');
      if (scene.current?.key === sceneKey) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, el.width, el.height);
        ctx.drawImage(scene.current.image, 0, 0);
      } else {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, el.width, el.height);
        ctx.setTransform(dpr * zt.k, 0, 0, dpr * zt.k, dpr * zt.x, dpr * zt.y);
        ctx.save();
        ctx.beginPath();
        ctx.rect(X(west), Y(north), (east - west) * s, (north - south) * s);
        ctx.clip();
        if (relief) {
          ctx.save();
          ctx.filter = 'grayscale(0.88) sepia(0.35) contrast(0.42) brightness(1.55)';
          ctx.drawImage(relief, X(west), Y(north), (east - west) * s, (north - south) * s);
          ctx.restore();
        }
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
        const image = document.createElement('canvas');
        image.width = el.width;
        image.height = el.height;
        image.getContext('2d')?.drawImage(el, 0, 0);
        scene.current = {key: sceneKey, image};
      }
      ctx.setTransform(dpr * zt.k, 0, 0, dpr * zt.k, dpr * zt.x, dpr * zt.y);
      for (const c of [selectedCell, hover]) {
        if (c === null) continue;
        ctx.strokeStyle = ink;
        ctx.lineWidth = 1.6 / zt.k;
        ctx.strokeRect(X(cells.lon[c]) - cw / 2, Y(cells.lat[c]) - ch / 2, cw, ch);
      }
      if (keyboard) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.strokeStyle = ink;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(size.w / 2 - 12, size.h / 2);
        ctx.lineTo(size.w / 2 + 12, size.h / 2);
        ctx.moveTo(size.w / 2, size.h / 2 - 12);
        ctx.lineTo(size.w / 2, size.h / 2 + 12);
        ctx.stroke();
      }
      // Tooltip in screen space, sized with the page's text.
      if (hover !== null && describeCell) {
        const lines = describeCell(hover);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const fs = Math.round(13 * (rootPx() / 16));
        ctx.font = `${fs}px "IBM Plex Mono", ui-monospace, monospace`;
        const w = Math.max(...lines.map(l => ctx.measureText(l).width)) + fs * 1.5;
        const h = lines.length * fs * 1.35 + fs * 0.8;
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
          ctx.fillText(l, tx + fs * 0.75, ty + fs * 1.45 + k * fs * 1.35);
        });
      }
    });
    return () => cancelAnimationFrame(frame);
    // X, Y and s are derived from size and extent.
  }, [sceneKey, hover, selectedCell, describeCell, keyboard]);

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
  const reset = () => {
    const el = canvasRef.current;
    if (el && zoomer.current) select(el).transition().duration(reduced ? 0 : 420).call(zoomer.current.transform, zoomIdentity);
  };
  if (controls) controls.current = {zoomBy, reset};

  // While the keyboard drives the map, the cell under the crosshair is the hovered one.
  useEffect(() => {
    if (keyboard) setHover(cellAt(size.w / 2, size.h / 2));
    // cellAt reads zt and size, both listed.
  }, [keyboard, zt, size]);

  const onKeyDown = (e: KeyboardEvent<HTMLCanvasElement>) => {
    const el = canvasRef.current;
    if (!el || !zoomer.current) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setKeyboard(true);
      onSelectCell?.(cellAt(size.w / 2, size.h / 2));
      return;
    }
    if (e.key.startsWith('Arrow') || e.key === 'Tab') setKeyboard(true);
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
      aria-label={`${title}. Drag or use arrow keys to pan, scroll or plus and minus to zoom, 0 to reset. Click a cell, or press Enter to open the cell under the crosshair.`}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onFocus={e => setKeyboard(e.currentTarget.matches(':focus-visible'))}
      onBlur={() => {
        setKeyboard(false);
        setHover(null);
      }}
      onPointerDown={() => setKeyboard(false)}
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
      style={{display: 'block', width: '100%', height: '100%', touchAction: 'none', cursor: hover !== null ? 'pointer' : 'grab', outline: keyboard ? '3px solid var(--color-text-accent)' : 'none', outlineOffset: 2}}
    >
      {title}
    </canvas>
  );
}
