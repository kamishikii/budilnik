
// Точка входа: связывает кнопки и запускает главный цикл проверки времени.
(function () {
  const $ = id => document.getElementById(id);

  Store.loadAlarms();
  Store.openDB().catch(() => {}); // если IndexedDB нет — мелодии живут в памяти
  Icons.fillStatic();
  UI.applyTheme(Store.getTheme() || 'sage');
  UI.renderList();

  // --- нижние плюсики ---
  $('addSingleBtn').onclick = () => UI.openEditor({ mode: 'single' });
  $('addMultiBtn').onclick = () => UI.showBatch();
  $('batchOk').onclick = () => UI.batchConfirm();
  $('batchCancel').onclick = () => UI.hideBatch();
  $('batchInput').addEventListener('keydown', e => { if (e.key === 'Enter') UI.batchConfirm(); });

  // --- меню ---
  function toggleDrawer() {
    if ($('drawer').classList.contains('open')) UI.closeDrawer();
    else { UI.hideRepeatMenu(); UI.openDrawer(); }
  }
  $('menuBtn').onclick = toggleDrawer;
  $('drawerMenuBtn').onclick = () => UI.closeDrawer();
  $('drawerOverlay').onclick = () => UI.closeDrawer();
  $('appearanceBtn').onclick = () => $('themeList').classList.toggle('hidden');
  $('themeList').addEventListener('click', e => {
    const b = e.target.closest('.theme-btn');
    if (b) UI.applyTheme(b.dataset.themeId);
  });

  // --- редактор ---
  $('edSave').onclick = () => UI.saveEditor();
  $('edCancel').onclick = () => UI.closeEditor();
  $('edRepeatBtn').onclick = e => {
    e.stopPropagation();
    $('repeatMenu').classList.contains('hidden') ? UI.showRepeatMenu() : UI.hideRepeatMenu();
  };
  $('repeatMenu').addEventListener('click', e => {
    const b = e.target.closest('.repeat-opt');
    if (b) UI.pickRepeat(b.dataset.type);
  });
  document.addEventListener('click', e => {
    if (!$('repeatMenu').classList.contains('hidden') &&
        !e.target.closest('#repeatMenu') && !e.target.closest('#edRepeatBtn')) {
      UI.hideRepeatMenu();
    }
  });
  window.addEventListener('resize', () => UI.hideRepeatMenu());
  $('edAnchor').addEventListener('change', e => { if (UI.ed) UI.ed.schedule.anchor = e.target.value; });
  $('edMelodyBtn').onclick = () => $('melodyFile').click();
  $('melodyFile').addEventListener('change', e => {
    UI.onMelodyFile(e.target.files[0]);
    e.target.value = '';
  });
  $('melodyPreview').onclick = async () => {
    const playing = await Player.previewToggle(UI.ed.melodyId);
    UI.setPreviewIcon(playing);
  };
  $('melodyClear').onclick = () => UI.clearMelody();

  // --- календарь ---
  $('calGrid').addEventListener('click', e => {
    const b = e.target.closest('.cal-day[data-key]');
    if (!b) return;
    const k = b.dataset.key;
    UI.cal.sel.has(k) ? UI.cal.sel.delete(k) : UI.cal.sel.add(k);
    UI.renderCalendar();
  });
  $('calMonthPrev').onclick = () => UI.calNav(-1, 0);
  $('calMonthNext').onclick = () => UI.calNav(1, 0);
  $('calYearPrev').onclick = () => UI.calNav(0, -1);
  $('calYearNext').onclick = () => UI.calNav(0, 1);
  $('calClear').onclick = () => { UI.cal.sel.clear(); UI.renderCalendar(); };
  $('calDone').onclick = () => UI.calDone();
  $('calCancel').onclick = () => UI.calCancel();

  // --- экран звонка ---
  $('ringStop').onclick = () => Player.dismiss();
  $('ringSnooze').onclick = () => Player.snooze(5);

  // --- карточки (делегирование событий) ---
  const list = $('alarmList');
  list.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const card = e.target.closest('.card');
    const id = card && card.dataset.id;
    const act = btn.dataset.action;
    if (act === 'edit') UI.openEditor({ mode: 'edit', id });
    if (act === 'del') {
      const a = Store.get(id);
      if (a && confirm(`Удалить будильник ${a.time}?`)) {
        Player.queue = Player.queue.filter(x => x.id !== id);
        Store.remove(id);
        UI.renderList();
      }
    }
    if (act === 'dates') card.querySelector('[data-dates]').classList.toggle('hidden');
  });
  list.addEventListener('change', e => {
    if (e.target.dataset.action === 'toggle') {
      const id = e.target.closest('.card').dataset.id;
      Store.update(id, { enabled: e.target.checked, snoozeUntil: null });
      UI.renderList();
    }
  });

  // --- звук разрешается после первого касания + держим экран включённым ---
  let wakeLock = null;
  async function requestWake() {
    try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); }
    catch (e) {}
  }
  document.addEventListener('pointerdown', () => { Player.unlock(); requestWake(); }, { once: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') requestWake();
  });

  // --- главный цикл: каждую секунду проверяем, не пора ли звонить ---
  function tick() {
    const now = new Date();
    const hhmm = Schedule.pad(now.getHours()) + ':' + Schedule.pad(now.getMinutes());
    const dayKey = Schedule.key(now);
    Store.alarms.forEach(a => {
      if (!a.enabled) return;
      // отложенный будильник
      if (a.snoozeUntil) {
        if (Date.now() >= a.snoozeUntil) {
          Store.update(a.id, { snoozeUntil: null });
          Player.ring(a);
        }
        return;
      }
      if (a.time !== hhmm) return;
      if (a.lastFired === dayKey + 'T' + a.time) return; // уже звонил в эту минуту
      if (!Schedule.isActive(a.schedule, now)) return;
      Store.update(a.id, { lastFired: dayKey + 'T' + a.time });
      Player.ring(a);
    });
  }
  setInterval(tick, 1000);
  tick();
})();
