/* ==========================================================================
   main.js — сборка страницы: помощники, контакты из config.js, Lenis + ScrollTrigger,
   вход «Свет включается», живые часы и обратный отсчёт, шапка, шкала времени,
   курсор, reveal-анимации, параллаксы
   ========================================================================== */
(function () {
  'use strict';
  const PRIV = (window.PRIV = window.PRIV || {});
  const C = window.SITE;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const html = document.documentElement;

  if (!window.gsap || !window.ScrollTrigger || !window.Flip || !C) {
    // библиотеки не загрузились — показываем страницу статичной
    html.removeAttribute('data-js'); html.removeAttribute('data-intro');
    return;
  }
  gsap.registerPlugin(ScrollTrigger, Flip);

  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  PRIV.rm = RM;
  const FINE = matchMedia('(pointer: fine)').matches;

  /* ---------------- помощники ---------------- */
  const IMG = 'assets/img/';
  PRIV.u = {
    // путь к файлу: name-size.ext или name.ext
    src(name, ext = 'jpg', size = null) { return `${IMG}${name}${size ? '-' + size : ''}.${ext}`; },
    // <picture> c webp + jpg; sizes — доступные ширины, pick — какую взять в src
    pic(name, o = {}) {
      const lazy = o.lazy !== false;
      let webp, jpg, fallback;
      if (o.sizes && o.sizes.length) {
        webp = o.sizes.map((s) => `${IMG}${name}-${s}.webp ${s}w`).join(', ');
        jpg = o.sizes.map((s) => `${IMG}${name}-${s}.jpg ${s}w`).join(', ');
        const want = o.pick === 0 ? o.sizes[0] : o.pick || 900;
        const f = o.sizes.reduce((a, b) => (Math.abs(b - want) < Math.abs(a - want) ? b : a));
        fallback = `${IMG}${name}-${f}.jpg`;
      } else {
        webp = `${IMG}${name}.webp`; jpg = null; fallback = `${IMG}${name}.jpg`;
      }
      const sz = o.sizes && o.sizes.length ? ` sizes="${o.sizesAttr || '100vw'}"` : '';
      return `<picture><source type="image/webp" srcset="${webp}"${sz}>` +
        `<img src="${fallback}"${jpg ? ` srcset="${jpg}"${sz}` : ''} width="${o.w || ''}" height="${o.h || ''}"` +
        `${lazy ? ' loading="lazy"' : ''} decoding="async" alt="${(o.alt || '').replace(/"/g, '&quot;')}"${o.style ? ` style="${o.style}"` : ''}></picture>`;
    },
    // 3500 → «3 500» (toLocaleString не группирует четырёхзначные)
    money(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); },
    // H2 по словам из-под маски: оборачиваем каждое слово, сохраняя вложенные span/br
    splitWords(el) {
      const walk = (node) => {
        [...node.childNodes].forEach((n) => {
          if (n.nodeType === 3) {
            const parts = n.textContent.split(/([ \t\n\r]+)/); // неразрывный пробел остаётся внутри слова
            const frag = document.createDocumentFragment();
            parts.forEach((p) => {
              if (!p) return;
              if (/^[ \t\n\r]+$/.test(p)) { frag.appendChild(document.createTextNode(' ')); return; }
              // неразрывные пробелы держат слова вместе в одной маске
              const w = document.createElement('span'); w.className = 'w';
              const i = document.createElement('span'); i.className = 'wi'; i.textContent = p;
              w.appendChild(i); frag.appendChild(w);
            });
            n.replaceWith(frag);
          } else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n);
        });
      };
      walk(el);
    },
    // моноширинные метки по буквам
    splitLetters(el) {
      const t = el.textContent;
      el.setAttribute('aria-label', t);
      // обёртка: у flex-родителя (метки .tmark) буквы иначе стали бы флекс-элементами с gap
      // слова — неразрывные группы, чтобы строка не ломалась посреди слова
      const words = t.split(/(\s+)/).map((w) => (/^\s+$/.test(w) ? ' ' : w ? `<span class="cw">${[...w].map((ch) => `<span class="ch">${ch}</span>`).join('')}</span>` : ''));
      el.innerHTML = '<span class="chs" aria-hidden="true">' + words.join('') + '</span>';
    },
  };
  const U = PRIV.u;

  /* ---------------- контакты из config.js ---------------- */
  function bindContacts() {
    const map = { tel: C.tel, vkMessage: C.vkMessage, vk: C.vk, route: C.route, yandexMaps: C.yandexMaps };
    $$('[data-bind]').forEach((a) => { const v = map[a.dataset.bind]; if (v) a.href = v; });
    $$('[data-bind-text]').forEach((el) => { const v = C[el.dataset.bindText]; if (v) el.textContent = v; });
    $$('.hdr-phone').forEach((a) => (a.textContent = C.phoneShort));
    // на телефоне «Узнать свободные даты» сразу звонит
    if (matchMedia('(pointer: coarse)').matches) {
      const cta = $('#heroCta');
      if (cta) { cta.href = C.tel; cta.removeAttribute('target'); }
    }
  }

  /* ---------------- время по Казани ---------------- */
  const fmt = new Intl.DateTimeFormat('ru-RU', { timeZone: C.timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  function kazanNow() {
    const p = {};
    fmt.formatToParts(new Date()).forEach((x) => { if (x.type !== 'literal') p[x.type] = +x.value; });
    return { h: p.hour % 24, m: p.minute, s: p.second };
  }
  // единственный источник правды: сколько секунд до ближайших 15:00
  function untilCheckin() {
    const n = kazanNow();
    let d = C.checkinHour * 3600 - (n.h * 3600 + n.m * 60 + n.s);
    if (d <= 0) d += 86400;
    return { now: n, left: d, today: n.h < C.checkinHour };
  }

  function initClocks() {
    const nowEl = $('.js-now'), nextEl = $('.js-next');
    const count = $('#count');
    // 6 окошек ЧЧ:ММ:СС, каждая цифра перелистывается маской
    count.innerHTML = '<span class="cell"><span></span></span><span class="cell"><span></span></span><span class="sep">:</span>' +
      '<span class="cell"><span></span></span><span class="cell"><span></span></span><span class="sep">:</span>' +
      '<span class="cell"><span></span></span><span class="cell"><span></span></span>';
    const cells = $$('.cell', count);
    const vals = new Array(6).fill('');
    let lastMin = -1, countVisible = false;
    new IntersectionObserver((e) => (countVisible = e[0].isIntersecting)).observe(count);

    function setCell(i, ch) {
      if (vals[i] === ch) return;
      const cell = cells[i];
      const old = cell.lastElementChild;
      if (!vals[i] || RM || !countVisible) { old.textContent = ch; vals[i] = ch; return; }
      vals[i] = ch;
      const nu = document.createElement('span'); nu.textContent = ch;
      cell.appendChild(nu);
      gsap.fromTo(nu, { yPercent: 100 }, { yPercent: 0, duration: 0.3, ease: 'power3.out' });
      gsap.to(old, { yPercent: -100, duration: 0.3, ease: 'power3.out', onComplete: () => old.remove() });
    }
    function tick() {
      const u = untilCheckin();
      if (u.now.m !== lastMin) {
        lastMin = u.now.m;
        nowEl.textContent = `${String(u.now.h).padStart(2, '0')}:${String(u.now.m).padStart(2, '0')}`;
        nextEl.textContent = u.today ? 'сегодня' : 'завтра';
      }
      const h = Math.floor(u.left / 3600), m = Math.floor((u.left % 3600) / 60), s = u.left % 60;
      const str = String(h).padStart(2, '0') + String(m).padStart(2, '0') + String(s).padStart(2, '0');
      [...str].forEach((ch, i) => setCell(i, ch));
      count.setAttribute('aria-label', `До ближайшего заселения ${h} ч ${m} мин`);
    }
    tick();
    // выравниваемся по границе секунды
    setTimeout(() => { tick(); setInterval(tick, 1000); }, 1000 - (Date.now() % 1000) + 5);
  }

  /* ---------------- Lenis + ScrollTrigger ---------------- */
  const scrollCbs = [];
  PRIV.onScroll = (fn) => scrollCbs.push(fn);
  function initScroll() {
    if (!RM && window.Lenis) {
      const lenis = new Lenis({ lerp: 0.085, smoothWheel: true });
      PRIV.lenis = lenis;
      lenis.on('scroll', ScrollTrigger.update);
      lenis.on('scroll', (e) => scrollCbs.forEach((f) => f(e.scroll, e.direction)));
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
      // pin-сцены и ленивые картинки меняют высоту страницы — Lenis должен знать новый предел,
      // иначе прокрутка упирается в старую высоту
      ScrollTrigger.addEventListener('refresh', () => lenis.resize());
      new ResizeObserver(() => lenis.resize()).observe(document.body);
    } else {
      addEventListener('scroll', () => scrollCbs.forEach((f) => f(scrollY, 0)), { passive: true });
    }
    // якоря: плавно через Lenis
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute('href');
      const target = id === '#top' ? 0 : $(id);
      if (id.length < 2 || target === null) return;
      e.preventDefault();
      if (PRIV.lenis) PRIV.lenis.scrollTo(target, { offset: id === '#top' ? 0 : -40, duration: 1.4 });
      else (target === 0 ? scrollTo(0, 0) : target.scrollIntoView());
      if (target !== 0) setTimeout(() => { target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }); }, 1450);
    });
  }

  /* ---------------- hero: камин, параллакс, вход ---------------- */
  let heroFire = null;
  function initHero() {
    const hero = $('#top'), stage = $('#heroStage'), img = $('#heroImg');
    const spots = $$('.hero-spots i', hero);
    if (!RM) {
      heroFire = new PRIV.Fire({
        stage, img, screen: 'living',
        glows: { wall: $('.fire-glow--wall', hero), floor: $('.fire-glow--floor', hero) },
        spots,
      });
      PRIV.heroFire = heroFire;
      // ken-burns 1 → 1.05 за 18 с
      gsap.fromTo(stage, { scale: 1 }, { scale: 1.05, duration: 18, ease: 'sine.inOut' });
      // при скролле фото уходит с параллаксом 0.8 и темнеет на 15%
      const desktop = matchMedia('(min-width: 901px) and (min-aspect-ratio: 4/5)').matches;
      if (desktop) {
        gsap.to(stage, { y: () => hero.offsetHeight * 0.2, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true, invalidateOnRefresh: true } });
      }
      gsap.to($('.hero-dim', hero), { opacity: 0.15, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
    } else {
      $$('.fire-glow', hero).forEach((g) => (g.style.display = 'none'));
    }
  }

  function heroReveal(delay) {
    if (RM) return;
    const hero = $('#top');
    const tl = gsap.timeline({ delay });
    tl.to($$('.lni', hero), { y: 0, yPercent: 0, duration: 1, stagger: 0.11, ease: 'expo.out' }, 0)
      .to($$('.hero-label .ch', hero), { opacity: 1, duration: 0.01, stagger: 0.018 }, 0.05)
      .fromTo($$('.hero-sub, .hero-btns', hero), { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.9, stagger: 0.08, ease: 'expo.out' }, 0.3)
      .fromTo($$('.hero-facts li', hero), { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 0.8, stagger: 0.06, ease: 'expo.out' }, 0.4)
      .fromTo($('.hero-clock', hero), { opacity: 0 }, { opacity: 1, duration: 0.8 }, 0.5);
  }

  // 0. «Свет включается»: тёмная комната, горит только камин, потом свет
  function initIntro() {
    const hero = $('#top');
    const label = $('.hero-label', hero);
    U.splitLetters(label);
    if (!html.hasAttribute('data-intro')) {
      heroReveal(0.15);
      return;
    }
    try { sessionStorage.setItem('priv-intro', '1'); } catch (e) {}
    const img = $('#heroImg'), mark = $('.intro-mark'), target = $('#heroMark');
    const spots = $$('.hero-spots i', hero);
    const hdr = $('#hdr');
    // то, что скрыто CSS-правилом входа, прячем инлайном — чтобы после снятия флага не мигнуло
    const hidden = $$('.hero-content > *, .hero-clock, .hero-facts', hero);
    gsap.set(hidden, { opacity: 0 });
    gsap.set(hdr, { opacity: 0 });
    gsap.set(target, { opacity: 0 });

    // свет: brightness .18 → 1 за 900 мс, cubic-bezier(.7,0,.2,1) — через CSS-переход
    setTimeout(() => {
      img.style.transition = 'filter .9s cubic-bezier(.7,0,.2,1)';
      img.style.filter = 'brightness(1)';
      // точечные светильники вспыхивают и гаснут
      gsap.timeline()
        .to(spots, { opacity: 0.6, duration: 0.14, stagger: 0.05, ease: 'power2.out' })
        .to(spots, { opacity: 0, duration: 0.4, stagger: 0.05, ease: 'power2.in' }, '>-0.02');
    }, 450);

    // метка «15:00 · вас ждут» уезжает в позицию метки hero (Flip)
    setTimeout(() => {
      gsap.set(target, { opacity: 1 });
      gsap.set(hidden.filter((el) => el !== target), { opacity: 1 });
      // остальные элементы hero покажет heroReveal, поэтому сразу прячем их «правильно»
      gsap.set($$('.hero-sub, .hero-btns', hero), { opacity: 0 });
      mark.parentElement.style.display = 'grid'; // .intro живёт до конца Flip
      html.removeAttribute('data-intro');
      gsap.set(target, { opacity: 0 });
      Flip.fit(mark, target, { duration: 0.5, ease: 'power3.inOut', scale: true, onComplete: () => {
        gsap.set(target, { opacity: 1 });
        gsap.to(mark, { opacity: 0, duration: 0.15, onComplete: () => mark.parentElement.remove() });
      } });
      gsap.to(hdr, { opacity: 1, duration: 0.8, delay: 0.3 });
      heroReveal(0.05);
    }, 800);
    setTimeout(() => { img.style.transition = ''; img.style.filter = ''; }, 1500);
  }

  /* ---------------- шапка и нижняя панель ---------------- */
  function initHeader() {
    const hdr = $('#hdr'), mbar = $('#mbar'), hero = $('#top');
    let lastY = 0;
    PRIV.onScroll((y) => {
      const heroH = hero.offsetHeight;
      hdr.classList.toggle('is-solid', y > 40);
      if (y > heroH * 0.5 && y > lastY + 2) hdr.classList.add('is-hidden');
      else if (y < lastY - 2 || y < heroH * 0.5) hdr.classList.remove('is-hidden');
      lastY = y;
      mbar.classList.toggle('is-on', y > heroH - 120);
    });
  }

  /* ---------------- шкала времени ---------------- */
  function initTimeline() {
    const tl = $('#tl'), runner = $('.tl-runner', tl), line = $('.tl-line', tl);
    const links = $$('.tl-list a', tl);
    links.forEach((a, i) => a.style.setProperty('--i', i));
    const map = { key: 'key', day: 'day', guests: 'guests', inside: 'inside', iron: 'inside', gallery: 'gallery', house: 'house', area: 'area', book: 'book', final: 'final' };
    const secs = $$('main > section[id]');
    const triggers = [];
    let curSec = null;
    secs.forEach((sec) => {
      const st = ScrollTrigger.create({
        trigger: sec, start: 'top center', end: 'bottom center',
        onToggle: (s) => {
          if (!s.isActive) return;
          curSec = sec;
          const id = map[sec.id];
          links.forEach((a) => a.classList.toggle('is-active', a.dataset.tl === id));
        },
      });
      triggers.push({ sec, st });
    });
    // риски — на реальных позициях секций (с учётом длины pin-сцен)
    function place() {
      const max = ScrollTrigger.maxScroll(window) || 1;
      links.forEach((a) => {
        const t = triggers.find((x) => x.sec.id === a.dataset.tl);
        if (!t) return;
        const top = t.st.start + innerHeight / 2;
        a.parentElement.style.setProperty('--pos', `${Math.min(100, (top / max) * 100).toFixed(2)}%`);
      });
    }
    ScrollTrigger.addEventListener('refresh', place);
    PRIV.onScroll((y) => {
      const max = ScrollTrigger.maxScroll(window) || 1;
      runner.style.transform = `translateY(${((y / max) * line.clientHeight).toFixed(1)}px)`;
      tl.classList.toggle('is-off', y < $('#top').offsetHeight * 0.8);
      tl.classList.toggle('on-dark', !!(curSec && curSec.hasAttribute('data-dark')));
    });
    tl.classList.add('is-off');
  }

  /* ---------------- курсор ---------------- */
  function initCursor() {
    if (!FINE || RM) return;
    const cur = $('#cur'), dot = $('.cur-dot', cur), ring = $('.cur-ring', cur), txt = $('.cur-txt', cur);
    document.body.classList.add('has-cur');
    const labels = { view: 'смотреть', drag: 'тянуть', iron: '' };
    let mx = -100, my = -100, x = -100, y = -100, rx = -100, ry = -100;
    addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') { mx = e.clientX; my = e.clientY; } }, { passive: true });
    document.addEventListener('pointerover', (e) => {
      const t = e.target.closest('[data-cursor]');
      const st = t ? t.getAttribute('data-cursor') : '';
      if (st) { cur.setAttribute('data-state', st); txt.textContent = labels[st] || ''; } else cur.removeAttribute('data-state');
      cur.classList.toggle('on-dark', !!e.target.closest('[data-dark], .lb'));
    });
    document.addEventListener('pointerleave', () => { mx = my = -100; });
    gsap.ticker.add(() => {
      x += (mx - x) * 0.35; y += (my - y) * 0.35;
      rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18;
      dot.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`;
    });
  }

  /* ---------------- reveal ---------------- */
  function initReveal() {
    $$('[data-split]').forEach(U.splitWords);
    $$('[data-letters]').forEach((el) => { if (!el.querySelector('.ch')) U.splitLetters(el); });
    // плинтусы между секциями: дорисовываются от левого края
    $$('main > section + section').forEach((sec) => {
      if (sec.id === 'day' || sec.id === 'key' || sec.id === 'final') return;
      const p = document.createElement('span');
      p.className = 'plinth'; p.setAttribute('aria-hidden', 'true');
      p.style.cssText = 'position:absolute;left:0;right:0;top:0;z-index:2';
      sec.prepend(p);
    });
    if (RM) return;
    const E = 'expo.out';
    ScrollTrigger.batch('[data-rv]', {
      start: 'top 88%', once: true,
      onEnter: (b) => gsap.to(b, { opacity: 1, y: 0, duration: 0.85, stagger: 0.07, ease: E, overwrite: true }),
    });
    $$('[data-split]').forEach((el) => {
      gsap.to($$('.wi', el), { y: 0, yPercent: 0, duration: 1, stagger: 0.05, ease: E, scrollTrigger: { trigger: el, start: 'top 86%', once: true } });
    });
    $$('[data-letters]').forEach((el) => {
      if (el.closest('#top') || el.closest('#radar')) return; // у hero и радара своя очередь
      gsap.to($$('.ch', el), { opacity: 1, duration: 0.01, stagger: 0.018, scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
    });
    $$('[data-pp]').forEach((pp) => {
      const inner = $('.pp-in > picture, .pp-in > img', pp);
      const tl = gsap.timeline({ scrollTrigger: { trigger: pp, start: 'top 88%', once: true } });
      tl.fromTo(pp, { clipPath: 'inset(12% 12% 12% 12%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, ease: E }, 0);
      if (inner) tl.fromTo(inner, { scale: 1.08 }, { scale: 1, duration: 1.4, ease: E }, 0);
    });
    $$('.plinth').forEach((p) => gsap.to(p, { scaleX: 1, duration: 1.2, ease: E, scrollTrigger: { trigger: p.parentElement, start: 'top 92%', once: true } }));
    // метки времени по буквам
    $$('.tmark').forEach((t) => {
      if (t.closest('#top') || t.hasAttribute('data-letters')) return;
      U.splitLetters(t);
      gsap.to($$('.ch', t), { opacity: 1, duration: 0.01, stagger: 0.018, scrollTrigger: { trigger: t, start: 'top 90%', once: true } });
      gsap.set($$('.ch', t), { opacity: 0 });
    });
  }

  /* ---------------- «Дом»: параллаксы ---------------- */
  function initHouse() {
    if (RM) return;
    const sec = $('#house');
    const pic = $('.house-main .pp-in picture', sec);
    gsap.fromTo(pic, { yPercent: -6 }, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: sec, start: 'top bottom', end: 'bottom top', scrub: true } });
    gsap.fromTo($('.js-floors', sec), { y: 60 }, { y: -60, ease: 'none', scrollTrigger: { trigger: sec, start: 'top bottom', end: 'bottom top', scrub: true } });
    const lis = $$('.house-list li', sec);
    lis.forEach((li) => li.style.setProperty('--line', 0));
    ScrollTrigger.create({
      trigger: $('.house-list', sec), start: 'top 82%', once: true,
      onEnter: () => lis.forEach((li, i) => gsap.to(li, { '--line': 1, duration: 0.9, delay: i * 0.12, ease: 'expo.out' })),
    });
  }

  /* ---------------- финал: камин продолжает гореть ---------------- */
  function initFinal() {
    if (RM) return;
    const stage = $('#finalStage'), img = $('.final-img', stage);
    const go = () => new PRIV.Fire({ stage, img, screen: 'kitchen', amp: 0.8 });
    // фото финала ленивое — подгружаем заранее, при подходе к блоку
    const io = new IntersectionObserver((e) => {
      if (!e[0].isIntersecting) return;
      io.disconnect();
      img.loading = 'eager';
      go();
    }, { rootMargin: '900px 0px' });
    io.observe(stage);
  }

  /* ---------------- сборка ---------------- */
  function boot() {
    bindContacts();
    initClocks();
    initScroll();
    initHero();
    // pin-сцены — первыми и сверху вниз: остальные триггеры должны учитывать их длину
    PRIV.scenes.initDoor();
    PRIV.scenes.initDial();
    PRIV.configurator.init();
    PRIV.details.init();
    PRIV.gallery.init();
    PRIV.deck.init();
    PRIV.scenes.initRadar();
    PRIV.scenes.initReasons();
    initHouse();
    initFinal();
    initReveal();
    initHeader();
    initTimeline();
    initCursor();
    PRIV.ambient && PRIV.ambient.init();
    initIntro();
    window.PRIV_READY = true;
    const refresh = () => ScrollTrigger.refresh();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh);
    addEventListener('load', refresh);
    scrollCbs.forEach((f) => f(scrollY, 0));
  }
  boot();
})();
