const MINUS = '−';

export function signed(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '—';
  const fixed = Math.abs(value).toFixed(digits);
  if (Number(fixed) === 0) return fixed;
  return `${value < 0 ? MINUS : '+'}${fixed}`;
}

export function num(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '—';
  const fixed = value.toFixed(digits);
  return value < 0 ? `${MINUS}${fixed.slice(1)}` : fixed;
}

export function pValue(p: number): string {
  if (!Number.isFinite(p)) return '—';
  if (p < 0.001) return '< 0.001';
  // Three decimals below 0.1, so a p-value never rounds onto the 0.05 line.
  return p < 0.1 ? p.toFixed(3) : p.toFixed(2);
}

/** "p < 0.001" or "p = 0.03", for running text. */
export function pPhrase(p: number): string {
  const v = pValue(p);
  return v.startsWith('<') ? `p ${v}` : `p = ${v}`;
}

export function percent(fraction: number, digits = 0): string {
  return Number.isFinite(fraction) ? `${(fraction * 100).toFixed(digits)}%` : '—';
}

export function lat(value: number): string {
  return `${Math.abs(value).toFixed(2)}°${value < 0 ? 'S' : 'N'}`;
}

export function lon(value: number): string {
  return `${Math.abs(value).toFixed(2)}°${value < 0 ? 'W' : 'E'}`;
}

export function thousands(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

/** Digits for a per-decade value in a given reading unit. */
export function digitsFor(unit: string, base: number): number {
  return unit === '% of normal' ? 1 : base;
}
