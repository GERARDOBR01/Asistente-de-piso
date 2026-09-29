// Banco de medición: la misma medición de la app («🧪 Medir con un examen»),
// corrida sin teléfono, en un Chromium sin ventana. Carga los manuales de una
// carpeta, contesta el examen con los motores pedidos, califica con la regla de
// la app y guarda un resultado con la versión del código, para compararlo con
// otra corrida (eval/comparar.mjs).
//
// Uso:
//   node eval/banco.mjs --manuales ~/manuales --examen ~/examen.json --motores manual
//   GEMINI_API_KEY=… node eval/banco.mjs --manuales ~/manuales --examen ~/examen.json \
//       --motores clasico,agente --modelo gemini-3.5-flash --etiqueta base
//
// Opciones:
//   --manuales <dir>     carpeta con los PDF. FUERA del repo: los manuales reales
//                        no se suben (el .gitignore ya ignora *.pdf).
//   --examen <json>      el mismo formato del examen de la app (ver README).
//   --motores <lista>    clasico, agente, manual (el manual no usa key).
//   --libre              «como el asesor»: sin elegir sección.
//   --proveedor <p>      gemini (por defecto) u openai.
//   --modelo <m>         por defecto gemini-3.5-flash / gpt-4o-mini.
//   --etiqueta <e>       nombre de la corrida, para compararla después.
//   --salida <dir>       por defecto eval/resultados (fuera de git).
//   --continuar <json>   un resultado anterior del banco o de la app: lo que ya
//                        está bien medido no se vuelve a preguntar (la cuota del
//                        día del plan gratis corta a media tanda).
//
// La key se lee de GEMINI_API_KEY u OPENAI_API_KEY. No se imprime ni se escribe:
// el archivo de resultados es el de la app, que no la incluye.
// Playwright: el de `npm i --no-save playwright-core`, o PLAYWRIGHT_CORE=<ruta>;
// CHROMIUM=<binario> o CANAL=chrome si no está el Chromium de Playwright.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const bandera = n => process.argv.includes('--' + n);
const MANUALES = arg('manuales');
const EXAMEN = arg('examen');
const MOTORES = (arg('motores', 'manual')).split(',').map(s => s.trim()).filter(Boolean);
const LIBRE = bandera('libre');
const PROVEEDOR = arg('proveedor', 'gemini');
const MODELO = arg('modelo', PROVEEDOR === 'openai' ? 'gpt-4o-mini' : 'gemini-3.5-flash');
const ETIQUETA = arg('etiqueta', 'banco');
const SALIDA = arg('salida', path.join(RAIZ, 'eval/resultados'));
const CONTINUAR = arg('continuar');

if (!MANUALES || !EXAMEN) { console.error('Faltan --manuales <carpeta> y --examen <json>.'); process.exit(2); }
if (MOTORES.some(m => !['clasico', 'agente', 'manual'].includes(m))) { console.error('Motores: clasico, agente, manual.'); process.exit(2); }
const KEY = PROVEEDOR === 'openai' ? process.env.OPENAI_API_KEY : process.env.GEMINI_API_KEY;
if (MOTORES.some(m => m !== 'manual') && !KEY) {
  console.error(`Para medir con modelo hace falta ${PROVEEDOR === 'openai' ? 'OPENAI_API_KEY' : 'GEMINI_API_KEY'}. El modo manual se mide sin key.`);
  process.exit(2);
}
if (path.resolve(MANUALES).startsWith(RAIZ + path.sep)) {
  console.error('Los manuales tienen que estar FUERA del repositorio.'); process.exit(2);
}
const pdfs = fs.readdirSync(MANUALES).filter(f => /\.pdf$/i.test(f)).map(f => path.join(MANUALES, f));
if (!pdfs.length) { console.error('No hay PDF en ' + MANUALES); process.exit(2); }
const examen = JSON.parse(fs.readFileSync(EXAMEN, 'utf8'));
const previo = CONTINUAR ? JSON.parse(fs.readFileSync(CONTINUAR, 'utf8')) : null;

const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.pdf': 'application/pdf', '.png': 'image/png', '.svg': 'image/svg+xml' };
const srv = http.createServer((req, res) => {
  const ruta = path.join(RAIZ, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!ruta.startsWith(RAIZ) || !fs.existsSync(ruta) || fs.statSync(ruta).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(ruta)] || 'application/octet-stream' });
  fs.createReadStream(ruta).pipe(res);
});
await new Promise(ok => srv.listen(0, '127.0.0.1', ok));
const intentar = async n => { try { return await import(n); } catch { return null; } };
const pw = process.env.PLAYWRIGHT_CORE ? await import(pathToFileURL(process.env.PLAYWRIGHT_CORE).href)
  : (await intentar('playwright-core')) || (await intentar('playwright'));
