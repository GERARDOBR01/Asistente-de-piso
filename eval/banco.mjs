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
//   --aprendido <json>   un «⬇ Vocabulario del piso» exportado de la app: se
//                        carga y se mide «con lo aprendido», para compararlo
//                        con la misma corrida sin él.
//   --continuar <json>   un resultado anterior del banco o de la app: lo que ya
//                        está bien medido no se vuelve a preguntar (la cuota del
//                        día del plan gratis corta a media tanda).
//
// La key se lee de GEMINI_API_KEY u OPENAI_API_KEY. No se imprime ni se escribe:
// el archivo de resultados es el de la app, que no la incluye.
// Playwright: el de `npm i --no-save playwright-core`, o PLAYWRIGHT_CORE=<ruta>;
// CHROMIUM=<binario> o CANAL=chrome si no está el Chromium de Playwright.
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ, abrirApp } from './navegador.mjs';
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
const APRENDIDO = arg('aprendido');

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
const vocab = APRENDIDO ? JSON.parse(fs.readFileSync(APRENDIDO, 'utf8')) : null;
const previo = CONTINUAR ? JSON.parse(fs.readFileSync(CONTINUAR, 'utf8')) : null;

let codigo = 0, app = null;
try {
  app = await abrirApp(pdfs.map(f => ({ nombre: path.basename(f), buffer: fs.readFileSync(f) })));
  const { p } = app;
  if (KEY) await p.evaluate(({ prov, key, modelo }) => {
    sessionStorage.setItem('ap_api_key_' + prov, key);
    appState.provider = prov; appState.apiKey = key; appState.chatModel = modelo;
  }, { prov: PROVEEDOR, key: KEY, modelo: MODELO });

  if (vocab) {
    const n = await p.evaluate(v => importarVocabulario(v), vocab);
    console.log(`· vocabulario del piso: ${n} caminos cargados`);
  }
  await p.evaluate(({ examen, motores, libre, previo, conAprendido }) => {
    const preguntas = validarExamen(examen);
    const filas = previo && Array.isArray(previo.resultados) ? previo.resultados.filter(f => !f.error) : [];
    medicionActual = { nombre: examen.examen || 'banco', clave: 'ap_medicion_banco', preguntas, filas, motores, libre, conAprendido, estado: 'listo' };
    mostrarPanelMedicion();
  }, { examen, motores: MOTORES, libre: LIBRE, previo, conAprendido: !!vocab });

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
  if (app) await app.cerrar();
}
process.exit(codigo);

function validarTotal(ex) { return (Array.isArray(ex) ? ex : ex.preguntas || []).filter(x => x && x.q && x.tipo).length; }
