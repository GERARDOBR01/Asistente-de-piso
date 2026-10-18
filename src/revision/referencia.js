// Asistente de Piso · Copyright (c) 2026 Gerardo Barrera.
// Licencia PolyForm Noncommercial 1.0.0: uso comercial solo con licencia escrita (LICENCIA-COMERCIAL.md).
//
// Revisar (ADR 0007): la tringla lado a lado con su referencia, como el
// planograma de VM. La referencia es la foto de la campaña (se le mide la
// colorización con el mismo código) o una tringla que ya cumplía en el
// historial (se usan sus tramos medidos). La comparación es pura (secuencia.js).

import { secuencia, compararReferencia, PARECIDO } from './secuencia.js';
import { revisarColor } from './color.js';
import { cuando } from './registro.js';
import { $, st, aviso, esc, aLienzo, pixeles } from './comun.js';
import { registrosGuardados, miniaturaAhora } from './historial.js';
import { pintarResultados } from './reporte.js';

/** @typedef {import('./secuencia.js').Paso} Paso */
/** @typedef {{nombre:string, secuencia:Paso[], mini:Blob|null, url?:string}} Referencia */

/** Se ve la lista de tringlas que cumplían, para elegir una. */
let eligiendo = false;
/** @type {string[]} */
let urlsLista = [];

/** @param {any} z */
const conTramos = z => z.tipo === 'tringla' && z.res?.[0]?.marcas?.tramos?.length >= 2;

/** La tringla que se compara: la zona activa si es tringla; si no, la primera con tramos. */
function zonaTringla() {
  const a = st.zonas[st.activa];
  return a && conTramos(a) ? a : st.zonas.find(conTramos) || null;
}

/** Pone (o quita) la referencia, con la URL de su miniatura. @param {Referencia|null} r */
export function ponerReferencia(r) {
  if (st.referencia?.url) URL.revokeObjectURL(st.referencia.url);
  st.referencia = r ? { ...r, url: r.mini ? URL.createObjectURL(r.mini) : '' } : null;
  eligiendo = false;
}

/** La comparación de la revisión en pantalla, si hay referencia y tringla. */
export function comparacionActual() {
  const z = zonaTringla(), r = st.referencia;
  if (!z || !r) return null;
  const ahora = secuencia(/** @type {any[]} */ (z.res)[0].marcas.tramos);
  return { ahora, x: compararReferencia(r.secuencia, ahora) };
}

function listaCumple() {
  for (const u of urlsLista) URL.revokeObjectURL(u);
  urlsLista = [];
  const cumplen = registrosGuardados().filter(r => r.id !== st.registro && r.zonas.some((/** @type {any} */ z) => conTramos(z) && z.res[0].nivel === 'CUMPLE')).slice(0, 8);
  if (!cumplen.length) return '<p class="rv-ref-vacia">Todavía no hay tringlas que cumplan en el historial.</p>';
  return `<div class="rv-ref-lista">${cumplen.map(r => {
    const u = URL.createObjectURL(r.miniatura); urlsLista.push(u);
    return `<button type="button" data-ref-de="${esc(r.id)}"><img src="${u}" alt=""><span>${esc(r.area || 'Sin área')}<small>${esc(cuando(r.creada))}</small></span></button>`;
  }).join('')}</div>`;
}

