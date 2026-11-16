import {expect, it} from 'vitest';
import {globeTexturePoint, globeTextureProjection} from '../src/viz/globeTexture';
import {geoPath} from 'd3-geo';

it('places data centres and geographic boundaries at the same texture coordinates', () => {
  // The 1152×720 texture deliberately differs from the usual 2:1 aspect.
  for (const [width, height] of [[1152, 720], [1024, 512]]) {
    const outline = globeTextureProjection(width, height);
    for (const [lon, lat] of [[0, 0], [-73.75, -33.5], [90, 24], [135, 60], [179.375, -17], [-179.375, 70], [0, 83.5], [0, -58.5]]) {
      const expected = globeTexturePoint(lon, lat, width, height);
      const actual = outline([lon, lat])!;
      expect(actual[0]).toBeCloseTo(expected[0], 8);
      expect(actual[1]).toBeCloseTo(expected[1], 8);
    }
  }
});

it('cuts boundary lines at the antimeridian instead of drawing through the texture', () => {
  const segments: number[][] = [];
  const context = {
    beginPath() {},
    moveTo(x: number, y: number) { segments.push([x, y]); },
    lineTo(x: number, y: number) {
      const previous = segments.at(-1)!;
      expect(Math.abs(x - previous[0])).toBeLessThan(30);
      segments.push([x, y]);
    },
    closePath() {}, arc() {},
  };
  geoPath(globeTextureProjection(1152, 720), context)({type: 'LineString', coordinates: [[179, -17], [-179, -17]]});
  expect(segments.length).toBeGreaterThan(2);
});
