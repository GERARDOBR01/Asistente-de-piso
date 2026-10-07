// Asistente de Piso · Copyright (c) 2026 Gerardo Barrera.
// Licencia PolyForm Noncommercial 1.0.0: uso comercial solo con licencia escrita (LICENCIA-COMERCIAL.md).
//
// Pestaña «Revisar» (ADR 0007): cámara, foto marcada, veredictos y compartir.
// Es la única pieza de src/revision/ que toca el DOM; las mediciones viven en
// los módulos puros y aquí solo se dibujan.

import { reducir, peor } from './veredicto.js';
import { leerMetadatos, huella, veredictoOrigen, dimensiones, formato, jpegCompleto } from './procedencia.js';
import { revisarColor, NOMBRE_GRUPO } from './color.js';
import { revisarSurtido } from './surtido.js';
import { revisarTriangulo, puntosDeCajas } from './triangulo.js';
import { tringla, anaquel, focal, PALETA as P, conMetadatos, exifMuestra, c2paMuestra, xmpMuestra } from './demo.js';

/** @typedef {import('./veredicto.js').Imagen} Imagen */
/** @typedef {import('./veredicto.js').Resultado} Resultado */
/** @typedef {'tringla'|'anaquel'|'focal'} Tipo */
/** @typedef {{x:number,y:number,w:number,h:number}} Marco */

/* Lo que encuadra la guía, en fracción de la foto. Es lo mismo que miden
   color.js y surtido.js: la guía no es decoración. */
export const MARCOS = {
  tringla: { x: 0.04, y: 0.1, w: 0.92, h: 0.8 },
  anaquel: { x: 0.04, y: 0.04, w: 0.92, h: 0.92 },
  focal: { x: 0.03, y: 0.03, w: 0.94, h: 0.94 },
};
const TEXTOS = {
  tringla: { vacia: 'Apunta a la tringla', guia: 'La franja va a la altura del pecho de las prendas', basico: 'Colorización' },
  anaquel: { vacia: 'Apunta al anaquel o a la mesa', guia: 'Encuadra el mueble completo', basico: 'Surtido' },
  focal: { vacia: 'Apunta al focal', guia: 'Encuadra el focal completo', basico: 'Triangulación' },
};
const MANUAL = ['Planchado', 'Limpieza del departamento', 'Sensores en costura', 'Entallado: una prenda por talla', 'Pasillo de 90 cm', 'Doblado de chica a grande'];
const COLOR_NIVEL = { CUMPLE: '#3ECF8E', 'OBSERVACIÓN': '#F5B942', GRAVE: '#FF5A6E', NO_CALIFICA: '#A9BFE0', DEMO: '#A9BFE0' };

const $ = (/** @type {string} */ id) => /** @type {any} */ (document.getElementById(id));

const st = {
  /** @type {Tipo} */ tipo: 'tringla',
  /** @type {MediaStream|null} */ stream: null,
  /** @type {null|{img:Imagen, base:HTMLCanvasElement, via:'app'|'galeria'|'demo', bytes:Uint8Array|null, tomada:Date|null}} */ foto: null,
  /** @type {{x:number,y:number}[]} */ puntos: [],
  /** @type {'manual'|'detector'|'detector+manual'} */ origenPuntos: 'manual',
  /** @type {Resultado|null} */ res: null,
  /** @type {any} */ origen: null,
  demo: { tringla: 0, anaquel: 0, focal: 0 },
  anim: 0,
};

/* ── Escena: vacía, cámara o foto ───────────────────────────────────────── */

/** @param {'vacia'|'camara'|'foto'} modo */
function mostrar(modo) {
  $('rv-vacia').hidden = modo !== 'vacia';
  $('rv-video').hidden = modo !== 'camara';
  $('rv-lienzo').hidden = modo !== 'foto';
  $('rv-guia').hidden = modo !== 'camara';
  $('rv-ayuda').hidden = true;
  const d = $('rv-disparo');
  d.classList.toggle('vivo', modo === 'camara');
  d.setAttribute('aria-label', modo === 'camara' ? 'Tomar la foto' : 'Abrir la cámara');
}

/** La escena toma la forma de la foto, sin pasar de ~70 % del alto de la pantalla.
 * @param {number} w @param {number} h */
function proporcion(w, h) {
  const e = $('rv-escena');
  e.style.aspectRatio = `${w} / ${h}`;
  e.style.width = `min(100%, calc(70vh * ${(w / h).toFixed(4)}))`;
  e.style.marginInline = 'auto';
}

function ponerGuia() {
  const m = MARCOS[st.tipo], g = $('rv-guia');
  Object.assign(g.style, { left: m.x * 100 + '%', top: m.y * 100 + '%', width: m.w * 100 + '%', height: m.h * 100 + '%' });
  const f = $('rv-franja');
  f.hidden = st.tipo !== 'tringla';
  Object.assign(f.style, { top: '32%', height: '26%' });
  $('rv-guia-txt').textContent = TEXTOS[st.tipo].guia;
}

/** @param {string} msg @param {string} [tipo] */
function aviso(msg, tipo = 'info') {
  const t = /** @type {any} */ (globalThis).showToast;
  if (typeof t === 'function') t(msg, tipo); else console.warn(msg);
}

/* ── Cámara ─────────────────────────────────────────────────────────────── */

async function abrirCamara() {
  if (!navigator.mediaDevices?.getUserMedia) { aviso('Este navegador no da acceso a la cámara: usa Galería o un ejemplo.', 'warn'); return; }
  try {
    st.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } } });
  } catch (e) {
    const err = /** @type {any} */ (e);
    aviso(err?.name === 'NotAllowedError' ? 'Sin permiso de cámara: actívalo en el navegador o usa Galería.' : 'No se pudo abrir la cámara: ' + (err?.message || err), 'warn');
    return;
  }
  const v = $('rv-video');
  v.srcObject = st.stream;
  await v.play().catch(() => {});
  if (v.videoWidth) proporcion(v.videoWidth, v.videoHeight);
  ponerGuia();
  mostrar('camara');
}

