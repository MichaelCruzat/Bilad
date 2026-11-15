/**
 * Colour scales for a dark map.
 *
 * Diverging scales are dark in the middle so that small, insignificant
 * changes recede into the background and large changes glow, in the spirit
 * of Crameri's "berlin" scientific colour map. Hue conventions follow IPCC
 * AR6: blue–red for temperature, brown–teal for water. Interpolation is in
 * OKLab so lightness changes evenly along the ramp.
 */
import type {PaletteName} from '../data/variables';

type Rgb = [number, number, number];
type Lab = [number, number, number];

function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const toLinear = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const fromLinear = (v: number) => {
  const c = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
  return Math.round(Math.max(0, Math.min(1, c)) * 255);
};

function rgbToOklab([r, g, b]: Rgb): Lab {
  const lr = toLinear(r), lg = toLinear(g), lb = toLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToHex([L, a, b]: Lab): string {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const r = fromLinear(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
  const g = fromLinear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
  const bl = fromLinear(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}

/** Build a 0..1 → hex interpolator through the given stops. */
export function ramp(stops: string[]): (t: number) => string {
  const labs = stops.map(s => rgbToOklab(hexToRgb(s)));
  const cache = new Map<number, string>();
  return (t: number) => {
    const clamped = Math.max(0, Math.min(1, t));
    const key = Math.round(clamped * 255);
    const hit = cache.get(key);
    if (hit) return hit;
    const x = (key / 255) * (labs.length - 1);
    const i = Math.min(labs.length - 2, Math.floor(x));
    const f = x - i;
    const a = labs[i];
    const b = labs[i + 1];
    const out = oklabToHex([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]);
    cache.set(key, out);
    return out;
  };
}

/** Low → high stops for each diverging palette. */
const DIVERGING: Record<PaletteName, string[]> = {
  temperature: ['#cfe3ff', '#6fa3e8', '#2f5f9e', '#1f2c3d', '#202329', '#4a2219', '#a8442c', '#e8744a', '#ffd1b3'],
  moisture: ['#ffe2b0', '#e0a54e', '#94621f', '#3a2c1b', '#202329', '#15363a', '#1d7a70', '#4fc2ad', '#c4f5e8'],
  wind: ['#ead9ff', '#a985e6', '#5b3d99', '#2c2340', '#202329', '#3d2f15', '#9c6b18', '#e0a93b', '#ffe6a8'],
};

const rampCache = new Map<PaletteName, (t: number) => string>();

export function divergingColor(palette: PaletteName, value: number, maxAbs: number): string {
  let fn = rampCache.get(palette);
  if (!fn) {
    fn = ramp(DIVERGING[palette]);
    rampCache.set(palette, fn);
  }
  if (!Number.isFinite(value) || maxAbs <= 0) return '#202329';
  return fn(0.5 + value / (2 * maxAbs));
}

export function paletteStops(palette: PaletteName, n = 32): string[] {
  return Array.from({length: n}, (_, i) => divergingColor(palette, -1 + (2 * i) / (n - 1), 1));
}

/** Sequential scale for change-point years: early = deep, late = bright. */
export const yearRamp = ramp(['#2a2550', '#4b3f8f', '#6f68c4', '#8fa6e0', '#b6e3e8', '#f1f7d2']);

/** Sequential scale for |S/N|. */
export const emergenceRamp = ramp(['#202329', '#2f3b4f', '#3d6080', '#4f93a8', '#86cbb8', '#e9f5c9']);

/**
 * 3 × 3 bivariate scheme (Stevens 2015 style): rows = heat signal class,
 * columns = drying signal class. [0][0] is neither, [2][2] both strong.
 */
export const BIVARIATE: string[][] = [
  ['#24272d', '#5b4a2a', '#b58a3c'],
  ['#4c2a33', '#7a4430', '#c2733a'],
  ['#8e2f45', '#b3413e', '#ff7b43'],
];

/** Round a max-abs value up to a "nice" legend limit. */
export function niceLimit(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const exp = Math.floor(Math.log10(value));
  const base = 10 ** exp;
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * base >= value) return m * base;
  return 10 * base;
}

/** Robust colour limit: the 95th percentile of |values|, rounded up. */
export function robustLimit(values: ArrayLike<number>): number {
  const abs: number[] = [];
  for (let i = 0; i < values.length; i++) if (Number.isFinite(values[i])) abs.push(Math.abs(values[i]));
  if (!abs.length) return 1;
  abs.sort((a, b) => a - b);
  return niceLimit(abs[Math.min(abs.length - 1, Math.floor(abs.length * 0.95))]);
}

/**
 * Verdict colours, in the order of the agreement index used by the global
 * products: corroborated, same direction, weakly supported, contradicted,
 * not supported, no detectable trend.
 */
export const VERDICT_COLORS = ['#3fbf8f', '#d9b44a', '#8f8a5c', '#e5484d', '#e07b39', '#3a4048'];
