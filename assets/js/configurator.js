/* ==========================================================================
   configurator.js — «Кто едет?»: гости, спальные места, подбор формата,
   готовое сообщение для VK с копированием
   ========================================================================== */
(function () {
  'use strict';
  const PRIV = (window.PRIV = window.PRIV || {});
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const plural = (n, one, few, many) => {
    const a = n % 10, b = n % 100;
    if (a === 1 && b !== 11) return one;
    if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return few;
    return many;
  };

  function init() {
    const C = window.SITE, U = PRIV.u;
    const sec = $('#guests');
    if (!sec) return;
    const state = { guests: 2, purpose: 'pair' };
    const MIN = 1, MAX = 5;

    /* — повод — */
    const pWrap = $('.g-purpose', sec);
    pWrap.innerHTML = C.purposes.map((p) =>
      `<button class="chip" type="button" role="radio" data-p="${p.id}" aria-checked="${p.id === state.purpose}">${p.label}</button>`).join('');
    const chips = $$('.chip', pWrap);

    /* — счётчик — */
    const numBox = $('.g-num', sec), sr = $('.js-gsr', sec), unit = $('.js-gunit', sec);
    let numCur = $('.g-num-in', numBox);
    const [btnMinus, btnPlus] = $$('.g-btn', sec);

    function setNum(n, dir) {
      if (PRIV.rm) { numCur.textContent = n; return; }
      const old = numCur;
      const nu = old.cloneNode(); nu.textContent = n;
      numBox.insertBefore(nu, sr);
      numCur = nu;
      // как табло: старая цифра уезжает, новая заезжает
      gsap.fromTo(nu, { yPercent: dir * 100 }, { yPercent: 0, duration: 0.45, ease: 'expo.out' });
      gsap.to(old, { yPercent: -dir * 100, duration: 0.45, ease: 'expo.out', onComplete: () => old.remove() });
    }

    /* — спальные места: прорисовка линии — */
    const beds = $$('.g-bed', sec);
    beds.forEach((f) => {
      $$('path', f).forEach((p) => {
        const len = Math.ceil(p.getTotalLength());
        p.style.strokeDasharray = len; p.style.strokeDashoffset = 0; p.dataset.len = len;
      });
    });
    function setBeds(n, first) {
      const need = n <= 2 ? ['bed'] : n <= 4 ? ['bed', 'sofa'] : ['bed', 'sofa', 'chair'];
      beds.forEach((f) => {
        const on = need.includes(f.dataset.bed), was = f.classList.contains('is-on');
        f.classList.toggle('is-on', on);
        if (on && !was && !first && !PRIV.rm) {
          $$('path', f).forEach((p) => gsap.fromTo(p, { strokeDashoffset: +p.dataset.len }, { strokeDashoffset: 0, duration: 0.6, ease: 'power2.inOut' }));
        }
      });
    }

    /* — карточка результата — */
    const card = $('#gCard'), title = $('.g-title', card), desc = $('.g-desc', card), hint = $('.g-hint', card);
    const price = $('.g-price', card), perks = $('.g-perks', card), msg = $('.g-msg', card);

    function message() {
      const f = C.formats[state.purpose];
      const p = C.purposes.find((x) => x.id === state.purpose);
      const n = state.guests;
      let head;
      if (n === 1) head = state.purpose === 'work' ? 'Приеду один, в командировку.' : 'Приеду один.';
      else head = `Нас ${n}, ${p.phrase}.`;
      const t = f.title.charAt(0).toLowerCase() + f.title.slice(1);
      return `Здравствуйте! ${head} Интересует ${t}. Подскажите свободные даты?`;
    }

    function fillCard() {
      const f = C.formats[state.purpose];
      title.textContent = f.title;
      desc.textContent = f.desc;
      const showHint = state.guests >= 3 && state.purpose === 'pair';
      hint.hidden = !showHint;
      if (showHint) hint.innerHTML = 'Вас больше двоих — посмотрите <button type="button" class="g-link" data-p="friends">номер для друзей</button> или <button type="button" class="g-link" data-p="family">семейный</button>.';
      if (C.showPrices) {
        price.classList.remove('is-text');
        price.innerHTML = `<b>от ${U.money(f.from)} ₽</b><span>/ сутки</span><small>${C.priceNote}</small>`;
      } else {
        price.classList.add('is-text');
        price.textContent = C.priceHidden;
      }
      perks.innerHTML = f.perks.map((p) => `<li data-flip-id="perk-${p}">${p}</li>`).join('');
      msg.textContent = message();
    }

    function update(opts = {}) {
      const kids = () => [...card.children, ...$$('li', perks)];
      let st = null, h0 = 0;
      if (!opts.first && !PRIV.rm) { st = Flip.getState(kids()); h0 = card.offsetHeight; }
      fillCard();
      unit.textContent = plural(state.guests, 'гость', 'гостя', 'гостей');
      sr.textContent = `${state.guests} ${unit.textContent}`;
      btnMinus.disabled = state.guests <= MIN;
      btnPlus.disabled = state.guests >= MAX;
      chips.forEach((c) => c.setAttribute('aria-checked', String(c.dataset.p === state.purpose)));
      setBeds(state.guests, opts.first);
      if (st) {
        // FLIP-пересборка карточки
        const h1 = card.offsetHeight;
        Flip.from(st, {
          targets: kids(), duration: 0.5, ease: 'power3.inOut', scale: false, prune: true,
          onEnter: (els) => gsap.fromTo(els, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.45, delay: 0.1, ease: 'expo.out' }),
        });
        if (Math.abs(h1 - h0) > 1) gsap.fromTo(card, { height: h0 }, { height: h1, duration: 0.5, ease: 'power3.inOut', clearProps: 'height' });
        gsap.fromTo([title, desc, msg], { opacity: 0.35 }, { opacity: 1, duration: 0.5, ease: 'power2.out' });
      }
    }

    sec.addEventListener('click', (e) => {
      const b = e.target.closest('[data-d], [data-p]');
      if (!b) return;
      if (b.dataset.d) {
        const d = +b.dataset.d, n = Math.min(MAX, Math.max(MIN, state.guests + d));
        if (n === state.guests) return;
        state.guests = n;
        setNum(n, d > 0 ? 1 : -1);
      } else {
        if (state.purpose === b.dataset.p) return;
        state.purpose = b.dataset.p;
      }
      update();
    });
    pWrap.addEventListener('keydown', (e) => {
      const i = chips.indexOf(document.activeElement);
      if (i < 0 || !['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
      e.preventDefault();
      const n = chips[(i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : chips.length - 1)) % chips.length];
      n.focus(); n.click();
    });

    /* — копирование сообщения — */
    const copyBtn = $('.js-copy', card), copyLab = $('span', copyBtn);
    let copyT = 0;
    async function copy() {
      const text = message();
      let ok = false;
      try { await navigator.clipboard.writeText(text); ok = true; } catch (e) {
        try {
          const ta = document.createElement('textarea');
          ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0;left:0;top:0';
          document.body.appendChild(ta); ta.select(); ok = document.execCommand('copy'); ta.remove();
        } catch (e2) { ok = false; }
      }
      copyLab.textContent = ok ? 'Скопировано' : 'Выделите текст выше';
      if (!PRIV.rm) gsap.fromTo(copyLab, { y: 6, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: 'expo.out' });
      clearTimeout(copyT);
      copyT = setTimeout(() => { copyLab.textContent = 'Скопировать сообщение'; }, 2000);
    }
    copyBtn.addEventListener('click', copy);

    // строка про остальные форматы из прайса
    const extra = $('.g-extra', sec);
    if (extra) {
      const lux = C.extraFormat;
      extra.textContent = `Ещё в прайсе: ${lux.title.toLowerCase()}${C.showPrices ? ` — от ${U.money(lux.from)} ₽` : ''} · категории: ${C.categories.join(', ')}`;
    }

    update({ first: true });
  }

  PRIV.configurator = { init };
})();
