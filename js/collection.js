/* Sifar's Shelf | collection: toolbar, wall view (Flip), shelf view (3D objects) */
(function () {
  'use strict';
  const S = window.S, $ = S.$, $$ = S.$$;
  const C = (S.collection = {});
  // First visit: the 3D shelf on desktop, the cover wall on touch screens. After that, whatever was picked last.
  const savedView = S.ls.get('shelf-view');
  const Q = (S.query = { cat: 'all', q: '', sort: 'recent', view: savedView === 'shelf' || savedView === 'wall' ? savedView : S.fine ? 'shelf' : 'wall' });
  const cards = new Map();
  let revealed = false;
  let batch = [];
  let io = null;
  let shelfW = 0;

  C.list = () => {
    const terms = Q.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const L = S.store.items.filter(
      (i) => (Q.cat === 'all' || i.type === Q.cat) && (!terms.length || terms.every((t) => S.haystack(i).includes(t)))
    );
    return S.sortItems(L, Q.sort);
  };

  /* ---------------- toolbar ---------------- */
  function placeInk(wrap, btn, ink, instant) {
    if (!btn || !ink) return;
    if (instant) ink.style.transition = 'none';
    ink.style.width = btn.offsetWidth + 'px';
    ink.style.transform = `translate3d(${btn.offsetLeft}px,0,0)`;
    if (instant) {
      void ink.offsetWidth;
      ink.style.transition = '';
    }
  }
  const tabInk = (instant) => {
    const tabs = $('#tabs');
    const b = tabs.querySelector(`.tab[data-cat="${Q.cat}"]`);
    placeInk(tabs, b, tabs.querySelector('.tabs-ink'), instant);
    if (b && tabs.scrollWidth > tabs.clientWidth) {
      const left = b.offsetLeft - (tabs.clientWidth - b.offsetWidth) / 2;
      tabs.scrollTo({ left, behavior: instant || S.reduced ? 'auto' : 'smooth' });
    }
  };
  const segInk = (instant) => {
    const seg = $('#view-seg');
    const b = seg.querySelector(`[data-view="${Q.view}"]`);
    $$('button', seg).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    placeInk(seg, b, seg.querySelector('.seg-ink'), instant);
  };

  function buildTabs() {
    const tabs = $('#tabs');
    const defs = [['all', 'All']].concat(S.ORDER.map((t) => [t, S.TYPES[t].plural]));
    tabs.insertAdjacentHTML(
      'beforeend',
      defs.map(([k, l]) =>
        `<button class="tab" type="button" role="tab" data-cat="${k}" aria-selected="${k === Q.cat}" style="--tc:${k === 'all' ? 'var(--text)' : `var(--${k})`}"><span class="tdot"></span>${l}<span class="tab-n" data-n="${k}"></span></button>`
      ).join('')
    );
    tabs.addEventListener('click', (e) => {
      const b = e.target.closest('.tab');
      if (b) C.setCat(b.dataset.cat);
    });
    tabs.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const all = $$('.tab', tabs);
      const i = all.findIndex((b) => b.dataset.cat === Q.cat);
      const n = all[(i + (e.key === 'ArrowRight' ? 1 : all.length - 1)) % all.length];
      n.focus();
      C.setCat(n.dataset.cat);
    });
  }
  const paintCounts = () => $$('.tab-n').forEach((n) => (n.textContent = S.store.count(n.dataset.n)));

  function wireSort() {
    const dd = $('#sort'), btn = dd.querySelector('.dd-btn'), list = dd.querySelector('.dd-list'), label = dd.querySelector('.dd-label');
    const items = $$('li', list);
    items.forEach((li) => (li.tabIndex = -1));
    const open = (v) => {
      dd.classList.toggle('is-open', v);
      btn.setAttribute('aria-expanded', String(v));
      if (v) (list.querySelector('[aria-selected="true"]') || items[0]).focus({ preventScroll: true });
    };
    const choose = (li) => {
      items.forEach((x) => x.setAttribute('aria-selected', String(x === li)));
      label.textContent = li.textContent;
      open(false);
      btn.focus({ preventScroll: true });
      if (Q.sort === li.dataset.v) return;
      Q.sort = li.dataset.v;
      S.sfx.swap();
      C.render({ animate: true });
    };
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      open(!dd.classList.contains('is-open'));
    });
    list.addEventListener('click', (e) => {
      const li = e.target.closest('li');
      if (li) choose(li);
    });
    document.addEventListener('click', (e) => {
      if (!dd.contains(e.target)) open(false);
    });
    dd.addEventListener('keydown', (e) => {
      const i = items.indexOf(document.activeElement);
      if (e.key === 'Escape') { open(false); btn.focus(); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!dd.classList.contains('is-open')) return open(true);
        const n = items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1) + items.length) % items.length];
        n.focus({ preventScroll: true });
      } else if ((e.key === 'Enter' || e.key === ' ') && i >= 0) {
        e.preventDefault();
        choose(items[i]);
      }
    });
  }

  function wireSearch() {
    const input = $('#search');
    const run = S.debounce(() => {
      if (Q.q === input.value) return;
      Q.q = input.value;
      C.render({ animate: true });
    }, 140);
    input.addEventListener('input', run);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        input.value = '';
        Q.q = '';
        C.render({ animate: true });
        input.blur();
      }
    });
    document.addEventListener('keydown', (e) => {
      const t = e.target;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if (e.key === '/' && !typing && !document.documentElement.classList.contains('has-overlay')) {
        e.preventDefault();
        const top = $('#collection').getBoundingClientRect().top;
        if (top > innerHeight * 0.5 || top < -innerHeight) S.scrollTo('#collection', { duration: 1.1 });
        input.focus({ preventScroll: true });
      }
    });
  }

  C.setCat = (cat) => {
    if (cat !== 'all' && !S.TYPES[cat]) cat = 'all';
    if (cat === Q.cat) return;
    Q.cat = cat;
    $$('.tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.cat === cat)));
    tabInk();
    document.body.dataset.cat = cat;
    S.sfx.swap();
    C.render({ animate: true });
  };

  C.setView = (v) => {
    if (v === Q.view) return;
    Q.view = v;
    S.ls.set('shelf-view', v);
    segInk();
    S.sfx.swap();
    revealAll();
    const out = v === 'shelf' ? $('#wall') : $('#shelf');
    gsap.to(out, {
      opacity: 0, y: 14, duration: 0.26, ease: 'power2.in', overwrite: true,
      onComplete: () => {
        out.hidden = true;
        gsap.set(out, { clearProps: 'opacity,transform' });
        C.render({ enter: true });
        const top = $('#collection').getBoundingClientRect().top;
        if (top < -200) S.scrollTo('#collection', { duration: 1 });
      },
    });
  };

  /* ---------------- header line + empty state ---------------- */
  function paintSub(list) {
    const q = Q.q.trim();
    let txt;
    if (q) txt = `${list.length} result${list.length === 1 ? '' : 's'} for “${q}”`;
    else if (Q.cat === 'all') {
      const n = S.store.items.length;
      txt = n ? `${n} thing${n === 1 ? '' : 's'} and counting` : 'Empty for now, but not for long';
    } else {
      const T = S.TYPES[Q.cat];
      txt = `${list.length} ${(list.length === 1 ? T.label : T.plural).toLowerCase()} ${T.done.toLowerCase()} so far`;
    }
    const el = $('#col-sub');
    if (el.textContent !== txt) el.textContent = txt;
  }
  function paintEmpty(show) {
    const box = $('#empty');
    box.hidden = !show;
    if (!show) return;
    const q = Q.q.trim();
    const T = S.TYPES[Q.cat];
    box.querySelector('.empty-title').textContent = q ? `Nothing matches “${q}”` : T ? `No ${T.plural.toLowerCase()} on the shelf yet` : 'The shelf is empty';
    box.querySelector('.empty-sub').textContent = q
      ? 'Try another word, or clear the search.'
      : document.body.classList.contains('curating') ? 'Press Add in the dock below to put something here.' : 'Check back soon.';
    gsap.fromTo(box, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.8 });
  }

  /* ---------------- wall ---------------- */
  function cardHTML(it) {
    const T = S.TYPES[it.type];
    const sub = [it.by, it.year].filter(Boolean).map(S.esc).join(' · ');
    return `<article class="card" role="listitem" data-id="${S.esc(it.id)}" data-type="${it.type}" style="--c:${S.itemColor(it)};--tc:var(--${it.type})">
      <button class="card-btn" type="button" aria-label="Open ${S.esc(it.title)}">
        <span class="card-tilt">
          <span class="card-glow"></span>
          <span class="card-art cov${it.cover ? '' : ' no-img'}">${S.coverHTML(it)}<span class="glare"></span></span>
          ${it.status === 'current' ? `<span class="badge badge-now"><i></i>${T.now}</span>` : ''}
          ${it.fav ? `<span class="badge badge-fav" title="Favourite">${S.icon('heartFill')}</span>` : ''}
          ${it.sample ? '<span class="badge badge-sample">Sample</span>' : ''}
        </span>
      </button>
      <div class="card-info">
        <h3 class="card-title">${S.esc(it.title)}</h3>
        <p class="card-sub"><span class="tdot" title="${T.label}"></span><span>${sub}</span></p>
        ${it.rating ? S.stars(it.rating, 12) : it.status === 'current' ? `<span class="card-now">${T.now} now</span>` : ''}
      </div>
    </article>`;
  }

  function renderWall(list, opt) {
    const wall = $('#wall');
    wall.hidden = false;
    const want = new Set(list.map((i) => i.id));
    const all0 = $$('.card', wall);
    const before = all0.filter((c) => c.style.display !== 'none');
    const state = opt.animate && all0.length && !S.reduced ? Flip.getState(all0) : null;
    const created = [];

    // Sync the keyed cards with the store.
    const live = new Set(S.store.items.map((i) => i.id));
    cards.forEach((el, id) => {
      if (!live.has(id)) {
        el.dataset.dead = '1';
        cards.delete(id);
      }
    });
    S.store.items.forEach((it) => {
      const sig = JSON.stringify(it);
      let el = cards.get(it.id);
      if (!el) {
        el = S.html(cardHTML(it));
        el._sig = sig;
        el.style.display = 'none';
        cards.set(it.id, el);
        created.push(el);
        wall.appendChild(el);
        S.wireImgs(el);
      } else if (el._sig !== sig) {
        const fresh = S.html(cardHTML(it));
        el.replaceChildren(...fresh.childNodes);
        el.setAttribute('style', fresh.getAttribute('style') + (el.style.display === 'none' ? ';display:none' : ''));
        el.dataset.type = it.type;
        el._sig = sig;
        S.wireImgs(el);
      }
    });
    $$('.card[data-dead]', wall).forEach((el) => (el.style.display = 'none'));
    cards.forEach((el, id) => (el.style.display = want.has(id) ? '' : 'none'));
    list.forEach((it) => wall.appendChild(cards.get(it.id)));

    const cleanup = () => $$('.card[data-dead]', wall).forEach((el) => el.remove());
    if (state) {
      const leaving = before.filter((el) => el.style.display === 'none');
      Flip.from(state, {
        duration: 0.75, ease: 'power3.inOut', absolute: leaving.length ? leaving : false, stagger: 0.008, simple: true,
        onEnter: (els) => gsap.fromTo(els, { opacity: 0, scale: 0.86, y: 26 }, { opacity: 1, scale: 1, y: 0, duration: 0.8, delay: 0.18, ease: 'expo.out', stagger: 0.025, clearProps: 'transform' }),
        onLeave: (els) => gsap.to(els, { opacity: 0, scale: 0.86, duration: 0.32, ease: 'power2.in' }),
        onComplete: () => {
          cleanup();
          refreshSoon();
        },
      });
      const fresh = created.filter((el) => el.style.display !== 'none');
      if (fresh.length) gsap.fromTo(fresh, { opacity: 0, scale: 0.86, y: 26 }, { opacity: 1, scale: 1, y: 0, duration: 0.9, delay: 0.25, ease: 'expo.out', clearProps: 'transform,opacity' });
    } else {
      cleanup();
      if (opt.enter) {
        const vis = $$('.card', wall).filter((c) => c.style.display !== 'none').slice(0, 24);
        gsap.fromTo(vis, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.9, ease: 'expo.out', stagger: 0.025, clearProps: 'transform,opacity' });
      }
      refreshSoon();
    }
  }

  function wireWall() {
    const wall = $('#wall');
    if (!S.fine || S.reduced) return;
    let cur = null;
    wall.addEventListener('pointermove', (e) => {
      const t = e.target.closest('.card-tilt');
      if (t !== cur) {
        if (cur) S.tiltTo(cur, 0, 0);
        cur = t;
        if (t) S.sfx.tick();
      }
      if (t) S.tiltFromEvent(t, e, { max: 9, persp: 800 });
    }, { passive: true });
    wall.addEventListener('pointerleave', () => {
      if (cur) S.tiltTo(cur, 0, 0);
      cur = null;
    });
  }

  /* ---------------- shelf ---------------- */
  function renderShelf(list, opt) {
    const shelf = $('#shelf'), bays = $('#bays');
    shelf.hidden = !list.length;
    if (!list.length) { bays.innerHTML = ''; return; }
    const W = bays.clientWidth || shelf.clientWidth || 1000;
    shelfW = W;
    const s = W < 520 ? 0.7 : W < 860 ? 0.84 : 1;
    const gap = 3;
    const room = W - 2 * (12 * s + 14) - 40 * s;
    const seq = [];
    if (Q.cat === 'all') {
      S.ORDER.forEach((t) => {
        const g = list.filter((i) => i.type === t);
        if (!g.length) return;
        seq.push({ div: t, n: g.length, w: Math.round(30 * s) + 12 });
        g.forEach((i) => seq.push({ it: i, w: S.objDims(i, s).t }));
      });
    } else list.forEach((i) => seq.push({ it: i, w: S.objDims(i, s).t }));

    const rows = [];
    let row = [], used = 0;
    seq.forEach((x) => {
      const need = x.w + gap;
      if (row.length && used + need > room) { rows.push(row); row = []; used = 0; }
      row.push(x);
      used += need;
    });
    if (row.length) rows.push(row);
    for (let r = 0; r < rows.length - 1; r++) {
      const last = rows[r][rows[r].length - 1];
      if (last.div && rows[r].length > 1) rows[r + 1].unshift(rows[r].pop());
    }
    const catW = 96 * s + 14;
    bays.innerHTML = rows.map((row, ri) => {
      const w = row.reduce((a, x) => a + x.w + gap, 0);
      const cat = ri === 0 && w + catW < room;
      return `<div class="row" style="--s:${s}">
        <div class="row-items">${S.bookendHTML('l')}${row.map((x) => (x.div ? S.dividerHTML(x.div, x.n, s) : S.objHTML(x.it, s))).join('')}${cat ? S.catHTML() : ''}${S.bookendHTML('r')}</div>
        <div class="board"></div>
      </div>`;
    }).join('');
    S.wireImgs(bays);
    if ((opt.animate || opt.enter) && !S.reduced) shelfIn();
    refreshSoon();
  }

  function shelfIn() {
    const objs = $$('#bays .obj, #bays .divider, #bays .cat-wrap, #bays .bookend');
    gsap.fromTo(objs, { y: -40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.95, ease: 'expo.out', stagger: 0.012, clearProps: 'transform,opacity' });
    gsap.fromTo($$('#bays .board'), { scaleX: 0.7, opacity: 0 }, { scaleX: 1, opacity: 1, duration: 1.1, ease: 'expo.out', stagger: 0.08, clearProps: 'transform,opacity' });
  }

  function pull(o, on) {
    clearTimeout(o._t);
    if (on) {
      o.classList.add('is-3d');
      requestAnimationFrame(() => requestAnimationFrame(() => o.classList.contains('is-3d') && o.classList.add('is-out')));
      S.sfx.tick();
    } else {
      o.classList.remove('is-out');
      o._t = setTimeout(() => o.classList.remove('is-3d'), 720);
    }
  }

  function wireShelf() {
    const shelf = $('#shelf'), bays = $('#bays'), lamp = $('#lamp');
    bays.addEventListener('pointerover', (e) => {
      if (e.pointerType === 'touch') return;
      const o = e.target.closest('.obj');
      if (o && !o.contains(e.relatedTarget)) pull(o, true);
    });
    bays.addEventListener('pointerout', (e) => {
      const o = e.target.closest('.obj');
      if (o && !o.contains(e.relatedTarget)) pull(o, false);
    });
    bays.addEventListener('focusin', (e) => {
      const o = e.target.closest('.obj');
      if (o) pull(o, true);
    });
    bays.addEventListener('focusout', (e) => {
      const o = e.target.closest('.obj');
      if (o) pull(o, false);
    });

    // A warm lamp that follows the pointer behind the shelf. Moves by transform only.
    if (!S.fine || S.reduced) return;
    let lx = 0, ly = 0, tx = 0, ty = 0, running = false, off = 0;
    const step = () => {
      lx += (tx - lx) * 0.12;
      ly += (ty - ly) * 0.12;
      lamp.style.transform = `translate3d(${lx.toFixed(1)}px,${ly.toFixed(1)}px,0)`;
    };
    shelf.addEventListener('pointermove', (e) => {
      const r = shelf.getBoundingClientRect();
      tx = e.clientX - r.left;
      ty = e.clientY - r.top;
      clearTimeout(off);
      if (!running) {
        running = true;
        lx = tx;
        ly = ty;
        gsap.ticker.add(step);
      }
      shelf.classList.add('lit');
    }, { passive: true });
    shelf.addEventListener('pointerleave', () => {
      shelf.classList.remove('lit');
      off = setTimeout(() => {
        running = false;
        gsap.ticker.remove(step);
      }, 700);
    });
  }

  /* ---------------- reveal on first scroll ---------------- */
  function initReveal() {
    if (S.reduced) { revealed = true; return; }
    if (Q.view === 'wall') {
      // IntersectionObserver + CSS transitions: no scroll listeners, and the fade runs on the compositor.
      const wall = $('#wall');
      wall.classList.add('pre');
      io = new IntersectionObserver((entries) => {
        let n = 0;
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.style.setProperty('--rd', (n++ * 0.07).toFixed(2) + 's');
          e.target.classList.add('in');
          io.unobserve(e.target);
        });
      }, { rootMargin: '0px 0px -6% 0px' });
      $$('.card', wall).forEach((c) => io.observe(c));
    } else {
      const objs = $$('#bays .obj, #bays .divider, #bays .cat-wrap, #bays .bookend, #bays .board');
      gsap.set(objs, { opacity: 0 });
      batch = [ScrollTrigger.create({ trigger: '#shelf', start: 'top 85%', once: true, onEnter: () => { gsap.set(objs, { clearProps: 'opacity' }); shelfIn(); } })];
    }
  }
  function revealAll() {
    if (revealed) return;
    revealed = true;
    batch.forEach((t) => t.kill());
    batch = [];
    if (io) io.disconnect();
    $('#wall').classList.remove('pre');
    const els = $$('#wall .card, #bays .obj, #bays .divider, #bays .cat-wrap, #bays .bookend, #bays .board');
    gsap.killTweensOf(els);
    gsap.set(els, { clearProps: 'opacity,transform' });
  }
  C.revealAll = revealAll;

  let refreshT = 0;
  function refreshSoon() {
    clearTimeout(refreshT);
    refreshT = setTimeout(() => ScrollTrigger.refresh(), 380);
  }

  /* ---------------- render ---------------- */
  C.render = (opt) => {
    opt = opt || {};
    if (opt.animate) revealAll();
    const list = C.list();
    paintCounts();
    paintSub(list);
    if (Q.view === 'wall') {
      $('#shelf').hidden = true;
      renderWall(list, opt);
    } else {
      $('#wall').hidden = true;
      renderShelf(list, opt);
    }
    paintEmpty(!list.length);
  };

  C.flash = (id) => {
    const el = Q.view === 'wall' ? cards.get(id) : $(`#bays .obj[data-id="${CSS.escape(id)}"]`);
    if (!el) return;
    S.scrollTo(el, { offset: -innerHeight * 0.32, duration: 1.2 });
    el.classList.remove('is-new');
    void el.offsetWidth;
    el.classList.add('is-new');
    setTimeout(() => el.classList.remove('is-new'), 2400);
  };

  C.init = () => {
    buildTabs();
    wireSort();
    wireSearch();
    $('#view-seg').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-view]');
      if (b) C.setView(b.dataset.view);
    });
    wireWall();
    wireShelf();
    document.body.dataset.cat = Q.cat;
    C.render({});
    S.on('change', () => C.render({ animate: true }));
    window.addEventListener('resize', S.debounce(() => {
      tabInk(true);
      segInk(true);
      if (Q.view === 'shelf' && Math.abs(($('#bays').clientWidth || 0) - shelfW) > 8) renderShelf(C.list(), {});
    }, 140));
  };
  const placeholder = () => ($('#search').placeholder = innerWidth < 720 ? 'Search' : 'Search the shelf');
  window.addEventListener('resize', S.debounce(placeholder, 200));
  placeholder();

  C.afterLoad = () => {
    tabInk(true);
    segInk(true);
    initReveal();
  };
})();
