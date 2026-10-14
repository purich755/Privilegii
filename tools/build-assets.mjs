// Сборка фото сайта: кадрирование, ресайз, webp + jpg, отчёт с размерами.
//   node tools/build-assets.mjs
// Источники: raw/client (фото клиента), raw/frames (кадры из видео клиента), raw/ya/img (Яндекс.Карты).
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const OUT = 'assets/img';
fs.mkdirSync(OUT, { recursive: true });

const ya = (n) => {
  const f = fs.readdirSync('raw/ya/img').find((x) => x.startsWith(`ya_${n}_`));
  return `raw/ya/img/${f}`;
};

// Лучший (самый резкий) кадр слайда видео среди кандидатов: дисперсия лапласиана.
async function sharpest(seconds, crop) {
  let best = null;
  for (const s of seconds) for (const d of [3, 7]) {
    const f = `raw/frames/g_${s}_${d}.png`;
    if (!fs.existsSync(f)) continue;
    const { info, data } = await sharp(f).extract(crop).greyscale()
      .convolve({ width: 3, height: 3, kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0] })
      .raw().toBuffer({ resolveWithObject: true });
    let sum = 0, sq = 0;
    for (const v of data) { sum += v; sq += v * v; }
    const n = info.width * info.height;
    const variance = sq / n - (sum / n) ** 2;
    if (!best || variance > best.v) best = { f, v: variance };
  }
  return best.f;
}

// crop: {left, top, width, height} в пикселях исходника; sizes — ширины выходных файлов
const V = (sec) => ({ video: sec });
const items = [
  // — фото клиента —
  { name: 'living-fireplace', src: 'raw/client/living-fireplace.jpg', sizes: [2000, 1280, 820], q: 80 },
  { name: 'living-sofa', src: 'raw/client/living-sofa.jpg', sizes: [1500, 900] },
  { name: 'detail-forest', src: 'raw/client/bedroom-forest.jpg', crop: { left: 0, top: 0, width: 2000, height: 600 }, sizes: [2000, 1000] },
  { name: 'kitchen-living', src: 'raw/client/kitchen-living.jpg', sizes: [2000, 1280, 820], q: 78 },
  { name: 'kitchen-fire', src: 'raw/client/kitchen-living.jpg', crop: { left: 1000, top: 250, width: 1000, height: 1250 }, sizes: [1000, 640] },
  { name: 'kitchen-vertical', src: 'raw/client/kitchen-vertical.jpg', sizes: [1500, 900] },
  // — кадры из видео клиента (обрезаны поля и водяные знаки InShot / Avito) —
  { name: 'bath-faucet', ...V([11, 12, 13]), crop: { left: 0, top: 64, width: 840, height: 566 }, sizes: [840] },
  { name: 'entry-door', ...V([21, 22, 23]), crop: { left: 226, top: 10, width: 508, height: 700 }, sizes: [508] },
  { name: 'entry-hall', ...V([51, 52, 53]), crop: { left: 198, top: 0, width: 564, height: 688 }, sizes: [564] },
  { name: 'detail-table', ...V([36, 37]), crop: { left: 212, top: 0, width: 536, height: 720 }, sizes: [536] },
  { name: 'house-lobby-red', ...V([46, 47, 48]), crop: { left: 0, top: 92, width: 960, height: 530 }, sizes: [960] },
  { name: 'detail-dryer', ...V([56, 57, 58]), crop: { left: 0, top: 72, width: 900, height: 566 }, sizes: [900] },
  { name: 'detail-towels', ...V([61, 62, 63]), crop: { left: 0, top: 100, width: 960, height: 518 }, sizes: [960] },
  { name: 'detail-books', ...V([66, 67, 68]), crop: { left: 0, top: 32, width: 960, height: 606 }, sizes: [960] },
  { name: 'bedroom-tray', ...V([71, 72, 73]), crop: { left: 0, top: 36, width: 960, height: 616 }, sizes: [960] },
  { name: 'bath-led', ...V([76, 77, 78]), crop: { left: 60, top: 0, width: 716, height: 720 }, sizes: [716] },
  // — Яндекс.Карты (галерея организации) —
  { name: 'house-lobby', src: ya('04'), sizes: [1400, 900] },
  { name: 'house-lobby-2', src: ya('08'), sizes: [1200, 800] },
  { name: 'house-mirror', src: ya('13'), sizes: [900] },
  { name: 'house-entrance', src: ya('05'), sizes: [1600, 900] },
  { name: 'house-tower', src: ya('07'), sizes: [1200, 800] },
  { name: 'house-facade', src: ya('01'), crop: { left: 0, top: 0, width: 3072, height: 3150 }, sizes: [1200, 800] },
  { name: 'house-yard-chess', src: ya('03'), sizes: [1080, 800] },
  { name: 'house-yard', src: ya('25'), sizes: [1200, 800] },
  { name: 'house-gate', src: ya('24'), sizes: [1200, 800] },
  { name: 'house-bikes', src: ya('26'), sizes: [1000, 700] },
  { name: 'house-street', src: ya('31'), sizes: [1600, 900] },
  { name: 'bedroom-forest', src: ya('02'), sizes: [1600, 900] },
  { name: 'bedroom-bed', src: ya('02'), crop: { left: 880, top: 896, width: 2800, height: 2100 }, sizes: [1600, 1000] },
  { name: 'bedroom-grey', src: ya('20'), sizes: [1200, 800] },
  { name: 'bedroom-tv', src: ya('11'), sizes: [1600, 900] },
  { name: 'bedroom-quilt', src: ya('28'), sizes: [1200, 800] },
  { name: 'bedroom-second', src: ya('15'), sizes: [1280, 800] },
  { name: 'living-tv', src: ya('19'), sizes: [1200, 800] },
  { name: 'living-corner', src: ya('21'), sizes: [1600, 900] },
  { name: 'bath-sink', src: ya('14'), sizes: [1200, 800] },
];

