// El índice: cada fragmento con sus términos y BM25 sobre todo el corpus.
//
// El estado del corpus vive en src/estado.js.
//
// Salió de app.js en el paso 3 del ADR 0005, sin cambiar nada de lo que hace
// (golden master idéntico). Sin DOM: se importa igual desde Node.
import { estado, reiniciarCaches } from '../estado.js';
import { tokenize } from './texto.js';

/** @param {Fragmento} c @returns {FragmentoIndexado} */
export function indexChunk(c){
  const toks=tokenize((c.heading?c.heading+' ':'')+c.text);
  const tf=Object.create(null);
  for(const t of toks)tf[t]=(tf[t]||0)+1;
  c.tf=tf;c.len=toks.length||1;
  c.hasDigits=/\d/.test(c.text);
  return /** @type {FragmentoIndexado} */ (c);
}

/* Los rótulos sueltos de un dibujo —«+ CAPACIDAD −», «TAMAÑO», «ICEE»— llegan
   como fragmentos de tres a cinco palabras, y BM25 premia tanto lo corto que
   ganaban a la sección que explica: en LÍNEA BLANCA, «¿dónde van los
   refrigeradores?» salía con el rótulo de la página 7 y no con «plataformas»
   de la 9. Por debajo de 12 palabras, un fragmento se puntúa como si tuviera 12.
   Medido con las 186 preguntas de los 30 manuales: con 8 o 16 mejora menos, y
   con 30 o más sale peor que sin tope, porque entonces los fragmentos largos
   tapan la respuesta. */
export const LARGO_MINIMO=12;

/** @param {FragmentoIndexado} c @param {Array<{t: string, w: number}>} terms */
export function bm25Score(c,terms){
  const bm25=estado.bm25;
  let s=0;
  const largo=Math.max(c.len,LARGO_MINIMO);
  for(const{t,w}of terms){
    const f=c.tf[t];if(!f)continue;
    const n=bm25.df[t]||0;
    const idf=Math.log(1+(bm25.N-n+0.5)/(n+0.5));
    s+=w*idf*(f*(bm25.k1+1))/(f+bm25.k1*(1-bm25.b+bm25.b*largo/bm25.avgdl));
  }
  return s
}

/* Rehace el corpus (manual interno + PDF), las estadísticas de BM25 y olvida
   las cachés que dependen de él. */
export function reconstruirIndice() {
  const corpus = estado.corpus = estado.manualSections.concat(estado.docChunks);
  const df = Object.create(null);
  let total = 0;
  for (const c of /** @type {FragmentoIndexado[]} */ (corpus)) {
    if (!c.tf) indexChunk(c);
    total += c.len;
    for (const t in c.tf) df[t] = (df[t] || 0) + 1;
  }
  estado.bm25.N = corpus.length || 1;
  estado.bm25.avgdl = corpus.length ? total / corpus.length : 1;
  estado.bm25.df = df;
  reiniciarCaches();
}
