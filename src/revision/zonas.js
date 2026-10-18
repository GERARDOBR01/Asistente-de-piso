// Asistente de Piso · Copyright (c) 2026 Gerardo Barrera.
// Licencia PolyForm Noncommercial 1.0.0: uso comercial solo con licencia escrita (LICENCIA-COMERCIAL.md).
//
// Revisar (ADR 0007): las zonas de una foto. Cada zona es un recuadro con su
// tipo (tringla, mesa o focal) y su básico; aquí se crean, se dibujan con el
// dedo, se miden con los módulos puros y se listan.

import { peor } from './veredicto.js';
import { revisarColor } from './color.js';
import { revisarSurtido } from './surtido.js';
import { revisarTriangulo, revisarNiveles } from './triangulo.js';
import { ajustarMarco, agarrar, zonaEn } from './marco.js';
import { MARCOS, NOMBRE_TIPO, ARTICULO, $, st, mostrar, proporcion, aviso, conTope, esc, activa, marcarTipo, areaFoto } from './comun.js';
import { animar, dibujar } from './dibujo.js';
import { pintarResultados } from './reporte.js';
import { actualizarAyuda, precargarModelos } from './ui.js';

/** @typedef {import('./veredicto.js').Imagen} Imagen */
/** @typedef {import('./veredicto.js').Resultado} Resultado */
/** @typedef {import('./comun.js').Tipo} Tipo */
/** @typedef {import('./comun.js').Marco} Marco */
/** @typedef {import('./comun.js').OrigenPuntos} OrigenPuntos */

/**
 * Los básicos que se miden en una zona: colorización en la tringla, surtido en
 * el mueble, y triangulación + alturas y niveles en el focal.
 * @param {Imagen} img @param {Tipo} tipo @param {{x:number,y:number}[]|null} [puntos] en píxeles de img
 * @param {Marco} [zona] el recuadro que marcó la persona, en fracción; si no, la guía de la cámara
 * @param {OrigenPuntos} [origenPuntos]
 * @param {{guia?:boolean, excluir?:Marco[], vestidos?:boolean}} [op] `guia`: la zona no la dibujó la persona;
 *   `excluir`: maniquíes detectados, en fracción, que no cuentan para el surtido;
 *   `vestidos`: la tringla es de vestidos y la regla de color no se aplica
 * @returns {Resultado[]}
 */
export function medirTodo(img, tipo, puntos = null, zona, origenPuntos = 'manual', op = {}) {
  const m = zona || MARCOS[tipo];
  const marco = { x: m.x * img.width, y: m.y * img.height, w: m.w * img.width, h: m.h * img.height };
  if (tipo === 'tringla') return [revisarColor(img, { marco, vestidos: op.vestidos })];
  if (tipo === 'anaquel') return [revisarSurtido(img, {
    marco, guia: op.guia ?? !zona,
    excluir: (op.excluir || []).map(b => ({ x: b.x * img.width, y: b.y * img.height, w: b.w * img.width, h: b.h * img.height })),
  })];
  if (!puntos) return [];
  return [revisarTriangulo(puntos, img, { origen: origenPuntos }), revisarNiveles(puntos, img, { origen: origenPuntos })];
}

/* ── Zonas: una foto de área, varias cosas que revisar ──────────────────── */

/**
 * @typedef {Object} Zona
 * @property {Tipo} tipo
 * @property {Marco} marco          en fracción de la foto
 * @property {boolean} guia         true = la de la guía (sin dibujar a mano)
 * @property {{x:number,y:number}[]} puntos  focal, en píxeles de la imagen analizada
 * @property {OrigenPuntos} origenPuntos
 * @property {string} [nota] lo que dijo «Sugerir», hasta que se toque la zona
 * @property {Marco[]} [maniquies] maniquíes detectados en la zona (surtido), en fracción de la foto
 * @property {boolean} [vestidos] tringla de vestidos: la persona lo marcó y no se aplica la regla de color
 * @property {Resultado[]|null} res null = el focal espera sus puntos
 */

/** @param {Tipo} tipo @param {Marco} marco @param {boolean} guia @returns {Zona} */
const nuevaZona = (tipo, marco, guia) => ({ tipo, marco, guia, puntos: [], origenPuntos: 'manual', res: null });

/** @param {Zona} z */
export function medirZona(z) {
  const f = /** @type {NonNullable<typeof st.foto>} */ (st.foto);
  z.res = medirTodo(f.img, z.tipo, z.tipo === 'focal' ? z.puntos : null, z.marco, z.origenPuntos, { guia: z.guia, excluir: z.maniquies, vestidos: z.vestidos });
  /* Los ejemplos están dibujados por la app: no hay maniquíes que buscar ni modelo que bajar. */
  if (z.tipo === 'anaquel' && !z.maniquies && f.via !== 'demo') quitarManiquies(z);
}

