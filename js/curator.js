/* Sifar's Shelf | curator: add, edit and save the collection from the browser */
(function () {
  'use strict';
  const S = window.S, $ = S.$, $$ = S.$$;
  const K = (S.curator = { on: false });
  let dock, ed, form, editing = null, original = null, type = 'book', cover = '', coverTouched = false, status = 'finished', rating = 0, fav = false;
  let searchCtl = null, results = [], active = -1;

  /* ================= search providers: free, no keys, CORS enabled ================= */
  const enc = encodeURIComponent;
  const getJSON = async (url, signal) => {
    const r = await fetch(url, { signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  };
  const yearOf = (s) => {
    const m = String(s || '').match(/\b(1[89]\d\d|20\d\d)\b/);
    return m ? +m[1] : null;
  };
  const GENRES = ['fantasy', 'romance', 'thriller', 'mystery', 'science fiction', 'horror', 'history', 'biography', 'young adult', 'classic', 'adventure', 'crime', 'drama', 'philosophy', 'self-help', 'poetry', 'humor', 'business', 'psychology', 'memoir', 'dystopian', 'historical fiction', 'nonfiction', 'graphic novel', 'suspense'];
  const pickSubjects = (subs) => {
    const out = [];
    (subs || []).forEach((s) => {
      const l = String(s).toLowerCase();
      const g = GENRES.find((x) => l === x || l === x + ' fiction' || l.startsWith(x + ',') || l === 'fiction, ' + x);
      if (g && !out.includes(g)) out.push(g);
    });
    return out.slice(0, 3).map((g) => g.replace(/\b\w/g, (c) => c.toUpperCase()));
  };
  const cleanTitle = (t) => String(t).replace(/\s*\([^)]*(film|video game|tv series|series|novel|game|miniseries)[^)]*\)\s*$/i, '').trim();

  async function wiki(q, kind, signal) {
    const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&origin=*&generator=search&gsrsearch=${enc(q + ' ' + kind)}&gsrlimit=12&prop=pageimages|description|extracts&piprop=thumbnail&pithumbsize=500&pilicense=any&exintro=1&explaintext=1&exsentences=2&exlimit=12`;
    const d = await getJSON(url, signal);
    const pages = ((d.query && d.query.pages) || []).slice().sort((a, b) => a.index - b.index);
    // Real titles read like "1999 film by the Wachowskis" or "2017 video game".
    const want = kind === 'film' ? /\b(18|19|20)\d\d\b[^,;]*\b(film|movie)\b/i : /\b(19|20)\d\d\b[^,;]*\bgame\b/i;
    const skip = /franchise|soundtrack|character|list of|series of|company|developer|designer|composer|artist|born|album|music|community|expansion|documentary about/i;
    return pages
      .filter((p) => want.test(p.description || '') && !skip.test(p.description || ''))
      .slice(0, 8)
      .map((p) => {
        const desc = p.description || '', ex = p.extract || '';
        let by = '';
        if (kind === 'film') {
          const m = desc.match(/film by (.+)$/i) || ex.match(/directed by ([^.,;(]+?)(?:\s+(?:and (?:written|produced)|from|with|based|starring|written|produced)\b|[.,;(])/i);
          if (m) by = m[1].trim();
        } else {
          const m = ex.match(/developed (?:and published )?by ([^.,;(]+?)(?:\s+(?:and published|and released|for the|for|in|with)\b|[.,;(])/i);
          if (m) by = m[1].trim();
        }
        // "Australian independent development studio Team Cherry" becomes "Team Cherry".
        by = by.replace(/^.*\b(?:studio|developer|company|division|subsidiary)\s+(?=[A-Z0-9])/, '').replace(/^the /, 'The ');
        const thumb = p.thumbnail ? p.thumbnail.source : '';
        return { title: cleanTitle(p.title), by, year: yearOf(desc) || yearOf(ex), cover: thumb, thumb, genres: [], note: desc };
      });
  }

  const SOURCES = {
    book: {
      name: 'Open Library',
      async find(q, signal) {
        const d = await getJSON(`https://openlibrary.org/search.json?q=${enc(q)}&limit=8&fields=key,title,author_name,first_publish_year,cover_i,number_of_pages_median,subject`, signal);
        return (d.docs || []).map((x) => ({
          title: x.title, by: (x.author_name || [])[0] || '', year: x.first_publish_year || null,
          cover: x.cover_i ? `https://covers.openlibrary.org/b/id/${x.cover_i}-L.jpg` : '',
          thumb: x.cover_i ? `https://covers.openlibrary.org/b/id/${x.cover_i}-S.jpg` : '',
          pages: x.number_of_pages_median || null, genres: pickSubjects(x.subject),
          note: x.number_of_pages_median ? `${x.number_of_pages_median} pages` : '',
        }));
      },
    },
    game: { name: 'Wikipedia', find: (q, s) => wiki(q, 'video game', s) },
    movie: { name: 'Wikipedia', find: (q, s) => wiki(q, 'film', s) },
    series: {
      name: 'TVmaze',
      async find(q, signal) {
        const d = await getJSON(`https://api.tvmaze.com/search/shows?q=${enc(q)}`, signal);
        return d.slice(0, 8).map(({ show: s }) => ({
          title: s.name, by: (s.network && s.network.name) || (s.webChannel && s.webChannel.name) || '', year: yearOf(s.premiered),
          cover: s.image ? s.image.original : '', thumb: s.image ? s.image.medium : '', genres: (s.genres || []).slice(0, 3), tvmaze: s.id,
          note: (s.genres || []).slice(0, 2).join(', '),
        }));
      },
      async more(r) {
        const seasons = await getJSON(`https://api.tvmaze.com/shows/${r.tvmaze}/seasons`);
        const today = new Date().toISOString().slice(0, 10);
        const aired = seasons.filter((x) => x.premiereDate && x.premiereDate <= today);
        return { seasons: aired.length || seasons.length || null, episodes: aired.reduce((a, x) => a + (x.episodeOrder || 0), 0) || null };
      },
    },
  };

  /* ================= colour from a cover ================= */
  function extractColor(src) {
    return new Promise((res) => {
      if (!src) return res(null);
      const im = new Image();
      im.crossOrigin = 'anonymous';
      const t = setTimeout(() => res(null), 3000);
      im.onload = () => {
        clearTimeout(t);
        try {
          const c = document.createElement('canvas');
          c.width = 24;
          c.height = 36;
          const x = c.getContext('2d', { willReadFrequently: true });
          x.drawImage(im, 0, 0, 24, 36);
          const d = x.getImageData(0, 0, 24, 36).data;
          let r = 0, g = 0, b = 0, w = 0;
          for (let i = 0; i < d.length; i += 4) {
            const R = d[i], G = d[i + 1], B = d[i + 2];
            const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
            const l = (mx + mn) / 510;
            const sat = mx === mn ? 0 : (mx - mn) / (255 - Math.abs(mx + mn - 255));
            const wt = (0.12 + sat * sat) * Math.max(0, 1 - Math.abs(l - 0.45) * 1.8);
            r += R * wt; g += G * wt; b += B * wt; w += wt;
          }
          res(w ? S.toHex([r / w, g / w, b / w]) : null);
        } catch (e) {
          res(null);
        }
      };
      im.onerror = () => { clearTimeout(t); res(null); };
      im.src = src;
    });
  }

  /* ================= small confirm dialog ================= */
  function ask(title, html, okLabel, danger) {
    return new Promise((res) => {
      const d = S.html(`<div class="ask" role="dialog" aria-modal="true" aria-label="${S.esc(title)}" data-lenis-prevent>
        <div class="ask-card"><h3>${S.esc(title)}</h3><p>${html}</p>
        <div class="ask-actions"><button type="button" class="btn btn-ghost btn-sm" data-a="0">Cancel</button><button type="button" class="btn btn-sm ${danger ? 'btn-danger-solid' : 'btn-primary'}" data-a="1">${S.esc(okLabel)}</button></div></div>
      </div>`);
      document.body.appendChild(d);
      gsap.fromTo(d, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power2.out' });
      gsap.fromTo(d.firstElementChild, { y: 24, scale: 0.97 }, { y: 0, scale: 1, duration: 0.7, ease: 'expo.out' });
      const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); done(false); } };
      const done = (v) => {
        document.removeEventListener('keydown', key, true);
        gsap.to(d, { opacity: 0, duration: 0.22, onComplete: () => d.remove() });
        res(v);
      };
      document.addEventListener('keydown', key, true);
      d.addEventListener('click', (e) => {
        const b = e.target.closest('[data-a]');
        if (b) done(b.dataset.a === '1');
        else if (e.target === d) done(false);
      });
      d.querySelector('[data-a="1"]').focus();
    });
  }

  /* ================= dock ================= */
  function buildDock() {
    dock = S.html(`<div class="dock" id="dock" role="toolbar" aria-label="Curator tools">
      <div class="dock-note" hidden>
        <span>The data file changed after these edits were made.</span>
        <button type="button" data-k="keep">Keep my edits</button>
        <button type="button" data-k="usefile">Use the file</button>
      </div>
      <span class="dock-tag"><i></i>Curator</span>
      <button class="dock-btn dock-primary" type="button" data-k="add">${S.icon('plus')}<span>Add</span></button>
      <button class="dock-btn dock-save" type="button" data-k="save">${S.icon('save')}<span class="dock-save-l">Saved</span><span class="dock-badge" hidden>0</span></button>
      <div class="dock-more">
        <button class="dock-btn dock-icon" type="button" data-k="more" aria-label="More options" aria-haspopup="menu" aria-expanded="false">${S.icon('more')}</button>
        <div class="dock-menu" role="menu" hidden>
          <button type="button" role="menuitem" data-k="download">${S.icon('download')}<span>Download data file</span></button>
          <button type="button" role="menuitem" data-k="relink">${S.icon('file')}<span>Save into a different file</span></button>
          <button type="button" role="menuitem" data-k="samples">${S.icon('sparkle')}<span class="dm-samples">Remove samples</span></button>
          <button type="button" role="menuitem" data-k="discard">${S.icon('undo')}<span>Discard unsaved changes</span></button>
          <button type="button" role="menuitem" data-k="exit">${S.icon('lock')}<span>Exit curator mode</span></button>
        </div>
      </div>
    </div>`);
    document.body.appendChild(dock);
    const menu = $('.dock-menu', dock), moreBtn = $('[data-k="more"]', dock);
    const openMenu = (v) => {
      menu.hidden = !v;
      moreBtn.setAttribute('aria-expanded', String(v));
      if (v) gsap.fromTo(menu, { opacity: 0, y: 10, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: 'expo.out' });
    };
    document.addEventListener('click', (e) => { if (!menu.hidden && !e.target.closest('.dock-more')) openMenu(false); });
    dock.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-k]');
      if (!b) return;
      const k = b.dataset.k;
      if (k === 'more') return openMenu(menu.hidden);
      openMenu(false);
      if (k === 'add') K.add();
      else if (k === 'save') save(false);
      else if (k === 'relink') save(true);
      else if (k === 'download') {
        S.store.download();
        S.toast('Downloaded collection.js. Replace data/collection.js with it.', 'download');
      } else if (k === 'samples') {
        const n = S.store.samples();
        if (!n) return S.toast('No samples left', 'check');
        if (await ask('Remove the samples?', `This clears the ${n} placeholder entries so only your own things are left. You can still discard before saving.`, 'Remove samples', true)) {
          S.store.removeSamples();
          S.toast(`Removed ${n} samples`, 'sparkle');
        }
      } else if (k === 'discard') {
        if (!S.store.dirty) return S.toast('Nothing to discard', 'check');
        if (await ask('Discard changes?', 'Everything since your last save goes back to how the data file has it.', 'Discard', true)) {
          S.store.discard();
          S.toast('Changes discarded', 'undo');
        }
      } else if (k === 'exit') K.disable();
      else if (k === 'keep') { S.store.keepMine(); S.toast('Keeping your edits', 'check'); }
      else if (k === 'usefile') { S.store.discard(); S.toast('Loaded the data file', 'file'); }
    });
  }

  function paintDock() {
    if (!dock) return;
    const dirty = S.store.dirty;
    const badge = $('.dock-badge', dock);
    badge.hidden = !dirty;
    badge.textContent = S.store.changes > 99 ? '99+' : S.store.changes;
    $('.dock-save', dock).classList.toggle('is-dirty', dirty);
    $('.dock-save-l', dock).textContent = dirty ? 'Save' : 'Saved';
    const n = S.store.samples();
    $('[data-k="samples"]', dock).hidden = !n;
    $('.dm-samples', dock).textContent = `Remove samples (${n})`;
    $('[data-k="discard"]', dock).hidden = !dirty;
    $('[data-k="relink"]', dock).hidden = !S.store.canWrite();
    $('.dock-note', dock).hidden = !S.store.conflict;
  }

  async function save(pickNew) {
    if (!S.store.dirty && !pickNew) return S.toast('Everything is saved', 'check');
    if (!S.store.canWrite()) {
      S.store.download();
      return S.toast('Downloaded collection.js. Replace data/collection.js with it.', 'download');
    }
    const known = await S.store.hasHandle();
    if (!known || pickNew) {
      const ok = await ask('Save to your site', 'In the next window, open your <b>sifar-shelf</b> folder, then <b>data</b>, pick <b>collection.js</b> and replace it. You only do this once on this computer.', 'Choose file');
      if (!ok) return;
    }
    try {
      const name = await S.store.saveToFile(pickNew || !known);
      if (name === 'collection.js') S.toast('Saved to collection.js. Push to GitHub to publish.', 'check');
      else S.toast(`Saved into ${name}. The site reads data/collection.js.`, 'file');
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      console.warn(e);
      S.store.download();
      S.toast('Could not write the file, so it was downloaded instead.', 'download');
    }
  }

  /* ================= editor ================= */
  const v = (id) => $('#' + id).value.trim();
  const set = (id, val) => ($('#' + id).value = val == null ? '' : val);

  function buildEditor() {
    ed = S.html(`<div class="ed" id="ed" hidden>
      <div class="ed-backdrop"></div>
      <div class="ed-scroll" data-lenis-prevent>
        <form class="ed-sheet" id="ed-form" novalidate autocomplete="off">
          <header class="ed-head">
            <div><p class="ed-kicker">Curator</p><h2 class="ed-title">Add to the shelf</h2></div>
            <button type="button" class="icon-btn" data-ed-close aria-label="Close">${S.icon('close')}</button>
          </header>
          <div class="ed-types" role="radiogroup" aria-label="Type">
            ${S.ORDER.map((t) => `<button type="button" role="radio" aria-checked="false" data-type="${t}" style="--tc:var(--${t})">${S.icon(S.TYPES[t].icon)}<span>${S.TYPES[t].label}</span></button>`).join('')}
            <span class="ed-types-ink" aria-hidden="true"></span>
          </div>
          <div class="ed-find">
            <label class="search search-lg">${S.icon('search')}<input id="ed-q" type="search" placeholder="Search" aria-label="Search for a title" aria-controls="ed-results" spellcheck="false"></label>
            <div class="ed-results" id="ed-results" role="listbox" aria-label="Search results"></div>
            <p class="ed-src" id="ed-src"></p>
          </div>
          <div class="ed-grid">
            <div class="ed-left">
              <div class="ed-cov cov" id="ed-cov"></div>
              <div class="ed-cov-actions">
                <label class="btn btn-ghost btn-sm ed-upload">${S.icon('upload')}<span>Upload</span><input type="file" accept="image/*" id="ed-file" hidden></label>
                <button type="button" class="btn btn-ghost btn-sm" id="ed-cov-clear">${S.icon('close')}<span>Clear</span></button>
              </div>
              <label class="field"><span>Cover image link</span><input class="input" id="f-cover" type="url" placeholder="https://"></label>
            </div>
            <div class="ed-right">
              <label class="field"><span>Title</span><input class="input" id="f-title" required></label>
              <div class="ed-row2">
                <label class="field"><span id="f-by-l">Author</span><input class="input" id="f-by"></label>
                <label class="field ed-narrow"><span>Year</span><input class="input" id="f-year" inputmode="numeric" maxlength="4" placeholder="2024"></label>
              </div>
              <div class="field"><span>Status</span>
                <div class="ed-seg" id="f-status" role="radiogroup" aria-label="Status">
                  <button type="button" role="radio" data-v="finished">${S.icon('check')}<span>Finished</span></button>
                  <button type="button" role="radio" data-v="current">${S.icon('clock')}<span>In progress</span></button>
                </div>
              </div>
              <div class="ed-when" data-when="finished">
                <label class="field"><span id="f-fin-l">Finished on</span><input class="input" id="f-finished" type="month" placeholder="2025-06"></label>
              </div>
              <div class="ed-when" data-when="current">
                <label class="field"><span>Progress <output id="f-prog-o">0%</output></span><input class="range" id="f-progress" type="range" min="0" max="100" step="5" value="0"></label>
                <label class="field"><span>Where I am</span><input class="input" id="f-pnote" placeholder="Chapter 12, or season 2 episode 4"></label>
              </div>
              <div class="ed-row2">
                <div class="field"><span>My rating <output id="f-rating-o">Not rated</output></span>
                  <div class="star-input" id="f-rating" tabindex="0" role="slider" aria-label="Rating" aria-valuemin="0" aria-valuemax="5" aria-valuenow="0"><span class="stars" style="--r:0;--s:28px"></span></div>
                </div>
                <div class="field ed-narrow"><span>Favourite</span><button type="button" class="toggle" id="f-fav" role="switch" aria-checked="false" aria-label="Favourite"><i></i></button></div>
              </div>
              <div class="ed-type ed-row2" data-for="book"><label class="field"><span>Pages</span><input class="input" id="f-pages" inputmode="numeric"></label></div>
              <div class="ed-type ed-row2" data-for="game"><label class="field"><span>Platform</span><input class="input" id="f-platform" placeholder="PC, PS5, Switch"></label><label class="field ed-narrow"><span>Hours</span><input class="input" id="f-hours" inputmode="numeric"></label></div>
              <div class="ed-type ed-row2" data-for="movie"><label class="field"><span>Runtime in minutes</span><input class="input" id="f-runtime" inputmode="numeric"></label></div>
              <div class="ed-type ed-row2" data-for="series"><label class="field"><span>Seasons watched</span><input class="input" id="f-seasons" inputmode="numeric"></label><label class="field"><span>Episodes</span><input class="input" id="f-episodes" inputmode="numeric"></label></div>
              <label class="field"><span>Genres, separated by commas</span><input class="input" id="f-genres" placeholder="Fantasy, Romance"></label>
              <label class="field"><span>My thoughts</span><textarea class="input" id="f-notes" rows="4" placeholder="What stuck with you?"></textarea></label>
            </div>
          </div>
          <footer class="ed-foot">
            <button type="button" class="btn btn-ghost" data-ed-close>Cancel</button>
            <button type="submit" class="btn btn-primary" id="ed-submit">${S.icon('plus')}<span>Add to shelf</span></button>
          </footer>
        </form>
      </div>
    </div>`);
    document.body.appendChild(ed);
    form = $('#ed-form');
    wireEditor();
  }

  function setType(t, keepQuery) {
    type = t;
    const T = S.TYPES[t];
    $$('.ed-types button', ed).forEach((b) => b.setAttribute('aria-checked', String(b.dataset.type === t)));
    const b = $(`.ed-types button[data-type="${t}"]`, ed), ink = $('.ed-types-ink', ed);
    ink.style.width = b.offsetWidth + 'px';
    ink.style.transform = `translate3d(${b.offsetLeft}px,0,0)`;
    ed.style.setProperty('--tc', `var(--${t})`);
    $('#ed-q').placeholder = { book: 'Search books by title or author', game: 'Search games by title', movie: 'Search movies by title', series: 'Search shows by title' }[t];
    $('#f-by-l').textContent = T.by;
    $('#f-fin-l').textContent = `${T.date} on`;
    $$('.ed-type', ed).forEach((x) => (x.hidden = x.dataset.for !== t));
    $('#ed-src').textContent = `Search uses ${SOURCES[t].name}. Pick a result to fill in the details, or type them yourself.`;
    paintCover();
    if (!keepQuery && $('#ed-q').value.trim().length > 1) search();
  }

  function setStatus(s) {
    status = s;
    $$('#f-status button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.v === s)));
    $$('.ed-when', ed).forEach((x) => (x.hidden = x.dataset.when !== s));
  }
  function setRating(r) {
    rating = S.clamp(Math.round(r * 2) / 2, 0, 5);
    const el = $('#f-rating');
    el.querySelector('.stars').style.setProperty('--r', rating);
    el.setAttribute('aria-valuenow', rating);
    $('#f-rating-o').textContent = rating ? `${rating} / 5` : 'Not rated';
  }
  function setFav(f) {
    fav = !!f;
    $('#f-fav').setAttribute('aria-checked', String(fav));
  }
  function setCover(url, touched) {
    cover = url || '';
    if (touched) coverTouched = true;
    $('#f-cover').value = cover.startsWith('data:') ? '' : cover;
    $('#f-cover').placeholder = cover.startsWith('data:') ? 'Uploaded image' : 'https://';
    paintCover();
  }
  function paintCover() {
    const box = $('#ed-cov');
    const it = { type, title: v('f-title') || 'Untitled', by: v('f-by'), cover, color: original && !coverTouched ? original.color : '' };
    box.classList.toggle('no-img', !cover);
    box.innerHTML = S.coverHTML(it, { eager: true });
    S.wireImgs(box);
  }

  /* ---------- search ---------- */
  function renderResults(state, list) {
    const box = $('#ed-results');
    results = list || [];
    active = -1;
    if (state === 'idle') { box.innerHTML = ''; box.classList.remove('is-open'); return; }
    box.classList.add('is-open');
    if (state === 'loading') {
      box.innerHTML = '<div class="res-skel"></div><div class="res-skel"></div><div class="res-skel"></div>';
      return;
    }
    if (state === 'error') { box.innerHTML = '<p class="res-empty">Search is not reachable right now. Fill in the details below.</p>'; return; }
    if (!results.length) { box.innerHTML = '<p class="res-empty">No matches. Try fewer words, or fill in the details below.</p>'; return; }
    box.innerHTML = results.map((r, i) => `<button type="button" class="res" role="option" data-i="${i}" aria-selected="false">
      <span class="res-cov cov${r.thumb ? '' : ' no-img'}">${S.coverHTML({ type, title: r.title, cover: r.thumb })}</span>
      <span class="res-t">${S.esc(r.title)}</span>
      <span class="res-s">${S.esc([r.by, r.year].filter(Boolean).join(' · ') || r.note || '')}</span>
    </button>`).join('');
    S.wireImgs(box);
    gsap.fromTo($$('.res', box), { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.03, ease: 'expo.out' });
  }
  async function search() {
    const q = $('#ed-q').value.trim();
    if (searchCtl) searchCtl.abort();
    if (q.length < 2) return renderResults('idle');
    searchCtl = new AbortController();
    const mine = searchCtl;
    renderResults('loading');
    try {
      const list = await SOURCES[type].find(q, mine.signal);
      if (mine === searchCtl) renderResults('done', list);
    } catch (e) {
      if (e.name !== 'AbortError' && mine === searchCtl) renderResults('error');
    }
  }
  async function pick(i) {
    const r = results[i];
    if (!r) return;
    set('f-title', r.title);
    set('f-by', r.by);
    set('f-year', r.year || '');
    if (r.pages) set('f-pages', r.pages);
    if (r.genres && r.genres.length) set('f-genres', r.genres.join(', '));
    setCover(r.cover, true);
    renderResults('idle');
    $('#ed-src').textContent = `Filled in from ${SOURCES[type].name}. Check the details, then add your rating and thoughts.`;
    const filled = $$('#f-title, #f-by, #f-year, #f-pages, #f-genres', ed).filter((x) => x.value && x.offsetParent);
    gsap.fromTo(filled, { boxShadow: '0 0 0 2px var(--tc)' }, { boxShadow: '0 0 0 0px var(--tc)', duration: 1.2, ease: 'power2.out', clearProps: 'boxShadow' });
    if (type === 'series' && r.tvmaze) {
      try {
        const m = await SOURCES.series.more(r);
        if (m.seasons) set('f-seasons', m.seasons);
        if (m.episodes) set('f-episodes', m.episodes);
      } catch (e) {}
    }
  }

  /* ---------- upload ---------- */
  async function readUpload(file) {
    if (!file || !/^image\//.test(file.type)) return;
    try {
      const bmp = await createImageBitmap(file);
      const k = Math.min(1, 420 / bmp.width, 630 / bmp.height);
      const c = document.createElement('canvas');
      c.width = Math.round(bmp.width * k);
      c.height = Math.round(bmp.height * k);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      setCover(c.toDataURL('image/jpeg', 0.85), true);
    } catch (e) {
      S.toast('That image could not be read', 'image');
    }
  }

  function wireEditor() {
    ed.addEventListener('click', (e) => {
      if (e.target.closest('[data-ed-close]') || e.target.classList.contains('ed-scroll')) close();
      const tb = e.target.closest('.ed-types button');
      if (tb) setType(tb.dataset.type);
      const sb = e.target.closest('#f-status button');
      if (sb) setStatus(sb.dataset.v);
      const rb = e.target.closest('.res');
      if (rb) pick(+rb.dataset.i);
    });
    $('#f-fav').addEventListener('click', () => setFav(!fav));
    const q = $('#ed-q');
    q.addEventListener('input', S.debounce(search, 380));
    q.addEventListener('keydown', (e) => {
      const opts = $$('.res', ed);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!opts.length) return;
        e.preventDefault();
        active = (active + (e.key === 'ArrowDown' ? 1 : -1) + opts.length) % opts.length;
        opts.forEach((o, i) => o.setAttribute('aria-selected', String(i === active)));
        opts[active].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (active >= 0) pick(active);
        else if (opts.length) pick(0);
        else search();
      }
    });
    const prog = $('#f-progress');
    prog.addEventListener('input', () => ($('#f-prog-o').textContent = prog.value + '%'));
    const star = $('#f-rating'), stars = star.querySelector('.stars');
    const fromX = (e) => {
      const r = stars.getBoundingClientRect();
      return Math.ceil(S.clamp((e.clientX - r.left) / r.width, 0.001, 1) * 10) / 2;
    };
    star.addEventListener('pointermove', (e) => stars.style.setProperty('--r', fromX(e)));
    star.addEventListener('pointerleave', () => stars.style.setProperty('--r', rating));
    star.addEventListener('click', (e) => {
      const r = fromX(e);
      setRating(r === rating ? 0 : r);
    });
    star.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); setRating(rating + 0.5); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); setRating(rating - 0.5); }
    });
    $('#ed-file').addEventListener('change', (e) => readUpload(e.target.files[0]));
    $('#ed-cov-clear').addEventListener('click', () => setCover('', true));
    $('#f-cover').addEventListener('change', (e) => setCover(e.target.value.trim(), true));
    $('#f-title').addEventListener('input', S.debounce(paintCover, 250));
    $('#f-year').addEventListener('input', (e) => (e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4)));
    ed.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.stopPropagation();
        if ($('#ed-results').classList.contains('is-open') && document.activeElement === $('#ed-q')) return renderResults('idle');
        close();
      }
    });
    form.addEventListener('submit', submit);
  }

  function collect() {
    const num = (id) => (v(id) ? Number(v(id).replace(/[^\d.]/g, '')) || '' : '');
    const d = {
      type, title: v('f-title'), by: v('f-by'), year: num('f-year'), cover,
      color: original && !coverTouched ? original.color : '',
      status, rating, fav, genres: v('f-genres'), notes: $('#f-notes').value.trim(),
    };
    if (status === 'current') {
      d.progress = +$('#f-progress').value;
      d.progressNote = v('f-pnote');
    } else d.finished = v('f-finished');
    if (type === 'book') d.pages = num('f-pages');
    if (type === 'game') { d.platform = v('f-platform'); d.hours = num('f-hours'); }
    if (type === 'movie') d.runtime = num('f-runtime');
    if (type === 'series') { d.seasons = num('f-seasons'); d.episodes = num('f-episodes'); }
    return d;
  }

  async function submit(e) {
    e.preventDefault();
    const title = $('#f-title');
    if (!title.value.trim()) {
      title.focus();
      gsap.fromTo(title, { x: -8 }, { x: 0, duration: 0.6, ease: 'elastic.out(1, 0.35)' });
      return;
    }
    const btn = $('#ed-submit');
    btn.disabled = true;
    const d = collect();
    if (!d.color && d.cover) d.color = (await extractColor(d.cover)) || '';
    const was = editing;
    const it = was ? S.store.update(was, d) : S.store.add(d);
    btn.disabled = false;
    close();
    S.sfx.chime();
    S.toast(was ? `Updated ${it.title}` : `Added ${it.title} to the shelf`, was ? 'check' : 'sparkle');
    if (S.query.cat !== 'all' && S.query.cat !== it.type) S.collection.setCat(it.type);
    if (S.query.q) {
      $('#search').value = '';
      S.query.q = '';
      S.collection.render({ animate: true });
    }
    setTimeout(() => S.collection.flash(it.id), 520);
  }

  function open(it) {
    editing = it ? it.id : null;
    original = it || null;
    coverTouched = false;
    form.reset();
    renderResults('idle');
    $('#ed-q').value = '';
    $('.ed-title', ed).textContent = it ? 'Edit entry' : 'Add to the shelf';
    $('#ed-submit').innerHTML = it ? `${S.icon('check')}<span>Save changes</span>` : `${S.icon('plus')}<span>Add to shelf</span>`;
    ed.hidden = false;
    $('.ed-find', ed).hidden = !!it;
    setType(it ? it.type : S.query.cat !== 'all' ? S.query.cat : type, true);
    set('f-title', it && it.title);
    set('f-by', it && it.by);
    set('f-year', it && it.year);
    setStatus(it ? it.status : 'finished');
    set('f-finished', it && it.finished ? String(it.finished).slice(0, 7) : '');
    $('#f-progress').value = (it && it.progress) || 0;
    $('#f-prog-o').textContent = ((it && it.progress) || 0) + '%';
    set('f-pnote', it && it.progressNote);
    setRating((it && it.rating) || 0);
    setFav(it && it.fav);
    set('f-pages', it && it.pages);
    set('f-platform', it && it.platform);
    set('f-hours', it && it.hours);
    set('f-runtime', it && it.runtime);
    set('f-seasons', it && it.seasons);
    set('f-episodes', it && it.episodes);
    set('f-genres', it && it.genres ? it.genres.join(', ') : '');
    $('#f-notes').value = (it && it.notes) || '';
    setCover((it && it.cover) || '');
    document.documentElement.classList.add('has-overlay');
    if (S.lenis) S.lenis.stop();
    $('.ed-scroll', ed).scrollTop = 0;
    gsap.fromTo($('.ed-backdrop', ed), { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'power2.out' });
    gsap.fromTo(form, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.8, ease: 'expo.out', clearProps: 'transform' });
    setTimeout(() => (it ? $('#f-title') : $('#ed-q')).focus({ preventScroll: true }), 80);
  }
  function close() {
    if (ed.hidden) return;
    if (searchCtl) searchCtl.abort();
    gsap.to(form, { opacity: 0, y: 24, duration: 0.3, ease: 'power2.in' });
    gsap.to($('.ed-backdrop', ed), {
      opacity: 0, duration: 0.35, delay: 0.05, ease: 'power2.inOut',
      onComplete: () => {
        ed.hidden = true;
        gsap.set(form, { clearProps: 'all' });
        if (!S.modal.isOpen) {
          document.documentElement.classList.remove('has-overlay');
          if (S.lenis) S.lenis.start();
        }
      },
    });
  }

  /* ================= public ================= */
  K.add = () => open(null);
  K.edit = (id) => {
    const it = S.store.get(id);
    if (it) open(it);
  };
  function paintToggle() {
    const b = $('#curator-toggle');
    b.innerHTML = `${S.icon(K.on ? 'unlock' : 'lock')}<span>${K.on ? 'Exit curator mode' : 'Curator mode'}</span>`;
  }
  K.enable = (announce) => {
    K.on = true;
    document.body.classList.add('curating');
    S.ls.set('shelf-curator', '1');
    paintToggle();
    paintDock();
    gsap.fromTo(dock, { yPercent: 160, xPercent: -50 }, { yPercent: 0, xPercent: -50, duration: 0.9, ease: 'expo.out' });
    if (announce) S.toast('Curator mode is on. Add, edit and save from the dock.', 'unlock');
  };
  K.disable = () => {
    K.on = false;
    S.ls.set('shelf-curator', '0');
    paintToggle();
    gsap.to(dock, { yPercent: 160, duration: 0.5, ease: 'power3.in', onComplete: () => document.body.classList.remove('curating') });
    if (S.store.dirty) S.toast('Unsaved changes stay on this device until you save them.', 'save');
  };

  K.init = () => {
    buildDock();
    buildEditor();
    paintToggle();
    gsap.set(dock, { xPercent: -50, yPercent: 160 });
    $('#curator-toggle').addEventListener('click', () => (K.on ? K.disable() : K.enable(true)));
    S.on('change', paintDock);
    S.on('saved', paintDock);
    const wanted = /[?&]curate\b/.test(location.search) || S.ls.get('shelf-curator') === '1' || S.store.dirty;
    if (wanted) K.enable(false);
  };
})();
