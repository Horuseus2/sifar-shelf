/* Sifar's Shelf | objects: physical things that stand on shelves (books, cases, box sets) */
(function () {
  'use strict';
  const S = window.S;

  // Real-world proportions: books vary, cases are uniform, box sets grow with seasons.
  S.objDims = (it, s) => {
    s = s || 1;
    const r = S.rand01(it.id || it.title);
    let h, t, w;
    if (it.type === 'book') {
      h = 198 + r * 38;
      t = S.clamp(18 + (+it.pages || 320) / 24, 24, 58);
      w = h * 0.66;
    } else if (it.type === 'game') {
      h = 214; t = 25; w = 172;
    } else if (it.type === 'movie') {
      h = 196; t = 22; w = 138;
    } else {
      h = 206;
      t = S.clamp(20 + (+it.seasons || 1) * 6, 26, 60);
      w = 148;
    }
    return { h: Math.round(h * s), t: Math.round(t * s), w: Math.round(w * s) };
  };

  function fitFont(text, room, t, perChar, max) {
    const len = Math.max(4, String(text).length);
    return S.clamp(Math.min(max, room / (len * perChar)), 8, Math.min(max, t * 0.62)).toFixed(1);
  }
  const surname = (by) => {
    const s = String(by || '').split(/,| and /)[0].trim().split(/\s+/);
    return s[s.length - 1] || '';
  };

  S.objHTML = (it, s, opt) => {
    opt = opt || {};
    const d = S.objDims(it, s);
    const c = S.itemColor(it);
    const ct = S.ink(c);
    let spine = '';
    if (it.type === 'book') {
      const by = d.t >= 30 ? surname(it.by) : '';
      const fs = fitFont(it.title, d.h - (by ? 92 : 64), d.t, 0.56, 15 * (s || 1));
      spine = `<span class="sp-title" style="--fs:${fs}px">${S.esc(it.title)}</span>${by ? `<span class="sp-by">${S.esc(by)}</span>` : ''}`;
    } else if (it.type === 'game') {
      const fs = fitFont(it.title, d.h - 78, d.t, 0.5, 13 * (s || 1));
      spine = `<span class="sp-band"><span>${S.esc(String(it.platform || 'Game').slice(0, 7))}</span></span><span class="sp-title" style="--fs:${fs}px">${S.esc(it.title)}</span><span class="sp-dot"></span>`;
    } else if (it.type === 'movie') {
      const fs = fitFont(it.title, d.h - 70, d.t, 0.5, 12 * (s || 1));
      spine = `<span class="sp-band"></span><span class="sp-title" style="--fs:${fs}px">${S.esc(it.title)}</span><span class="sp-year">${S.esc(String(it.year || '').slice(2))}</span>`;
    } else {
      const n = +it.seasons || 0;
      const fs = fitFont(it.title, d.h - (n ? 84 : 50), d.t, 0.56, 15 * (s || 1));
      spine = `<span class="sp-title" style="--fs:${fs}px">${S.esc(it.title)}</span>${n ? `<span class="sp-mini">${n} season${n > 1 ? 's' : ''}</span>` : ''}`;
    }
    const tag = opt.static ? 'span' : 'button';
    const attrs = opt.static ? '' : ` type="button" aria-label="Open ${S.esc(it.title)}"`;
    return `<${tag} class="obj obj--${it.type}${opt.static ? ' is-3d is-static' : ''}" data-id="${S.esc(it.id)}"${attrs} style="--t:${d.t}px;--h:${d.h}px;--w:${d.w}px;--c:${c};--ct:${ct}">
      <span class="obj-box">
        <span class="obj-spine">${spine}</span>
        <span class="obj-cover cov${it.cover ? '' : ' no-img'}">${S.coverHTML(it)}<span class="obj-shade"></span></span>
      </span>
    </${tag}>`;
  };

  // Category divider card that stands between groups on the mixed shelf.
  S.dividerHTML = (type, n, s) => {
    const T = S.TYPES[type];
    const h = Math.round(150 * (s || 1));
    return `<span class="divider" style="--tc:var(--${type});--dh:${h}px" aria-hidden="true"><span class="dv-cap">${S.icon(T.icon)}</span><span class="dv-label">${T.plural}</span><span class="dv-n">${n}</span></span>`;
  };

  S.bookendHTML = (side) => `<span class="bookend bookend--${side}" aria-hidden="true"></span>`;

  // A small orange cat napping at the end of the first shelf.
  S.catHTML = () => `<span class="cat-wrap" aria-hidden="true">
    <span class="cat-z"><i>z</i><i>z</i><i>z</i></span>
    <svg class="cat" viewBox="0 0 96 52" width="96" height="52">
      <g class="cat-tail"><path d="M80 44c9-1 12-8 9-14-2-4-6-5-8-3" fill="none" stroke="#d98a3d" stroke-width="7" stroke-linecap="round"/></g>
      <ellipse cx="54" cy="36" rx="30" ry="15" fill="#e8994a"/>
      <path d="M40 23c4 5 4 18 0 26M52 21c4 6 4 21 0 29M64 23c4 5 4 18 0 25" fill="none" stroke="#c97a30" stroke-width="3" stroke-linecap="round" opacity=".7"/>
      <ellipse cx="54" cy="44" rx="26" ry="6" fill="#f3c690" opacity=".55"/>
      <g class="cat-head">
        <path d="M14 26l3-14 9 9z" fill="#e8994a"/><path d="M16.5 22.5l1.4-6.5 4.3 4.3z" fill="#f5b4a8"/>
        <path d="M30 21l9-8 1 14z" fill="#e8994a"/><path d="M32.8 20.4l4.6-4 .5 7z" fill="#f5b4a8"/>
        <ellipse cx="27" cy="33" rx="15" ry="12.5" fill="#eea055"/>
        <path d="M19.5 33.5q3 2.6 6 0M29.5 33.5q3 2.6 6 0" fill="none" stroke="#5a3417" stroke-width="1.6" stroke-linecap="round"/>
        <path d="M26.2 37.2l1.3 1 1.3-1z" fill="#c4626a"/>
        <circle cx="19" cy="38" r="2.4" fill="#f5a3a0" opacity=".45"/><circle cx="36" cy="38" r="2.4" fill="#f5a3a0" opacity=".45"/>
      </g>
      <path d="M22 47c6 3 16 3 24 1" fill="none" stroke="#eea055" stroke-width="7" stroke-linecap="round"/>
    </svg>
  </span>`;
})();
