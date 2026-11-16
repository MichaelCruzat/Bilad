import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {fireEvent, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {Theme} from '@astryxdesign/core/theme';
import {themes, defaultThemeSlug} from '../src/astryx-themes';
import App from '../src/app/App';
import {parseHash} from '../src/app/router';
import {CASES} from '../src/data/cases';
import * as globalData from '../src/lib/globalData';
import * as globeMap from '../src/viz/GlobeMap';

const DATA = join(__dirname, '..', 'public', 'data');

/** Serve public/data from disk so pages render with the real shipped data. */
function serveData(fail: RegExp | null = null) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const path = url.slice(url.indexOf('data/') + 5);
      if (fail && fail.test(path)) return new Response('unavailable', {status: 503});
      try {
        const buf = readFileSync(join(DATA, path));
        return new Response(buf, {status: 200});
      } catch {
        return new Response('missing', {status: 404});
      }
    }),
  );
}

function renderAt(hash: string) {
  window.location.hash = hash;
  return render(
    <Theme theme={themes[defaultThemeSlug]} mode="light">
      <App />
    </Theme>,
  );
}

beforeEach(() => {
  serveData();
  // jsdom has no canvas renderer; production-browser checks cover the maps.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('router', () => {
  it('parses every route', () => {
    expect(parseHash('')).toEqual({page: 'home'});
    expect(parseHash('#/cases')).toEqual({page: 'cases'});
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

describe('global home', () => {
  it('states the full name and global scope before linking to the explorer', async () => {
    renderAt('#/');
    expect(await screen.findByRole('heading', {level: 1, name: 'TRACE'}, {timeout: 10000})).toBeInTheDocument();
    expect(screen.getByText('Tracking Regional Atmospheric Change on Earth')).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Check the evidence before it becomes a decision.'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'For NASA data users'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'For governments and public agencies'})).toBeInTheDocument();
    expect(screen.getByText('54,425 land cells')).toBeInTheDocument();
    expect(screen.getByText('60°S–84°N')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Explore the world'})).toHaveAttribute('href', '#/world');
    expect(screen.queryByRole('button', {name: 'Bangladesh'})).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', {name: 'Bangladesh'})).not.toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Explore'})).toHaveAttribute('href', '#/world');
    expect(screen.queryByRole('link', {name: 'Nations'})).not.toBeInTheDocument();
  });

  it('keeps technical ledgers and case lists on their own routes while retaining vital context', async () => {
    renderAt('#/');
    await screen.findByRole('application', {name: /^Globe of land temperature trends since 1981/}, {timeout: 10000});
    expect(screen.getByText('Tracking Regional Atmospheric Change on Earth')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('Terms and abbreviations')).not.toBeInTheDocument();
    for (const c of CASES) expect(screen.queryByRole('link', {name: c.title})).not.toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Cases'})).toHaveAttribute('href', '#/cases');
    expect(screen.getByRole('link', {name: 'How we know'})).toHaveAttribute('href', '#/proof');
  });

  it('opens evidence for an arbitrary global cell without a national default', async () => {
    const cells = await globalData.loadGlobalCells();
    vi.spyOn(globeMap, 'GlobeMap').mockImplementation(props => <button onClick={() => props.onSelectCell?.(1508)}>Pick a global cell</button>);
    renderAt('#/');
    fireEvent.click(await screen.findByRole('button', {name: 'Pick a global cell'}, {timeout: 10000}));
    expect(screen.getByRole('link', {name: 'Investigate this cell'})).toHaveAttribute('href', '#/world?cell=1508');
    expect(cells.n).toBe(54425);
    expect(screen.queryByRole('heading', {name: 'Bangladesh'})).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalledWith(expect.stringContaining('nations/'));
  });
});

describe('cases', () => {
  it('lists all four case files in the app frame', async () => {
    renderAt('#/cases');
    expect(await screen.findByRole('heading', {level: 1, name: 'Four case files, four different outcomes'})).toBeInTheDocument();
    expect(CASES).toHaveLength(4);
    for (const c of CASES) expect(screen.getByRole('link', {name: c.title})).toHaveAttribute('href', `#/case/${c.id}`);
    expect(screen.getByRole('link', {name: 'Cases'})).toHaveAttribute('href', '#/cases');
    expect(screen.getByRole('link', {name: 'TRACE home'})).toHaveAttribute('href', '#/');
    expect(screen.queryByText('Page not found')).not.toBeInTheDocument();
  });
});

describe('case file', () => {
  it('walks the Bangladesh case to a data-artefact verdict', async () => {
    renderAt('#/case/bangladesh-phantom-cooling');
    expect(await screen.findByRole('heading', {name: /A likely data artefact that needs investigation/}, {timeout: 5000})).toBeInTheDocument();
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
    expect(await screen.findByRole('heading', {name: /Both records show the change; they disagree on how fast/}, {timeout: 5000})).toBeInTheDocument();
    window.location.hash = '#/case/chile-megadrought';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(await screen.findByRole('heading', {name: /Corroborated by a partly independent/}, {timeout: 5000})).toBeInTheDocument();
  });

  it('never shows an error banner while a nation is still loading', async () => {
    renderAt('#/atlas/KEN');
    expect(screen.queryByText(/Could not load/)).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', {level: 2, name: /Kenya, whole nation/}, {timeout: 5000})).toBeInTheDocument();
  });
});

describe('world atlas', () => {
  it('keeps an explicit cell selection local rather than aggregating its country', async () => {
    renderAt('#/world?cell=1508');
    expect(await screen.findByRole('heading', {level: 2, name: /^Cell at/}, {timeout: 10000})).toBeInTheDocument();
    expect(screen.queryByRole('heading', {level: 2, name: 'Canada'})).not.toBeInTheDocument();
  });

  it('cross-examines any country picked from the global grid', async () => {
    renderAt('#/world?country=050');
    expect(await screen.findByRole('heading', {level: 2, name: 'Bangladesh'}, {timeout: 10000})).toBeInTheDocument();
    expect(await screen.findByText('Likely data artefact', {}, {timeout: 10000})).toBeInTheDocument();
  });

  it('summarises the whole world when nothing is selected', async () => {
    renderAt('#/world');
    expect(await screen.findByRole('heading', {name: /The world since 1981/}, {timeout: 10000})).toBeInTheDocument();
    expect(screen.getByText(/land cells, the area-weighted average temperature trend is/)).toBeInTheDocument();
  });
});

describe('verdicts and witness states', () => {
  it('leads each case with a verdict strip', async () => {
    renderAt('#/case/bangladesh-phantom-cooling');
    expect(await screen.findByText('Likely data artefact', {}, {timeout: 10000})).toBeInTheDocument();
    expect(screen.getByText(/Jump in 199\d, not a ramp/)).toBeInTheDocument();
  });

  it('labels a variable without a witness as a single-dataset claim', async () => {
    renderAt('#/atlas/CHL?v=WS2M');
    expect(await screen.findByText('Single dataset: no witness in this release', {}, {timeout: 10000})).toBeInTheDocument();
  });

  it('shows a failed witness download as unavailable, with retry, not as absence', async () => {
    vi.unstubAllGlobals();
    serveData(/witness\.json$/);
    // A nation no other test loads, so the session cache cannot hide the failure.
    renderAt('#/atlas/PHL?v=T2M');
    expect(await screen.findByText('Witness unavailable', {}, {timeout: 10000})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Retry'})).toBeInTheDocument();
    expect(screen.getByText('Verdict pending')).toBeInTheDocument();
  });

  it('builds a national brief for all seven variables', async () => {
    renderAt('#/brief/CHL');
    expect(await screen.findByRole('heading', {level: 1, name: /Chile, 1981–2024/}, {timeout: 15000})).toBeInTheDocument();
    expect(await screen.findByRole('button', {name: 'Download CSV'}, {timeout: 15000})).toBeInTheDocument();
    for (const label of ['Air temperature at 2 m', 'Wind speed at 2 m', 'Root-zone soil wetness']) expect(screen.getByText(label)).toBeInTheDocument();
  });
});

describe('method', () => {
  it('documents every test with references', async () => {
    renderAt('#/method');
    await screen.findByRole('heading', {level: 1, name: /How TRACE decides/});
    for (const name of ['Trend size: Theil–Sen', 'Field significance: false-discovery control', 'Integrity screen: ramp or jump?', 'Cross-examination']) {
      expect(screen.getByRole('heading', {name})).toBeInTheDocument();
    }
    expect(screen.getByRole('link', {name: /Hamed & Rao \(1998\)/})).toHaveAttribute('href', expect.stringContaining('doi.org'));
    expect(screen.getByText('Terms and abbreviations')).toBeInTheDocument();
  });
});
