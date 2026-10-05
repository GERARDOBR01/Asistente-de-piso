// El motor de la app, en Node y sin navegador.
//
// lab/volcar.mjs le pregunta a la app de verdad: abre Chromium, carga los PDF
// y corre cada pregunta dentro de la página. Es la referencia, pero tarda, y
// para barrer una idea de la puerta de evidencia sobre cientos de preguntas
// hace falta algo más rápido. Este script importa los mismos módulos que la
// app (src/motor/), carga el corpus ya extraído (el `corpus.json` que deja
// `volcar.mjs --corpus`) y contesta cada pregunta con el mismo código: misma
// sección, mismo ranking, mismo contexto, mismas tarjetas y el mismo contrato
// de decisión.
//
// Que de lo mismo no se supone: se comprueba. `--paridad <dir> --contra X`
// compara el volcado de Node con el del navegador (lab/identico.mjs), y el CI
// lo hace con el corpus público en cada PR.
//
// Uso:
//   node lab/motor-node.mjs --corpus <dir> --preguntas <json>[,<json>…] --salida <dir> [--etiqueta node]
//
// Igual que volcar.mjs: la salida lleva texto de los manuales y va SIEMPRE
// fuera del repo, salvo la del corpus público.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { estado, montar } from '../src/estado.js';
import { reconstruirIndice } from '../src/motor/indice.js';
import { retrieve } from '../src/motor/busqueda.js';
import { filtroSolidez, nivelDeEvidencia } from '../src/motor/solidez.js';
import { nombreDeSeccion } from '../src/motor/secciones.js';
import { esOperacionDeTienda } from '../src/motor/puerta.js';
import { SEGUIMIENTO, consultaAmpliada, rutaDeLaPregunta, seccionDeLaPregunta } from '../src/motor/conversacion.js';
import { relevantesSinModelo, respuestaSinModelo, contextoParaModelo, PDF_BUDGET_GEMINI } from '../src/motor/respuesta.js';

/**
 * Carga en el motor el corpus de `volcar.mjs --corpus` (su campo `motor`).
 * Devuelve con qué volver al estado de antes.
 */
export function cargarCorpus(corpus) {
  if (!corpus.motor) throw new Error('El corpus no trae el campo «motor»: vuelve a sacarlo con volcar.mjs --corpus');
  const { manualSections, docChunks, docs } = structuredClone(corpus.motor);
  return montar({ manualSections, docChunks, docs, docFigures: [], manualActivo: null, ultimosFragmentos: [] }, reconstruirIndice);
}

/* La ruta de cada pregunta se calcula una vez por turno, como en la app
   (`rutaDe` guarda la del turno en curso). */
function rutasDe(hist) {
  const vistas = new Map();
  return q => {
    const k = q + '\u0001' + hist.length;
    if (!vistas.has(k)) vistas.set(k, rutaDeLaPregunta(q, hist, null));
    return vistas.get(k);
  };
}

/* Un turno del modo manual, y lo que deja en el historial: la app guarda la
   sección con que respondió, y de ahí sigue el «¿y en…?» siguiente. */
function turnoSinModelo(q, hist) {
  const r = respuestaSinModelo(q, hist, rutasDe(hist));
  hist.push({ role: 'user', content: q });
  hist.push(r.tipo === 'tarjetas' || r.tipo === 'nada'
    ? { role: 'assistant', content: r.fragmentos || '', modo: 'manual', seccion: r.seccionDelTurno }
    : { role: 'assistant', content: '' });
  return r;
}

const fila = c => ({ id: c.id, d: c.docName, p: c.page, h: c.heading || '', t: c.text || '' });

/**
 * Lo mismo que `PREGUNTAR_JS` de volcar.mjs, pregunta por pregunta, con los
 * mismos campos. `x`: {i, q, m?, en?, turnos?}.
 */
