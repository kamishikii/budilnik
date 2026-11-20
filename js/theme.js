// Палитра «свой цвет»: колесо оттенка + квадрат насыщенности/яркости.
// Самодостаточный: сам добавляет стили, кнопки и окно палитры, если их нет.
(function () {
  const $ = id => document.getElementById(id);

  const CSS = `
:root { --ctl-w: clamp(150px, 52vw, 200px); }
.time-input, .box-btn { width: var(--ctl-w); min-width: 0; }
.melody-wrap { width: var(--ctl-w); max-width: none; }
.melody-btn { flex: 1; min-width: 0; max-width: none; }
.date-input { width: var(--ctl-w); }
body[data-theme="yellow"] {
  --bar:#ecd98f; --bg:#fdfaf0; --card:#ffffff;
  --ink:#4a4222; --line:#5c5330; --accent:#d4b13f; --danger:#c0563f;
}
#pickerOverlay { z-index: 80; }
.picker-body { padding: 18px 16px 12px; }
.picker-stage { position: relative; width: min(260px, 72vw); aspect-ratio: 1; margin: 0 auto; }
.wheel {
  position: absolute; inset: 0; border-radius: 50%;
  background: conic-gradient(#f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00);
  -webkit-mask: radial-gradient(closest-side, transparent 61%, #000 62%);
  mask: radial-gradient(closest-side, transparent 61%, #000 62%);
  touch-action: none; cursor: crosshair;
}
.wheel-knob {
  position: absolute; width: 26px; height: 26px; border-radius: 50%;
  border: 3px solid #111; box-shadow: 0 2px 6px rgba(0,0,0,.4);
  transform: translate(-50%, -50%); pointer-events: none;
}
.sv-box {
  position: absolute; left: 22%; top: 22%; width: 56%; height: 56%;
  border: 1px solid rgba(0,0,0,.35); touch-action: none; cursor: crosshair;
}
.sv-knob {
  position: absolute; width: 18px; height: 18px; border-radius: 50%;
  border: 3px solid #fff; box-shadow: 0 0 0 1px #000, 0 2px 5px rgba(0,0,0,.5);
  transform: translate(-50%, -50%); pointer-events: none;
}
.picker-preview { display: flex; align-items: center; justify-content: center; gap: 10px; margin-top: 16px; }
.picker-swatch { width: 26px; height: 26px; border-radius: 6px; border: 2px solid var(--line); }
.picker-hex { font-size: 15px; letter-spacing: 1px; opacity: .8; }
main::-webkit-scrollbar, .drawer-body::-webkit-scrollbar, .panel::-webkit-scrollbar,
.repeat-menu::-webkit-scrollbar, .cal-selected::-webkit-scrollbar { width: 8px; }
main::-webkit-scrollbar-track, .drawer-body::-webkit-scrollbar-track, .panel::-webkit-scrollbar-track,
.repeat-menu::-webkit-scrollbar-track, .cal-selected::-webkit-scrollbar-track { background: var(--bg); }
main::-webkit-scrollbar-thumb, .drawer-body::-webkit-scrollbar-thumb, .panel::-webkit-scrollbar-thumb,
.repeat-menu::-webkit-scrollbar-thumb, .cal-selected::-webkit-scrollbar-thumb {
  background: var(--accent); border-radius: 8px; border: 2px solid var(--bg);
}
`;
  const st = document.createElement('style');
  st.textContent = CSS;
  document.head.appendChild(st);

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
      const d = $('customDot');
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
      $('pickerOverlay').classList.remove('hidden');
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
      $('pickerOverlay').classList.add('hidden');
    },
    renderPicker() {
      const stage = $('pickerStage');
      const size = stage.clientWidth;
      if (!size) return;
      const { h, s, v } = this.hsv;
      const rad = (h - 90) * Math.PI / 180;
      const r = size * 0.41;
      const knob = $('wheelKnob');
      knob.style.left = (size / 2 + r * Math.cos(rad)) + 'px';
      knob.style.top = (size / 2 + r * Math.sin(rad)) + 'px';
      knob.style.background = `hsl(${h} 100% 50%)`;
      $('svBox').style.background =
        `linear-gradient(to top, #000, rgba(0,0,0,0)), linear-gradient(to right, #fff, hsl(${h} 100% 50%))`;
      const sk = $('svKnob');
      sk.style.left = (s * 100) + '%';
      sk.style.top = ((1 - v) * 100) + '%';
      $('pickerSwatch').style.background = this.hex();
      $('pickerHex').textContent = this.hex();
    },
    setFromWheel(e) {
      const b = $('pickerStage').getBoundingClientRect();
      const dx = e.clientX - (b.left + b.width / 2);
      const dy = e.clientY - (b.top + b.height / 2);
      let deg = Math.atan2(dy, dx) * 180 / Math.PI + 90;
      if (deg < 0) deg += 360;
      this.hsv.h = Math.round(deg) % 360;
      this.live();
    },
    setFromBox(e) {
      const b = $('svBox').getBoundingClientRect();
      this.hsv.s = Math.min(1, Math.max(0, (e.clientX - b.left) / b.width));
      this.hsv.v = Math.min(1, Math.max(0, 1 - (e.clientY - b.top) / b.height));
      this.live();
    },
    live() {
      this.save();
      UI.applyTheme('custom');
      this.renderPicker();
    }
  };
  window.Theme = Theme;

  function ensureButtons() {
    let list = $('themeList');
    if (!list) {
      const host = document.querySelector('.drawer-body') || $('drawer');
      if (!host) return;
      list = document.createElement('div');
      list.id = 'themeList';
      list.className = 'theme-list';
      host.appendChild(list);
    }
    if (!list.children.length) {
      list.innerHTML =
        '<button class="theme-btn" data-theme-id="sage"><span class="dot" style="background:#a9c2b3"></span>Шалфей</button>' +
        '<button class="theme-btn" data-theme-id="dark"><span class="dot" style="background:#2e3a34"></span>Тёмная</button>' +
        '<button class="theme-btn" data-theme-id="light"><span class="dot" style="background:#e9e9e9"></span>Светлая</button>' +
        '<button class="theme-btn" data-theme-id="rose"><span class="dot" style="background:#e7bfc7"></span>Розовая</button>' +
        '<button class="theme-btn" data-theme-id="sky"><span class="dot" style="background:#b9cfe4"></span>Небесная</button>';
    }
    if (!list.querySelector('[data-theme-id="yellow"]')) {
      const b = document.createElement('button');
      b.className = 'theme-btn';
      b.dataset.themeId = 'yellow';
      b.innerHTML = '<span class="dot" style="background:#ecd98f"></span>Жёлтая';
      const sage = list.querySelector('[data-theme-id="sage"]');
      if (sage) sage.after(b); else list.prepend(b);
    }
    if (!$('customColorBtn')) {
      const b = document.createElement('button');
      b.className = 'theme-btn';
      b.id = 'customColorBtn';
      b.dataset.themeId = 'custom';
      b.innerHTML = '<span class="dot" id="customDot"></span>Свой цвет';
      list.appendChild(b);
    }
  }

  function ensurePicker() {
    if ($('pickerOverlay')) return;
    const wrap = document.createElement('div');
    wrap.innerHTML =
      '<div id="pickerOverlay" class="overlay hidden">' +
      '  <div class="panel">' +
      '    <div class="panel-bar">Свой цвет</div>' +
      '    <div class="picker-body">' +
      '      <div class="picker-stage" id="pickerStage">' +
      '        <div class="wheel" id="wheel"></div>' +
      '        <div class="wheel-knob" id="wheelKnob"></div>' +
      '        <div class="sv-box" id="svBox"><div class="sv-knob" id="svKnob"></div></div>' +
      '      </div>' +
      '      <div class="picker-preview">' +
      '        <span class="picker-swatch" id="pickerSwatch"></span>' +
      '        <span class="picker-hex" id="pickerHex">#A9C2B3</span>' +
      '      </div>' +
      '      <div class="editor-actions">' +
      '        <button id="pickerReset" class="text-btn">Сброс</button>' +
      '        <button id="pickerClose" class="icon-btn" data-icon="close" data-fallback="✕" title="Отменить"></button>' +
      '        <button id="pickerDone" class="icon-btn" data-icon="check" data-fallback="✓" title="Оставить"></button>' +
      '      </div>' +
      '    </div>' +
      '  </div>' +
      '</div>';
    document.body.appendChild(wrap.firstElementChild);
  }

  function ensureHint() {
    let h = $('emptyHint');
    if (!h) {
      h = document.createElement('div');
      h.id = 'emptyHint';
      ($('listWrap') || document.body).appendChild(h);
    }
    h.innerHTML = '';
    h.className = 'hidden';
  }

  ensureButtons();
  ensurePicker();
  ensureHint();

  if (window.UI && typeof UI.applyTheme === 'function') {
    const orig = UI.applyTheme.bind(UI);
    UI.applyTheme = function (id) {
      Theme.clearCustom();
      orig(id);
      if (id === 'custom') Theme.applyCustom();
      Theme.refreshDot();
    };
  }

  const drag = (el, fn) => {
    if (!el) return;
    el.addEventListener('pointerdown', e => {
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
      fn(e);
      e.preventDefault();
    });
    el.addEventListener('pointermove', e => { if (e.buttons) fn(e); });
  };
  drag($('wheel'), e => Theme.setFromWheel(e));
  drag($('svBox'), e => Theme.setFromBox(e));

  const cc = $('customColorBtn');
  if (cc) cc.addEventListener('click', () => Theme.openPicker());
  const ap = $('appearanceBtn');
  if (ap && !ap.onclick) ap.addEventListener('click', () => $('themeList').classList.toggle('hidden'));
  const done = $('pickerDone'), cls = $('pickerClose'), rst = $('pickerReset');
  if (done) done.addEventListener('click', () => Theme.closePicker(true));
  if (cls) cls.addEventListener('click', () => Theme.closePicker(false));
  if (rst) rst.addEventListener('click', () => { Theme.hsv = { h: 150, s: 0.3, v: 0.78 }; Theme.live(); });
  window.addEventListener('resize', () => {
    const o = $('pickerOverlay');
    if (o && !o.classList.contains('hidden')) Theme.renderPicker();
  });

  Theme.load();
  Theme.refreshDot();
})();
