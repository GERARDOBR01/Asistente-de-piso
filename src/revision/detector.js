// Asistente de Piso · Copyright (c) 2026 Gerardo Barrera.
// Licencia PolyForm Noncommercial 1.0.0: uso comercial solo con licencia escrita (LICENCIA-COMERCIAL.md).
//
// Detector de objetos para sugerir los puntos del focal (ADR 0007, plan A).
// MediaPipe Tasks Vision con EfficientDet-Lite0 int8 (Apache 2.0), corriendo
// en el teléfono. Se baja solo la primera vez que alguien toca «Sugerir»
// (~14 MB entre wasm y modelo) y el service worker lo guarda aparte, así que
// después funciona sin señal.
//
// Spike del 6-oct con fotos públicas de escaparates: ve bien los maniquíes de
// cuerpo entero, a medias los bustos, y no ve bases, mesas ni la mayoría de
// los accesorios. Por eso solo SUGIERE: la persona confirma, quita o agrega
// puntos antes de revisar, y el reporte lo dice.

import { recorteDe, elegirCajas, cimaCreible, fusionarPuntos, REGLA_SUGERIR } from './sugerir.js';
/** @typedef {import('./sugerir.js').Rect} Rect */
/** @typedef {import('./sugerir.js').Caja} Caja */

export const VERSION_MP = '0.10.21';
const BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION_MP}`;
export const MODELO = 'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/int8/1/efficientdet_lite0.tflite';

/** @type {Promise<any>|null} */
let cargando = null;

export function cargarDetector() {
  cargando ||= (async () => {
    const mp = await import(/* @vite-ignore */ `${BASE}/vision_bundle.mjs`);
    const archivos = await mp.FilesetResolver.forVisionTasks(`${BASE}/wasm`);
    return mp.ObjectDetector.createFromOptions(archivos, {
      baseOptions: { modelAssetPath: MODELO, delegate: 'CPU' },
      scoreThreshold: 0.2, maxResults: 25, runningMode: 'IMAGE',
    });
  })().catch(e => { cargando = null; throw e; });
  return cargando;
}

/**
 * Cajas de los objetos de la imagen, en sus píxeles.
 * @param {HTMLCanvasElement|HTMLImageElement} fuente
 * @returns {Promise<{x:number,y:number,w:number,h:number,categoria:string,score:number}[]>}
 */
export async function detectar(fuente) {
  const d = await cargarDetector();
  const r = d.detect(fuente);
  return r.detections.map((/** @type {any} */ x) => ({
    x: x.boundingBox.originX, y: x.boundingBox.originY, w: x.boundingBox.width, h: x.boundingBox.height,
    categoria: x.categories[0].categoryName, score: x.categories[0].score,
  }));
}

/**
 * Sugerencias para una zona del focal, en píxeles de `a.img`.
 * @param {{base: HTMLCanvasElement, img: {width:number,height:number,data:Uint8ClampedArray|Uint8Array}}} a
 * @param {Rect} marco en fracción
 * @param {{x:number,y:number}[]} previos los que ya tocó la persona, en píxeles de `a.img`
 * @param {{silueta?: boolean, cerca?: number, alCaja?: (c: {x:number,y:number,w:number,h:number,categoria:string,score:number}) => void}} [op]
 * @returns {Promise<{puntos: Array<{x:number,y:number,caja?:Rect,categoria?:string,score?:number,deSilueta?:boolean}>, agregados: number, encontrados: number, cajas: Caja[], fuera: {categoria:string, motivo:keyof typeof import('./sugerir.js').MOTIVO_FUERA}[]}>}
 */
export async function sugerirPuntos(a, marco, previos, op = {}) {
  const B = a.base, W = a.img.width, H = a.img.height, k = W / B.width;
  const r = recorteDe(marco, B.width, B.height);
  const cv = document.createElement('canvas');
  cv.width = r.w; cv.height = r.h;
  /** @type {CanvasRenderingContext2D} */ (cv.getContext('2d')).drawImage(B, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
  /** @type {{categoria:string, motivo:keyof typeof import('./sugerir.js').MOTIVO_FUERA}[]} */
  const fuera = [];
  const cajas = elegirCajas(await detectar(cv), { w: r.w, h: r.h, cortadoArriba: r.y > 0 }, REGLA_SUGERIR, fuera)
    /* Del recorte a la imagen analizada. */
    .map(c => ({ ...c, x: (c.x + r.x) * k, y: (c.y + r.y) * k, w: c.w * k, h: c.h * k }))
    .sort((p, q) => p.x - q.x);
  /** @type {Array<{x:number,y:number,caja?:Rect,categoria?:string,score?:number,deSilueta?:boolean}>} */
  const nuevos = [];
  /* La silueta sobre la imagen chica (≤ 640 px): es más rápida que sobre la base. */
  let fuente = null;
  if (op.silueta !== false && cajas.length) {
    fuente = document.createElement('canvas');
    fuente.width = W; fuente.height = H;
    /** @type {CanvasRenderingContext2D} */ (fuente.getContext('2d')).putImageData(new ImageData(Uint8ClampedArray.from(a.img.data), W, H), 0, 0);
  }
  const { siluetaEn } = fuente ? await import('./silueta.js') : { siluetaEn: null };
  for (const c of cajas) {
    op.alCaja?.(c);
    let p = { x: c.x + c.w / 2, y: c.y, caja: { x: c.x, y: c.y, w: c.w, h: c.h }, categoria: c.categoria, score: c.score, deSilueta: false };
    /* El toque virtual va arriba de la caja; si cae en un hueco (el asa de una
       bolsa, entre los brazos), se prueba más abajo, en el cuerpo. */
    if (siluetaEn && fuente) {
      for (const f of [0.15, 0.4]) {
        try {
          const s = await siluetaEn(fuente, { x: (c.x + c.w / 2) / W, y: Math.min(0.99, (c.y + f * c.h) / H) });
          if (!s) continue;
          const cima = { x: s.cima.x * W, y: s.cima.y * H };
          if (cimaCreible(c, cima, H)) { p = { ...p, x: cima.x, y: cima.y, deSilueta: true }; break; }
        } catch { break; /* sin silueta, lo alto de la caja */ }
      }
    }
    /* Una cima muy por encima del marco es de otra cosa. Y el detector mira
       la zona con un margen (para no cortar lo que toca la orilla), pero lo
       que queda fuera del recuadro que marcó la persona no es de su exhibición. */
    if (p.y < (marco.y - 0.03) * H || p.y > (marco.y + marco.h) * H) continue;
    if (p.x < (marco.x - 0.02) * W || p.x > (marco.x + marco.w + 0.02) * W) continue;
    nuevos.push(p);
  }
  const cerca = op.cerca ?? 0.04 * Math.max(W, H);
  /* Dos cajas del mismo elemento (persona y bolsa encimadas) dan la misma cima. */
  const unicos = fusionarPuntos([], nuevos, cerca).puntos;
  const f = fusionarPuntos(previos, unicos, cerca);
  return { puntos: f.puntos, agregados: f.agregados, encontrados: unicos.length, cajas, fuera };
}
