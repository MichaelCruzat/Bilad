import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {render, screen, within} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {Theme} from '@astryxdesign/core/theme';
import {themes, defaultThemeSlug} from '../src/astryx-themes';
import App from '../src/app/App';
import {parseHash} from '../src/app/router';
import {CASES} from '../src/data/cases';

const DATA = join(__dirname, '..', 'public', 'data');

/** Serve public/data from disk so pages render with the real shipped data. */
function serveData() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const path = url.slice(url.indexOf('data/') + 5);
      try {
        const buf = readFileSync(join(DATA, path));
        return new Response(path.endsWith('.i16') ? buf : buf.toString('utf8'), {status: 200});
      } catch {
        return new Response('missing', {status: 404});
      }
    }),
  );
}

function renderAt(hash: string) {
  window.location.hash = hash;
  return render(
    <Theme theme={themes[defaultThemeSlug]} mode="dark">
      <App />
    </Theme>,
  );
}

beforeEach(serveData);
afterEach(() => vi.unstubAllGlobals());

describe('router', () => {
  it('parses every route', () => {
    expect(parseHash('')).toEqual({page: 'home'});
    expect(parseHash('#/case/chile-megadrought')).toEqual({page: 'case', id: 'chile-megadrought'});
    const atlas = parseHash('#/atlas/chl?v=PRECTOTCORR&region=central');
    expect(atlas.page).toBe('atlas');
    if (atlas.page === 'atlas') {
      expect(atlas.iso3).toBe('CHL');
      expect(atlas.params.get('v')).toBe('PRECTOTCORR');
    }
    const method = parseHash('#/method?s=fdr');
    expect(method.page === 'method' && method.params.get('s')).toBe('fdr');
    const bare = parseHash('#/atlas');
    expect(bare.page === 'atlas' && bare.iso3).toBe('CHL');
    expect(parseHash('#/nope').page).toBe('missing');
  });
});

describe('casebook', () => {
  it('opens on a data-derived claim and lists every case', async () => {
    renderAt('#/');
    expect(await screen.findByRole('heading', {level: 1, name: 'Bilad'})).toBeInTheDocument();
    expect(await screen.findByText(/of the world’s land has warmed beyond chance/, {}, {timeout: 8000})).toBeInTheDocument();
    expect(await screen.findByText(/Central Chile has had \d+–\d+% less rain since 2010/, {}, {timeout: 8000})).toBeInTheDocument();
    for (const c of CASES) expect(screen.getByRole('link', {name: c.title})).toHaveAttribute('href', `#/case/${c.id}`);
    expect(await screen.findByRole('application', {name: /World map: is each land cell’s warming trend backed by weather stations/}, {timeout: 8000})).toBeInTheDocument();
  });

  it('shows the six-nation ledger with verdicts', async () => {
    renderAt('#/');
    const links = await screen.findAllByRole('link', {name: 'Bangladesh'});
    expect(links.length).toBe(2); // nation strip and ledger table
    const table = links.map(l => l.closest('table')).find(Boolean)!;
    expect(within(table).getAllByText('Contradicted').length).toBeGreaterThan(0);
  });
});

describe('case file', () => {
  it('walks the Bangladesh case to a data-artefact verdict', async () => {
    renderAt('#/case/bangladesh-phantom-cooling');
    expect(await screen.findByRole('heading', {name: /Not climate: a likely artefact of the dataset/}, {timeout: 5000})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: /A jump in 199\d, not a ramp/})).toBeInTheDocument();
  });

  it('reports the Chile megadrought deficit from both records', async () => {
    renderAt('#/case/chile-megadrought');
    expect(await screen.findByText(/^\d+% less rain$/, {}, {timeout: 5000})).toBeInTheDocument();
    expect(screen.getByText(/GPCP, on the same cells, shows \d+% less/)).toBeInTheDocument();
  });
});

describe('navigation between cases', () => {
  it('moves from a nation without regions to a regional case without crashing', async () => {
    renderAt('#/case/kenya-half-the-warming');
    expect(await screen.findByRole('heading', {name: /Real direction, uncertain size/}, {timeout: 5000})).toBeInTheDocument();
    window.location.hash = '#/case/chile-megadrought';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(await screen.findByRole('heading', {name: /Supported: a partly independent/}, {timeout: 5000})).toBeInTheDocument();
  });

  it('never shows an error banner while a nation is still loading', async () => {
    renderAt('#/atlas/KEN');
    expect(screen.queryByText(/Could not load/)).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', {level: 2, name: /Kenya, whole nation/}, {timeout: 5000})).toBeInTheDocument();
  });
});

describe('world atlas', () => {
  it('cross-examines any country picked from the global grid', async () => {
    renderAt('#/world?country=050');
    expect(await screen.findByRole('heading', {level: 2, name: 'Bangladesh'}, {timeout: 10000})).toBeInTheDocument();
    expect(await screen.findByText('Contradicted', {}, {timeout: 10000})).toBeInTheDocument();
  });

  it('summarises the whole world when nothing is selected', async () => {
    renderAt('#/world');
    expect(await screen.findByRole('heading', {name: /The world since 1981/}, {timeout: 10000})).toBeInTheDocument();
    expect(screen.getByText(/land cells, temperature has changed by/)).toBeInTheDocument();
  });
});

describe('method', () => {
  it('documents every test with references', async () => {
    renderAt('#/method');
    await screen.findByRole('heading', {level: 1, name: /How Bilad decides/});
    for (const name of ['Trend size: Theil–Sen', 'Field significance: false-discovery control', 'Integrity screen: ramp or jump?', 'Cross-examination']) {
      expect(screen.getByRole('heading', {name})).toBeInTheDocument();
    }
    expect(screen.getByRole('link', {name: /Hamed & Rao \(1998\)/})).toHaveAttribute('href', expect.stringContaining('doi.org'));
  });
});
