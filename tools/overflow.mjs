// Ищем элементы шире экрана: node tools/overflow.mjs [w] [h]
import { chromium } from 'playwright-core';
const [w = '1440', h = '900'] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, isMobile: +w < 768, hasTouch: +w < 768 });
await page.addInitScript(() => { try { sessionStorage.setItem('priv-intro', '1'); } catch (e) {} });
await page.goto('http://localhost:8480/', { waitUntil: 'load' });
await page.waitForTimeout(1500);
if (process.env.SCROLL) {
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < total; y += 700) { await page.evaluate((y) => PRIV.lenis ? PRIV.lenis.scrollTo(y, { immediate: true, force: true }) : scrollTo(0, y), y); await page.waitForTimeout(80); }
  await page.waitForTimeout(800);
}
const r = await page.evaluate(() => {
  const out = [];
  const W = document.documentElement.clientWidth;
  for (const el of document.querySelectorAll('body *')) {
    const b = el.getBoundingClientRect();
    if (b.right > W + 1 && b.width > 0) {
      let p = el.parentElement, clipped = false;
      while (p && p !== document.body) { const s = getComputedStyle(p); if (/(hidden|clip)/.test(s.overflowX)) { clipped = true; break; } p = p.parentElement; }
      if (!clipped) out.push(`${el.tagName}.${[...el.classList].join('.')} right=${Math.round(b.right)}`);
    }
  }
  return { sw: document.documentElement.scrollWidth, iw: innerWidth, W, out: out.slice(0, 25) };
});
console.log(JSON.stringify(r, null, 1));
await browser.close();
