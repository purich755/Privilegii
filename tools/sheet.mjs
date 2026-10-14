// Контактный лист: node tools/sheet.mjs <папка> <выход.jpg> [колонок]
import sharp from 'sharp'; import fs from 'node:fs';
const [dir, out, colsArg] = process.argv.slice(2); const cols = +colsArg || 8; const T = +process.env.T || 260;
const files = fs.readdirSync(dir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
const rows = Math.ceil(files.length / cols);
const tiles = await Promise.all(files.map(async (f, i) => {
  const img = await sharp(`${dir}/${f}`).rotate().resize(T, T - 20, { fit: 'contain', background: '#222' }).toBuffer();
  const label = Buffer.from(`<svg width="${T}" height="20"><rect width="100%" height="100%" fill="#000"/><text x="4" y="15" font-size="13" fill="#fff" font-family="Arial">${f}</text></svg>`);
  const tile = await sharp({ create: { width: T, height: T, channels: 3, background: '#222' } }).composite([{ input: img, top: 0, left: 0 }, { input: label, top: T - 20, left: 0 }]).jpeg().toBuffer();
  return { input: tile, left: (i % cols) * T, top: Math.floor(i / cols) * T };
}));
await sharp({ create: { width: cols * T, height: rows * T, channels: 3, background: '#111' } }).composite(tiles).jpeg({ quality: 82 }).toFile(out);
console.log(out);
