// Скриншоты для самопроверки: node tools/shots.mjs <имя> <ширина> <высота> [скролл-к-селектору|y] [задержка-мс]
//   node tools/shots.mjs hero 1440 900
//   node tools/shots.mjs day 1440 900 "#day" 1500
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const [name = 'shot', w = '1440', h = '900', to = '', delay = '1200', extra = ''] = process.argv.slice(2);
fs.mkdirSync('raw/shots', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, reducedMotion: process.env.RM ? 'reduce' : 'no-preference' });
const errs = [];
page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
await page.addInitScript(() => { try { sessionStorage.setItem('priv-intro', '1'); } catch (e) {} });
await page.goto('http://localhost:8480/', { waitUntil: 'load' });
await page.waitForTimeout(900);
if (to) {
  await page.evaluate(async (to) => {
    const y = /^\d+$/.test(to) ? +to : (() => { const el = document.querySelector(to); const st = window.ScrollTrigger && ScrollTrigger.getAll().find((s) => s.pin === el || s.trigger === el && s.pin); return st ? st.start : el.getBoundingClientRect().top + scrollY; })();
    if (window.PRIV && PRIV.lenis) PRIV.lenis.scrollTo(y, { immediate: true, force: true }); else scrollTo(0, y);
  }, to);
}
if (extra) await page.evaluate(extra);
await page.waitForTimeout(+delay);
await page.screenshot({ path: `raw/shots/${name}.png` });
console.log(`raw/shots/${name}.png`, errs.length ? '\nERR: ' + errs.join('\n') : '');
await browser.close();
