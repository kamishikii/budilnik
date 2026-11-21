// Экран звонка: чёрный фон, пульсирующее свечение по краям, дрейфующие светлячки.
// Смахивание вверх (кроме кнопки «Отложить») выключает; тап по кнопке — откладывает.
(function () {
  const $ = id => document.getElementById(id);
  const overlay = $('ringOverlay');
  if (!overlay) return;

  const st = document.createElement('style');
  st.textContent = `
.ring { background:#000; justify-content:flex-start; gap:0; padding:0 24px; touch-action:none; overflow:hidden; }
.ring canvas.fx { position:absolute; inset:0; width:100%; height:100%; z-index:0; }
.ring > *:not(canvas) { position:relative; z-index:1; }
.ring-time { margin-top:9vh; font-size:clamp(64px,17vw,116px); font-weight:100; letter-spacing:.05em;
  color:#EDF1F7; animation:none; text-shadow:0 0 28px rgba(185,194,216,.35); }
.ring-date { margin-top:12px; font-size:17px; font-weight:200; letter-spacing:.34em; color:#BFC7D6; }
.ring-note { margin-top:8px; font-size:14px; font-weight:200; letter-spacing:.08em; color:#8F97A8; max-width:80vw; }
.ring-spacer { flex:1; }
.ring-arrow { font-size:44px; font-weight:100; color:#D9DFEA; opacity:.85;
  animation:ringBob 1.4s ease-in-out infinite alternate; }
@keyframes ringBob { from { transform:translateY(4px); } to { transform:translateY(-7px); } }
.ring-actions { margin:10px 0 6vh; gap:0; }
#ringStop { display:none; }
#ringSnooze { background:none; border:none; color:#E8ECF4; font-weight:200; font-size:20px;
  line-height:1.55; letter-spacing:.06em; padding:14px 30px; }
#ringSnooze small { font-size:15px; letter-spacing:.18em; color:#BFC7D6; }
`;
  document.head.appendChild(st);

  const oldHint = overlay.querySelector('.ring-hint');
  if (oldHint) oldHint.remove();

  const cv = document.createElement('canvas');
  cv.className = 'fx';
  overlay.insertBefore(cv, overlay.firstChild);
  const ctx = cv.getContext('2d');

  const dateEl = document.createElement('div');
  dateEl.className = 'ring-date';
  overlay.insertBefore(dateEl, $('ringNote'));
  const spacer = document.createElement('div');
  spacer.className = 'ring-spacer';
  overlay.insertBefore(spacer, overlay.querySelector('.ring-actions'));
  const arrow = document.createElement('div');
  arrow.className = 'ring-arrow';
  arrow.textContent = '↑';
  overlay.insertBefore(arrow, overlay.querySelector('.ring-actions'));
  $('ringSnooze').innerHTML = 'Отложить<br><small>на 5 мин</small>';

  // ===== светлячки и свечение =====
  let W = 0, H = 0, raf = 0, t0 = 0, sh = null;
  let seed = 7;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const P = [];
  for (let i = 0; i < 170; i++) {
    const p = { center: false };
    const z = rnd();
    if (z < 0.62) {
      p.fx = rnd() < 0.5 ? rnd() * 0.20 : 0.80 + rnd() * 0.20;
      p.fy = rnd();
    } else if (z < 0.82) {
      p.fx = rnd();
      p.fy = rnd() < 0.5 ? rnd() * 0.16 : 0.84 + rnd() * 0.16;
    } else {
      p.fx = 0.2 + rnd() * 0.6; p.fy = 0.2 + rnd() * 0.6; p.center = true;
    }
    p.r = 0.6 + rnd() * 1.6;
    p.a = 0.25 + rnd() * 0.75;
    p.sp = 0.25 + rnd() * 0.5;
    p.sp2 = 0.2 + rnd() * 0.45;
    p.tw = 0.6 + rnd() * 1.8;
    p.ph = rnd() * 6.28; p.ph2 = rnd() * 6.28; p.ph3 = rnd() * 6.28;
    P.push(p);
  }
  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    W = overlay.clientWidth; H = overlay.clientHeight;
    cv.width = Math.max(1, Math.round(W * dpr));
    cv.height = Math.max(1, Math.round(H * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = (x0, y0, x1, y1) => {
      const gr = ctx.createLinearGradient(x0, y0, x1, y1);
      gr.addColorStop(0, 'rgba(185,194,216,0.85)');
      gr.addColorStop(1, 'rgba(185,194,216,0)');
      return gr;
    };
    sh = { l: g(0, 0, W * 0.30, 0), r: g(W, 0, W * 0.70, 0), t: g(0, 0, 0, H * 0.22), b: g(0, H, 0, H * 0.78) };
  }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const t = (now - t0) / 1000;
    ctx.clearRect(0, 0, W, H);
    const pulse = 0.72 + 0.16 * Math.sin(t * 0.7) + 0.12 * Math.sin(t * 1.31 + 1.7);
    ctx.globalAlpha = Math.max(0, Math.min(1, 0.62 * pulse));
    ctx.fillStyle = sh.l; ctx.fillRect(0, 0, W * 0.30, H);
    ctx.fillStyle = sh.r; ctx.fillRect(W * 0.70, 0, W * 0.30, H);
    ctx.fillStyle = sh.t; ctx.fillRect(0, 0, W, H * 0.22);
    ctx.fillStyle = sh.b; ctx.fillRect(0, H * 0.78, W, H * 0.22);
    ctx.fillStyle = '#E6F4EE';
    for (const p of P) {
      const x = p.fx * W + Math.sin(t * p.sp + p.ph) * 6;
      const y = p.fy * H + Math.cos(t * p.sp2 + p.ph2) * 5;
      const tw = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * p.tw + p.ph3));
      ctx.globalAlpha = Math.max(0, Math.min(1, p.a * tw * (p.center ? 0.45 : 1)));
      ctx.beginPath(); ctx.arc(x, y, p.r, 0, 6.2832); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  const fx = {
    start() { if (raf) return; resize(); t0 = performance.now(); raf = requestAnimationFrame(frame); },
    stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }
  };
  window.addEventListener('resize', () => { if (raf) resize(); });

  const origShow = UI.showRing.bind(UI);
  UI.showRing = function (a) {
    origShow(a);
    const d = new Date(), p = n => String(n).padStart(2, '0');
    dateEl.textContent = p(d.getDate()) + '.' + p(d.getMonth() + 1) + '.' + d.getFullYear();
    $('ringNote').style.display = (a && a.note) ? '' : 'none';
    fx.start();
  };
  const origHide = UI.hideRing.bind(UI);
  UI.hideRing = function () { origHide(); fx.stop(); };

  // ===== жесты =====
  let sy = null, sx = 0, onBtn = false;
  overlay.addEventListener('pointerdown', e => {
    sy = e.clientY; sx = e.clientX;
    onBtn = !!e.target.closest('#ringSnooze');
  });
  overlay.addEventListener('pointerup', e => {
    if (sy !== null && !onBtn) {
      const dy = sy - e.clientY;
      if (dy > 80 && Math.abs(e.clientX - sx) < dy) Player.dismiss();
    }
    sy = null;
  });
  overlay.addEventListener('pointercancel', () => { sy = null; });
})();
