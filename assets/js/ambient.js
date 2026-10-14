/* ==========================================================================
   ambient.js — «живые» мелочи: пылинки в солнечном свете у окна,
   «Вечерний свет» в hero, кнопки, которые тянутся за курсором, луч радара,
   подсказка у колоды отзывов, искры над камином в финале.
   Всё ставится на паузу вне экрана и отключается при reduced motion.
   ========================================================================== */
(function () {
  'use strict';
  const PRIV = (window.PRIV = window.PRIV || {});
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const FINE = matchMedia('(pointer: fine)').matches;

  // цикл отрисовки, который работает только пока элемент на экране и вкладка видна
  function visibleLoop(el, frame) {
    let on = false, raf = 0, last = 0;
    const tick = (now) => {
      raf = 0;
      if (!on || document.hidden) return;
      const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
      frame(now / 1000, dt);
      raf = requestAnimationFrame(tick);
    };
    const go = () => { if (!raf && on && !document.hidden) { last = 0; raf = requestAnimationFrame(tick); } };
    new IntersectionObserver((e) => { on = e[0].isIntersecting; go(); }, { rootMargin: '80px 0px' }).observe(el);
    document.addEventListener('visibilitychange', go);
  }

  function fitCanvas(cv, box, cap = 1.5) {
    const dpr = Math.min(devicePixelRatio || 1, cap);
    const w = Math.round(box.clientWidth * dpr), h = Math.round(box.clientHeight * dpr);
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    return dpr;
  }

  /* ---------- 1. Пылинки в свете окна (hero) ---------- */
  function motes() {
    const stage = $('#heroStage'), fire = PRIV.heroFire;
    if (!stage || !fire) return;
    const cv = document.createElement('canvas');
    cv.className = 'motes'; cv.setAttribute('aria-hidden', 'true');
    stage.appendChild(cv);
    const ctx = cv.getContext('2d');
    // окно с тюлем в координатах исходного кадра 2000×1500
    const R = { x0: 1110, y0: 420, x1: 1600, y1: 1270 };
    const N = innerWidth < 768 ? 22 : 46;
    const rnd = (a, b) => a + Math.random() * (b - a);
    const P = Array.from({ length: N }, () => ({
      x: rnd(R.x0, R.x1), y: rnd(R.y0, R.y1), r: rnd(0.6, 2.1), a: rnd(0.25, 0.75),
      sp: rnd(4, 14), ph: rnd(0, 6.28), dr: rnd(0.2, 0.6),
    }));
    let dpr = 1;
    const resize = () => { dpr = fitCanvas(cv, stage); };
    new ResizeObserver(resize).observe(stage); resize();
    PRIV.motesLevel = 1; // «Вечерний свет» гасит солнечную пыль
    let level = 1;
    visibleLoop(stage, (t, dt) => {
      level += ((PRIV.motesLevel ?? 1) - level) * Math.min(1, dt * 2.5);
      ctx.clearRect(0, 0, cv.width, cv.height);
      if (level < 0.02) return;
      ctx.globalCompositeOperation = 'lighter';
      for (const p of P) {
        // медленно поднимаются и покачиваются, как пыль в луче
        p.y -= p.sp * dt; p.x += Math.sin(t * p.dr + p.ph) * 6 * dt;
        if (p.y < R.y0) { p.y = R.y1; p.x = rnd(R.x0, R.x1); }
        const ex = Math.min(p.x - R.x0, R.x1 - p.x) / 90, ey = Math.min(p.y - R.y0, R.y1 - p.y) / 120;
        const edge = Math.max(0, Math.min(1, ex, ey));
        const tw = 0.55 + 0.45 * Math.sin(t * 1.7 + p.ph * 3);
        const al = p.a * tw * edge * level;
        if (al < 0.01) continue;
        const pt = fire.toStage(p.x, p.y);
        if (!pt) return;
        const x = pt[0] * dpr, y = pt[1] * dpr, r = p.r * dpr;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.4);
        g.addColorStop(0, `rgba(255,246,228,${al})`); g.addColorStop(1, 'rgba(255,246,228,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, r * 2.4, 0, 6.2832); ctx.fill();
      }
    });
  }

  /* ---------- 2. «Вечерний свет»: гасим комнату, остаётся камин ---------- */
  function lamp() {
    const hero = $('#top'), btn = $('.hero-lamp', hero);
    if (!btn) return;
    const lab = $('span', btn);
    btn.addEventListener('click', () => {
      const on = !hero.classList.contains('is-evening');
      hero.classList.toggle('is-evening', on);
      btn.setAttribute('aria-pressed', String(on));
      lab.textContent = on ? 'Включить свет' : 'Вечерний свет';
      PRIV.motesLevel = on ? 0 : 1;
      if (PRIV.heroFire) PRIV.heroFire.glowRange = on ? [0.5, 0.9] : [0.22, 0.42];
    });
  }

  /* ---------- 3. Кнопки тянутся за курсором ---------- */
  function magnets() {
    if (!FINE) return;
    $$('.btn, .btn-ember, .g-btn, .deck-btn').forEach((b) => {
      const inner = b.querySelector('span, b, svg');
      const qx = gsap.quickTo(b, 'x', { duration: 0.5, ease: 'power3.out' }), qy = gsap.quickTo(b, 'y', { duration: 0.5, ease: 'power3.out' });
      const ix = inner && gsap.quickTo(inner, 'x', { duration: 0.6, ease: 'power3.out' }), iy = inner && gsap.quickTo(inner, 'y', { duration: 0.6, ease: 'power3.out' });
      b.addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse') return;
        const r = b.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        qx(gsap.utils.clamp(-8, 8, dx * 0.18)); qy(gsap.utils.clamp(-6, 6, dy * 0.25));
        if (inner) { ix(gsap.utils.clamp(-4, 4, dx * 0.08)); iy(gsap.utils.clamp(-3, 3, dy * 0.1)); }
      });
      b.addEventListener('pointerleave', () => {
        gsap.to(b, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, .45)', overwrite: true });
        if (inner) gsap.to(inner, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, .45)', overwrite: true });
      });
    });
  }

  /* ---------- 4. Луч радара и вспышки точек ---------- */
  function sweep() {
    const root = $('#radar'), svg = root && $('.radar-svg', root);
    if (!svg) return;
    const NS = 'http://www.w3.org/2000/svg';
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'r-sweep');
    // клин 38°: ведущая кромка — линия, хвост тает
    const a0 = (-38 * Math.PI) / 180, R = 248;
    const x0 = (260 + Math.sin(a0) * R).toFixed(1), y0 = (260 - Math.cos(a0) * R).toFixed(1);
    g.innerHTML = `<defs><linearGradient id="swg" gradientUnits="userSpaceOnUse" x1="${x0}" y1="${y0}" x2="260" y2="12">
        <stop offset="0" stop-color="currentColor" stop-opacity="0"/><stop offset="1" stop-color="currentColor" stop-opacity=".16"/></linearGradient></defs>
      <path d="M260 260 L${x0} ${y0} A${R} ${R} 0 0 1 260 12 Z" fill="url(#swg)"/>
      <line x1="260" y1="260" x2="260" y2="12" stroke="currentColor" stroke-opacity=".38" stroke-width="1"/>`;
    svg.insertBefore(g, $('.r-home', svg));
    const dots = $$('.r-dot:not(.c)', svg).map((d) => {
      const cx = +d.getAttribute('cx') - 260, cy = 260 - +d.getAttribute('cy');
      let b = (Math.atan2(cx, cy) * 180) / Math.PI; if (b < 0) b += 360;
      return { d, b };
    });
    let ang = 0, prev = 0;
    visibleLoop(root, (t, dt) => {
      ang = (ang + dt * 52) % 360; // оборот за ~7 с
      g.setAttribute('transform', `rotate(${ang.toFixed(2)} 260 260)`);
      for (const p of dots) {
        const crossed = prev <= ang ? p.b > prev && p.b <= ang : p.b > prev || p.b <= ang;
        if (crossed) gsap.fromTo(p.d, { attr: { r: 6 } }, { attr: { r: 11 }, duration: 0.35, ease: 'power2.out', yoyo: true, repeat: 1 });
      }
      prev = ang;
    });
  }

  /* ---------- 5. Колода: верхняя карточка покачивается — «меня можно тянуть» ---------- */
  function deckHint() {
    const deck = $('#deck');
    if (!deck) return;
    const io = new IntersectionObserver((e) => {
      if (!e[0].isIntersecting || deck.classList.contains('is-row')) return;
      io.disconnect();
      const top = $$('.d-card', deck).find((c) => c.getAttribute('aria-hidden') === 'false');
      if (!top) return;
      const x = gsap.getProperty(top, 'x'), r = gsap.getProperty(top, 'rotation');
      gsap.timeline({ delay: 0.6 })
        .to(top, { x: x + 54, rotation: r + 4, duration: 0.45, ease: 'power2.out' })
        .to(top, { x, rotation: r, duration: 1.1, ease: 'elastic.out(1, .45)' });
    }, { threshold: 0.6 });
    io.observe(deck);
  }

  /* ---------- 6. Искры над камином в финале ---------- */
  function embers() {
    const sec = $('#final');
    if (!sec) return;
    const cv = document.createElement('canvas');
    cv.className = 'embers'; cv.setAttribute('aria-hidden', 'true');
    $('.final-shade', sec).after(cv);
    const ctx = cv.getContext('2d');
    const N = innerWidth < 768 ? 26 : 54;
    const rnd = (a, b) => a + Math.random() * (b - a);
    let W = 1, H = 1, dpr = 1;
    const resize = () => { dpr = fitCanvas(cv, sec, 1.25); W = cv.width; H = cv.height; };
    new ResizeObserver(resize).observe(sec); resize();
    // искры рождаются у экрана с огнём (справа внизу кадра) и поднимаются вверх
    const spawn = (p, first) => {
      p.x = W * rnd(0.56, 0.98); p.y = first ? rnd(0, H) : H * rnd(0.62, 0.9);
      p.vy = rnd(18, 52) * dpr; p.vx = rnd(-8, 4) * dpr; p.r = rnd(0.6, 1.9) * dpr;
      p.life = 0; p.max = rnd(3.5, 8); p.ph = rnd(0, 6.28);
      return p;
    };
    const P = Array.from({ length: N }, () => spawn({}, true));
    visibleLoop(sec, (t, dt) => {
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      for (const p of P) {
        p.life += dt;
        p.y -= p.vy * dt; p.x += (p.vx + Math.sin(t * 1.3 + p.ph) * 10 * dpr) * dt;
        if (p.life > p.max || p.y < -10) spawn(p);
        const k = p.life / p.max;
        const al = Math.sin(Math.PI * Math.min(1, k)) * (0.55 + 0.45 * Math.sin(t * 9 + p.ph)) * 0.75;
        if (al <= 0.01) continue;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
        g.addColorStop(0, `rgba(255,214,150,${al})`); g.addColorStop(0.35, `rgba(243,162,90,${al * 0.55})`); g.addColorStop(1, 'rgba(228,87,46,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 4, 0, 6.2832); ctx.fill();
      }
    });
  }

  /* ---------- 7. Комната чуть следует за курсором (hero) ---------- */
  function heroParallax() {
    if (!FINE || !matchMedia('(min-width: 901px) and (min-aspect-ratio: 4/5)').matches) return;
    const hero = $('#top'), stage = $('#heroStage'), content = $('.hero-content', hero);
    const sx = gsap.quickTo(stage, 'xPercent', { duration: 1.4, ease: 'power3.out' }), sy = gsap.quickTo(stage, 'yPercent', { duration: 1.4, ease: 'power3.out' });
    const cx = gsap.quickTo(content, 'x', { duration: 1.6, ease: 'power3.out' }), cy = gsap.quickTo(content, 'y', { duration: 1.6, ease: 'power3.out' });
    hero.addEventListener('pointermove', (e) => {
      const nx = e.clientX / innerWidth - 0.5, ny = e.clientY / innerHeight - 0.5;
      sx(-nx * 1.4); sy(-ny * 1.2); cx(nx * 10); cy(ny * 6);
    });
    hero.addEventListener('pointerleave', () => { sx(0); sy(0); cx(0); cy(0); });
  }

  PRIV.ambient = {
    init() {
      lamp(); // работает и без анимаций
      if (PRIV.rm) return;
      motes(); magnets(); sweep(); deckHint(); embers(); heroParallax();
    },
  };
})();
