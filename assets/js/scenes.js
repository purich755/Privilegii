/* ==========================================================================
   scenes.js — дверь «Ключ», циферблат «21 час», радар района и «Зачем вы в Казани?»
   ========================================================================== */
(function () {
  'use strict';
  const PRIV = (window.PRIV = window.PRIV || {});
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------------- 2. Дверь «Ключ» ---------------- */
  function initDoor() {
    const sec = $('#key');
    if (!sec) return;
    const door = $('.door', sec), spill = $('.door-spill', sec), floor = $('.door-floor', sec);
    const behind = $('.door-behind img', sec);
    const steps = $$('.key-step', sec), num = $('.key-n', sec);
    let cur = 0;

    const setStep = (i) => {
      if (i === cur) return;
      gsap.to(steps[cur], { autoAlpha: 0, y: i > cur ? -20 : 20, duration: 0.45, ease: 'power2.out', overwrite: true });
      gsap.fromTo(steps[i], { autoAlpha: 0, y: i > cur ? 20 : -20 }, { autoAlpha: 1, y: 0, duration: 0.7, delay: 0.08, ease: 'expo.out', overwrite: true });
      cur = i;
      num.textContent = String(i + 1).padStart(2, '0');
    };
    const openState = { rotateY: -105 };

    const mm = gsap.matchMedia();
    mm.add('(min-width: 1024px) and (prefers-reduced-motion: no-preference)', () => {
      cur = 0;
      gsap.set(steps.slice(1), { autoAlpha: 0, y: 20 });
      gsap.set(steps[0], { autoAlpha: 1, y: 0 });
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: sec, start: 'top top', end: '+=180%', pin: true, scrub: 0.6, anticipatePin: 1,
          onUpdate: (s) => setStep(Math.min(2, Math.floor(s.progress * 3 * 0.999))),
        },
      });
      tl.fromTo(door, { rotateY: 0 }, { rotateY: -105, ease: 'power1.inOut', duration: 0.78 }, 0.04)
        .fromTo(spill, { scaleX: 0 }, { scaleX: 1, ease: 'power1.in', duration: 0.7 }, 0.08)
        .fromTo(floor, { scaleY: 0 }, { scaleY: 1, ease: 'power1.in', duration: 0.7 }, 0.08)
        .fromTo(behind, { filter: 'brightness(0.3) saturate(0.8)' }, { filter: 'brightness(1) saturate(1)', duration: 0.7 }, 0.1)
        .to({}, { duration: 0.18 });
      return () => { cur = 0; num.textContent = '01'; };
    });
    mm.add('(max-width: 1023px), (prefers-reduced-motion: reduce)', () => {
      gsap.set(steps, { clearProps: 'all' });
      if (PRIV.rm) {
        gsap.set(door, openState); gsap.set(spill, { scaleX: 1 }); gsap.set(floor, { scaleY: 1 });
        gsap.set(behind, { filter: 'none' });
        return;
      }
      // мобильный: без pin, дверь открывается один раз при появлении
      const io = new IntersectionObserver((ents) => {
        if (!ents[0].isIntersecting) return;
        io.disconnect();
        const tl = gsap.timeline({ defaults: { duration: 1.4, ease: 'power2.inOut' } });
        tl.to(door, openState, 0).to(spill, { scaleX: 1 }, 0.1).to(floor, { scaleY: 1 }, 0.1)
          .to(behind, { filter: 'brightness(1) saturate(1)' }, 0.15);
      }, { threshold: 0.45 });
      io.observe($('.door-wall', sec));
      return () => io.disconnect();
    });
  }

  /* ---------------- 3. Циферблат «21 час» ---------------- */
  function initDial() {
    const C = window.SITE, U = PRIV.u;
    const sec = $('#day');
    if (!sec) return;
    const box = $('#dayScenes', sec);

    // сцены из config.js
    box.innerHTML = C.scenes.map((s, i) => `
      <article class="scene" data-i="${i}">
        <figure class="scene-fig"><div class="pp"><div class="pp-in"><div class="scene-media" style="position:absolute;inset:0">
          ${U.pic(s.img, { sizes: s.sizes, w: s.w, h: s.h, alt: s.alt, sizesAttr: '(min-width: 1024px) 34vw, 92vw', style: s.pos ? `object-position:${s.pos}` : '' })}
          <i class="scene-tint" aria-hidden="true"></i>
        </div></div></div></figure>
        <div class="scene-text">
          <p class="mono scene-time">${s.time}</p>
          <h3 class="scene-h">${s.title}</h3>
          <p class="scene-p">${s.text}</p>
        </div>
      </article>`).join('');
    const scenes = $$('.scene', box);

    // риски циферблата: 60 минутных, каждая пятая — часовая
    const ticks = $('.dial-ticks', sec);
    let t = '';
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2, h = i % 5 === 0;
      const r1 = 184, r2 = h ? 166 : 176;
      t += `<line class="${h ? 'h' : ''}" x1="${(200 + Math.sin(a) * r1).toFixed(2)}" y1="${(200 - Math.cos(a) * r1).toFixed(2)}" x2="${(200 + Math.sin(a) * r2).toFixed(2)}" y2="${(200 - Math.cos(a) * r2).toFixed(2)}"/>`;
    }
    ticks.innerHTML = t;
    const scale = $('.day-scale', sec);
    scale.innerHTML = '<i></i>'.repeat(21);
    const scaleI = $$('i', scale);
    const hh = $('.js-dh', sec), mmEl = $('.js-dm', sec), hoursEl = $('.js-hours', sec);
    const handH = $('.hand-h', sec), handM = $('.hand-m', sec);

    // камин в сцене 21:00
    let fire = null;
    const fi = C.scenes.findIndex((s) => s.fire);
    if (fi >= 0 && !PRIV.rm) {
      const media = $('.scene-media', scenes[fi]);
      fire = new PRIV.Fire({ stage: media, img: $('img', media), screen: 'kitchenCrop', amp: 1 });
    }

    const T = C.scenes.map((s) => s.min);
    // [цвет, сила] тонировки фото для 15:00 · 18:30 · 21:00 · 00:00 · 09:00 · 12:00
    const TINT = [['#F7F3EE', 0], ['#CFB48C', 0.45], ['#F3A25A', 0.55], ['#2A2D32', 0.6], ['#F3A25A', 0.32], ['#F7F3EE', 0]];
    const colors = C.sceneColors;
    let last5 = -1, lastHours = -1, active = -1, darkNow = null, nightNow = null;
    const lerpColor = (a, b, k) => gsap.utils.interpolate(a, b, k);
    const lum = (rgb) => {
      const m = rgb.match(/[\d.]+/g).map(Number);
      const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]);
    };
    const digits = (el, str) => { el.innerHTML = [...str].map((d) => `<span class="dg">${d}</span>`).join(''); };
    digits(hh, '15'); digits(mmEl, '00');

    function setScene(i, instant) {
      if (i === active) return;
      const prev = scenes[active];
      if (sec.classList.contains('is-pinned')) {
        const d = instant ? 0 : 1;
        if (prev) {
          gsap.to($('.scene-fig', prev), { opacity: 0, duration: 0.6 * d, ease: 'power2.out', overwrite: true });
          gsap.to($('.scene-text', prev), { opacity: 0, y: -16, duration: 0.45 * d, ease: 'power2.out', overwrite: true });
        }
        const nx = scenes[i];
        gsap.fromTo($('.scene-fig', nx), { opacity: 0 }, { opacity: 1, duration: 0.7 * d, ease: 'power2.out', overwrite: true });
        gsap.fromTo($('.scene-media', nx), { scale: 1.04 }, { scale: 1, duration: 1.1 * d, ease: 'expo.out', overwrite: true });
        gsap.fromTo($('.scene-text', nx), { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.8 * d, delay: 0.12 * d, ease: 'expo.out', overwrite: true });
      }
      active = i;
      if (fire) fire.setActive(!sec.classList.contains('is-pinned') || i === fi);
    }

    // p ∈ [0, 1] ↔ 15:00 … 12:00 следующего дня (21 час = 1260 минут).
    // Каждой из шести сцен отдана равная доля скролла, время внутри доли идёт линейно.
    function update(p) {
      p = Math.min(1, Math.max(0, p));
      const seg = Math.min(4, Math.floor(p * 5)), lt = p * 5 - seg;
      const minutes = T[seg] + (T[seg + 1] - T[seg]) * lt;
      const total = 15 * 60 + minutes;
      handH.style.transform = `rotate(${(((total / 60) % 12) * 30).toFixed(2)}deg)`;
      handM.style.transform = `rotate(${((total % 60) * 6).toFixed(2)}deg)`;
      // цифры — с шагом 5 минут, без дёрганья DOM каждый кадр
      const s5 = Math.floor(total / 5) * 5;
      if (s5 !== last5) {
        last5 = s5;
        digits(hh, String(Math.floor(s5 / 60) % 24).padStart(2, '0'));
        digits(mmEl, String(s5 % 60).padStart(2, '0'));
      }
      const hours = Math.min(21, Math.floor(minutes / 60 + 1e-6));
      if (hours !== lastHours) {
        lastHours = hours;
        scaleI.forEach((el, i) => el.classList.toggle('on', i < hours));
        hoursEl.textContent = hours;
      }
      // «температура света»: держим цвет сцены и плавно переходим между соседними
      const k = gsap.utils.clamp(0, 1, (lt - 0.25) / 0.5);
      const e = k * k * (3 - 2 * k);
      const bg = lerpColor(colors[seg], colors[seg + 1], e);
      sec.style.backgroundColor = bg;
      // свет суток на фото: вечер теплеет, ночь гасит, утро золотит
      sec.style.setProperty('--tint', lerpColor(TINT[seg][0], TINT[seg + 1][0], e));
      sec.style.setProperty('--tint-o', (TINT[seg][1] + (TINT[seg + 1][1] - TINT[seg][1]) * e).toFixed(3));
      sec.style.setProperty('--day-bg', bg);
      const dark = lum(bg) < 0.3;
      if (dark !== darkNow) { darkNow = dark; sec.classList.toggle('is-dark', dark); sec.toggleAttribute('data-dark', dark); }
      const idx = Math.round(p * 5);
      const night = idx === 3;
      if (night !== nightNow) { nightNow = night; sec.classList.toggle('is-night', night); }
      setScene(idx);
    }

    const mm = gsap.matchMedia();
    mm.add({
      pin: '(min-width: 1024px) and (min-height: 560px) and (prefers-reduced-motion: no-preference)',
      flow: '(max-width: 1023px) and (prefers-reduced-motion: no-preference), (max-height: 559px) and (prefers-reduced-motion: no-preference)',
      still: '(prefers-reduced-motion: reduce)',
    }, (ctx) => {
      const { pin, flow } = ctx.conditions;
      active = -1; last5 = -1; lastHours = -1; darkNow = null; nightNow = null;
      sec.classList.toggle('is-pinned', !!pin);
      sec.classList.toggle('is-flow', !pin);
      if (pin) {
        scenes.forEach((s, i) => gsap.set([$('.scene-fig', s), $('.scene-text', s)], { opacity: i ? 0 : 1 }));
        const proxy = { p: 0 };
        gsap.to(proxy, {
          p: 1, ease: 'none',
          scrollTrigger: { trigger: sec, start: 'top top', end: '+=420%', pin: true, scrub: 0.8, anticipatePin: 1 },
          onUpdate: () => update(proxy.p),
        });
        update(0);
      } else if (flow) {
        // стрелки двигаются по мере прокрутки, сцены идут карточками
        ScrollTrigger.create({
          trigger: sec, start: 'top 60%', end: 'bottom 70%',
          onUpdate: (s) => update(s.progress),
        });
        update(0);
        if (fire) fire.setActive(true);
      } else {
        // reduced motion: шесть статичных карточек
        sec.classList.add('is-static');
        $('.day-clock', sec).hidden = true;
        sec.style.backgroundColor = '';
      }
      return () => {
        sec.classList.remove('is-pinned', 'is-flow', 'is-static', 'is-dark', 'is-night');
        sec.removeAttribute('data-dark');
        $('.day-clock', sec).hidden = false;
        gsap.set($$('.scene-fig, .scene-text, .scene-media', sec), { clearProps: 'all' });
      };
    });
  }

  /* ---------------- 9. Радар «Горки» ---------------- */
  function initRadar() {
    const C = window.SITE, U = PRIV.u;
    const root = $('#radar');
    if (!root) return;
    const R = [62, 124, 186, 248];
    const dotsG = $('.r-dots', root), list = $('.radar-labels', root);
    let dots = '', labels = '';
    C.radar.forEach((p) => {
      const b = (p.angle * Math.PI) / 180, r = R[p.ring - 1];
      const x = 260 + Math.sin(b) * r, y = 260 - Math.cos(b) * r;
      dots += `<circle class="r-dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6"/><circle class="r-dot c" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.2"/>`;
      const left = p.side ? p.side === 'left' : x > 410; // подписи вправо от точки, у правого края — влево
      labels += `<li class="${left ? 'left' : ''}" style="left:${((x / 520) * 100).toFixed(2)}%;top:${((y / 520) * 100).toFixed(2)}%">
        <b data-letters>${p.value}</b><span>${p.label}</span></li>`;
    });
    dotsG.innerHTML = dots;
    list.innerHTML = labels;
    $$('[data-letters]', list).forEach(U.splitLetters);
    if (PRIV.rm) { $$('.ch', list).forEach((c) => (c.style.opacity = 1)); return; }

    const waves = $$('.r-wave', root), dotEls = $$('.r-dot', root), items = $$('li', list);
    gsap.set(dotEls, { scale: 0 });
    gsap.set(items.map((li) => $('span', li)), { opacity: 0, y: 8 });
    const io = new IntersectionObserver((ents) => {
      if (!ents[0].isIntersecting) return;
      io.disconnect();
      const tl = gsap.timeline();
      // волна от центра — два раза
      waves.forEach((w, i) => tl.fromTo(w, { scale: 0, opacity: 0.4, svgOrigin: '260 260' }, { scale: 1.4, svgOrigin: '260 260', opacity: 0, duration: 1.6, ease: 'power2.out', repeat: 1, repeatDelay: 0.1 }, i * 0.5));
      for (let i = 0; i < items.length; i++) {
        const at = 0.5 + i * 0.18;
        tl.to(dotEls.slice(i * 2, i * 2 + 2), { scale: 1, duration: 0.6, ease: 'back.out(2)' }, at);
        tl.to($$('.ch', items[i]), { opacity: 1, duration: 0.01, stagger: 0.018 }, at + 0.05);
        tl.to($('span', items[i]), { opacity: 1, y: 0, duration: 0.7, ease: 'expo.out' }, at + 0.2);
      }
    }, { threshold: 0.35 });
    io.observe(root);
  }

  /* ---------------- 9. «Зачем вы в Казани?» + карта ---------------- */
  function initReasons() {
    const C = window.SITE;
    const wrap = $('.area-chips'), box = $('.why-box'), text = $('.why-text');
    if (!wrap) return;
    wrap.innerHTML = C.reasons.map((r, i) =>
      `<button class="chip" type="button" role="radio" aria-checked="${i === 0}" data-id="${r.id}">${r.label}</button>`).join('');
    text.textContent = C.reasons[0].text;
    const chips = $$('.chip', wrap);
    let busy = 0;
    const pick = (btn) => {
      chips.forEach((c) => c.setAttribute('aria-checked', String(c === btn)));
      const r = C.reasons.find((x) => x.id === btn.dataset.id);
      if (PRIV.rm) { text.textContent = r.text; return; }
      // кроссфейд высоты через grid-template-rows
      clearTimeout(busy);
      box.classList.add('is-swap');
      busy = setTimeout(() => { text.textContent = r.text; box.classList.remove('is-swap'); }, 420);
    };
    chips.forEach((c) => c.addEventListener('click', () => pick(c)));
    // радио-группа: стрелки переключают
    wrap.addEventListener('keydown', (e) => {
      const i = chips.indexOf(document.activeElement);
      if (i < 0 || !['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
      e.preventDefault();
      const n = chips[(i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : chips.length - 1)) % chips.length];
      n.focus(); pick(n);
    });

    // Карта: по умолчанию статичная схема (виджет Яндекса подмешивает рекламу и рейтинг),
    // интерактивная Яндекс-карта подгружается только по кнопке
    const frame = $('.map-frame'), mapIn = $('.map-in'), live = $('.map-live');
    live.addEventListener('click', () => {
      frame.src = C.mapWidget;
      frame.hidden = false;
      live.hidden = true;
      mapIn.classList.add('is-live', 'is-color');
    });
    // тап по карте — цветная
    mapIn.addEventListener('pointerdown', () => mapIn.classList.add('is-color'));
  }

  PRIV.scenes = { initDoor, initDial, initRadar, initReasons };
})();
