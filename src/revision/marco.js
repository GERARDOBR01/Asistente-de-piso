// Asistente de Piso · Copyright (c) 2026 Gerardo Barrera.
// Licencia PolyForm Noncommercial 1.0.0: uso comercial solo con licencia escrita (LICENCIA-COMERCIAL.md).
//
// Revisar (ADR 0007): la geometría de una zona cuando se ajusta con el dedo.
// Todo en fracción de la foto (0 a 1), sin DOM: lo prueba lab/ en Node.

/** @typedef {{x:number,y:number,w:number,h:number}} Marco */

/** Lo más chico que puede quedar una zona por lado, igual que al dibujarla. */
export const LADO_MINIMO = 0.06;

const entre = (/** @type {number} */ v, /** @type {number} */ a, /** @type {number} */ b) => Math.min(b, Math.max(a, v));

/**
 * El marco después de arrastrar `dx, dy` desde donde se apoyó el dedo.
 * Sin esquina, la zona se mueve entera y no se sale de la foto. Con esquina
 * ([0|1, 0|1]: izquierda/derecha, arriba/abajo), esa esquina sigue al dedo, la
 * opuesta se queda quieta y el lado nunca baja de `minimo` ni se voltea.
 * @param {Marco} m0 el marco al apoyar el dedo
 * @param {null|[number, number]} esquina
 * @param {number} dx @param {number} dy en fracción de la foto
 * @param {number} [minimo]
 * @returns {Marco}
 */
export function ajustarMarco(m0, esquina, dx, dy, minimo = LADO_MINIMO) {
  if (!esquina) return { x: entre(m0.x + dx, 0, 1 - m0.w), y: entre(m0.y + dy, 0, 1 - m0.h), w: m0.w, h: m0.h };
  const [cx, cy] = esquina;
  /* La esquina opuesta, fija. */
  const fx = m0.x + (1 - cx) * m0.w, fy = m0.y + (1 - cy) * m0.h;
  const mx = cx ? entre(m0.x + m0.w + dx, Math.min(1, fx + minimo), 1) : entre(m0.x + dx, 0, Math.max(0, fx - minimo));
  const my = cy ? entre(m0.y + m0.h + dy, Math.min(1, fy + minimo), 1) : entre(m0.y + dy, 0, Math.max(0, fy - minimo));
  return { x: Math.min(fx, mx), y: Math.min(fy, my), w: Math.abs(mx - fx), h: Math.abs(my - fy) };
}

/**
 * Qué se agarra al apoyar el dedo en (px, py): una esquina del marco (la más
 * cercana dentro de `rx, ry`), el marco entero, o nada.
 * @param {Marco} m @param {number} px @param {number} py
 * @param {number} rx @param {number} ry alcance del dedo, en fracción de la foto
 * @returns {null|{esquina: null|[number, number]}}
 */
export function agarrar(m, px, py, rx, ry) {
  /** @type {null|[number, number]} */
  let mejor = null, d = Infinity;
  for (const cx of [0, 1]) for (const cy of [0, 1]) {
    const ex = Math.abs(px - (m.x + cx * m.w)) / rx, ey = Math.abs(py - (m.y + cy * m.h)) / ry;
    if (ex <= 1 && ey <= 1 && Math.hypot(ex, ey) < d) { d = Math.hypot(ex, ey); mejor = [cx, cy]; }
  }
  if (mejor) return { esquina: mejor };
  return dentro(m, px, py) ? { esquina: null } : null;
}

/** @param {Marco} m @param {number} px @param {number} py */
export const dentro = (m, px, py) => px >= m.x && px <= m.x + m.w && py >= m.y && py <= m.y + m.h;

/**
 * La zona que se elige al tocar (px, py) entre varias: la más chica que lo
 * contiene, porque una mesa dentro de una foto de área se toca sobre la de área.
 * @param {Marco[]} marcos @param {number} px @param {number} py
 * @returns {number} -1 si ninguna
 */
export function zonaEn(marcos, px, py) {
  let j = -1;
  marcos.forEach((m, i) => { if (dentro(m, px, py) && (j < 0 || m.w * m.h < marcos[j].w * marcos[j].h)) j = i; });
  return j;
}