/* Surtido: un maniquí junto a la mesa no es un hueco ni producto. El detector
   (el mismo de «Sugerir», ~14 MB, guardado por el service worker) busca
   personas en la foto una sola vez; si alguno cae en la zona, se vuelve a
   medir sin sus celdas. Sin señal y sin modelo guardado, se queda como está.
   Solo `person` ≥ 0.4: en el banco de escena (17-oct) acertó 93-100 % de las
   veces que dijo «maniquí». */
const MANIQUI_MINIMO = 0.4;

/** @param {Zona} z */
async function quitarManiquies(z) {
  const f = st.foto;
  if (!f) return;
  z.maniquies = [];
  try {
    const ff = /** @type {any} */ (f);
    ff.personas ||= import('./detector.js').then(m => conTope(m.detectar(f.base), 12000));
    const W = f.base.width, H = f.base.height, m = z.marco;
    /** @type {{x:number,y:number,w:number,h:number,categoria:string,score:number}[]} */
    const cajas = await ff.personas;
    const dentro = cajas
      .filter(c => c.categoria === 'person' && c.score >= MANIQUI_MINIMO)
      .map(c => ({ x: c.x / W, y: c.y / H, w: c.w / W, h: c.h / H }))
      .filter(b => {
        const i = Math.max(0, Math.min(b.x + b.w, m.x + m.w) - Math.max(b.x, m.x)) * Math.max(0, Math.min(b.y + b.h, m.y + m.h) - Math.max(b.y, m.y));
        return i >= 0.3 * b.w * b.h;
      });
    if (!dentro.length || st.foto !== f || !st.zonas.includes(z)) return;
    z.maniquies = dentro;
    medirZona(z);
    pintarZonas(); pintarResultados(); dibujar(1);
  } catch (e) {
    /* Sin señal la primera vez: la próxima zona lo vuelve a intentar. */
    delete /** @type {any} */ (f).personas;
    console.warn('Revisar: sin detector para quitar maniquíes del surtido', e);
  }
}

/** Empieza la revisión de una foto recién cargada con una zona de la guía. @param {boolean} [puntosListos] */
export function empezarRevision(puntosListos = false) {
  const f = /** @type {NonNullable<typeof st.foto>} */ (st.foto);
  const lz = $('rv-lienzo');
  lz.width = f.base.width; lz.height = f.base.height;
  proporcion(f.base.width, f.base.height);
  mostrar('foto');
  const z = nuevaZona(st.tipo, MARCOS[st.tipo], true);
  if (puntosListos) z.puntos = st.puntosDemo;
  st.zonas = [z]; st.activa = 0; st.modo = 'ver';
  if (z.tipo === 'focal' && !puntosListos) { tocarZona(0); return; }
  medirZona(z);
  animar(z.tipo === 'focal' ? 1100 : 900);
  pintarZonas(); pintarResultados(true);
}

/**
 * «Volver a revisar»: la foto nueva se mide con las mismas zonas que la de
 * antes. Los puntos de un focal llegan como sugerencia, en el mismo lugar
 * relativo: la persona los mueve a las cimas de hoy y toca Revisar (si se
 * midieran tal cual, el focal saldría igual que antes aunque lo hayan cambiado).
 * @param {any[]} previas zonas guardadas @param {{w:number,h:number}} tam la imagen analizada de antes
 */
export function empezarConZonas(previas, tam) {
  const f = /** @type {NonNullable<typeof st.foto>} */ (st.foto);
  const lz = $('rv-lienzo');
  lz.width = f.base.width; lz.height = f.base.height;
  proporcion(f.base.width, f.base.height);
  mostrar('foto');
  const kx = f.img.width / (tam.w || f.img.width), ky = f.img.height / (tam.h || f.img.height);
  st.zonas = previas.map(p => {
    const z = nuevaZona(p.tipo, { ...p.marco }, p.guia);
    if (p.vestidos) z.vestidos = true;
    if (p.tipo === 'focal' && p.puntos?.length) {
      z.puntos = p.puntos.map((/** @type {{x:number,y:number}} */ q) => ({ x: q.x * kx, y: q.y * ky, sugerido: true }));
      z.origenPuntos = p.origenPuntos || 'manual';
      z.nota = 'Los puntos son los de la vez pasada: muévelos a las cimas de hoy y toca Revisar';
    }
    return z;
  });
  st.activa = 0; st.modo = 'ver';
  for (const z of st.zonas) if (z.tipo !== 'focal') medirZona(z);
  const focal = st.zonas.findIndex(z => z.tipo === 'focal');
  if (focal >= 0) { tocarZona(focal); return; }
  animar(900); pintarZonas(); pintarResultados(true);
}

