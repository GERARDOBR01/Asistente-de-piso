// Asistente de Piso · Copyright (c) 2026 Gerardo Barrera.
// Licencia PolyForm Noncommercial 1.0.0: uso comercial solo con licencia escrita (LICENCIA-COMERCIAL.md).
//
// Revisar (ADR 0007): una tringla contra su referencia (la foto de la campaña
// o un CUMPLE anterior), como el planograma de VM. Se comparan las dos
// secuencias de color tramo por tramo, alineadas: una puede tener un tramo de
// más o de menos. Sin DOM: lo prueba lab/.

import { NOMBRE_GRUPO } from './color.js';

/** @typedef {{L:number, a:number, b:number, grupo:string, rgb:string, ancho:number}} Paso */

/** Dos colores se ven iguales en tienda hasta esta distancia (ΔE76 en Lab). */
export const PARECIDO = 18;
/** Lo que cuesta, al alinear, un tramo que está en una y no en la otra. */
const HUECO = 0.6;

/**
 * De los tramos de la colorización a la secuencia que se compara (de
 * izquierda a derecha, con su ancho relativo).
 * @param {{x0:number, x1:number, L:number, a:number, b:number, grupo:string, rgb:string}[]} tramos
 * @returns {Paso[]}
 */
export function secuencia(tramos) {
  const ts = [...tramos].sort((p, q) => p.x0 - q.x0);
  const total = ts.reduce((s, t) => s + (t.x1 - t.x0), 0) || 1;
  return ts.map(t => ({ L: t.L, a: t.a, b: t.b, grupo: t.grupo, rgb: t.rgb, ancho: (t.x1 - t.x0) / total }));
}

/** @param {Paso} p @param {Paso} q */
export const distancia = (p, q) => Math.hypot(p.L - q.L, p.a - q.a, p.b - q.b);

/**
 * Alinea dos secuencias (Needleman–Wunsch): emparejar dos tramos cuesta su
 * distancia de color (0 si son iguales, 1 desde 2×PARECIDO) más 0.5 si son de
 * otro grupo; dejar uno sin pareja cuesta HUECO.
 * @param {Paso[]} r la referencia @param {Paso[]} a la de ahora
 * @returns {{r:number|null, a:number|null, de:number|null}[]}
 */
export function alinear(r, a) {
  const n = r.length, m = a.length;
  const costo = (/** @type {number} */ i, /** @type {number} */ j) => Math.min(1, distancia(r[i], a[j]) / (2 * PARECIDO)) + (r[i].grupo === a[j].grupo ? 0 : 0.5);
  const D = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j * HUECO : j === 0 ? i * HUECO : 0)));
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++)
    D[i][j] = Math.min(D[i - 1][j - 1] + costo(i - 1, j - 1), D[i - 1][j] + HUECO, D[i][j - 1] + HUECO);
  /** @type {{r:number|null, a:number|null, de:number|null}[]} */
  const pares = [];
  let i = n, j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && Math.abs(D[i][j] - (D[i - 1][j - 1] + costo(i - 1, j - 1))) < 1e-9) { pares.push({ r: i - 1, a: j - 1, de: distancia(r[i - 1], a[j - 1]) }); i--; j--; }
    else if (i > 0 && Math.abs(D[i][j] - (D[i - 1][j] + HUECO)) < 1e-9) { pares.push({ r: i - 1, a: null, de: null }); i--; }
    else { pares.push({ r: null, a: j - 1, de: null }); j--; }
  }
  return pares.reverse();
}

/** El orden de los bloques de grupo: «C C F F N» → cálido, frío, neutro. @param {Paso[]} s */
export const ordenDeGrupos = s => s.map(p => p.grupo).filter((g, i, x) => i === 0 || g !== x[i - 1]);

/**
 * En qué se parece la tringla de ahora a su referencia.
 * @param {Paso[]} r @param {Paso[]} a
 */
export function compararReferencia(r, a) {
  const pares = alinear(r, a);
  const iguales = pares.filter(p => p.de !== null && p.de < PARECIDO).length;
  const distintos = pares.filter(p => p.de !== null && p.de >= PARECIDO).map(p => /** @type {number} */ (p.a));
  /* Un tramo que falta de un lado y sobra del otro con el mismo color no falta: está en otro lugar. */
  const solosRef = pares.filter(p => p.a === null).map(p => /** @type {number} */ (p.r));
  const solosAhora = pares.filter(p => p.r === null).map(p => /** @type {number} */ (p.a));
  /** @type {{r:number, a:number}[]} */
  const movidos = [];
  for (const j of solosAhora) {
    const k = solosRef.findIndex(i => distancia(r[i], a[j]) < PARECIDO);
    if (k >= 0) { movidos.push({ r: solosRef[k], a: j }); solosRef.splice(k, 1); }
  }
  const faltan = solosRef.length, sobran = solosAhora.length - movidos.length;
  const ordenRef = ordenDeGrupos(r), ordenAhora = ordenDeGrupos(a);
  const mismoOrden = ordenRef.join() === ordenAhora.join();
  const parecido = Math.max(r.length, a.length) ? iguales / Math.max(r.length, a.length) : 0;
  const plural = (/** @type {string} */ g) => NOMBRE_GRUPO[/** @type {'calido'} */ (g)] + 's';
  const partes = [
    mismoOrden ? `mismo orden de grupos (${ordenRef.map(plural).join(' → ')})` : `otro orden de grupos: la referencia va ${ordenRef.map(plural).join(' → ')} y aquí ${ordenAhora.map(plural).join(' → ')}`,
    `${iguales} de ${Math.max(r.length, a.length)} tramos coinciden en su lugar`,
  ];
  for (const m of movidos) partes.push(`el tramo ${m.a + 1} está en otro lugar (en la referencia va en el ${m.r + 1})`);
  if (faltan) partes.push(`${faltan} ${faltan === 1 ? 'tramo de la referencia no está' : 'tramos de la referencia no están'}`);
  if (sobran) partes.push(`${sobran} ${sobran === 1 ? 'tramo no está' : 'tramos no están'} en la referencia`);
  if (distintos.length) partes.push(`${distintos.length === 1 ? 'el tramo' : 'los tramos'} ${distintos.map(i => i + 1).join(', ')} ${distintos.length === 1 ? 'cambia' : 'cambian'} de color`);
  return { parecido, mismoOrden, iguales, faltan, sobran, movidos, distintos, pares, ordenRef, ordenAhora, texto: partes.join('; ') + '.' };
}
