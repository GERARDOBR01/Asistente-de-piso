// Asistente de Piso · Copyright (c) 2026 Gerardo Barrera.
// Licencia PolyForm Noncommercial 1.0.0: uso comercial solo con licencia escrita (LICENCIA-COMERCIAL.md).
//
// Revisar (ADR 0007): el sello de evidencia que se quema en la foto al
// compartirla y la geometría de las anotaciones a mano (flechas, trazos y
// notas). Sin DOM: lo prueba lab/. Todo en fracción de la foto (0 a 1).

import { fechaExif } from './procedencia.js';

/** @typedef {{x:number,y:number}} P */
/** @typedef {{tipo:'flecha', a:P, b:P} | {tipo:'trazo', p:P[]} | {tipo:'nota', a:P, texto:string}} Nota */

/** Lo más largo que puede ser el texto de una nota: cabe en un renglón sobre la foto. */
export const LARGO_NOTA = 60;
/** Una flecha más corta que esto (fracción del lado) fue un toque, no una flecha. */
export const FLECHA_MINIMA = 0.03;

/**
 * Cuándo se tomó la foto según su evidencia: la app lo sabe; de la galería,
 * la fecha de la cámara (EXIF) si la trae; si no, no se sabe.
 * @param {any} origen @returns {Date|null}
 */
export function fechaDeToma(origen) {
  const ev = origen?.evidencia || {};
  if (ev.tomada) { const d = new Date(ev.tomada); if (!isNaN(+d)) return d; }
  return fechaExif(ev.fecha_original || null);
}

/** @param {Date} d */
const fecha = d => {
  const f2 = (/** @type {number} */ n) => String(n).padStart(2, '0');
  return `${f2(d.getDate())}/${f2(d.getMonth() + 1)}/${d.getFullYear()} ${f2(d.getHours())}:${f2(d.getMinutes())}`;
};

/**
 * Las dos líneas del sello: cuándo y dónde, y de dónde viene la foto con su
 * huella corta. Va quemado en la foto: si alguien la recorta del reporte, el
 * sello sigue ahí.
 * @param {{origen:any, area:string, origenTexto:string, ahora:Date}} s
 * @returns {[string, string]}
 */
export function textoSello({ origen, area, origenTexto, ahora }) {
  const t = fechaDeToma(origen), h = String(origen?.evidencia?.huella || '');
  const l1 = [t ? fecha(t) : `sin fecha de cámara · compartida ${fecha(ahora)}`, area].filter(Boolean).join(' · ');
  const l2 = [`origen: ${origenTexto}`, h ? `huella ${h.slice(0, 12)}` : ''].filter(Boolean).join(' · ');
  return [l1, l2];
}

/** @param {string} s */
export const normalizarNota = s => String(s || '').replace(/\s+/g, ' ').trim().slice(0, LARGO_NOTA);

/** @param {P} a @param {P} b */
export const esFlecha = (a, b) => Math.hypot(b.x - a.x, b.y - a.y) >= FLECHA_MINIMA;

/**
 * Un trazo a mano sin puntos de más: cada punto queda a más de `min` del
 * anterior; el primero y el último se quedan siempre.
 * @param {P[]} p @param {number} [min]
 * @returns {P[]}
 */
export function simplificar(p, min = 0.006) {
  if (p.length <= 2) return p.slice();
  const out = [p[0]];
  for (let i = 1; i < p.length - 1; i++) {
    const u = out[out.length - 1];
    if (Math.hypot(p[i].x - u.x, p[i].y - u.y) >= min) out.push(p[i]);
  }
  out.push(p[p.length - 1]);
  return out;
}

/**
 * Las dos rayas de la punta de una flecha de `a` a `b` (en píxeles), a ±28°.
 * @param {P} a @param {P} b @param {number} largo
 * @returns {[P, P]}
 */
export function puntaFlecha(a, b, largo) {
  const ang = Math.atan2(b.y - a.y, b.x - a.x), abre = 28 * Math.PI / 180;
  return [
    { x: b.x - largo * Math.cos(ang - abre), y: b.y - largo * Math.sin(ang - abre) },
    { x: b.x - largo * Math.cos(ang + abre), y: b.y - largo * Math.sin(ang + abre) },
  ];
}
