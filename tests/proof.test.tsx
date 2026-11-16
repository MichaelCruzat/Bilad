import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {fireEvent, render, screen} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {Theme} from '@astryxdesign/core/theme';
import {themes, defaultThemeSlug} from '../src/astryx-themes';
import {Proof} from '../src/pages/Proof';

afterEach(() => vi.unstubAllGlobals());

it('reports a failed witness request and completes the walkthrough after retry', async () => {
  let unavailable = true;
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const path = String(input).split('data/')[1];
    if (unavailable && path === 'crosscheck.json') return new Response('down', {status: 503});
    return new Response(readFileSync(join(__dirname, '../public/data', path)));
  }));
  render(
    <Theme theme={themes[defaultThemeSlug]} mode="dark">
      <Proof params={new URLSearchParams('n=BGD&v=T2M')} />
    </Theme>,
  );

  expect(await screen.findByText('Could not load the walkthrough', {}, {timeout: 10000})).toBeInTheDocument();
  expect(screen.queryByText('Loading the record and running the tests…')).not.toBeInTheDocument();
  unavailable = false;
  fireEvent.click(screen.getByRole('button', {name: 'Retry'}));

  expect(await screen.findByRole('heading', {name: 'Call the witness'}, {timeout: 10000})).toBeInTheDocument();
  expect(screen.getByRole('heading', {name: 'Likely data artefact'})).toBeInTheDocument();
  expect(screen.getByText(/expected fraction across repeated analyses/)).toBeInTheDocument();
  expect(screen.queryByText(/Nothing below is typed in by hand/)).not.toBeInTheDocument();
});
