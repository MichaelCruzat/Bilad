import {act, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {Theme} from '@astryxdesign/core/theme';
import {themes, defaultThemeSlug} from '../src/astryx-themes';
import App from '../src/app/App';

afterEach(() => vi.unstubAllGlobals());

describe('Bilad trend detective', () => {
  it('renders the investigation and lets the user switch variables', () => {
    render(
      <Theme theme={themes[defaultThemeSlug]}>
        <App />
      </Theme>,
    );

    expect(screen.getByRole('heading', {name: /find the signal/i})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Surface temperature'})).toBeInTheDocument();
    expect(screen.getByText('Trend verdict')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', {name: 'Precipitation'}));

    expect(screen.getByRole('heading', {name: 'Precipitation'})).toBeInTheDocument();
    expect(screen.getByText(/Precipitation in Atacama Desert/)).toBeInTheDocument();
  });

  it('ignores an old live-data failure after the user chooses another variable', async () => {
    let rejectRequest!: (reason?: unknown) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((_, reject) => {
      rejectRequest = reject;
    })));

    render(
      <Theme theme={themes[defaultThemeSlug]}>
        <App />
      </Theme>,
    );

    fireEvent.click(screen.getByRole('button', {name: 'Load NASA POWER data'}));
    fireEvent.click(screen.getByRole('radio', {name: 'Precipitation'}));

    expect(screen.getByRole('button', {name: 'Load NASA POWER data'})).toBeEnabled();
    await act(async () => rejectRequest(new Error('Old request failed')));
    expect(screen.getByRole('heading', {name: '0.01 mm/day/yr'})).toBeInTheDocument();
    expect(screen.queryByText(/Old request failed/)).not.toBeInTheDocument();
  });
});
