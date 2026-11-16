/**
 * Demo PDF from the production build (run after `pnpm build`):
 *   node scripts/demo-pdf.mjs
 * Serves dist with `vite preview`, captures the judge path at 1600×1000 and
 * writes public/trace-demo.pdf, one screen per page. Set CHROME_PATH to
 * override the browser location.
 */
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright-core';

const PORT = 4398;
const BASE = `http://localhost:${PORT}/`;
const chrome =
  process.env.CHROME_PATH ||
  ['/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(p => existsSync(p));
if (!chrome) {
  console.error('No Chrome found; set CHROME_PATH.');
  process.exit(2);
}

const PAGES = [
  ['#/', 'TRACE: a worldwide atlas, with no default country'],
  ['#/impact', 'Why cross-check climate evidence, and who can use it'],
  ['#/world?country=356', 'Any country: India, where the reanalysis misses the warming'],
  ['#/proof?country=124&v=PRECTOTCORR', 'Canada: a rainfall walkthrough on the global grid'],
  ['#/world?cell=1508', 'One cell: a reproducible footprint with evidence exports'],
  ['#/case/bangladesh-phantom-cooling', 'A guided example: why significance alone is not enough'],
];

const server = spawn('pnpm', ['exec', 'vite', 'preview', '--port', String(PORT), '--strictPort'], {stdio: 'ignore'});
try {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(BASE)).ok) break;
    } catch {
      // server not up yet
    }
    await new Promise(r => setTimeout(r, 250));
  }
  const browser = await chromium.launch({executablePath: chrome, headless: true, args: process.env.DEMO_WEBGL ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : []});
  const page = await browser.newPage({viewport: {width: 1600, height: 1000}, deviceScaleFactor: 1.5, reducedMotion: 'reduce'});
  const shots = [];
  for (const [route, caption] of PAGES) {
    await page.goto(BASE + route);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500);
    shots.push({caption, data: (await page.screenshot({type: 'jpeg', quality: 82})).toString('base64')});
  }
  const html = `<!doctype html><meta charset="utf-8"><style>
    @page { size: 1600px 1080px; margin: 0; }
    body { margin: 0; font: 22px "IBM Plex Sans", system-ui, sans-serif; background: #0a1220; color: #eef3fa; }
    section { height: 1080px; page-break-after: always; display: flex; flex-direction: column; }
    p { margin: 0; padding: 22px 32px 18px; }
    img { width: 1600px; height: auto; }
  </style>${shots.map((s, i) => `<section><p>${i + 1} / ${shots.length} · TRACE: ${s.caption}</p><img src="data:image/jpeg;base64,${s.data}"></section>`).join('')}`;
  const doc = await browser.newPage();
  await doc.setContent(html, {waitUntil: 'load'});
  await doc.pdf({path: 'public/trace-demo.pdf', width: '1600px', height: '1080px', printBackground: true});
  await browser.close();
  console.log(`public/trace-demo.pdf: ${shots.length} pages`);
} finally {
  server.kill();
}