/** La tarjeta de la referencia, debajo de los resultados (solo con una tringla medida). */
export function tarjetaReferencia() {
  if (!zonaTringla()) return '';
  const c = comparacionActual(), r = st.referencia;
  if (!c || !r) {
    return `<div class="rv-ref"><div class="rv-ref-cab"><span>Referencia</span></div>
      <p>Compárala con la foto de la campaña o con una tringla que ya cumplía: el orden de los grupos y tramo por tramo.</p>
      <div class="rv-ref-btns"><button type="button" data-ref="archivo">Foto de la campaña</button><button type="button" data-ref="historial" aria-expanded="${eligiendo}">Un CUMPLE del historial</button></div>
      ${eligiendo ? listaCumple() : ''}</div>`;
  }
  const { x, ahora } = c;
  const tira = x.pares.map(p => {
    const de = p.r === null ? null : r.secuencia[p.r], aq = p.a === null ? null : ahora[p.a];
    const cuadro = (/** @type {Paso|null} */ q) => (q ? `<i style="background:${esc(q.rgb)}"></i>` : '<i class="hueco"></i>');
    return `<span class="rv-ref-par${p.de !== null && p.de >= PARECIDO ? ' distinto' : ''}">${cuadro(de)}${cuadro(aq)}</span>`;
  }).join('');
  return `<div class="rv-ref" data-orden="${x.mismoOrden}">
    <div class="rv-ref-cab"><span>Referencia</span><b>Se parece ${Math.round(x.parecido * 100)} %</b></div>
    <div class="rv-ref-fotos"><figure><img src="${r.url || ''}" alt="La referencia"><figcaption>${esc(r.nombre)}</figcaption></figure><figure><img data-mini-actual src="${miniaturaAhora()}" alt=""><figcaption>Ahora</figcaption></figure></div>
    <div class="rv-ref-tiras" aria-label="Arriba la referencia, abajo ahora, tramo por tramo">${tira}</div>
    <p>${esc(x.texto.charAt(0).toUpperCase() + x.texto.slice(1))}</p>
    <div class="rv-ref-btns"><button type="button" data-ref="quitar">Quitar la referencia</button></div>
  </div>`;
}

/** La foto de la campaña: se le mide la colorización con el mismo código que a la tringla. @param {Blob} archivo */
async function desdeArchivo(archivo) {
  try {
    const bmp = await createImageBitmap(archivo);
    const c = aLienzo(bmp, 1600, bmp.width, bmp.height);
    bmp.close();
    const r = revisarColor(pixeles(c));
    const tramos = r.marcas?.tramos || [];
    if (tramos.length < 2) { aviso('No pude leer los colores de esa foto: que se vea la tringla de frente y con luz.', 'warn'); return; }
    const mini = /** @type {Blob} */ (await new Promise(ok => aLienzo(c, 320).toBlob(/** @type {BlobCallback} */ (ok), 'image/jpeg', 0.8)));
    ponerReferencia({ nombre: 'Campaña', secuencia: secuencia(tramos), mini });
    pintarResultados();
  } catch (e) {
    console.warn('Revisar: no se pudo leer la referencia', e);
    aviso('No se pudo abrir esa imagen.', 'warn');
  }
}

/** Una tringla que ya cumplía, del historial: sus tramos ya están medidos. @param {string} id */
function desdeHistorial(id) {
  const reg = registrosGuardados().find(r => r.id === id);
  const z = reg?.zonas.find((/** @type {any} */ q) => conTramos(q) && q.res[0].nivel === 'CUMPLE');
  if (!reg || !z) return;
  ponerReferencia({ nombre: `CUMPLE · ${reg.area ? reg.area + ' · ' : ''}${cuando(reg.creada)}`, secuencia: secuencia(z.res[0].marcas.tramos), mini: reg.miniatura || null });
  pintarResultados();
}

export function engancharReferencia() {
  $('rv-res').addEventListener('click', (/** @type {MouseEvent} */ e) => {
    const b = /** @type {HTMLElement|null} */ (/** @type {HTMLElement} */ (e.target).closest('[data-ref],[data-ref-de]'));
    if (!b) return;
    if (b.dataset.refDe) desdeHistorial(b.dataset.refDe);
    else if (b.dataset.ref === 'archivo') $('rv-ref-archivo').click();
    else if (b.dataset.ref === 'historial') { eligiendo = !eligiendo; pintarResultados(); }
    else if (b.dataset.ref === 'quitar') { ponerReferencia(null); pintarResultados(); }
  });
  $('rv-ref-archivo').addEventListener('change', (/** @type {Event} */ e) => {
    const inp = /** @type {HTMLInputElement} */ (e.target), f = inp.files?.[0];
    inp.value = '';
    if (f) desdeArchivo(f);
  });
}