function cerrarCamara() {
  st.stream?.getTracks().forEach(t => t.stop());
  st.stream = null;
  const v = $('rv-video');
  v.srcObject = null;
}

/** @template T @param {Promise<T>} p @param {number} ms @returns {Promise<T>} */
function conTope(p, ms) {
  return new Promise((ok, ko) => { const t = setTimeout(() => ko(new Error('tope')), ms); p.then(r => { clearTimeout(t); ok(r); }, e => { clearTimeout(t); ko(e); }); });
}

async function tomar() {
  const v = $('rv-video');
  const track = st.stream?.getVideoTracks()[0];
  /** @type {Blob|null} */
  let blob = null;
  /* La foto a resolución completa cuando el navegador la da; si tarda, el
     cuadro del video, que es justo lo que se vio en la guía. */
  const IC = /** @type {any} */ (globalThis).ImageCapture;
  if (IC && track) { try { blob = await conTope(new IC(track).takePhoto(), 2500); } catch { blob = null; } }
  if (!blob) {
    const c = document.createElement('canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    /** @type {CanvasRenderingContext2D} */ (c.getContext('2d')).drawImage(v, 0, 0);
    blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.92));
  }
  const tomada = new Date();
  cerrarCamara();
  if (blob) await cargarArchivo(blob, 'app', tomada);
}

/* ── Cargar y analizar ──────────────────────────────────────────────────── */

/** @param {CanvasImageSource & {width:number,height:number}} fuente @param {number} max
 * @param {number} [ancho] @param {number} [alto] medidas reales, si `fuente` no las trae */
function aLienzo(fuente, max, ancho = fuente.width, alto = fuente.height) {
  const f = Math.min(1, max / Math.max(ancho, alto));
  const c = document.createElement('canvas');
  c.width = Math.round(ancho * f); c.height = Math.round(alto * f);
  const ctx = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(fuente, 0, 0, c.width, c.height);
  return c;
}

/** @param {HTMLCanvasElement} c @returns {Imagen} */
function pixeles(c) {
  const ch = aLienzo(c, 640);
  return /** @type {CanvasRenderingContext2D} */ (ch.getContext('2d')).getImageData(0, 0, ch.width, ch.height);
}

/** Un error al cargar la foto que sabe en qué paso pasó y qué decirle a la persona. */
class ErrorFoto extends Error {
  /** @param {'archivo'|'formato'|'analisis'} paso @param {string} msg @param {unknown} [causa] */
  constructor(paso, msg, causa) { super(msg); this.paso = paso; this.causa = causa; }
}

/* Lado máximo que se decodifica: la foto de pantalla es de 1600 y el
   análisis de 640. Una de 50-200 MP no cabe en la memoria de un teléfono. */
const LADO_DECODIFICADO = 1600;

/**
 * Del archivo a un lienzo de ≤ 1600 px, con la orientación del EXIF. Primero
 * createImageBitmap (pidiéndola ya reducida cuando se sabe el tamaño); si el
 * navegador no puede, un <img>, que en algunos teléfonos sí abre HEIC.
 * @param {Blob} blob @param {Uint8Array} bytes @returns {Promise<HTMLCanvasElement>}
 */
async function decodificar(blob, bytes) {
  /* Una JPEG cortada se abre, pero con la parte de abajo gris: el surtido la
     leería como hueco. Mejor no revisarla. */
  if (!jpegCompleto(bytes))
    throw new ErrorFoto('formato', 'La foto está incompleta o dañada (se cortó al descargarla o al copiarla). Vuelve a descargarla o tómala de nuevo.');
  const dim = dimensiones(bytes);
  const f = dim ? Math.min(1, LADO_DECODIFICADO / Math.max(dim.width, dim.height)) : 1;
  /** @type {unknown[]} */
  const fallas = [];
  const intentos = [
    () => createImageBitmap(blob, f < 1 && dim
      ? { imageOrientation: 'from-image', resizeWidth: Math.round(dim.width * f), resizeHeight: Math.round(dim.height * f), resizeQuality: 'high' }
      : { imageOrientation: 'from-image' }),
    () => createImageBitmap(blob),
    async () => {
      const url = URL.createObjectURL(blob);
      try { const im = new Image(); im.src = url; await im.decode(); return im; }
      finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
    },
  ];
  for (const intento of intentos) {
    try {
      const fuente = await intento();
      const ancho = 'naturalWidth' in fuente ? fuente.naturalWidth : fuente.width, alto = 'naturalHeight' in fuente ? fuente.naturalHeight : fuente.height;
      if (!ancho || !alto) throw new Error('imagen vacía');
      const c = aLienzo(fuente, LADO_DECODIFICADO, ancho, alto);
      if ('close' in fuente) fuente.close();
      return c;
    } catch (e) { fallas.push(e); }
  }
  console.error('Revisar: no se pudo decodificar la foto', fallas);
  const fmt = formato(bytes);
  if (fmt === 'heic') throw new ErrorFoto('formato', 'La foto está en HEIC y este navegador no lo abre. En la cámara elige «Más compatible» (JPG), o mándatela por WhatsApp y súbela desde ahí.', fallas[0]);
  if (fmt === 'desconocido') throw new ErrorFoto('formato', `Ese archivo no parece una foto (${blob.type || 'tipo desconocido'}). Usa JPG o PNG.`, fallas[0]);
  throw new ErrorFoto('formato', `El navegador no pudo abrir esta ${fmt.toUpperCase()}${dim ? ` de ${dim.width}×${dim.height}` : ''}. Prueba con una captura de pantalla de la foto o bájale la resolución.`, fallas[0]);
}

