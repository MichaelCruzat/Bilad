import {useEffect, useState} from 'react';

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

/**
 * Step through years on a timer. `autoplay` starts it on mount unless the
 * reader prefers reduced motion; at the last year it holds, then loops.
 */
export function usePlayback(first: number, last: number, {autoplay = false, stepMs = 380, holdMs = 2600, initial = last} = {}) {
  const [year, setYear] = useState(initial);
  const [playing, setPlaying] = useState(() => autoplay && !prefersReducedMotion());
  useEffect(() => {
    if (!playing) return;
    const delay = year >= last ? holdMs : stepMs;
    const id = window.setTimeout(() => setYear(y => (y >= last ? first : y + 1)), delay);
    return () => window.clearTimeout(id);
  }, [playing, year, first, last, stepMs, holdMs]);
  return {year: Math.min(last, Math.max(first, year)), setYear, playing, setPlaying};
}
