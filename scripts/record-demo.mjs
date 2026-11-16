/** Record the production build with a visible cursor. Requires Chrome and Playwright's ffmpeg. */
import {chromium} from 'playwright-core';
import {mkdirSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

const base = process.env.DEMO_URL || 'http://localhost:4410/';
const output = resolve('artifacts/demo');
mkdirSync(output, {recursive: true});
const browser = await chromium.launch({executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
const context = await browser.newContext({viewport: {width: 1920, height: 1080}, permissions: ['clipboard-read', 'clipboard-write'], recordVideo: {dir: output + '/raw', size: {width: 1920, height: 1080}}});
await context.addInitScript(() => {
  document.addEventListener('DOMContentLoaded', () => {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '-20 -20 64 72');
    Object.assign(svg.style, {position: 'fixed', width: '48px', height: '54px', left: '-100px', top: '-100px', zIndex: '2147483647', pointerEvents: 'none', overflow: 'visible', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.5))'});
    const ring = document.createElementNS(ns, 'circle');
    for (const [k, v] of Object.entries({cx:'0', cy:'0', r:'14', fill:'rgba(98,175,255,.12)', stroke:'rgba(154,202,255,.7)', 'stroke-width':'1'})) ring.setAttribute(k,v);
    const arrow = document.createElementNS(ns, 'path');
    for (const [k, v] of Object.entries({d:'M0 0 L0 26 L7 20 L12 32 L18 29 L12 17 L24 17 Z', fill:'white', stroke:'black', 'stroke-width':'1.2', 'stroke-linejoin':'round'})) arrow.setAttribute(k,v);
    svg.append(ring,arrow);
    document.body.append(svg);
    document.addEventListener('mousemove', e => { svg.style.left = `${e.clientX - 15}px`; svg.style.top = `${e.clientY - 15}px`; });
    document.addEventListener('mousedown', () => ring.animate([{opacity:1},{opacity:0.1},{opacity:1}],{duration:360}));
  });
});
const recordingOpened = Date.now();
const page = await context.newPage();
const video = page.video();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
let x = 240, y = 210;
const delay = ms => new Promise(r => setTimeout(r, Math.max(0,ms)));
async function move(nx, ny, duration = 700) {
  const sx=x, sy=y, start=Date.now();
  for (;;) {
    const t=Math.min(1,(Date.now()-start)/duration), e=t*t*(3-2*t);
    await page.mouse.move(sx+(nx-sx)*e, sy+(ny-sy)*e-Math.sin(t*Math.PI)*30);
    if(t===1)break;
    await delay(16);
  }
  x=nx; y=ny;
}
async function point(locator, duration=700) {
  const r=await locator.boundingBox();
  if(!r)throw new Error('Demo target is not visible');
  await move(r.x+r.width/2,r.y+r.height/2,duration);
}
try {
  // Warm the data and fonts before the edited recording starts.
  await page.goto(base+'#/world?country=356');
  await page.getByRole('button',{name:'Copy link to this view'}).waitFor({timeout:30000});
  await page.goto(base+'#/');
  await page.getByRole('application').waitFor({timeout:30000});
  await page.evaluate(()=>document.fonts.ready);
  await delay(900);
  await page.mouse.move(x,y);
  const start=Date.now();
  const offset=(start-recordingOpened)/1000;
  const at=seconds=>delay(start+seconds*1000-Date.now());
  await page.screenshot({path:output+'/hero.png'});
  await move(500,395,1400);
  await at(3.7);
  await point(page.getByRole('link',{name:'Explore the world',exact:true}),900);
  await at(5.2);
  await page.mouse.click(x,y);
  const map=page.getByRole('application',{name:/World map/});
  await map.waitFor({timeout:15000});
  await move(775,310,900);
  await at(8.5);
  await point(page.getByRole('button',{name:/Find a country/}),800);
  await page.mouse.click(x,y);
  await page.keyboard.type('India',{delay:110});
  await point(page.getByRole('option',{name:'India',exact:true}),450);
  await page.mouse.click(x,y);
  await page.getByRole('heading',{name:'India',exact:true}).waitFor({timeout:10000});
  await at(13.2);
  await move(870,355,700);
  await at(14.5);
  await move(1620,350,850);
  await at(16.2);
  await move(1630,520,850);
  await page.screenshot({path:output+'/country.png'});
  await at(19.2);
  await point(page.getByRole('button',{name:'Zoom in',exact:true}),700);
  await page.mouse.click(x,y);
  await at(21);
  const r=await map.boundingBox();
  await move(r.x+r.width*.5,r.y+r.height*.5,850);
  await at(22.3);
  await page.mouse.click(x,y);
  await page.getByRole('heading',{level:2,name:/grid cell at/i}).waitFor({timeout:5000});
  await at(24);
  await move(1660,770,750);
  await page.mouse.wheel(0,660);
  await at(25.7);
  const copy=page.getByRole('button',{name:'Copy link to this view'});
  await copy.scrollIntoViewIfNeeded();
  await point(copy,650);
  await page.mouse.click(x,y);
  await page.getByRole('button',{name:'Link copied'}).waitFor({timeout:3000});
  await at(27.5);
  await move(1170,460,800);
  await page.screenshot({path:output+'/detail.png'});
  await at(30.5);
  writeFileSync(output+'/capture.json',JSON.stringify({offset, elapsed:(Date.now()-start)/1000, source:base, viewport:[1920,1080], errors},null,2));
  console.log(JSON.stringify({offset,elapsed:(Date.now()-start)/1000,errors}));
} finally {
  await context.close();
  console.log('video',await video.path());
  await browser.close();
}