/**
 * Del archivo a resultados, sin pantalla: lo usan la pestaña y eval/revision.mjs.
 * @param {Blob} blob @param {Tipo} tipo
 * @param {{via?:'app'|'galeria', tomada?:Date, puntos?:{x:number,y:number}[], marco?:Marco}} [op]
 *   `puntos` y `marco` en fracción del ancho y del alto de la foto.
 */
export async function analizarArchivo(blob, tipo, op = {}) {
  let bytes;
  try { bytes = new Uint8Array(await blob.arrayBuffer()); }
  catch (e) { throw new ErrorFoto('archivo', 'No se pudo abrir el archivo. Si la foto está solo en la nube, descárgala al teléfono primero.', e); }
  const base = await decodificar(blob, bytes);
  const img = pixeles(base);
  const h = await huella(bytes);
  const origen = veredictoOrigen({ via: op.via || 'galeria', meta: leerMetadatos(bytes), huella: h, bytes: bytes.length, tomada: op.tomada });
  let resultado;
  try { resultado = medir(img, tipo, op.puntos ? op.puntos.map(p => ({ x: p.x * img.width, y: p.y * img.height })) : null, op.marco); }
  catch (e) { console.error('Revisar: falló el análisis', e); throw new ErrorFoto('analisis', `La foto se abrió, pero falló el análisis (${/** @type {any} */ (e)?.message || e}). Avísale a Gerardo con esta foto.`, e); }
  return { bytes, base, img, origen, huella: h, resultado };
}

/** @param {Imagen} img @param {Tipo} tipo @param {{x:number,y:number}[]|null} [puntos] en píxeles de img
 * @param {Marco} [zona] el recuadro que marcó la persona, en fracción; si no, la guía de la cámara */
function medir(img, tipo, puntos = null, zona) {
  const m = zona || MARCOS[tipo];
  const marco = { x: m.x * img.width, y: m.y * img.height, w: m.w * img.width, h: m.h * img.height };
  if (tipo === 'tringla') return revisarColor(img, { marco });
  if (tipo === 'anaquel') return revisarSurtido(img, { marco });
  return puntos ? revisarTriangulo(puntos, img, { origen: st.origenPuntos }) : null;
}

/** @param {Blob} blob @param {'app'|'galeria'} via @param {Date|null} tomada */
async function cargarArchivo(blob, via, tomada) {
  try {
    const a = await analizarArchivo(blob, st.tipo, { via, tomada: tomada || undefined });
    st.foto = { img: a.img, base: a.base, via, bytes: a.bytes, tomada };
    st.origen = a.origen;
  } catch (e) {
    console.error('Revisar: no se pudo cargar la foto', e);
    aviso(e instanceof ErrorFoto ? e.message : `No se pudo leer esa imagen (${/** @type {any} */ (e)?.name || 'error'}: ${/** @type {any} */ (e)?.message || e}).`, 'warn');
    return;
  }
  st.puntos = []; st.origenPuntos = 'manual';
  empezarRevision();
}

/** @param {Imagen} imgDemo @param {{x:number,y:number}[]} [puntos] */
function cargarDemo(imgDemo, puntos) {
  const c = document.createElement('canvas');
  c.width = imgDemo.width; c.height = imgDemo.height;
  /** @type {CanvasRenderingContext2D} */ (c.getContext('2d')).putImageData(new ImageData(Uint8ClampedArray.from(imgDemo.data), imgDemo.width, imgDemo.height), 0, 0);
  st.foto = { img: pixeles(c), base: c, via: 'demo', bytes: null, tomada: null };
  st.origen = { basico: 'origen', nivel: 'DEMO', motivo: 'Imagen de ejemplo dibujada por la app: no hay origen que probar. Con una foto real aquí sale si se tomó en la app, si viene de galería o si declara IA.', evidencia: {}, fuente: 'CÓDIGO' };
  const k = st.foto.img.width / imgDemo.width;
  st.puntos = puntos ? puntos.map(p => ({ x: p.x * k, y: p.y * k })) : [];
  st.origenPuntos = 'manual';
  empezarRevision(!!puntos);
}

/** @param {boolean} [puntosListos] */
function empezarRevision(puntosListos = false) {
  const f = /** @type {NonNullable<typeof st.foto>} */ (st.foto);
  const lz = $('rv-lienzo');
  lz.width = f.base.width; lz.height = f.base.height;
  proporcion(f.base.width, f.base.height);
  mostrar('foto');
  if (st.tipo === 'focal' && !puntosListos) {
    st.res = null;
    modoTocar();
    dibujar(1);
    $('rv-res').innerHTML = '';
    return;
  }
  st.res = medir(f.img, st.tipo, st.puntos);
  animar(st.tipo === 'focal' ? 1100 : 900);
  pintarResultados();
}

/* ── Focal: tocar los puntos (plan B, ADR 0007) ─────────────────────────── */

function modoTocar() {
  $('rv-ayuda').hidden = false;
  actualizarAyuda();
}
function actualizarAyuda() {
  const n = st.puntos.length;
  $('rv-ayuda-t').textContent = st.origenPuntos !== 'manual'
    ? `${n} ${n === 1 ? 'punto sugerido' : 'puntos sugeridos'} · toca uno para quitarlo o donde falte para agregarlo`
    : n ? `${n} ${n === 1 ? 'punto' : 'puntos'} · toca lo más alto de cada elemento` : 'Toca lo más alto de cada elemento (maniquí, base, planta) o pide una sugerencia';
  $('rv-listo').disabled = n < 3;
  $('rv-deshacer').disabled = !n;
}

