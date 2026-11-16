/**
 * Browser acceptance for the production build (run after `pnpm build`):
 *   node scripts/smoke.mjs
 * Serves dist with `vite preview` and drives a real Chrome through the judge
 * path and the states the unit tests cannot see. Set CHROME_PATH to override
 * the browser location.
 */
import {spawn} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {chromium} from 'playwright-core';

const PORT = 4399;
const BASE = `http://localhost:${PORT}/`;
const artifacts = process.env.SMOKE_ARTIFACT_DIR;
if (artifacts) mkdirSync(artifacts, {recursive: true});
const capture = async (page, name) => {
  if (artifacts) await page.screenshot({path: join(artifacts, name)});
};
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
  if (process.env.SMOKE_FILTER && !name.includes(process.env.SMOKE_FILTER)) return;
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
  const browser = await chromium.launch({executablePath: chrome, headless: true, args: process.env.SMOKE_WEBGL ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : []});
  const errors = [];
  const context = await browser.newContext({viewport: {width: 1440, height: 900}, permissions: ['clipboard-read', 'clipboard-write']});
  context.on('page', p => p.on('pageerror', e => errors.push(e.message)));
  if (process.env.SMOKE_WEBGL) await context.addInitScript(() => {
    window.__globeDraws = 0;
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      const value = getContext.call(this, type, ...args);
      if (type === 'webgl' && value) {
        const draw = value.drawArrays.bind(value);
        value.drawArrays = (...values) => { window.__globeDraws++; return draw(...values); };
      }
      return value;
    };
  });
  const page = await context.newPage();

  await check('home explains TRACE and worldwide coverage without a seeded country', async () => {
    await page.goto(BASE);
    await page.getByRole('heading', {level: 1, name: 'TRACE', exact: true}).waitFor();
    await page.getByText('Tracking Regional Atmospheric Change on Earth', {exact: true}).waitFor();
    await page.getByRole('application', {name: /Globe of land temperature/}).waitFor({timeout: 20000});
    await page.getByRole('link', {name: 'Explore the world', exact: true}).waitFor();
    if (await page.getByRole('button', {name: 'Bangladesh', exact: true}).count()) throw new Error('national default on global home');
    if (await page.getByRole('table').count()) throw new Error('duplicate home ledger');
    if (process.env.SMOKE_WEBGL) await page.waitForFunction(() => window.__globeDraws > 0);
    await capture(page, 'home-desktop.png');
  });

  await check('scroll advances the evidence while the globe stays in view', async () => {
    const p = await context.newPage();
    await p.goto(BASE);
    await p.getByRole('application', {name: /Globe of land temperature/}).waitFor({timeout: 20000});
    for (const [heading, value] of [['First, trace the change.', 'claim'], ['Then, ask a second record.', 'witness'], ['Follow the disagreement.', 'verdict']]) {
      await p.getByRole('heading', {name: heading, exact: true}).scrollIntoViewIfNeeded();
      await p.waitForFunction(v => document.querySelector(`[role="radio"][data-value="${v}"]`)?.getAttribute('aria-checked') === 'true', value);
      const rect = await p.getByRole('application', {name: /Globe of land temperature/}).boundingBox();
      if (!rect || rect.y < -10 || rect.y + rect.height > 910) {
        await capture(p, 'scroll-pin-failure.png');
        const ancestors = await p.getByRole('application', {name: /Globe of land temperature/}).evaluate(el => {
          const info = [];
          for (let node = el; node; node = node.parentElement) {
            const css = getComputedStyle(node);
            info.push({tag: node.tagName, position: css.position, top: css.top, overflow: css.overflow, h: node.clientHeight, scroll: node.scrollTop, rect: node.getBoundingClientRect().y});
          }
          return info;
        });
        throw new Error(`globe did not stay visible: ${JSON.stringify({rect, ancestors})}`);
      }
    }
    await capture(p, 'home-evidence-trail.png');
    await p.close();
  });

  await check('guided example: home → Cases → case 03 → verdict', async () => {
    await page.getByRole('link', {name: 'Cases', exact: true}).click();
    await page.getByRole('link', {name: 'Bangladesh’s phantom cooling', exact: true}).click();
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

  await check('every case file renders a verdict without errors', async () => {
    const p = await context.newPage();
    const caseErrors = [];
    p.on('pageerror', e => caseErrors.push(e.message));
    for (const id of ['chile-megadrought', 'chile-coast-andes', 'bangladesh-phantom-cooling', 'kenya-half-the-warming']) {
      await p.goto(`${BASE}#/case/${id}`);
      await p.getByText('Verdict', {exact: true}).first().waitFor({timeout: 20000});
      await p.getByRole('heading', {level: 2}).first().waitFor({timeout: 20000});
      if (caseErrors.length) throw new Error(`${id}: ${caseErrors.join(' | ')}`);
    }
    await p.close();
  });

  await check('Cases tab lists all four investigations', async () => {
    const p = await context.newPage();
    await p.goto(`${BASE}#/cases`);
    await p.getByRole('heading', {level: 1, name: 'Four case files, four different outcomes'}).waitFor();
    for (const title of ['Central Chile’s missing rain', 'Two Chiles: a flat coast and warming Andes', 'Bangladesh’s phantom cooling', 'Kenya: right direction, half the speed']) {
      await p.getByRole('link', {name: title, exact: true}).waitFor();
    }
    await capture(p, 'cases-desktop.png');
    await p.close();
  });

  await check('globe retains its 2D fallback when WebGL is unavailable', async () => {
    const p = await context.newPage();
    await p.emulateMedia({reducedMotion: 'reduce'});
    await p.addInitScript(() => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        return type === 'webgl' || type === 'webgl2' ? null : getContext.call(this, type, ...args);
      };
    });
    await p.goto(BASE);
    const map = p.getByRole('application', {name: /Globe of land temperature/});
    await map.waitFor({timeout: 20000});
    await map.focus();
    await p.keyboard.press('ArrowUp');
    await p.keyboard.press('ArrowUp');
    await p.keyboard.press('Enter');
    await p.getByRole('status').filter({hasText: /Selected:/}).waitFor({timeout: 5000});
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

  await check('a global cell deep link keeps a one-cell footprint', async () => {
    const p = await context.newPage();
    await p.goto(`${BASE}#/world?cell=1508`);
    await p.getByRole('heading', {level: 2, name: /^Cell at/}).waitFor({timeout: 30000});
    await p.getByText(/^1 grid cell,/).waitFor();
    const [download] = await Promise.all([
      p.waitForEvent('download'),
      p.getByRole('button', {name: 'Download evidence (JSON)', exact: true}).click(),
    ]);
    const path = await download.path();
    if (!path) throw new Error('missing global evidence download');
    const receipt = JSON.parse(readFileSync(path, 'utf8'));
    if (!receipt.grid.startsWith('1 MERRA-2 cells') || receipt.series.length !== 44 || !receipt.view.includes('cell=1508') || !Number.isFinite(receipt.trend)) throw new Error('export did not preserve the one-cell evidence footprint');
    if (!download.suggestedFilename().startsWith('trace-')) throw new Error('stale export brand');
    await p.close();
  });

  await check('global walkthrough covers the planet and a country without a national pack', async () => {
    const p = await context.newPage();
    for (const [query, name] of [['', 'All covered land'], ['?country=356', 'India'], ['?country=124&v=PRECTOTCORR', 'Canada']]) {
      await p.goto(`${BASE}#/proof${query}`);
      await p.getByRole('heading', {level: 2, name, exact: true}).waitFor({timeout: 30000});
      await p.getByRole('link', {name: 'Explore this footprint', exact: true}).waitFor();
    }
    await capture(p, 'global-proof.png');
    await p.close();
  });

  await check('proof page computes a verdict and recovers from failed record downloads', async () => {
    for (const resource of ['index.json', 'crosscheck.json', 'nations/BGD/T2M.i16']) {
      const p = await context.newPage();
      const pattern = `**/data/${resource}`;
      await p.route(pattern, r => r.fulfill({status: 503, body: 'down'}));
      await p.goto(`${BASE}#/proof?n=BGD&v=T2M`);
      await p.getByText(resource === 'index.json' ? 'Could not load the nation list' : 'Could not load the walkthrough', {exact: true}).waitFor({timeout: 20000});
      await p.unroute(pattern);
      await p.getByRole('button', {name: 'Retry', exact: true}).click();
      await p.getByRole('heading', {name: 'Likely data artefact', exact: true}).waitFor({timeout: 20000});
      if (resource === 'index.json') await capture(p, 'proof-desktop.png');
      await p.close();
    }
  });

  await check('home exposes a failed globe download and retries it', async () => {
    const p = await context.newPage();
    await p.route('**/global/witness-T2M.bin', r => r.fulfill({status: 503, body: 'down'}));
    await p.goto(BASE);
    await p.getByText('Could not load the globe', {exact: true}).waitFor({timeout: 20000});
    await p.unroute('**/global/witness-T2M.bin');
    await p.getByRole('button', {name: 'Retry', exact: true}).click();
    await p.getByRole('application', {name: /Globe of land temperature/}).waitFor({timeout: 20000});
    await p.close();
  });

  await check('globe rotation can be paused and keyboard picks are announced', async () => {
    const p = await context.newPage();
    await p.goto(BASE);
    const globe = p.getByRole('application', {name: /Globe of land temperature/});
    await globe.waitFor({timeout: 20000});
    // Let the entrance animation settle before testing interaction.
    await p.waitForTimeout(1100);
    const rotate = p.getByRole('button', {name: 'Rotate globe', exact: true});
    if (await rotate.count()) await rotate.click();
    await p.getByRole('button', {name: 'Pause globe rotation'}).click();
    // Let any in-flight camera transition finish before testing the pause.
    await p.waitForTimeout(1000);
    const before = await globe.screenshot();
    await p.waitForTimeout(250);
    if (!(await globe.screenshot()).equals(before)) throw new Error('globe continues moving after pause');
    await globe.focus();
    await p.keyboard.press('ArrowUp');
    await p.keyboard.press('ArrowUp');
    for (let i = 0; i < 36; i++) {
      if (await p.getByRole('status').filter({hasText: 'Under the crosshair:'}).count()) break;
      await p.keyboard.press('ArrowRight');
    }
    await p.keyboard.press('Enter');
    await p.waitForTimeout(250);
    const announcements = await p.getByRole('status').allTextContents();
    if (!announcements.some(t => t.includes('Selected:'))) {
      await capture(p, 'globe-keyboard-failure.png');
      throw new Error(`keyboard selection was not announced: ${JSON.stringify(announcements)}; place=${JSON.stringify((await p.getByRole('heading', {level: 2}).allTextContents()).slice(0, 2))}`);
    }
    await p.close();
  });

  await check('country search finds India, not a territory, and lists no duplicates', async () => {
    const p = await context.newPage();
    await p.goto(`${BASE}#/world`);
    const box = p.getByRole('button', {name: /Find a country/});
    await box.waitFor({timeout: 30000});
    await box.click();
    await p.keyboard.type('India');
    await p.getByRole('option').first().waitFor({timeout: 5000});
    const options = await p.getByRole('option').allTextContents();
    if (options.some(o => /Siachen|Kosovo|N\. Cyprus/.test(o))) throw new Error(`junk options: ${options.join(', ')}`);
    if (new Set(options).size !== options.length) throw new Error(`duplicates: ${options.join(', ')}`);
    await p.getByRole('option', {name: 'India', exact: true}).click();
    await p.getByRole('heading', {level: 2, name: 'India'}).waitFor({timeout: 30000});
    await p.close();
  });

  await check('a country without a brief gets a way forward, not an error', async () => {
    const p = await context.newPage();
    await p.goto(`${BASE}#/brief/IND`);
    await p.getByText('No national brief for “IND”').waitFor({timeout: 10000});
    await p.getByRole('link', {name: 'Find it on the World map'}).waitFor();
    await p.close();
  });

  await check('world map: keyboard focus shows a ring and Enter opens a cell', async () => {
    const p = await context.newPage();
    await p.goto(`${BASE}#/world`);
    const map = p.getByRole('application', {name: /World map/});
    await map.waitFor({timeout: 30000});
    await p.getByRole('button', {name: 'Zoom in'}).click();
    await map.focus();
    await p.keyboard.press('ArrowLeft');
    const outline = await map.evaluate(el => getComputedStyle(el).outlineStyle);
    if (outline === 'none') throw new Error('no focus ring');
    await p.keyboard.press('Enter');
    await p.waitForURL(/cell=\d+/, {timeout: 10000});
    await p.close();
  });

  await check('brief copy link gives feedback', async () => {
    const p = await context.newPage();
    await p.goto(`${BASE}#/brief/KEN`);
    await p.getByRole('button', {name: 'Copy link to this brief'}).click({timeout: 30000});
    await p.getByRole('button', {name: 'Link copied'}).waitFor({timeout: 5000});
    await p.close();
  });

  await check('phone width: results stay readable on home, case, atlas and proof', async () => {
    const p = await browser.newPage({viewport: {width: 390, height: 844}});
    p.on('pageerror', e => errors.push(e.message));
    for (const route of ['#/', '#/case/chile-megadrought', '#/atlas/CHL', '#/proof']) {
      await p.goto(BASE + route);
      await p.waitForTimeout(2500);
      const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (over > 2) throw new Error(`${route} overflows by ${over}px`);
      if (route === '#/') {
        const name = p.getByText('Tracking Regional Atmospheric Change on Earth', {exact: true});
        await name.waitFor({timeout: 20000});
        const rect = await name.boundingBox();
        if (!rect || rect.x < 0 || rect.x + rect.width > 390) throw new Error('TRACE definition clipped on phone');
      }
      if (route === '#/') await capture(p, 'home-phone.png');
    }
    await p.close();
  });

  await check('reduced motion: globe rotation and entrance movement stay off', async () => {
    const p = await context.newPage();
    await p.emulateMedia({reducedMotion: 'reduce'});
    await p.goto(BASE);
    await p.getByRole('application', {name: /Globe of land temperature/}).waitFor({timeout: 20000});
    await p.getByRole('button', {name: 'Rotate globe', exact: true}).waitFor();
    const transitions = await p.evaluate(() => document.getAnimations().filter(a => a.playState === 'running' && a.effect?.getKeyframes().some(k => String(k.transform).includes('translateY'))).length);
    if (transitions) throw new Error('entrance motion ignored reduced-motion preference');
    await p.close();
  });

  await check('reduced motion: map colours do not animate', async () => {
    const p = await browser.newPage();
    p.on('pageerror', e => errors.push(e.message));
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
