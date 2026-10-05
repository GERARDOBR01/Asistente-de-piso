// Abstención conformal: un umbral con garantía de cuántas preguntas «no está»
// pueden pasar como respuesta.
//
// La idea (predicción conformal dividida, aplicada a la abstención): se toma un
// conjunto de calibración de preguntas cuya respuesta NO está en la sección, y
// se mira la puntuación de evidencia que la búsqueda les da. Si el umbral es el
// cuantil adecuado de esas puntuaciones, una pregunta «no está» nueva —
// intercambiable con las de calibración— lo supera con probabilidad ≤ α:
//
//     τ = s₍ₖ₎ con k = ⌈(n + 1)(1 − α)⌉   ⇒   P(s_nueva > τ) ≤ α
//
// No hace falta suponer nada sobre la forma de las puntuaciones; solo que la
// pregunta nueva se parezca, como conjunto, a las de calibración. Por eso la
// calibración se separa por manual: se calibra con unos y se comprueba con
// otros.

/* El umbral conformal. Con n negativas y α dado, si k > n no hay umbral que
   garantice α con tan pocos datos: se devuelve +∞ (nunca rescatar). */
export function umbralConformal(negativas, alfa) {
  if (!(alfa > 0 && alfa < 1)) throw new Error('α tiene que estar entre 0 y 1');
  const s = [...negativas].sort((a, b) => a - b);
  const n = s.length;
  const k = Math.ceil((n + 1) * (1 - alfa));
  return k > n ? Infinity : s[k - 1];
}

/* La garantía es «a lo más α» en promedio sobre calibraciones; con n finita la
   tasa de una calibración concreta sigue una Beta. Esta es la cota inferior de
   negativas para que el umbral exista. */
export const negativasMinimas = alfa => Math.ceil(1 / alfa) - 1;

/* Validación cruzada por grupos (aquí, por manual): para cada grupo se calibra
   con las negativas de los demás y se cuenta cuántas negativas del grupo pasan.
   Devuelve la tasa empírica de «no está» que se colaron. */
export function coberturaPorGrupos(filas, alfa, { grupo = f => f.grupo, puntaje = f => f.s } = {}) {
  const grupos = [...new Set(filas.map(grupo))];
  let pasan = 0, total = 0;
  const detalle = [];
  for (const g of grupos) {
    const cal = filas.filter(f => grupo(f) !== g).map(puntaje);
    const tau = umbralConformal(cal, alfa);
    const prueba = filas.filter(f => grupo(f) === g);
    const p = prueba.filter(f => puntaje(f) > tau).length;
    pasan += p; total += prueba.length;
    detalle.push({ grupo: g, n: prueba.length, pasan: p, tau });
  }
  return { tasa: total ? pasan / total : NaN, pasan, total, detalle };
}