/* Plan A como sugerencia: el detector propone, la persona confirma. */
async function sugerir() {
  const f = st.foto, b = $('rv-sugerir');
  if (!f) return;
  b.disabled = true; b.textContent = 'Buscando…';
  try {
    const { detectar } = await import('./detector.js');
    const cajas = await detectar(f.base);
    const k = f.img.width / f.base.width;
    const ps = puntosDeCajas(cajas).map(p => ({ x: p.x * k, y: p.y * k }));
    if (!ps.length) aviso('El detector no encontró maniquíes ni objetos: toca los puntos a mano.', 'warn');
    else { st.puntos = ps; st.origenPuntos = 'detector'; }
    actualizarAyuda(); dibujar(1);
  } catch {
    aviso('No se pudo cargar el detector (la primera vez necesita señal). Toca los puntos a mano.', 'warn');
  } finally { b.disabled = false; b.textContent = 'Sugerir'; }
}

/** Coordenadas de un toque, en píxeles de la imagen analizada. @param {MouseEvent} e */
function aImagen(e) {
  const lz = $('rv-lienzo'), r = lz.getBoundingClientRect(), f = /** @type {NonNullable<typeof st.foto>} */ (st.foto);
  /* object-fit: contain puede dejar franjas: se calcula el área real. */
  const esc = Math.min(r.width / lz.width, r.height / lz.height);
  const w = lz.width * esc, h = lz.height * esc, ox = (r.width - w) / 2, oy = (r.height - h) / 2;
  const x = (e.clientX - r.left - ox) / w, y = (e.clientY - r.top - oy) / h;
  if (x < 0 || y < 0 || x > 1 || y > 1) return null;
  return { x: x * f.img.width, y: y * f.img.height };
}

/* ── Dibujo sobre la foto ───────────────────────────────────────────────── */

