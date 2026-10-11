// Los gráficos de la app salen de icons/icono.svg: los iconos PNG del
// manifest, el apple-touch y la tarjeta para redes (og.jpg).
//
// Uso:  node design/iconos.mjs
//   (Playwright como en eval/: PLAYWRIGHT_CORE=<ruta a index.mjs> y CANAL=chrome)
//
// - icon-192.png / icon-512.png  («any»): la baldosa con las esquinas redondas
//   y transparentes, para la pestaña del navegador y el aviso de instalar.
// - icon-512-maskable.png: el cuadrado entero; el sistema le pone su máscara.
// - icon-180.png (apple-touch): el cuadrado entero; iOS redondea solo.
// - og.jpg (1200×630): la tarjeta que sale al compartir el enlace.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarPlaywright } from '../eval/navegador.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SVG = fs.readFileSync(path.join(RAIZ, 'icons/icono.svg'), 'utf8').replace(/<!--[\s\S]*?-->/g, '').trim();
const FUENTES = '<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;700&family=Geist+Mono:wght@600&display=swap" rel="stylesheet">';

/* La baldosa redonda: el mismo radio que usan los iconos de la app (22 %). */
const baldosa = (lado, redonda) => `<!doctype html><meta charset="utf-8"><style>
html,body{margin:0;background:transparent}
.t{width:${lado}px;height:${lado}px;overflow:hidden;border-radius:${redonda ? '22%' : '0'}}
.t svg{width:100%;height:100%;display:block}</style><div class="t">${SVG}</div>`;

/* La tarjeta para redes: aurora de fondo, el icono y lo que hace la app. */
const og = (w, h) => `<!doctype html><meta charset="utf-8">${FUENTES}<style>
html,body{margin:0}
body{width:${w}px;height:${h}px;background:#0A0B0D;position:relative;overflow:hidden;font-family:Geist,system-ui,sans-serif;color:#F2F3F5}
.orbe{position:absolute;border-radius:50%;filter:blur(90px);opacity:.75}
.r{width:520px;height:520px;background:#E5333A;left:-160px;top:-180px}
.n{width:460px;height:460px;background:#FF8A3D;right:-120px;top:-120px;opacity:.55}
.a{width:560px;height:560px;background:#3B82F6;left:30%;bottom:-360px;opacity:.6}
.c{position:absolute;inset:0;display:flex;align-items:center;gap:64px;padding:0 96px}
.ico{width:260px;height:260px;border-radius:22%;overflow:hidden;flex:none;box-shadow:0 30px 80px rgba(0,0,0,.45),0 0 0 1px rgba(255,255,255,.18)}
.ico svg{width:100%;height:100%;display:block}
.chip{display:inline-flex;align-items:center;gap:10px;font-family:'Geist Mono',monospace;font-weight:600;font-size:19px;letter-spacing:.08em;padding:9px 18px;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18)}
.chip i{width:10px;height:10px;border-radius:50%;background:#E5333A;display:block}
h1{margin:18px 0 14px;font-size:76px;line-height:1;font-weight:700;letter-spacing:-.025em}
p{margin:0;font-size:27px;line-height:1.4;color:#C9CDD4;max-width:640px}
p b{color:#fff}
small{display:block;margin-top:26px;font-size:18px;color:#9AA0A9}</style>
<div class="orbe r"></div><div class="orbe n"></div><div class="orbe a"></div>
<div class="c"><div class="ico">${SVG}</div><div>
<span class="chip"><i></i>PÁGINA Y LÁMINA EXACTA</span>
<h1>Asistente de Piso</h1>
<p>Pregúntale al manual de montaje <b>como hablas en piso</b>. Te contesta con la página y la lámina. Y revisa tu montaje con una foto.</p>
<small>Funciona sin señal · nada se sube · si no está, te lo dice</small>
</div></div>`;

const pw = await cargarPlaywright();
if (!pw) { console.error('Falta Playwright: PLAYWRIGHT_CORE=<ruta a index.mjs>'); process.exit(1); }
const b = await pw.chromium.launch({ channel: process.env.CANAL || undefined });
const captura = async (html, w, h, salida, opciones = {}) => {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await p.setContent(html, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: path.join(RAIZ, salida), clip: { x: 0, y: 0, width: w, height: h }, ...opciones });
  await p.close();
  console.log('·', salida);
};
await captura(baldosa(192, true), 192, 192, 'icons/icon-192.png', { omitBackground: true });
await captura(baldosa(512, true), 512, 512, 'icons/icon-512.png', { omitBackground: true });
await captura(baldosa(512, false), 512, 512, 'icons/icon-512-maskable.png');
await captura(baldosa(180, false), 180, 180, 'icons/icon-180.png');
await captura(og(1200, 630), 1200, 630, 'icons/og.jpg', { type: 'jpeg', quality: 88 });
await b.close();
