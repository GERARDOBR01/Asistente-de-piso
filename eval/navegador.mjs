// La app real en un Chromium sin ventana, con manuales cargados: lo comparten
// eval/banco.mjs y lab/volcar.mjs --local.
//
// Playwright: el de `npm i --no-save playwright-core`, o PLAYWRIGHT_CORE=<ruta a
// index.mjs>; CANAL=chrome usa el Chrome instalado y CHROMIUM=<binario> cualquier
// otro.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.pdf': 'application/pdf', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.css': 'text/css', '.woff2': 'font/woff2',
};

/* Servidor propio y no file://: el service worker y la lectura de PDF
   necesitan http. */
export async function servirRepo() {
  const srv = http.createServer((req, res) => {
    const ruta = path.join(RAIZ, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!ruta.startsWith(RAIZ) || !fs.existsSync(ruta) || fs.statSync(ruta).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(ruta)] || 'application/octet-stream' });
    fs.createReadStream(ruta).pipe(res);
  });
  await new Promise(ok => srv.listen(0, '127.0.0.1', ok));
  return srv;
}

export async function cargarPlaywright() {
  const intentar = async n => { try { return await import(n); } catch { return null; } };
  return process.env.PLAYWRIGHT_CORE
    ? await import(pathToFileURL(process.env.PLAYWRIGHT_CORE).href)
    : (await intentar('playwright-core')) || (await intentar('playwright'));
}

/* Sube un PDF y espera a que la app termine de procesarlo. Como contenido y
   no como ruta: por ruta, un nombre con acento («EXHIBICIÓN») no llegaba al
   input. Se espera por el número de manuales y no por el nombre (el sistema
   de archivos puede entregar la tilde descompuesta); si la app no lo agrega
   (mismo contenido que otro), se sigue con el próximo. */
export async function subirManual(p, nombre, buffer) {
  const t0 = Date.now();
  const antes = await p.evaluate(() => docs.length);
  await p.setInputFiles('#file-input', { name: nombre.normalize('NFC'), mimeType: 'application/pdf', buffer });
  let quieto = 0;
  for (;;) {
    await new Promise(ok => setTimeout(ok, 500));
    const [n, proc] = await p.evaluate(() => [docs.length, document.getElementById('proc-wrap').style.display]);
    if (n > antes && proc === 'none') return { ok: true, s: (Date.now() - t0) / 1000 };
    quieto = proc === 'none' ? quieto + 1 : 0;
    if (quieto >= 20) return { ok: false, s: (Date.now() - t0) / 1000 };
    if (Date.now() - t0 > 300000) throw new Error('El PDF tardó más de 5 minutos: ' + nombre);
  }
}

/* Abre la app y carga los manuales `[{nombre, buffer}]`. Devuelve la página y
   cómo cerrarlo todo. */
export async function abrirApp(manuales = [], { log = console.log } = {}) {
  const pw = await cargarPlaywright();
  if (!pw) throw new Error('Falta Playwright: npm i --no-save playwright-core, o PLAYWRIGHT_CORE=<ruta a index.mjs>');
  const srv = await servirRepo();
  const b = await pw.chromium.launch({ executablePath: process.env.CHROMIUM || undefined, channel: process.env.CANAL || undefined });
  const cerrar = async () => { await b.close(); srv.close(); };
  try {
    const p = await b.newPage();
    p.on('dialog', d => d.accept());
    p.on('pageerror', e => console.error('error de la página:', e.message));
    await p.goto(`http://127.0.0.1:${srv.address().port}/index.html`, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => window.pdfjsLib, null, { timeout: 60000 });
    for (const m of manuales) {
      const r = await subirManual(p, m.nombre, m.buffer);
      log(r.ok ? `· ${m.nombre} (${r.s.toFixed(0)} s)` : `· ${m.nombre}: la app no lo agregó (¿repetido?)`);
    }
    return { p, cerrar };
  } catch (e) { await cerrar(); throw e; }
}