/** @param {number} ms */
function animar(ms) {
  const t0 = performance.now(), id = ++st.anim;
  const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const paso = (/** @type {number} */ t) => {
    if (id !== st.anim) return;
    const p = reducido ? 1 : Math.min(1, (t - t0) / ms);
    dibujar(p);
    if (p < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

/** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} w @param {number} h @param {number} r */
function redondo(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
}

/** Etiqueta tipo píldora. @param {CanvasRenderingContext2D} ctx @param {string} txt @param {number} x @param {number} y @param {string} fondo @param {number} u @param {string} [color] */
function pildora(ctx, txt, x, y, fondo, u, color = '#fff') {
  ctx.font = `600 ${Math.round(12.5 * u)}px Geist, system-ui, sans-serif`;
  const w = ctx.measureText(txt).width + 16 * u, h = 22 * u;
  const px = Math.max(4 * u, Math.min(ctx.canvas.width - w - 4 * u, x - w / 2));
  redondo(ctx, px, y - h / 2, w, h, h / 2);
  ctx.fillStyle = fondo; ctx.fill();
  ctx.fillStyle = color; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.fillText(txt, px + 8 * u, y + 0.5 * u);
}

const ease = (/** @type {number} */ t) => 1 - (1 - t) ** 3;

/** @param {number} p progreso de la animación, 0 a 1 */
function dibujar(p) {
  const f = st.foto;
  if (!f) return;
  const lz = $('rv-lienzo'), ctx = /** @type {CanvasRenderingContext2D} */ (lz.getContext('2d'));
  ctx.clearRect(0, 0, lz.width, lz.height);
  ctx.drawImage(f.base, 0, 0);
  /* u: tamaño de las marcas. Se ven en un teléfono a ~400 px de ancho, así
     que se escalan contra eso y no contra la resolución de la foto. */
  const k = lz.width / f.img.width, u = lz.width / 400, e = ease(p);
  const r = st.res;
  if (st.tipo === 'focal') return dibujarFocal(ctx, k, u, e, r);
  if (!r || !r.marcas) return;
  if (r.basico === 'colorizacion') dibujarColor(ctx, r, k, u, e, p);
  else if (r.basico === 'surtido') dibujarSurtido(ctx, r, k, u, e);
}

/** @param {CanvasRenderingContext2D} ctx @param {Resultado} r @param {number} k @param {number} u @param {number} e @param {number} p */
function dibujarColor(ctx, r, k, u, e, p) {
  const { franja, tramos } = r.marcas;
  if (!franja) return;
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const y0 = franja.y * k, y1 = (franja.y + franja.h) * k;
  /* Lo que no se mide, apagado. */
  ctx.fillStyle = `rgba(0,0,0,${0.42 * e})`;
  ctx.fillRect(0, 0, W, y0); ctx.fillRect(0, y1, W, H - y1);
  ctx.setLineDash([7 * u, 6 * u]); ctx.lineWidth = 1.6 * u; ctx.strokeStyle = 'rgba(255,255,255,.85)';
  ctx.strokeRect(franja.x * k, y0, franja.w * k, y1 - y0);
  ctx.setLineDash([]);
  if (!tramos) return;
  const n = tramos.length, visibles = Math.ceil(e * n);
  const by = y1 + 8 * u, bh = 16 * u;
  tramos.slice(0, visibles).forEach((/** @type {any} */ t, /** @type {number} */ i) => {
    const x0 = t.x0 * k + 1.5 * u, x1 = t.x1 * k - 1.5 * u;
    redondo(ctx, x0, by, Math.max(2, x1 - x0), bh, 5 * u);
    ctx.fillStyle = t.rgb; ctx.fill();
    ctx.lineWidth = 1.5 * u; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.95)';
    ctx.font = `700 ${Math.round(10 * u)}px Geist Mono, ui-monospace, monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    if (x1 - x0 > 14 * u) ctx.fillText(NOMBRE_GRUPO[/** @type {'calido'} */ (t.grupo)][0].toUpperCase(), (x0 + x1) / 2, by + bh + 4 * u);
    if (t.fueraGrupo || t.fueraRueda) {
      const grave = t.fueraGrupo, pulso = p < 1 ? 1 + 0.6 * Math.sin(p * Math.PI * 4) ** 2 : 1;
      ctx.lineWidth = (grave ? 3.2 : 2.4) * u * pulso;
      ctx.strokeStyle = grave ? COLOR_NIVEL.GRAVE : COLOR_NIVEL['OBSERVACIÓN'];
      if (!grave) ctx.setLineDash([6 * u, 4 * u]);
      redondo(ctx, x0 - 3 * u, y0 - 6 * u, x1 - x0 + 6 * u, by + bh - y0 + 10 * u, 8 * u);
      ctx.stroke(); ctx.setLineDash([]);
      pildora(ctx, `tramo ${i + 1} · ${NOMBRE_GRUPO[/** @type {'calido'} */ (t.grupo)]}`, (x0 + x1) / 2, y0 - 20 * u, grave ? COLOR_NIVEL.GRAVE : COLOR_NIVEL['OBSERVACIÓN'], u, grave ? '#fff' : '#2A1A00');
    }
  });
}

/** @param {CanvasRenderingContext2D} ctx @param {Resultado} r @param {number} k @param {number} u @param {number} e */
function dibujarSurtido(ctx, r, k, u, e) {
  const { marco, huecos } = r.marcas;
  ctx.setLineDash([7 * u, 6 * u]); ctx.lineWidth = 1.4 * u; ctx.strokeStyle = 'rgba(255,255,255,.7)';
  ctx.strokeRect(marco.x * k, marco.y * k, marco.w * k, marco.h * k);
  ctx.setLineDash([]);
  if (!huecos) return;
  for (const h of huecos) {
    const llave = new Set(h.map((/** @type {any} */ c) => `${c.x},${c.y}`));
    for (const c of h) {
      const x = c.x * k, y = c.y * k, w = c.w * k, hh = c.h * k;
      ctx.fillStyle = `rgba(255,77,94,${0.34 * e})`;
      ctx.fillRect(x, y, w, hh);
      /* Rayado, para que se lea aunque el mueble sea rojo. */
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, hh); ctx.clip();
      ctx.strokeStyle = `rgba(255,255,255,${0.35 * e})`; ctx.lineWidth = 1.2 * u;
      for (let d = -hh; d < w; d += 9 * u) { ctx.beginPath(); ctx.moveTo(x + d, y + hh); ctx.lineTo(x + d + hh, y); ctx.stroke(); }
      ctx.restore();
      /* El contorno del hueco: solo los bordes que no comparte con otra celda. */
      ctx.strokeStyle = COLOR_NIVEL.GRAVE; ctx.lineWidth = 2.6 * u;
      const lado = (/** @type {number} */ x0, /** @type {number} */ y0, /** @type {number} */ x1, /** @type {number} */ y1) => { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + (x1 - x0) * e, y0 + (y1 - y0) * e); ctx.stroke(); };
      const hay = (/** @type {number} */ dx, /** @type {number} */ dy) => [...llave].some(s => { const [a, b] = s.split(',').map(Number); return Math.abs(a - (c.x + dx * c.w)) <= 2 && Math.abs(b - (c.y + dy * c.h)) <= 2; });
      if (!hay(0, -1)) lado(x, y, x + w, y);
      if (!hay(0, 1)) lado(x, y + hh, x + w, y + hh);
      if (!hay(-1, 0)) lado(x, y, x, y + hh);
      if (!hay(1, 0)) lado(x + w, y, x + w, y + hh);
    }
  }
  if (huecos.length && e > 0.6) {
    const h = huecos[0], cx = h.reduce((/** @type {number} */ s, /** @type {any} */ c) => s + c.x + c.w / 2, 0) / h.length * k;
    const cy = Math.min(...h.map((/** @type {any} */ c) => c.y)) * k;
    pildora(ctx, `hueco · ${r.evidencia.hueco_mayor_pct} %`, cx, Math.max(14 * u, cy - 14 * u), COLOR_NIVEL.GRAVE, u);
  }
}

/** @param {CanvasRenderingContext2D} ctx @param {number} k @param {number} u @param {number} e @param {Resultado|null} r */
function dibujarFocal(ctx, k, u, e, r) {
  const tri = r?.marcas?.triangulo;
  if (tri) {
    const pts = tri.map((/** @type {any} */ q) => ({ x: q.x * k, y: q.y * k }));
    const largo = pts.reduce((s, q, i) => s + Math.hypot(q.x - pts[(i + 1) % 3].x, q.y - pts[(i + 1) % 3].y), 0);
    ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.closePath();
    ctx.fillStyle = `rgba(255,90,110,${0.16 * e})`; ctx.fill();
    ctx.setLineDash([largo * e, largo]); ctx.lineWidth = 3 * u;
    ctx.strokeStyle = COLOR_NIVEL[/** @type {'CUMPLE'} */ (r.nivel)] || '#fff'; ctx.stroke();
    ctx.setLineDash([]);
  } else if (r?.marcas?.puntos && r.nivel === 'GRAVE') {
    /* Sin triángulo: la línea de las alturas, para que se vea por qué. */
    const ps = r.marcas.puntos;
    ctx.beginPath(); ps.forEach((/** @type {any} */ q, /** @type {number} */ i) => (i ? ctx.lineTo(q.x * k, q.y * k) : ctx.moveTo(q.x * k, q.y * k)));
    ctx.setLineDash([8 * u, 6 * u]); ctx.lineWidth = 2.6 * u; ctx.strokeStyle = COLOR_NIVEL.GRAVE; ctx.globalAlpha = e; ctx.stroke(); ctx.globalAlpha = 1; ctx.setLineDash([]);
  }
  const ps = r?.marcas?.puntos || st.puntos.slice().sort((a, b) => a.x - b.x);
  ps.forEach((/** @type {any} */ q, /** @type {number} */ i) => {
    const s = Math.min(1, e * ps.length - i * 0.6);
    if (s <= 0) return;
    const x = q.x * k, y = q.y * k, rad = 8 * u * (0.6 + 0.4 * s);
    ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.lineWidth = 2.4 * u; ctx.strokeStyle = "#FF5A6E"; ctx.stroke();
    ctx.fillStyle = '#16171B'; ctx.font = `700 ${Math.round(9 * u)}px Geist Mono, ui-monospace, monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(i + 1), x, y + 0.5 * u);
  });
  if (r?.marcas?.cima && e > 0.7) {
    const cy = r.marcas.cima.y * k;
    pildora(ctx, `cima · ${r.evidencia.cima_pos_pct} %`, r.marcas.cima.x * k, cy - 26 * u > 14 * u ? cy - 26 * u : cy + 26 * u, '#16171B', u);
  }
}

/* ── Resultados ─────────────────────────────────────────────────────────── */

/** @param {string} s */
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] || c);

