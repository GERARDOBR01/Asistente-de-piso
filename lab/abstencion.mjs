// Abstención conformal de punta a punta: la app de hoy más un rescate por
// significado.
//
// Regla que se mide: si la app calla (sin tarjetas) o avisa que una palabra no
// está, y la evidencia densa de la pregunta supera un umbral τ, se enseñan las
// 3 primeras láminas de la búsqueda híbrida, sin el aviso. La app nunca
// pierde una respuesta que ya daba: el rescate solo actúa donde se abstuvo.
// Lo que arriesga es contestar una «no está», y eso es lo que acota τ.
//
// τ se calibra con preguntas «no está» en las que la app se abstiene (las
// cruzadas: pregunta de un manual hecha en otro, más las «no está» y trampas de
// la batería), con validación cruzada por manual.
//
// Uso:
//   node lab/abstencion.mjs --datos <dir> [--modelo e5] [--variante crudo] [--w 0.6]
//        [--calibrar bateria-piso-2026-10,cruzadas-pares] [--evaluar bateria-prueba-2026-10]
import fs from 'node:fs';
import path from 'node:path';
import { calificarManual } from './calificador.mjs';
import { vectoresDelCorpus, vectoresDePreguntas, coseno } from './embeddings.mjs';
import { umbralConformal, coberturaPorGrupos } from './conformal.mjs';
import { wilson } from './estadistica.mjs';

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const DATOS = arg('datos', null);
const MODELO = arg('modelo', 'e5');
const VARIANTE = arg('variante', 'crudo');
const W = Number(arg('w', 0.6));
const CALIBRAR = arg('calibrar', 'bateria-piso-2026-10,bateria-nombrada,cruzadas-pares').split(',');
const EVALUAR = arg('evaluar', 'bateria-prueba-2026-10').split(',');
const ALFAS = arg('alfas', '0.01,0.02,0.05,0.1').split(',').map(Number);
const PUNTAJE = arg('puntaje', 'cos');

const corpus = JSON.parse(fs.readFileSync(path.join(DATOS, 'corpus.json'), 'utf8'));
const porId = new Map(corpus.chunks.map(c => [c.id, c]));
const leer = n => fs.readFileSync(path.join(DATOS, `base__${n}.jsonl`), 'utf8').trim().split('\n').map(l => JSON.parse(l)).filter(f => !f.falta).map(f => ({ ...f, conjunto: n }));
const cal = CALIBRAR.flatMap(leer), ev = EVALUAR.flatMap(leer);
const todas = [...cal, ...ev];

const emb = await vectoresDelCorpus(MODELO, VARIANTE, corpus, DATOS);
const vq = await vectoresDePreguntas(MODELO, todas.map(f => f.consulta || f.q), DATOS);

/* Por pregunta: el ranking híbrido dentro del alcance de la app y la
   evidencia densa. «cos» es el coseno del mejor fragmento; «margen», cuánto
   se separa del décimo (una pregunta que se parece a todo por igual no
   apunta a nada). */
function analizar(f) {
  const fuera = f.otraSeccion || f.operacion;
  const alcance = fuera ? [] : f.secDoc ? corpus.chunks.filter(c => c.d === f.secDoc) : corpus.chunks;
  const v = vq.get(f.consulta || f.q);
  const den = alcance.map(c => ({ id: c.id, cos: coseno(v, emb.porId.get(c.id)) })).sort((a, b) => b.cos - a.cos);
  const lex = new Map((f.ranking || []).map(r => [r[0], r[1]]));
  const mejor = Math.max(1e-9, ...lex.values());
  let hib = [];
  if (den.length) {
    const hi = den[0].cos, lo = den[den.length - 1].cos, rango = Math.max(1e-9, hi - lo);
    hib = den.map(x => ({ id: x.id, s: (lex.get(x.id) || 0) / mejor + W * (x.cos - lo) / rango })).sort((a, b) => b.s - a.s);
  }
  const cos = den.length ? den[0].cos : -1;
  const margen = den.length > 10 ? den[0].cos - den[9].cos : den.length ? den[0].cos - den[den.length - 1].cos : -1;
  const s = PUNTAJE === 'margen' ? margen : PUNTAJE === 'mixto' ? cos + margen : cos;
  /* Lo que hizo la app. */
  const app = calificarManual(f, { ...f, ctx: f.ctx && f.ctx.map(id => porId.get(id)) });
  const abstiene = !!f.sinDato || !!f.ausente;
  /* Lo que enseñaría el rescate. */
  const tarjetas = hib.slice(0, 3).map(x => porId.get(x.id));
  const rescate = calificarManual(f, { tarjetas, sinDato: false, ausente: '' });
  /* El rescate no tapa un aviso de cantidad (el código ya vio que la cifra no
     está) ni actúa sin una sección decidida (τ se calibra por sección). */
  const avisoDeCantidad = /no dice cu[aá]nt|No encontré en el manual cu[aá]nt|ningún porcentaje/.test(f.ausente || '');
  const puedeRescatar = (!!f.sinDato || (!!f.ausente && !avisoDeCantidad)) && !fuera && !!f.secDoc && hib.length > 0;
  return { f, s, abstiene, puedeRescatar, appOk: app.ok, rescateOk: rescate.ok, grupo: f.secDoc || f.activa || '(todas)' };
}
const A = todas.map(analizar);
const deCal = A.filter(a => CALIBRAR.includes(a.f.conjunto));
const deEv = A.filter(a => EVALUAR.includes(a.f.conjunto));

