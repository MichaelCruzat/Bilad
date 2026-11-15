/**
 * Browser acceptance for the production build (run after `pnpm build`):
 *   node scripts/smoke.mjs
 * Serves dist with `vite preview` and drives a real Chrome through the judge
 * path and the states the unit tests cannot see. Set CHROME_PATH to override
 * the browser location.
 */
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright-core';

const PORT = 4399;
const BASE = `http://localhost:${PORT}/`;
const chrome =
  process.env.CHROME_PATH ||
  ['/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(p => existsSync(p));
if (!chrome) {
  console.error('No Chrome found; set CHROME_PATH.');
  process.exit(2);
}

const server = spawn('pnpm', ['exec', 'vite', 'preview', '--port', String(PORT), '--strictPort'], {stdio: 'ignore'});
const results = [];
const check = async (name, fn) => {
  try {
    await fn();
    results.push([name, 'ok']);
  } catch (error) {
    results.push([name, `FAILED: ${error.message.split('\n')[0]}`]);
  }
};

try {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(BASE)).ok) break;
    } catch {
      // server not up yet
    }
    await new Promise(r => setTimeout(r, 250));
  }
  const browser = await chromium.launch({executablePath: chrome, headless: true});
  const context = await browser.newContext({viewport: {width: 1440, height: 900}, permissions: ['clipboard-read', 'clipboard-write']});
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  await check('home renders the logo, the world map and the case files', async () => {
    await page.goto(BASE);
    await page.getByRole('heading', {level: 1, name: 'Bilad'}).waitFor();
    await page.getByRole('application', {name: /World map/}).waitFor({timeout: 20000});
    await page.getByRole('link', {name: 'Bangladesh’s phantom cooling'}).waitFor();
  });

  await check('judge path: home → case 03 → verdict', async () => {
    await page.getByRole('link', {name: 'Bangladesh’s phantom cooling'}).click();
    await page.getByText('Likely data artefact').first().waitFor({timeout: 20000});
    await page.getByText(/Jump in 199\d, not a ramp/).first().waitFor();
  });

  await check('case → atlas deep link, keyboard moves between cells', async () => {
    await page.getByRole('link', {name: 'Investigate this yourself in the atlas'}).click();
    await page.waitForURL(/#\/atlas\//);
    await page.getByRole('heading', {level: 2, name: /whole nation$/}).waitFor({timeout: 20000});
    const map = page.getByRole('application').first();
    await map.focus();
    await page.keyboard.press('ArrowRight');
    await page.getByRole('heading', {level: 2, name: /^Grid cell/}).waitFor({timeout: 10000});
  });

  await check('copy link gives feedback', async () => {
    await page.getByRole('button', {name: 'Copy link to this view'}).click();
    await page.getByRole('button', {name: 'Link copied'}).waitFor({timeout: 5000});
  });

  await check('a failed witness download shows unavailable and recovers on retry', async () => {
    const p = await context.newPage();
    await p.route('**/nations/KEN/witness.json', r => r.fulfill({status: 503, body: 'down'}));
    await p.goto(`${BASE}#/atlas/KEN?v=T2M`);
    await p.getByText('Witness unavailable').first().waitFor({timeout: 20000});
    await p.unroute('**/nations/KEN/witness.json');
    await p.getByRole('button', {name: 'Retry'}).first().click();
    await p.getByText(/GISTEMP v4: /).first().waitFor({timeout: 20000});
    await p.close();
  });

  await check('national brief downloads a CSV', async () => {
    const p = await context.newPage();
    await p.goto(`${BASE}#/brief/MEX`);
    const button = p.getByRole('button', {name: 'Download CSV'});
    await button.waitFor({timeout: 30000});
    const [file] = await Promise.all([p.waitForEvent('download'), button.click()]);
    if (!file.suggestedFilename().endsWith('.csv')) throw new Error(file.suggestedFilename());
    await p.close();
  });

  await check('world atlas cross-examines a searched country', async () => {
    const p = await context.newPage();
    await p.goto(`${BASE}#/world?country=050`);
    await p.getByRole('heading', {level: 2, name: 'Bangladesh'}).waitFor({timeout: 30000});
    await p.getByText('Likely data artefact').first().waitFor({timeout: 30000});
    await p.close();
  });

  await check('phone width: no sideways scrolling on home, case and atlas', async () => {
    const p = await browser.newPage({viewport: {width: 390, height: 844}});
    for (const route of ['#/', '#/case/chile-megadrought', '#/atlas/CHL']) {
      await p.goto(BASE + route);
      await p.waitForTimeout(2500);
      const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (over > 2) throw new Error(`${route} overflows by ${over}px`);
    }
    await p.close();
  });

  await check('reduced motion: map colours do not animate', async () => {
    const p = await browser.newPage();
    await p.emulateMedia({reducedMotion: 'reduce'});
    await p.goto(`${BASE}#/atlas/CHL`);
    await p.locator('path[data-i]').first().waitFor({timeout: 20000});
    const t = await p.locator('path[data-i]').first().evaluate(el => getComputedStyle(el).transitionDuration);
    if (t !== '0s') throw new Error(`transition ${t}`);
    await p.close();
  });

  await check('no uncaught page errors', async () => {
    if (errors.length) throw new Error(errors.join(' | '));
  });
  await browser.close();
} finally {
  server.kill();
}

for (const [name, status] of results) console.log(`${status === 'ok' ? '✓' : '✗'} ${name}${status === 'ok' ? '' : `: ${status}`}`);
process.exit(results.every(([, s]) => s === 'ok') ? 0 : 1);