const ICONO_ORIGEN = '<svg class="ico" viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/></svg>';
const ICONO_COMPARTIR = '<svg class="ico" viewBox="0 0 24 24"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/></svg>';

/** La cifra grande de cada básico. @param {Resultado} r */
function cifra(r) {
  const ev = r.evidencia;
  if (r.nivel === 'NO_CALIFICA') return { n: null, de: '', txt: 'no se puede calificar con esta foto' };
  if (r.basico === 'colorizacion') {
    if (r.nivel === 'GRAVE') return { n: Number(ev.fuera_de_grupo), de: `/${ev.tramos}`, txt: 'tramos rompen el orden de color' };
    if (r.nivel === 'OBSERVACIÓN') return { n: Number(ev.fuera_de_rueda), de: `/${ev.tramos}`, txt: 'tramos fuera de la rueda en su grupo' };
    return { n: Number(ev.tramos), de: '', txt: 'tramos de color, todos en orden' };
  }
  if (r.basico === 'surtido') return { n: Number(ev.vacio_pct), de: '%', txt: `del mueble vacío${ev.huecos ? ` · ${ev.huecos} ${ev.huecos === 1 ? 'hueco' : 'huecos'}` : ''}` };
  if (r.basico === 'triangulacion') {
    if (r.nivel === 'GRAVE' && Number(ev.desnivel_pct) < 12) return { n: Number(ev.desnivel_pct), de: '%', txt: 'de desnivel (se pide 12 % o más)' };
    return { n: Number(ev.cima_pos_pct), de: '%', txt: 'posición de la cima (50 % es el centro)' };
  }
  return { n: null, de: '', txt: '' };
}

