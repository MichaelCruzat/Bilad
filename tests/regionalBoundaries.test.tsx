import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {renderHook, waitFor} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {geoOrthographic} from 'd3-geo';
import {globeViewBounds, regionalLinesInBounds, useRegionalBoundaries, type RegionalLine} from '../src/lib/regionalBoundaries';

afterEach(() => vi.unstubAllGlobals());

it('does not fetch at overview, loads once on zoom, and hides again on zoom out', async () => {
  const fetch = vi.fn(async () => new Response(JSON.stringify({type: 'MultiLineString', coordinates: [[[-120, 40], [-110, 40]]]})));
  vi.stubGlobal('fetch', fetch);
  const {result, rerender} = renderHook(({zoom}) => useRegionalBoundaries(zoom), {initialProps: {zoom: 1}});
  expect(fetch).not.toHaveBeenCalled();
  rerender({zoom: 3});
  await waitFor(() => expect(result.current).toHaveLength(1));
  rerender({zoom: 1});
  expect(result.current).toBeNull();
  rerender({zoom: 4});
  expect(result.current).toHaveLength(1);
  expect(fetch).toHaveBeenCalledTimes(1);
});

it('culls off-screen lines and includes both sides of a date-line viewport', () => {
  const lines: RegionalLine[] = [
    {points: [], bounds: [-125, 30, -110, 45]},
    {points: [], bounds: [-10, 36, 5, 45]},
    {points: [], bounds: [175, -20, 179, 0]},
    {points: [], bounds: [-179, -20, -175, 0]},
  ];
  expect(regionalLinesInBounds(lines, [-130, 20, -60, 60])).toEqual([lines[0]]);
  expect(regionalLinesInBounds(lines, [170, -30, -170, 20])).toEqual(lines.slice(2));
});

it('keeps the visible orthographic corners inside the region-culling cap', () => {
  for (const [lon, lat] of [[175, 20], [-100, 38], [20, 75]]) {
    const bounds = globeViewBounds(lon, lat, 900, 600, 500);
    const project = geoOrthographic().rotate([-lon, -lat]).scale(900).translate([300, 250]);
    for (const point of [[0, 0], [600, 0], [0, 500], [600, 500]]) {
      const [x, y] = project.invert!([point[0], point[1]])!;
      const line: RegionalLine = {points: [], bounds: [x, y, x, y]};
      expect(regionalLinesInBounds([line], bounds)).toEqual([line]);
    }
  }
});

it('ships generalized geometry without names and retains US internal boundaries', () => {
  const bytes = readFileSync(join(__dirname, '../public/data/admin1.json'));
  const shape = JSON.parse(bytes.toString());
  expect(Object.keys(shape).sort()).toEqual(['coordinates', 'type']);
  expect(bytes.length).toBeLessThan(1200000);
  let vertices = 0, usLines = 0;
  for (const line of shape.coordinates as number[][][]) {
    vertices += line.length;
    if (line.some(([x, y]) => x > -125 && x < -67 && y > 25 && y < 49)) usLines++;
    for (let i = 0; i < line.length; i++) {
      expect(line[i].every(Number.isFinite)).toBe(true);
      if (i) expect(Math.abs(line[i][0] - line[i - 1][0])).toBeLessThanOrEqual(180);
    }
  }
  expect(vertices).toBeLessThan(70000);
  expect(usLines).toBeGreaterThan(40);
});
