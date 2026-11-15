/** Chart chrome drawn from theme tokens; only data marks carry palette colours. */
export const CHROME = {
  ink: 'var(--color-text-primary)',
  muted: 'var(--color-text-secondary)',
  faint: 'var(--color-text-disabled)',
  grid: 'var(--color-border)',
  axis: 'var(--color-border-emphasized)',
  land: 'var(--color-background-surface)',
  body: 'var(--color-background-body)',
  accent: 'var(--color-text-accent)',
  witness: 'var(--color-text-cyan)',
  font: 'var(--font-family-body)',
  mono: 'var(--font-family-code)',
} as const;

/** Nice tick values covering [min, max]. */
export function ticks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return [min];
  const span = max - min;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= step0) ?? 10 * mag;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  return out;
}