/** @param {HTMLElement} el @param {number} fin */
function contar(el, fin) {
  const dec = Number.isInteger(fin) ? 0 : 1, t0 = performance.now();
  const paso = (/** @type {number} */ t) => {
    const p = Math.min(1, (t - t0) / 700);
    el.textContent = (fin * ease(p)).toFixed(dec);
    if (p < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

/** @param {Record<string, any>} ev */
function chips(ev) {
  return Object.entries(ev).filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `<span>${esc(k.replace(/_pct$/, ' %').replace(/_/g, ' '))} ${esc(v === true ? 'sí' : v === false ? 'no' : String(v))}</span>`).join('');
}

/** @param {any} o @param {string} [titulo] */
function tarjetaOrigen(o, titulo = 'Origen de la foto') {
  const ev = o.evidencia || {};
  const pie = ev.huella ? `<div class="rv-huella">SHA-256 ${esc(ev.huella)}… · ${Math.round(ev.bytes / 1024)} KB${ev.c2pa ? ` · C2PA ${esc(ev.c2pa)} (firma sin validar)` : ''}${ev.iptc ? ` · IPTC ${esc(ev.iptc)}` : ''}</div>` : '';
  return `<div class="rv-origen" data-n="${esc(o.nivel)}">${ICONO_ORIGEN}<div class="rv-origen-t">${esc(titulo)}<b>${esc(o.nivel === 'DEMO' ? 'EJEMPLO' : o.nivel)}</b></div><p>${esc(o.motivo)}</p>${pie}</div>`;
}

function pintarResultados() {
  const caja = $('rv-res');
  const r = st.res;
  if (!r) { caja.innerHTML = ''; return; }
  const c = cifra(r);
  const nombre = TEXTOS[st.tipo].basico;
  caja.innerHTML = `
    <div class="rv-ver" data-n="${esc(r.nivel)}">
      <div class="rv-ver-top"><span class="rv-basico">${esc(nombre)}</span><span class="rv-nivel"><i></i>${esc(r.nivel)}</span></div>
      <div class="rv-cifra-fila"><span class="rv-cifra"><b id="rv-num">${c.n === null ? '—' : '0'}</b><small>${esc(c.de)}</small></span><span class="rv-cifra-txt">${esc(c.txt)}</span></div>
      <p class="rv-motivo">${esc(r.motivo)}</p>
      <div class="rv-ev">${chips(r.evidencia)}</div>
      <div class="rv-fuente">fuente: CÓDIGO · medido en este teléfono · sin IA</div>
    </div>
    ${st.origen ? tarjetaOrigen(st.origen) : ''}
    <div class="rv-lista"><h3>Lo que no se ve en una foto</h3><p>Se revisa a mano; la app no lo adivina.</p>
      ${MANUAL.map(m => `<label><input type="checkbox"> ${esc(m)}</label>`).join('')}</div>
    <button class="rv-compartir" id="rv-compartir" type="button">${ICONO_COMPARTIR}Compartir la revisión</button>
    <p class="rv-nota">Se comparte la foto marcada y el resumen con la huella de la foto original.</p>`;
  if (c.n !== null) contar($('rv-num'), c.n);
  /* Primero se ven las marcas sobre la foto; luego la cifra sube a la vista. */
  setTimeout(() => {
    const v = caja.querySelector('.rv-cifra-fila');
    const r = v?.getBoundingClientRect();
    if (r && r.bottom > innerHeight - 90) v.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
  }, 950);
  $('rv-compartir').onclick = compartir;
}

/* ── Compartir ──────────────────────────────────────────────────────────── */

function resumenTexto() {
  const r = st.res, o = st.origen;
  const l = ['Revisión con foto · Asistente de Piso'];
  if (r) l.push(`${TEXTOS[st.tipo].basico}: ${r.nivel}. ${r.motivo}`);
  if (o) l.push(`Origen: ${o.nivel === 'DEMO' ? 'imagen de ejemplo' : o.nivel}. ${o.motivo}`);
  if (o?.evidencia?.huella) l.push(`Huella SHA-256 de la foto original: ${o.evidencia.huella}…`);
  l.push('Medido por código en el teléfono, sin IA.');
  return l.join('\n');
}

/** La foto marcada con una franja de texto abajo. */
function reporte() {
  const lz = $('rv-lienzo');
  dibujar(1);
  const u = lz.width / 400, ancho = lz.width - 28 * u;
  const medir = /** @type {CanvasRenderingContext2D} */ (document.createElement('canvas').getContext('2d'));
  /* Cada línea del resumen se acomoda en renglones del ancho de la foto. */
  /** @type {{t:string, titulo:boolean}[]} */
  const renglones = [];
  resumenTexto().split('\n').forEach((t, i) => {
    medir.font = `${i ? 500 : 700} ${Math.round((i ? 12.5 : 14) * u)}px Geist, system-ui, sans-serif`;
    let r = '';
    for (const pal of t.split(' ')) {
      const prueba = r ? r + ' ' + pal : pal;
      if (r && medir.measureText(prueba).width > ancho) { renglones.push({ t: r, titulo: !i }); r = pal; }
      else r = prueba;
    }
    renglones.push({ t: r, titulo: !i });
  });
  const c = document.createElement('canvas');
  const alto = Math.round((30 + renglones.length * 20) * u);
  c.width = lz.width; c.height = lz.height + alto;
  const ctx = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  ctx.drawImage(lz, 0, 0);
  ctx.fillStyle = '#111217'; ctx.fillRect(0, lz.height, c.width, alto);
  ctx.fillStyle = COLOR_NIVEL[/** @type {'CUMPLE'} */ (st.res?.nivel || 'NO_CALIFICA')];
  ctx.fillRect(0, lz.height, c.width, 4 * u);
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  renglones.forEach((r, i) => {
    ctx.font = `${r.titulo ? 700 : 500} ${Math.round((r.titulo ? 14 : 12.5) * u)}px Geist, system-ui, sans-serif`;
    ctx.fillStyle = r.titulo ? '#F4F2F0' : '#C9C6CE';
    ctx.fillText(r.t, 14 * u, lz.height + (16 + i * 20) * u);
  });
  return c;
}

async function compartir() {
  const c = reporte();
  const blob = /** @type {Blob} */ (await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9)));
  const texto = resumenTexto();
  const d = new Date(), f2 = (/** @type {number} */ n) => String(n).padStart(2, '0');
  const nombre = `revision-${st.tipo}-${d.getFullYear()}-${f2(d.getMonth() + 1)}-${f2(d.getDate())}-${f2(d.getHours())}${f2(d.getMinutes())}.jpg`;
  const archivo = new File([blob], nombre, { type: 'image/jpeg' });
  const nav = /** @type {any} */ (navigator);
  if (nav.canShare?.({ files: [archivo] })) {
    try { await nav.share({ files: [archivo], text: texto, title: 'Revisión con foto' }); return; }
    catch (e) { if (/** @type {any} */ (e)?.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = nombre; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  try { await navigator.clipboard.writeText(texto); aviso('Se descargó la foto marcada y el resumen quedó copiado.'); }
  catch { aviso('Se descargó la foto marcada.'); }
}

/* ── Ejemplos (modo demo, sin cámara) ───────────────────────────────────── */

const EJEMPLOS = {
  tringla: [
    () => tringla([P.calido[0], P.calido[1], P.calido[2], P.frio[2], P.calido[3], P.calido[4], P.frio[0], P.frio[1], P.frio[3], P.neutro[2], P.neutro[3], P.neutro[4]], { w: 960, h: 720, semilla: 4, ruido: 5, sombra: 0.2 }),
    () => tringla([P.calido[0], P.calido[1], P.calido[2], P.calido[3], P.frio[0], P.frio[1], P.frio[2], P.frio[3], P.neutro[0], P.neutro[2], P.neutro[3], P.neutro[4]], { w: 960, h: 720, semilla: 6, ruido: 5, sombra: 0.2 }),
  ],
  anaquel: [
    () => anaquel({ w: 960, h: 720, semilla: 8, ruido: 5, sombra: 0.15, huecos: [[0, 3], [0, 4], [2, 1]] }),
    () => anaquel({ w: 960, h: 720, semilla: 9, ruido: 5, sombra: 0.15 }),
  ],
  focal: [
    () => focal([0.42, 0.6, 0.82, 0.58, 0.4], { w: 960, h: 720, semilla: 3, ruido: 4 }),
    () => focal([0.8, 0.66, 0.52, 0.4], { w: 960, h: 720, semilla: 5, ruido: 4 }),
  ],
};

function ejemplo() {
  cerrarCamara();
  const lista = EJEMPLOS[st.tipo], i = st.demo[st.tipo] % lista.length;
  st.demo[st.tipo]++;
  const g = lista[i]();
  if ('img' in g) cargarDemo(g.img, g.puntos); else cargarDemo(g);
}

/** Muestras armadas para enseñar cómo se lee el origen. @param {string} cual */
async function muestraOrigen(cual) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 48;
  const ctx = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  const g = ctx.createLinearGradient(0, 0, 64, 48); g.addColorStop(0, '#FF5A6E'); g.addColorStop(1, '#1F5FD6');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 48);
  const jpeg = new Uint8Array(await /** @type {Blob} */ (await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9))).arrayBuffer());
  const hace = new Date(Date.now() - 50 * 60000);
  const f2 = (/** @type {number} */ n) => String(n).padStart(2, '0');
  const fecha = `${hace.getFullYear()}:${f2(hace.getMonth() + 1)}:${f2(hace.getDate())} ${f2(hace.getHours())}:${f2(hace.getMinutes())}:00`;
  const bytes = cual === 'camara' ? conMetadatos(jpeg, { exif: exifMuestra({ marca: 'Marca', modelo: 'Teléfono de muestra', software: 'HDR+ 1.0', fechaOriginal: fecha }) })
    : cual === 'ia' ? conMetadatos(jpeg, { xmp: xmpMuestra('trainedAlgorithmicMedia'), c2pa: c2paMuestra('trainedAlgorithmicMedia') })
    : jpeg;
  const o = veredictoOrigen({ via: 'galeria', meta: leerMetadatos(bytes), huella: await huella(bytes), bytes: bytes.length });
  const titulo = { camara: 'Muestra · foto de cámara', whatsapp: 'Muestra · reenviada por WhatsApp', ia: 'Muestra · hecha con IA' }[cual] || 'Muestra';
  $('rv-res').innerHTML = tarjetaOrigen(o, titulo) +
    '<p class="rv-nota">Muestra armada en la app con metadatos de ejemplo. No se adivina con un detector: se lee lo que la foto declara. Un GRAVE solo sale si la propia foto dice que es IA.</p>';
}

