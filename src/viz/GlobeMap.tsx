import {useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent} from 'react';
import {geoGraticule10, geoOrthographic, geoPath} from 'd3-geo';
import {feature, mesh} from 'topojson-client';
import {Text} from '@astryxdesign/core/Text';
import type {Feature, MultiPolygon, Polygon} from 'geojson';
import type {GlobalCells} from '../lib/globalData';
import {useMediaQuery} from '../lib/hooks';
import {rootPx} from './chrome';
import {createGlobeRenderer, type GlobeRenderer} from './globeRenderer';

/**
 * TRACE's globe: every land cell on an orthographic sphere, coloured by one
 * of the two records or by their verdict. A cached geographic texture drives
 * the WebGL projection, with direct 2D cell paths as a fallback. Drag or use the
 * arrow keys to turn it; it turns slowly on its own until the reader takes
 * over, unless they prefer reduced motion.
 */

export type GlobeControls = {
  /** Turn the globe to a place, animated unless motion is reduced. */
  flyTo: (lon: number, lat: number) => void;
  zoomBy: (factor: number) => void;
};

type Props = {
  cells: GlobalCells;
  /** Colour of each cell, or null to leave it blank. */
  colorOf: (cell: number) => string | null;
  /** Changes whenever colorOf would give different colours. */
  colorKey: string;
  world: unknown | null;
  selectedCell: number | null;
  /** Index into the world-atlas country list to outline, or null. */
  selectedCountryId: string | null;
  onSelectCell?: (cell: number | null) => void;
  onInteract?: () => void;
  describeCell?: (cell: number) => string[];
  controls?: {current: GlobeControls | null};
  focus?: {lon: number; lat: number} | null;
  spinning: boolean;
  onSpinningChange: (spinning: boolean) => void;
  title: string;
};

const D_LAT = 0.5;
const D_LON = 0.625;
const RAD = Math.PI / 180;
const OCEAN = '#d5dcd8';
const INK = '#1c1a17';

function cssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export function GlobeMap({cells, colorOf, colorKey, world, selectedCell, selectedCountryId, onSelectCell, onInteract, describeCell, controls, focus, spinning, onSpinningChange, title}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({w: 640, h: 640});
  // View centre (longitude, latitude) and zoom.
  const [view, setView] = useState<{lon: number; lat: number; k: number}>({lon: 70, lat: 18, k: 1});
  const [hover, setHover] = useState<number | null>(null);
  const [keyboard, setKeyboard] = useState(false);
  const [visible, setVisible] = useState(true);
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const feedbackId = useId();
  const drag = useRef<{x: number; y: number; lon: number; lat: number; moved: boolean} | null>(null);
  const flight = useRef<number | null>(null);

  // A pinned globe may leave the viewport near the end of its story. Preserve
  // the reader's rotation preference without doing animation work off-screen.
  useEffect(() => {
    let inView = true;
    const update = () => setVisible(inView && document.visibilityState !== 'hidden');
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
      inView = entries[0]?.isIntersecting ?? true;
      update();
    });
    if (canvasRef.current) observer?.observe(canvasRef.current);
    document.addEventListener('visibilitychange', update);
    update();
    return () => { observer?.disconnect(); document.removeEventListener('visibilitychange', update); };
  }, []);

  useEffect(() => () => {
    if (flight.current !== null) cancelAnimationFrame(flight.current);
    if (controls) controls.current = null;
  }, [controls]);

  useEffect(() => {
    if (reduced) onSpinningChange(false);
  }, [reduced, onSpinningChange]);

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

  // Cell lookup by rounded centre, as in the flat map.
  const index = useMemo(() => {
    const m = new Map<number, number>();
    for (let c = 0; c < cells.n; c++) m.set(Math.round(cells.lat[c] * 2) * 10000 + Math.round(cells.lon[c] / D_LON), c);
    return m;
  }, [cells]);

  // Corner trigonometry, computed once: rows share latitudes, so cache by row.
  const geom = useMemo(() => {
    const sinS = new Float32Array(cells.n);
    const cosS = new Float32Array(cells.n);
    const sinN = new Float32Array(cells.n);
    const cosN = new Float32Array(cells.n);
    const sinC = new Float32Array(cells.n);
    const cosC = new Float32Array(cells.n);
    for (let c = 0; c < cells.n; c++) {
      const la = cells.lat[c];
      sinS[c] = Math.sin((la - D_LAT / 2) * RAD);
      cosS[c] = Math.cos((la - D_LAT / 2) * RAD);
      sinN[c] = Math.sin((la + D_LAT / 2) * RAD);
      cosN[c] = Math.cos((la + D_LAT / 2) * RAD);
      sinC[c] = Math.sin(la * RAD);
      cosC[c] = Math.cos(la * RAD);
    }
    return {sinS, cosS, sinN, cosN, sinC, cosC};
  }, [cells]);

  // Group cells by colour for texture creation and the 2D fallback.
  const groups = useMemo(() => {
    const byColor = new Map<string, number[]>();
    for (let c = 0; c < cells.n; c++) {
      const col = colorOf(c);
      if (!col) continue;
      const list = byColor.get(col);
      if (list) list.push(c);
      else byColor.set(col, [c]);
    }
    return [...byColor.entries()];
    // colorKey stands in for colorOf's identity.
  }, [cells, colorKey]);

  const borders = useMemo(() => {
    if (!world) return null;
    const topo = world as Parameters<typeof mesh>[0] & {objects: {countries: Parameters<typeof mesh>[1]}};
    return {inner: mesh(topo, topo.objects.countries, (a, b) => a !== b), coast: mesh(topo, topo.objects.countries, (a, b) => a === b)};
  }, [world]);
  const countryShape = useMemo(() => {
    if (!world || !selectedCountryId) return null;
    const topo = world as Parameters<typeof feature>[0] & {objects: {countries: Parameters<typeof feature>[1]}};
    const all = feature(topo, topo.objects.countries) as unknown as {features: Feature<Polygon | MultiPolygon>[]};
    return all.features.find(f => String(f.id) === selectedCountryId) ?? null;
  }, [world, selectedCountryId]);

  const gpu = useRef<GlobeRenderer | null>(null);
  useEffect(() => {
    gpu.current = createGlobeRenderer(cells, groups, borders);
    return () => { gpu.current?.dispose(); gpu.current = null; };
  }, [cells, groups, borders]);

  const radius = (Math.min(size.w, size.h) / 2) * 0.9 * view.k;
  const projection = useMemo(
    () => geoOrthographic().rotate([-view.lon, -view.lat]).scale(radius).translate([size.w / 2, size.h / 2]).clipAngle(90).precision(0.5),
    [view, radius, size],
  );

  // Slow spin until the reader interacts.
  useEffect(() => {
    if (!spinning || reduced || !visible) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      setView(v => ({...v, lon: v.lon + dt * 0.006}));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [spinning, reduced, visible]);

  const stop = () => {
    onSpinningChange(false);
    if (flight.current) cancelAnimationFrame(flight.current);
    flight.current = null;
  };

  const flyTo = (lon: number, lat: number) => {
    stop();
    const target = {lon, lat: Math.max(-70, Math.min(70, lat))};
    if (reduced) {
      setView(v => ({...v, ...target}));
      return;
    }
    let from: {lon: number; lat: number} | null = null;
    const start = performance.now();
    const step = (now: number) => {
      setView(v => {
        if (!from) from = {lon: v.lon, lat: v.lat};
        const t = Math.min(1, (now - start) / 900);
        const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
        // Take the short way round.
        const dLon = ((((target.lon - from.lon) % 360) + 540) % 360) - 180;
        return {...v, lon: from.lon + dLon * e, lat: from.lat + (target.lat - from.lat) * e};
      });
      if (now - start < 900) flight.current = requestAnimationFrame(step);
      else flight.current = null;
    };
    flight.current = requestAnimationFrame(step);
  };
  const zoomBy = (f: number) => {
    stop();
    setView(v => ({...v, k: Math.max(1, Math.min(6, v.k * f))}));
  };
  useEffect(() => {
    if (controls) controls.current = {flyTo, zoomBy};
    return () => { if (controls) controls.current = null; };
  });

  // Replays on StrictMode setup, including when the globe mounts after data loads.
  useEffect(() => {
    if (focus) flyTo(focus.lon, focus.lat);
    return () => {
      if (flight.current !== null) cancelAnimationFrame(flight.current);
    };
  }, [focus]);

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
      const cx = size.w / 2;
      const cy = size.h / 2;
      const R = radius;
      const lam0 = view.lon * RAD;
      const sinP0 = Math.sin(view.lat * RAD);
      const cosP0 = Math.cos(view.lat * RAD);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size.w, size.h);

      // A printed globe: soft shadow, pale sea, faint graticule.
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.shadowColor = 'rgba(60, 45, 20, 0.28)';
      ctx.shadowBlur = R * 0.08;
      ctx.shadowOffsetY = R * 0.03;
      ctx.fillStyle = OCEAN;
      ctx.fill();
      ctx.restore();
      const path = geoPath(projection, ctx);
      if (gpu.current?.paint(el.width, el.height, R * dpr, view)) {
        ctx.drawImage(gpu.current.canvas, 0, 0, size.w, size.h);
      } else {
        ctx.beginPath();
        path(geoGraticule10());
        ctx.strokeStyle = 'rgba(28, 26, 23, 0.08)';
        ctx.lineWidth = 0.6;
        ctx.stroke();

        // Cells.
        const dLon = (D_LON / 2) * RAD;
        const {sinS, cosS, sinN, cosN, sinC, cosC} = geom;
        for (const [color, list] of groups) {
          ctx.fillStyle = color;
          ctx.beginPath();
          let batch = 0;
          for (const c of list) {
            const lam = cells.lon[c] * RAD - lam0;
            const cosL = Math.cos(lam);
            if (sinP0 * sinC[c] + cosP0 * cosC[c] * cosL <= 0.02) continue;
            const l0 = lam - dLon;
            const l1 = lam + dLon;
            const s0 = Math.sin(l0), c0 = Math.cos(l0), s1 = Math.sin(l1), c1 = Math.cos(l1);
            const px = (cp: number, sl: number) => cx + R * cp * sl;
            const py = (sp: number, cp: number, cl: number) => cy - R * (cosP0 * sp - sinP0 * cp * cl);
            ctx.moveTo(px(cosS[c], s0), py(sinS[c], cosS[c], c0));
            ctx.lineTo(px(cosS[c], s1), py(sinS[c], cosS[c], c1));
            ctx.lineTo(px(cosN[c], s1), py(sinN[c], cosN[c], c1));
            ctx.lineTo(px(cosN[c], s0), py(sinN[c], cosN[c], c0));
            // fill() closes each subpath; explicit closePath() dominates Chromium's
            // path-recording time when this many cell polygons share one batch.
            if (++batch === 128) {
              ctx.fill();
              ctx.beginPath();
              batch = 0;
            }
          }
          ctx.fill();
        }

        // Coasts and borders in ink.
        if (borders) {
          ctx.beginPath();
          path(borders.coast);
          ctx.strokeStyle = 'rgba(28, 26, 23, 0.55)';
          ctx.lineWidth = 0.7;
          ctx.stroke();
          ctx.beginPath();
          path(borders.inner);
          ctx.strokeStyle = 'rgba(28, 26, 23, 0.3)';
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
      if (countryShape) {
        ctx.beginPath();
        path(countryShape);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2.2;
        ctx.stroke();
      }
      for (const c of [selectedCell, hover]) {
        if (c === null) continue;
        const ring = {
          type: 'Polygon' as const,
          coordinates: [[
            [cells.lon[c] - D_LON / 2, cells.lat[c] - D_LAT / 2],
            [cells.lon[c] - D_LON / 2, cells.lat[c] + D_LAT / 2],
            [cells.lon[c] + D_LON / 2, cells.lat[c] + D_LAT / 2],
            [cells.lon[c] + D_LON / 2, cells.lat[c] - D_LAT / 2],
            [cells.lon[c] - D_LON / 2, cells.lat[c] - D_LAT / 2],
          ]],
        };
        ctx.beginPath();
        path(ring);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      // Rim.
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(28, 26, 23, 0.6)';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      if (keyboard) {
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx - 12, cy);
        ctx.lineTo(cx + 12, cy);
        ctx.moveTo(cx, cy - 12);
        ctx.lineTo(cx, cy + 12);
        ctx.stroke();
      }

      // Tooltip, sized with the page's text.
      if (hover !== null && describeCell) {
        const lines = describeCell(hover);
        const fs = Math.round(13 * (rootPx() / 16));
        ctx.font = `${fs}px "IBM Plex Sans", system-ui, sans-serif`;
        const w = Math.max(...lines.map(l => ctx.measureText(l).width)) + fs * 1.5;
        const h = lines.length * fs * 1.4 + fs * 0.8;
        const [sx, sy] = projection([cells.lon[hover], cells.lat[hover]]) ?? [cx, cy];
        const tx = Math.min(Math.max(6, sx + 14), size.w - w - 6);
        const ty = Math.min(Math.max(6, sy - h - 12), size.h - h - 6);
        ctx.fillStyle = cssVar('--color-background-card', '#f8f4ec');
        ctx.globalAlpha = 0.96;
        ctx.fillRect(tx, ty, w, h);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(28, 26, 23, 0.35)';
        ctx.lineWidth = 1;
        ctx.strokeRect(tx + 0.5, ty + 0.5, w - 1, h - 1);
        lines.forEach((l, k) => {
          ctx.fillStyle = k === 0 ? INK : cssVar('--color-text-secondary', '#4b463c');
          ctx.fillText(l, tx + fs * 0.75, ty + fs * 1.45 + k * fs * 1.4);
        });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [size, view, radius, projection, groups, geom, borders, countryShape, selectedCell, hover, keyboard, cells, describeCell]);

  const cellAt = (x: number, y: number): number | null => {
    const dx = x - size.w / 2;
    const dy = y - size.h / 2;
    if (dx * dx + dy * dy > radius * radius) return null;
    const ll = projection.invert?.([x, y]);
    if (!ll) return null;
    const column = ((Math.round(ll[0] / D_LON) + 288) % 576 + 576) % 576 - 288;
    const c = index.get(Math.round(ll[1] * 2) * 10000 + column);
    return c === undefined ? null : c;
  };

  // While the keyboard drives, the cell under the crosshair is the hovered one.
  useEffect(() => {
    if (keyboard) setHover(cellAt(size.w / 2, size.h / 2));
    // cellAt reads the projection, which follows view and size.
  }, [keyboard, view, size]);

  const select = (cell: number | null) => {
    onSelectCell?.(cell);
  };

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    onInteract?.();
    stop();
    setKeyboard(false);
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {x: e.clientX, y: e.clientY, lon: view.lon, lat: view.lat, moved: false};
  };
  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    if (d && e.buttons) {
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
      if (d.moved) {
        const degPerPx = 180 / (Math.PI * radius);
        setView(v => ({...v, lon: d.lon - dx * degPerPx, lat: Math.max(-80, Math.min(80, d.lat + dy * degPerPx))}));
        setHover(null);
      }
      return;
    }
    const r = e.currentTarget.getBoundingClientRect();
    const c = cellAt(e.clientX - r.left, e.clientY - r.top);
    if (c !== hover) setHover(c);
  };
  const onPointerUp = (e: PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved) {
      const r = e.currentTarget.getBoundingClientRect();
      select(cellAt(e.clientX - r.left, e.clientY - r.top));
    }
  };
  const onKeyDown = (e: KeyboardEvent<HTMLCanvasElement>) => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '_', 'Enter', ' ', 'Escape'].includes(e.key)) onInteract?.();
    const turn: Record<string, [number, number]> = {ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, 8], ArrowDown: [0, -8]};
    if (turn[e.key]) {
      e.preventDefault();
      stop();
      setKeyboard(true);
      const [dl, dp] = turn[e.key];
      setView(v => ({...v, lon: v.lon + dl / v.k, lat: Math.max(-80, Math.min(80, v.lat + dp / v.k))}));
    } else if (e.key === '+' || e.key === '=') zoomBy(1.5);
    else if (e.key === '-' || e.key === '_') zoomBy(1 / 1.5);
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      stop();
      setKeyboard(true);
      select(cellAt(size.w / 2, size.h / 2));
    } else if (e.key === 'Escape') select(null);
  };

  return (
    <>
    <canvas
      ref={canvasRef}
      role="application"
      aria-label={`${title}. Drag or use the arrow keys to turn the globe, plus and minus to zoom. Click a cell, or press Enter to open the cell under the crosshair.`}
      aria-describedby={feedbackId}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onFocus={e => {
        const isKeyboard = e.currentTarget.matches(':focus-visible');
        setKeyboard(isKeyboard);
        if (isKeyboard) {
          onInteract?.();
          stop();
          setHover(cellAt(size.w / 2, size.h / 2));
        }
      }}
      onBlur={() => {
        setKeyboard(false);
        setHover(null);
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { drag.current = null; }}
      onPointerLeave={() => !drag.current && setHover(null)}
      style={{display: 'block', width: '100%', height: '100%', flex: '1 1 auto', minHeight: 0, touchAction: 'none', cursor: drag.current ? 'grabbing' : hover !== null ? 'pointer' : 'grab', outline: keyboard ? '3px solid var(--color-text-accent)' : 'none', outlineOffset: 2}}
    >
      {title}
    </canvas>
    <output id={feedbackId} aria-live={keyboard ? 'polite' : 'off'} aria-atomic="true">
      <Text type="supporting">
        {keyboard
          ? hover !== null && describeCell
            ? `${selectedCell === hover ? 'Selected: ' : 'Under the crosshair: '}${describeCell(hover).join('. ')}`
            : 'No land cell under the crosshair. Use the arrow keys to turn towards land.'
          : 'Arrow keys turn the globe; Enter selects the cell under the crosshair.'}
      </Text>
    </output>
    </>
  );
}
