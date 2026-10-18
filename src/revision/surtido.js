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
/* pesoClaridad: cuánto pesa la claridad al comparar una celda con el fondo.
   Poco, para que una sombra no esconda un hueco; pero no tan poco que unos
   pantalones cafés lisos sobre una mesa beige cuenten como vacío (7-oct).
   Barrido 0.25-0.6: de 0.4 a 0.6 aciertan las 2 mesas de tienda y las 12
   fotos del manual, sin cambio en las sintéticas; se toma el centro.
   oscuroMinimo: una celda casi negra (L < 15) no prueba nada: es sombra o
   producto negro. Un hueco de verdad deja ver el mueble. */
export const FONDO_SURTIDO = { pesoClaridad: 0.5, oscuroMinimo: 15 };

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
 * @param {{marco?:{x:number,y:number,w:number,h:number}, guia?:boolean, excluir?:{x:number,y:number,w:number,h:number}[], cols?:number, filas?:number, fondo?:typeof FONDO_SURTIDO}} [op]
 *   `guia`: el marco es el de la guía, no lo dibujó la persona; arriba de la
 *   mesa o del mueble hay techo o pared. `excluir`: cajas en píxeles que no son
 *   ni producto ni hueco (maniquíes); sus celdas no cuentan.
 * @returns {Resultado}
 */
export function revisarSurtido(img, op = {}) {
  const marco = op.marco || { x: img.width * 0.04, y: img.height * 0.04, w: img.width * 0.92, h: img.height * 0.92 };
  const guia = op.guia ?? !op.marco;
  const malo = noCalifica(img, marco);
  if (malo) return resultado('surtido', 'NO_CALIFICA', malo.motivo, malo.evidencia, { marco });
  const cols = op.cols || 16, filas = op.filas || 16;
  const cs = celdas(img, marco, cols, filas);
  /* Un maniquí junto a la mesa no es producto ni hueco: sus celdas se quitan
     de la cuenta, y lo vacío a su lado se juzga solo si es parte del mueble. */
  const tapada = (/** @type {{x:number,y:number,w:number,h:number}} */ c) => (op.excluir || []).some(b => {
    const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
    return cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h;
  });
  const excluidas = new Set(cs.filter(tapada).map(c => c.f * cols + c.c));
  /* Umbral de bordes relativo a la propia foto (lo lleno de esta foto) con
     un piso absoluto: así sirve igual con poca o mucha luz. */
  const cuentan = cs.filter(c => !excluidas.has(c.f * cols + c.c));
  /* Sin zona dibujada y con un maniquí en la foto, es una foto de área: no se
     sabe qué parte es la mesa, y lo de junto (una base, una columna, el piso)
     saldría como hueco. No se adivina: se pide la zona. */
  if (guia && excluidas.size)
    return resultado('surtido', 'NO_CALIFICA', 'En la foto hay maniquíes: marca solo la mesa o el mueble con «＋ Zona» y se revisa ese recuadro.', { celdas: cs.length, celdas_maniqui: excluidas.size }, { marco });
  if (cuentan.length < cs.length * 0.25)
    return resultado('surtido', 'NO_CALIFICA', 'El recuadro es casi todo maniquí: marca solo la mesa o el mueble.', { celdas: cs.length, celdas_maniqui: excluidas.size }, { marco });
  const lleno = cuantil(cuentan.map(c => c.borde), 0.8);
  const umbral = Math.max(2.2, lleno * 0.22);
  const lisas = cuentan.filter(c => c.borde < umbral);
  /** @type {Record<string, string|number|boolean|null>} */
  const ev = { celdas: cuentan.length, umbral_bordes: redondear(umbral, 2) };
  if (excluidas.size) ev.celdas_maniqui = excluidas.size;
  if (!lisas.length) {
    ev.vacio_pct = 0;
    return resultado('surtido', 'CUMPLE', 'Sin huecos: todo el mueble tiene producto a la vista.', ev, { marco, celdas: [], huecos: [] });
  }
  /* El fondo del mueble: el color de las celdas lisas (mediana). Una celda
     lisa de otro color es producto liso (una caja), no un hueco. */
  const fondo = [0, 1, 2].map(k => cuantil(lisas.map(c => c.lab[k]), 0.5));
  /* La claridad pesa poco: una sombra oscurece el fondo sin cambiar su color. */
  const F = op.fondo || FONDO_SURTIDO;
  const vacia = new Set(lisas.filter(c => c.lab[0] >= F.oscuroMinimo && Math.hypot((c.lab[0] - fondo[0]) * F.pesoClaridad, c.lab[1] - fondo[1], c.lab[2] - fondo[2]) < 10).map(c => c.f * cols + c.c));
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
  /* Con el marco de la guía en una foto de área, arriba de la mesa queda techo
     o pared. Las lámparas lo parten en pedazos angostos, así que se mira el
     borde de arriba entero: si lo vacío que lo toca, sumando todos los
     pedazos, cubre al menos la mitad del ancho, es techo. Una casilla vacía
     del entrepaño de arriba de un mueble que llena el cuadro no llega a tanto. */
  const arriba = new Set(huecos.filter(h => h.some(i => i < cols)).flatMap(h => h.map(i => i % cols)));
  const techo = guia && arriba.size >= cols / 2;
  const enBorde = (/** @type {number[]} */ h) =>
    h.some(i => i >= cs.length - cols) ||
    (techo && h.some(i => i < cols)) ||
    (h.some(i => i % cols === 0 || i % cols === cols - 1) && filasDe(h) >= filas * 0.4) ||
    (h.some(i => i < cols) && columnasDe(h) >= cols / 2);
  const fuera = huecos.filter(h => enBorde(h) || columnasDe(h) < 2);
  for (const h of fuera) for (const i of h) reales.delete(i);
  huecos.splice(0, huecos.length, ...huecos.filter(h => !enBorde(h) && columnasDe(h) >= 2));
  huecos.sort((a, b) => b.length - a.length);
  const pct = (reales.size / cuentan.length) * 100;
  const mayor = huecos.length ? (huecos[0].length / cuentan.length) * 100 : 0;
  ev.vacio_pct = redondear(pct);
  ev.huecos = huecos.length;
  ev.hueco_mayor_pct = redondear(mayor);
  const marcas = {
    marco,
    huecos: huecos.map(h => h.map(i => { const c = cs[i]; return { x: c.x, y: c.y, w: c.w, h: c.h }; })),
  };
  const U = UMBRAL_SURTIDO;
  const sinManiqui = excluidas.size ? ' No cuenta lo que tapa el maniquí.' : '';
  if (pct >= U.grave || mayor >= U.huecoGrande)
    return resultado('surtido', 'GRAVE', `${redondear(pct, 0)} % del mueble está vacío${huecos.length ? `; el hueco mayor ocupa ${redondear(mayor, 0)} %` : ''}. Lo que no se ve no se vende.${sinManiqui}`, ev, marcas);
  if (pct >= U.observacion)
    return resultado('surtido', 'OBSERVACIÓN', `${redondear(pct, 0)} % vacío en ${huecos.length} ${huecos.length === 1 ? 'hueco' : 'huecos'}: conviene resurtir.${sinManiqui}`, ev, marcas);
  return resultado('surtido', 'CUMPLE', (huecos.length ? `Surtido: solo ${redondear(pct, 0)} % vacío.` : 'Sin huecos: todo el mueble tiene producto a la vista.') + sinManiqui, ev, marcas);
}
