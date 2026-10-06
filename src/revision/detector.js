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
