
const Native = {
  get available() {
    return !!(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AlarmClock);
  },
  get api() { return window.Capacitor.Plugins.AlarmClock; },
  _t: null,

  sync() {
    if (!this.available) return;
    clearTimeout(this._t);
    this._t = setTimeout(() => {
      const alarms = Store.alarms.map(a => ({
        id: a.id, time: a.time, enabled: !!a.enabled,
        note: a.note || '', melodyId: a.melodyId || null,
        schedule: a.schedule || { type: 'once' }
      }));
      const ids = [...new Set(Store.alarms.map(a => a.melodyId).filter(Boolean))];
      this.api.sync({ alarms: JSON.stringify(alarms), melodyIds: ids.join(',') }).catch(() => {});
    }, 150);
  },

  saveMelody(id, file) {
    if (!this.available || !file) return;
    const r = new FileReader();
    r.onload = () => {
      const base64 = String(r.result).split(',')[1] || '';
      this.api.saveMelody({ id, data: base64 }).catch(() => {});
    };
    r.readAsDataURL(file);
  },

  async init() {
    if (!this.available) return;
    try {
      const st = await this.api.getState();
      (st.disabled || []).forEach(id => {
        const a = Store.get(id);
        if (a && a.enabled) Store.update(id, { enabled: false });
      });
    } catch (e) {}
    this.sync();
    try {
      if (!localStorage.getItem('kukusiki.batteryAsked')) {
        localStorage.setItem('kukusiki.batteryAsked', '1');
        await this.api.askBattery();
      }
    } catch (e) {}
  }
};
