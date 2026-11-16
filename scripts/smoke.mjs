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
  if (artifacts) await page.screenshot({path: join(artifacts, name), animations: 'disabled'});
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

  await check('scroll preserves the globe view and continuous rotation', async () => {
    const p = await context.newPage();
    await p.goto(BASE);
    await p.getByRole('application', {name: /Globe of land temperature/}).waitFor({timeout: 20000});
    await p.getByRole('button', {name: 'Pause globe rotation', exact: true}).waitFor({timeout: 3000});
    const original = await p.getByRole('application', {name: /Globe of land temperature/}).elementHandle();
    for (const heading of ['Start with what the reanalysis says.', 'Then ask a second witness.', 'Look where they disagree.']) {
      const before = await original.evaluate(node => node.toDataURL());
      await p.getByRole('heading', {name: heading, exact: true}).scrollIntoViewIfNeeded();
      await p.waitForTimeout(650);
      if (before === await original.evaluate(node => node.toDataURL())) throw new Error('globe stopped painting new orientations');
      if (await p.locator('[role="radio"][data-value="claim"]').getAttribute('aria-checked') !== 'true') throw new Error('scroll changed the selected globe data');
      if (!await p.getByRole('button', {name: 'Pause globe rotation', exact: true}).count()) throw new Error('scroll stopped the globe');
      if (!await original.evaluate(node => node.isConnected && node === document.querySelector('canvas[role="application"]'))) throw new Error('scroll replaced the globe canvas');
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

  await check('guided example: homepage case files → case 03 → verdict', async () => {
    await page.getByRole('link', {name: 'Read the case files', exact: true}).click();
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

  await check('legacy cases link opens the homepage case section', async () => {
    const p = await context.newPage();
    await p.goto(`${BASE}#/cases`);
    await p.getByRole('heading', {level: 1, name: 'TRACE', exact: true}).waitFor();
    await p.getByRole('heading', {level: 2, name: 'Four case files, four different outcomes'}).waitFor();
    if (await p.getByRole('link', {name: 'Cases', exact: true}).count()) throw new Error('Cases still has a standalone navigation tab');
    for (const title of ['Central Chile’s missing rain', 'Two Chiles: a flat coast and warming Andes', 'Bangladesh’s phantom cooling', 'Kenya: right direction, half the speed']) {
      await p.getByRole('link', {name: title, exact: true}).waitFor();
    }
    await capture(p, 'cases-desktop.png');
    await p.close();
  });

  await check('Impact explains the need for temperature cross-checks', async () => {
    const p = await context.newPage();
    await p.goto(`${BASE}#/impact`);
    await p.getByRole('heading', {level: 1, name: 'Why climate evidence needs a second look'}).waitFor();
    await p.getByRole('heading', {name: 'Why cross-reference temperature records?', exact: true}).waitFor();
    await p.getByRole('heading', {name: 'Governments and public agencies', exact: true}).waitFor();
    await capture(p, 'impact-desktop.png');
    await p.close();
  });

  await check('regional lines load only after zoom, without labels', async () => {
    const p = await context.newPage();
    let requests = 0;
    p.on('request', request => { if (request.url().endsWith('/data/admin1.json')) requests++; });
    await p.goto(`${BASE}#/world`);
    const map = p.getByRole('application', {name: /World map/});
    await map.waitFor({timeout: 30000});
    if (requests) throw new Error('regional geometry loaded before zoom');
    const rect = await map.boundingBox();
    if (!rect) throw new Error('missing map');
    await p.mouse.move(rect.x + rect.width * 0.23, rect.y + rect.height * 0.32);
    const response = p.waitForResponse(r => r.url().endsWith('/data/admin1.json'));
    await p.mouse.wheel(0, -1100);
    const geometry = await (await response).json();
    if (geometry.type !== 'MultiLineString' || geometry.properties || geometry.features) throw new Error('boundary payload contains extra feature metadata');
    await p.waitForTimeout(1000);
    if (requests !== 1) throw new Error(`regional geometry fetched ${requests} times`);
    await p.mouse.move(0, 0);
    await capture(p, 'us-regional-outlines.png');
    await p.getByRole('link', {name: 'TRACE home', exact: true}).click();
    const globe = p.getByRole('application', {name: /Globe of land temperature/});
    await globe.waitFor({timeout: 30000});
    await globe.focus();
    for (let i = 0; i < 17; i++) await p.keyboard.press('ArrowLeft');
    await p.keyboard.press('ArrowUp');
    await p.keyboard.press('ArrowUp');
    for (let i = 0; i < 3; i++) await p.getByRole('button', {name: 'Zoom in', exact: true}).click();
    await p.waitForTimeout(600);
    await p.getByRole('button', {name: 'Zoom in', exact: true}).focus();
    if (requests !== 1) throw new Error('globe did not reuse the regional geometry');
    await capture(p, 'us-globe-regional-outlines.png');
    await p.close();
  });

  await check('supplemental atlas adds an unlabelled regional outline on zoom', async () => {
    const p = await context.newPage();
    await p.emulateMedia({reducedMotion: 'reduce'});
    await p.goto(`${BASE}#/atlas/KEN`);
    const map = p.getByRole('application').first();
    await map.waitFor({timeout: 30000});
    const before = await map.locator('path').count();
    await map.focus();
    for (let i = 0; i < 3; i++) await p.keyboard.press('+');
    await p.waitForFunction(count => document.querySelector('svg[role="application"]')?.querySelectorAll('path').length === count + 1, before);
    await capture(p, 'atlas-regional-outlines.png');
    await p.close();
  });

  await check('atlas maps start under the heading and tall nations grow to the column width', async () => {
    const p = await context.newPage();
    await p.goto(`${BASE}#/atlas/KEN`);
    const map = p.locator('svg[role="application"]');
    await map.waitFor({timeout: 30000});
    const kenya = await map.boundingBox();
    if (!kenya || kenya.y > 220) throw new Error(`Kenya map starts at ${kenya ? Math.round(kenya.y) : '?'}px, below its heading`);
    await p.goto(`${BASE}#/atlas/CHL`);
    await map.waitFor({timeout: 30000});
    await p.waitForTimeout(500);
    const chile = await map.boundingBox();
    if (!chile || chile.height < 1000) throw new Error(`Chile map is only ${chile ? Math.round(chile.height) : '?'}px tall`);
    await p.close();
  });

  await check('charts show the exact value under the pointer', async () => {
    const p = await context.newPage();
    await p.goto(`${BASE}#/world`);
    const chart = p.getByRole('group', {name: /read each year/}).first();
    await chart.waitFor({timeout: 30000});
    await chart.scrollIntoViewIfNeeded();
    const box = await chart.boundingBox();
    await p.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5);
    const readout = p.locator('[aria-live="polite"]', {hasText: /yearly value\s+[−+-]?\d/});
    await readout.first().waitFor({timeout: 5000});
    await p.mouse.move(0, 0);
    await chart.focus();
    await p.keyboard.press('ArrowLeft');
    await p.locator('[aria-live="polite"]', {hasText: /^2024 · yearly value/}).first().waitFor({timeout: 5000});
    await p.close();
  });

  await check('help buttons explain each map and chart in plain and technical terms', async () => {
    const p = await context.newPage();
    await p.goto(`${BASE}#/world`);
    await p.getByRole('button', {name: 'About: Global map'}).click({timeout: 30000});
    await p.getByText('What this shows').first().waitFor({timeout: 5000});
    await p.getByText('Technical detail').first().waitFor();
    await p.keyboard.press('Escape');
    const charts = await p.getByRole('button', {name: /^About: /}).count();
    if (charts < 3) throw new Error(`only ${charts} help buttons on the World page`);
    if (await p.getByText('Drag to pan; scroll or use the buttons to zoom').count()) throw new Error('instructions still printed on the page');
    await capture(p, 'world-help.png');
    await p.close();
  });

  await check('evidence trail buttons switch the globe and show which stage is on', async () => {
    const p = await context.newPage();
    await p.emulateMedia({reducedMotion: 'reduce'});
    await p.goto(`${BASE}#/`);
    await p.getByRole('button', {name: 'Globe follows your scroll'}).click({timeout: 30000});
    const show = p.getByRole('button', {name: 'Show the stations on the globe'});
    await show.scrollIntoViewIfNeeded();
    await show.click();
    await p.getByRole('button', {name: 'Showing the stations on the globe'}).waitFor({timeout: 5000});
    if (!(await p.getByRole('radio', {name: 'Stations say'}).isChecked())) throw new Error('globe did not switch to the stations');
    await p.close();
  });

  await check('Method outline tracks sections and its links survive a reload', async () => {
    const p = await context.newPage();
    await p.emulateMedia({reducedMotion: 'reduce'});
    await p.goto(`${BASE}#/method`);
    await p.getByRole('navigation', {name: 'Method sections'}).waitFor({timeout: 20000});
    await p.getByRole('link', {name: /07\s+Integrity screen/}).click();
    await p.waitForFunction(() => location.hash === '#method-integrity');
    await p.reload();
    await p.getByRole('heading', {level: 1, name: 'How TRACE decides whether a trend is real'}).waitFor();
    await p.getByRole('heading', {name: 'Integrity screen: ramp or jump?'}).waitFor();
    await capture(p, 'method-desktop.png');
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
    await p.getByRole('heading', {level: 2, name: /grid cell at/i}).waitFor({timeout: 30000});
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

  await check('phone width: results stay readable on home, impact, method, case, atlas and proof', async () => {
    const p = await browser.newPage({viewport: {width: 390, height: 844}});
    p.on('pageerror', e => errors.push(e.message));
    for (const route of ['#/', '#/impact', '#/method', '#/case/chile-megadrought', '#/atlas/CHL', '#/proof']) {
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
      if (route === '#/impact') await capture(p, 'impact-phone.png');
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
