import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {Theme} from '@astryxdesign/core/theme';
import {themes, defaultThemeSlug} from '../src/astryx-themes';
import App from '../src/app/App';

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
});
