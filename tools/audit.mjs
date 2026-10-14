// Функциональная самопроверка интерактивов: node tools/audit.mjs
import { chromium } from 'playwright-core';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = [], bad = [];
const say = (good, msg) => (good ? ok : bad).push(msg);

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ru-RU' });
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://localhost:8480' });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

// ---- вход «Свет включается» ----
const t0 = Date.now();
await page.goto('http://localhost:8480/', { waitUntil: 'domcontentloaded' });
const hadIntro = await page.evaluate(() => document.documentElement.hasAttribute('data-intro'));
await page.waitForFunction(() => !document.querySelector('.intro'), null, { timeout: 5000 }).catch(() => {});
const introMs = Date.now() - t0;
say(hadIntro, 'вход показан при первом заходе');
say(introMs < 2300, `вход завершился за ${introMs} мс (с загрузкой страницы)`);
await page.waitForLoadState('load');
await sleep(800);
await page.reload({ waitUntil: 'domcontentloaded' });
say(!(await page.evaluate(() => document.documentElement.hasAttribute('data-intro'))), 'повторно за сессию вход не показывается');
await page.waitForLoadState('load');
await sleep(1200);

// ---- камин ----
const fire = await page.evaluate(() => ({ n: document.querySelectorAll('.fire-canvas, .fire-fallback').length, ready: PRIV.fireReadyCount }));
say(fire.n >= 1, `камин: canvas в hero (${fire.n} шт.)`);

// ---- часы ----
const clock = await page.evaluate(() => ({ now: document.querySelector('.js-now').textContent, next: document.querySelector('.js-next').textContent, count: document.querySelector('#count').textContent }));
const kz = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
say(clock.now === kz, `часы по Казани: ${clock.now} (ожидали ${kz}), заселение «${clock.next}», отсчёт ${clock.count}`);
const c1 = await page.evaluate(() => document.querySelector('#count').textContent);
await sleep(1600);
const c2 = await page.evaluate(() => document.querySelector('#count').textContent);
say(c1 !== c2, `отсчёт тикает: ${c1} → ${c2}`);

const scrollTo = (sel, off = 0) => page.evaluate(([sel, off]) => {
  const el = document.querySelector(sel);
  const y = el.getBoundingClientRect().top + scrollY + off;
  PRIV.lenis.scrollTo(y, { immediate: true, force: true });
}, [sel, off]);

// ---- «Кто едет?» ----
await scrollTo('#guests', 200); await sleep(900);
const plus = page.locator('.g-btn[data-d="1"]');
await plus.click(); await sleep(300); await plus.click(); await sleep(700);
let g = await page.evaluate(() => ({ unit: document.querySelector('.js-gunit').textContent, beds: [...document.querySelectorAll('.g-bed.is-on')].map((b) => b.dataset.bed), hint: !document.querySelector('.g-hint').hidden, msg: document.querySelector('.g-msg').textContent }));
say(g.unit === 'гостя' && g.beds.join() === 'bed,sofa' && g.hint, `гости=4: «${g.unit}», места ${g.beds}, подсказка ${g.hint}`);
await page.locator('.g-purpose .chip[data-p="family"]').click(); await sleep(800);
g = await page.evaluate(() => ({ title: document.querySelector('.g-title').textContent, price: document.querySelector('.g-price').textContent, msg: document.querySelector('.g-msg').textContent }));
say(g.title === 'Номер семейный' && /5\s000/.test(g.price), `семья: ${g.title}, ${g.price}`);
say(g.msg === 'Здравствуйте! Нас 4, едем с семьёй. Интересует номер семейный. Подскажите свободные даты?', `сообщение: ${g.msg}`);
await page.locator('.js-copy').click(); await sleep(300);
const copied = await page.evaluate(async () => ({ lab: document.querySelector('.js-copy span').textContent, clip: await navigator.clipboard.readText().catch(() => '') }));
say(copied.lab === 'Скопировано' && copied.clip.startsWith('Здравствуйте'), `копирование: «${copied.lab}»`);
await plus.click(); await sleep(500);
say((await page.evaluate(() => [...document.querySelectorAll('.g-bed.is-on')].length)) === 3, '5 гостей — горят все три места');
say(await page.evaluate(() => document.querySelector('.g-btn[data-d="1"]').disabled), 'плюс выключен на 5');

