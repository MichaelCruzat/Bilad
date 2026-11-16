import {describe, expect, it} from 'vitest';
import {spearman} from '../src/lib/rank';

describe('spearman', () => {
  it('averages tied ranks and preserves the result when paired rows are reordered', () => {
    const coverage = [0, 0, 1, 1];
    const flagged = [0, 1, 2, 3];
    const order = [1, 0, 3, 2];
    const expected = 2 / Math.sqrt(5);

    expect(spearman(coverage, flagged)).toBeCloseTo(expected, 14);
    expect(spearman(order.map(i => coverage[i]), order.map(i => flagged[i]))).toBeCloseTo(expected, 14);
  });

  it('averages ties in both vectors', () => {
    expect(spearman([1, 1, 2, 3], [1, 2, 2, 3])).toBeCloseTo(5 / 6, 14);
  });

  it('returns null for constant coverage, including complete coverage', () => {
    expect(spearman([1, 1, 1, 1], [0, 1, 2, 3])).toBeNull();
    expect(spearman([0, 1, 2, 3], [0, 0, 0, 0])).toBeNull();
    expect(spearman([1, 1, 1], [1, 1, 1])).toBeNull();
  });

  it('returns perfect positive correlation, including ties', () => {
    expect(spearman([4, 1, 2, 2], [40, 10, 20, 20])).toBeCloseTo(1, 14);
  });

  it('returns perfect negative correlation, including ties', () => {
    expect(spearman([4, 1, 2, 2], [-40, -10, -20, -20])).toBeCloseTo(-1, 14);
  });

  it('returns zero for valid vectors without rank correlation', () => {
    expect(spearman([1, 2, 3, 4], [2, 4, 1, 3])).toBe(0);
  });

  it('requires at least two aligned pairs', () => {
    expect(spearman([], [])).toBeNull();
    expect(spearman([1], [2])).toBeNull();
    expect(spearman([1, 2], [1])).toBeNull();
    expect(spearman([1], [1, 2])).toBeNull();
    expect(spearman([1, 2], [3, 4])).toBeCloseTo(1, 14);
  });

  it.each([NaN, Infinity, -Infinity])('rejects a non-finite input (%s) in either vector', value => {
    expect(spearman([1, value, 3], [1, 2, 3])).toBeNull();
    expect(spearman([1, 2, 3], [1, value, 3])).toBeNull();
  });

  it('accepts typed arrays and preserves the original inputs', () => {
    const a = new Float64Array([3, 1, 2, 2]);
    const b = new Float64Array([30, 10, 20, 20]);

    expect(spearman(a, b)).toBeCloseTo(1, 14);
    expect(Array.from(a)).toEqual([3, 1, 2, 2]);
    expect(Array.from(b)).toEqual([30, 10, 20, 20]);
  });
});
