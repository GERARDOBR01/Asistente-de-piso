// Asistente de Piso · Copyright (c) 2026 Gerardo Barrera.
// Licencia PolyForm Noncommercial 1.0.0: uso comercial solo con licencia escrita (LICENCIA-COMERCIAL.md).
//
// Toque inteligente del focal: la persona toca un elemento en cualquier parte
// y MediaPipe Magic Touch (segmentador interactivo, Apache 2.0, ~6 MB) da su
// silueta. La cima la saca cimaDeSilueta (triangulo.js), que tiene pruebas.
//
// Misma librería, misma CSP y misma caché del service worker que el
// detector (detector.js): se baja la primera vez y luego funciona sin señal.
// Medido el 7-oct con focales reales: la cima queda a 0-1.5 % del punto real
// en 4 de 5 elementos, en ~0.35 s; con una gorra se derramó hasta el techo,
// por eso cimaDeSilueta descarta las siluetas que tocan el borde de arriba.

import { VERSION_MP } from './detector.js';
import { cimaDeSilueta } from './triangulo.js';

const BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION_MP}`;
export const MODELO_SILUETA = 'https://storage.googleapis.com/mediapipe-models/interactive_segmenter/magic_touch/float32/1/magic_touch.tflite';

/** @type {Promise<any>|null} */
let cargando = null;

export function cargarSegmentador() {
  cargando ||= (async () => {
    const mp = await import(/* @vite-ignore */ `${BASE}/vision_bundle.mjs`);
    const archivos = await mp.FilesetResolver.forVisionTasks(`${BASE}/wasm`);
    return mp.InteractiveSegmenter.createFromOptions(archivos, {
      baseOptions: { modelAssetPath: MODELO_SILUETA, delegate: 'CPU' },
      outputCategoryMask: true, outputConfidenceMasks: false,
    });
  })().catch(e => { cargando = null; throw e; });
  return cargando;
}

/**
 * La silueta pintada en un lienzo del tamaño de la máscara, para dibujarla
 * encima de la foto: la persona ve qué agarró el toque (si se juntó con el
 * letrero de atrás, lo nota y lo corrige).
 * @param {Uint8Array} objeto @param {number} W @param {number} H
 */
export function capaDe(objeto, W, H) {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  const img = ctx.createImageData(W, H);
  /* Relleno tenue y el borde casi opaco: así se lee el contorno de lo que
     agarró el toque, y la foto se sigue viendo debajo. */
  for (let i = 0; i < objeto.length; i++) {
    if (!objeto[i]) continue;
    const x = i % W, borde = x === 0 || x === W - 1 || i < W || i >= W * (H - 1) || !objeto[i - 1] || !objeto[i + 1] || !objeto[i - W] || !objeto[i + W];
    const k = i * 4; img.data[k] = 255; img.data[k + 1] = 196; img.data[k + 2] = 61; img.data[k + 3] = borde ? 235 : 80;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/**
 * La silueta del objeto tocado y su cima, en fracción de la imagen.
 * @param {HTMLCanvasElement|HTMLImageElement} fuente
 * @param {{x:number,y:number}} toque  en fracción de la imagen
 * @param {{marco?: {y: number}}} [op]  la zona del focal: una cima muy por encima de ella no se cree
 * @returns {Promise<ReturnType<typeof cimaDeSilueta>>}
 */
export async function siluetaEn(fuente, toque, op = {}) {
  const seg = await cargarSegmentador();
  /** @type {ReturnType<typeof cimaDeSilueta>} */
  let r = null;
  seg.segment(fuente, { keypoint: toque }, (/** @type {any} */ res) => {
    const m = res.categoryMask;
    if (!m) return;
    r = cimaDeSilueta(m.getAsUint8Array(), m.width, m.height, toque, undefined, op);
    m.close?.();
  });
  return r;
}
