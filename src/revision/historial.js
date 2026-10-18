// Asistente de Piso · Copyright (c) 2026 Gerardo Barrera.
// Licencia PolyForm Noncommercial 1.0.0: uso comercial solo con licencia escrita (LICENCIA-COMERCIAL.md).
//
// Revisar (ADR 0007): el historial. Cada revisión de una foto real (no los
// ejemplos) se guarda sola en IndexedDB, en una base aparte de los manuales:
// la foto a ≤ 1280 px, la miniatura con las marcas, las zonas con sus
// resultados, el origen, el área y lo revisado a mano. Vive en el teléfono,
// nunca sale a la red, y se borra una por una o todo junto.

import { registroDe, sugerenciasDeArea, aRecortar, normalizarArea, cuando } from './registro.js';
import { $, st, aviso, esc, aLienzo } from './comun.js';
import { dibujar } from './dibujo.js';
import { revisadoAMano } from './reporte.js';

const DB = 'asistente_piso_revisar', STORE = 'revisiones';
/** El área de la revisión anterior: una ronda suele ser del mismo departamento. */
const CLAVE_AREA = 'ap_rv_area';
/** Lo que se sugiere antes de que haya áreas propias. */
const AREAS_BASE = ['Caballeros', 'Damas', 'Niños', 'Zapatería', 'Accesorios', 'Hogar', 'Deportes', 'Lencería'];
const LADO_FOTO = 1280, LADO_MINI = 320;
const ESPERA_MS = 1200;
/** Cuántas se pintan de entrada; «Ver más» pinta las demás. */
const PRIMERAS = 30;

/** @type {any[]} lo guardado, la más nueva primero */
let registros = [];
let pendiente = 0;
/** @type {Map<string, string>} lo último que se guardó de cada revisión, para no reescribir lo mismo */
const firmas = new Map();
/** La foto cuya revisión se borró: no se vuelve a guardar sola. @type {any} */
let descartada = null;
let filtro = '';
let todas = false;
let borrarTodoArmado = false;
/** @type {string[]} */
let urls = [];
/** @type {(reg: any, previa?: any) => void} */
let alAbrir = () => {};
/** @type {(reg: any) => void} */
let alRepetir = () => {};

/** @returns {Promise<IDBDatabase>} */
function abrirBase() {
  return new Promise((ok, ko) => {
    if (!globalThis.indexedDB) return ko(new Error('sin IndexedDB'));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' }); };
    req.onsuccess = () => ok(req.result);
    req.onerror = () => ko(req.error);
  });
}

/** @param {IDBTransactionMode} modo @param {(s: IDBObjectStore) => IDBRequest | void} fn @returns {Promise<any>} */
async function tx(modo, fn) {
  const db = await abrirBase();
  return new Promise((ok, ko) => {
    const t = db.transaction(STORE, modo), req = fn(t.objectStore(STORE));
    t.oncomplete = () => { db.close(); ok(req && req.result); };
    t.onerror = () => { db.close(); ko(t.error); };
    /* Sin espacio, la transacción se aborta sin disparar error (igual que en almacen/manuales.js). */
    t.onabort = () => { db.close(); ko(t.error || new Error('transacción abortada')); };
  });
}

/** @param {HTMLCanvasElement} c @param {number} q @returns {Promise<Blob>} */
const jpeg = (c, q) => new Promise((ok, ko) => c.toBlob(b => (b ? ok(b) : ko(new Error('sin JPEG'))), 'image/jpeg', q));

/* ── Guardar ────────────────────────────────────────────────────────────── */

/** Lo que se guardaría ahora de la revisión en pantalla (sin la foto). */
function datosActuales() {
  const f = /** @type {NonNullable<typeof st.foto>} */ (st.foto);
  return registroDe({ zonas: st.zonas, origen: st.origen, area: st.area, via: f.via, tomada: f.tomada, revisado: [...revisadoAMano()], tam: { w: f.img.width, h: f.img.height }, antes: st.antes });
}

const guardable = () => !!st.foto && st.foto.via !== 'demo' && st.foto !== descartada && st.zonas.some(z => z.res && z.res.length);

/** Cada cambio (una medida, el área, lo revisado a mano) guarda la revisión un momento después. */
export function guardarPronto() {
  if (!guardable()) return;
  clearTimeout(pendiente);
  pendiente = setTimeout(guardar, ESPERA_MS);
}

/** Antes de cambiar de foto, lo pendiente se guarda ya (lo que lee de la pantalla, sin esperar). */
export function soltarActual() {
  if (!pendiente) return;
  clearTimeout(pendiente);
  guardar();
}

/** La revisión recién abierta del historial ya está guardada tal cual. */
export function marcarGuardada() {
  if (st.registro && st.foto) firmas.set(st.registro, JSON.stringify(datosActuales()));
}

