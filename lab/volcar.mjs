// Vuelca lo que hace la búsqueda de la app real con cada pregunta, para medir
// fuera del navegador.
//
// La app sigue siendo la que busca: este script le manda una función a una
// pestaña ya abierta (el puente de `eval/modo-ia.mjs --vivo`) y guarda, por
// pregunta, el ranking completo de `retrieve()` con sus aciertos, lo que
// recibiría el modelo (`buildContext`) y las tarjetas del modo manual. Así la
// línea base es el motor de verdad y no una reimplementación, y lo que se
// pruebe después (embeddings, fusión, abstención) se compara contra eso.
//
// Uso:
//   node lab/volcar.mjs --vivo http://127.0.0.1:9701 --preguntas <json> --salida <dir> [--etiqueta base]
//   node lab/volcar.mjs --vivo http://127.0.0.1:9701 --corpus <dir>     (solo los fragmentos)
//   node lab/volcar.mjs --local eval/corpus-publico/manuales.json --corpus <dir> --preguntas <json> --salida <dir>
//
// Con --local no hace falta pestaña abierta ni puente: abre la app en un
// Chromium sin ventana (eval/navegador.mjs) y carga los manuales de la lista
// [{archivo, nombre}] (rutas relativas a la lista). Es lo que usa el CI con el
// corpus público.
//
// Formatos de pregunta que acepta:
//   batería  {q, tipo, m, p, k, minK?, d?, turnos?, cat?}   (m = principio del nombre del manual; "" = todos)
//   cruzadas {q, en}   (en = nombre de sección; son «no está» por construcción)
//
// La salida lleva texto de los manuales: va SIEMPRE fuera del repo, salvo la
// del corpus público (--local con una lista de eval/corpus-publico/).
import fs from 'node:fs';
import path from 'node:path';
import { abrirApp } from '../eval/navegador.mjs';

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const VIVO = arg('vivo', 'http://127.0.0.1:9701');
const LOCAL = arg('local', null);
const PREGUNTAS = arg('preguntas', null);
const SALIDA = arg('salida', null);
const CORPUS = arg('corpus', null);
const ETIQUETA = arg('etiqueta', 'base');
const LOTE = Number(arg('lote', 25));
const TOPE = Number(arg('tope', 200));

const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const dentro = (d, base) => path.resolve(d).toLowerCase().startsWith(path.resolve(base).toLowerCase() + path.sep);
const publico = LOCAL && dentro(LOCAL, path.join(raiz, 'eval', 'corpus-publico'));
for (const d of [SALIDA, CORPUS].filter(Boolean)) {
  if (!publico && dentro(d, raiz)) {
    console.error('La salida lleva texto de los manuales y no puede ir dentro del repo: ' + d);
    process.exit(1);
  }
}

let app = null;
if (LOCAL) {
  const lista = JSON.parse(fs.readFileSync(LOCAL, 'utf8'));
  app = await abrirApp(lista.map(m => ({ nombre: m.nombre, buffer: fs.readFileSync(path.resolve(path.dirname(LOCAL), m.archivo)) })));
}

async function enPagina(cuerpo) {
  if (app) return app.p.evaluate(`(async () => { ${cuerpo} })()`);
  const r = await fetch(VIVO, { method: 'POST', body: cuerpo });
  const t = await r.text();
  if (t.startsWith('ERROR')) throw new Error(t.slice(0, 600));
  return JSON.parse(t);
}

/* ── Lo que corre dentro de la página ─────────────────────────────────────── */
const CORPUS_JS = `
  return { version: VERSION_APP,
    docs: docs.map(d => ({ name: d.name, sec: nombreDeSeccion(d.name), pages: d.pageCount })),
    chunks: docChunks.map(c => ({ id: c.id, d: c.docName, p: c.page, h: c.heading || '', t: c.text || '' })) };`;

/* Por pregunta, en el mismo orden que el modo manual: sección activa, turnos
   previos (para que el seguimiento tenga de dónde ampliarse), y luego la
   última pregunta por las tres vías. Nada de esto llama a una API. */
