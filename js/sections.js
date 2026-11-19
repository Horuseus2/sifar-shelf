/* Sifar's Shelf | sections: right now, display case, numbers */
(function () {
  'use strict';
  const S = window.S, $ = S.$, $$ = S.$$;
  const X = (S.sections = {});
  let shown = { now: false, stats: false };

  /* ---------------- right now ---------------- */
  function renderNow() {
    const list = S.store.items.filter((i) => i.status === 'current');
    const sec = $('#now');
    sec.hidden = !list.length;
    $$('[data-nav="now"]').forEach((a) => (a.hidden = !list.length));
    $('#now-list').innerHTML = list
      .map((it) => {
        const T = S.TYPES[it.type];
        const p = S.clamp(+it.progress || 0, 0, 100);
        return `<button class="now-card" type="button" data-id="${S.esc(it.id)}" style="--c:${S.itemColor(it)};--tc:var(--${it.type})" aria-label="Open ${S.esc(it.title)}">
          <span class="now-cover cov${it.cover ? '' : ' no-img'}">${S.coverHTML(it)}</span>
          <span class="now-body">
            <span class="now-type"><span class="tdot"></span>${T.now}</span>
            <span class="now-title">${S.esc(it.title)}</span>
            <span class="now-by">${S.esc(it.by || '')}</span>
            <span class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p}"><i style="--p:${p / 100}"></i></span>
            <span class="now-meta"><span>${S.esc(it.progressNote || 'In progress')}</span><span>${p}%</span></span>
          </span>
        </button>`;
      })
      .join('');
    S.wireImgs($('#now-list'));
    const bars = $$('#now-list .bar i');
    if (shown.now || S.reduced) bars.forEach((b) => (b.style.transform = `scaleX(${b.style.getPropertyValue('--p')})`));
  }

  /* ---------------- display case ---------------- */
  function renderCase() {
    const favs = S.store.items
      .filter((i) => i.fav)
      .sort((a, b) => S.ORDER.indexOf(a.type) - S.ORDER.indexOf(b.type) || (b.rating || 0) - (a.rating || 0))
      .slice(0, 10);
    const sec = $('#favourites');
    sec.hidden = !favs.length;
    $$('[data-nav="favourites"]').forEach((a) => (a.hidden = !favs.length));
    const s = innerWidth < 600 ? 0.74 : 0.92;
    $('#case').innerHTML = favs
      .map((it, i) => {
        const T = S.TYPES[it.type];
        return `<button class="niche" type="button" data-id="${S.esc(it.id)}" style="--c:${S.itemColor(it)};--tc:var(--${it.type});--delay:${(-i * 1.37).toFixed(2)}s" aria-label="Open ${S.esc(it.title)}">
          <span class="niche-light" aria-hidden="true"></span>
          <span class="stage3d"><span class="turn">${S.objHTML(it, s, { static: true })}</span><span class="pedestal"></span></span>
          <span class="plaque">
            <span class="plaque-t">${S.esc(it.title)}</span>
            <span class="plaque-s"><span class="tdot"></span>${T.label}${it.rating ? ' · ' + it.rating + '/5' : ''}</span>
          </span>
        </button>`;
      })
      .join('');
    S.wireImgs($('#case'));
  }

  /* ---------------- numbers ---------------- */
  function stats() {
    const it = S.store.items;
    const sum = (arr, k) => arr.reduce((a, x) => a + (+x[k] || 0), 0);
    const done = it.filter((i) => i.status !== 'current');
    const rated = it.filter((i) => i.rating);
    const genres = new Set();
    it.forEach((i) => (i.genres || []).forEach((g) => genres.add(g.toLowerCase())));
    return [
      { n: it.length, l: 'Things on the shelf', icon: 'layers', c: 'var(--text)' },
      { n: sum(done.filter((i) => i.type === 'book'), 'pages'), l: 'Pages read', icon: 'book', c: 'var(--book)' },
      { n: sum(it.filter((i) => i.type === 'game'), 'hours'), l: 'Hours played', icon: 'game', c: 'var(--game)' },
      { n: Math.round(sum(done.filter((i) => i.type === 'movie'), 'runtime') / 60), l: 'Hours of film', icon: 'film', c: 'var(--movie)' },
      { n: sum(done.filter((i) => i.type === 'series'), 'episodes'), l: 'Episodes watched', icon: 'tv', c: 'var(--series)' },
      { n: rated.length ? sum(rated, 'rating') / rated.length : 0, dec: 1, l: 'Average rating', icon: 'star', c: '#f6c453' },
      { n: it.filter((i) => i.fav).length, l: 'All time favourites', icon: 'heart', c: '#ff8fa3' },
      { n: genres.size, l: 'Genres explored', icon: 'tag', c: 'var(--text)' },
    ];
  }
  function renderStats() {
    const wrap = $('#stats');
    const data = stats();
    if (!wrap.children.length) {
      wrap.innerHTML = data
        .map((d) => `<div class="stat" style="--c:${d.c}">
          <span class="stat-ico">${S.icon(d.icon)}</span>
          <span class="stat-n" data-dec="${d.dec || 0}">0</span>
          <span class="stat-l">${d.l}</span>
        </div>`)
        .join('');
    }
    $$('.stat', wrap).forEach((el, i) => {
      const n = el.querySelector('.stat-n');
      n.dataset.to = data[i].n;
      if (shown.stats) countTo(n, 0.9);
    });
  }
  function countTo(el, dur, delay) {
    const to = +el.dataset.to || 0, dec = +el.dataset.dec || 0;
    const from = +el.dataset.cur || 0;
    const o = { v: from };
    gsap.to(o, {
      v: to, duration: S.reduced ? 0.01 : dur, delay: delay || 0, ease: 'expo.out', overwrite: true,
      onUpdate: () => (el.textContent = S.fmtNum(o.v, dec)),
      onComplete: () => (el.dataset.cur = to),
    });
  }

  X.render = () => {
    renderNow();
    renderCase();
    renderStats();
  };

  X.init = () => {
    X.render();
    S.on('change', () => {
      X.render();
      ScrollTrigger.refresh();
    });
    // Rotating objects only run while the case is on screen.
    const io = new IntersectionObserver((es) => es.forEach((e) => $('#case').classList.toggle('is-paused', !e.isIntersecting)), { rootMargin: '80px' });
    io.observe($('#case'));
    $('#case').classList.add('is-paused');
    // Tilt the display niches a touch.
    if (S.fine && !S.reduced) {
      $('#case').addEventListener('pointerover', (e) => {
        const n = e.target.closest('.niche');
        if (n && !n.contains(e.relatedTarget)) S.sfx.tick();
      });
    }
  };

  X.afterLoad = () => {
    // Progress bars fill when they arrive.
    ScrollTrigger.create({
      trigger: '#now-list', start: 'top 85%', once: true,
      onEnter: () => {
        shown.now = true;
        $$('#now-list .bar i').forEach((b, i) =>
          gsap.fromTo(b, { scaleX: 0 }, { scaleX: +b.style.getPropertyValue('--p') || 0, duration: 1.6, delay: 0.25 + i * 0.12, ease: 'expo.out' })
        );
        gsap.fromTo('#now-list .now-card', { opacity: 0, y: 34 }, { opacity: 1, y: 0, duration: 1.1, stagger: 0.1, ease: 'expo.out', clearProps: 'transform,opacity' });
      },
    });
    ScrollTrigger.create({
      trigger: '#case', start: 'top 85%', once: true,
      onEnter: () => gsap.fromTo('#case .niche', { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 1.2, stagger: 0.07, ease: 'expo.out', clearProps: 'transform,opacity' }),
    });
    ScrollTrigger.create({
      trigger: '#stats', start: 'top 85%', once: true,
      onEnter: () => {
        shown.stats = true;
        gsap.fromTo('#stats .stat', { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 1.1, stagger: 0.06, ease: 'expo.out', clearProps: 'transform,opacity' });
        $$('#stats .stat-n').forEach((n, i) => countTo(n, 2.2, 0.15 + i * 0.06));
      },
    });
    if (!S.reduced) {
      gsap.set('#now-list .now-card, #case .niche, #stats .stat', { opacity: 0 });
    }
  };
})();
