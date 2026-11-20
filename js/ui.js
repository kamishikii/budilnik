// Отрисовка: карточки, редактор, календарь, меню, экран звонка.
const UI = {
  ed: null,   // состояние редактора
  cal: null,  // состояние календаря

  $(id) { return document.getElementById(id); },
  esc(s) {
    return String(s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },
  toast(msg) {
    const t = this.$('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => t.classList.add('hidden'), 2500);
  },

  // ===== список будильников =====
  renderList() {
    const arr = [...Store.alarms].sort((a, b) => a.time.localeCompare(b.time));
    this.$('alarmList').innerHTML = arr.map(a => this.cardHTML(a)).join('');
    this.$('emptyHint').classList.toggle('hidden', arr.length > 0);
  },
  cardHTML(a) {
    const custom = a.schedule && a.schedule.type === 'custom';
    const badge = custom ? '?' : this.esc(Schedule.label(a.schedule));
    const dates = custom
      ? `<div class="card-dates hidden" data-dates>${
          (a.schedule.dates || []).slice().sort().map(d => Schedule.human(d)).join(', ') || 'Даты не выбраны'
        }</div>` : '';
    return `<div class="card ${a.enabled ? '' : 'off'}" data-id="${a.id}">
      <div class="card-top">
        <span class="card-time">${this.esc(a.time)}</span>
        <span class="card-tools">
          <button class="icon-btn" data-action="edit" title="Редактировать">${Icons.html('edit', '✎')}</button>
          <button class="icon-btn" data-action="del" title="Удалить">${Icons.html('delete', '🗑')}</button>
          <button class="badge ${custom ? 'badge-q' : ''}" ${custom ? 'data-action="dates"' : ''}>${badge}</button>
        </span>
      </div>
      <div class="card-bottom">
        <span class="card-note">${a.note ? this.esc(a.note) : '<span class="muted">Без пометки</span>'}</span>
        <label class="switch">
          <input type="checkbox" data-action="toggle" ${a.enabled ? 'checked' : ''}>
          <span class="slider"></span>
        </label>
      </div>${dates}</div>`;
  },

  // ===== редактор =====
  openEditor(opts) {
    Player.stopPreview(); this.setPreviewIcon(false);
    const ed = {
      mode: opts.mode, id: opts.id || null, times: opts.times || null,
      time: '00:00', schedule: { type: 'once' },
      melodyId: null, melodyName: '', note: ''
    };
    if (opts.mode === 'edit') {
      const a = Store.get(opts.id);
      if (!a) return;
      ed.time = a.time;
      ed.schedule = JSON.parse(JSON.stringify(a.schedule || { type: 'once' }));
      ed.note = a.note || '';
      ed.melodyId = a.melodyId || null;
      ed.melodyName = a.melodyName || '';
    }
    this.ed = ed;
    this.$('editorTitle').textContent =
      opts.mode === 'edit' ? 'Редактирование' :
      opts.mode === 'batch' ? `Общие настройки (${ed.times.length} буд.)` : 'Новый будильник';
    this.$('timeRow').classList.toggle('hidden', opts.mode === 'batch');
    this.$('edTime').value = ed.time;
    this.$('edNote').value = ed.note;
    this.$('edAnchor').value = ed.schedule.anchor || Schedule.key(new Date());
    this.refreshRepeatUI();
    this.refreshMelodyUI();
    this.$('editorOverlay').classList.remove('hidden');
  },
  refreshRepeatUI() {
    this.$('edRepeatLabel').textContent = Schedule.label(this.ed.schedule);
    this.$('anchorRow').classList.toggle('hidden', !Schedule.isCycle(this.ed.schedule));
  },
  refreshMelodyUI() {
    const has = !!this.ed.melodyId;
    this.$('edMelodyBtn').textContent = has ? (this.ed.melodyName || 'Мелодия') : 'ВЫБРАТЬ';
    this.$('melodyPreview').classList.toggle('hidden', !has);
    this.$('melodyClear').classList.toggle('hidden', !has);
  },
  closeEditor() {
    Player.stopPreview(); this.setPreviewIcon(false);
    this.$('editorOverlay').classList.add('hidden');
    this.hideRepeatMenu();
    this.ed = null;
    Store.cleanupMelodies(); // если мелодию выбрали, но отменили — убираем её из хранилища
  },
  saveEditor() {
    const ed = this.ed;
    if (!ed) return;
    const sch = { type: ed.schedule.type };
    if (Schedule.isCycle(ed.schedule)) {
      sch.anchor = this.$('edAnchor').value || Schedule.key(new Date());
    }
    if (sch.type === 'custom') {
      sch.dates = (ed.schedule.dates || []).slice().sort();
      if (!sch.dates.length) { this.toast('Выбери хотя бы одну дату в календаре'); return; }
    }
    const note = this.$('edNote').value.trim();
    const melodyId = ed.melodyId, melodyName = ed.melodyName;

    if (ed.mode === 'batch') {
      ed.times.forEach(t => Store.add({
        id: Store.newId(), time: t,
        schedule: JSON.parse(JSON.stringify(sch)),
        note, melodyId, melodyName,
        enabled: true, lastFired: null, snoozeUntil: null
      }));
      this.toast('Добавлено: ' + ed.times.length);
    } else {
      const time = this.normalizeTime(this.$('edTime').value);
      if (!time) { this.toast('Укажи время'); return; }
      if (ed.mode === 'edit') {
        Store.update(ed.id, { time, schedule: sch, note, melodyId, melodyName, lastFired: null, snoozeUntil: null });
      } else {
        Store.add({ id: Store.newId(), time, schedule: sch, note, melodyId, melodyName,
                    enabled: true, lastFired: null, snoozeUntil: null });
      }
      this.toast('Сохранено');
    }
    this.closeEditor();
    this.renderList();
  },

  // "9:5" / "9.05" / "09:05" -> "09:05", мусор -> null
  normalizeTime(v) {
    if (!v) return null;
    const m = String(v).trim().match(/^(\d{1,2})[:.](\d{1,2})$/);
    if (!m) return null;
    const h = +m[1], mi = +m[2];
    if (h > 23 || mi > 59) return null;
    return Schedule.pad(h) + ':' + Schedule.pad(mi);
  },
  parseTimes(str) {
    const parts = String(str).split(/[,;\s]+/).filter(Boolean);
    const ok = [], bad = [], seen = new Set();
    parts.forEach(p => {
      const t = this.normalizeTime(p);
      if (t && !seen.has(t)) { seen.add(t); ok.push(t); }
      else if (!t) bad.push(p);
    });
    return { ok, bad };
  },

  // ===== выпадающий список графиков =====
  showRepeatMenu() {
    const menu = this.$('repeatMenu');
    menu.innerHTML = Schedule.TYPES.map(t =>
      `<button class="repeat-opt ${this.ed.schedule.type === t.id ? 'active' : ''}" data-type="${t.id}">${t.label}</button>`
    ).join('');
    menu.classList.remove('hidden');
    const r = this.$('edRepeatBtn').getBoundingClientRect();
    const h = menu.offsetHeight, w = 210;
    let top = r.bottom + 4;
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 4);
    menu.style.top = top + 'px';
    menu.style.left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8)) + 'px';
  },
  hideRepeatMenu() { this.$('repeatMenu').classList.add('hidden'); },
  pickRepeat(type) {
    if (!this.ed) return;
    this.ed.schedule.type = type;
    if (Schedule.isCycle(this.ed.schedule) && !this.ed.schedule.anchor) {
      this.ed.schedule.anchor = this.$('edAnchor').value || Schedule.key(new Date());
    }
    if (type === 'custom') this.openCalendar(this.ed.schedule.dates || []);
    this.refreshRepeatUI();
    this.hideRepeatMenu();
  },

  // ===== мелодия =====
  async onMelodyFile(file) {
    if (!file || !this.ed) return;
    if (file.size > 20 * 1024 * 1024) { this.toast('Файл слишком большой (до 20 МБ)'); return; }
    const id = Store.newId();
    const name = file.name.replace(/\.[^.]+$/, '');
    try { await Store.saveMelody(id, name, file); }
    catch (e) { this.toast('Не удалось сохранить мелодию'); return; }
    this.ed.melodyId = id;
    this.ed.melodyName = name;
    this.refreshMelodyUI();
    this.toast(Store.db ? 'Мелодия: ' + name : 'Мелодия сохранена только до перезапуска');
  },
  clearMelody() {
    this.ed.melodyId = null; this.ed.melodyName = '';
    Player.stopPreview(); this.setPreviewIcon(false);
    this.refreshMelodyUI();
  },
  setPreviewIcon(playing) { this.$('melodyPreview').textContent = playing ? '⏸' : '▶'; },

  // ===== календарь своих дат =====
  openCalendar(dates) {
    const now = new Date();
    this.cal = { y: now.getFullYear(), m: now.getMonth(), sel: new Set(dates || []) };
    this.$('calOverlay').classList.remove('hidden');
    this.renderCalendar();
  },
  renderCalendar() {
    const { y, m, sel } = this.cal;
    const months = ['Январь','Февраль','Март','Апрель','Май','Июнь',
                    'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
    this.$('calTitle').textContent = months[m] + ' ' + y;
    const start = (new Date(y, m, 1).getDay() + 6) % 7; // неделя с понедельника
    const days = new Date(y, m + 1, 0).getDate();
    const todayKey = Schedule.key(new Date());
    let html = '';
    for (let i = 0; i < start; i++) html += '<span class="cal-day other"></span>';
    for (let d = 1; d <= days; d++) {
      const k = y + '-' + Schedule.pad(m + 1) + '-' + Schedule.pad(d);
      html += `<button class="cal-day ${sel.has(k) ? 'sel' : ''} ${k === todayKey ? 'today' : ''}" data-key="${k}">${d}</button>`;
    }
    this.$('calGrid').innerHTML = html;
    this.$('calCount').textContent = sel.size;
    this.$('calSelected').innerHTML = [...sel].sort().map(k => Schedule.human(k)).join(', ') || '—';
  },
  calNav(dm, dy) {
    let m = this.cal.m + dm, y = this.cal.y + dy;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    this.cal.m = m;
    this.cal.y = Math.min(2100, Math.max(1970, y));
    this.renderCalendar();
  },
  calDone() {
    this.ed.schedule.dates = [...this.cal.sel].sort();
    this.$('calOverlay').classList.add('hidden');
    this.refreshRepeatUI();
  },
  calCancel() { this.$('calOverlay').classList.add('hidden'); },

  // ===== боковое меню и темы =====
  openDrawer() {
    this.$('drawer').classList.add('open');
    this.$('drawerOverlay').classList.remove('hidden');
  },
  closeDrawer() {
    this.$('drawer').classList.remove('open');
    this.$('drawerOverlay').classList.add('hidden');
  },
  applyTheme(id) {
    document.body.dataset.theme = id;
    Store.setTheme(id);
    document.querySelectorAll('.theme-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.themeId === id));
  },

  // ===== экран звонка =====
  showRing(a) {
    this.$('ringTime').textContent = a.time;
    this.$('ringNote').textContent = a.note || '';
    this.$('ringOverlay').classList.remove('hidden');
  },
  hideRing() { this.$('ringOverlay').classList.add('hidden'); },

  // ===== массовое добавление =====
  showBatch() {
    this.$('batchBar').classList.remove('hidden');
    this.$('batchInput').value = '';
    this.$('batchInput').focus();
  },
  hideBatch() { this.$('batchBar').classList.add('hidden'); },
  batchConfirm() {
    const { ok, bad } = this.parseTimes(this.$('batchInput').value);
    if (bad.length) { this.toast('Не поняла: ' + bad.join(', ')); return; }
    if (!ok.length) { this.toast('Введи время, например 18:00, 19:00'); return; }
    this.hideBatch();
    this.openEditor({ mode: 'batch', times: ok });
  }
};
