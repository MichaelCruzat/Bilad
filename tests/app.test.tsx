import {act, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {Theme} from '@astryxdesign/core/theme';
import {themes, defaultThemeSlug} from '../src/astryx-themes';
import App from '../src/app/App';

afterEach(() => vi.unstubAllGlobals());

describe('Bilad trend detective', () => {
  it('compares the same variable across two selectable regions', () => {
    render(
      <Theme theme={themes[defaultThemeSlug]} mode="dark">
        <App />
      </Theme>,
    );

    expect(screen.getByRole('img', {name: /annual trend chart.*Atacama Desert.*Canadian Arctic/i})).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', {name: 'Comparison region'}), {target: {value: 'amazon'}});
    expect(screen.getByRole('img', {name: /annual trend chart.*Atacama Desert.*Amazon Basin/i})).toBeInTheDocument();
  });

  it('switches between baseline-relative and absolute annual views', () => {
    render(<Theme theme={themes[defaultThemeSlug]} mode="dark"><App /></Theme>);
    expect(screen.getByRole('img', {name: /anomalies relative to the 2000–2004 mean/i})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', {name: 'Absolute values'}));
    expect(screen.getByRole('img', {name: /Annual means from 2000 to 2024/i})).toBeInTheDocument();
  });
  it('renders the investigation and lets the user switch variables', () => {
    render(
      <Theme theme={themes[defaultThemeSlug]}>
        <App />
      </Theme>,
    );

    expect(screen.getByRole('heading', {name: /25 years. Five places. What changed/i})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Surface temperature'})).toBeInTheDocument();
    expect(screen.getByText('Trend verdict')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', {name: 'Precipitation'}));

    expect(screen.getByRole('heading', {name: 'Precipitation'})).toBeInTheDocument();
    expect(screen.getByRole('img', {name: /Precipitation annual trend chart.*Atacama Desert/i})).toBeInTheDocument();
  });

  it('ignores an old live-data failure after the user chooses another variable', async () => {
    const rejectRequests: Array<(reason?: unknown) => void> = [];
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((_, reject) => {
      rejectRequests.push(reject);
    })));

    render(
      <Theme theme={themes[defaultThemeSlug]}>
        <App />
      </Theme>,
    );

    fireEvent.click(screen.getByRole('button', {name: 'Load NASA POWER data'}));
    fireEvent.click(screen.getByRole('radio', {name: 'Precipitation'}));

    expect(screen.getByRole('button', {name: 'Load NASA POWER data'})).toBeEnabled();
    await act(async () => rejectRequests.forEach(reject => reject(new Error('Old request failed'))));
    expect(screen.getAllByRole('heading', {name: '0.01 mm/day/yr'}).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Old request failed/)).not.toBeInTheDocument();
  });

  it('resets both locations to labeled demo series after changing the primary region', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        parameters: {T2M: {units: 'C'}},
        header: {sources: ['MERRA2']},
        properties: {parameter: {T2M: Object.fromEntries(Array.from({length: 300}, (_, index) => [
          `${2000 + Math.floor(index / 12)}${String((index % 12) + 1).padStart(2, '0')}`,
          12 + index * 0.01,
        ]))}},
      }),
    })));

    render(
      <Theme theme={themes[defaultThemeSlug]} mode="dark"><App /></Theme>,
    );
    fireEvent.click(screen.getByRole('button', {name: 'Load NASA POWER data'}));
    expect((await screen.findAllByText(/NASA POWER live · 2000-01 to 2024-12/))).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', {name: 'Inspect Amazon Basin'}));
    expect(screen.getAllByText(/Deterministic demo fallback.*25\/25 complete years.*300 monthly values analyzed/)).toHaveLength(2);
  });

  it('labels a one-sided NASA failure as a mixed-source comparison', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string) => {
      if (input.includes('latitude=75.4')) throw new Error('Comparison point unavailable');
      return {
        ok: true,
        json: async () => ({
          parameters: {ALLSKY_SFC_SW_DWN: {units: 'MJ/m^2/day'}},
          header: {sources: ['SRB', 'SYN1DEG']},
          properties: {parameter: {ALLSKY_SFC_SW_DWN: Object.fromEntries(Array.from({length: 300}, (_, index) => [
            `${2000 + Math.floor(index / 12)}${String((index % 12) + 1).padStart(2, '0')}`,
            29.03,
          ]))}},
        }),
      } as Response;
    }));

    render(<Theme theme={themes[defaultThemeSlug]} mode="dark"><App /></Theme>);
    fireEvent.click(screen.getByRole('radio', {name: 'Solar energy'}));
    fireEvent.click(screen.getByRole('button', {name: 'Load NASA POWER data'}));

    expect(await screen.findByText(/Mixed sources: the live and synthetic series/)).toBeInTheDocument();
    expect(screen.getByText(/VIEW \/ MIXED SOURCES/)).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Exact NASA POWER request'})).toHaveAttribute('href', expect.stringContaining('parameters=ALLSKY_SFC_SW_DWN'));
    expect(screen.getByText(/NASA products: SRB \+ SYN1DEG/)).toBeInTheDocument();
    expect(screen.getByText(/One or more live requests were unavailable/)).toBeInTheDocument();
  });
});
