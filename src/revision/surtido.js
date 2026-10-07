// Asistente de Piso · Copyright (c) 2026 Gerardo Barrera.
// Licencia PolyForm Noncommercial 1.0.0: uso comercial solo con licencia escrita (LICENCIA-COMERCIAL.md).
//
// Surtido y huecos (ADR 0007, punto 3): «lo que no se ve no se vende».
// La foto del anaquel se parte en celdas. Una celda está vacía si casi no
// tiene bordes y su color es el del fondo del mueble; las vacías contiguas
// forman un hueco. El % vacío se mide, no se le da al sistema.
//
// Sin DOM: trabaja sobre {width,height,data} como ImageData.

import { resultado, noCalifica, grises, redondear } from './veredicto.js';
import { lab } from './color.js';

/** @typedef {import('./veredicto.js').Imagen} Imagen */
/** @typedef {import('./veredicto.js').Resultado} Resultado */

/* SUPUESTO (ADR 0007): se calibra con las fotos de casa. En % del área
   encuadrada; una casilla vacía de un anaquel de 3×6 mide ~2-3 %, porque el
   aire de arriba de las pilas no cuenta. */
export const UMBRAL_SURTIDO = { observacion: 2, grave: 6, huecoGrande: 6 };

/**
 * Densidad de bordes (Sobel sobre la imagen suavizada) por celda, y color medio.
 * @param {Imagen} img @param {{x:number,y:number,w:number,h:number}} r
 * @param {number} cols @param {number} filas
 */
export function celdas(img, r, cols, filas) {
  const W = img.width, H = img.height, g0 = grises(img);
  /* Una pasada de caja 3×3 antes de Sobel: el ruido del sensor no es surtido. */
  const g = new Float32Array(g0.length);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x;
    g[i] = (g0[i - W - 1] + g0[i - W] + g0[i - W + 1] + g0[i - 1] + g0[i] + g0[i + 1] + g0[i + W - 1] + g0[i + W] + g0[i + W + 1]) / 9;
  }
  const cw = r.w / cols, ch = r.h / filas;
  /** @type {{c:number,f:number,borde:number,lab:number[],x:number,y:number,w:number,h:number}[]} */
  const out = [];
  for (let f = 0; f < filas; f++) for (let c = 0; c < cols; c++) {
    const x0 = Math.max(2, Math.round(r.x + c * cw)), x1 = Math.min(W - 2, Math.round(r.x + (c + 1) * cw));
    const y0 = Math.max(2, Math.round(r.y + f * ch)), y1 = Math.min(H - 2, Math.round(r.y + (f + 1) * ch));
    let s = 0, n = 0, R = 0, G = 0, B = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = y * W + x;
      const gx = g[i - W + 1] + 2 * g[i + 1] + g[i + W + 1] - g[i - W - 1] - 2 * g[i - 1] - g[i + W - 1];
      const gy = g[i + W - 1] + 2 * g[i + W] + g[i + W + 1] - g[i - W - 1] - 2 * g[i - W] - g[i - W + 1];
      s += Math.hypot(gx, gy) / 8; n++;
      const k = i * 4;
      R += img.data[k]; G += img.data[k + 1]; B += img.data[k + 2];
    }
    out.push({ c, f, borde: n ? s / n : 0, lab: n ? lab(R / n, G / n, B / n) : [0, 0, 0], x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
  }
  return out;
}

/** @param {number[]} v @param {number} q */
function cuantil(v, q) {
  const s = Float64Array.from(v).sort();
  return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 0;
}

/**
 * Revisa el surtido de un anaquel o una mesa.
 * @param {Imagen} img foto ya reducida
 * @param {{marco?:{x:number,y:number,w:number,h:number}, cols?:number, filas?:number}} [op]
 * @returns {Resultado}
 */
