// Corre el arnés de la app (index.html?test=1) en un navegador sin ventana y
// sale con error si alguna fila queda en rojo. Es lo que corre el CI en cada
// push a main y en cada pull request.
//
// Uso:
//   node eval/arnes.mjs
//
// Usa `playwright-core` (o `playwright`) instalado donde Node lo encuentre, o
// el de PLAYWRIGHT_CORE=<ruta a playwright-core/index.mjs>. Si el Chromium de
// Playwright no está descargado: CANAL=chrome usa el Chrome instalado y
// CHROMIUM=<binario> usa cualquier otro.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.pdf': 'application/pdf', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.css': 'text/css', '.woff2': 'font/woff2',
};

/* Servidor propio y no file://: el service worker y la lectura del manual demo
   necesitan http. Tampoco depende de Python, que no siempre se llama igual. */
const srv = http.createServer((req, res) => {
  const ruta = path.join(RAIZ, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!ruta.startsWith(RAIZ) || !fs.existsSync(ruta) || fs.statSync(ruta).isDirectory()) {
    res.writeHead(404); return res.end();
  }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(ruta)] || 'application/octet-stream' });
  fs.createReadStream(ruta).pipe(res);
});
await new Promise(ok => srv.listen(0, '127.0.0.1', ok));

const intentar = async nombre => { try { return await import(nombre); } catch { return null; } };
const pw = process.env.PLAYWRIGHT_CORE
  ? await import(pathToFileURL(process.env.PLAYWRIGHT_CORE).href)
  : (await intentar('playwright-core')) || (await intentar('playwright'));
if (!pw) {
  console.error('Falta Playwright: npm i --no-save playwright-core, o PLAYWRIGHT_CORE=<ruta a index.mjs>');
  srv.close(); process.exit(2);
}

const b = await pw.chromium.launch({
  executablePath: process.env.CHROMIUM || undefined,
  channel: process.env.CANAL || undefined,
});
/* La versión que viaja en los resultados de medición (index.html) tiene que ser
   la del service worker: si no, dos corridas con código distinto se leerían
   como la misma. */
const vSw = (fs.readFileSync(path.join(RAIZ, 'sw.js'), 'utf8').match(/VERSION='([^']+)'/) || [])[1];
const vApp = (fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8').match(/const VERSION_APP='([^']+)'/) || [])[1];
if (!vSw || vSw !== vApp) {
  console.log(`✗ [versión] sw.js dice ${vSw} e index.html dice ${vApp}`);
  await b.close(); srv.close(); process.exit(1);
}
let malas = [{}];
try {
  const p = await b.newPage();
  const errores = [];
  p.on('pageerror', e => errores.push(e.message));
  await p.goto(`http://127.0.0.1:${srv.address().port}/index.html?test=1`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.__pruebas, null, { timeout: 120000 });
  const { resumen, filas } = await p.evaluate(() => window.__pruebas);
  malas = filas.filter(f => !f.ok);
  for (const f of malas) console.log(`✗ [${f.tipo}] ${f.q} — ${f.detalle}`);
  console.log(Object.entries(resumen).map(([k, v]) => `${k} ${v}`).join(' · '));
  console.log(`${filas.length - malas.length}/${filas.length} en verde`);
  /* Un error de la página no tumba el arnés (puede ser una fuente que no bajó),
     pero se enseña: si algo del arnés falló por eso, aquí se ve por qué. */
  if (errores.length) console.log('Errores de la página:\n  ' + errores.join('\n  '));
} finally {
  await b.close();
  srv.close();
}
process.exit(malas.length ? 1 : 0);
