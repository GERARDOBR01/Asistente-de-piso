// Métricas de búsqueda por pregunta: con ellas se compara cualquier
// configuración (léxica, densa, fusionada) sobre las mismas preguntas.
//
// Una configuración entrega, por pregunta, una lista ordenada de ids de
// fragmentos y si se abstiene («no está»). La relevancia de cada fragmento la
// decide lab/calificador.mjs: 2 = página esperada y dato, 1 = página esperada
// sin el dato (el dato quedó en el fragmento hermano), 0 = otra cosa.
import { relevancia } from './calificador.mjs';

export const K = [1, 3, 5, 10];

/* Ganancia acumulada descontada con relevancia graduada (2^rel − 1). */
const dcg = rels => rels.reduce((s, r, i) => s + (2 ** r - 1) / Math.log2(i + 2), 0);

/* Las relevancias de todo el corpus para una pregunta: el ideal del nDCG sale
   de aquí, no de lo que haya devuelto cada configuración. */
export function relevantes(p, corpus) {
  const m = new Map();
  if (p.tipo !== 'dato') return m;
  for (const c of corpus) { const r = relevancia(p, c); if (r) m.set(c.id, r); }
  return m;
}

/* Métricas de una pregunta de dato con una lista ordenada de ids. */
export function porPregunta(ids, rel, { k = 10 } = {}) {
  const grados = ids.map(id => rel.get(id) || 0);
  const puesto = grados.findIndex(g => g === 2);
  const fila = { puesto: puesto < 0 ? null : puesto + 1 };
  for (const n of K) fila['hit@' + n] = puesto >= 0 && puesto < n ? 1 : 0;
  fila.rr = puesto >= 0 && puesto < k ? 1 / (puesto + 1) : 0;
  const ideal = dcg([...rel.values()].sort((a, b) => b - a).slice(0, k));
  fila.ndcg = ideal ? dcg(grados.slice(0, k)) / ideal : 0;
  /* La lámina correcta (página esperada) aunque el dato venga en el hermano. */
  const pagina = grados.findIndex(g => g >= 1);
  fila['pag@3'] = pagina >= 0 && pagina < 3 ? 1 : 0;
  return fila;
}

/* Abstención: en una pregunta «no está» o trampa, abstenerse es acertar; en
   una de dato, abstenerse es perder el dato aunque estuviera arriba. */
export function abstencion(filas) {
  const neg = filas.filter(f => f.tipo !== 'dato'), pos = filas.filter(f => f.tipo === 'dato');
  const vp = neg.filter(f => f.abstiene).length;           // dijo «no está» y no estaba
  const fp = pos.filter(f => f.abstiene).length;           // dijo «no está» y sí estaba
  return {
    negativas: neg.length,
    abstieneBien: vp,
    abstieneMal: fp,
    precision: vp + fp ? vp / (vp + fp) : NaN,
    recall: neg.length ? vp / neg.length : NaN,
    /* La que importa en el piso: de las que no estaban, cuántas enseñaron
       tarjetas como si fueran respuesta. */
    respondioSinRespaldo: neg.length - vp,
  };
}
