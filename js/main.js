/* Sifar's Shelf | main: boot, navigation, reveals */
(function () {
  'use strict';
  const S = window.S, $ = S.$, $$ = S.$$;

  function nav() {
    const body = document.body;
    let lastY = 0, hidden = false, scrolled = false;
    const onScroll = (y) => {
      const s = y > 24;
      if (s !== scrolled) body.classList.toggle('is-scrolled', (scrolled = s));
      const goingDown = y > lastY + 2, goingUp = y < lastY - 2;
      if (goingDown && y > 520 && !hidden) body.classList.toggle('nav-hidden', (hidden = true));
      else if ((goingUp || y < 520) && hidden) body.classList.toggle('nav-hidden', (hidden = false));
      lastY = y;
    };
    if (S.lenis) S.lenis.on('scroll', (l) => onScroll(l.scroll));
    else window.addEventListener('scroll', () => onScroll(scrollY), { passive: true });

    // The toolbar only slides up with the nav once it is actually stuck.
    const navH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 68;
    const wrap = $('#toolbar-wrap');
    new IntersectionObserver(
      ([e]) => wrap.classList.toggle('is-stuck', !e.isIntersecting && e.boundingClientRect.top < navH + 9),
      { rootMargin: `-${navH + 9}px 0px 0px 0px`, threshold: 0 }
    ).observe($('#stick-sentinel'));

    // Active section ink in the nav pill.
    const links = $('.nav-links');
    const ink = $('.nav-ink', links);
    const setActive = (id) => {
      $$('a', links).forEach((a) => a.classList.toggle('is-active', a.dataset.nav === id));
      const a = id && $(`a[data-nav="${id}"]`, links);
      if (!a || a.hidden) { ink.style.opacity = '0'; return; }
      ink.style.opacity = '1';
      ink.style.width = a.offsetWidth + 'px';
      ink.style.transform = `translate3d(${a.offsetLeft}px,0,0)`;
    };
    ['now', 'collection', 'favourites', 'numbers'].forEach((id) => {
      ScrollTrigger.create({
        trigger: '#' + id, start: 'top 55%', end: 'bottom 55%',
        onToggle: (self) => self.isActive && setActive(id),
      });
    });
    ScrollTrigger.create({ trigger: '.hero', start: 'top top', end: 'bottom 55%', onToggle: (self) => self.isActive && setActive(null) });

    // Smooth anchor scrolling through Lenis.
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a || e.defaultPrevented) return;
      const id = a.getAttribute('href');
      const t = id === '#top' ? 0 : id.length > 1 && $(id);
      if (t === false || t == null) return;
      e.preventDefault();
      if ($('#menu') && !$('#menu').hidden) menu(false);
      S.scrollTo(t === 0 ? 0 : t, { offset: t === 0 ? 0 : undefined });
    });
  }

  /* mobile menu */
  let menuOpen = false;
  function menu(v) {
    const m = $('#menu'), btn = $('#menu-btn');
    if (v === menuOpen) return;
    menuOpen = v;
    btn.setAttribute('aria-expanded', String(v));
    document.body.classList.toggle('menu-open', v);
    if (v) {
      m.hidden = false;
      if (S.lenis) S.lenis.stop();
      gsap.fromTo(m, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'power2.out' });
      gsap.fromTo($$('.menu-links a > span', m), { yPercent: 110 }, { yPercent: 0, duration: 0.9, ease: 'expo.out', stagger: 0.06, delay: 0.05 });
    } else {
      gsap.to(m, { opacity: 0, duration: 0.3, ease: 'power2.in', onComplete: () => (m.hidden = true) });
      if (S.lenis) S.lenis.start();
    }
  }

  function reveals() {
    $$('[data-split]').forEach((el) => {
      const parts = S.splitWords(el);
      if (S.reduced) return;
      gsap.set(parts, { yPercent: 115 });
      ScrollTrigger.create({
        trigger: el, start: 'top 90%', once: true,
        onEnter: () => gsap.to(parts, { yPercent: 0, duration: 1.2, ease: 'expo.out', stagger: 0.07 }),
      });
    });
    if (S.reduced) return;
    $$('.kicker, .sec-sub, .foot-sub, .foot-links, .foot-copy, .toolbar').forEach((el) => {
      gsap.set(el, { opacity: 0, y: 18 });
      ScrollTrigger.create({
        trigger: el, start: 'top 92%', once: true,
        onEnter: () => gsap.to(el, { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', clearProps: 'transform,opacity' }),
      });
    });
  }

  async function boot() {
    S.hydrateIcons();
    S.store.init();
    S.initMotion();
    if (S.lenis) S.lenis.stop();
    if (!S.reduced) gsap.set('.hero-title .ln > span', { yPercent: 105 });
    gsap.set('.nav > *', { opacity: 0 });
    S.sfx.init();
    S.hero.init();
    S.collection.init();
    S.sections.init();
    S.modal.init();
    S.curator.init();
    // Hero starts hidden under the loader so nothing flashes while the panels lift.
    gsap.set('.eyebrow, .hero-lede, .hstat, .hero-cta > *, #ring-stage, .ring-hint', { opacity: 0 });
    $('#foot-year').textContent = new Date().getFullYear();
    const upd = S.fmtDate((S.store.updated || '').slice(0, 10));
    $('#foot-updated').textContent = upd || 'recently';
    $('#menu-btn').addEventListener('click', () => menu(!menuOpen));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menuOpen) menu(false);
    });

    // Measure and wire everything while the loader still covers the page...
    await S.loader.ready();
    nav();
    reveals();
    S.hero.scrollFx();
    S.collection.afterLoad();
    S.sections.afterLoad();
    ScrollTrigger.refresh();
    // ...so the intro runs on a quiet main thread.
    await S.loader.exit();
    if (S.lenis) S.lenis.start();
    S.hero.intro();
    if (location.hash && location.hash.length > 1 && $(location.hash)) setTimeout(() => S.scrollTo(location.hash), 300);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
