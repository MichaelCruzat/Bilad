/** Spearman rank correlation with average ranks for ties; undefined results are null. */
export function spearman(a: ArrayLike<number>, b: ArrayLike<number>): number | null {
  const n = a.length;
  if (n < 2 || b.length !== n) return null;
  for (let i = 0; i < n; i++) {
    if (!Number.isFinite(a[i]) || !Number.isFinite(b[i])) return null;
  }

  const ranksA = averageRanks(a);
  const ranksB = averageRanks(b);
  const mean = (n - 1) / 2;
  let covariance = 0;
  let varianceA = 0;
  let varianceB = 0;
  for (let i = 0; i < n; i++) {
    const centeredA = ranksA[i] - mean;
    const centeredB = ranksB[i] - mean;
    covariance += centeredA * centeredB;
    varianceA += centeredA ** 2;
    varianceB += centeredB ** 2;
  }
  if (varianceA === 0 || varianceB === 0) return null;
  const correlation = covariance / Math.sqrt(varianceA * varianceB);
  return Math.max(-1, Math.min(1, correlation));
}

function averageRanks(values: ArrayLike<number>): number[] {
  const order = Array.from({length: values.length}, (_, i) => i).sort((a, b) => values[a] - values[b]);
  const ranks = new Array<number>(values.length);
  let start = 0;
  while (start < order.length) {
    let end = start + 1;
    while (end < order.length && values[order[end]] === values[order[start]]) end++;
    const rank = (start + end - 1) / 2;
    for (let i = start; i < end; i++) ranks[order[i]] = rank;
    start = end;
  }
  return ranks;
}
