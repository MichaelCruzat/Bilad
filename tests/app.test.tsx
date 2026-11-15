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
    expect(parseHash('#/nope').page).toBe('missing');
  });
});

describe('casebook', () => {
  it('opens on a data-derived claim and lists every case', async () => {
    renderAt('#/');
    expect(await screen.findByRole('heading', {level: 1, name: /Central Chile lost \d+% of its rain\. Bangladesh did not cool\./})).toBeInTheDocument();
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
    expect(await screen.findByText(/less rain/, {}, {timeout: 5000})).toBeInTheDocument();
    expect(screen.getByText(/GPCP, on the same cells, shows \d+% less/)).toBeInTheDocument();
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
