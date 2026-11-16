import {useEffect, useState} from 'react';
import type {MultiLineString} from 'geojson';

export const REGIONAL_ZOOM = 3;
export type Bounds = [west: number, south: number, east: number, north: number];
export type RegionalLine = {points: number[][]; bounds: Bounds};

let cached: RegionalLine[] | null = null;
let pending: Promise<RegionalLine[]> | null = null;

/** This display-only asset has no names or properties and is fetched on zoom. */
export function loadRegionalBoundaries(): Promise<RegionalLine[]> {
  if (cached) return Promise.resolve(cached);
  if (!pending) pending = fetch(`${import.meta.env.BASE_URL ?? './'}data/admin1.json`)
    .then(response => {
      if (!response.ok) throw new Error(`Regional boundaries: HTTP ${response.status}`);
      return response.json() as Promise<MultiLineString>;
    })
    .then(geometry => {
      if (geometry.type !== 'MultiLineString') throw new Error('Invalid regional boundary geometry');
      cached = geometry.coordinates.map(points => {
        let west = Infinity, east = -Infinity, south = Infinity, north = -Infinity;
        for (const [lon, lat] of points) {
          west = Math.min(west, lon); east = Math.max(east, lon);
          south = Math.min(south, lat); north = Math.max(north, lat);
        }
        return {points, bounds: [west, south, east, north] as Bounds};
      });
      return cached;
    })
    .catch(error => { pending = null; throw error; });
  return pending;
}

/** One optional layer: failure leaves the climate map usable; re-zoom retries. */
export function useRegionalBoundaries(zoom: number): RegionalLine[] | null {
  const enabled = zoom >= REGIONAL_ZOOM;
  const [lines, setLines] = useState<RegionalLine[] | null>(cached);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    loadRegionalBoundaries().then(value => { if (live) setLines(value); }, () => {});
    return () => { live = false; };
  }, [enabled]);
  return enabled ? lines : null;
}

/** West > east means the viewport crosses the date line. */
export function regionalLinesInBounds(lines: RegionalLine[], view: Bounds): RegionalLine[] {
  return lines.filter(({bounds: [w, s, e, n]}) => n >= view[1] && s <= view[3] &&
    (view[0] <= view[2] ? e >= view[0] && w <= view[2] : e >= view[0] || w <= view[2]));
}

const normalizeLon = (value: number) => ((value + 180) % 360 + 360) % 360 - 180;

/** Conservative spherical cap containing the visible, zoomed orthographic map. */
export function globeViewBounds(lon: number, lat: number, radius: number, width: number, height: number): Bounds {
  const cap = Math.asin(Math.min(1, Math.hypot(width, height) / (2 * radius)));
  const degrees = cap * 180 / Math.PI;
  const south = Math.max(-90, lat - degrees), north = Math.min(90, lat + degrees);
  if (Math.abs(lat) + degrees >= 90) return [-180, south, 180, north];
  const delta = Math.asin(Math.min(1, Math.sin(cap) / Math.cos(lat * Math.PI / 180))) * 180 / Math.PI;
  return [normalizeLon(lon - delta), south, normalizeLon(lon + delta), north];
}
