// Asistente de Piso · Copyright (c) 2026 Gerardo Barrera.
// Licencia PolyForm Noncommercial 1.0.0: uso comercial solo con licencia escrita (LICENCIA-COMERCIAL.md).
//
// Revisar (ADR 0007): anotar la foto a mano antes de compartirla. Flechas,
// trazos (para encerrar algo) y notas cortas, en fracción de la foto. Se
// dibujan sobre la foto (dibujo.js), viajan en el reporte que se comparte y se
// guardan con la revisión en el historial.

import { normalizarNota, esFlecha, simplificar } from './notas.js';
import { $, st, areaFoto } from './comun.js';
import { dibujar } from './dibujo.js';
import { pintarZonas, verFoto } from './zonas.js';
import { pintarResultados } from './reporte.js';

/** @typedef {import('./notas.js').P} P */

const AYUDA = {
  flecha: 'Arrastra desde lo que quieres señalar hasta donde va la punta.',
  trazo: 'Dibuja con el dedo: encierra lo que hay que corregir.',
  nota: 'Toca donde va la nota y escríbela.',
};
/** @type {'flecha'|'trazo'|'nota'} */
let herramienta = 'flecha';

/** «✎ Anotar la foto»: la foto vuelve a la vista con la barra de herramientas. */
export function empezarAnotar() {
  if (!st.foto) return;
  if (st.modo === 'tocar') $('rv-ayuda').hidden = true;
  st.modo = 'anotar'; st.trazo = null; st.ajuste = null; st.notaViva = null; st.notaPunto = null;
  $('rv-anotar').hidden = false;
  pintarHerramientas(); pintarZonas(); dibujar(1);
  verFoto();
}

function terminar() {
  st.modo = 'ver'; st.notaViva = null; st.notaPunto = null;
  $('rv-anotar').hidden = true; $('rv-nota-caja').hidden = true;
  pintarZonas(); dibujar(1);
  /* Las tarjetas dicen cuántas notas hay; y la revisión se guarda con ellas. */
  pintarResultados();
}

function pintarHerramientas() {
  document.querySelectorAll('#rv-anotar [data-herr]').forEach(b => {
    const on = /** @type {HTMLElement} */ (b).dataset.herr === herramienta;
    b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on));
  });
  $('rv-anotar-t').textContent = AYUDA[herramienta];
  $('rv-anotar-deshacer').disabled = !st.notas.length;
}

/** @param {PointerEvent} e @returns {P} */
function enFraccion(e) {
  const a = areaFoto();
  return { x: Math.min(1, Math.max(0, (e.clientX - a.x) / a.w)), y: Math.min(1, Math.max(0, (e.clientY - a.y) / a.h)) };
}

function ponerNota() {
  const texto = normalizarNota($('rv-nota-txt').value);
  if (texto && st.notaPunto) st.notas.push({ tipo: 'nota', a: st.notaPunto, texto });
  st.notaPunto = null;
  $('rv-nota-txt').value = '';
  $('rv-nota-caja').hidden = true;
  pintarHerramientas(); dibujar(1);
}

export function engancharAnotar() {
  const lz = $('rv-lienzo');
  lz.addEventListener('pointerdown', (/** @type {PointerEvent} */ e) => {
    if (st.modo !== 'anotar' || !st.foto) return;
    const q = enFraccion(e);
    if (herramienta === 'nota') {
      st.notaPunto = q;
      $('rv-nota-caja').hidden = false;
      $('rv-nota-txt').focus();
      dibujar(1);
      return;
    }
    st.notaViva = herramienta === 'flecha' ? { tipo: 'flecha', a: q, b: q } : { tipo: 'trazo', p: [q] };
    lz.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  lz.addEventListener('pointermove', (/** @type {PointerEvent} */ e) => {
    const v = st.notaViva;
    if (!v) return;
    const q = enFraccion(e);
    if (v.tipo === 'flecha') v.b = q; else if (v.tipo === 'trazo') v.p.push(q);
    dibujar(1);
  });
  lz.addEventListener('pointerup', () => {
    const v = st.notaViva;
    st.notaViva = null;
    if (!v) return;
    if (v.tipo === 'flecha' && esFlecha(v.a, v.b)) st.notas.push(v);
    else if (v.tipo === 'trazo' && v.p.length >= 2) st.notas.push({ tipo: 'trazo', p: simplificar(v.p) });
    pintarHerramientas(); dibujar(1);
  });
  lz.addEventListener('pointercancel', () => { st.notaViva = null; dibujar(1); });
  $('rv-anotar').addEventListener('click', (/** @type {MouseEvent} */ e) => {
    const b = /** @type {HTMLElement|null} */ (/** @type {HTMLElement} */ (e.target).closest('button'));
    if (!b) return;
    if (b.dataset.herr) { herramienta = /** @type {'flecha'} */ (b.dataset.herr); st.notaPunto = null; $('rv-nota-caja').hidden = true; pintarHerramientas(); dibujar(1); }
    else if (b.id === 'rv-anotar-deshacer') { st.notas.pop(); pintarHerramientas(); dibujar(1); }
    else if (b.id === 'rv-anotar-listo') terminar();
    else if (b.id === 'rv-nota-ok') ponerNota();
  });
  $('rv-nota-txt').addEventListener('keydown', (/** @type {KeyboardEvent} */ e) => { if (e.key === 'Enter') { e.preventDefault(); ponerNota(); } });
}