if (!pw) { console.error('Falta Playwright: npm i --no-save playwright-core'); srv.close(); process.exit(2); }

const b = await pw.chromium.launch({ executablePath: process.env.CHROMIUM || undefined, channel: process.env.CANAL || undefined });
let codigo = 0;
try {
  const p = await b.newPage();
  p.on('dialog', d => d.accept());
  p.on('pageerror', e => console.error('error de la página:', e.message));
  await p.goto(`http://127.0.0.1:${srv.address().port}/index.html`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.pdfjsLib, null, { timeout: 60000 });

  for (const f of pdfs) {
    const t0 = Date.now();
    const antes = await p.evaluate(() => docs.length);
    /* Como contenido y no como ruta: por ruta, un nombre con acento
       («EXHIBICIÓN») no llegaba al input y la carga se quedaba esperando. */
    await p.setInputFiles('#file-input', { name: path.basename(f).normalize('NFC'), mimeType: 'application/pdf', buffer: fs.readFileSync(f) });
    /* Por el número de manuales y no por el nombre: el sistema de archivos puede
       entregar «EXHIBICIÓN» con la tilde descompuesta y el nombre no coincide.
       Si la app lo rechaza (mismo contenido que otro), se sigue con el próximo. */
    let quieto = 0;
    for (;;) {
      await new Promise(ok => setTimeout(ok, 1000));
      const [n, proc] = await p.evaluate(() => [docs.length, document.getElementById('proc-wrap').style.display]);
      if (n > antes && proc === 'none') break;
      quieto = proc === 'none' ? quieto + 1 : 0;
      if (quieto >= 10) { console.log(`· ${path.basename(f)}: la app no lo agregó (¿repetido?)`); break; }
      if (Date.now() - t0 > 300000) throw new Error('El PDF tardó más de 5 minutos: ' + path.basename(f));
    }
    console.log(`· ${path.basename(f)} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
  if (KEY) await p.evaluate(({ prov, key, modelo }) => {
    sessionStorage.setItem('ap_api_key_' + prov, key);
    appState.provider = prov; appState.apiKey = key; appState.chatModel = modelo;
  }, { prov: PROVEEDOR, key: KEY, modelo: MODELO });

  await p.evaluate(({ examen, motores, libre, previo }) => {
    const preguntas = validarExamen(examen);
    const filas = previo && Array.isArray(previo.resultados) ? previo.resultados.filter(f => !f.error) : [];
    medicionActual = { nombre: examen.examen || 'banco', clave: 'ap_medicion_banco', preguntas, filas, motores, libre, estado: 'listo' };
    mostrarPanelMedicion();
  }, { examen, motores: MOTORES, libre: LIBRE, previo });

  const reloj = setInterval(async () => {
    try { console.log('  ' + await p.evaluate(() => medicionActual.estado)); } catch {}
  }, 30000);
  await p.evaluate(() => correrMedicion());
  clearInterval(reloj);

  const res = await p.evaluate(() => resultadoMedicion());
  res.etiqueta = ETIQUETA;
  fs.mkdirSync(SALIDA, { recursive: true });
  const archivo = path.join(SALIDA, `${ETIQUETA}__${res.version}__${res.fecha.slice(0, 16).replace(/[:T]/g, '-')}.json`);
  fs.writeFileSync(archivo, JSON.stringify(res, null, 1));
  for (const [grupo, r] of Object.entries(res.resumen)) {
    console.log(`${grupo}: datos ${r.aciertos} · no está ${r.noEstaBienDicho} · otra sección ${r.otraSeccion}`
      + (r.seccionElegidaBien ? ` · sección ${r.seccionElegidaBien}` : '') + ` · errores ${r.errores}`);
    if (r.fallasPorCapa && Object.keys(r.fallasPorCapa).length)
      console.log('   fallas: ' + Object.entries(r.fallasPorCapa).map(([c, n]) => `${c} ${n}`).join(' · '));
  }
  const total = res.resultados.length, esperadas = validarTotal(examen) * MOTORES.length;
  if (total < esperadas) console.log(`Quedaron ${esperadas - total} por medir (¿cuota del día?). Sigue con --continuar ${archivo}`);
  console.log('→ ' + archivo);
} catch (e) {
  console.error(e); codigo = 1;
} finally {
  await b.close(); srv.close();
}
process.exit(codigo);

function validarTotal(ex) { return (Array.isArray(ex) ? ex : ex.preguntas || []).filter(x => x && x.q && x.tipo).length; }
