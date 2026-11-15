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

    expect(screen.getByRole('img', {name: /annual trend chart.*Atacama Desert and Canadian Arctic/i})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(screen.getByRole('option', {name: 'Amazon Basin'}));
    expect(screen.getByRole('img', {name: /annual trend chart.*Atacama Desert and Amazon Basin/i})).toBeInTheDocument();
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
      json: async () => ({properties: {parameter: {T2M: {200001: 12, 200002: 13, 200003: 14}}}}),
    })));

    render(
      <Theme theme={themes[defaultThemeSlug]} mode="dark"><App /></Theme>,
    );
    fireEvent.click(screen.getByRole('button', {name: 'Load NASA POWER data'}));
    expect((await screen.findAllByText(/NASA POWER live/))).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', {name: 'Inspect Amazon Basin'}));
    expect(screen.getAllByText(/Deterministic demo fallback · 300 monthly values/)).toHaveLength(2);
  });
});
