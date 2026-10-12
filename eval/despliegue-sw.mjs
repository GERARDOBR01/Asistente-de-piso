// ¿Una versión nueva llega entera al teléfono, o la página mezcla versiones?
//
// GitHub Pages sirve todo con Cache-Control: max-age=600. Cuando el service
// worker pedía el código «a la red» con la caché HTTP normal, durante esos diez
// minutos el navegador contestaba con lo que ya tenía: el 11-oct la pestaña de
// medición arrancó con app.js 1.25.1 y verificacion.js de la versión anterior,
// y la caché sin señal de la versión nueva guardaba archivos viejos.
//
// Aquí un servidor hace de GitHub Pages (max-age=600, sw.js sin caché) y marca
// cada .js con el «despliegue» que lo sirvió (A o B): el código deja en
// globalThis.__marcas qué versión corrió. Se abre con A, se publica B y se
// recarga una vez: la página y la caché sin señal tienen que estar en B.
//
// Uso: node eval/despliegue-sw.mjs   (mismo Playwright que eval/arnes.mjs:
// PLAYWRIGHT_CORE, CANAL=chrome o CHROMIUM). Necesita red: al instalarse, el
// service worker baja pdf.js y las fuentes.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.pdf': 'application/pdf', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.pem': 'application/x-pem-file',
};
let despliegue = 'A';
const srv = http.createServer((req, res) => {
  let u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (u.endsWith('/')) u += 'index.html';
  const ruta = path.join(RAIZ, u);
  if (!ruta.startsWith(RAIZ) || !fs.existsSync(ruta) || fs.statSync(ruta).isDirectory()) {
    res.writeHead(404); return res.end();
  }
  let cuerpo = fs.readFileSync(ruta);
  if (path.extname(ruta) === '.js') {
    const nombre = JSON.stringify(path.basename(ruta, '.js'));
    cuerpo = Buffer.concat([cuerpo, Buffer.from(`\n;(globalThis.__marcas=globalThis.__marcas||{})[${nombre}]=${JSON.stringify(despliegue)};\n`)]);
  }
  res.writeHead(200, {
    'Content-Type': TIPOS[path.extname(ruta)] || 'application/octet-stream',
    'Cache-Control': u === '/sw.js' ? 'no-cache' : 'max-age=600',
    'ETag': `"${despliegue}${u}"`,
  });
  res.end(cuerpo);
});
await new Promise(ok => srv.listen(0, '127.0.0.1', ok));
const url = `http://127.0.0.1:${srv.address().port}/`;

const intentar = async nombre => { try { return await import(nombre); } catch { return null; } };
const pw = process.env.PLAYWRIGHT_CORE
  ? await import(pathToFileURL(process.env.PLAYWRIGHT_CORE).href)
  : (await intentar('playwright-core')) || (await intentar('playwright'));
if (!pw) {
  console.error('Falta Playwright: npm i --no-save playwright-core, o PLAYWRIGHT_CORE=<ruta a index.mjs>');
  srv.close(); process.exit(2);
}
const b = await pw.chromium.launch({ executablePath: process.env.CHROMIUM || undefined, channel: process.env.CANAL || undefined });
const p = await (await b.newContext()).newPage();
/* Qué versión corrió cada archivo, y cuál guardó la caché sin señal. */
const leer = () => p.evaluate(async () => {
  const nombre = (await caches.keys()).find(k => k.startsWith('ap-v'));
  const caja = nombre && await caches.open(nombre);
  const guardado = async f => {
    const r = caja && await caja.match(f);
    return ((r ? await r.text() : '').match(/\]="([AB])";\s*$/) || [])[1] || '—';
  };
  const m = globalThis.__marcas || {};
  return { app: m.app, main: m.main, verificacion: m.verificacion,
    cacheApp: await guardado('src/app.js'), cacheVerificacion: await guardado('src/motor/verificacion.js') };
});
let codigo = 1;
try {
  await p.goto(url, { waitUntil: 'load' });
  await p.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 60000 });
  await p.waitForTimeout(1000);
  const a = await leer();
  despliegue = 'B';
  await p.reload({ waitUntil: 'load' });
  await p.waitForTimeout(2500);
  const bb = await leer();
  const todo = o => Object.values(o).every(v => v === 'B');
  console.log(`con A: ${JSON.stringify(a)}`);
  console.log(`tras publicar B y recargar: ${JSON.stringify(bb)}`);
  if (todo(bb)) { console.log('✓ [despliegue] la versión nueva llegó entera: a la página y a la caché sin señal'); codigo = 0; }
  else console.log('✗ [despliegue] versiones mezcladas o viejas tras publicar: el service worker no está revalidando con el servidor');
} catch (e) {
  console.log('✗ [despliegue] ' + e.message);
} finally {
  await b.close(); srv.close();
}
process.exit(codigo);