/* Población de calibración: negativas en las que la app se abstiene y el
   rescate podría actuar. Es justo donde el rescate arriesga. */
const negCal = deCal.filter(a => a.f.tipo !== 'dato' && a.puedeRescatar);

/* ¿Separa el puntaje? AUC entre positivas rescatables (la app calló y la
   lámina estaba) y negativas rescatables. */
function auc(pos, neg) {
  let g = 0;
  for (const p of pos) for (const n of neg) g += p > n ? 1 : p === n ? 0.5 : 0;
  return pos.length && neg.length ? g / (pos.length * neg.length) : NaN;
}
const posCal = deCal.filter(a => a.f.tipo === 'dato' && a.puedeRescatar && a.rescateOk);
console.log(`Modelo ${MODELO} (${VARIANTE}), w=${W}, puntaje «${PUNTAJE}»`);
console.log(`Calibración: ${negCal.length} negativas en las que la app calla · ${posCal.length} positivas que la app calla y el rescate acertaría · AUC ${auc(posCal.map(a => a.s), negCal.map(a => a.s)).toFixed(3)}\n`);

const filas = [];
for (const alfa of ALFAS) {
  const tau = umbralConformal(negCal.map(a => a.s), alfa);
  const loo = coberturaPorGrupos(negCal, alfa, { grupo: a => a.grupo, puntaje: a => a.s });
  const medir = conj => {
    const pos = conj.filter(a => a.f.tipo === 'dato'), neg = conj.filter(a => a.f.tipo !== 'dato');
    const rescata = a => a.puedeRescatar && a.s > tau;
    const okPos = pos.filter(a => a.appOk || (rescata(a) && a.rescateOk)).length;
    const appPos = pos.filter(a => a.appOk).length;
    const colados = neg.filter(a => rescata(a)).length;
    const appNegOk = neg.filter(a => a.abstiene).length;
    return { n: pos.length, appPos, okPos, nNeg: neg.length, appNegOk, negOk: appNegOk - colados, colados };
  };
  const c = medir(deCal), e = medir(deEv);
  const w = wilson(e.colados, e.nNeg);
  filas.push(`| ${alfa} | ${tau.toFixed(3)} | ${loo.pasan}/${loo.total} (${(100 * loo.tasa).toFixed(1)} %) | ${c.appPos} → ${c.okPos} de ${c.n} | ${c.appNegOk} → ${c.negOk} de ${c.nNeg} | ${e.appPos} → ${e.okPos} de ${e.n} | ${e.appNegOk} → ${e.negOk} de ${e.nNeg} [colados ≤ ${(100 * w.alto).toFixed(0)} %] |`);
}
console.log('| α | τ | «no está» coladas, por manual (validación cruzada) | Calibración: dato | Calibración: «no está» | Prueba: dato | Prueba: «no está» |');
console.log('| --- | --- | --- | --- | --- | --- | --- |');
for (const l of filas) console.log(l);

/* La calibración que usa la app: solo el umbral y de dónde salió (sin texto de
   ningún manual), para guardarla en el repo. */
const GUARDAR = arg('guardar', null);
if (GUARDAR) {
  const alfa = Number(arg('alfa', 0.02));
  const tau = umbralConformal(negCal.map(a => a.s), alfa);
  const loo = coberturaPorGrupos(negCal, alfa, { grupo: a => a.grupo, puntaje: a => a.s });
  fs.writeFileSync(GUARDAR, JSON.stringify({
    modelo: (await import('./embeddings.mjs')).MODELOS[MODELO].id, variante: VARIANTE, w: W, puntaje: PUNTAJE,
    alfa, tau, negativas: negCal.length, manuales: new Set(negCal.map(a => a.grupo)).size,
    coladasPorManual: `${loo.pasan}/${loo.total}`, fecha: new Date().toISOString().slice(0, 10),
  }, null, 2) + '\n');
  console.log('\nCalibración guardada en ' + GUARDAR);
}