/** El focal espera sus puntos. @param {number} i */
export function tocarZona(i) {
  st.activa = i; st.modo = 'tocar';
  precargarModelos();
  st.zonas[i].res = null;
  $('rv-ayuda').hidden = false;
  actualizarAyuda(); dibujar(1); pintarZonas(); pintarResultados();
}

/** Lista de zonas y el botón para agregar otra. */
export function pintarZonas() {
  const caja = $('rv-zonas');
  $('rv-lienzo').classList.toggle('anotando', st.modo === 'anotar');
  /* Al anotar, la barra de herramientas toma el lugar de las zonas. */
  if (!st.foto || st.modo === 'anotar') { caja.hidden = true; return; }
  caja.hidden = false;
  const dibujando = st.modo === 'dibujar';
  $('rv-zonas-lista').innerHTML = st.zonas.map((z, i) => {
    const n = z.res && z.res.length ? peor(z.res.map(r => r.nivel)) : null;
    return `<span class="rv-zona${i === st.activa ? ' on' : ''}" data-n="${esc(n || 'PENDIENTE')}"><button type="button" data-zona="${i}"><i></i>${i + 1} · ${esc(NOMBRE_TIPO[z.tipo])}</button>${st.zonas.length > 1 || !z.guia ? `<button type="button" class="rv-zona-x" data-quitar="${i}" aria-label="Quitar la zona ${i + 1}">×</button>` : ''}</span>`;
  }).join('');
  const nueva = $('rv-zona-nueva');
  nueva.textContent = dibujando ? 'Cancelar' : '＋ Zona';
  nueva.classList.toggle('on', dibujando);
  const ajustando = st.modo === 'ajustar', aj = $('rv-zona-ajustar');
  aj.hidden = dibujando || !activa();
  aj.textContent = ajustando ? 'Listo' : '✎ Ajustar';
  aj.classList.toggle('on', ajustando);
  aj.setAttribute('aria-pressed', String(ajustando));
  $('rv-zonas-t').textContent = dibujando
    ? `Arrastra sobre la foto para marcar ${ARTICULO[st.tipo]}. Arriba eliges qué es.`
    : ajustando
      ? 'Arrastra el recuadro para moverlo, o una esquina para cambiar su tamaño. Arriba cambias qué es.'
      : st.zonas.length === 1 && st.zonas[0].guia
        ? '¿La foto tiene mesa, tringla y focal? Marca cada uno con ＋ Zona.'
        : 'Toca una zona para verla; la × la quita.';
  $('rv-lienzo').classList.toggle('dibujando', dibujando);
  $('rv-lienzo').classList.toggle('ajustando', ajustando);
}

/* Tras un resultado la página bajó a las tarjetas: la foto vuelve a la vista para dibujar o ajustar. */
export function verFoto() {
  const r = $('rv-escena').getBoundingClientRect();
  if (r.top < 0 || r.bottom > innerHeight) $('rv-escena').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
}

export function empezarDibujo() {
  if (st.modo === 'dibujar') { st.modo = 'ver'; st.trazo = null; pintarZonas(); dibujar(1); return; }
  if (st.modo === 'tocar') $('rv-ayuda').hidden = true;
  st.modo = 'dibujar'; st.trazo = null; st.ajuste = null;
  pintarZonas(); dibujar(1);
  verFoto();
}

/** Cierra el recuadro dibujado y mide la zona nueva. @param {{x0:number,y0:number,x1:number,y1:number}} t en píxeles de la imagen */
export function terminarDibujo(t) {
  const f = /** @type {NonNullable<typeof st.foto>} */ (st.foto);
  const x = Math.min(t.x0, t.x1) / f.img.width, y = Math.min(t.y0, t.y1) / f.img.height;
  const w = Math.abs(t.x1 - t.x0) / f.img.width, h = Math.abs(t.y1 - t.y0) / f.img.height;
  st.trazo = null;
  if (w < 0.06 || h < 0.06) { aviso('El recuadro quedó muy chico: arrástralo sobre todo el mueble.', 'warn'); dibujar(1); return; }
  /* Si solo estaba la zona de la guía y nadie la miraba distinto, la nueva la reemplaza. */
  if (st.zonas.length === 1 && st.zonas[0].guia) st.zonas = [];
  const z = nuevaZona(st.tipo, { x, y, w, h }, false);
  st.zonas.push(z);
  const i = st.zonas.length - 1;
  if (z.tipo === 'focal') { tocarZona(i); return; }
  st.activa = i; st.modo = 'ver';
  medirZona(z);
  animar(900); pintarZonas(); pintarResultados(true);
}

