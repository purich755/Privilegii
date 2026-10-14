// Кадры камина крупно: node tools/fire-frames.mjs [selector-stage] [w] [h] [y]
import { chromium } from 'playwright-core';
import sharp from 'sharp';
const [sel = '#heroStage', w = '1440', h = '900', y = '0'] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2 });
await page.addInitScript(() => { try { sessionStorage.setItem('priv-intro', '1'); } catch (e) {} });
await page.goto('http://localhost:8480/', { waitUntil: 'load' });
if (+y) await page.evaluate((y) => PRIV.lenis ? PRIV.lenis.scrollTo(+y, { immediate: true, force: true }) : scrollTo(0, +y), y);
await page.waitForTimeout(1800);
const box = await page.evaluate((sel) => { const c = document.querySelector(sel + ' .fire-canvas, ' + sel + ' .fire-fallback'); const r = c.getBoundingClientRect(); return { x: r.x - 30, y: r.y - 30, width: r.width + 60, height: r.height + 60 }; }, sel);
const bufs = [];
for (let i = 0; i < 4; i++) { bufs.push(await page.screenshot({ clip: box })); await page.waitForTimeout(260); }
const m = await sharp(bufs[0]).metadata();
await sharp({ create: { width: m.width * 2, height: m.height * 2, channels: 3, background: '#000' } })
  .composite(bufs.map((b, i) => ({ input: b, left: (i % 2) * m.width, top: Math.floor(i / 2) * m.height }))).png().toFile('raw/shots/fire-frames.png');
console.log('raw/shots/fire-frames.png', box);
await browser.close();
