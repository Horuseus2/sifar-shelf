// Scroll smoothness check: wheel through the whole page with Lenis and record
// frame times plus how much layout and style work the scroll caused.
// Usage: node tools/perf.mjs [width] [height]
import { createRequire } from 'node:module';
const require = createRequire('c:/Users/User/Desktop/Claude/dhaka-streets/tools/package.json');
const puppeteer = require('puppeteer-core');
const W = +(process.argv[2] || 1440), H = +(process.argv[3] || 900);
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new',
  args: ['--allow-file-access-from-files', '--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'],
  defaultViewport: { width: W, height: H },
});
const page = await browser.newPage();
const cdp = await page.createCDPSession();
await cdp.send('Performance.enable');
await page.goto('file:///c:/Users/User/Desktop/Claude/sifar-shelf/index.html', { waitUntil: 'load' });
await page.waitForFunction(() => !document.getElementById('loader'), { timeout: 12000 });
await new Promise((r) => setTimeout(r, 3000));
const metric = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));

async function run(label, view) {
  await page.evaluate((v) => { S.collection.setView(v); S.lenis.scrollTo(0, { immediate: true, force: true }); }, view);
  await new Promise((r) => setTimeout(r, 1500));
  await page.mouse.move(W * 0.5, H * 0.5);
  await page.evaluate(() => {
    window.__ft = [];
    let last = performance.now();
    const loop = (t) => { window.__ft.push(t - last); last = t; if (window.__rec) requestAnimationFrame(loop); };
    window.__rec = true;
    requestAnimationFrame(loop);
  });
  const a = await metric();
  const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  for (let i = 0; i < 400; i++) {
    await page.mouse.wheel({ deltaY: 110 });
    await new Promise((r) => setTimeout(r, 24));
    if (i % 20 === 0 && (await page.evaluate(() => scrollY)) >= max - 2) break;
  }
  await new Promise((r) => setTimeout(r, 1500));
  const b = await metric();
  const ft = await page.evaluate(() => { window.__rec = false; return window.__ft.slice(2); });
  const sorted = ft.slice().sort((x, y) => x - y);
  const pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))].toFixed(1);
  const d = (k) => (b[k] - a[k]);
  console.log(`\n[${label}] frames=${ft.length} median=${pct(0.5)}ms p95=${pct(0.95)}ms p99=${pct(0.99)}ms max=${sorted[sorted.length - 1].toFixed(1)}ms over33ms=${ft.filter((x) => x > 33.4).length}`);
  console.log(`  layouts=${d('LayoutCount')} (${(d('LayoutDuration') * 1000).toFixed(0)}ms)  styleRecalcs=${d('RecalcStyleCount')} (${(d('RecalcStyleDuration') * 1000).toFixed(0)}ms)  script=${(d('ScriptDuration') * 1000).toFixed(0)}ms  task=${(d('TaskDuration') * 1000).toFixed(0)}ms  reachedBottom=${(await page.evaluate(() => scrollY)) >= max - 2}`);
}
await run('wall view', 'wall');
await run('shelf view', 'shelf');
await browser.close();