// ---- «Всё на месте»: превью за курсором ----
await scrollTo('#insideList', -200); await sleep(900);
const row = await page.locator('.inside-row').nth(3).boundingBox();
await page.mouse.move(row.x + 80, row.y + row.height / 2, { steps: 4 }); await sleep(500);
await page.mouse.move(row.x + 200, row.y + row.height / 2, { steps: 8 }); await sleep(600);
const pv = await page.evaluate(() => ({ on: document.querySelector('#insidePreview').classList.contains('is-on'), src: document.querySelector('#insidePreview img.is-front')?.getAttribute('src'), act: document.querySelector('.inside-row.is-active span:last-child')?.textContent }));
say(pv.on && /bath-faucet/.test(pv.src || ''), `превью: ${pv.act} → ${pv.src}`);
await page.mouse.move(5, 5); await sleep(400);

// ---- утюг ----
await scrollTo('#ironStage', -150); await sleep(1500);
const ib = await page.locator('#ironCanvas').boundingBox();
for (let pass = 0; pass < 14; pass++) {
  const y = ib.y + ib.height * (0.28 + pass * 0.034);
  await page.mouse.move(ib.x + 10, y);
  await page.mouse.move(ib.x + ib.width - 10, y, { steps: 16 });
}
await sleep(900);
const iron = await page.evaluate(() => ({ done: document.querySelector('.iron-done').classList.contains('is-on'), txt: document.querySelector('.iron-done').textContent, reset: !document.querySelector('.iron-reset').hidden }));
say(iron.done && iron.reset, `утюг: ${iron.txt || 'не готово'}`);
if (iron.reset) {
  await page.locator('.iron-reset').click(); await sleep(400);
  say(!(await page.evaluate(() => document.querySelector('.iron-done').classList.contains('is-on'))), 'утюг: «Ещё раз» возвращает мятость');
}

// ---- галерея ----
await scrollTo('#galFilters', -200); await sleep(800);
await page.locator('#galFilters .chip[data-f="bath"]').click(); await sleep(1100);
const vis = await page.evaluate(() => [...document.querySelectorAll('.g-item')].filter((e) => e.style.display !== 'none').length);
say(vis === 3, `фильтр «Ванная»: ${vis} фото`);
await page.locator('#galFilters .chip[data-f="all"]').click(); await sleep(1100);
await scrollTo('#mosaic', -100); await sleep(900);
await page.locator('.g-open').first().click(); await sleep(900);
let lb = await page.evaluate(() => ({ open: !document.querySelector('#lb').hidden, n: document.querySelector('.js-lbn').textContent, t: document.querySelector('.js-lbt').textContent, focus: document.activeElement.className }));
say(lb.open && lb.n === '01', `лайтбокс открыт: ${lb.n} / ${lb.t}, фокус на ${lb.focus}`);
await page.keyboard.press('ArrowRight'); await sleep(500);
say((await page.evaluate(() => document.querySelector('.js-lbn').textContent)) === '02', 'лайтбокс: стрелка вправо → 02');
// зум колёсиком
const st = await page.locator('.lb-stage').boundingBox();
await page.mouse.move(st.x + st.width / 2, st.y + st.height / 2);
await page.mouse.wheel(0, -300); await sleep(500);
say(/scale\((?!1\))/.test(await page.evaluate(() => document.querySelector('.lb-zoom').style.transform)), 'лайтбокс: зум колёсиком');
// фокус-ловушка
for (let i = 0; i < 40; i++) await page.keyboard.press('Tab');
say(await page.evaluate(() => document.querySelector('#lb').contains(document.activeElement)), 'лайтбокс: фокус не выходит наружу');
await page.keyboard.press('Escape'); await sleep(900);
lb = await page.evaluate(() => ({ open: !document.querySelector('#lb').hidden, focusInMosaic: !!document.activeElement.closest('#mosaic') }));
say(!lb.open && lb.focusInMosaic, `Esc закрывает, фокус вернулся на карточку: ${lb.focusInMosaic}`);

