// Дамп карточки Яндекс.Карт: state-view (данные, отзывы, удобства) + ссылки на фото галереи.
//   node tools/dump-yandex.mjs
import { chromium } from 'playwright-core';
import fs from 'node:fs'; import path from 'node:path';

const ORG = 'https://yandex.ru/maps/org/privilegiya/179169166043';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync('raw/ya', { recursive: true });

async function waitState(page) {
  const end = Date.now() + 180000; let warned = false;
  while (Date.now() < end) {
    if (await page.evaluate(() => !!document.querySelector('script.state-view')).catch(() => false)) return true;
    if (/captcha|showcaptcha/i.test(page.url()) && !warned) { console.log('⚠ Капча — реши в окне браузера'); warned = true; }
    await sleep(2000);
  }
  return false;
}

let ctx;
const profileDir = path.resolve('..', 'leadgen', '.browser-profile');
for (const channel of ['chrome', 'msedge']) {
  try { ctx = await chromium.launchPersistentContext(profileDir, { channel, headless: false, viewport: { width: 1440, height: 950 }, locale: 'ru-RU' }); break; }
  catch (e) { if (channel === 'msedge') throw e; }
}
const page = ctx.pages()[0] || (await ctx.newPage());
const allPhotos = new Set();

for (const [sub, suffix] of [['card', '/'], ['gallery', '/gallery/'], ['reviews', '/reviews/'], ['features', '/features/']]) {
  await page.goto(ORG + suffix, { waitUntil: 'domcontentloaded', timeout: 90000 });
  if (!(await waitState(page))) { console.log(`  ! ${sub}`); continue; }
  if (sub === 'gallery' || sub === 'reviews') {
    for (let i = 0; i < 40; i++) {
      const urls = await page.evaluate(() => {
        const o = [];
        for (const i of document.querySelectorAll('img')) if (/get-altay/.test(i.src)) o.push(i.src);
        for (const e of document.querySelectorAll('[style*="background-image"]')) {
          const m = e.style.backgroundImage.match(/url\("?([^")]+)"?\)/); if (m && /get-altay/.test(m[1])) o.push(m[1]);
        }
        return o;
      });
      if (sub === 'gallery') urls.forEach((u) => allPhotos.add(u.replace(/\/[A-Za-z_0-9]+$/, '/')));
      await page.mouse.move(400, 600); await page.mouse.wheel(0, 1500); await sleep(650);
      if (i % 10 === 9) console.log(`  …${sub} ${allPhotos.size}`);
    }
  }
  const state = await page.evaluate(() => document.querySelector('script.state-view')?.textContent);
  if (state) { fs.writeFileSync(`raw/ya/ya-${sub}.json`, state, 'utf8'); console.log(`  ✓ raw/ya/ya-${sub}.json ${(state.length / 1024).toFixed(0)}КБ`); }
  await sleep(1200);
}
fs.writeFileSync('raw/ya/ya-photos.json', JSON.stringify([...allPhotos].map((base) => ({ base })), null, 2), 'utf8');
console.log(`✓ raw/ya/ya-photos.json — ${allPhotos.size}`);
await ctx.close();