export function revisarSurtido(img, op = {}) {
  const marco = op.marco || { x: img.width * 0.04, y: img.height * 0.04, w: img.width * 0.92, h: img.height * 0.92 };
  const malo = noCalifica(img, marco);
  if (malo) return resultado('surtido', 'NO_CALIFICA', malo.motivo, malo.evidencia, { marco });
  const cols = op.cols || 16, filas = op.filas || 16;
  const cs = celdas(img, marco, cols, filas);
  /* Umbral de bordes relativo a la propia foto (lo lleno de esta foto) con
     un piso absoluto: así sirve igual con poca o mucha luz. */
  const lleno = cuantil(cs.map(c => c.borde), 0.8);
  const umbral = Math.max(2.2, lleno * 0.22);
  const lisas = cs.filter(c => c.borde < umbral);
  /** @type {Record<string, string|number|boolean|null>} */
  const ev = { celdas: cs.length, umbral_bordes: redondear(umbral, 2) };
  if (!lisas.length) {
    ev.vacio_pct = 0;
    return resultado('surtido', 'CUMPLE', 'Sin huecos: todo el mueble tiene producto a la vista.', ev, { marco, celdas: [], huecos: [] });
  }
  /* El fondo del mueble: el color de las celdas lisas (mediana). Una celda
     lisa de otro color es producto liso (una caja), no un hueco. */
  const fondo = [0, 1, 2].map(k => cuantil(lisas.map(c => c.lab[k]), 0.5));
  /* La claridad pesa poco: una sombra oscurece el fondo sin cambiar su color. */
  const vacia = new Set(lisas.filter(c => Math.hypot((c.lab[0] - fondo[0]) * 0.25, c.lab[1] - fondo[1], c.lab[2] - fondo[2]) < 10).map(c => c.f * cols + c.c));
  /* El aire arriba de las pilas no es un hueco: es parte del mueble. Un hueco
     de verdad es vacío de arriba abajo del entrepaño, así que solo cuentan las
     celdas que forman una corrida vertical de al menos 15 % del alto. */
  const corrida = Math.max(2, Math.ceil(filas * 0.12));
  const reales = new Set();
  for (let c = 0; c < cols; c++) {
    let ini = -1;
    for (let f = 0; f <= filas; f++) {
      const v = f < filas && vacia.has(f * cols + c);
      if (v && ini < 0) ini = f;
      if (!v && ini >= 0) {
        if (f - ini >= corrida) for (let k = ini; k < f; k++) reales.add(k * cols + c);
        ini = -1;
      }
    }
  }
  /* Huecos: componentes conexas (4 vecinos). */
  /** @type {number[][]} */
  const huecos = [];
  const visto = new Set();
  for (const i of reales) {
    if (visto.has(i)) continue;
    const comp = [], pila = [i];
    visto.add(i);
    while (pila.length) {
      const k = /** @type {number} */ (pila.pop());
      comp.push(k);
      for (const j of [k - 1, k + 1, k - cols, k + cols]) {
        if (j < 0 || j >= cs.length || visto.has(j) || !reales.has(j)) continue;
        if (Math.abs((j % cols) - (k % cols)) > 1) continue;
        visto.add(j); pila.push(j);
      }
    }
    huecos.push(comp);
  }
  /* La guía pide encuadrar el mueble COMPLETO: lo vacío que toca el borde del
     encuadre es piso, pared o techo alrededor del mueble, no un hueco. Con
     fotos reales del manual era la única fuente de huecos falsos. */
  /* Abajo siempre es piso. A los lados, solo si es una franja alta (una pared:
     una casilla vacía mide a lo más un entrepaño). Arriba, solo si es ancha
     (techo o pared): una casilla vacía del entrepaño de arriba es angosta. */
  const filasDe = (/** @type {number[]} */ h) => new Set(h.map(i => Math.floor(i / cols))).size;
  const columnasDe = (/** @type {number[]} */ h) => new Set(h.map(i => i % cols)).size;
  const enBorde = (/** @type {number[]} */ h) =>
    h.some(i => i >= cs.length - cols) ||
    (h.some(i => i % cols === 0 || i % cols === cols - 1) && filasDe(h) >= filas * 0.4) ||
    (h.some(i => i < cols) && columnasDe(h) >= cols / 2);
  const fuera = huecos.filter(h => enBorde(h) || columnasDe(h) < 2);
  for (const h of fuera) for (const i of h) reales.delete(i);
  huecos.splice(0, huecos.length, ...huecos.filter(h => !enBorde(h) && columnasDe(h) >= 2));
  huecos.sort((a, b) => b.length - a.length);
  const pct = (reales.size / cs.length) * 100;
  const mayor = huecos.length ? (huecos[0].length / cs.length) * 100 : 0;
  ev.vacio_pct = redondear(pct);
  ev.huecos = huecos.length;
  ev.hueco_mayor_pct = redondear(mayor);
  const marcas = {
    marco,
    huecos: huecos.map(h => h.map(i => { const c = cs[i]; return { x: c.x, y: c.y, w: c.w, h: c.h }; })),
  };
  const U = UMBRAL_SURTIDO;
  if (pct >= U.grave || mayor >= U.huecoGrande)
    return resultado('surtido', 'GRAVE', `${redondear(pct, 0)} % del mueble está vacío${huecos.length ? `; el hueco mayor ocupa ${redondear(mayor, 0)} %` : ''}. Lo que no se ve no se vende.`, ev, marcas);
  if (pct >= U.observacion)
    return resultado('surtido', 'OBSERVACIÓN', `${redondear(pct, 0)} % vacío en ${huecos.length} ${huecos.length === 1 ? 'hueco' : 'huecos'}: conviene resurtir.`, ev, marcas);
  return resultado('surtido', 'CUMPLE', huecos.length ? `Surtido: solo ${redondear(pct, 0)} % vacío.` : 'Sin huecos: todo el mueble tiene producto a la vista.', ev, marcas);
}
