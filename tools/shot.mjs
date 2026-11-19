// Headless check: console errors + screenshots of every section and the main interactions.
// Usage: node tools/shot.mjs [outDir] [width] [height] [steps]   (env: URL=live site, Q=?query)
// puppeteer-core is borrowed from the dhaka-streets project.
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';

const require = createRequire('c:/Users/User/Desktop/Claude/dhaka-streets/tools/package.json');
const puppeteer = require('puppeteer-core');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2] || path.join(root, 'tools', 'shots');
const W = +(process.argv[3] || 1440), H = +(process.argv[4] || 900);
const steps = (process.argv[5] || 'all').split(',');
const want = (s) => steps.includes('all') || steps.includes(s);
fs.mkdirSync(out, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--allow-file-access-from-files', `--window-size=${W},${H}`, `--user-data-dir=${path.join(out, '.prof-' + Date.now())}`],
  defaultViewport: { width: W, height: H, deviceScaleFactor: 1, isMobile: W < 600, hasTouch: W < 600 },
});
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
page.on('requestfailed', (r) => errors.push('[requestfailed] ' + r.url().slice(0, 120) + ' ' + (r.failure() || {}).errorText));

// URL=https://horuseus2.github.io/sifar-shelf/ checks the live site instead of the local file.
const url = (process.env.URL || pathToFileURL(path.join(root, 'index.html')).href) + (process.env.Q || '');
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => !document.getElementById('loader'), { timeout: 12000 }).catch(() => errors.push('loader never left'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (name) => { await page.screenshot({ path: path.join(out, name + '.png') }); console.log('shot', name); };
const jump = async (sel, off = -90) => {
  await page.evaluate((sel, off) => {
    const el = sel === 'top' ? 0 : document.querySelector(sel);
    if (window.S && S.lenis) S.lenis.scrollTo(el, { immediate: true, offset: off, force: true });
    else window.scrollTo(0, el === 0 ? 0 : el.getBoundingClientRect().top + scrollY + off);
  }, sel, off);
  await sleep(1600);
};

await sleep(2600);
if (want('hero')) await shot('01-hero');
if (want('now')) { await jump('#now'); await shot('02-now'); }
if (want('default')) { await jump('#collection'); await shot('03a-default-view'); }
await page.evaluate(() => S.collection.setView('wall'));
await sleep(900);
if (want('wall')) { await jump('#collection'); await shot('03-wall'); await jump('#wall', -260); await shot('03b-wall-scrolled'); }
if (want('filter')) {
  await jump('#collection');
  await page.click('.tab[data-cat="game"]');
  await sleep(1300);
  await shot('04-filter-games');
  await page.click('.tab[data-cat="all"]');
  await sleep(1200);
}
if (want('shelf')) {
  await jump('#collection');
  await page.click('#view-seg [data-view="shelf"]');
  await sleep(1800);
  await shot('05-shelf');
  const o = await page.$('#bays .obj--book');
  if (o) { const b = await o.boundingBox(); await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await sleep(1100); await shot('06-shelf-hover'); }
  const g = await page.$$('#bays .obj--game');
  if (g[2]) { const b = await g[2].boundingBox(); await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await sleep(1100); await shot('06b-shelf-hover-game'); }
  await page.mouse.move(5, 5);
  await page.click('#view-seg [data-view="wall"]');
  await sleep(1200);
}
if (want('favs')) { await jump('#favourites'); await sleep(600); await shot('07-favourites'); }
if (want('numbers')) { await jump('#numbers'); await sleep(1600); await shot('08-numbers'); }
if (want('footer')) { await jump('.footer', 0); await shot('09-footer'); }
if (want('modal')) {
  await jump('#collection');
  await page.click('#wall .card[data-id="interstellar"] .card-btn');
  await sleep(1500);
  await shot('10-modal');
  await page.keyboard.press('ArrowRight');
  await sleep(1100);
  await shot('10b-modal-next');
  await page.keyboard.press('Escape');
  await sleep(1200);
  await shot('10c-after-close');
}
if (want('surprise')) {
  await jump('top', 0);
  await page.click('#surprise');
  await sleep(4200);
  await shot('11-surprise');
  await page.keyboard.press('Escape');
  await sleep(1200);
}

const state = await page.evaluate(() => ({
  items: S.store.items.length,
  cards: document.querySelectorAll('#wall .card').length,
  overflowX: document.documentElement.scrollWidth - innerWidth,
  lenis: !!S.lenis,
}));
console.log('state', JSON.stringify(state));
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors');
await browser.close();
