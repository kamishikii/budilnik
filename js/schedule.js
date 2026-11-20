// Вся логика графиков повтора.
const Schedule = {
  TYPES: [
    { id: 'once',     label: 'Однократно' },
    { id: 'daily',    label: 'Ежедневно' },
    { id: 'weekdays', label: 'Пн–Пт' },
    { id: 'weekends', label: 'Сб–Вс' },
    { id: '1/1', label: '1/1', work: 1, rest: 1 },
    { id: '2/2', label: '2/2', work: 2, rest: 2 },
    { id: '3/3', label: '3/3', work: 3, rest: 3 },
    { id: '4/4', label: '4/4', work: 4, rest: 4 },
    { id: '5/2', label: '5/2', work: 5, rest: 2 },
    { id: '6/1', label: '6/1', work: 6, rest: 1 },
    { id: 'custom',   label: 'Индивидуально' }
  ],
  byId(id) { return this.TYPES.find(t => t.id === id); },
  isCycle(sch) { const t = this.byId(sch && sch.type); return !!(t && t.work); },
  label(sch) {
    if (!sch) return 'Однократно';
    if (sch.type === 'custom') {
      const n = (sch.dates || []).length;
      return n ? `Свои даты (${n})` : 'Индивидуально';
    }
    const t = this.byId(sch.type);
    return t ? t.label : 'Однократно';
  },
  pad(n) { return String(n).padStart(2, '0'); },
  // ключ даты вида 2026-07-05 (локальная дата, без часовых поясов)
  key(d) { return d.getFullYear() + '-' + this.pad(d.getMonth() + 1) + '-' + this.pad(d.getDate()); },
  human(keyStr) { const [y, m, d] = keyStr.split('-'); return `${d}.${m}.${y}`; },

  // должен ли будильник сработать в этот день
  isActive(sch, date) {
    const t = (sch && sch.type) || 'once';
    if (t === 'once' || t === 'daily') return true;
    if (t === 'weekdays') { const w = date.getDay(); return w >= 1 && w <= 5; }
    if (t === 'weekends') { const w = date.getDay(); return w === 0 || w === 6; }
    if (t === 'custom') return (sch.dates || []).includes(this.key(date));

    const def = this.byId(t);
    if (!def || !def.work) return true;
    // сменный график: считаем дни от первого рабочего дня
    const anchorStr = sch.anchor || this.key(new Date());
    const [ay, am, ad] = anchorStr.split('-').map(Number);
    const a = new Date(ay, am - 1, ad);
    const b = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diff = Math.round((b - a) / 86400000);
    const total = def.work + def.rest;
    const pos = ((diff % total) + total) % total; // работает и для дат до начала
    return pos < def.work;
  }
};
