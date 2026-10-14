/* ==========================================================================
   fireplace.js — «живой камин»: синемаграф из настоящего фото клиента.
   Поверх фото кладём <canvas> строго на экран телевизора и оживляем только
   пламя: маска по яркости и тону, поток вверх по fbm-шуму, мерцание.
   Дрова, рамка ТВ и всё, что стоит перед экраном, не двигаются.
   Без WebGL — запасной вариант на SVG-фильтре (feTurbulence + feDisplacementMap).
   ========================================================================== */
(function () {
  'use strict';
  const PRIV = (window.PRIV = window.PRIV || {});

  /* Углы экрана ТВ в пикселях исходного кадра: ЛВ, ПВ, ПН, ЛН.
     exclude — то, что стоит перед экраном (фигурка Деда Мороза): там пламя не трогаем.
     glows — пятна отсвета [cx, cy, w, h] в тех же координатах. */
  const SCREENS = {
    living: {
      w: 2000, h: 1500,
      quad: [[340, 775], [782, 819], [773, 1074], [316, 1076]],
      exclude: [[702, 1030, 795, 1110], [300, 1004, 412, 1080]],
      glows: { wall: [560, 760, 1000, 520], floor: [560, 1300, 1100, 300] },
      spots: [[215, 255], [625, 378], [930, 465], [845, 120]],
    },
    kitchen: {
      w: 2000, h: 1500,
      quad: [[1241, 660], [1867, 610], [1888, 982], [1245, 965]],
      exclude: [[1735, 925, 1850, 1040]],
      glows: { wall: [1565, 720, 1100, 560], floor: [1565, 1240, 1100, 280] },
    },
  };
  // кадрированная версия кухни для сцены 21:00 (kitchen-fire.jpg = x 1000…2000, y 250…1500)
  SCREENS.kitchenCrop = shift(SCREENS.kitchen, 1000, 250, 1000, 1250);

  function shift(src, dx, dy, w, h) {
    return {
      w, h,
      quad: src.quad.map(([x, y]) => [x - dx, y - dy]),
      exclude: src.exclude.map(([a, b, c, d]) => [a - dx, b - dy, c - dx, d - dy]),
      glows: {},
    };
  }

  /* ---------- шейдеры ---------- */
  const VERT = `
    attribute vec2 aPos;
    varying vec2 vUv;
    void main() {
      vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5); // v = 0 — верх кадра
      gl_Position = vec4(aPos, 0.0, 1.0);
    }`;

  const FRAG = `
    precision mediump float;
    varying vec2 vUv;
    uniform sampler2D uTex;
    uniform float uTime;
    uniform float uAmp;

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
                 mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
    }
    // fbm из трёх октав
    float fbm(vec2 p) {
      float v = 0.0, a = 0.5;
      for (int i = 0; i < 3; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
      return v;
    }

    void main() {
      vec4 base = texture2D(uTex, vUv);
      float m = smoothstep(0.04, 0.55, base.a);       // маска пламени (посчитана на CPU, в альфе)
      float t = uTime;

      // поток вверх: узор шума ползёт к верху кадра
      vec2 p = vUv * vec2(3.0, 6.0);
      float nx = fbm(p + vec2(0.0, t * 0.9));
      float ny = fbm(p * 1.17 + vec2(4.3, t * 1.25));
      vec2 off = vec2((nx - 0.5) * 0.024, (ny - 0.32) * 0.022) * uAmp * m;
      vec3 col = texture2D(uTex, vUv + off).rgb;

      // мерцание яркости, сильнее у основания пламени
      float flick = 1.0 + 0.08 * sin(t * 7.3) + 0.05 * (noise(vec2(t * 2.1, 0.5)) * 2.0 - 1.0);
      float band = fbm(vUv * vec2(4.0, 7.5) + vec2(0.0, t * 1.6));   // светлые языки бегут вверх
      float baseW = smoothstep(0.2, 0.95, vUv.y);
      float k = m * (0.65 + 0.55 * baseW);
      col *= mix(1.0, flick * (0.9 + 0.24 * band), k);

      gl_FragColor = vec4(col, 1.0);
    }`;

  /* ---------- маска пламени на CPU ---------- */
  function buildMask(data, w, h, exclude, k, bx, by) {
    const n = w * h;
    const mask = new Float32Array(n);
    for (let i = 0, j = 0; i < n; i++, j += 4) {
      const r = data[j], g = data[j + 1], b = data[j + 2];
      // тёплые яркие пиксели: r высокий и заметно больше синего
      const bright = smooth(118, 196, r);
      const warm = smooth(1.35, 2.05, r / (b + 10));
      const notGrey = smooth(18, 60, r - Math.min(g, b));
      mask[i] = bright * warm * notGrey;
    }
    // исключения (то, что стоит перед экраном) — с запасом, чтобы сдвиг пламени
    // не «затягивал» их пиксели в огонь
    const pad = Math.round(w * 0.035);
    for (const [x0, y0, x1, y1] of exclude) {
      const ax = Math.max(0, Math.floor((x0 - bx) * k) - pad), ay = Math.max(0, Math.floor((y0 - by) * k) - pad);
      const cx = Math.min(w, Math.ceil((x1 - bx) * k) + pad), cy = Math.min(h, Math.ceil((y1 - by) * k) + pad);
      for (let y = ay; y < cy; y++) for (let x = ax; x < cx; x++) mask[y * w + x] = -1;
    }
    // мягкие края: два прохода box-blur
    const rad = Math.max(1, Math.round(2 * k + 1));
    let a = mask, tmp = new Float32Array(n);
    for (let pass = 0; pass < 2; pass++) {
      for (let y = 0; y < h; y++) {
        let acc = 0, cnt = 0;
        for (let x = -rad; x < w; x++) {
          const add = x + rad, rem = x - rad - 1;
          if (add < w) { acc += Math.max(0, a[y * w + add]); cnt++; }
          if (rem >= 0) { acc -= Math.max(0, a[y * w + rem]); cnt--; }
          if (x >= 0) tmp[y * w + x] = acc / cnt;
        }
      }
      const out = new Float32Array(n);
      for (let x = 0; x < w; x++) {
        let acc = 0, cnt = 0;
        for (let y = -rad; y < h; y++) {
          const add = y + rad, rem = y - rad - 1;
          if (add < h) { acc += tmp[add * w + x]; cnt++; }
          if (rem >= 0) { acc -= tmp[rem * w + x]; cnt--; }
          if (y >= 0) out[y * w + x] = acc / cnt;
        }
      }
      // исключения остаются жёсткими
      for (let i = 0; i < n; i++) if (mask[i] < 0) out[i] = -1;
      a = out;
    }
    // в альфу: 0…255; исключения — 0
    for (let i = 0, j = 3; i < n; i++, j += 4) data[j] = a[i] < 0 ? 0 : Math.min(255, Math.round(a[i] * 330));
    return data;
  }
  function smooth(e0, e1, x) { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); }

  // JS-вариант мерцания для отсвета (та же формула, что в шейдере)
  function vnoise(x) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return h1(i) * (1 - u) + h1(i + 1) * u; }
  function h1(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
  function flickAt(t) { return 1 + 0.08 * Math.sin(t * 7.3) + 0.05 * (vnoise(t * 2.1) * 2 - 1) + 0.05 * (vnoise(t * 5.3 + 9) * 2 - 1); }

  function parsePos(img) {
    const v = getComputedStyle(img).objectPosition.split(' ');
    const p = (s, d) => (s && s.endsWith('%') ? parseFloat(s) / 100 : d);
    return [p(v[0], 0.5), p(v[1] || v[0], 0.5)];
  }

  /* ---------- экземпляр камина ---------- */
  class Fire {
    constructor(opts) {
      this.stage = opts.stage;           // контейнер, внутри которого фото с object-fit: cover
      this.img = opts.img;
      this.scr = SCREENS[opts.screen];
      this.glows = opts.glows || {};     // { wall: el, floor: el }
      this.spots = opts.spots || [];     // светильники для входа
      this.amp = opts.amp || 1;
      this.glowRange = opts.glowRange || [0.22, 0.42];
      this.active = true;                // для сцен: горит только в своей сцене
      this.visible = false;
      this.raf = 0;
      this.t0 = performance.now() - Math.random() * 4000;
      this.ready = false;
      const go = () => this._init();
      if (this.img.complete && this.img.naturalWidth) go();
      else this.img.addEventListener('load', go, { once: true });
    }

    _init() {
      if (this.ready || this.loading) return;
      this.loading = true;
      // у <img> со srcset naturalWidth поправлен на плотность (1280w при 100vw = 1024 px),
      // поэтому берём тот же файл отдельной картинкой — с настоящими пикселями
      const probe = new Image();
      probe.src = this.img.currentSrc || this.img.src;
      const go = () => this._build(probe);
      if (probe.decode) probe.decode().then(go, () => (probe.complete ? go() : probe.addEventListener('load', go, { once: true })));
      else probe.addEventListener('load', go, { once: true });
    }

    _build(img) {
      if (this.ready) return;
      const s = this.scr;
      // ограничивающий прямоугольник экрана в координатах исходника (+2 px запаса)
      const xs = s.quad.map((q) => q[0]), ys = s.quad.map((q) => q[1]);
      this.bx = Math.floor(Math.min(...xs)) - 2; this.by = Math.floor(Math.min(...ys)) - 2;
      this.bw = Math.ceil(Math.max(...xs)) + 2 - this.bx; this.bh = Math.ceil(Math.max(...ys)) + 2 - this.by;
      const k = img.naturalWidth / s.w; // загруженная версия может быть меньше исходника
      const tw = Math.max(8, Math.round(this.bw * k)), th = Math.max(8, Math.round(this.bh * k));
      const c2 = document.createElement('canvas'); c2.width = tw; c2.height = th;
      const x2 = c2.getContext('2d', { willReadFrequently: true });
      x2.drawImage(img, this.bx * k, this.by * k, this.bw * k, this.bh * k, 0, 0, tw, th);
      let id;
      try { id = x2.getImageData(0, 0, tw, th); } catch (e) { return; } // file:// без сервера — без анимации
      const colorData = new Uint8ClampedArray(id.data);
      buildMask(id.data, tw, th, s.exclude, k, this.bx, this.by);
      this.tex = { w: tw, h: th, data: id.data, color: colorData };

      if (!this._initGL()) this._initFallback();
      this.ready = true;
      this.layout();
      this._observe();
      PRIV.fireReadyCount = (PRIV.fireReadyCount || 0) + 1;
    }

    _initGL() {
      const cv = document.createElement('canvas');
      cv.className = 'fire-canvas';
      cv.setAttribute('aria-hidden', 'true');
      const gl = cv.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: false, powerPreference: 'low-power' });
      if (!gl) return false;
      const sh = (type, src) => {
        const o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o);
        if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(o)); return null; }
        return o;
      };
      const vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG);
      if (!vs || !fs) return false;
      const pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return false;
      gl.useProgram(pr);
      const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(pr, 'aPos'); gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      // массив, а не canvas: так альфа-маска не «съедает» цвет при премультипликации
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.tex.w, this.tex.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(this.tex.data.buffer));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.gl = gl; this.uTime = gl.getUniformLocation(pr, 'uTime');
      gl.uniform1f(gl.getUniformLocation(pr, 'uAmp'), this.amp);
      cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.stop(); });
      this.el = cv;
      this.stage.appendChild(cv);
      return true;
    }

    _initFallback() {
      // нижний слой — экран как есть, верхний — только пламя (альфа-маска) с SVG-искажением
      const wrap = document.createElement('div');
      wrap.className = 'fire-fallback'; wrap.setAttribute('aria-hidden', 'true');
      const mk = (cls, data) => {
        const c = document.createElement('canvas'); c.width = this.tex.w; c.height = this.tex.h; c.className = cls;
        c.getContext('2d').putImageData(new ImageData(data, this.tex.w, this.tex.h), 0, 0);
        wrap.appendChild(c); return c;
      };
      mk('ff-base', this.tex.color);
      mk('ff-top', this.tex.data);
      this.turb = document.getElementById('fire-turb');
      this.el = wrap; this.fallback = true;
      this.stage.appendChild(wrap);
    }

    // пересчёт геометрии под object-fit: cover
    layout() {
      if (!this.ready) return;
      const s = this.scr;
      const W = this.stage.clientWidth, H = this.stage.clientHeight;
      if (!W || !H) return;
      const sc = Math.max(W / s.w, H / s.h);
      const [px, py] = parsePos(this.img);
      const ox = (W - s.w * sc) * px, oy = (H - s.h * sc) * py;
      this.map = { sc, ox, oy, W, H };
      if (this.onLayout) this.onLayout(this.map);
      const L = ox + this.bx * sc, T = oy + this.by * sc, CW = this.bw * sc, CH = this.bh * sc;
      const st = this.el.style;
      st.left = L + 'px'; st.top = T + 'px'; st.width = CW + 'px'; st.height = CH + 'px';
      const poly = s.quad.map(([x, y]) => `${(((x - this.bx) / this.bw) * 100).toFixed(3)}% ${(((y - this.by) / this.bh) * 100).toFixed(3)}%`).join(',');
      st.clipPath = `polygon(${poly})`;
      if (this.gl) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const cw = Math.round(Math.min(CW * dpr, this.tex.w * 2.2)), ch = Math.round(Math.min(CH * dpr, this.tex.h * 2.2));
        if (this.el.width !== cw || this.el.height !== ch) { this.el.width = cw; this.el.height = ch; this.gl.viewport(0, 0, cw, ch); }
        this.draw(performance.now());
      }
      const place = (el, g) => {
        if (!el || !g) return;
        el.style.left = ox + (g[0] - g[2] / 2) * sc + 'px'; el.style.top = oy + (g[1] - g[3] / 2) * sc + 'px';
        el.style.width = g[2] * sc + 'px'; el.style.height = g[3] * sc + 'px';
      };
      place(this.glows.wall, s.glows && s.glows.wall);
      place(this.glows.floor, s.glows && s.glows.floor);
      (s.spots || []).forEach((p, i) => {
        const el = this.spots[i]; if (!el) return;
        el.style.left = ox + p[0] * sc + 'px'; el.style.top = oy + p[1] * sc + 'px';
      });
    }

    draw(now) {
      const t = (now - this.t0) / 1000;
      if (this.gl) {
        this.gl.uniform1f(this.uTime, t);
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
      } else if (this.turb) {
        const fx = 0.012 + Math.sin(t * 0.9) * 0.002, fy = 0.05 + Math.sin(t * 1.7) * 0.012;
        this.turb.setAttribute('baseFrequency', fx.toFixed(4) + ' ' + fy.toFixed(4));
        this.turb.setAttribute('seed', String(Math.floor(t * 9) % 50));
      }
      // отсвет синхронно с яркостью пламени
      const f = flickAt(t);
      const [a, b] = this.glowRange;
      const o = a + (b - a) * Math.min(1, Math.max(0, (f - 0.9) / 0.2));
      if (this.glows.wall) this.glows.wall.style.opacity = o.toFixed(3);
      if (this.glows.floor) this.glows.floor.style.opacity = (o * 1.08).toFixed(3);
    }

    _loop() {
      const tick = (now) => {
        this.raf = 0;
        if (!this._running()) return;
        this.draw(now);
        this.raf = requestAnimationFrame(tick);
      };
      if (!this.raf && this._running()) this.raf = requestAnimationFrame(tick);
    }
    _running() { return this.ready && this.visible && this.active && !document.hidden; }
    stop() { if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; }
    setActive(v) { this.active = v; if (v) this._loop(); else this.stop(); }
    // точка исходного кадра → координаты внутри сцены (для пылинок у окна и т. п.)
    toStage(nx, ny) { const m = this.map; return m ? [m.ox + nx * m.sc, m.oy + ny * m.sc] : null; }

    // пауза вне экрана и при скрытой вкладке
    _observe() {
      new IntersectionObserver((ents) => {
        this.visible = ents[0].isIntersecting;
        if (this.visible) this._loop(); else this.stop();
      }, { rootMargin: '120px 0px' }).observe(this.stage);
      document.addEventListener('visibilitychange', () => (document.hidden ? this.stop() : this._loop()));
      new ResizeObserver(() => this.layout()).observe(this.stage);
    }
  }

  PRIV.Fire = Fire;
  PRIV.SCREENS = SCREENS;
})();
