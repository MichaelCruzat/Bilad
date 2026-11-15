import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {Theme} from '@astryxdesign/core/theme';
import {themes, defaultThemeSlug} from '../src/astryx-themes';
import App from '../src/app/App';

describe('Bilad foundation', () => {
  it('renders the mission briefing and default Moon profile', () => {
    render(
      <Theme theme={themes[defaultThemeSlug]}>
        <App />
      </Theme>,
    );

    expect(screen.getByRole('heading', {name: /where on earth/i})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Moon base'})).toBeInTheDocument();
    expect(screen.getByRole('radio', {name: 'Mars outpost'})).toBeInTheDocument();
  });
});
