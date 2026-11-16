/**
 * Colour scales for maps printed on TRACE's paper.
 *
 * Diverging scales are pale in the middle, close to the paper, so small,
 * insignificant changes recede and large changes carry ink, in the spirit of
 * Crameri's "vik" and ColorBrewer's RdBu/BrBG. Hue conventions follow IPCC
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
  temperature: ['#163a6b', '#2c66a8', '#6e9fd0', '#b9d1e6', '#e6dfd0', '#f0c3a2', '#df7a4c', '#b33a26', '#6b1a10'],
  moisture: ['#5a3510', '#94621f', '#cf9f57', '#ead2a0', '#e6dfd0', '#a9d8cb', '#4ea492', '#1d6e62', '#0c3c35'],
  wind: ['#2d1b5e', '#5b3d99', '#a387dc', '#d9cdf0', '#e6dfd0', '#f2d9a6', '#dca33a', '#9c6b18', '#5a3a08'],
};

const rampCache = new Map<PaletteName, (t: number) => string>();

export function divergingColor(palette: PaletteName, value: number, maxAbs: number): string {
  let fn = rampCache.get(palette);
  if (!fn) {
    fn = ramp(DIVERGING[palette]);
    rampCache.set(palette, fn);
  }
  if (!Number.isFinite(value) || maxAbs <= 0) return NO_DATA;
  return fn(0.5 + value / (2 * maxAbs));
}

/** Cells with no value: a little darker than the paper. */
export const NO_DATA = '#d8d0bf';

export function paletteStops(palette: PaletteName, n = 32): string[] {
  return Array.from({length: n}, (_, i) => divergingColor(palette, -1 + (2 * i) / (n - 1), 1));
}


/** Sequential scale for |S/N|. */
export const emergenceRamp = ramp(['#ece5d6', '#cfdcc6', '#93c2ad', '#4f9496', '#2b6380', '#1b3654']);


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
  // Select just the required order statistic instead of sorting millions of
  // annual values. Only this private copy is partitioned; callers keep their data.
  const target = Math.min(abs.length - 1, Math.floor(abs.length * 0.95));
  let left = 0;
  let right = abs.length - 1;
  while (left < right) {
    const pivot = abs[(left + right) >>> 1];
    let i = left;
    let j = right;
    while (i <= j) {
      while (abs[i] < pivot) i++;
      while (abs[j] > pivot) j--;
      if (i <= j) {
        [abs[i], abs[j]] = [abs[j], abs[i]];
        i++;
        j--;
      }
    }
    if (target <= j) right = j;
    else if (target >= i) left = i;
    else break;
  }
  return niceLimit(abs[target]);
}

/**
 * Verdict colours, in the order of the agreement index used by the global
 * products: corroborated, same direction, weakly supported, contradicted,
 * not supported, no detectable trend.
 */
export const VERDICT_COLORS = ['#2f9467', '#d1a12f', '#a39a6a', '#c42a24', '#e0742f', '#d3cab8'];
