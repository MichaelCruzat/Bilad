import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {render, screen} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {Theme} from '@astryxdesign/core/theme';
import {themes, defaultThemeSlug} from '../src/astryx-themes';
import {GlobalProof} from '../src/pages/GlobalProof';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => new Response(readFileSync(join(__dirname, '../public/data', String(input).split('data/')[1])))));
});
afterEach(() => vi.unstubAllGlobals());

function open(query: string) {
  render(<Theme theme={themes[defaultThemeSlug]} mode="dark"><GlobalProof params={new URLSearchParams(query)} /></Theme>);
}

it('calculates a worldwide footprint by default, without loading national packs', async () => {
  open('');
  expect(await screen.findByRole('heading', {level: 2, name: 'All covered land'}, {timeout: 15000})).toBeInTheDocument();
  expect(screen.getByText(/54,425 cells covering/)).toBeInTheDocument();
  expect(screen.getAllByText('+0.25').length).toBeGreaterThan(0);
  expect(fetch).not.toHaveBeenCalledWith(expect.stringContaining('nations/'));
});

it('examines India on the global grid even though no supplemental national pack exists', async () => {
  open('country=356');
  expect(await screen.findByRole('heading', {level: 2, name: 'India'}, {timeout: 15000})).toBeInTheDocument();
  expect(screen.getByText(/955 cells covering/)).toBeInTheDocument();
  expect(screen.getAllByText('+0.02').length).toBeGreaterThan(0);
  expect(screen.getByRole('link', {name: 'Explore this footprint'})).toHaveAttribute('href', '#/world?v=T2M&country=356');
});

it('reports invalid footprints instead of substituting a default country', async () => {
  open('cell=1508.5');
  expect(await screen.findByText('This selection has no covered land cells', {}, {timeout: 15000})).toBeInTheDocument();
  expect(screen.queryByRole('heading', {level: 2, name: 'All covered land'})).not.toBeInTheDocument();
});
