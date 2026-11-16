import {act, render} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {GlobalCells} from '../src/lib/globalData';
import {fitWorldMapCamera, WorldMap, type WorldMapControls} from '../src/viz/WorldMap';

function cells(rows: Array<{lat: number; lon: number; country: number}>): GlobalCells {
  return {
    n: rows.length,
    lat: Float32Array.from(rows, row => row.lat),
    lon: Float32Array.from(rows, row => row.lon),
    area: new Float32Array(rows.length),
    land: new Float32Array(rows.length),
    country: Uint16Array.from(rows, row => row.country),
  };
}

function stats(n: number) {
  return {
    variable: 'T2M',
    slope: new Float32Array(n),
    low: new Float32Array(n),
    high: new Float32Array(n),
    p: new Float32Array(n),
    snr: new Float32Array(n),
    normal: new Float32Array(n),
    flags: new Uint8Array(n),
    agreement: new Uint8Array(n),
    years: 44,
  };
}

describe('fitWorldMapCamera', () => {
  it('fits the selected country’s actual data cells and recentres them', () => {
    const camera = fitWorldMapCamera(
      cells([
        {lat: 20, lon: -10, country: 7},
        {lat: 25, lon: 10, country: 7},
        {lat: 0, lon: 120, country: 8},
      ]),
      7,
      {w: 1000, h: 500},
      [-180, -60, 180, 84],
    );

    expect(camera).not.toBeNull();
    expect(camera!.k).toBeGreaterThan(1);

    // The two selected cell centres should remain centred after the fit.
    const baseScale = Math.min(1000 / 360, 500 / 144);
    const baseOffsetY = (500 - 144 * baseScale) / 2;
    const baseCenterX = (0 - -180) * baseScale;
    const baseCenterY = baseOffsetY + (84 - 22.5) * baseScale;
    expect(camera!.x + camera!.k * baseCenterX).toBeCloseTo(500, 4);
    expect(camera!.y + camera!.k * baseCenterY).toBeCloseTo(250, 4);
  });

  it('does not zoom into the wrong side of a country that crosses the antimeridian', () => {
    const camera = fitWorldMapCamera(
      cells([
        {lat: 10, lon: 179.6875, country: 9},
        {lat: 10, lon: -179.6875, country: 9},
        {lat: 20, lon: 179.6875, country: 9},
        {lat: 20, lon: -179.6875, country: 9},
      ]),
      9,
      {w: 1000, h: 500},
      [-180, -60, 180, 84],
    );

    expect(camera).not.toBeNull();
    expect(camera!.k).toBe(1);
    expect(camera!.x).toBeCloseTo(0, 6);
  });

  it('returns no camera for an empty country selection', () => {
    expect(
      fitWorldMapCamera(cells([{lat: 0, lon: 0, country: 1}]), 2, {w: 800, h: 400}, [-180, -60, 180, 84]),
    ).toBeNull();
  });
});

describe('WorldMap country camera lifecycle', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('fits an initial deep-linked country and refits only when its canvas resizes', () => {
    vi.useFakeTimers();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    vi.stubGlobal('matchMedia', () => ({matches: true}));
    let resize: (() => void) | null = null;
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: () => void) {
        resize = callback;
      }
      observe() {}
      disconnect() {}
    });

    const data = cells([
      {lat: 20, lon: -10, country: 7},
      {lat: 25, lon: 10, country: 7},
      {lat: 0, lon: 120, country: 8},
    ]);
    const controls: {current: WorldMapControls | null} = {current: null};
    const props = {
      cells: data,
      stats: stats(data.n),
      annual: null,
      layer: 'verdict' as const,
      year: 2024,
      firstYear: 1981,
      extent: [-180, -60, 180, 84] as [number, number, number, number],
      reliefUrl: '',
      world: null,
      selectedCell: null,
      selectedCountry: 7,
      countryIds: [],
      controls,
      title: 'Test world map',
    };
    const {container, rerender} = render(<WorldMap {...props} />);
    const canvas = container.querySelector('canvas') as HTMLCanvasElement & {__zoom?: {x: number; y: number; k: number}};
    const initial = canvas.__zoom!;
    expect(initial.k).toBe(fitWorldMapCamera(data, 7, {w: 960, h: 420}, props.extent)!.k);

    act(() => {
      controls.current?.zoomBy(1 / 1.6);
      vi.runAllTimers();
    });
    const afterManualZoom = {...canvas.__zoom!};
    expect(afterManualZoom.k).toBeLessThan(initial.k);
    rerender(<WorldMap {...props} />);
    expect(canvas.__zoom).toEqual(afterManualZoom);

    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({width: 600, height: 300} as DOMRect);
    act(() => resize?.());
    expect(canvas.__zoom!.k).toBe(fitWorldMapCamera(data, 7, {w: 600, h: 300}, props.extent)!.k);
  });
});
