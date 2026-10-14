/* ==========================================================================
   gallery.js — журнальный разворот на один экран: 5 фото + плитка «ещё N»,
   фильтры через GSAP Flip, лайтбокс с морфингом из карточки, свайпом,
   зумом, лентой миниатюр и клавиатурой. На телефоне — горизонтальная лента.
   ========================================================================== */
(function () {
  'use strict';
  const PRIV = (window.PRIV = window.PRIV || {});
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const pad = (n) => String(n).padStart(2, '0');
  const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 12 || h > 14) ? b : c; };

  // Разворот: сетка 12 колонок × 6 рядов на высоту экрана.
  // [колонка-от, колонка-до, ряд-от, ряд-до] для каждого числа плиток.
  const TPL = {
    6: [[1, 8, 1, 5], [8, 13, 1, 4], [1, 4, 5, 7], [4, 8, 5, 7], [8, 10, 4, 7], [10, 13, 4, 7]],
    5: [[1, 8, 1, 5], [8, 13, 1, 4], [1, 5, 5, 7], [5, 8, 5, 7], [8, 13, 4, 7]],
    4: [[1, 8, 1, 7], [8, 13, 1, 4], [8, 11, 4, 7], [11, 13, 4, 7]],
    3: [[1, 8, 1, 7], [8, 13, 1, 4], [8, 13, 4, 7]],
    2: [[1, 8, 1, 7], [8, 13, 1, 7]],
    1: [[1, 13, 1, 7]],
  };
  const area = (t) => `${t[2]} / ${t[0]} / ${t[3]} / ${t[1]}`;
  const strip = () => matchMedia('(max-width: 767px)').matches;

  function init() {
    const C = window.SITE, U = PRIV.u;
    const mosaic = $('#mosaic'), filters = $('#galFilters');
    if (!mosaic) return;
    const data = C.gallery;

    filters.innerHTML = C.galleryFilters.map((f, i) =>
      `<button class="chip" type="button" data-f="${f.id}" aria-pressed="${i === 0}">${f.label}</button>`).join('');
    mosaic.innerHTML = data.map((d, i) => `
      <figure class="g-item" data-cat="${d.cat}" data-i="${i}">
        <button class="g-open" type="button" data-cursor="view" aria-label="Открыть фото: ${d.caption}">
          <div class="pp"><div class="pp-in">
            ${U.pic(d.src, { sizes: d.sizes, w: d.w, h: d.h, alt: d.caption.replace(' · ', ': '), sizesAttr: '(min-width: 1024px) 58vw, 80vw', pick: 900 })}
          </div></div>
        </button>
        <figcaption class="cap mono">${d.caption}</figcaption>
      </figure>`).join('') + `
      <button class="g-more" type="button" data-cursor="view" hidden>
        <span class="pp"><span class="pp-in"><img alt="" loading="lazy" decoding="async"></span></span>
        <span class="g-more-in"><b class="g-more-n">+27</b><span class="mono g-more-t">фото · смотреть все</span></span>
      </button>`;
    const items = $$('.g-item', mosaic);
    const more = $('.g-more', mosaic), moreImg = $('img', more), moreN = $('.g-more-n', more), moreT = $('.g-more-t', more);
    const allBtn = $('.gal-all'), allN = $('.js-gal-n');
    let visible = items.slice();

    // раскладка: на десктопе — разворот с плиткой «ещё», на телефоне — вся лента
    function layout() {
      const n = visible.length;
      items.forEach((el) => { el.style.display = 'none'; el.style.gridArea = ''; el.classList.remove('is-hero'); });
      allN.textContent = `${n} ${plural(n, 'фото', 'фото', 'фото')}`;
      if (strip()) {
        visible.forEach((el) => (el.style.display = ''));
        more.hidden = true;
        return;
      }
      const slots = Math.min(n, 6), withMore = n > 6;
      const tpl = TPL[slots];
      const shown = visible.slice(0, withMore ? 5 : slots);
      shown.forEach((el, i) => { el.style.display = ''; el.style.gridArea = area(tpl[i]); el.classList.toggle('is-hero', i === 0); });
      more.hidden = !withMore;
      if (withMore) {
        more.style.gridArea = area(tpl[5]);
        const d = data[+visible[5].dataset.i];
        moreImg.src = U.src(d.src, 'jpg', d.sizes ? d.sizes[0] : null);
        moreN.textContent = `+${n - 5}`;
        moreT.textContent = 'фото · смотреть все';
      }
    }
    layout();

    // появление разворота: рамки раскрываются от центра по очереди.
    // Свой триггер на всю мозаику — у скрытых (display:none) плиток триггеров быть не должно.
    if (!PRIV.rm) {
      const shown = () => [...items.filter((el) => el.style.display !== 'none'), ...(more.hidden ? [] : [more])];
      const first = shown();
      const pps = first.map((t) => $('.pp', t)), pics = first.map((t) => $('.pp-in > picture, .pp-in > img', t));
      gsap.set(pps, { clipPath: 'inset(12% 12% 12% 12%)' });
      gsap.set(pics, { scale: 1.08 });
      ScrollTrigger.create({
        trigger: mosaic, start: 'top 82%', once: true,
        onEnter: () => {
          gsap.to(pps, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, stagger: 0.08, ease: 'expo.out' });
          gsap.to(pics, { scale: 1, duration: 1.4, stagger: 0.08, ease: 'expo.out' });
        },
      });
    }

    /* — фильтр через Flip — */
    const chips = $$('.chip', filters);
    let cur = 'all';
    filters.addEventListener('click', (e) => {
      const b = e.target.closest('.chip');
      if (!b || b.dataset.f === cur) return;
      cur = b.dataset.f;
      chips.forEach((c) => c.setAttribute('aria-pressed', String(c === b)));
      const st = PRIV.rm ? null : Flip.getState([...items, more]);
      visible = items.filter((el) => cur === 'all' || el.dataset.cat === cur);
      layout();
      // фото внутри новых карточек должны быть видны сразу (их reveal мог ещё не пройти)
      [...visible, more].forEach((el) => { const pp = $('.pp', el); gsap.killTweensOf(pp); pp.style.clipPath = 'none'; gsap.set($('.pp-in > picture, .pp-in > img', pp), { scale: 1 }); });
      if (strip()) mosaic.scrollTo({ left: 0 });
      if (st) {
        Flip.from(st, {
          duration: 0.7, ease: 'power3.inOut', absolute: true, nested: true, prune: true,
          onEnter: (els) => gsap.fromTo(els, { opacity: 0, scale: 0.92 }, { opacity: 1, scale: 1, duration: 0.6, delay: 0.15, stagger: 0.05, ease: 'power3.out' }),
          onLeave: (els) => gsap.to(els, { opacity: 0, scale: 0.92, duration: 0.35, ease: 'power2.in' }),
        });
      }
    });
    let rz = 0, wasStrip = strip();
    addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (strip() !== wasStrip) { wasStrip = strip(); layout(); } }, 150); });

    /* ---------------- лайтбокс ---------------- */
    const lb = $('#lb'), stage = $('.lb-stage', lb), zoomEl = $('.lb-zoom', lb), img = $('.lb-img', lb);
    const bg = $('.lb-bg', lb), thumbs = $('.lb-thumbs', lb);
    const nEl = $('.js-lbn', lb), tEl = $('.js-lbt', lb), capEl = $('.js-lbcap', lb);
    let list = [], idx = 0, opener = null, open = false, rect = null;
    let z = 1, tx = 0, ty = 0; // зум и сдвиг

    const best = (d) => U.src(d.src, 'jpg', d.sizes ? d.sizes[d.sizes.length - 1] : null);
    // посадка фото в сцену (contain) — считаем сами, чтобы морфинг был точным
    function fit(d) {
      const sw = stage.clientWidth, sh = stage.clientHeight;
      const s = Math.min(sw / d.w, sh / d.h);
      const w = Math.round(d.w * s), h = Math.round(d.h * s);
      return { w, h, x: Math.round((sw - w) / 2), y: Math.round((sh - h) / 2) };
    }
    function place(d) {
      rect = fit(d);
      img.style.width = rect.w + 'px'; img.style.height = rect.h + 'px';
      setZoom(1, 0, 0, true);
    }
    function setZoom(nz, nx, ny, instant) {
      z = Math.min(3, Math.max(1, nz));
      // ограничение краёв при зуме
      const maxX = Math.max(0, (rect.w * z - stage.clientWidth) / 2), maxY = Math.max(0, (rect.h * z - stage.clientHeight) / 2);
      const minX = (rect.w * (1 - z)) / 2 - maxX, minY = (rect.h * (1 - z)) / 2 - maxY;
      const midX = (rect.w * (1 - z)) / 2, midY = (rect.h * (1 - z)) / 2;
      tx = z === 1 ? 0 : Math.min(midX + maxX, Math.max(minX, nx));
      ty = z === 1 ? 0 : Math.min(midY + maxY, Math.max(minY, ny));
      const tr = `translate(${rect.x + tx}px, ${rect.y + ty}px) scale(${z})`;
      if (instant || PRIV.rm) { gsap.killTweensOf(zoomEl); zoomEl.style.transform = tr; }
      else gsap.to(zoomEl, { transform: tr, duration: 0.35, ease: 'power3.out', overwrite: true });
    }
    // зум относительно точки (px, py — координаты внутри сцены)
    function zoomAt(nz, px, py, instant) {
      nz = Math.min(3, Math.max(1, nz));
      const ix = (px - rect.x - tx) / z, iy = (py - rect.y - ty) / z;
      setZoom(nz, px - rect.x - ix * nz, py - rect.y - iy * nz, instant);
    }

    function show(i, dir) {
      idx = (i + list.length) % list.length;
      const d = list[idx];
      nEl.textContent = pad(idx + 1); tEl.textContent = pad(list.length);
      capEl.textContent = d.caption;
      img.alt = d.caption.replace(' · ', ': ');
      place(d);
      const thumb = U.src(d.src, 'jpg', d.sizes ? d.sizes[0] : null);
      img.src = thumb;
      const big = new Image(); big.src = best(d);
      big.decode ? big.decode().then(() => { if (list[idx] === d) img.src = big.src; }).catch(() => {}) : (big.onload = () => { if (list[idx] === d) img.src = big.src; });
      $$('.lb-thumb', thumbs).forEach((t, k) => t.setAttribute('aria-selected', String(k === idx)));
      const at = thumbs.children[idx];
      if (at) thumbs.scrollTo({ left: at.offsetLeft - thumbs.clientWidth / 2 + at.offsetWidth / 2, behavior: PRIV.rm ? 'auto' : 'smooth' });
      if (dir && !PRIV.rm) gsap.fromTo(img, { x: dir * 60, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, ease: 'expo.out' });
      // предзагрузка соседних
      [1, -1].forEach((s) => { const n = list[(idx + s + list.length) % list.length]; const p = new Image(); p.src = best(n); });
    }

    // морфинг карточка ↔ полный экран: transform + clip-path, без анимации размеров
    function morph(fromEl, reverse, done) {
      const r = fromEl.getBoundingClientRect(), sr = stage.getBoundingClientRect();
      const fx = sr.left + rect.x, fy = sr.top + rect.y;
      const s = Math.max(r.width / rect.w, r.height / rect.h);
      const vw = r.width / s, vh = r.height / s; // видимая часть фото в масштабе финала
      const ix = (rect.w - vw) / 2, iy = (rect.h - vh) / 2;
      const from = {
        x: r.left - fx - ix * s, y: r.top - fy - iy * s, scale: s, transformOrigin: '0 0',
        clipPath: `inset(${iy}px ${ix}px ${iy}px ${ix}px)`,
      };
      const to = { x: 0, y: 0, scale: 1, clipPath: 'inset(0px 0px 0px 0px)' };
      const opt = { duration: 0.55, ease: 'cubic-bezier(.7,0,.2,1)' };
      if (!reverse) gsap.fromTo(img, from, { ...to, ...opt, onComplete: done });
      else gsap.fromTo(img, to, { ...from, ...opt, onComplete: done });
    }

    function openAt(i, fromBtn) {
      list = visible.map((el) => data[+el.dataset.i]);
      opener = fromBtn;
      thumbs.innerHTML = list.map((d, k) =>
        `<button class="lb-thumb" type="button" role="option" aria-selected="false" aria-label="Фото ${k + 1}: ${d.caption}">${U.pic(d.src, { sizes: d.sizes, w: d.w, h: d.h, alt: '', pick: 0, sizesAttr: '92px' })}</button>`).join('');
      lb.hidden = false; open = true;
      document.body.style.overflow = 'hidden';
      PRIV.lenis && PRIV.lenis.stop();
      show(i);
      const cardImg = $('img', fromBtn);
      img.src = cardImg.currentSrc || cardImg.src; // сначала тот же кадр, что в карточке
      if (PRIV.rm) { $('.lb-close', lb).focus(); return; }
      gsap.fromTo(bg, { opacity: 0 }, { opacity: 1, duration: 0.45 });
      gsap.fromTo($$('.lb-top, .lb-prev, .lb-next, .lb-thumbs', lb), { opacity: 0 }, { opacity: 1, duration: 0.4, delay: 0.25 });
      fromBtn.style.visibility = 'hidden';
      morph(cardImg.closest('.pp-in'), false, () => { fromBtn.style.visibility = ''; });
      $('.lb-close', lb).focus({ preventScroll: true });
    }

    function close() {
      if (!open) return;
      open = false;
      const d = list[idx];
      const card = items.find((el) => data[+el.dataset.i] === d);
      const btn = card && $('.g-open', card);
      const fin = () => {
        lb.hidden = true; gsap.set(img, { clearProps: 'all' });
        document.body.style.overflow = '';
        PRIV.lenis && PRIV.lenis.start();
        if (btn) { btn.style.visibility = ''; btn.focus({ preventScroll: true }); } else if (opener) opener.focus({ preventScroll: true });
      };
      const r = btn && btn.getBoundingClientRect();
      const inView = r && r.bottom > 0 && r.top < innerHeight && card.style.display !== 'none';
      if (PRIV.rm || !inView || z !== 1) { fin(); return; }
      gsap.to($$('.lb-top, .lb-prev, .lb-next, .lb-thumbs', lb), { opacity: 0, duration: 0.25 });
      gsap.to(bg, { opacity: 0, duration: 0.5, delay: 0.1 });
      btn.style.visibility = 'hidden';
      setZoom(1, 0, 0, true);
      morph($('.pp-in', btn), true, fin);
    }

    mosaic.addEventListener('click', (e) => {
      const b = e.target.closest('.g-open');
      if (!b) return;
      openAt(visible.indexOf(b.closest('.g-item')), b);
    });
    more.addEventListener('click', () => openAt(5, more));
    allBtn.addEventListener('click', () => { const first = visible.find((el) => el.style.display !== 'none'); openAt(0, first ? $('.g-open', first) : allBtn); });
    $('.lb-close', lb).addEventListener('click', close);
    $('.lb-prev', lb).addEventListener('click', () => show(idx - 1, -1));
    $('.lb-next', lb).addEventListener('click', () => show(idx + 1, 1));
    thumbs.addEventListener('click', (e) => { const t = e.target.closest('.lb-thumb'); if (t) show([...thumbs.children].indexOf(t), 0); });
    bg.addEventListener('click', close);

    // клавиатура + фокус-ловушка
    lb.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); show(idx + 1, 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); show(idx - 1, -1); }
      else if (e.key === 'Tab') {
        const f = $$('button:not([hidden])', lb).filter((b) => b.offsetParent !== null);
        const first = f[0], lastB = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastB.focus(); }
        else if (!e.shiftKey && document.activeElement === lastB) { e.preventDefault(); first.focus(); }
      }
    });

    // колёсико — зум 1–3×
    stage.addEventListener('wheel', (e) => {
      e.preventDefault();
      const sr = stage.getBoundingClientRect();
      zoomAt(z * (e.deltaY < 0 ? 1.18 : 1 / 1.18), e.clientX - sr.left, e.clientY - sr.top);
    }, { passive: false });

    // жесты: свайп (порог 50 px), перетаскивание при зуме, pinch, двойной тап
    const pts = new Map();
    let startX = 0, startY = 0, baseTx = 0, baseTy = 0, pinch0 = 0, z0 = 1, lastTap = 0, moved = false;
    stage.addEventListener('pointerdown', (e) => {
      stage.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      startX = e.clientX; startY = e.clientY; baseTx = tx; baseTy = ty; moved = false;
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); z0 = z; }
    });
    stage.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const sr = stage.getBoundingClientRect();
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        zoomAt(z0 * (d / pinch0), (a.x + b.x) / 2 - sr.left, (a.y + b.y) / 2 - sr.top, true);
        moved = true; return;
      }
      const dx = e.clientX - startX, dy = e.clientY - startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true;
      if (z > 1) setZoom(z, baseTx + dx, baseTy + dy, true);
      else gsap.set(img, { x: dx * 0.6 });
    });
    const up = (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      if (pts.size) return;
      const dx = e.clientX - startX;
      if (z === 1 && moved) {
        if (Math.abs(dx) > 50) show(idx + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
        else gsap.to(img, { x: 0, duration: 0.3, ease: 'power3.out' });
      }
      if (!moved) {
        const now = performance.now();
        if (now - lastTap < 300) {
          const sr = stage.getBoundingClientRect();
          if (z > 1) setZoom(1, 0, 0); else zoomAt(2, e.clientX - sr.left, e.clientY - sr.top);
          lastTap = 0;
        } else lastTap = now;
      }
    };
    stage.addEventListener('pointerup', up);
    stage.addEventListener('pointercancel', up);
    img.addEventListener('dragstart', (e) => e.preventDefault());
    addEventListener('resize', () => { if (open) place(list[idx]); });

    /* — тизер-видео: ленивая подстановка src — */
    const v = $('.teaser-video');
    if (v) {
      const io = new IntersectionObserver((ents) => {
        ents.forEach((en) => {
          if (en.isIntersecting) {
            if (!v.src) { v.src = v.dataset.src; v.load(); }
            if (!PRIV.rm) v.play().catch(() => {});
          } else if (!v.paused) v.pause();
        });
      }, { rootMargin: '300px 0px' });
      io.observe(v);
      if (PRIV.rm) v.controls = true; // без автозапуска — пусть гость сам нажмёт
    }
  }

  PRIV.gallery = { init };
})();
