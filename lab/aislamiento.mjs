// ¿Cargar los manuales de otras secciones cambia lo que contesta la tuya?
//
// Con la sección elegida, la búsqueda solo mira ese manual; pero BM25 pesa
// cada palabra con el IDF de TODO lo cargado (`reconstruirIndice`,
// src/motor/indice.js): «cava» es rara entre catorce manuales y común dentro
// del de la cava. Así que la misma pregunta, en la misma sección, puede
// ordenar distinto según qué más tenga cargado el asesor. Antes de decidir si
// las estadísticas pasan a ser por manual, se mide cuánto pasa.
//
// Corre en Node con lab/motor-node.mjs y compara, para cada pregunta con
// sección (`m` o `en`), tres corridas:
//   todos      los catorce cargados, IDF global (lo que hace la app hoy)
//   idf        los catorce cargados, pero BM25 con las estadísticas de su
//              manual: el efecto del IDF y nada más
//   solo       solo su manual cargado: el efecto total de lo ajeno (incluye
//              lo que SÍ debe cambiar: «eso está en otra sección» ya no puede
//              decirse con un solo manual)
// y cuenta qué cambia: tarjetas, primer puesto, decisión de la puerta y la
// calificación de siempre (lab/calificador.mjs): bien → mal y mal → bien.
//
// Uso:
//   node lab/aislamiento.mjs --corpus <dir> --preguntas <json>[,<json>…] [--detalle 10]
import fs from 'node:fs';
import path from 'node:path';
import { estado } from '../src/estado.js';
import { reconstruirIndice } from '../src/motor/indice.js';
import { cargarCorpus, preguntar } from './motor-node.mjs';
import { calificarManual } from './calificador.mjs';

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const CORPUS = arg('corpus', null), PREGUNTAS = arg('preguntas', null), DETALLE = Number(arg('detalle', 8));
if (!CORPUS || !PREGUNTAS) {
  console.error('Uso: node lab/aislamiento.mjs --corpus <dir> --preguntas <json>[,<json>…]');
  process.exit(2);
}
const corpus = JSON.parse(fs.readFileSync(path.join(CORPUS, 'corpus.json'), 'utf8'));
const porId = new Map(corpus.chunks.map(c => [c.id, c]));

const items = PREGUNTAS.split(',').filter(Boolean).flatMap(f => JSON.parse(fs.readFileSync(f, 'utf8'))
  .map((x, i) => ({ conjunto: path.basename(f, '.json'), i, ...x, tipo: x.tipo || (x.en ? 'no-esta' : 'dato') })))
  .filter(x => x.m || x.en);

/* BM25 con las estadísticas de un solo manual. El resto del índice (las
   cachés, el vocabulario de erratas) se queda como con todos cargados. */
function bm25De(docName) {
  const propios = estado.corpus.filter(c => c.source !== 'pdf' || c.docName === docName);
  const df = Object.create(null);
  let total = 0;
  for (const c of propios) { total += c.len; for (const t in c.tf) df[t] = (df[t] || 0) + 1; }
  return { ...estado.bm25, N: propios.length || 1, avgdl: propios.length ? total / propios.length : 1, df };
}

const docDe = x => x.en
  ? estado.docs.find(d => d.name && corpus.docs.find(e => e.name === d.name)?.sec === x.en)
  : estado.docs.find(d => d.name.normalize('NFC').startsWith(x.m.normalize('NFC')));

function correr(variante) {
  const volver = cargarCorpus(corpus);
  try {
    const out = new Map();
    const global = estado.bm25;
    for (const x of items) {
      const doc = docDe(x);
      if (!doc) continue;
      if (variante === 'idf') estado.bm25 = bm25De(doc.name);
      if (variante === 'solo') {
        const sus = corpus.motor.docChunks.filter(c => c.docName === doc.name).map(c => ({ ...c }));
        const volverSolo = cargarSolo(sus, doc);
        try { out.set(x.conjunto + '#' + x.i, preguntar(x)); } finally { volverSolo(); }
        continue;
      }
      try { out.set(x.conjunto + '#' + x.i, preguntar(x)); } finally { estado.bm25 = global; }
    }
    return out;
  } finally { volver(); }
}
function cargarSolo(chunks, doc) {
  const antes = { docChunks: estado.docChunks, docs: estado.docs };
  estado.docChunks = chunks;
  estado.docs = [{ name: doc.name, pageCount: doc.pageCount }];
  reconstruirIndice();
  return () => { Object.assign(estado, antes); reconstruirIndice(); };
}

const t0 = Date.now();
const corridas = { todos: correr('todos'), idf: correr('idf'), solo: correr('solo') };
console.log(`${items.length} preguntas con sección · ${((Date.now() - t0) / 1000).toFixed(1)} s\n`);

const ids = r => (r.tarjetas || []).map(t => t.id).join(',');
const nota = (x, r) => calificarManual(x, { ...r, ctx: r.ctx && r.ctx.map(id => porId.get(id)) }).ok;
const tipos = ['dato', 'no-esta'];
for (const v of ['idf', 'solo']) {
  console.log(`## ${v === 'idf' ? 'Solo el IDF por manual' : 'Solo su manual cargado'} (contra los catorce con IDF global)\n`);
  console.log('| | preguntas | cambian tarjetas | cambia la 1.ª | cambia la decisión | bien → mal | mal → bien |');
  console.log('| --- | --- | --- | --- | --- | --- | --- |');
  const ejemplos = [];
  for (const tipo of tipos) {
    const xs = items.filter(x => (x.tipo === 'dato') === (tipo === 'dato') && corridas.todos.has(x.conjunto + '#' + x.i));
    let tarj = 0, primera = 0, decision = 0, empeora = 0, mejora = 0;
    for (const x of xs) {
      const k = x.conjunto + '#' + x.i, a = corridas.todos.get(k), b = corridas[v].get(k);
      if (ids(a) !== ids(b)) tarj++;
      if ((a.tarjetas[0]?.id || '') !== (b.tarjetas[0]?.id || '')) primera++;
      if (a.decisionManual?.estado !== b.decisionManual?.estado) decision++;
      const na = nota(x, a), nb = nota(x, b);
      if (na && !nb) { empeora++; ejemplos.push(`- ✗ ${k} «${x.q}»: ${a.decisionManual?.estado} → ${b.decisionManual?.estado}`); }
      if (!na && nb) { mejora++; ejemplos.push(`- ✓ ${k} «${x.q}»: ${a.decisionManual?.estado} → ${b.decisionManual?.estado}`); }
    }
    const pct = n => xs.length ? ` (${(100 * n / xs.length).toFixed(1)} %)` : '';
    console.log(`| ${tipo} | ${xs.length} | ${tarj}${pct(tarj)} | ${primera}${pct(primera)} | ${decision}${pct(decision)} | ${empeora} | ${mejora} |`);
  }
  if (ejemplos.length) console.log('\n' + ejemplos.slice(0, DETALLE).join('\n') + (ejemplos.length > DETALLE ? `\n- … y ${ejemplos.length - DETALLE} más` : ''));
  console.log('');
}
