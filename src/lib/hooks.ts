import {useEffect, useMemo, useState} from 'react';
import {analyzeVariable, type VariableAnalysis, type Window} from './analysis';
import {loadBoundary, loadGrid, loadIndex, loadMeta, type Boundary, type DataIndex, type NationMeta, type VariableGrid} from './nationData';
import {loadCrosscheck, type Crosscheck} from './evidence';

export type Async<T> = {status: 'loading'} | {status: 'error'; error: Error; retry: () => void} | {status: 'ready'; data: T};

export function useAsync<T>(load: () => Promise<T>, deps: unknown[]): Async<T> {
  const [state, setState] = useState<Async<T>>({status: 'loading'});
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setState({status: 'loading'});
    load().then(
      data => live && setState({status: 'ready', data}),
      error => live && setState({status: 'error', error: error as Error, retry: () => setAttempt(a => a + 1)}),
    );
    return () => {
      live = false;
    };
  }, [...deps, attempt]);
  return state;
}

export const useIndex = () => useAsync<DataIndex>(loadIndex, []);
export const useCrosscheck = () => useAsync<Crosscheck>(loadCrosscheck, []);

export type NationBundle = {meta: NationMeta; boundary: Boundary};

export function useNation(iso3: string): Async<NationBundle> {
  return useAsync(async () => {
    const [meta, boundary] = await Promise.all([loadMeta(iso3), loadBoundary(iso3)]);
    return {meta, boundary};
  }, [iso3]);
}

const analysisCache = new Map<string, VariableAnalysis>();

/** Grid + analysis for one variable/window; analyses are memoised per session. */
export function useVariable(meta: NationMeta | null, variable: string, window: Window): Async<{grid: VariableGrid; analysis: VariableAnalysis}> {
  const key = meta ? `${meta.iso3}:${variable}:${window.from}-${window.to}` : '';
  return useAsync(async () => {
    if (!meta) throw new Error('No nation loaded');
    const grid = await loadGrid(meta, variable);
    let analysis = analysisCache.get(key);
    if (!analysis) {
      // Yield so the loading state can paint before the synchronous analysis.
      await new Promise(r => setTimeout(r, 0));
      analysis = analyzeVariable(meta, grid, window);
      analysisCache.set(key, analysis);
    }
    return {grid, analysis};
  }, [key]);
}

export function useMediaQuery(query: string): boolean {
  const mql = useMemo(() => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query) : null), [query]);
  const [matches, setMatches] = useState(() => mql?.matches ?? false);
  useEffect(() => {
    if (!mql) return;
    const onChange = () => setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [mql]);
  return matches;
}