export function preguntar(x, tope = 200) {
  let doc = null;
  if (x.en) doc = estado.docs.find(d => nombreDeSeccion(d.name) === x.en);
  else if (x.m) doc = estado.docs.find(d => d.name.normalize('NFC').startsWith(x.m.normalize('NFC')));
  if ((x.en || x.m) && !doc) return { i: x.i, falta: true };
  estado.manualActivo = doc ? doc.name : null;
  const hist = [];
  for (const t of x.turnos || []) turnoSinModelo(t, hist);
  const q = x.q;
  const rutaDe = rutasDe(hist);
  const operacion = esOperacionDeTienda(q);
  const sec = seccionDeLaPregunta(q, rutaDe);
  const consulta = consultaAmpliada(q, hist);
  const usar = consulta !== q && !SEGUIMIENTO.test(q) ? q : consulta;
  const res = sec.otraSeccion ? [] : retrieve(usar, { limit: tope, doc: sec.doc, source: 'pdf' });
  const solido = filtroSolidez(usar);
  const ranking = res.map(r => [r.c.id, +r.score.toFixed(4), r.hits, r.hitsSyn || 0, r.hitsErrata || 0, solido(r) ? 1 : 0]);
  const nivel = res.length ? nivelDeEvidencia(res, usar) : 0;
  const secRel = estado.docChunks.length ? sec : { doc: null, otraSeccion: null };
  const rel = relevantesSinModelo(q, secRel, hist).map(r => r.c.id);
  const b = contextoParaModelo(q, { hist, rutaDe, presupuesto: PDF_BUDGET_GEMINI });
  const ctx = estado.ultimosFragmentos.map(c => c.id);
  const ctxInfo = { nivel: b.nivel, ausentes: (b.ausentes || []).length, sinCoincidencias: !!b.sinCoincidencias };
  const r = respuestaSinModelo(q, hist, rutaDe);
  const conTarjetas = r.tipo === 'tarjetas';
  const out = {
    i: x.i, activa: doc ? doc.name : '', secDoc: sec.doc || '', otraSeccion: sec.otraSeccion || '',
    operacion, consulta: usar, nivel, ranking, rel, ctx, ctxInfo,
    tarjetas: (r.tarjetas || []).map(t => ({ ...fila(t.c), t: t.texto || '' })),
    sinDato: r.tipo === 'nada',
    ausente: conTarjetas ? r.avisoAusente : '',
    parecidas: conTarjetas && !r.avisoAusente ? r.avisoParecidas : '',
    decision: b.decision || null, decisionManual: r.decision,
  };
  estado.manualActivo = null;
  return out;
}

/* ── Principal ────────────────────────────────────────────────────────────── */
const principal = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (principal) {
  const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
  const CORPUS = arg('corpus', null), PREGUNTAS = arg('preguntas', null), SALIDA = arg('salida', null);
  const ETIQUETA = arg('etiqueta', 'node'), TOPE = Number(arg('tope', 200));
  if (!CORPUS || !PREGUNTAS || !SALIDA) {
    console.error('Uso: node lab/motor-node.mjs --corpus <dir> --preguntas <json>[,<json>…] --salida <dir> [--etiqueta node]');
    process.exit(2);
  }
  const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
  const dentro = (d, base) => path.resolve(d).toLowerCase().startsWith(path.resolve(base).toLowerCase() + path.sep);
  if (dentro(SALIDA, raiz) && !dentro(SALIDA, path.join(raiz, 'eval', 'corpus-publico'))) {
    console.error('La salida lleva texto de los manuales y no puede ir dentro del repo: ' + SALIDA);
    process.exit(1);
  }
  const corpus = JSON.parse(fs.readFileSync(path.join(CORPUS, 'corpus.json'), 'utf8'));
  const t0 = Date.now();
  cargarCorpus(corpus);
  console.log(`corpus: ${estado.docs.length} manuales, ${estado.docChunks.length} fragmentos (${Date.now() - t0} ms)`);
  for (const archivo of PREGUNTAS.split(',').filter(Boolean)) {
    const crudas = JSON.parse(fs.readFileSync(archivo, 'utf8'));
    const items = crudas.map((x, i) => ({ i, ...x, tipo: x.tipo || (x.en ? 'no-esta' : 'dato') }));
    const t1 = Date.now();
    const filas = items.map(x => ({ ...x, ...preguntar(x, TOPE) }));
    fs.mkdirSync(SALIDA, { recursive: true });
    const destino = path.join(SALIDA, `${ETIQUETA}__${path.basename(archivo, '.json')}.jsonl`);
    const version = `node (corpus ${corpus.version})`;
    fs.writeFileSync(destino, filas.map(f => JSON.stringify({ ...f, version, fecha: new Date().toISOString() })).join('\n') + '\n');
    console.log(`${destino} (${Date.now() - t1} ms, ${filas.filter(f => f.falta).length} sin manual)`);
  }
}
