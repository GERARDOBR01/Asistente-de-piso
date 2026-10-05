// Las configuraciones de búsqueda que el laboratorio sabe medir.
//
// Cada una es `{ nombre, preparar?(filas), buscar(fila) → {ids, abstiene, …} }`,
// donde `fila` es una pregunta del volcado de la app (lab/volcar.mjs).
//
//   lexico                       la búsqueda de la app tal cual (línea base)
//   denso:<modelo>:<variante>    solo embeddings, coseno
//   rrf:<modelo>:<variante>[:k]  fusión por rangos (Reciprocal Rank Fusion, k=60)
//   mezcla:<modelo>:<variante>:<w>
//                                léxico normalizado + w × coseno normalizado
//
// Todas buscan en el mismo alcance que la app: la sección que decidió
// `decidirSeccion` (o todas, si no decidió ninguna), y nada si la pregunta
// nombra otra sección o es de operación de tienda. La sección no la decide el
// embedding: eso sigue siendo código.
import { vectoresDelCorpus, vectoresDePreguntas, coseno } from './embeddings.mjs';

export async function cargarSistema(nombre, entorno) {
  const [tipo, ...resto] = nombre.split(':');
  if (tipo === 'lexico') return lexico();
  if (tipo === 'denso') return denso(nombre, resto, entorno);
  if (tipo === 'rrf') return rrf(nombre, resto, entorno);
  if (tipo === 'mezcla') return mezcla(nombre, resto, entorno);
  throw new Error(`Sistema desconocido: ${nombre}`);
}

/* La app se abstiene si no enseña tarjetas o si avisa que la palabra no está:
   lo mismo que cuenta calificarManual como «dijo que no está». */
const abstieneLaApp = f => !!f.sinDato || !!f.ausente;

function lexico() {
  return {
    nombre: 'lexico',
    buscar: f => ({
      ids: (f.ranking || []).map(r => r[0]),
      abstiene: abstieneLaApp(f),
      tarjetas: f.tarjetas, ctx: f.ctx, sinDato: f.sinDato, ausente: f.ausente, parecidas: f.parecidas,
    }),
  };
}

/* El ranking denso de una pregunta dentro de su alcance, con el coseno. */
function buscadorDenso([modeloNombre = 'e5', variante = 'contexto'], { corpus, datos }) {
  let emb = null, preguntas = null;
  const fuera = f => f.otraSeccion || f.operacion;
  return {
    async preparar(filas) {
      emb = await vectoresDelCorpus(modeloNombre, variante, corpus, datos);
      preguntas = await vectoresDePreguntas(modeloNombre, filas.map(f => f.consulta || f.q), datos);
    },
    rankear(f) {
      if (fuera(f)) return [];
      const v = preguntas.get(f.consulta || f.q);
      const alcance = f.secDoc ? corpus.chunks.filter(c => c.d === f.secDoc) : corpus.chunks;
      return alcance.map(c => ({ id: c.id, cos: coseno(v, emb.porId.get(c.id)) })).sort((a, b) => b.cos - a.cos);
    },
  };
}

function denso(nombre, args, entorno) {
  const b = buscadorDenso(args, entorno);
  return {
    nombre, preparar: b.preparar,
    buscar: f => ({ ids: b.rankear(f).map(x => x.id), abstiene: abstieneLaApp(f) }),
  };
}

function rrf(nombre, [modeloNombre, variante, k = '60'], entorno) {
  const b = buscadorDenso([modeloNombre, variante], entorno);
  const K = Number(k);
  return {
    nombre, preparar: b.preparar,
    buscar: f => {
      const puntos = new Map();
      (f.ranking || []).forEach((r, i) => puntos.set(r[0], (puntos.get(r[0]) || 0) + 1 / (K + i + 1)));
      b.rankear(f).slice(0, 100).forEach((r, i) => puntos.set(r.id, (puntos.get(r.id) || 0) + 1 / (K + i + 1)));
      return { ids: [...puntos].sort((a, b) => b[1] - a[1]).map(x => x[0]), abstiene: abstieneLaApp(f) };
    },
  };
}

/* El puntaje léxico se lleva a [0, 1] dividiendo por el mejor de la pregunta
   (como hace el corte relativo de la app), y el coseno por min-max dentro del
   alcance. Un fragmento que BM25 no trajo entra solo por su coseno. */
function mezcla(nombre, [modeloNombre, variante, w = '0.5'], entorno) {
  const b = buscadorDenso([modeloNombre, variante], entorno);
  const W = Number(w);
  return {
    nombre, preparar: b.preparar,
    buscar: f => {
      const lex = new Map((f.ranking || []).map(r => [r[0], r[1]]));
      const mejor = Math.max(1e-9, ...lex.values());
      const den = b.rankear(f);
      if (!den.length) return { ids: [], abstiene: true };
      const hi = den[0].cos, lo = den[den.length - 1].cos, rango = Math.max(1e-9, hi - lo);
      const total = den.map(x => ({ id: x.id, s: (lex.get(x.id) || 0) / mejor + W * (x.cos - lo) / rango }));
      return { ids: total.sort((a, b) => b.s - a.s).map(x => x.id), abstiene: abstieneLaApp(f) };
    },
  };
}
