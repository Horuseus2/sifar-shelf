/* Sifar's Shelf | core: namespace, helpers, icons, colour, sound, motion */
(function () {
  'use strict';
  const S = (window.S = window.S || {});

  S.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  S.fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------- tiny helpers ---------- */
  S.$ = (sel, root) => (root || document).querySelector(sel);
  S.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  S.clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  S.lerp = (a, b, t) => a + (b - a) * t;
  S.wait = (ms) => new Promise((r) => setTimeout(r, ms));
  S.esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  S.hash = (str) => {
    let h = 2166136261;
    str = String(str || '');
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };
  S.rand01 = (str) => (S.hash(str) % 10007) / 10007;
  S.html = (str) => {
    const t = document.createElement('template');
    t.innerHTML = str.trim();
    return t.content.firstElementChild;
  };
  S.debounce = (fn, ms) => {
    let t;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...a), ms);
    };
  };
  S.inView = (r) => r && r.width > 2 && r.height > 2 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;

  /* ---------- tiny event bus ---------- */
  const bus = {};
  S.on = (n, f) => (bus[n] = bus[n] || []).push(f);
  S.emit = (n, d) => (bus[n] || []).forEach((f) => f(d));

  /* ---------- storage that never throws ---------- */
  S.ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  };
  S.ss = {
    get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} },
  };

  /* ---------- types ---------- */
  S.TYPES = {
    book: { key: 'book', label: 'Book', plural: 'Books', icon: 'book', now: 'Reading', done: 'Read', by: 'Author', date: 'Finished', bay: 'Books' },
    game: { key: 'game', label: 'Game', plural: 'Games', icon: 'game', now: 'Playing', done: 'Played', by: 'Studio', date: 'Finished', bay: 'Games' },
    movie: { key: 'movie', label: 'Movie', plural: 'Movies', icon: 'film', now: 'Watching', done: 'Watched', by: 'Director', date: 'Watched', bay: 'Movies' },
    series: { key: 'series', label: 'Series', plural: 'Series', icon: 'tv', now: 'Watching', done: 'Watched', by: 'Network', date: 'Finished', bay: 'Series' },
  };
  S.ORDER = ['book', 'game', 'movie', 'series'];

  /* ---------- icons (24px line set) ---------- */
  const P = {
    book: '<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v14H6.5A1.5 1.5 0 0 0 5 18.5z"/><path d="M5 18.5A1.5 1.5 0 0 0 6.5 20H19"/><path d="M9 7.5h6"/>',
    game: '<path d="M7.2 8h9.6a4.2 4.2 0 0 1 4.2 4.2v1.3a3.5 3.5 0 0 1-6.3 2.1L13.6 14h-3.2l-1.1 1.6A3.5 3.5 0 0 1 3 13.5v-1.3A4.2 4.2 0 0 1 7.2 8z"/><path d="M7.5 10.5v3.2M5.9 12.1h3.2"/><circle cx="15.8" cy="11.2" r=".9" fill="currentColor" stroke="none"/><circle cx="17.6" cy="13.1" r=".9" fill="currentColor" stroke="none"/>',
    film: '<rect x="3.5" y="9" width="17" height="11" rx="2"/><path d="M3.6 9l.9-3.4a1.5 1.5 0 0 1 1.8-1l13 3.4"/><path d="M8.2 5.2l2.3 3.3M13.2 6.5l2.3 3.3"/>',
    tv: '<rect x="3" y="6.5" width="18" height="12" rx="2.5"/><path d="M8.5 21h7M9 3l3 3.2L15 3"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.3-4.3"/>',
    sort: '<path d="M4 7h10M4 12h7M4 17h4M17 6v12M14 15l3 3 3-3"/>',
    chev: '<path d="M6 9.5l6 6 6-6"/>',
    grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6"/>',
    shelf: '<path d="M3 20h18"/><rect x="5" y="7" width="3" height="13" rx=".8"/><rect x="9.2" y="5" width="3.4" height="15" rx=".8"/><path d="M14.4 8.7l2.9-.8 3 11.3-2.9.8z"/>',
    shuffle: '<path d="M16 4h4v4M4 20L20 4M20 16v4h-4M15 15l5 5M4 4l5 5"/>',
    arrowDown: '<path d="M12 5v14M6.5 13.5L12 19l5.5-5.5"/>',
    arrowUp: '<path d="M12 19V5M6.5 10.5L12 5l5.5 5.5"/>',
    arrowLeft: '<path d="M19 12H5M10.5 6.5L5 12l5.5 5.5"/>',
    arrowRight: '<path d="M5 12h14M13.5 6.5L19 12l-5.5 5.5"/>',
    close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
    unlock: '<rect x="5" y="10.5" width="14" height="10" rx="2.2"/><path d="M8 10.5V7.5a4 4 0 0 1 7.7-1.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    save: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    upload: '<path d="M12 16V5M7 10l5-5 5 5M5 20h14"/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.2a4.2 4.2 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/>',
    heartFill: '<path fill="currentColor" d="M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.2a4.2 4.2 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/>',
    star: '<path fill="currentColor" stroke="none" d="M12 3.4l2.6 5.4 5.9.8-4.3 4.2 1 5.9L12 17l-5.2 2.7 1-5.9-4.3-4.2 5.9-.8z"/>',
    soundOn: '<path d="M4 9.5v5h3.5L13 19V5L7.5 9.5z"/><path d="M16.5 9a4.2 4.2 0 0 1 0 6M19 6.5a7.8 7.8 0 0 1 0 11"/>',
    soundOff: '<path d="M4 9.5v5h3.5L13 19V5L7.5 9.5z"/><path d="M16.8 9.7l4.4 4.6M21.2 9.7l-4.4 4.6"/>',
    drag: '<path d="M7 12h10M6 8.5L2.5 12 6 15.5M18 8.5l3.5 3.5-3.5 3.5"/>',
    globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.5 3.5 5.3 3.5 8.5s-1.1 6-3.5 8.5c-2.4-2.5-3.5-5.3-3.5-8.5s1.1-6 3.5-8.5z"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    more: '<circle cx="6" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="1.3" fill="currentColor" stroke="none"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    calendar: '<rect x="4" y="5" width="16" height="15" rx="2.2"/><path d="M4 10h16M8.5 3v4M15.5 3v4"/>',
    layers: '<path d="M12 3.5l8.5 4.7-8.5 4.7-8.5-4.7z"/><path d="M3.5 12.6l8.5 4.7 8.5-4.7"/><path d="M3.5 16.6l8.5 4.7 8.5-4.7"/>',
    tag: '<path d="M3.5 12.6V4.5a1 1 0 0 1 1-1h8.1l8 8a1.5 1.5 0 0 1 0 2.1l-6 6a1.5 1.5 0 0 1-2.1 0z"/><circle cx="8" cy="8" r="1.4"/>',
    image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.2"/><circle cx="9" cy="10" r="1.7"/><path d="M20.5 16l-5-5-9.5 8.5"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    sparkle: '<path d="M12 3.5l1.9 5.3 5.6 1.7-5.6 1.7L12 17.5l-1.9-5.3-5.6-1.7 5.6-1.7z"/><path d="M19 16v4M17 18h4"/>',
    file: '<path d="M6 3.5h8l4 4v13H6z"/><path d="M14 3.5v4h4M9 13h6M9 16.5h6"/>',
  };
  S.icon = (name, cls) => `<svg class="ico${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${P[name] || ''}</svg>`;
  S.hydrateIcons = (root) =>
    S.$$('i[data-icon]', root).forEach((i) => {
      const cls = i.className;
      i.outerHTML = S.icon(i.dataset.icon, cls);
    });

  /* ---------- colour ---------- */
  S.rgb = (hex) => {
    let h = String(hex || '').trim().replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16);
    if (h.length !== 6 || isNaN(n)) return [110, 110, 124];
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  S.toHex = (rgb) => '#' + rgb.map((v) => S.clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  S.mix = (a, b, t) => {
    const A = S.rgb(a), B = S.rgb(b);
    return S.toHex(A.map((v, i) => v + (B[i] - v) * t));
  };
  S.lum = (hex) => {
    const c = S.rgb(hex).map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  S.ink = (hex) => (S.lum(hex) > 0.2 ? '#18181e' : '#f7f5f0');
  const PALETTE = ['#7a4b8c', '#2f6f8f', '#8c3b3b', '#3b7a57', '#9a6b24', '#4a4f9c', '#7d3f5f', '#2f7d7a'];
  S.itemColor = (it) => (it && /^#[0-9a-f]{3,6}$/i.test(it.color || '') ? it.color : PALETTE[S.hash((it && (it.title || it.id)) || '') % PALETTE.length]);

  /* ---------- formatting ---------- */
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  S.fmtDate = (d) => {
    if (!d) return '';
    const m = String(d).match(/^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?/);
    if (!m) return String(d);
    if (m[3]) return `${+m[3]} ${MON[+m[2] - 1]} ${m[1]}`;
    if (m[2]) return `${MON[+m[2] - 1]} ${m[1]}`;
    return m[1];
  };
  S.fmtRuntime = (min) => {
    min = Math.round(+min);
    if (!min) return '';
    const h = Math.floor(min / 60), m = min % 60;
    return h ? `${h}h${m ? ' ' + m + 'm' : ''}` : `${m}m`;
  };
  S.fmtNum = (n, dec) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec || 0 });
  S.stars = (r, size) => {
    r = +r;
    if (!r) return '';
    return `<span class="stars" style="--r:${S.clamp(r, 0, 5)};--s:${size || 13}px" role="img" aria-label="${r} out of 5"></span>`;
  };

  /* ---------- covers ---------- */
  S.coverHTML = (it, opt) => {
    opt = opt || {};
    const c = S.itemColor(it);
    const T = S.TYPES[it.type] || S.TYPES.book;
    const gen = `<span class="gen" style="--c:${c};--ct:${S.ink(c)}"><small>${T.label}</small><b>${S.esc(it.title)}</b><small>${S.esc(it.by || '')}</small></span>`;
    if (!it.cover) return gen;
    return gen + `<img src="${S.esc(it.cover)}" alt="" ${opt.eager ? '' : 'loading="lazy"'} decoding="async" draggable="false">`;
  };
  // Fade images in once decoded; fall back to the generated cover on error.
  S.wireImgs = (root) =>
    S.$$('img', root).forEach((img) => {
      if (img.dataset.w) return;
      img.dataset.w = '1';
      const ok = () => img.classList.add('ok');
      const bad = () => {
        img.classList.add('err');
        const p = img.closest('.cov');
        if (p) p.classList.add('no-img');
      };
      if (img.complete) img.naturalWidth ? ok() : bad();
      else {
        img.addEventListener('load', ok, { once: true });
        img.addEventListener('error', bad, { once: true });
      }
    });

  /* ---------- sound (synthesised, off by default) ---------- */
  S.sfx = {
    on: false,
    ctx: null,
    last: 0,
    init() {
      this.on = S.ls.get('shelf-sound') === '1';
      this.paint();
      const b = S.$('#sound-btn');
      if (b)
        b.addEventListener('click', () => {
          this.on = !this.on;
          S.ls.set('shelf-sound', this.on ? '1' : '0');
          this.paint();
          if (this.on) this.chime();
        });
    },
    paint() {
      const b = S.$('#sound-btn');
      if (!b) return;
      b.setAttribute('aria-pressed', String(this.on));
      b.setAttribute('aria-label', this.on ? 'Turn sound off' : 'Turn sound on');
      b.innerHTML = S.icon(this.on ? 'soundOn' : 'soundOff');
    },
    ensure() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.9;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    },
    tone(f0, f1, dur, type, vol, delay) {
      if (!this.on) return;
      const c = this.ensure();
      if (!c) return;
      const t = c.currentTime + (delay || 0);
      const o = c.createOscillator(), g = c.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(f0, t);
      if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + dur + 0.03);
    },
    tick() {
      const n = performance.now();
      if (n - this.last < 50) return;
      this.last = n;
      this.tone(2300, 1900, 0.035, 'triangle', 0.014);
    },
    pop() { this.tone(380, 820, 0.14, 'sine', 0.05); },
    close() { this.tone(720, 320, 0.15, 'sine', 0.04); },
    swap() { this.tone(880, 1180, 0.08, 'triangle', 0.02); },
    chime() {
      this.tone(784, 0, 0.45, 'sine', 0.04);
      this.tone(1175, 0, 0.6, 'sine', 0.03, 0.09);
    },
  };

  /* ---------- toasts ---------- */
  S.toast = (msg, icon) => {
    const wrap = S.$('#toasts');
    if (!wrap) return;
    const t = S.html(`<div class="toast">${S.icon(icon || 'check')}<span>${S.esc(msg)}</span></div>`);
    wrap.appendChild(t);
    setTimeout(() => {
      t.classList.add('out');
      setTimeout(() => t.remove(), 450);
    }, 3200);
  };

  /* ---------- split headings into masked words ---------- */
  S.splitWords = (el) => {
    const text = el.textContent.trim().replace(/\s+/g, ' ');
    el.setAttribute('aria-label', text);
    el.innerHTML = text
      .split(' ')
      .map((w) => `<span class="w" aria-hidden="true"><span>${S.esc(w)}</span></span>`)
      .join(' ');
    return S.$$('.w > span', el);
  };

  /* ---------- pointer tilt (one shared rAF loop, transforms only) ---------- */
  const tilts = new Set();
  let tiltRaf = 0;
  function tiltStep() {
    tiltRaf = 0;
    tilts.forEach((el) => {
      const s = el._tilt;
      s.x += (s.tx - s.x) * 0.16;
      s.y += (s.ty - s.y) * 0.16;
      const max = s.max;
      const done = s.tx === 0 && s.ty === 0 && Math.abs(s.x) < 0.002 && Math.abs(s.y) < 0.002;
      if (done) {
        el.style.transform = '';
        if (s.glare) s.glare.style.transform = '';
        el.classList.remove('is-tilting');
        tilts.delete(el);
        return;
      }
      el.style.transform = `perspective(${s.persp}px) rotateX(${(-s.y * max).toFixed(2)}deg) rotateY(${(s.x * max * 1.15).toFixed(2)}deg)`;
      if (s.glare) s.glare.style.transform = `translate3d(${(s.x * 70).toFixed(1)}%, ${(s.y * 70).toFixed(1)}%, 0)`;
    });
    if (tilts.size) tiltRaf = requestAnimationFrame(tiltStep);
  }
  S.tiltTo = (el, x, y, opt) => {
    if (!el || S.reduced) return;
    let s = el._tilt;
    if (!s) {
      opt = opt || {};
      s = el._tilt = { x: 0, y: 0, tx: 0, ty: 0, max: opt.max || 9, persp: opt.persp || 900, glare: el.querySelector('.glare') };
    }
    s.tx = x;
    s.ty = y;
    if (x || y) el.classList.add('is-tilting');
    tilts.add(el);
    if (!tiltRaf) tiltRaf = requestAnimationFrame(tiltStep);
  };
  S.tiltFromEvent = (el, e, opt) => {
    const r = el.getBoundingClientRect();
    S.tiltTo(el, (e.clientX - r.left) / r.width - 0.5, (e.clientY - r.top) / r.height - 0.5, opt);
  };

  /* ---------- motion: Lenis smooth scroll on the GSAP ticker ---------- */
  S.initMotion = () => {
    gsap.registerPlugin(ScrollTrigger, Flip);
    gsap.defaults({ ease: 'expo.out', duration: 1 });
    ScrollTrigger.config({ ignoreMobileResize: true });
    if (!S.reduced && window.Lenis) {
      const lenis = (S.lenis = new Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 1, touchMultiplier: 1.4, syncTouch: false }));
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    }
  };
  S.scrollTo = (target, opt) => {
    opt = opt || {};
    const el = typeof target === 'string' ? S.$(target) : target;
    if (el == null && typeof target !== 'number') return;
    const offset = opt.offset != null ? opt.offset : -(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 68) - 8;
    if (S.lenis) {
      S.lenis.scrollTo(el == null ? target : el, { offset, duration: opt.duration || 1.5, easing: (t) => 1 - Math.pow(1 - t, 4), force: true, onComplete: opt.done });
    } else {
      const y = el == null ? target : el.getBoundingClientRect().top + scrollY + offset;
      scrollTo({ top: y, behavior: S.reduced ? 'auto' : 'smooth' });
      if (opt.done) setTimeout(opt.done, 600);
    }
  };
})();