async function guardar() {
  pendiente = 0;
  if (!guardable()) return;
  /* Todo lo que se lee de la pantalla, antes del primer await: la foto puede cambiar enseguida. */
  const f = /** @type {any} */ (st.foto);
  const datos = datosActuales(), firma = JSON.stringify(datos);
  const nueva = !st.registro;
  const id = st.registro || `rv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  st.registro = id;
  if (firmas.get(id) === firma) return;
  firmas.set(id, firma);
  dibujar(1);
  const mini = aLienzo($('rv-lienzo'), LADO_MINI);
  try {
    f.guardada ||= jpeg(aLienzo(f.base, LADO_FOTO), 0.85);
    const antes = registros.find(r => r.id === id);
    const miniatura = await jpeg(mini, 0.8);
    const reg = { id, creada: antes?.creada ?? Date.now(), editada: Date.now(), ...datos, foto: await f.guardada, miniatura };
    if (st.foto === f) ponerMiniActual(miniatura);
    await tx('readwrite', s => s.put(reg));
    if (nueva) {
      navigator.storage?.persist?.().catch(() => {});
      try { localStorage.setItem(CLAVE_AREA, datos.area); } catch { /* sin almacenamiento */ }
    }
    await refrescar();
    if (nueva) await recortar();
  } catch (e) {
    firmas.delete(id);
    console.warn('Revisar: no se pudo guardar en el historial', e);
    aviso('No se pudo guardar la revisión en el historial: puede que el teléfono no tenga espacio.', 'warn');
  }
}

async function recortar() {
  const sobran = aRecortar(registros);
  if (!sobran.length) return;
  for (const id of sobran) await tx('readwrite', s => s.delete(id));
  aviso(`El historial llegó a su tope: se ${sobran.length === 1 ? 'borró la revisión más vieja' : `borraron las ${sobran.length} más viejas`}.`);
  await refrescar();
}

/* ── Área ───────────────────────────────────────────────────────────────── */

/** Una foto nueva empieza con el área de la anterior. */
export function areaNueva() {
  let a = '';
  try { a = localStorage.getItem(CLAVE_AREA) || ''; } catch { /* sin almacenamiento */ }
  ponerArea(a);
}

/** @param {string} a */
export function ponerArea(a) {
  st.area = normalizarArea(a);
  $('rv-area').value = st.area;
  sugerir();
}

function sugerir() {
  $('rv-areas').innerHTML = sugerenciasDeArea(registros, $('rv-area').value, AREAS_BASE).slice(0, 12).map(a => `<option value="${esc(a)}"></option>`).join('');
}

/** La barra del área se ve con una foto real (o esperando la de «Volver a revisar»); dice si ya está guardada. */
export function pintarArea() {
  const real = (!!st.foto && st.foto.via !== 'demo') || !!st.repetir;
  $('rv-area-caja').hidden = !real;
  if (!real) return;
  const reg = st.registro && registros.find(r => r.id === st.registro);
  $('rv-guardada').textContent = st.repetir ? '' : reg ? `Guardada · ${cuando(reg.creada)}` : (guardable() ? 'Se guarda en el historial' : '');
  $('rv-repetir').hidden = !reg || !!st.repetir;
}

/**
 * La miniatura marcada de la revisión en pantalla, para «Antes y después».
 * @param {Blob|null|undefined} blob
 */
export function ponerMiniActual(blob) {
  if (st.miniActual) URL.revokeObjectURL(st.miniActual);
  st.miniActual = blob ? URL.createObjectURL(blob) : '';
  const img = /** @type {HTMLImageElement|null} */ (document.getElementById('rv-cambios-ahora'));
  if (img && st.miniActual) img.src = st.miniActual;
}

/* ── Lista ──────────────────────────────────────────────────────────────── */

const BASICO_CORTO = /** @type {Record<string, string>} */ ({ colorizacion: 'Color', surtido: 'Surtido', triangulacion: 'Triángulo', niveles: 'Alturas', origen: 'Origen' });

async function refrescar() {
  try { registros = (await tx('readonly', s => s.getAll())) || []; } catch { registros = []; }
  registros.sort((a, b) => b.creada - a.creada);
  pintar();
}

function pintar() {
  const sec = $('rv-historial');
  sec.hidden = !registros.length;
  pintarArea();
  sugerir();
  if (!registros.length) return;
  for (const u of urls) URL.revokeObjectURL(u);
  urls = [];
  /* Las áreas más usadas, como filtro. */
  const areas = sugerenciasDeArea(registros, '').slice(0, 6);
  if (filtro && !areas.includes(filtro)) areas.push(filtro);
  $('rv-hist-filtro').innerHTML = areas.length < 1 ? '' : [['', 'Todas'], ...areas.map(a => [a, a])]
    .map(([v, t]) => `<button type="button" class="rv-chip${filtro === v ? ' on' : ''}" data-filtro="${esc(v)}">${esc(t)}</button>`).join('');
  const lista = registros.filter(r => !filtro || normalizarArea(r.area).toLowerCase() === filtro.toLowerCase());
  const vista = todas ? lista : lista.slice(0, PRIMERAS);
  $('rv-hist-n').textContent = `${registros.length} ${registros.length === 1 ? 'revisión' : 'revisiones'}`;
  $('rv-hist-lista').innerHTML = vista.map(r => {
    const u = URL.createObjectURL(r.miniatura); urls.push(u);
    const n = r.nivel || 'PENDIENTE';
    const bs = Object.entries(r.basicos || {}).map(([b, nv]) => `<i data-n="${esc(nv)}">${esc(BASICO_CORTO[b] || b)}</i>`).join('');
    const vuelta = r.cambios ? `<small class="rv-hist-vuelta" data-todo="${r.cambios.todo}">↻ ${esc(r.cambios.texto)}</small>` : '';
    return `<div class="rv-hist-item${r.id === st.registro ? ' on' : ''}" data-n="${esc(n)}">
      <button type="button" class="rv-hist-abrir" data-abrir="${esc(r.id)}"><img src="${u}" alt="" loading="lazy"><span class="rv-hist-txt"><b>${esc(r.area || 'Sin área')}</b><small>${esc(cuando(r.tomada || r.creada))} · ${r.zonas.length} ${r.zonas.length === 1 ? 'zona' : 'zonas'}</small>${vuelta}<span class="rv-hist-bas">${bs}</span></span></button>
      <button type="button" class="rv-hist-x" data-borrar="${esc(r.id)}" aria-label="Borrar la revisión">×</button></div>`;
  }).join('') + (vista.length < lista.length ? `<button type="button" class="rv-hist-mas" data-mas="1">Ver las ${lista.length}</button>` : '');
  const b = $('rv-hist-borrar');
  b.textContent = borrarTodoArmado ? '¿Borrar todo? Toca otra vez' : 'Borrar todo';
  b.classList.toggle('armado', borrarTodoArmado);
}

/** @param {string} id */
async function borrar(id) {
  if (id === st.registro) { descartada = st.foto; st.registro = null; clearTimeout(pendiente); pendiente = 0; }
  firmas.delete(id);
  await tx('readwrite', s => s.delete(id)).catch(() => {});
  aviso('Revisión borrada del historial.');
  await refrescar();
}

async function borrarTodo() {
  if (st.registro) { descartada = st.foto; st.registro = null; clearTimeout(pendiente); pendiente = 0; }
  firmas.clear();
  await tx('readwrite', s => s.clear()).catch(() => {});
  borrarTodoArmado = false; filtro = '';
  aviso('Historial borrado de este teléfono.');
  await refrescar();
}

/**
 * Engancha la lista y el área. `abrir` vuelve a poner en la pantalla una
 * revisión guardada (lo hace ui.js, que maneja la escena).
 * @param {(reg: any, previa?: any) => void} abrir
 * @param {(reg: any) => void} repetir «Volver a revisar» la revisión en pantalla
 */
export function iniciarHistorial(abrir, repetir) {
  alAbrir = abrir; alRepetir = repetir;
  $('rv-repetir').addEventListener('click', () => {
    const reg = st.registro && registros.find(r => r.id === st.registro);
    if (reg) { soltarActual(); alRepetir(reg); }
  });
  const area = $('rv-area');
  area.addEventListener('input', () => { st.area = normalizarArea(area.value); sugerir(); guardarPronto(); });
  area.addEventListener('change', () => { area.value = st.area; });
  $('rv-hist-lista').addEventListener('click', async (/** @type {MouseEvent} */ e) => {
    const b = /** @type {HTMLElement|null} */ (/** @type {HTMLElement} */ (e.target).closest('button'));
    if (!b) return;
    if (b.dataset.mas) { todas = true; pintar(); return; }
    if (b.dataset.borrar) {
      /* Dos toques: el primero pregunta. */
      if (!b.classList.contains('armado')) { b.classList.add('armado'); b.textContent = '¿Borrar?'; setTimeout(() => { b.classList.remove('armado'); b.textContent = '×'; }, 3500); return; }
      await borrar(b.dataset.borrar);
      return;
    }
    if (b.dataset.abrir) {
      const reg = registros.find(r => r.id === b.dataset.abrir);
      if (reg) { soltarActual(); descartada = null; alAbrir(reg, reg.antes ? registros.find(r => r.id === reg.antes) : null); pintar(); }
    }
  });
  $('rv-hist-filtro').addEventListener('click', (/** @type {MouseEvent} */ e) => {
    const b = /** @type {HTMLElement|null} */ (/** @type {HTMLElement} */ (e.target).closest('[data-filtro]'));
    if (!b) return;
    filtro = /** @type {string} */ (b.dataset.filtro); todas = false;
    pintar();
  });
  $('rv-hist-borrar').addEventListener('click', () => {
    if (!borrarTodoArmado) { borrarTodoArmado = true; pintar(); setTimeout(() => { borrarTodoArmado = false; pintar(); }, 4000); return; }
    borrarTodo();
  });
  refrescar();
}

/** Una foto nueva (o «Nueva foto»): su revisión se guarda como otra. */
export function revisionNueva() {
  soltarActual();
  st.registro = null; descartada = null; st.antes = null;
  ponerMiniActual(null);
  areaNueva();
}
