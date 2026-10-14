// Простой статический сервер для самопроверки.
//   node tools/serve.mjs [port]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
const PORT = Number(process.argv[2] || 8480);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.woff2': 'font/woff2' };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('404');
  }
  const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
  // как на GitHub Pages: текст отдаём сжатым
  const gz = /text|javascript|json|svg/.test(type) && /gzip/.test(req.headers['accept-encoding'] || '');
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store', ...(gz ? { 'Content-Encoding': 'gzip' } : {}) });
  (gz ? fs.createReadStream(file).pipe(zlib.createGzip()) : fs.createReadStream(file)).pipe(res);
}).listen(PORT, () => console.log(`http://localhost:${PORT}/`));
