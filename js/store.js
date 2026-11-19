/* Sifar's Shelf | store: the collection, local drafts, saving back to data/collection.js */
(function () {
  'use strict';
  const S = window.S;
  const KEY = 'sifar-shelf-draft-v1';
  const FIELDS = ['id', 'type', 'title', 'by', 'year', 'cover', 'color', 'status', 'finished', 'progress', 'progressNote', 'rating', 'fav',
    'platform', 'hours', 'pages', 'runtime', 'seasons', 'episodes', 'genres', 'notes', 'sample', 'added'];
  const NUMS = ['year', 'progress', 'rating', 'hours', 'pages', 'runtime', 'seasons', 'episodes'];

  // Keep a tidy, predictable shape so saved files stay readable.
  function clean(raw) {
    const o = {};
    FIELDS.forEach((k) => {
      let v = raw[k];
      if (v == null || v === '' || v === false) return;
      if (NUMS.includes(k)) {
        v = Number(v);
        if (!isFinite(v) || v === 0) return;
      }
      if (k === 'genres') {
        v = (Array.isArray(v) ? v : String(v).split(','))
          .map((g) => String(g).trim())
          .filter(Boolean)
          .slice(0, 6);
        if (!v.length) return;
      }
      if (typeof v === 'string') v = v.trim();
      o[k] = v;
    });
    if (!S.TYPES[o.type]) o.type = 'book';
    if (o.status !== 'current') o.status = 'finished';
    if (!o.title) o.title = 'Untitled';
    return o;
  }
  const normalize = (list) => (Array.isArray(list) ? list.map(clean) : []);
  const clone = (o) => JSON.parse(JSON.stringify(o));

  function slug(s) {
    return String(s || 'item')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'item';
  }

  /* IndexedDB, only to remember which file to save into */
  const idb = {
    open() {
      return new Promise((res, rej) => {
        const r = indexedDB.open('sifar-shelf', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('kv');
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
    },
    async get(k) {
      const db = await this.open();
      return new Promise((res) => {
        const q = db.transaction('kv').objectStore('kv').get(k);
        q.onsuccess = () => res(q.result || null);
        q.onerror = () => res(null);
      });
    },
    async set(k, v) {
      const db = await this.open();
      return new Promise((res, rej) => {
        const tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').put(v, k);
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
    },
  };

  const HEADER = `/* Sifar's Shelf: collection data.
   Three ways to change it:
   1. Curator mode on the site (footer button), then "Save" writes this file.
   2. Edit the JSON below by hand (see README.md for every field).
   3. Ask Claude to add things.
   Items marked "sample": true are placeholders. Curator mode has a "Remove samples" button. */
`;

  const raw = window.SHELF_DATA || { updated: null, items: [] };

  const Store = (S.store = {
    base: { updated: raw.updated || null, items: normalize(raw.items) },
    items: [],
    updated: null,
    dirty: false,
    conflict: false,
    changes: 0,

    init() {
      let d = null;
      try { d = JSON.parse(S.ls.get(KEY) || 'null'); } catch (e) { d = null; }
      if (d && d.updated && d.updated === this.base.updated) {
        S.ls.del(KEY); // the file already holds these edits
        d = null;
      }
      if (d && Array.isArray(d.items)) {
        this.items = normalize(d.items);
        this.updated = d.updated;
        this.changes = d.changes || 1;
        this.dirty = true;
        this.conflict = d.baseUpdated !== this.base.updated;
      } else {
        this.items = clone(this.base.items);
        this.updated = this.base.updated;
      }
    },

    get(id) { return this.items.find((i) => i.id === id) || null; },
    count(type) { return type && type !== 'all' ? this.items.filter((i) => i.type === type).length : this.items.length; },
    samples() { return this.items.filter((i) => i.sample).length; },

    persist() {
      S.ls.set(KEY, JSON.stringify({ updated: this.updated, baseUpdated: this.base.updated, changes: this.changes, items: this.items }));
    },
    commit(kind, id) {
      this.updated = new Date().toISOString();
      this.dirty = true;
      this.changes++;
      this.persist();
      S.emit('change', { kind, id });
    },
    uniqueId(title) {
      const b = slug(title);
      let id = b, n = 2;
      while (this.get(id)) id = `${b}-${n++}`;
      return id;
    },
    add(data) {
      const it = clean(Object.assign({}, data, { added: new Date().toISOString().slice(0, 10) }));
      it.id = this.uniqueId(it.title);
      delete it.sample;
      this.items.unshift(it);
      this.commit('add', it.id);
      return it;
    },
    update(id, data) {
      const i = this.items.findIndex((x) => x.id === id);
      if (i < 0) return null;
      const keep = { id, added: this.items[i].added, sample: false }; // editing a sample makes it yours
      this.items[i] = clean(Object.assign({}, data, keep));
      this.commit('update', id);
      return this.items[i];
    },
    remove(id) {
      const n = this.items.length;
      this.items = this.items.filter((i) => i.id !== id);
      if (this.items.length !== n) this.commit('remove', id);
    },
    removeSamples() {
      const n = this.samples();
      if (!n) return 0;
      this.items = this.items.filter((i) => !i.sample);
      this.commit('samples');
      return n;
    },
    discard() {
      S.ls.del(KEY);
      this.items = clone(this.base.items);
      this.updated = this.base.updated;
      this.dirty = false;
      this.conflict = false;
      this.changes = 0;
      S.emit('change', { kind: 'reset' });
      S.emit('saved');
    },
    keepMine() {
      this.conflict = false;
      this.persist();
      S.emit('saved');
    },

    serialize() {
      const data = { updated: this.updated || new Date().toISOString(), items: this.items.map(clean) };
      return HEADER + 'window.SHELF_DATA = ' + JSON.stringify(data, null, 2) + ';\n';
    },
    markSaved() {
      this.base = { updated: this.updated, items: clone(this.items) };
      this.dirty = false;
      this.conflict = false;
      this.changes = 0;
      S.ls.del(KEY);
      S.emit('saved');
    },

    canWrite: () => typeof window.showSaveFilePicker === 'function',
    async hasHandle() {
      try { return !!(await idb.get('file')); } catch (e) { return false; }
    },
    // Writes data/collection.js directly (Chrome and Edge). Returns the file name written.
    async saveToFile(pickNew) {
      if (!this.updated) this.updated = new Date().toISOString();
      const text = this.serialize();
      let h = null;
      if (!pickNew) {
        try { h = await idb.get('file'); } catch (e) { h = null; }
      }
      if (h) {
        let p = await h.queryPermission({ mode: 'readwrite' });
        if (p !== 'granted') p = await h.requestPermission({ mode: 'readwrite' });
        if (p !== 'granted') h = null;
      }
      if (!h) {
        h = await window.showSaveFilePicker({
          suggestedName: 'collection.js',
          types: [{ description: 'Shelf data file', accept: { 'text/javascript': ['.js'] } }],
        });
        try { await idb.set('file', h); } catch (e) {}
      }
      const w = await h.createWritable();
      await w.write(text);
      await w.close();
      this.markSaved();
      return h.name;
    },
    download() {
      if (!this.updated) this.updated = new Date().toISOString();
      this.persist();
      const blob = new Blob([this.serialize()], { type: 'text/javascript' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'collection.js';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 1500);
    },
  });

  /* ---------- queries shared by every view ---------- */
  const strip = (t) => String(t || '').toLowerCase().replace(/^(the|a|an)\s+/, '');
  const when = (i) => (i.status === 'current' ? '9999' : i.finished || '') + '|' + (i.added || '');
  S.sortItems = (list, mode) => {
    const L = list.slice();
    if (mode === 'rating') L.sort((a, b) => (b.rating || 0) - (a.rating || 0) || strip(a.title).localeCompare(strip(b.title)));
    else if (mode === 'title') L.sort((a, b) => strip(a.title).localeCompare(strip(b.title)));
    else if (mode === 'year') L.sort((a, b) => (b.year || 0) - (a.year || 0) || strip(a.title).localeCompare(strip(b.title)));
    else L.sort((a, b) => (when(b) > when(a) ? 1 : when(b) < when(a) ? -1 : 0));
    return L;
  };
  S.haystack = (i) =>
    [i.title, i.by, i.year, i.platform, (i.genres || []).join(' '), S.TYPES[i.type].label, S.TYPES[i.type].plural].join(' ').toLowerCase();
})();
