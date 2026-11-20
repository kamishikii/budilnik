// Хранилище: будильники — в localStorage, мелодии (аудиофайлы) — в IndexedDB.
const Store = {
  ALARMS_KEY: 'kukusiki.alarms.v1',
  THEME_KEY: 'kukusiki.theme',
  alarms: [],
  db: null,
  memMelodies: {}, // запасной вариант, если IndexedDB недоступен

  loadAlarms() {
    try {
      const raw = localStorage.getItem(this.ALARMS_KEY);
      this.alarms = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(this.alarms)) this.alarms = [];
    } catch (e) { this.alarms = []; }
  },
  saveAlarms() {
    try { localStorage.setItem(this.ALARMS_KEY, JSON.stringify(this.alarms)); }
    catch (e) { console.warn('Не удалось сохранить будильники', e); }
  },
  get(id) { return this.alarms.find(a => a.id === id); },
  add(a) { this.alarms.push(a); this.saveAlarms(); },
  update(id, patch) {
    const a = this.get(id);
    if (a) { Object.assign(a, patch); this.saveAlarms(); }
  },
  remove(id) {
    this.alarms = this.alarms.filter(a => a.id !== id);
    this.saveAlarms();
    this.cleanupMelodies();
  },
  newId() { return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); },

  // ----- мелодии -----
  openDB() {
    return new Promise((res, rej) => {
      if (!window.indexedDB) return rej(new Error('no idb'));
      const req = indexedDB.open('kukusiki-melodies', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('melodies', { keyPath: 'id' });
      req.onsuccess = () => { this.db = req.result; res(); };
      req.onerror = () => rej(req.error);
    });
  },
  saveMelody(id, name, blob) {
    this.memMelodies[id] = { id, name, blob };
    if (!this.db) return Promise.resolve();
    return new Promise((res, rej) => {
      const tx = this.db.transaction('melodies', 'readwrite');
      tx.objectStore('melodies').put({ id, name, blob });
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
  },
  getMelody(id) {
    if (!id) return Promise.resolve(null);
    if (!this.db) return Promise.resolve(this.memMelodies[id] || null);
    return new Promise(res => {
      const rq = this.db.transaction('melodies').objectStore('melodies').get(id);
      rq.onsuccess = () => res(rq.result || this.memMelodies[id] || null);
      rq.onerror = () => res(this.memMelodies[id] || null);
    });
  },
  // удаляет мелодии, на которые больше никто не ссылается
  cleanupMelodies() {
    if (!this.db) return;
    const used = new Set(this.alarms.map(a => a.melodyId).filter(Boolean));
    const tx = this.db.transaction('melodies', 'readwrite');
    const st = tx.objectStore('melodies');
    const rq = st.getAllKeys();
    rq.onsuccess = () => rq.result.forEach(k => { if (!used.has(k)) st.delete(k); });
  },

  // ----- тема -----
  getTheme() { try { return localStorage.getItem(this.THEME_KEY); } catch (e) { return null; } },
  setTheme(id) { try { localStorage.setItem(this.THEME_KEY, id); } catch (e) {} }
};
