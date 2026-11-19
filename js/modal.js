/* Sifar's Shelf | modal: detail sheet with a shared-element cover flight */
(function () {
  'use strict';
  const S = window.S, $ = S.$, $$ = S.$$;
  const M = (S.modal = { isOpen: false, item: null, list: [], src: null });
  let root, sheet, body, tilt, img, gen, backdrop, wash, lastFocus, onClose, busy = false;

  const OPEN_SEL = '.card-btn, .obj[data-id], .niche, .now-card, .rc';

  /* ---------------- content ---------------- */
  function facts(it) {
    const T = S.TYPES[it.type];
    const f = [];
    const date = it.status === 'current' ? null : S.fmtDate(it.finished);
    if (it.status === 'current') f.push(['Status', `${T.now} now`]);
    else f.push([T.date, date || 'Not dated']);
    if (it.type === 'book') {
      if (it.pages) f.push(['Pages', S.fmtNum(it.pages)]);
      if (it.year) f.push(['Published', it.year]);
    } else if (it.type === 'game') {
      if (it.platform) f.push(['Platform', S.esc(it.platform)]);
      if (it.hours) f.push(['Played', `${S.fmtNum(it.hours)} hours`]);
      if (it.year) f.push(['Released', it.year]);
    } else if (it.type === 'movie') {
      if (it.runtime) f.push(['Runtime', S.fmtRuntime(it.runtime)]);
      if (it.year) f.push(['Released', it.year]);
    } else {
      if (it.seasons) f.push(['Seasons', it.seasons]);
      if (it.episodes) f.push(['Episodes', it.episodes]);
      if (it.year) f.push(['Premiered', it.year]);
    }
    return f;
  }

  function bodyHTML(it) {
    const T = S.TYPES[it.type];
    const i = M.list.findIndex((x) => x.id === it.id);
    const p = S.clamp(+it.progress || 0, 0, 100);
    const cur = document.body.classList.contains('curating');
    return `
      <div class="m-chips">
        <span class="chip chip--type">${S.icon(T.icon)}${T.label}</span>
        <span class="chip">${it.status === 'current' ? T.now : T.done}</span>
        ${it.fav ? `<span class="chip chip--fav">${S.icon('heartFill')}Favourite</span>` : ''}
        ${it.sample ? '<span class="chip chip--sample">Sample entry</span>' : ''}
      </div>
      <h2 class="m-title" id="m-title">${S.esc(it.title)}</h2>
      ${it.by ? `<p class="m-by"><span>${T.by}</span> ${S.esc(it.by)}</p>` : ''}
      <div class="m-rating">${it.rating ? `${S.stars(it.rating, 22)}<span class="m-rnum">${it.rating}<small>/5</small></span>` : `<span class="m-unrated">${it.status === 'current' ? 'Rating once I finish' : 'Not rated yet'}</span>`}</div>
      ${it.status === 'current' ? `<div class="m-progress"><div class="bar"><i style="transform:scaleX(${p / 100})"></i></div><p><span>${S.esc(it.progressNote || 'In progress')}</span><span>${p}%</span></p></div>` : ''}
      <dl class="m-facts">${facts(it).map(([k, v]) => `<div class="m-fact"><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
      ${it.notes ? `<div class="m-notes"><p class="m-label">My thoughts</p><p class="m-text">${S.esc(it.notes)}</p></div>` : ''}
      ${it.genres && it.genres.length ? `<div class="m-genres">${it.genres.map((g) => `<span class="tag">${S.esc(g)}</span>`).join('')}</div>` : ''}
      <div class="m-actions">
        <div class="m-nav">
          <button class="icon-btn" type="button" data-step="-1" aria-label="Previous">${S.icon('arrowLeft')}</button>
          <span class="m-pos">${i + 1} / ${M.list.length}</span>
          <button class="icon-btn" type="button" data-step="1" aria-label="Next">${S.icon('arrowRight')}</button>
        </div>
        ${cur ? `<div class="m-cur">
          <button class="btn btn-ghost btn-sm" type="button" data-act="edit">${S.icon('edit')}<span>Edit</span></button>
          <button class="btn btn-ghost btn-sm btn-danger" type="button" data-act="delete">${S.icon('trash')}<span>Delete</span></button>
        </div>` : ''}
      </div>`;
  }

  function fillCover(it) {
    const c = S.itemColor(it);
    root.style.setProperty('--mc', c);
    root.style.setProperty('--tc', `var(--${it.type})`);
    tilt.classList.toggle('no-img', !it.cover);
    gen.innerHTML = S.coverHTML(Object.assign({}, it, { cover: '' }));
    gen.hidden = false;
    if (it.cover) {
      img.classList.remove('ok', 'err');
      img.alt = `Cover of ${it.title}`;
      img.onload = () => img.classList.add('ok');
      img.onerror = () => tilt.classList.add('no-img');
      img.src = it.cover;
      if (img.complete && img.naturalWidth) img.classList.add('ok');
    } else {
      img.removeAttribute('src');
      img.alt = '';
    }
  }

  function fill(it) {
    M.item = it;
    fillCover(it);
    body.innerHTML = bodyHTML(it);
  }

  /* ---------------- flight ---------------- */
  function flyer(it, rect) {
    const f = document.createElement('div');
    f.className = 'flyer cov' + (it.cover ? '' : ' no-img');
    f.innerHTML = S.coverHTML(it, { eager: true });
    f.style.width = rect.width + 'px';
    f.style.height = rect.height + 'px';
    document.body.appendChild(f);
    S.wireImgs(f);
    return f;
  }
  function fly(it, from, to, opt) {
    const f = flyer(it, to);
    const sx = from.width / to.width, sy = from.height / to.height;
    return gsap.fromTo(f,
      { x: from.left, y: from.top, scaleX: sx, scaleY: sy, opacity: opt.fromOpacity == null ? 1 : opt.fromOpacity },
      { x: to.left, y: to.top, scaleX: 1, scaleY: 1, opacity: 1, duration: opt.duration, ease: opt.ease, onComplete: () => { f.remove(); opt.done && opt.done(); } }
    );
  }

  /* ---------------- open / close ---------------- */
  M.show = (id, src, opt) => {
    const it = S.store.get(id);
    if (!it || busy) return;
    opt = opt || {};
    onClose = opt.onClose || null;
    const inList = S.collection.list();
    M.list = inList.some((x) => x.id === id) ? inList : S.sortItems(S.store.items, 'recent');
    M.src = src || null;
    lastFocus = document.activeElement;
    fill(it);
    root.hidden = false;
    $('.modal-scroll', root).scrollTop = 0;
    M.isOpen = true;
    document.documentElement.classList.add('has-overlay');
    if (S.lenis) S.lenis.stop();
    S.sfx.pop();

    const to = tilt.getBoundingClientRect();
    const from = src && src.getBoundingClientRect ? src.getBoundingClientRect() : null;
    const tl = gsap.timeline();
    tl.fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: 0.55, ease: 'power2.out' }, 0)
      .fromTo(wash, { opacity: 0 }, { opacity: 1, duration: 1.1, ease: 'power2.out' }, 0)
      .fromTo(sheet, { opacity: 0, y: 34 }, { opacity: 1, y: 0, duration: 0.8, ease: 'expo.out', clearProps: 'transform' }, 0.04)
      .fromTo(body.children, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.9, ease: 'expo.out', stagger: 0.04, clearProps: 'transform,opacity' }, 0.12);
    if (!S.reduced && S.inView(from)) {
      busy = true;
      tilt.style.opacity = '0';
      src.style.visibility = 'hidden';
      fly(it, from, to, {
        duration: 0.85, ease: 'expo.out',
        done: () => {
          tilt.style.opacity = '';
          src.style.visibility = '';
          busy = false;
        },
      });
    } else {
      tl.fromTo($('.m-cover', root), { opacity: 0, scale: 0.94 }, { opacity: 1, scale: 1, duration: 0.9, ease: 'expo.out', clearProps: 'transform,opacity' }, 0.08);
    }
    setTimeout(() => {
      const c = $('[data-close-btn]', root);
      if (c) c.focus({ preventScroll: true });
    }, 60);
  };

  M.close = (opt) => {
    if (!M.isOpen || busy) return;
    opt = opt || {};
    M.isOpen = false;
    S.sfx.close();
    const src = M.src && document.contains(M.src) && M.src.offsetParent !== null ? M.src : null;
    const from = tilt.getBoundingClientRect();
    const to = src && !opt.noFlight ? src.getBoundingClientRect() : null;
    const done = () => {
      root.hidden = true;
      gsap.set([sheet, backdrop, wash, tilt], { clearProps: 'all' });
      document.documentElement.classList.remove('has-overlay');
      if (S.lenis) S.lenis.start();
      if (lastFocus && document.contains(lastFocus) && !opt.noFocus) lastFocus.focus({ preventScroll: true });
      const cb = onClose;
      onClose = null;
      if (cb) cb();
    };
    const tl = gsap.timeline({ onComplete: done });
    tl.to(body.children, { opacity: 0, y: 10, duration: 0.22, ease: 'power2.in', stagger: 0.015 }, 0)
      .to(sheet, { opacity: 0, y: 24, duration: 0.42, ease: 'power3.inOut' }, 0.06)
      .to([backdrop, wash], { opacity: 0, duration: 0.5, ease: 'power2.inOut' }, 0.1);
    if (!S.reduced && src && S.inView(to) && M.item && M.item.id === (src.closest('[data-id]') || src).dataset.id) {
      tilt.style.opacity = '0';
      src.style.visibility = 'hidden';
      busy = true;
      fly(M.item, from, to, {
        duration: 0.7, ease: 'expo.inOut',
        done: () => {
          src.style.visibility = '';
          busy = false;
        },
      });
    }
  };

  M.step = (d) => {
    if (!M.isOpen || busy || M.list.length < 2) return;
    const i = M.list.findIndex((x) => x.id === M.item.id);
    const next = M.list[(i + d + M.list.length) % M.list.length];
    const q = CSS.escape(next.id);
    M.src = document.querySelector(`#wall .card[data-id="${q}"] .card-art`) || document.querySelector(`#bays .obj[data-id="${q}"] .obj-spine`) || null;
    S.sfx.swap();
    busy = true;
    const tl = gsap.timeline({ onComplete: () => (busy = false) });
    tl.to(body.children, { opacity: 0, x: -14 * d, duration: 0.2, ease: 'power2.in', stagger: 0.01 }, 0)
      .to($('.m-cover', root), { opacity: 0, x: -24 * d, rotationY: -12 * d, transformPerspective: 900, duration: 0.24, ease: 'power2.in' }, 0)
      .add(() => fill(next))
      .fromTo($('.m-cover', root), { opacity: 0, x: 24 * d, rotationY: 12 * d }, { opacity: 1, x: 0, rotationY: 0, duration: 0.7, ease: 'expo.out', clearProps: 'transform,opacity' })
      .fromTo(body.children, { opacity: 0, x: 16 * d }, { opacity: 1, x: 0, duration: 0.7, ease: 'expo.out', stagger: 0.03, clearProps: 'transform,opacity' }, '<0.04');
  };

  /* ---------------- wiring ---------------- */
  function trap(e) {
    if (e.key !== 'Tab') return;
    const f = $$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', sheet).filter((x) => !x.disabled && x.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  M.init = () => {
    root = $('#modal');
    sheet = $('.sheet', root);
    body = $('#m-body');
    tilt = $('#m-tilt');
    img = $('#m-img');
    gen = $('#m-gen');
    backdrop = $('.modal-backdrop', root);
    wash = $('.modal-wash', root);

    // Open from anywhere: cards, shelf objects, niches, now cards, ring cards.
    document.addEventListener('click', (e) => {
      const t = e.target.closest('.niche') || e.target.closest(OPEN_SEL);
      if (!t || root.contains(t) || t.closest('.ed')) return;
      const host = t.closest('[data-id]');
      if (!host) return;
      if (t.classList.contains('rc') && S.hero && S.hero.busy) return;
      const src = t.querySelector('.card-art, .obj-cover, .rc-front, .now-cover') || t;
      const pulled = t.classList.contains('obj') && t.classList.contains('is-out');
      M.show(host.dataset.id, t.classList.contains('obj') && !pulled ? t.querySelector('.obj-spine') : src);
    });

    root.addEventListener('click', (e) => {
      if (e.target.closest('[data-close-btn]')) return M.close();
      const step = e.target.closest('[data-step]');
      if (step) return M.step(+step.dataset.step);
      const act = e.target.closest('[data-act]');
      if (act && act.dataset.act === 'edit') {
        const it = M.item;
        M.close({ noFlight: true, noFocus: true });
        setTimeout(() => S.curator.edit(it.id), 260);
        return;
      }
      if (act && act.dataset.act === 'delete') {
        if (!act.classList.contains('is-armed')) {
          act.classList.add('is-armed');
          act.querySelector('span').textContent = 'Tap again to delete';
          setTimeout(() => {
            if (!act.isConnected) return;
            act.classList.remove('is-armed');
            act.querySelector('span').textContent = 'Delete';
          }, 3000);
          return;
        }
        const it = M.item;
        M.close({ noFlight: true });
        setTimeout(() => {
          S.store.remove(it.id);
          S.toast(`Removed ${it.title}`, 'trash');
        }, 380);
        return;
      }
      if (!e.target.closest('.sheet')) M.close();
    });

    document.addEventListener('keydown', (e) => {
      if (!M.isOpen) return;
      if (e.key === 'Escape') M.close();
      else if (e.key === 'ArrowRight') M.step(1);
      else if (e.key === 'ArrowLeft') M.step(-1);
      else trap(e);
    });

    if (S.fine && !S.reduced) {
      const cover = $('.m-cover', root);
      cover.addEventListener('pointermove', (e) => S.tiltFromEvent(tilt, e, { max: 10, persp: 1000 }), { passive: true });
      cover.addEventListener('pointerleave', () => S.tiltTo(tilt, 0, 0));
    }
    S.on('change', (ev) => {
      if (M.isOpen && ev && ev.id && M.item && ev.id === M.item.id) {
        const it = S.store.get(ev.id);
        if (it) fill(it);
      }
    });
  };
})();
