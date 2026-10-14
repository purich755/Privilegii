// Пытаемся вытащить фото альбомов VK через настоящий Chrome (профиль leadgen)
import { chromium } from 'playwright-core'; import fs from 'node:fs'; import path from 'node:path';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ctx = await chromium.launchPersistentContext(path.resolve('..', 'leadgen', '.browser-profile'), { channel: 'chrome', headless: false, viewport: { width: 1280, height: 900 }, locale: 'ru-RU' });
const page = ctx.pages()[0] || (await ctx.newPage());
const out = {};
for (const a of ['301978193', '301978245', '0']) {
  await page.goto(`https://vk.com/album-225142845_${a}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await sleep(5000);
  for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 1500); await sleep(700); }
  out[a] = await page.evaluate(() => {
    const s = new Set();
    document.querySelectorAll('img').forEach((i) => /userapi|vkuser/.test(i.src) && s.add(i.src));
    document.querySelectorAll('[style*="background-image"]').forEach((e) => { const m = e.style.backgroundImage.match(/url\("?([^")]+)/); if (m && /userapi|vkuser/.test(m[1])) s.add(m[1]); });
    return { title: document.title, url: location.href, imgs: [...s] };
  });
  console.log(a, out[a].title, out[a].url, out[a].imgs.length);
}
fs.writeFileSync('raw/vk.json', JSON.stringify(out, null, 1));
await ctx.close();
