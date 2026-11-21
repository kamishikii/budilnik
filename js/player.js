
const Player = {
  ctx: null, audio: null, beepTimer: null, vibTimer: null,
  current: null, queue: [], urls: {}, previewAudio: null,

  
  unlock() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },

  async ring(alarm) {
    if (this.current) { 
      if (!this.queue.find(a => a.id === alarm.id)) this.queue.push(alarm);
      return;
    }
    this.current = alarm;
    UI.showRing(alarm);
    this.startVibro();

    let played = false;
    if (alarm.melodyId) {
      const m = await Store.getMelody(alarm.melodyId);
      if (this.current !== alarm) return; 
      if (m && m.blob) {
        try {
          const url = this.urls[m.id] || (this.urls[m.id] = URL.createObjectURL(m.blob));
          this.audio = new Audio(url);
          this.audio.loop = true;
          await this.audio.play();
          played = true;
        } catch (e) {}
      }
    }
    if (!played) this.startBeep(); 
  },

  startBeep() {
    this.unlock();
    if (!this.ctx) return;
    const beep = () => {
      const t = this.ctx.currentTime;
      [0, 0.25].forEach(off => {
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = 'sine'; o.frequency.value = 880;
        g.gain.setValueAtTime(0.001, t + off);
        g.gain.exponentialRampToValueAtTime(0.4, t + off + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t + off + 0.18);
        o.connect(g).connect(this.ctx.destination);
        o.start(t + off); o.stop(t + off + 0.2);
      });
    };
    beep();
    this.beepTimer = setInterval(beep, 1000);
  },

  startVibro() {
    if (!navigator.vibrate) return;
    const v = () => navigator.vibrate([500, 300, 500]);
    v();
    this.vibTimer = setInterval(v, 1600);
  },

  stopSound() {
    if (this.audio) { this.audio.pause(); this.audio = null; }
    if (this.beepTimer) { clearInterval(this.beepTimer); this.beepTimer = null; }
    if (this.vibTimer) { clearInterval(this.vibTimer); this.vibTimer = null; }
    if (navigator.vibrate) navigator.vibrate(0);
  },

  stop() {
    this.stopSound();
    this.current = null;
    UI.hideRing();
    const next = this.queue.shift();
    if (next) this.ring(next);
  },

  
  dismiss() {
    const a = this.current;
    if (a && a.schedule && a.schedule.type === 'once') Store.update(a.id, { enabled: false });
    this.stop();
    UI.renderList();
  },

  
  snooze(min) {
    if (this.current) {
      Store.update(this.current.id, { snoozeUntil: Date.now() + min * 60000, enabled: true });
    }
    this.stop();
    UI.renderList();
    UI.toast('Отложено на ' + min + ' мин');
  },

  
  async previewToggle(melodyId) {
    if (this.previewAudio) { this.stopPreview(); return false; }
    const m = await Store.getMelody(melodyId);
    if (!m) return false;
    const url = this.urls[m.id] || (this.urls[m.id] = URL.createObjectURL(m.blob));
    this.previewAudio = new Audio(url);
    this.previewAudio.onended = () => { this.previewAudio = null; UI.setPreviewIcon(false); };
    try { await this.previewAudio.play(); } catch (e) { this.previewAudio = null; return false; }
    return true;
  },
  stopPreview() {
    if (this.previewAudio) { this.previewAudio.pause(); this.previewAudio = null; }
  }
};
