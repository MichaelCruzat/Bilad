import {geoProjection} from 'd3-geo';

/**
 * The texture has square texels for a 0.625° × 0.5° native cell, so it is
 * not a 2:1 equirectangular image. Scale latitude to that actual texture
 * height while retaining d3's antimeridian clipping for boundary paths.
 */
export function globeTextureProjection(width: number, height: number) {
  return geoProjection((lambda, phi) => [lambda, phi * 2 * height / width])
    .scale(width / (2 * Math.PI))
    .translate([width / 2, height / 2]);
}

export function globeTexturePoint(lon: number, lat: number, width: number, height: number): [number, number] {
  return [(lon + 180) / 360 * width, (90 - lat) / 180 * height];
}
