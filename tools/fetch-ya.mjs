// Скачивает фото организации с Яндекс.Карт (без конкурентов из state) в raw/ya/img/
import fs from 'node:fs';
const j = JSON.parse(fs.readFileSync('raw/ya/ya-gallery.json', 'utf8'));
const ids = new Set();
const id = (u) => (u.match(/get-altay\/(\d+\/[0-9a-z]+)/) || [])[1];
for (const it of j.stack.flatMap((s) => s.results?.items || [])) for (const p of it.photos?.items || []) ids.add(id(p.urlTemplate));
for (const o of JSON.parse(fs.readFileSync('raw/ya/ya-photos.json', 'utf8'))) ids.add(id(o.base));
const given = `18098886/2a0000019e21030f1710716185edefa71001 19595165/2a0000019d8680f543458f2914c7ecb510b6 17673063/2a0000019d8680ece061f889bd06cb229c08 16386092/2a0000019db52ab45a9a89fdf1af754ec411 19876101/2a0000019ef07e39949cdd63e546d873ca7a 17753003/2a0000019d8680dfa8bbeb451c9f515b0a5b 19392810/2a0000019d8680f12e6d2aed875972c047e5 17714326/2a0000019ef07e37cc3fbddbce05d3bcd1ca 16451045/2a0000019d8680eb24bb4c56ebd7332b0f62`.split(' ');
given.forEach((g) => ids.add(g));
ids.delete(undefined);
// исключаем фото конкурентов
const comp = new Set();
for (const it of j.stack.flatMap((s) => s.results?.items || [])) {
  const c = JSON.stringify(it.competitor || {}); for (const m of c.matchAll(/get-altay\/(\d+\/[0-9a-z]+)/g)) comp.add(m[1]);
}
const list = [...ids].filter((x) => !comp.has(x) || given.includes(x));
console.log('всего', ids.size, 'после фильтра', list.length);
fs.mkdirSync('raw/ya/img', { recursive: true });
let n = 0;
for (const x of list) {
  const name = `raw/ya/img/ya_${String(++n).padStart(2, '0')}_${x.split('/')[1].slice(-6)}.jpg`;
  for (const size of ['orig', 'XXXL']) {
    const r = await fetch(`https://avatars.mds.yandex.net/get-altay/${x}/${size}`);
    if (r.ok) { fs.writeFileSync(name, Buffer.from(await r.arrayBuffer())); break; }
  }
}
fs.writeFileSync('raw/ya/list.json', JSON.stringify(list, null, 1));
