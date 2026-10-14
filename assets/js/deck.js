/* ==========================================================================
   deck.js — «Книга гостей»: колода отзывов. Верхнюю карточку можно
   перетащить и отбросить — она уходит вниз стопки. Кнопки и стрелки делают то же.
   На узких экранах и при reduced motion — обычный ряд со scroll-snap.
   ========================================================================== */
(function () {
  'use strict';
  const PRIV = (window.PRIV = window.PRIV || {});
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const pad = (n) => String(n).padStart(2, '0');
  // фиксированный сид: раскладка не меняется при перезагрузке
  function rng(seed) { return () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  function init() {
    const C = window.SITE;
    const deck = $('#deck');
    if (!deck) return;
    const N = C.reviews.length;
    deck.innerHTML = C.reviews.map((r, i) => `
      <article class="d-card" data-i="${i}">
        <p class="d-card-top mono"><span>${pad(i + 1)} / ${pad(N)}</span><span>Книга гостей</span></p>
        <p>«${r.text}»</p>
        <p class="d-name mono">${r.name}, гость</p>
      </article>`).join('');
    const cards = $$('.d-card', deck);
    const R = rng(11);
    const base = cards.map(() => ({ r: (R() * 2 - 1) * 3, x: (R() * 2 - 1) * 6, y: (R() * 2 - 1) * 6 }));
    const nEl = $('.js-dn'), tEl = $('.js-dt'), live = $('.js-deck-live');
    tEl.textContent = pad(N);
    let order = cards.map((_, i) => i);
    let busy = false, rowMode = null;

    const announce = () => {
      const i = order[0];
      nEl.textContent = pad(i + 1);
      live.textContent = `Отзыв ${i + 1} из ${N}. ${C.reviews[i].name}: ${C.reviews[i].text}`;
    };

    // раскладка стопки: верхняя — ровно на базе, нижние чуть ниже и меньше
    function stack(animate) {
      order.forEach((ci, k) => {
        const c = cards[ci], b = base[ci];
        c.style.zIndex = String(N - k);
        c.setAttribute('aria-hidden', String(k !== 0));
        const props = { x: b.x, y: b.y + Math.min(k, 3) * 7, rotation: b.r, scale: 1 - Math.min(k, 3) * 0.018, opacity: k < 5 ? 1 : 0 };
        if (animate) gsap.to(c, { ...props, duration: 0.5, ease: 'expo.out', overwrite: 'auto' });
        else gsap.set(c, props);
      });
      announce();
    }

    function throwTop(dir, vx) {
      if (busy) return;
      busy = true;
      const ci = order[0], c = cards[ci], b = base[ci];
      const w = deck.clientWidth;
      gsap.to(c, {
        x: dir * w * 1.25, y: b.y + 40, rotation: b.r + dir * 18,
        duration: gsap.utils.clamp(0.28, 0.5, 0.5 - Math.abs(vx || 0) * 0.12), ease: 'power2.in',
        onComplete: () => {
          // без анимации — в низ стопки, затем подъезжает на место
          order.push(order.shift());
          c.style.zIndex = '0';
          gsap.set(c, { x: b.x, y: b.y + 21, rotation: b.r, opacity: 0, scale: 0.946 });
          stack(true);
          busy = false;
        },
      });
    }
    function bringBack() {
      if (busy) return;
      busy = true;
      order.unshift(order.pop());
      const ci = order[0], c = cards[ci], b = base[ci];
      c.style.zIndex = String(N + 1);
      gsap.set(c, { x: -deck.clientWidth * 1.25, y: b.y + 40, rotation: b.r - 18, opacity: 1, scale: 1 });
      stack(true);
      gsap.to(c, { x: b.x, y: b.y, rotation: b.r, duration: 0.55, ease: 'expo.out', overwrite: true, onComplete: () => { busy = false; } });
    }
    const next = () => (PRIV.rm ? (order.push(order.shift()), stack(false)) : throwTop(1));
    const prev = () => (PRIV.rm ? (order.unshift(order.pop()), stack(false)) : bringBack());

    $$('.deck-btn').forEach((b) => b.addEventListener('click', () => (b.dataset.dir === '1' ? next() : prev())));
    deck.addEventListener('keydown', (e) => {
      if (rowMode) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
    });

    // перетаскивание верхней карточки
    let drag = null;
    deck.addEventListener('pointerdown', (e) => {
      if (rowMode || busy) return;
      const c = e.target.closest('.d-card');
      if (!c || c !== cards[order[0]]) return;
      e.preventDefault();
      const ci = order[0];
      drag = { c, b: base[ci], x0: e.clientX, y0: e.clientY, dx: 0, hist: [{ x: e.clientX, t: performance.now() }] };
      gsap.killTweensOf(c);
    });
    window.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
      drag.dx = dx;
      drag.hist.push({ x: e.clientX, t: performance.now() });
      if (drag.hist.length > 6) drag.hist.shift();
      gsap.set(drag.c, { x: drag.b.x + dx, y: drag.b.y + dy * 0.35, rotation: drag.b.r + dx * 0.06 });
    });
    const release = () => {
      if (!drag) return;
      const { c, b, dx, hist } = drag;
      drag = null;
      const h0 = hist[0], h1 = hist[hist.length - 1];
      const v = (h1.x - h0.x) / Math.max(1, h1.t - h0.t); // px/ms
      if (Math.abs(dx) > 120 || Math.abs(v) > 0.6) throwTop(Math.sign(dx || v), v);
      else gsap.to(c, { x: b.x, y: b.y, rotation: b.r, duration: 0.9, ease: 'elastic.out(1, .6)' });
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);

    // режимы: колода или ряд со scroll-snap
    const mq = matchMedia('(max-width: 479px)');
    function mode() {
      const row = PRIV.rm || mq.matches;
      if (row === rowMode) return;
      rowMode = row;
      deck.classList.toggle('is-row', row);
      if (row) {
        deck.removeAttribute('data-cursor');
        gsap.set(cards, { clearProps: 'all' });
        cards.forEach((c, i) => { c.style.zIndex = ''; c.removeAttribute('aria-hidden'); c.style.order = String(i); });
        deck.setAttribute('aria-label', 'Отзывы гостей. Листайте вбок.');
      } else {
        deck.setAttribute('data-cursor', 'drag');
        deck.setAttribute('aria-label', 'Отзывы гостей. Стрелки влево и вправо листают.');
        stack(false);
      }
    }
    mq.addEventListener('change', mode);
    mode();
  }

  PRIV.deck = { init };
})();