const report = {};
for (const it of items) {
  let src = it.src;
  if (it.video) src = await sharpest(it.video, it.crop);
  let base = sharp(src).rotate();
  if (it.crop) base = base.extract(it.crop);
  const buf = await base.toBuffer();
  const meta = await sharp(buf).metadata();
  const ratio = meta.height / meta.width;
  report[it.name] = { w: meta.width, h: meta.height, src: path.basename(src), files: [] };
  for (const w0 of it.sizes) {
    const w = Math.min(w0, meta.width);
    const h = Math.round(w * ratio);
    const img = sharp(buf).resize(w, h);
    const suffix = it.sizes.length > 1 ? `-${w}` : '';
    const jpg = await img.clone().jpeg({ quality: it.q || 80, mozjpeg: true, progressive: true }).toBuffer();
    // WebP на шумных кадрах бывает тяжелее mozjpeg — снижаем качество, пока не станет легче
    let q = 78, webp;
    do { webp = await img.clone().webp({ quality: q, effort: 5 }).toBuffer(); q -= 6; } while (webp.length > jpg.length * 0.92 && q > 50);
    fs.writeFileSync(`${OUT}/${it.name}${suffix}.jpg`, jpg);
    fs.writeFileSync(`${OUT}/${it.name}${suffix}.webp`, webp);
    report[it.name].files.push({ w, h, jpg: (jpg.length / 1024) | 0, webp: (webp.length / 1024) | 0 });
  }
}
fs.writeFileSync('raw/assets-report.json', JSON.stringify(report, null, 1));
for (const [k, v] of Object.entries(report)) console.log(k.padEnd(18), `${v.w}x${v.h}`.padEnd(11), v.src.padEnd(22), v.files.map((f) => `${f.w}:${f.webp}K`).join(' '));
