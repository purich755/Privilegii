// Обход страницы скриншотами: node tools/tour.mjs [w] [h] [prefix] [список через запятую]
// элементы списка: id секции или id@доля (для pin-сцен: доля прогресса pin)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const [w = '1440', h = '900', prefix = 'd', list = 'key@0.05,key@0.5,key@0.95,day@0.02,day@0.3,day@0.5,day@0.62,day@0.8,day@1,guests,inside,iron,gallery,house,area,book,final'] = process.argv.slice(2);
fs.mkdirSync('raw/shots', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, isMobile: +w < 768, hasTouch: +w < 1024, deviceScaleFactor: 1, reducedMotion: process.env.RM ? 'reduce' : 'no-preference' });
const errs = [];
page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
await page.addInitScript(() => { try { sessionStorage.setItem('priv-intro', '1'); } catch (e) {} });
await page.goto('http://localhost:8480/', { waitUntil: 'load' });
await page.waitForTimeout(1000);
// прогоняем страницу до конца, чтобы ленивые картинки загрузились и reveal отработал
const total = await page.evaluate(() => document.documentElement.scrollHeight);
for (let y = 0; y < total; y += 700) { await page.evaluate((y) => PRIV.lenis ? PRIV.lenis.scrollTo(y, { immediate: true, force: true }) : scrollTo(0, y), y); await page.waitForTimeout(90); }
await page.waitForTimeout(600);
for (const item of list.split(',')) {
  const [id, frac] = item.split('@');
  const y = await page.evaluate(({ id, frac }) => {
    const el = document.getElementById(id);
    const st = ScrollTrigger.getAll().find((s) => s.pin === el || (s.trigger === el && s.pin));
    if (st && frac !== undefined) return st.start + (st.end - st.start) * +frac;
    if (st) return st.start;
    return el.getBoundingClientRect().top + scrollY + (frac ? +frac * el.offsetHeight : 0);
  }, { id, frac });
  await page.evaluate((y) => PRIV.lenis ? PRIV.lenis.scrollTo(y, { immediate: true, force: true }) : scrollTo(0, y), y);
  await page.waitForTimeout(1300);
  await page.screenshot({ path: `raw/shots/${prefix}-${item.replace('@', '-')}.png` });
}
const info = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, h: document.documentElement.scrollHeight }));
console.log(JSON.stringify(info), errs.length ? '\nERR:\n' + errs.join('\n') : 'no errors');
await browser.close();
