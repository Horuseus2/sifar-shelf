// Curator flow: live search for every type, add, edit, remove samples, discard.
// Usage: node tools/curate.mjs [outDir]
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
const require = createRequire('c:/Users/User/Desktop/Claude/dhaka-streets/tools/package.json');
const puppeteer = require('puppeteer-core');
const out = process.argv[2] || 'tools/shots';
fs.mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--allow-file-access-from-files', '--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist', `--user-data-dir=${path.join(out, '.prof-' + Date.now())}`], defaultViewport: { width: 1440, height: 900 } });
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (c, msg) => console.log((c ? 'PASS ' : 'FAIL ') + msg);
await page.goto('file:///c:/Users/User/Desktop/Claude/sifar-shelf/index.html?curate', { waitUntil: 'load' });
await page.waitForFunction(() => !document.getElementById('loader'), { timeout: 12000 });
await sleep(1500);
ok(await page.evaluate(() => document.body.classList.contains('curating')), 'curator mode on via ?curate');

// live search for each type
for (const [t, q] of [['book', 'project hail mary'], ['game', 'hollow knight'], ['movie', 'the matrix'], ['series', 'severance']]) {
  if (t === 'book') { await page.click('#dock [data-k="add"]'); await sleep(900); }
  await page.evaluate(() => { const q = document.getElementById('ed-q'); q.value = ''; q.dispatchEvent(new Event('input')); });
  await page.click(`.ed-types button[data-type="${t}"]`);
  await page.type('#ed-q', q, { delay: 20 });
  await sleep(500);
  const got = await page.waitForFunction(() => !document.querySelector('#ed-results .res-skel') && (document.querySelectorAll('#ed-results .res').length || document.querySelector('#ed-results .res-empty')), { timeout: 15000, polling: 100 }).then(() => true).catch(() => false);
  const res = await page.evaluate(() => [...document.querySelectorAll('#ed-results .res')].slice(0, 3).map((r) => r.querySelector('.res-t').textContent + ' | ' + r.querySelector('.res-s').textContent));
  ok(got && res.length > 0, `${t} search "${q}": ${JSON.stringify(res)}`);
  if (!res.length) console.log('   debug:', got, JSON.stringify(await page.evaluate(() => ({ q: document.getElementById('ed-q').value, txt: document.getElementById('ed-results').innerText.slice(0, 160), type: document.querySelector('.ed-types [aria-checked="true"]')?.dataset.type }))));
  if (t === 'series') {
    await page.screenshot({ path: path.join(out, 'c1-search.png') });
    await page.click('#ed-results .res');
    await sleep(1800);
    const f = await page.evaluate(() => { const v = (id) => document.getElementById(id).value; return { title: v('f-title'), by: v('f-by'), year: v('f-year'), seasons: v('f-seasons'), eps: v('f-episodes'), cover: !!document.querySelector('#ed-cov img') }; });
    ok(f.title && f.cover, 'picked series result fills form ' + JSON.stringify(f));
  }
}
// rating 4.5 by clicking the star row, favourite on, notes
const sb = await (await page.$('#f-rating .stars')).boundingBox();
await page.mouse.click(sb.x + sb.width * 0.88, sb.y + sb.height / 2);
await page.click('#f-fav');
await page.type('#f-notes', 'Test note from the curator flow.');
await page.screenshot({ path: path.join(out, 'c2-form.png') });
await page.click('#ed-submit');
await sleep(2600);
let st = await page.evaluate(() => ({ n: S.store.items.length, first: S.store.items[0], dirty: S.store.dirty, badge: document.querySelector('.dock-badge').textContent, card: !!document.querySelector(`#wall .card[data-id="${S.store.items[0].id}"], #bays .obj[data-id="${S.store.items[0].id}"]`) }));
ok(st.n === 22 && st.card && st.dirty, `added item: ${st.first.title} rating=${st.first.rating} fav=${st.first.fav} color=${st.first.color} seasons=${st.first.seasons} badge=${st.badge}`);
await page.screenshot({ path: path.join(out, 'c3-added.png') });

// serialized file must parse back
const text = await page.evaluate(() => S.store.serialize());
const json = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
ok(json.items.length === 22 && text.startsWith('/*'), 'serialize() round trips (' + json.items.length + ' items, ' + text.length + ' chars)');

// edit through the modal
await page.evaluate(() => S.modal.show('interstellar', null));
await sleep(1200);
await page.click('#m-body [data-act="edit"]');
await sleep(1200);
await page.evaluate(() => { document.getElementById('f-title').value = ''; });
await page.type('#f-title', 'Interstellar (edited)');
await page.click('#ed-submit');
await sleep(1600);
st = await page.evaluate(() => ({ t: S.store.get('interstellar').title, sample: !!S.store.get('interstellar').sample }));
ok(st.t === 'Interstellar (edited)' && !st.sample, 'edit saved and sample flag dropped: ' + JSON.stringify(st));

// draft survives reload
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => !document.getElementById('loader'), { timeout: 12000 });
await sleep(800);
st = await page.evaluate(() => ({ n: S.store.items.length, dirty: S.store.dirty, curating: document.body.classList.contains('curating') }));
ok(st.n === 22 && st.dirty && st.curating, 'draft restored after reload ' + JSON.stringify(st));

// remove samples through the confirm dialog
await page.click('#dock [data-k="more"]');
await sleep(500);
await page.click('#dock [data-k="samples"]');
await sleep(700);
await page.screenshot({ path: path.join(out, 'c4-confirm.png') });
await page.click('.ask [data-a="1"]');
await sleep(1800);
st = await page.evaluate(() => S.store.items.map((i) => i.title));
ok(st.length === 6, 'samples removed, left: ' + JSON.stringify(st));
await page.screenshot({ path: path.join(out, 'c5-after-samples.png') });

// discard everything
await page.click('#dock [data-k="more"]');
await sleep(500);
await page.click('#dock [data-k="discard"]');
await sleep(600);
await page.click('.ask [data-a="1"]');
await sleep(1600);
st = await page.evaluate(() => ({ n: S.store.items.length, dirty: S.store.dirty, ls: localStorage.getItem('sifar-shelf-draft-v1') }));
ok(st.n === 21 && !st.dirty && !st.ls, 'discard restores the file version ' + JSON.stringify(st));
ok(await page.evaluate(() => typeof window.showSaveFilePicker === 'function'), 'File System Access API available on file://');

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors');
await browser.close();
