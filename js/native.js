
const Native = {
  get available() {
    return !!(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AlarmClock);
  },
  get api() { return window.Capacitor.Plugins.AlarmClock; },
  _t: null,
  PUSHED_KEY: 'kukusiki.nativeMelodies',

  sync() {
    if (!this.available) return;
    clearTimeout(this._t);
    this._t = setTimeout(async () => {
      await this.pullDisabled(); // сначала забираем то, что система выключила сама
      const alarms = Store.alarms.map(a => ({
        id: a.id, time: a.time, enabled: !!a.enabled,
        note: a.note || '', melodyId: a.melodyId || null,
        schedule: a.schedule || { type: 'once' }
      }));
      const ids = [...new Set(Store.alarms.map(a => a.melodyId).filter(Boolean))];
      this.api.sync({ alarms: JSON.stringify(alarms), melodyIds: ids.join(',') }).catch(() => {});
    }, 150);
  },

  async pullDisabled() {
    if (!this.available) return false;
    try {
      const st = await this.api.getState();
      let changed = false;
      (st.disabled || []).forEach(id => {
        const a = Store.get(id);
        if (a && a.enabled) { Store.update(id, { enabled: false }); changed = true; }
      });
      if (changed) UI.renderList();
      return changed;
    } catch (e) { return false; }
  },

  _pushed() { try { return JSON.parse(localStorage.getItem(this.PUSHED_KEY) || '[]'); } catch (e) { return []; } },
  _markPushed(id) {
    const p = this._pushed();
    if (!p.includes(id)) { p.push(id); try { localStorage.setItem(this.PUSHED_KEY, JSON.stringify(p)); } catch (e) {} }
  },
  _sendMelody(id, blob) {
    return new Promise(res => {
      const r = new FileReader();
      r.onload = () => this.api.saveMelody({ id, data: String(r.result).split(',')[1] || '' }).then(res, res);
      r.onerror = () => res();
      r.readAsDataURL(blob);
    });
  },
  saveMelody(id, file) {
    if (!this.available || !file) return Promise.resolve();
    return this._sendMelody(id, file).then(() => this._markPushed(id));
  },
  // мелодии, добавленные до нативного слоя, докопируем в память телефона
  async pushMelodies() {
    if (!this.available) return;
    const done = this._pushed();
    const ids = [...new Set(Store.alarms.map(a => a.melodyId).filter(Boolean))];
    for (const id of ids) {
      if (done.includes(id)) continue;
      try {
        const m = await Store.getMelody(id);
        if (m && m.blob) { await this._sendMelody(id, m.blob); this._markPushed(id); }
      } catch (e) {}
    }
  },

  async init() {
    if (!this.available) return;
    await this.pullDisabled();
    this.sync();
    await this.pushMelodies();
    try {
      if (!localStorage.getItem('kukusiki.batteryAsked')) {
        localStorage.setItem('kukusiki.batteryAsked', '1');
        await this.api.askBattery();
      }
    } catch (e) {}
  }
};
window.Native = Native;

// ===== подключение к приложению =====
(function () {
  // любое изменение будильников сразу улетает в систему
  const origSave = Store.saveAlarms.bind(Store);
  Store.saveAlarms = function () { origSave(); Native.sync(); };

  // новая мелодия сразу копируется в память телефона
  const origMel = Store.saveMelody.bind(Store);
  Store.saveMelody = async function (id, name, file) {
    await origMel(id, name, file);
    try { await Native.saveMelody(id, file); } catch (e) {}
  };

  // в APK звонит нативный слой (даже с выключенным экраном) — веб-звонок не дублируем
  const origRing = Player.ring.bind(Player);
  Player.ring = function (a) { if (Native.available) return; return origRing(a); };

  const origDismiss = Player.dismiss.bind(Player);
  Player.dismiss = function () {
    if (Native.available) Native.api.stop().catch(() => {});
    origDismiss();
  };
  const origSnooze = Player.snooze.bind(Player);
  Player.snooze = function (min) {
    if (Native.available && Player.current) {
      Native.api.snooze({ id: Player.current.id, minutes: min || 5 }).catch(() => {});
    }
    origSnooze(min);
  };

  // смахивание вверх по экрану звонка + подсказка
  const st = document.createElement('style');
  st.textContent = '.ring-hint { margin-top: 22px; font-size: 15px; opacity: .55; }';
  document.head.appendChild(st);
  const ro = document.getElementById('ringOverlay');
  if (ro) {
    const hint = document.createElement('div');
    hint.className = 'ring-hint';
    hint.textContent = '↑ смахни вверх, чтобы выключить';
    ro.appendChild(hint);
    let sy = null, sx = 0;
    ro.addEventListener('pointerdown', e => { sy = e.clientY; sx = e.clientX; });
    ro.addEventListener('pointerup', e => {
      if (sy !== null && sy - e.clientY > 80 && Math.abs(e.clientX - sx) < sy - e.clientY) Player.dismiss();
      sy = null;
    });
    ro.addEventListener('pointercancel', () => { sy = null; });
  }

  window.addEventListener('load', () => Native.init());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') Native.pullDisabled();
  });
  setInterval(() => { if (!document.hidden) Native.pullDisabled(); }, 30000);
})();
