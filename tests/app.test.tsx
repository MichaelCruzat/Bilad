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
    expect(parseHash('#/method')).toEqual({page: 'method'});
    const bare = parseHash('#/atlas');
    expect(bare.page === 'atlas' && bare.iso3).toBe('CHL');
    expect(parseHash('#/nope').page).toBe('missing');
  });
});

describe('casebook', () => {
  it('opens on a data-derived claim and lists every case', async () => {
    renderAt('#/');
    expect(await screen.findByRole('heading', {level: 1, name: /Central Chile has had \d+–\d+% less rain since 2010\. Bangladesh did not cool\./}, {timeout: 5000})).toBeInTheDocument();
    for (const c of CASES) expect(screen.getByRole('link', {name: c.title})).toHaveAttribute('href', `#/case/${c.id}`);
    expect(await screen.findByRole('application', {name: /Chile: rainfall trend per decade/})).toBeInTheDocument();
  });

  it('shows the six-nation ledger with verdicts', async () => {
    renderAt('#/');
    const link = await screen.findByRole('link', {name: 'Bangladesh'});
    const table = link.closest('table')!;
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
