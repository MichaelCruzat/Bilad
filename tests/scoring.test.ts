import {describe, expect, it} from 'vitest';
import {
  CANDIDATES,
  DIMENSIONS,
  MISSION_PROFILES,
  normalizeWeights,
  rankCandidates,
  scoreCandidate,
} from '../src/data/analog';

describe('Bilad analog scoring', () => {
  it('normalizes weights and falls back to equal weights when all inputs are zero', () => {
    const normalized = normalizeWeights({
      aridity: 0,
      thermalStability: 0,
      solarAccess: 0,
      terrain: 0,
      isolation: 0,
    });

    expect(Object.values(normalized)).toHaveLength(DIMENSIONS.length);
    expect(Object.values(normalized).every(weight => weight === 0.2)).toBe(true);
  });

  it('scores a candidate as a weighted, explainable average', () => {
    const candidate = CANDIDATES.find(item => item.id === 'atacama-plateau');
    if (!candidate) throw new Error('Atacama candidate missing');

    const score = scoreCandidate(candidate, MISSION_PROFILES.mars);

    expect(score).toBe(91);
  });

  it('ranks the candidates highest-first for the selected mission profile', () => {
    const ranked = rankCandidates(CANDIDATES, MISSION_PROFILES.mars);

    expect(ranked).toHaveLength(6);
    expect(ranked[0].candidate.id).toBe('atacama-plateau');
    expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[1].score);
  });

  it('keeps the original candidate data available for the evidence view', () => {
    const ranked = rankCandidates(CANDIDATES, MISSION_PROFILES.moon);

    expect(ranked[0].candidate.sources.length).toBeGreaterThan(0);
    expect(ranked[0].candidate.limitations.length).toBeGreaterThan(0);
  });
});