// ---- колода ----
await scrollTo('#deck', -200); await sleep(900);
await page.locator('.deck-btn[data-dir="1"]').click(); await sleep(900);
let dn = await page.evaluate(() => document.querySelector('.js-dn').textContent);
say(dn === '02', `колода: кнопка → ${dn}`);
await page.locator('#deck').focus(); await page.keyboard.press('ArrowLeft'); await sleep(900);
dn = await page.evaluate(() => document.querySelector('.js-dn').textContent);
say(dn === '01', `колода: стрелка влево → ${dn}`);
const db = await page.locator('#deck').boundingBox();
await page.mouse.move(db.x + db.width / 2, db.y + db.height / 2);
await page.mouse.down();
await page.mouse.move(db.x + db.width / 2 + 260, db.y + db.height / 2 + 20, { steps: 10 });
await page.mouse.up(); await sleep(1000);
dn = await page.evaluate(() => document.querySelector('.js-dn').textContent);
say(dn === '02', `колода: перетаскивание отбрасывает карточку → ${dn}`);

// ---- шкала времени ----
await scrollTo('#guests'); await sleep(600);
const act = await page.evaluate(() => document.querySelector('.tl-list a.is-active')?.dataset.tl);
say(act === 'guests', `шкала: активна «${act}»`);
await page.locator('.tl-list a[data-tl="house"] .tl-tick').hover({ force: true }).catch(() => {}); await sleep(400);
await page.locator('.tl-list a[data-tl="house"]').click({ force: true }); await sleep(2000);
const house = await page.evaluate(() => Math.round(document.querySelector('#house').getBoundingClientRect().top));
say(Math.abs(house - 40) < 30, `шкала: клик ведёт к «Дому» (top=${house})`);

// ---- разметка ----
const m = await page.evaluate(() => ({
  h1: document.querySelectorAll('h1').length,
  noAlt: [...document.querySelectorAll('img')].filter((i) => !i.hasAttribute('alt')).length,
  emptyHref: [...document.querySelectorAll('a')].filter((a) => !a.getAttribute('href') || a.getAttribute('href') === '#').length,
  badAnchors: [...document.querySelectorAll('a[href^="#"]')].filter((a) => a.getAttribute('href').length > 1 && !document.querySelector(a.getAttribute('href'))).map((a) => a.getAttribute('href')),
  hotlinks: [...document.querySelectorAll('img, source, video')].map((e) => e.getAttribute('src') || e.getAttribute('srcset') || '').filter((s) => /yandex|userapi|vk\./.test(s)).length,
  stars: /★|☆|рейтинг/i.test(document.body.innerText),
  demo: /Демо-версия сайта/.test(document.body.innerText),
  ld: (() => { try { const j = JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent); return j['@type'] + ' ' + j.checkinTime + '/' + j.checkoutTime + ' rating:' + ('aggregateRating' in j); } catch (e) { return 'ERR ' + e.message; } })(),
}));
say(m.h1 === 1, `один h1 (${m.h1})`);
say(m.noAlt === 0, `img без alt: ${m.noAlt}`);
say(m.emptyHref === 0 && m.badAnchors.length === 0, `пустые ссылки: ${m.emptyHref}, битые якоря: ${m.badAnchors.join(',') || 'нет'}`);
say(m.hotlinks === 0, `хотлинков: ${m.hotlinks}`);
say(!m.stars, 'нет звёзд и рейтингов в тексте');
say(m.demo, 'в футере «Демо-версия сайта»');
say(/LodgingBusiness 15:00\/12:00 rating:false/.test(m.ld), `JSON-LD: ${m.ld}`);

const own = errors.filter((e) => !/yandex|ERR_CERT|ERR_CONNECTION|ERR_TOO_MANY|status of 400|mc\.yandex/i.test(e));
say(own.length === 0, `ошибки консоли страницы: ${own.length ? own.join(' | ') : 'нет'}`);

console.log('\nOK:\n  ' + ok.join('\n  '));
console.log('\nПРОБЛЕМЫ:\n  ' + (bad.join('\n  ') || 'нет'));
await browser.close();
