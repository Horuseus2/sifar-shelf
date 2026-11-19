/* Sifar's Shelf | hero: loader, 3D cover ring, surprise pick, intro */
(function () {
  'use strict';
  const S = window.S, $ = S.$, $$ = S.$$;
  const H = (S.hero = {});
  const PERIOD = 64000; // one full turn of the ring, in ms
  const DEG_MS = PERIOD / 360;

  /* ---------------- loader ---------------- */
  S.loader = {
    // Resolves once fonts and ring covers are ready and the minimum show time has passed.
    async ready() {
      const quick = (this.quick = S.ss.get('shelf-seen') === '1' || S.reduced);
      const minTime = quick ? 450 : 1700;
      const t0 = performance.now();
      const nEl = $('#loader-n');
      const obj = { v: 0 };
      gsap.to(obj, {
        v: S.store.items.length, duration: (minTime / 1000) * 0.85, ease: 'power2.out', delay: quick ? 0 : 0.35,
        onUpdate: () => (nEl.textContent = Math.round(obj.v)),
      });
      const fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
      const imgs = (H.imgs || []).map((img) => (img.decode ? img.decode().catch(() => {}) : Promise.resolve()));
      await Promise.race([Promise.all([fonts].concat(imgs)), S.wait(3800)]);
      this.left = minTime - (performance.now() - t0);
    },
    // Lifts the panels. Heavy setup should already be done so the intro starts on a quiet main thread.
    async exit() {
      const L = $('#loader');
      if (this.left > 0) await S.wait(this.left);
      S.ss.set('shelf-seen', '1');
      L.classList.add('is-out');
      document.body.classList.remove('is-loading');
      setTimeout(() => L.remove(), 1700);
      await S.wait(this.quick ? 60 : 130);
    },
  };

  /* ---------------- stats pills ---------------- */
  H.renderStats = () => {
    const wrap = $('#hero-stats');
    wrap.innerHTML = S.ORDER.map((t) => {
      const T = S.TYPES[t];
      const n = S.store.count(t);
      return `<a class="hstat" href="#collection" data-cat="${t}" style="--tc:var(--${t})">
        <span class="hstat-ico">${S.icon(T.icon)}</span>
        <span class="hstat-n" data-n="${n}">${n}</span>
        <span class="hstat-l">${n === 1 ? T.label : T.plural}</span>
      </a>`;
    }).join('');
  };

  /* ---------------- ring ---------------- */
  function pickRing() {
    const withCover = S.store.items.filter((i) => i.cover);
    const by = {};
    S.ORDER.forEach((t) => (by[t] = withCover.filter((i) => i.type === t).sort((a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0) || (b.rating || 0) - (a.rating || 0))));
    const out = [];
    let added = true;
    while (out.length < 10 && added) {
      added = false;
      for (const t of S.ORDER) {
        const next = by[t].shift();
        if (next && out.length < 10) { out.push(next); added = true; }
      }
    }
    if (!out.length) return out;
    while (out.length < 7) out.push(...out.slice(0, 7 - out.length));
    return out;
  }

  const cardHTML = (it, i, N) =>
    `<button class="rc" type="button" data-id="${S.esc(it.id)}" style="--a:${((i * 360) / N).toFixed(3)}deg;--c:${S.itemColor(it)}" aria-label="Open ${S.esc(it.title)}">
      <span class="rc-in">
        <span class="rc-front cov${it.cover ? '' : ' no-img'}">${S.coverHTML(it, { eager: true })}<span class="rc-sheen"></span></span>
        <span class="rc-back">${S.icon(S.TYPES[it.type].icon)}</span>
      </span>
    </button>`;

  H.buildRing = () => {
    const ring = $('#ring');
    const items = pickRing();
    H.items = items;
    H.N = items.length;
    $('.hero-visual').classList.toggle('is-empty', !H.N);
    ring.innerHTML = items.map((it, i) => cardHTML(it, i, H.N)).join('');
    S.wireImgs(ring);
    H.imgs = $$('img', ring);
    H.size();
    if (!H.spin && H.N) {
      H.spin = ring.animate([{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(-360deg)' }], { duration: PERIOD, iterations: Infinity });
      H.spin.currentTime = PERIOD * 0.02;
      if (S.reduced) H.spin.pause();
    }
  };

  H.size = () => {
    const stage = $('#ring-stage');
    if (!H.N) return;
    const W = stage.clientWidth || 500;
    let cw = S.clamp(W * 0.235, 86, 150);
    let R = (cw * 1.14) / (2 * Math.sin(Math.PI / H.N));
    const maxR = (W * 1.08 - cw * 0.5) / 2;
    if (R > maxR) {
      cw *= maxR / R;
      R = maxR;
    }
    const ch = cw * 1.5;
    stage.style.setProperty('--cw', cw.toFixed(1) + 'px');
    stage.style.setProperty('--ch', ch.toFixed(1) + 'px');
    stage.style.setProperty('--rad', R.toFixed(1) + 'px');
    stage.style.height = Math.round(ch * 1.5 + R * 0.42 + 30) + 'px';
  };

  // Front-facing card index for a given animation time.
  const mod = (a, n) => ((a % n) + n) % n;

  function wireRing() {
    const stage = $('#ring-stage');
    const tiltEl = $('#ring-tilt');
    let drag = null, vel = 0, inertia = null;
    let tx = 0, ty = 0, cx = 0.001, cy = 0, live = true;

    // Mouse tilt, eased on the GSAP ticker; one transform per frame.
    if (S.fine && !S.reduced) {
      window.addEventListener('pointermove', (e) => {
        tx = e.clientX / innerWidth - 0.5;
        ty = e.clientY / innerHeight - 0.5;
      }, { passive: true });
    }
    gsap.ticker.add(() => {
      if (!live) return;
      if (Math.abs(tx - cx) < 0.0004 && Math.abs(ty - cy) < 0.0004) return; // settled: no style writes
      cx += (tx - cx) * 0.06;
      cy += (ty - cy) * 0.06;
      tiltEl.style.transform = `rotateX(${(-9 + cy * 7).toFixed(2)}deg) rotateY(${(cx * 12).toFixed(2)}deg)`;
    });

    // Slow down while hovered, without a jump: tween the playback rate.
    const rate = (H.rate = { v: 1 });
    const setRate = (v, d) => {
      if (!H.spin || S.reduced) return;
      gsap.to(rate, { v, duration: d || 0.9, ease: 'power2.out', overwrite: true, onUpdate: () => H.spin.updatePlaybackRate(rate.v) });
    };
    H.setRate = setRate;
    if (S.fine) {
      stage.addEventListener('pointerenter', () => !H.busy && setRate(0.18));
      stage.addEventListener('pointerleave', () => !H.busy && !drag && setRate(1));
    }

    stage.addEventListener('pointerdown', (e) => {
      if (!H.spin || H.busy || (e.pointerType === 'mouse' && e.button !== 0)) return;
      if (inertia) inertia.kill();
      drag = { x: e.clientX, y: e.clientY, t0: H.spin.currentTime, last: e.clientX, lt: performance.now(), moved: false, id: e.pointerId };
      vel = 0;
    });
    stage.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x;
      if (!drag.moved) {
        if (Math.abs(dx) < 6) return;
        if (Math.abs(e.clientY - drag.y) > Math.abs(dx)) { drag = null; return; } // vertical swipe: let the page scroll
        drag.moved = true;
        stage.setPointerCapture(e.pointerId);
        stage.classList.add('is-dragging');
        H.spin.pause();
      }
      const now = performance.now();
      const dt = Math.max(1, now - drag.lt);
      vel = vel * 0.6 + ((e.clientX - drag.last) / dt) * 0.4;
      drag.last = e.clientX;
      drag.lt = now;
      H.spin.currentTime = mod(drag.t0 - dx * DEG_MS * 0.32, PERIOD);
    });
    const end = (e) => {
      if (!drag || (e && e.pointerId !== drag.id)) return;
      const moved = drag.moved;
      drag = null;
      stage.classList.remove('is-dragging');
      if (!moved) return;
      stage.classList.add('was-dragged');
      setTimeout(() => stage.classList.remove('was-dragged'), 60);
      const v = { v: vel * 16 }; // px per frame
      inertia = gsap.to(v, {
        v: 0, duration: 1.4, ease: 'power3.out',
        onUpdate: () => (H.spin.currentTime = mod(H.spin.currentTime - v.v * DEG_MS * 0.32, PERIOD)),
        onComplete: () => {
          if (!H.busy && !S.reduced) H.spin.play();
          if (!stage.matches(':hover')) setRate(1);
        },
      });
    };
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', end);
    // A drag must not also open a card.
    stage.addEventListener('click', (e) => {
      if (stage.classList.contains('was-dragged')) e.stopPropagation();
    }, true);

    // Pause everything when the hero is off screen.
    ScrollTrigger.create({
      trigger: '.hero', start: 'top bottom', end: 'bottom top',
      onToggle: (self) => {
        live = self.isActive;
        if (!H.spin || S.reduced || H.busy) return;
        self.isActive ? H.spin.play() : H.spin.pause();
      },
    });
  }

  /* ---------------- surprise me ---------------- */
  H.surprise = () => {
    if (H.busy || !H.N) return;
    const all = S.store.items;
    if (!all.length) return;
    const pick = all[Math.floor(Math.random() * all.length)];
    const N = H.N;
    const t0 = H.spin.currentTime;
    const front = Math.round(mod(t0, PERIOD) / (PERIOD / N)) % N;
    let idx = H.items.findIndex((x) => x.id === pick.id);
    if (idx < 0) {
      // Put the pick on a card that is facing away right now, then land on it.
      idx = (front + Math.floor(N / 2)) % N;
      const card = $$('.rc', $('#ring'))[idx];
      H.items[idx] = pick;
      const fresh = S.html(cardHTML(pick, idx, N));
      card.replaceWith(fresh);
      S.wireImgs(fresh);
    }
    H.busy = true;
    gsap.killTweensOf(H.rate);
    H.rate.v = 1;
    H.spin.updatePlaybackRate(1);
    H.spin.pause();
    const target = t0 + PERIOD * 1.5 + mod(idx * (PERIOD / N) - t0, PERIOD);
    const p = { t: t0 };
    let lastSlot = -1;
    gsap.to(p, {
      t: target, duration: S.reduced ? 0.01 : 2.6, ease: 'power4.inOut',
      onUpdate: () => {
        H.spin.currentTime = mod(p.t, PERIOD);
        const slot = Math.floor(mod(p.t, PERIOD) / (PERIOD / N));
        if (slot !== lastSlot) { lastSlot = slot; S.sfx.tick(); }
      },
      onComplete: () => {
        const card = $$('.rc', $('#ring'))[idx];
        card.classList.add('is-picked');
        S.sfx.chime();
        setTimeout(() => {
          S.modal.show(pick.id, card.querySelector('.rc-front'), {
            onClose: () => {
              card.classList.remove('is-picked');
              H.busy = false;
              if (!S.reduced) H.spin.play();
            },
          });
        }, 420);
      },
    });
  };

  /* ---------------- intro + scroll ---------------- */
  H.intro = () => {
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.fromTo('.nav > *', { opacity: 0, y: -16 }, { opacity: 1, y: 0, duration: 1.1, stagger: 0.07 }, 0.15)
      .fromTo('.eyebrow', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 1 }, 0.05)
      .to('.hero-title .ln > span', { yPercent: 0, duration: 1.35, stagger: 0.085 }, 0.05)
      .fromTo('.hero-lede', { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 1.2 }, 0.42)
      .fromTo('.hstat', { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 1.1, stagger: 0.07 }, 0.5)
      .fromTo('.hero-cta > *', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 1.1, stagger: 0.08 }, 0.6)
      .fromTo('#ring-stage', { opacity: 0, scale: 0.8, rotationX: 22, transformPerspective: 1200 }, { opacity: 1, scale: 1, rotationX: 0, duration: 2.1, ease: 'expo.out', clearProps: 'transform' }, 0.1)
      .fromTo('.ring-hint', { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 1 }, 1);
    $$('.hstat-n').forEach((el, i) => {
      const n = +el.dataset.n, o = { v: 0 };
      tl.to(o, { v: n, duration: 1.6, ease: 'expo.out', onUpdate: () => (el.textContent = Math.round(o.v)) }, 0.6 + i * 0.07);
    });

  };

  // Leaving the hero: copy drifts up, ring sinks back. Transforms and opacity only.
  H.scrollFx = () => {
    if (!S.reduced) {
      gsap.to('.hero-copy', { yPercent: -10, opacity: 0.25, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
      gsap.to('.hero-visual', { yPercent: 14, scale: 0.9, opacity: 0.2, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    }
  };

  H.init = () => {
    if (!S.fine) $('.hero-lede').textContent = 'A living shelf of the books, games, films and shows that stayed with me. Tap anything to see what I thought.';
    H.renderStats();
    H.buildRing();
    wireRing();
    window.addEventListener('resize', S.debounce(H.size, 120));
    $('#surprise').addEventListener('click', H.surprise);
    $('#hero-stats').addEventListener('click', (e) => {
      const a = e.target.closest('.hstat');
      if (!a) return;
      e.preventDefault();
      e.stopPropagation();
      S.collection.setCat(a.dataset.cat);
      S.scrollTo('#collection');
    });
    S.on('change', () => {
      H.renderStats();
      $$('.hstat').forEach((a) => gsap.set(a, { opacity: 1, y: 0 }));
      if (!H.busy) {
        const before = H.items.map((i) => i.id).join();
        const after = pickRing().map((i) => i.id).join();
        if (before !== after) H.buildRing();
      }
    });
  };
})();