/* ── Arranque ───────────────────────────────────────────────────────────── */

/** @param {Tipo} t */
function elegirTipo(t) {
  st.tipo = t;
  document.querySelectorAll('.rv-tipo').forEach(b => {
    const on = /** @type {HTMLElement} */ (b).dataset.tipo === t;
    b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on));
  });
  $('rv-vacia-t').textContent = TEXTOS[t].vacia;
  if (st.stream) ponerGuia();
  else if (st.foto && st.foto.via !== 'demo') { st.puntos = []; empezarRevision(); }
  else { st.foto = null; st.res = null; $('rv-res').innerHTML = ''; proporcion(4, 3); mostrar('vacia'); }
}

function iniciar() {
  if (!$('rv')) return;
  document.querySelectorAll('.rv-tipo').forEach(b => b.addEventListener('click', () => elegirTipo(/** @type {Tipo} */ (/** @type {HTMLElement} */ (b).dataset.tipo))));
  $('rv-disparo').addEventListener('click', () => (st.stream ? tomar() : abrirCamara()));
  $('rv-galeria').addEventListener('click', () => $('rv-archivo').click());
  $('rv-archivo').addEventListener('change', (/** @type {Event} */ e) => {
    const inp = /** @type {HTMLInputElement} */ (e.target), f = inp.files?.[0];
    inp.value = '';
    if (f) { cerrarCamara(); cargarArchivo(f, 'galeria', null); }
  });
  $('rv-demo').addEventListener('click', ejemplo);
  document.querySelectorAll('[data-muestra]').forEach(b => b.addEventListener('click', () => muestraOrigen(/** @type {string} */ (/** @type {HTMLElement} */ (b).dataset.muestra))));
  $('rv-lienzo').addEventListener('click', (/** @type {MouseEvent} */ e) => {
    if (st.tipo !== 'focal' || st.res || !st.foto) return;
    const q = aImagen(e);
    if (!q) return;
    /* Tocar un punto lo quita (para corregir lo que sugirió el detector);
       tocar en otro lado agrega uno. */
    const lz = $('rv-lienzo'), cerca = 22 * st.foto.img.width / lz.getBoundingClientRect().width;
    const i = st.puntos.findIndex(p => Math.hypot(p.x - q.x, p.y - q.y) < cerca);
    if (i >= 0) st.puntos.splice(i, 1);
    else if (st.puntos.length < 9) st.puntos.push(q);
    if (st.origenPuntos === 'detector') st.origenPuntos = 'detector+manual';
    actualizarAyuda(); dibujar(1);
  });
  $('rv-sugerir').addEventListener('click', sugerir);
  $('rv-deshacer').addEventListener('click', () => { st.puntos.pop(); actualizarAyuda(); dibujar(1); });
  $('rv-listo').addEventListener('click', () => { $('rv-ayuda').hidden = true; empezarRevision(true); });
  /* La cámara no se queda prendida en otra pestaña. */
  document.querySelector('.tabs')?.addEventListener('click', () => setTimeout(() => {
    if (!$('panel-revisar').classList.contains('active')) { cerrarCamara(); if (!st.foto) mostrar('vacia'); else mostrar('foto'); }
  }, 0));
  proporcion(4, 3);
}

iniciar();

/* Para eval/revision.mjs: el mismo código que corre en el teléfono. */
/** @type {any} */ (globalThis).__revision = { analizarArchivo, MARCOS, peor, puntosDeCajas };
