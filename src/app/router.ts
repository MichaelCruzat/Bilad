/**
 * Hash router. Routes:
 *   #/                         casebook
 *   #/case/<id>                case file
 *   #/atlas/<ISO3>?v=&layer=&cell=&from=&to=&band=
 *   #/method?s=<section>
 *   #/world?v=&layer=&year=&cell=&country=
 *   #/brief/<ISO3>
 * Using the hash keeps deep links working on GitHub Pages with no server.
 */
import {useCallback, useEffect, useState} from 'react';

export type Route =
  | {page: 'home'}
  | {page: 'case'; id: string}
  | {page: 'atlas'; iso3: string; params: URLSearchParams}
  | {page: 'method'; params: URLSearchParams}
  | {page: 'world'; params: URLSearchParams}
  | {page: 'brief'; iso3: string}
  | {page: 'missing'; path: string};

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, '') || '/';
  const [path, query = ''] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return {page: 'home'};
  if (parts[0] === 'case' && parts[1]) return {page: 'case', id: parts[1]};
  if (parts[0] === 'atlas') return {page: 'atlas', iso3: (parts[1] ?? 'CHL').toUpperCase(), params: new URLSearchParams(query)};
  if (parts[0] === 'brief' && parts[1]) return {page: 'brief', iso3: parts[1].toUpperCase()};
  if (parts[0] === 'world') return {page: 'world', params: new URLSearchParams(query)};
  if (parts[0] === 'method') return {page: 'method', params: new URLSearchParams(query)};
  return {page: 'missing', path};
}

export function atlasHref(iso3: string, params: Record<string, string | number | undefined | null> = {}): string {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  });
  const qs = q.toString();
  return `#/atlas/${iso3}${qs ? `?${qs}` : ''}`;
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

/** Replace query parameters on the current atlas route without adding history entries. */
export function useAtlasParams(iso3: string, params: URLSearchParams) {
  return useCallback(
    (patch: Record<string, string | number | null | undefined>) => {
      const next = new URLSearchParams(params);
      Object.entries(patch).forEach(([k, v]) => {
        if (v === null || v === undefined || v === '') next.delete(k);
        else next.set(k, String(v));
      });
      const qs = next.toString();
      window.history.replaceState(null, '', `#/atlas/${iso3}${qs ? `?${qs}` : ''}`);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    },
    [iso3, params],
  );
}

/** Like useAtlasParams, for any route prefix such as '#/world'. */
export function useAtlasParamsAt(prefix: string, params: URLSearchParams) {
  return useCallback(
    (patch: Record<string, string | number | null | undefined>) => {
      const next = new URLSearchParams(params);
      Object.entries(patch).forEach(([k, v]) => {
        if (v === null || v === undefined || v === '') next.delete(k);
        else next.set(k, String(v));
      });
      const qs = next.toString();
      window.history.replaceState(null, '', `${prefix}${qs ? `?${qs}` : ''}`);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    },
    [prefix, params],
  );
}
