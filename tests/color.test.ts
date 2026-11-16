import {expect, it} from 'vitest';
import {niceLimit, robustLimit} from '../src/viz/color';

it('keeps the exact 95th-percentile scale for ordered, tied and missing data', () => {
  const random = Array.from({length: 50000}, (_, i) => Math.sin(i * 13.791) * (i % 997));
  for (const values of [random, [...random].reverse(), [...random].sort((a, b) => a - b), Array(5000).fill(3), [NaN, Infinity, -Infinity], [NaN, -2, 0, 8]]) {
    const input = Float32Array.from(values);
    const copy = input.slice();
    const sorted = Array.from(input).filter(Number.isFinite).map(Math.abs).sort((a, b) => a - b);
    expect(robustLimit(input)).toBe(sorted.length ? niceLimit(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]) : 1);
    expect(input).toEqual(copy);
  }
});
