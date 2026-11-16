/** Repeatable local animation measurements against dist. */
import {spawn} from 'node:child_process';
import {existsSync, mkdirSync, writeFileSync} from 'node:fs';
import {chromium} from 'playwright-core';

const base = 'http://localhost:4397/';
const executablePath = process.env.CHROME_PATH || ['/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(existsSync);
const server = spawn('pnpm', ['exec', 'vite', 'preview', '--port', '4397', '--strictPort'], {stdio: 'ignore'});
let browser;
try {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(base)).ok) break; } catch { /* starting */ }
    await new Promise(r => setTimeout(r, 250));
  }
  browser = await chromium.launch({executablePath, headless: true, args: process.env.PROFILE_SWIFTSHADER ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : []});
  const page = await browser.newPage({viewport: {width: 1440, height: 900}});
  await page.addInitScript(({force2d}) => {
    window.__globeGpu = {attempts: 0, available: false, draws: 0, errors: []};
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (type === 'webgl') {
        window.__globeGpu.attempts++;
        if (force2d) return null;
        const gl = original.call(this, type, ...args);
        window.__globeGpu.available = !!gl;
        if (gl) {
          const draw = gl.drawArrays.bind(gl);
          gl.drawArrays = (...values) => { window.__globeGpu.draws++; return draw(...values); };
          const compile = gl.compileShader.bind(gl);
          gl.compileShader = value => {
            compile(value);
            if (!gl.getShaderParameter(value, gl.COMPILE_STATUS)) window.__globeGpu.errors.push(gl.getShaderInfoLog(value));
          };
        }
        return gl;
      }
      return original.call(this, type, ...args);
    };
  }, {force2d: process.env.PROFILE_RENDERER === '2d'});
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', {rate: 4});
  await cdp.send('Performance.enable');
  await cdp.send('Profiler.enable');
  const results = [];
  const renderers = {};
  if (process.env.PROFILE_REGION_BASELINE) await page.route('**/data/admin1.json', r => r.fulfill({json: {type: 'MultiLineString', coordinates: []}}));
  const scenarios = process.env.PROFILE_REGIONS ? ['globe-regions', 'world-regions'] : ['globe', 'world-years'];
  for (const scenario of scenarios) {
    if (process.env.PROFILE_SCENARIO && scenario !== process.env.PROFILE_SCENARIO) continue;
    const isGlobe = scenario.startsWith('globe');
    const isRegional = scenario.endsWith('regions');
    await page.goto(base + (isGlobe ? '#/' : isRegional ? '#/world' : '#/world?layer=year'));
    const map = page.getByRole('application').first();
    await map.waitFor({timeout: 30000});
    await page.waitForTimeout(1500);
    if (isRegional) {
      if (isGlobe) {
        await map.focus();
        for (let i = 0; i < 18; i++) await page.keyboard.press('ArrowLeft');
        await page.keyboard.press('ArrowUp');
        await page.keyboard.press('ArrowUp');
        for (let i = 0; i < 3; i++) await page.getByRole('button', {name: 'Zoom in', exact: true}).click();
      } else {
        const rect = await map.boundingBox();
        await page.mouse.move(rect.x + rect.width * 0.23, rect.y + rect.height * 0.32);
        await page.mouse.wheel(0, -1100);
        await map.focus();
      }
      await page.waitForTimeout(1500);
      if (!isGlobe) await page.evaluate(() => {
        let step = 0;
        const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'];
        const map = document.querySelector('canvas[role="application"]');
        window.__regionPan = setInterval(() => map.dispatchEvent(new KeyboardEvent('keydown', {key: keys[step++ % keys.length], bubbles: true})), 250);
      });
    }
    const start = page.getByRole('button', {name: isGlobe ? 'Rotate globe' : 'Play the years', exact: true});
    if (await start.count()) await start.click();
    for (let repeat = 0; repeat < 3; repeat++) {
      if (process.env.PROFILE_CPU && repeat === 0) await cdp.send('Profiler.start');
      const before = await cdp.send('Performance.getMetrics');
      const frames = await page.evaluate(() => new Promise(resolve => {
        const gaps = [];
        const gpuDraws = window.__globeGpu.draws;
        let last = performance.now();
        const until = last + 3000;
        const tick = now => {
          gaps.push(now - last);
          last = now;
          if (now < until) requestAnimationFrame(tick);
          else {
            gaps.sort((a, b) => a - b);
            resolve({frames: gaps.length, medianFrameMs: gaps[Math.floor(gaps.length / 2)], p95FrameMs: gaps[Math.floor(gaps.length * 0.95)], gpuDraws: window.__globeGpu.draws - gpuDraws});
          }
        };
        requestAnimationFrame(tick);
      }));
      const after = await cdp.send('Performance.getMetrics');
      if (process.env.PROFILE_CPU && repeat === 0) {
        const {profile} = await cdp.send('Profiler.stop');
        const hits = new Map();
        for (const id of profile.samples ?? []) hits.set(id, (hits.get(id) ?? 0) + 1);
        const top = profile.nodes.sort((a, b) => (hits.get(b.id) ?? 0) - (hits.get(a.id) ?? 0)).slice(0, 5);
        for (const node of top) {
          const f = node.callFrame;
          let source = '';
          if (f.scriptId !== '0') {
            const script = await cdp.send('Debugger.getScriptSource', {scriptId: f.scriptId}).catch(() => null);
            source = script?.scriptSource.split('\n')[f.lineNumber]?.slice(Math.max(0, f.columnNumber - 40), f.columnNumber + 160) ?? '';
          }
          console.log(JSON.stringify({scenario, function: f.functionName, hits: hits.get(node.id), source}));
        }
      }
      const metric = (r, name) => r.metrics.find(m => m.name === name)?.value ?? 0;
      results.push({scenario, repeat: repeat + 1, ...frames, scriptMs: Math.round((metric(after, 'ScriptDuration') - metric(before, 'ScriptDuration')) * 1000), taskMs: Math.round((metric(after, 'TaskDuration') - metric(before, 'TaskDuration')) * 1000)});
    }
    renderers[scenario] = await page.evaluate(() => window.__globeGpu);
    if (isRegional && !isGlobe) await page.evaluate(() => clearInterval(window.__regionPan));
    if (process.env.PROFILE_ARTIFACT_DIR) {
      mkdirSync(process.env.PROFILE_ARTIFACT_DIR, {recursive: true});
      const pause = page.getByRole('button', {name: isGlobe ? 'Pause globe rotation' : 'Pause the years', exact: true});
      if (await pause.count()) await pause.click();
      await page.screenshot({path: `${process.env.PROFILE_ARTIFACT_DIR}/${scenario}.png`});
    }
  }
  const report = {conditions: 'Chrome headless, 1440x900, 4x CPU throttle, warm data, 3x3-second samples', browser: browser.version(), swiftshader: !!process.env.PROFILE_SWIFTSHADER, regionBaseline: !!process.env.PROFILE_REGION_BASELINE, renderers, results};
  if (process.env.PROFILE_OUTPUT) writeFileSync(process.env.PROFILE_OUTPUT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser?.close();
  server.kill();
}