const PREGUNTAR_JS = (lote, tope) => `
  const LOTE = ${JSON.stringify(lote)}, TOPE = ${tope};
  if (typeof midiendo !== 'undefined') midiendo = true;
  const fila = c => ({ id: c.id, d: c.docName, p: c.page, h: c.heading || '', t: c.text || '' });
  const out = [];
  for (const x of LOTE) {
    let doc = null;
    if (x.en) doc = docs.find(d => nombreDeSeccion(d.name) === x.en);
    else if (x.m) doc = docs.find(d => d.name.normalize('NFC').startsWith(x.m.normalize('NFC')));
    if ((x.en || x.m) && !doc) { out.push({ i: x.i, falta: true }); continue; }
    cambiarSeccion(doc ? doc.name : '');
    /* Cada pregunta parte de cero: una ruta elegida en un empate anterior
       (\`rutaForzada\`) se quedaba puesta y cambiaba la respuesta de la
       siguiente con la misma pregunta. */
    history = []; clearChat(); rutaForzada = null; rutaActual = null;
    for (const t of x.turnos || []) responderSinModelo(t);
    const q = x.q;
    const operacion = esOperacionDeTienda(q);
    const sec = decidirSeccion(q);
    const consulta = consultaDeBusqueda(q);
    const usar = consulta !== q && !SEGUIMIENTO.test(q) ? q : consulta;
    const res = sec.otraSeccion ? [] : retrieve(usar, { limit: TOPE, doc: sec.doc, source: 'pdf' });
    const solido = filtroSolidez(usar);
    const ranking = res.map(r => [r.c.id, +r.score.toFixed(4), r.hits, r.hitsSyn || 0, r.hitsErrata || 0, solido(r) ? 1 : 0]);
    const nivel = res.length ? nivelDeEvidencia(res, usar) : 0;
    const rel = seccionesPorRelevancia(q).map(r => r.c.id);
    const prov = appState.provider; appState.provider = 'gemini';
    let ctx = null, ctxInfo = null;
    try { const b = buildContext(q); ctx = ultimosFragmentos.map(c => c.id); ctxInfo = { nivel: b.nivel, ausentes: (b.ausentes || []).length, sinCoincidencias: !!b.sinCoincidencias }; }
    finally { appState.provider = prov; }
    if (typeof ultimasTarjetas !== 'undefined') ultimasTarjetas = [];
    responderSinModelo(q);
    const el = [...document.querySelectorAll('#chat-messages .msg.assistant')].pop();
    const fa = el?.querySelector('.frag-ausente');
    out.push({ i: x.i, activa: doc ? doc.name : '', secDoc: sec.doc || '', otraSeccion: sec.otraSeccion || '',
      operacion, consulta: usar, nivel, ranking, rel, ctx, ctxInfo,
      tarjetas: (ultimasTarjetas || []).map(t => ({ ...fila(t.c), t: t.texto || '' })),
      sinDato: !!el?.classList.contains('sin-dato'),
      ausente: fa && !fa.classList.contains('frag-parecidas') ? fa.innerText : '',
      parecidas: fa && fa.classList.contains('frag-parecidas') ? fa.innerText : '' });
  }
  cambiarSeccion(''); history = []; clearChat();
  return out;`;

/* ── Principal ────────────────────────────────────────────────────────────── */
if (CORPUS) {
  const c = await enPagina(CORPUS_JS);
  fs.mkdirSync(CORPUS, { recursive: true });
  fs.writeFileSync(path.join(CORPUS, 'corpus.json'), JSON.stringify(c));
  console.log(`corpus: ${c.docs.length} manuales, ${c.chunks.length} fragmentos (app ${c.version})`);
}

if (PREGUNTAS) {
  if (!SALIDA) { console.error('Falta --salida'); process.exit(1); }
  const crudas = JSON.parse(fs.readFileSync(PREGUNTAS, 'utf8'));
  const items = crudas.map((x, i) => ({ i, ...x, tipo: x.tipo || (x.en ? 'no-esta' : 'dato') }));
  const version = (await enPagina('return VERSION_APP'));
  const t0 = Date.now();
  const filas = [];
  for (let a = 0; a < items.length; a += LOTE) {
    const lote = items.slice(a, a + LOTE).map(({ i, q, m, en, turnos }) => ({ i, q, m, en, turnos }));
    const r = await enPagina(PREGUNTAR_JS(lote, TOPE));
    for (const x of r) filas.push({ ...items[x.i], ...x });
    process.stdout.write(`\r${filas.length}/${items.length}`);
  }
  fs.mkdirSync(SALIDA, { recursive: true });
  const destino = path.join(SALIDA, `${ETIQUETA}__${path.basename(PREGUNTAS, '.json')}.jsonl`);
  fs.writeFileSync(destino, filas.map(f => JSON.stringify({ ...f, version, fecha: new Date().toISOString() })).join('\n') + '\n');
  console.log(`\n${destino} (${((Date.now() - t0) / 1000).toFixed(0)} s, ${filas.filter(f => f.falta).length} sin manual)`);
}

if (app) await app.cerrar();