/* ── Ajustar: mover, cambiar el tamaño o el tipo sin volver a dibujar ───── */

/** «✎ Ajustar» entra y «Listo» sale. Al ajustar, deslizar sobre la foto ya no mueve la página. */
export function empezarAjuste() {
  if (st.modo === 'ajustar') { terminarAjuste(); return; }
  const z = activa();
  if (!z) return;
  if (st.modo === 'tocar') $('rv-ayuda').hidden = true;
  st.modo = 'ajustar'; st.trazo = null; st.ajuste = null;
  marcarTipo(z.tipo);
  pintarZonas(); dibujar(1);
  verFoto();
}

function terminarAjuste() {
  const z = activa();
  st.modo = 'ver'; st.ajuste = null;
  /* Un focal sin puntos (recién cambiado de tipo) los pide al terminar. */
  if (z && z.tipo === 'focal' && !z.res) { tocarZona(st.activa); return; }
  pintarZonas(); dibujar(1); pintarResultados(true);
}

/** La zona activa pasa a ser otra cosa (los botones de arriba, al ajustar). @param {Tipo} t */
export function cambiarTipo(t) {
  const z = activa();
  if (!z || z.tipo === t) return;
  z.tipo = t; z.guia = false; z.res = null; z.nota = undefined; delete z.maniquies;
  if (t === 'focal' && !z.puntos.length) { tocarZona(st.activa); return; }
  medirZona(z);
  animar(700); pintarZonas(); pintarResultados();
}

/** La zona ya ajustada se vuelve a medir: deja de ser la de la guía y los maniquíes se buscan otra vez. @param {Zona} z */
function soltarAjuste(z) {
  z.guia = false; z.nota = undefined; delete z.maniquies;
  if (z.tipo === 'focal' && !z.puntos.length) { dibujar(1); pintarZonas(); return; }
  medirZona(z);
  animar(600); pintarZonas(); pintarResultados();
}

/* Alcance del dedo sobre una esquina, en píxeles de pantalla. */
const ALCANCE_ESQUINA = 24;

export function engancharAjuste() {
  const lz = $('rv-lienzo');
  /** @param {PointerEvent} e */
  const enFraccion = e => {
    const a = areaFoto();
    return { x: Math.min(1, Math.max(0, (e.clientX - a.x) / a.w)), y: Math.min(1, Math.max(0, (e.clientY - a.y) / a.h)), a };
  };
  lz.addEventListener('pointerdown', (/** @type {PointerEvent} */ e) => {
    const z = activa();
    if (st.modo !== 'ajustar' || !z || !st.foto) return;
    const { x, y, a } = enFraccion(e);
    const g = agarrar(z.marco, x, y, ALCANCE_ESQUINA / a.w, ALCANCE_ESQUINA / a.h);
    if (!g) {
      /* Fuera de la zona activa: tocar otra la elige. */
      const j = zonaEn(st.zonas.map(o => o.marco), x, y);
      if (j >= 0 && j !== st.activa) { st.activa = j; marcarTipo(st.zonas[j].tipo); dibujar(1); pintarZonas(); pintarResultados(); }
      return;
    }
    st.ajuste = { esquina: g.esquina, m0: { ...z.marco }, p0: { x, y }, movido: false };
    lz.setPointerCapture(e.pointerId);
    e.preventDefault();
    dibujar(1);
  });
  lz.addEventListener('pointermove', (/** @type {PointerEvent} */ e) => {
    const t = st.ajuste, z = activa();
    if (!t || !z) return;
    const { x, y, a } = enFraccion(e);
    if (!t.movido && Math.hypot((x - t.p0.x) * a.w, (y - t.p0.y) * a.h) < 4) return;
    t.movido = true;
    z.marco = ajustarMarco(t.m0, t.esquina, x - t.p0.x, y - t.p0.y);
    dibujar(1);
  });
  lz.addEventListener('pointerup', () => {
    const t = st.ajuste, z = activa();
    st.ajuste = null;
    if (!t || !z) return;
    st.soltado = performance.now();
    if (t.movido) soltarAjuste(z); else dibujar(1);
  });
  lz.addEventListener('pointercancel', () => {
    const t = st.ajuste, z = activa();
    st.ajuste = null;
    if (t && z) { z.marco = t.m0; dibujar(1); }
  });
}
