/* ==========================================================================
   details.js — «Всё уже на месте» (фото детали плывёт за курсором,
   на тач-экранах — аккордеон) и «Разгладьте простыню» (утюг стирает мятость)
   ========================================================================== */
(function () {
  'use strict';
  const PRIV = (window.PRIV = window.PRIV || {});
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const desk = () => matchMedia('(pointer: fine) and (min-width: 1024px)').matches;

  /* ---------------- 5. Список с фото под курсором ---------------- */
  function initList() {
    const C = window.SITE, U = PRIV.u;
    const list = $('#insideList');
    if (!list) return;
    list.innerHTML = C.checklist.map((it, i) => `
      <li data-rv>
        <button class="inside-row" type="button" aria-expanded="false" data-img="${it.img}" data-alt="${it.alt}">
          <span class="mono">${String(i + 1).padStart(2, '0')}</span><span>${it.text}</span>
        </button>
        <div class="inside-acc"><div><div class="pp"><div class="pp-in">
          ${U.pic(it.img, { alt: it.alt, sizesAttr: '92vw', w: 4, h: 3 })}
        </div></div></div></div>
      </li>`).join('');
    $('.js-more').textContent = C.checklistMore.join(' · ');

    const rows = $$('.inside-row', list);
    // тач / узкий экран: тап раскрывает фото под строкой
    rows.forEach((r) => r.addEventListener('click', () => {
      if (desk()) return;
      const li = r.parentElement, open = !li.classList.contains('is-open');
      li.classList.toggle('is-open', open);
      r.setAttribute('aria-expanded', String(open));
      r.classList.toggle('is-active', open);
    }));

    // десктоп: одно плавающее превью 320×240 с инерцией и наклоном по скорости
    const prev = $('#insidePreview');
    const imgs = $$('img', prev);
    let front = 0, curSrc = '', active = null, on = false, raf = 0;
    let mx = 0, my = 0, x = 0, y = 0, lastX = 0, rot = 0;
    const W = 320, H = 240;

    const show = (row) => {
      if (row === active) return;
      if (active) active.classList.remove('is-active');
      active = row;
      list.classList.toggle('is-hover', !!row);
      if (!row) { prev.classList.remove('is-on'); on = false; return; }
      row.classList.add('is-active');
      const src = U.src(row.dataset.img, 'jpg');
      if (src !== curSrc) {
        curSrc = src;
        const back = imgs[1 - front];
        const swap = () => { imgs[front].classList.remove('is-front'); back.classList.add('is-front'); front = 1 - front; };
        back.onload = null;
        if (back.getAttribute('src') === src && back.complete) swap();
        else { back.onload = () => { back.onload = null; if (curSrc === src) swap(); }; back.src = src; }
        back.alt = row.dataset.alt;
      }
      if (!on) { x = mx; y = my; prev.classList.add('is-on'); on = true; }
      loop();
    };
    const loop = () => {
      if (raf) return;
      const tick = () => {
        raf = 0;
        x += (mx - x) * 0.12; y += (my - y) * 0.12;
        const v = x - lastX; lastX = x;
        rot += (gsap.utils.clamp(-8, 8, v * 0.6) - rot) * 0.15; // наклон по скорости: clamp(velocityX · k, −8, 8)
        const px = Math.min(innerWidth - W - 16, x + 28), py = Math.min(innerHeight - H - 16, Math.max(16, y - H / 2));
        prev.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0) rotate(${rot.toFixed(2)}deg)`;
        if (on || Math.abs(mx - x) > 0.5) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    const pick = () => {
      const el = document.elementFromPoint(mx, my);
      const row = el && el.closest('.inside-row');
      show(row && list.contains(row) ? row : null);
    };
    list.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || !desk()) return;
      mx = e.clientX; my = e.clientY; pick();
    });
    list.addEventListener('pointerleave', () => show(null));
    // при прокрутке колесом строка под курсором меняется
    PRIV.onScroll && PRIV.onScroll(() => { if (on) pick(); });

    // предзагрузка превью при подходе к блоку
    const io = new IntersectionObserver((ents) => {
      if (!ents[0].isIntersecting) return;
      io.disconnect();
      if (desk()) rows.forEach((r) => { const i = new Image(); i.src = U.src(r.dataset.img, 'jpg'); });
    }, { rootMargin: '400px 0px' });
    io.observe(list);
  }

  /* ---------------- 6. «Разгладьте простыню» ---------------- */
  function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  function initIron() {
    const stage = $('#ironStage');
    if (!stage) return;
    const canvas = $('#ironCanvas'), img = $('.iron-img', stage);
    const done = $('.iron-done', stage), reset = $('.iron-reset'), hint = $('.iron-hint');
    const steamBox = $('.iron-steam', stage);
    if (PRIV.rm) { canvas.hidden = true; hint.hidden = true; return; }
    canvas.setAttribute('data-cursor', 'iron');

    let ctx, W = 0, H = 0, scaleK = 1, crumpled = null, ready = false, finished = false;
    let last = null, dirty = false, timer = 0, sheetMask = [];
    const probe = document.createElement('canvas'); probe.width = 96; probe.height = 72;
    const pctx = probe.getContext('2d', { willReadFrequently: true });

    // value-noise для поля смещений
    const R = rng(23);
    const G = 64, grid = new Float32Array((G + 1) * (G + 1));
    for (let i = 0; i < grid.length; i++) grid[i] = R();
    const vn = (x, y) => {
      x = ((x % G) + G) % G; y = ((y % G) + G) % G;
      const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
      const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
      const a = grid[yi * (G + 1) + xi], b = grid[yi * (G + 1) + xi + 1], c = grid[(yi + 1) * (G + 1) + xi], d = grid[(yi + 1) * (G + 1) + xi + 1];
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
    // «гребни» складок: 1 − |2n − 1|, три октавы
    const ridged = (x, y) => {
      let s = 0, amp = 0.55, f = 1;
      for (let o = 0; o < 3; o++) { s += amp * (1 - Math.abs(2 * vn(x * f, y * f) - 1)); f *= 2.1; amp *= 0.5; }
      return s;
    };

    function build() {
      const rect = stage.getBoundingClientRect();
      if (!rect.width || !img.naturalWidth) return;
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      W = Math.min(1100, Math.round(rect.width * dpr)); H = Math.round(W * (rect.height / rect.width));
      scaleK = W / rect.width;
      canvas.width = W; canvas.height = H;
      ctx = canvas.getContext('2d', { willReadFrequently: false });

      // 1) гладкое фото в offscreen
      const off = document.createElement('canvas'); off.width = W; off.height = H;
      const ox = off.getContext('2d'); ox.drawImage(img, 0, 0, W, H);
      const src = ox.getImageData(0, 0, W, H), out = ox.createImageData(W, H);
      const sd = src.data, od = out.data;

      // 2) где мять: белое бельё и подушки (светлые, почти без цвета, ниже окна)
      const S = 4, gw = Math.ceil(W / S) + 2, gh = Math.ceil(H / S) + 2;
      let mk = new Float32Array(gw * gh);
      for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
        const x = Math.min(W - 1, i * S), y = Math.min(H - 1, j * S), k = (y * W + x) * 4;
        const r = sd[k], g = sd[k + 1], b = sd[k + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        const lumW = gsap.utils.clamp(0, 1, (mx - 168) / 40), satW = gsap.utils.clamp(0, 1, 1 - (mx - mn - 10) / 22);
        const yy = y / H, zone = gsap.utils.clamp(0, 1, (yy - 0.27) / 0.08) * gsap.utils.clamp(0, 1, (0.74 - yy) / 0.06);
        mk[j * gw + i] = lumW * satW * zone;
      }
      // размываем маску, чтобы края складок были мягкими
      for (let pass = 0; pass < 3; pass++) {
        const t = new Float32Array(mk.length);
        for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
          let acc = 0, n = 0;
          for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
            const ii = i + di, jj = j + dj;
            if (ii >= 0 && jj >= 0 && ii < gw && jj < gh) { acc += mk[jj * gw + ii]; n++; }
          }
          t[j * gw + i] = acc / n;
        }
        mk = t;
      }
      // поле высот складок: вытянутые «гребни» (ridged fbm), на той же грубой сетке
      const hf = new Float32Array(gw * gh), fq = 7 / W;
      for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
        const x = i * S * fq, y = j * S * fq;
        hf[j * gw + i] = ridged(x * 0.8 + y * 0.35, y * 1.7 - x * 0.2) * 0.75 + vn(x * 0.5 + 11, y * 0.5 + 3) * 0.25;
      }
      const bil = (arr, x, y) => {
        const gx = Math.max(0, x / S), gy = Math.max(0, y / S);
        const i = Math.min(gw - 2, Math.floor(gx)), j = Math.min(gh - 2, Math.floor(gy)), fx = gx - i, fy = gy - j;
        const a = arr[j * gw + i], b = arr[j * gw + i + 1], c = arr[(j + 1) * gw + i], d = arr[(j + 1) * gw + i + 1];
        return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
      };
      const disp = 8 * (W / 1000);               // смещение пикселей по fbm-шуму: 6–10 px
      const e = 3;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const oi = (y * W + x) * 4;
          const m = bil(mk, x, y);
          if (m < 0.02) { od[oi + 3] = 0; continue; } // вне белья — прозрачно, снизу то же фото
          const hx = (bil(hf, x + e, y) - bil(hf, x - e, y)) / (2 * e) * W / 7;
          const hy = (bil(hf, x, y + e) - bil(hf, x, y - e)) / (2 * e) * W / 7;
          // билинейная выборка со смещением — без «ступенек»
          const fxp = gsap.utils.clamp(0, W - 1.001, x + hx * disp * 0.4 * m), fyp = gsap.utils.clamp(0, H - 1.001, y + hy * disp * 0.4 * m);
          const x0 = fxp | 0, y0 = fyp | 0, ax = fxp - x0, ay = fyp - y0;
          const i00 = (y0 * W + x0) * 4, i10 = i00 + 4, i01 = i00 + W * 4, i11 = i01 + 4;
          // свет сверху-слева: склоны складок чуть темнее или светлее
          const shade = 1 + gsap.utils.clamp(-0.26, 0.1, (hx * 0.55 + hy * 0.85) * -0.21) * m;
          for (let c = 0; c < 3; c++) {
            const v = (sd[i00 + c] * (1 - ax) + sd[i10 + c] * ax) * (1 - ay) + (sd[i01 + c] * (1 - ax) + sd[i11 + c] * ax) * ay;
            od[oi + c] = v * shade;
          }
          od[oi + 3] = Math.min(255, m * 1.4 * 255);
        }
      }
      ctx.putImageData(out, 0, 0);
      // 3) тени складок: полупрозрачные градиентные полосы multiply под случайными углами,
      //    только там, где бельё (маска переносится через source-atop)
      const r2 = rng(7);
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      for (let i = 0; i < 14; i++) {
        const cx = W * (0.08 + r2() * 0.84), cy = H * (0.36 + r2() * 0.34), ang = (r2() - 0.5) * 1.3;
        const len = W * (0.12 + r2() * 0.3), wd = (3 + r2() * 6) * (W / 1000);
        ctx.setTransform(Math.cos(ang), Math.sin(ang), -Math.sin(ang), Math.cos(ang), cx, cy);
        const g = ctx.createLinearGradient(0, -wd, 0, wd);
        g.addColorStop(0, 'rgba(90,80,70,0)'); g.addColorStop(0.42, 'rgba(90,80,70,.13)');
        g.addColorStop(0.58, 'rgba(255,255,255,.10)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.globalAlpha = 0.9;
        ctx.beginPath(); ctx.ellipse(0, 0, len / 2, wd, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      // какая часть кадра вообще мятая — для подсчёта «разглажено 70 %»
      pctx.clearRect(0, 0, 96, 72); pctx.drawImage(canvas, 0, 0, 96, 72);
      const pd = pctx.getImageData(0, 0, 96, 72).data;
      sheetMask = [];
      for (let i = 3; i < pd.length; i += 4) if (pd[i] > 140) sheetMask.push(i);
      crumpled = ctx.getImageData(0, 0, W, H);
      ctx.globalCompositeOperation = 'destination-out';
      ready = true; finished = false;
    }

    function brush(x, y) {
      const r = (matchMedia('(pointer: coarse)').matches ? 45 : 60) * scaleK;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.55, 'rgba(0,0,0,.85)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    function stroke(x, y) {
      if (last) {
        // непрерывный след: промежуточные точки между событиями
        const dx = x - last.x, dy = y - last.y, dist = Math.hypot(dx, dy), step = 12 * scaleK;
        for (let s = step; s < dist; s += step) brush(last.x + (dx * s) / dist, last.y + (dy * s) / dist);
      }
      brush(x, y);
      last = { x, y };
      dirty = true;
    }

    // доля разглаженной площади — по уменьшенной копии (прореженная выборка)
    function measure() {
      if (!dirty || finished) return;
      dirty = false;
      pctx.clearRect(0, 0, 96, 72);
      pctx.drawImage(canvas, 0, 0, 96, 72);
      const d = pctx.getImageData(0, 0, 96, 72).data;
      // прореженная выборка: каждый 4-й пиксель мятой области
      let clear = 0, n = 0;
      for (let k = 0; k < sheetMask.length; k += 4) { n++; if (d[sheetMask[k]] < 70) clear++; }
      if (n && clear / n >= 0.7) finish();
    }
    function finish() {
      finished = true;
      canvas.classList.add('is-gone');
      done.textContent = 'Готово. Так и будет, когда вы приедете.';
      done.classList.add('is-on');
      reset.hidden = false; hint.hidden = true;
    }
    reset.addEventListener('click', () => {
      if (!crumpled) return;
      ctx.globalCompositeOperation = 'source-over';
      ctx.putImageData(crumpled, 0, 0);
      ctx.globalCompositeOperation = 'destination-out';
      canvas.classList.remove('is-gone');
      done.classList.remove('is-on');
      reset.hidden = true; hint.hidden = false; finished = false; last = null;
    });

    // пар за утюгом: пул из 5 кружков, без утечек
    const pool = Array.from({ length: 5 }, () => { const s = document.createElement('span'); steamBox.appendChild(s); return s; });
    let pi = 0, lastSteam = 0;
    function steam(cx, cy) {
      const now = performance.now();
      if (now - lastSteam < 90) return;
      lastSteam = now;
      const s = pool[pi++ % pool.length];
      gsap.killTweensOf(s);
      gsap.fromTo(s, { x: cx + (Math.random() - 0.5) * 16, y: cy - 10, scale: 0.6, opacity: 0.55 },
        { x: `+=${(Math.random() - 0.5) * 22}`, y: cy - 58, scale: 1.5, opacity: 0, duration: 0.8, ease: 'power1.out' });
    }

    const pos = (e) => { const r = canvas.getBoundingClientRect(); return { cx: e.clientX - r.left, cy: e.clientY - r.top, x: (e.clientX - r.left) * scaleK, y: (e.clientY - r.top) * scaleK }; };
    let down = false;
    canvas.addEventListener('pointerdown', (e) => { down = true; last = null; if (ready && !finished) { const p = pos(e); stroke(p.x, p.y); } });
    window.addEventListener('pointerup', () => { down = false; last = null; });
    canvas.addEventListener('pointerleave', () => { last = null; });
    canvas.addEventListener('pointercancel', () => { down = false; last = null; });
    canvas.addEventListener('pointermove', (e) => {
      if (!ready || finished) return;
      // мышь гладит без нажатия, палец — при касании
      if (e.pointerType !== 'mouse' && !down) return;
      const p = pos(e);
      stroke(p.x, p.y);
      steam(p.cx, p.cy);
    });

    const start = () => {
      build();
      clearInterval(timer);
      timer = setInterval(measure, 300);
    };
    const io = new IntersectionObserver((ents) => {
      if (!ents[0].isIntersecting) return;
      io.disconnect();
      if (img.complete && img.naturalWidth) start();
      else { img.loading = 'eager'; img.addEventListener('load', start, { once: true }); }
    }, { rootMargin: '500px 0px' });
    io.observe(stage);
    let rt = 0;
    new ResizeObserver(() => {
      if (!ready) return;
      clearTimeout(rt);
      rt = setTimeout(() => { if (Math.abs(stage.getBoundingClientRect().width * scaleK - W) > 40 && !finished) build(); }, 250);
    }).observe(stage);
  }

  PRIV.details = { init() { initList(); initIron(); } };
})();
