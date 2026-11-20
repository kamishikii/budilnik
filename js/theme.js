// Свой цвет приложения: колесо оттенка + квадрат насыщенности/яркости.
// Крутишь — палитра приложения пересчитывается вживую.
const Theme = {
  KEY: 'kukusiki.customColor',
  hsv: { h: 150, s: 0.3, v: 0.78 },
  _snap: null,

  load() { try { const r = localStorage.getItem(this.KEY); if (r) Object.assign(this.hsv, JSON.parse(r)); } catch (e) {} },
  save() { try { localStorage.setItem(this.KEY, JSON.stringify(this.hsv)); } catch (e) {} },

  vars() {
    const { h, s, v } = this.hsv;
    const sat = Math.round(16 + s * 54);
    return {
      '--bar': `hsl(${h} ${sat}% ${Math.round(66 + v * 16)}%)`,
      '--bg': `hsl(${h} 24% 97%)`,
      '--card': `hsl(${h} 18% 99%)`,
      '--ink': `hsl(${h} 14% 22%)`,
      '--line': `hsl(${h} 12% 32%)`,
      '--accent': `hsl(${h} ${Math.round(26 + s * 48)}% ${Math.round(44 + v * 16)}%)`,
      '--danger': '#c0392b'
    };
  },
  applyCustom() {
    this.load();
    const v = this.vars();
    for (const k in v) document.body.style.setProperty(k, v[k]);
    document.body.dataset.theme = 'custom';
    this.refreshDot();
  },
  clearCustom() {
    ['--bar', '--bg', '--card', '--ink', '--line', '--accent', '--danger']
      .forEach(k => document.body.style.removeProperty(k));
  },
  refreshDot() {
    const d = document.getElementById('customDot');
    if (d) d.style.background = this.vars()['--bar'];
  },

  hex() {
    const { h, s, v } = this.hsv;
    const f = n => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
    const to = x => Math.round(x * 255).toString(16).padStart(2, '0');
    return ('#' + to(f(5)) + to(f(3)) + to(f(1))).toUpperCase();
  },

  openPicker() {
    this.load();
    this._snap = { hsv: { ...this.hsv }, theme: document.body.dataset.theme };
    document.getElementById('pickerOverlay').classList.remove('hidden');
    this.renderPicker();
  },
  closePicker(keep) {
    if (!keep && this._snap) {
      this.hsv = { ...this._snap.hsv };
      this.save();
      UI.applyTheme(this._snap.theme || 'sage');
    } else {
      this.save();
    }
    document.getElementById('pickerOverlay').classList.add('hidden');
  },

  renderPicker() {
    const stage = document.getElementById('pickerStage');
    const size = stage.clientWidth;
    if (!size) return;
    const { h, s, v } = this.hsv;
    const rad = (h - 90) * Math.PI / 180;
    const r = size * 0.41;
    const knob = document.getElementById('wheelKnob');
    knob.style.left = (size / 2 + r * Math.cos(rad)) + 'px';
    knob.style.top = (size / 2 + r * Math.sin(rad)) + 'px';
    knob.style.background = `hsl(${h} 100% 50%)`;
    const box = document.getElementById('svBox');
    box.style.background =
      `linear-gradient(to top, #000, rgba(0,0,0,0)), linear-gradient(to right, #fff, hsl(${h} 100% 50%))`;
    const sk = document.getElementById('svKnob');
    sk.style.left = (s * 100) + '%';
    sk.style.top = ((1 - v) * 100) + '%';
    document.getElementById('pickerSwatch').style.background = this.hex();
    document.getElementById('pickerHex').textContent = this.hex();
  },

  setFromWheel(e) {
    const b = document.getElementById('pickerStage').getBoundingClientRect();
    const dx = e.clientX - (b.left + b.width / 2);
    const dy = e.clientY - (b.top + b.height / 2);
    let deg = Math.atan2(dy, dx) * 180 / Math.PI + 90;
    if (deg < 0) deg += 360;
    this.hsv.h = Math.round(deg) % 360;
    this.live();
  },
  setFromBox(e) {
    const b = document.getElementById('svBox').getBoundingClientRect();
    this.hsv.s = Math.min(1, Math.max(0, (e.clientX - b.left) / b.width));
    this.hsv.v = Math.min(1, Math.max(0, 1 - (e.clientY - b.top) / b.height));
    this.live();
  },
  live() {
    this.save();
    UI.applyTheme('custom');
    this.renderPicker();
  },

  init() {
    this.load();
    this.refreshDot();
    const drag = (el, fn) => {
      el.addEventListener('pointerdown', e => { el.setPointerCapture(e.pointerId); fn(e); e.preventDefault(); });
      el.addEventListener('pointermove', e => { if (e.buttons) fn(e); });
    };
    drag(document.getElementById('wheel'), e => this.setFromWheel(e));
    drag(document.getElementById('svBox'), e => this.setFromBox(e));
    document.getElementById('customColorBtn').addEventListener('click', () => this.openPicker());
    document.getElementById('pickerDone').addEventListener('click', () => this.closePicker(true));
    document.getElementById('pickerClose').addEventListener('click', () => this.closePicker(false));
    document.getElementById('pickerReset').addEventListener('click', () => {
      this.hsv = { h: 150, s: 0.3, v: 0.78 };
      this.live();
    });
    window.addEventListener('resize', () => {
      if (!document.getElementById('pickerOverlay').classList.contains('hidden')) this.renderPicker();
    });
  }
};
Theme.init();
