// Asistente de Piso · Copyright (c) 2026 Gerardo Barrera.
// Licencia PolyForm Noncommercial 1.0.0: uso comercial solo con licencia escrita (LICENCIA-COMERCIAL.md).
//
// Revisar (ADR 0007): la guía de captura en vivo. Mientras la cámara está
// abierta, cada ~450 ms se mide un cuadro del video por el mismo camino que la
// foto (1600 px → 640 px) con los umbrales de `noCalifica`, y el acelerómetro
// dice si el teléfono está derecho. Avisa sobre el video; nunca bloquea el disparo.

import { revisarToma, inclinacion, suavizar, avisoNivel } from './toma.js';
import { MARCOS, $, st, aLienzo, pixeles } from './comun.js';

const CADA_MS = 450;

const grande = document.createElement('canvas');
const chico = document.createElement('canvas');
chico.getContext('2d', { willReadFrequently: true });

let reloj = 0;
/** @type {null|{ladeo:number, frente:number}} */
let nivel = null;
let pintando = false;

/**
 * iOS pide permiso para el acelerómetro y solo dentro del toque: se llama
 * antes del primer `await` al abrir la cámara. Sin permiso, no hay nivel.
 */
export function pedirSensor() {
  const DM = /** @type {any} */ (globalThis).DeviceMotionEvent;
  if (typeof DM?.requestPermission === 'function') DM.requestPermission().catch(() => {});
}

export function empezarToma() {
  pararToma();
  addEventListener('devicemotion', alMoverse);
  reloj = setTimeout(medir, 250);
}

export function pararToma() {
  clearTimeout(reloj);
  removeEventListener('devicemotion', alMoverse);
  nivel = null;
  $('rv-toma').hidden = true;
  $('rv-horizonte').hidden = true;
  $('rv-toma-nivel').hidden = true;
  $('rv-disparo').classList.remove('lista');
}

function medir() {
  const v = /** @type {HTMLVideoElement} */ ($('rv-video'));
  if (!st.stream) return;
  if (v.videoWidth && !document.hidden) {
    const img = pixeles(aLienzo(v, 1600, v.videoWidth, v.videoHeight, grande), chico);
    const m = MARCOS[st.tipo];
    const t = revisarToma(img, { x: m.x * img.width, y: m.y * img.height, w: m.w * img.width, h: m.h * img.height });
    chip('luz', t.luz, t.luz ? 'Luz bien' : 'Falta luz', `exposición ${t.exposicion} (mínimo 80)`);
    chip('nitidez', t.nitida, t.nitida ? 'Nítida' : 'Quieto: sale movida', `nitidez ${t.nitidez} (mínimo 30)`);
    $('rv-toma').dataset.listo = String(t.luz && t.nitida);
    $('rv-toma').hidden = false;
    listo();
  }
  reloj = setTimeout(medir, CADA_MS);
}

/** @param {string} cual @param {boolean} ok @param {string} texto @param {string} detalle */
function chip(cual, ok, texto, detalle) {
  const el = /** @type {HTMLElement} */ (document.querySelector(`#rv-toma [data-toma="${cual}"]`));
  if (el.textContent !== texto) el.textContent = texto;
  el.classList.toggle('ok', ok);
  el.title = detalle;
}

/** El disparo se pinta de «lista» cuando luz, nitidez y (si hay sensor) nivel están bien. */
function listo() {
  const nivelOk = !nivel || avisoNivel(nivel).ok;
  $('rv-disparo').classList.toggle('lista', $('rv-toma').dataset.listo === 'true' && nivelOk);
}

/** @param {DeviceMotionEvent} e */
function alMoverse(e) {
  const g = e.accelerationIncludingGravity;
  if (!g || !st.stream) return;
  const angulo = screen.orientation?.angle ?? Number(/** @type {any} */ (globalThis).orientation || 0);
  const n = inclinacion(g, angulo);
  if (!n) return;
  nivel = suavizar(nivel, n);
  if (!pintando) { pintando = true; requestAnimationFrame(pintarNivel); }
}

/* La línea del centro marca el horizonte; las de las orillas, la foto. Cuando
   se alinean, el teléfono está derecho. */
function pintarNivel() {
  pintando = false;
  if (!nivel || !st.stream) return;
  const a = avisoNivel(nivel), linea = $('rv-horizonte');
  linea.hidden = false;
  linea.style.setProperty('--ladeo', `${(-nivel.ladeo).toFixed(1)}deg`);
  linea.classList.toggle('ok', a.ok);
  $('rv-toma-nivel').hidden = false;
  chip('nivel', a.ok, a.texto, `ladeo ${nivel.ladeo.toFixed(1)}° · de frente ${nivel.frente.toFixed(0)}°`);
  listo();
}
