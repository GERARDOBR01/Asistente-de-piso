// Asistente de Piso · Copyright (c) 2026 Gerardo Barrera.
// Licencia PolyForm Noncommercial 1.0.0: uso comercial solo con licencia escrita (LICENCIA-COMERCIAL.md).
//
// Revisión con foto (ADR 0007): los cuatro niveles de Veristack y la calidad
// mínima de una foto para poder calificarla.
//
// Sin DOM: todo trabaja sobre {width,height,data} como ImageData (RGBA), para
// que sirva igual en Node y en el navegador.

/** @typedef {{width:number,height:number,data:Uint8ClampedArray|Uint8Array}} Imagen */
/** @typedef {'CUMPLE'|'OBSERVACIÓN'|'GRAVE'|'NO_CALIFICA'} Nivel */
/**
 * @typedef {Object} Resultado
 * @property {string} basico   origen | colorizacion | surtido | triangulacion
 * @property {Nivel} nivel
 * @property {string} motivo   una frase para la persona en piso
 * @property {Record<string, string|number|boolean|null>} evidencia  números que lo sostienen
 * @property {'CÓDIGO'} fuente
 * @property {any} [marcas]    lo que la pantalla dibuja sobre la foto
 */

/** @type {Nivel[]} */
export const NIVELES = ['CUMPLE', 'OBSERVACIÓN', 'GRAVE', 'NO_CALIFICA'];

/* Punto de partida: los umbrales de mandatory_engine.py de Veristack (brillo
   medio 0-255 y nitidez). La nitidez aquí es la varianza del laplaciano sobre
   la foto reducida a ~640 px de lado; se recalibra con las fotos de casa. */
/* ladoMinimo 160: una tringla bien encuadrada es una tira ancha (640×226 al
   reducirla) y alcanza de sobra para contar tramos. */
/* exposicionMinima: lo claro de la foto COMPLETA (percentil 90 de la luma),
   no el brillo de la zona. Una tringla de abrigos negros bien fotografiada
   tiene la zona oscura (brillo 39) y la foto bien expuesta (p90 194); una
   foto subexpuesta queda oscura entera. Medido el 7-oct: fotos reales de
   tienda y del manual, p90 ≥ 138; sintéticas oscuras, p90 ≈ 30. */
export const CALIDAD = { exposicionMinima: 80, nitidezMinima: 30, ladoMinimo: 160 };

/** Percentil 90 de la luma de toda la foto (muestreada). @param {Imagen} img */
export function exposicion(img) {
  const n = img.width * img.height, paso = Math.max(1, Math.floor(n / 40000));
  const v = [];
  for (let i = 0; i < n; i += paso) v.push(luma(img, i));
  v.sort((a, b) => a - b);
  return v.length ? v[Math.floor(v.length * 0.9)] : 0;
}

/**
 * @param {string} basico @param {Nivel} nivel @param {string} motivo
 * @param {Record<string, string|number|boolean|null>} [evidencia] @param {any} [marcas]
 * @returns {Resultado}
 */
export function resultado(basico, nivel, motivo, evidencia = {}, marcas) {
  /** @type {Resultado} */
  const r = { basico, nivel, motivo, evidencia, fuente: 'CÓDIGO' };
  if (marcas !== undefined) r.marcas = marcas;
  return r;
}

/** El peor nivel manda en el resumen; NO_CALIFICA solo si nada calificó.
 * @param {Nivel[]} niveles @returns {Nivel} */
export function peor(niveles) {
  if (niveles.includes('GRAVE')) return 'GRAVE';
  if (niveles.includes('OBSERVACIÓN')) return 'OBSERVACIÓN';
  if (niveles.includes('CUMPLE')) return 'CUMPLE';
  return 'NO_CALIFICA';
}

/** Luma BT.601 de un píxel. @param {Imagen} img @param {number} i índice del píxel */
export function luma(img, i) {
  const d = img.data, k = i * 4;
  return 0.299 * d[k] + 0.587 * d[k + 1] + 0.114 * d[k + 2];
}

/** Escala de grises como Float32Array. @param {Imagen} img */
export function grises(img) {
  const n = img.width * img.height, g = new Float32Array(n);
  for (let i = 0; i < n; i++) g[i] = luma(img, i);
  return g;
}

/**
 * Brillo medio y nitidez (varianza del laplaciano 4-vecinos) de una región.
 * @param {Imagen} img
 * @param {{x:number,y:number,w:number,h:number}} [r]
 */
export function calidad(img, r = { x: 0, y: 0, w: img.width, h: img.height }) {
  const g = grises(img), W = img.width;
  const x0 = Math.max(1, Math.floor(r.x)), y0 = Math.max(1, Math.floor(r.y));
  const x1 = Math.min(img.width - 1, Math.floor(r.x + r.w)), y1 = Math.min(img.height - 1, Math.floor(r.y + r.h));
  let suma = 0, n = 0, sl = 0, sl2 = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = y * W + x;
    suma += g[i]; n++;
    const l = 4 * g[i] - g[i - 1] - g[i + 1] - g[i - W] - g[i + W];
    sl += l; sl2 += l * l;
  }
  if (!n) return { brillo: 0, nitidez: 0 };
  const m = sl / n;
  return { brillo: suma / n, nitidez: sl2 / n - m * m };
}

/**
 * Si la foto no da para calificar, el motivo; si da, null.
 * @param {Imagen} img @param {{x:number,y:number,w:number,h:number}} [r]
 * @returns {{motivo:string, evidencia:Record<string,number>}|null}
 */
export function noCalifica(img, r) {
  const lado = Math.min(img.width, img.height);
  const { brillo, nitidez } = calidad(img, r);
  const expo = exposicion(img);
  const evidencia = { brillo: redondear(brillo), exposicion: redondear(expo, 0), nitidez: redondear(nitidez), lado };
  if (lado < CALIDAD.ladoMinimo) return { motivo: `La foto es muy chica (${lado} px de lado).`, evidencia };
  if (expo < CALIDAD.exposicionMinima) return { motivo: `La foto está muy oscura (exposición ${redondear(expo, 0)}, mínimo ${CALIDAD.exposicionMinima}). Busca más luz y vuelve a tomarla.`, evidencia };
  if (nitidez < CALIDAD.nitidezMinima) return { motivo: `Está movida o fuera de foco (nitidez ${redondear(nitidez)}, mínimo ${CALIDAD.nitidezMinima}).`, evidencia };
  return null;
}

/**
 * Reduce la foto para analizarla (vecino más cercano promediado 2×2): una foto
 * de 12 MP no hace falta para contar colores, y en el teléfono pesa.
 * @param {Imagen} img @param {number} [max] lado mayor @returns {Imagen}
 */
export function reducir(img, max = 640) {
  const f = Math.max(img.width, img.height) / max;
  if (f <= 1) return img;
  const w = Math.round(img.width / f), h = Math.round(img.height / f);
  const out = new Uint8ClampedArray(w * h * 4), d = img.data, W = img.width, H = img.height;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx = Math.min(W - 2, Math.floor((x + 0.5) * f)), sy = Math.min(H - 2, Math.floor((y + 0.5) * f));
    const o = (y * w + x) * 4;
    for (let c = 0; c < 4; c++) {
      const a = (sy * W + sx) * 4 + c;
      out[o + c] = (d[a] + d[a + 4] + d[a + W * 4] + d[a + W * 4 + 4]) / 4;
    }
  }
  return { width: w, height: h, data: out };
}

/** @param {number} x @param {number} [dec] */
export function redondear(x, dec = 1) {
  const p = 10 ** dec;
  return Math.round(x * p) / p;
}
