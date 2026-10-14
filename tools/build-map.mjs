// Статичная карта района из тайлов OpenStreetMap (z16): склейка → кроп по дому.
// По умолчанию на сайте — эта картинка: виджет Яндекса подмешивает рекламный блок,
// а виджет организации — звёзды рейтинга. Интерактивная Яндекс-карта грузится по кнопке.
//   node tools/build-map.mjs
import sharp from 'sharp';
import fs from 'node:fs';
const LON = 49.199246, LAT = 55.756989;
for (const [name, Z, W, H] of [['map-gorki', 16, 2000, 762], ['map-gorki-sm', 16, 1000, 760]]) {
  const n = 2 ** Z;
  const fx = ((LON + 180) / 360) * n;
  const fy = ((1 - Math.log(Math.tan((LAT * Math.PI) / 180) + 1 / Math.cos((LAT * Math.PI) / 180)) / Math.PI) / 2) * n;
  const px = fx * 256, py = fy * 256;
  const x0 = Math.floor((px - W / 2) / 256), y0 = Math.floor((py - H / 2) / 256);
  const x1 = Math.floor((px + W / 2) / 256), y1 = Math.floor((py + H / 2) / 256);
  const comps = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
    const f = `raw/osm/${Z}-${x}-${y}.png`;
    if (!fs.existsSync(f)) {
      const r = await fetch(`https://tile.openstreetmap.org/${Z}/${x}/${y}.png`, { headers: { 'User-Agent': 'privilegiya-demo static map (one-off build)' } });
      if (!r.ok) throw new Error(`tile ${x},${y}: ${r.status}`);
      fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
      await new Promise((r) => setTimeout(r, 150));
    }
    comps.push({ input: f, left: (x - x0) * 256, top: (y - y0) * 256 });
  }
  const big = await sharp({ create: { width: (x1 - x0 + 1) * 256, height: (y1 - y0 + 1) * 256, channels: 3, background: '#fff' } }).composite(comps).png().toBuffer();
  const left = Math.round(px - W / 2 - x0 * 256), top = Math.round(py - H / 2 - y0 * 256);
  const base = sharp(big).extract({ left, top, width: W, height: H }).modulate({ saturation: 0.8 });
  await base.clone().webp({ quality: 80 }).toFile(`assets/img/${name}.webp`);
  await base.clone().jpeg({ quality: 82, mozjpeg: true }).toFile(`assets/img/${name}.jpg`);
  console.log(name, W, H);
}
