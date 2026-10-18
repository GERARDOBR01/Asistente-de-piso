// Asistente de Piso · Copyright (c) 2026 Gerardo Barrera.
// Licencia PolyForm Noncommercial 1.0.0: uso comercial solo con licencia escrita (LICENCIA-COMERCIAL.md).
//
// Pestaña «Revisar» (ADR 0007): la escena (cámara, galería y ejemplos), los
// toques del focal y el arranque. Una foto puede tener varias zonas (la mesa,
// la tringla y el focal de una foto de área), cada una con su básico.
// La pantalla está en cinco piezas que tocan el DOM: esta, comun.js (estado y
// textos), zonas.js, dibujo.js (lo que va sobre la foto) y reporte.js
// (tarjetas y compartir). Las mediciones viven en los módulos puros.

import { peor } from './veredicto.js';
import { cuandoEnFrase } from './registro.js';
import { leerMetadatos, huella, veredictoOrigen, dimensiones, formato, jpegCompleto, interpretarC2pa } from './procedencia.js';
import { puntosDeCajas } from './triangulo.js';
import { MOTIVO_FUERA } from './sugerir.js';
import { tringla, anaquel, focal, PALETA as P, conMetadatos, exifMuestra, c2paMuestra, xmpMuestra } from './demo.js';
import { MARCOS, TEXTOS, $, st, mostrar, proporcion, aviso, conTope, activa, vibrar, marcarTipo, aImagen, aLienzo, pixeles } from './comun.js';
import { pedirSensor, empezarToma, pararToma } from './guia.js';
import { engancharAnotar } from './anotar.js';
import { iniciarHistorial, revisionNueva, marcarGuardada, ponerArea, ponerMiniActual, pintarArea, rondaElegida, imagenDeRonda } from './historial.js';
import { girar, animar, dibujar } from './dibujo.js';
import { medirTodo, medirZona, empezarRevision, empezarConZonas, tocarZona, pintarZonas, empezarDibujo, terminarDibujo, empezarAjuste, cambiarTipo, engancharAjuste } from './zonas.js';
import { tarjetaOrigen, pintarResultados, reporteParaCompartir, ponerRevisado, selloActual } from './reporte.js';

/** @typedef {import('./veredicto.js').Imagen} Imagen */
/** @typedef {import('./comun.js').Tipo} Tipo */
/** @typedef {import('./comun.js').Marco} Marco */
/** @typedef {import('./comun.js').PuntoFocal} PuntoFocal */
/** @typedef {import('./zonas.js').Zona} Zona */

function ponerGuia() {
  const m = MARCOS[st.tipo], g = $('rv-guia');
  Object.assign(g.style, { left: m.x * 100 + '%', top: m.y * 100 + '%', width: m.w * 100 + '%', height: m.h * 100 + '%' });
  const f = $('rv-franja');
  f.hidden = st.tipo !== 'tringla';
  Object.assign(f.style, { top: '32%', height: '26%' });
  $('rv-guia-txt').textContent = TEXTOS[st.tipo].guia;
}

/* ── Cámara ─────────────────────────────────────────────────────────────── */

async function abrirCamara() {
  if (!navigator.mediaDevices?.getUserMedia) { aviso('Este navegador no da acceso a la cámara: usa Galería o un ejemplo.', 'warn'); return; }
  pedirSensor();
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
  empezarToma();
}

function cerrarCamara() {
  pararToma();
  st.stream?.getTracks().forEach(t => t.stop());
  st.stream = null;
  const v = $('rv-video');
  v.srcObject = null;
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
 * Si la foto trae credencial C2PA, la lee y valida con el SDK oficial. Sin
 * señal la primera vez (o si no se puede leer), null: el origen lo dice y no
 * acusa a nadie por una palabra en los bytes.
 * @param {Blob} blob @param {import('./procedencia.js').Metadatos} meta @param {string} [anclas] solo para pruebas
 */
async function credencialDe(blob, meta, anclas) {
  if (!meta.c2pa.presente) return null;
  try {
    const { leerCredencial } = await import('./c2pa.js');
    return interpretarC2pa(await conTope(leerCredencial(blob, meta.formato, { anclas }), 15000));
  } catch (e) {
    console.warn('Revisar: no se pudo leer la credencial C2PA', e);
    return null;
  }
}

/**
 * Del archivo a resultados, sin pantalla: lo usan la pestaña y eval/revision.mjs.
 * @param {Blob} blob @param {Tipo} tipo
 * @param {{via?:'app'|'galeria', tomada?:Date, puntos?:{x:number,y:number}[], marco?:Marco, excluir?:Marco[], vestidos?:boolean, anclasC2pa?:string}} [op]
 *   `puntos`, `marco` y `excluir` en fracción del ancho y del alto de la foto.
 */
export async function analizarArchivo(blob, tipo, op = {}) {
  let bytes;
  try { bytes = new Uint8Array(await blob.arrayBuffer()); }
  catch (e) { throw new ErrorFoto('archivo', 'No se pudo abrir el archivo. Si la foto está solo en la nube, descárgala al teléfono primero.', e); }
  const base = await decodificar(blob, bytes);
  const img = pixeles(base);
  const h = await huella(bytes);
  const meta = leerMetadatos(bytes);
  const origen = veredictoOrigen({ via: op.via || 'galeria', meta, huella: h, bytes: bytes.length, tomada: op.tomada, credencial: await credencialDe(blob, meta, op.anclasC2pa) });
  let resultados;
  try { resultados = medirTodo(img, tipo, op.puntos ? op.puntos.map(p => ({ x: p.x * img.width, y: p.y * img.height })) : null, op.marco, 'manual', { excluir: op.excluir, vestidos: op.vestidos }); }
  catch (e) { console.error('Revisar: falló el análisis', e); throw new ErrorFoto('analisis', `La foto se abrió, pero falló el análisis (${/** @type {any} */ (e)?.message || e}). Avísale a Gerardo con esta foto.`, e); }
  return { bytes, base, img, origen, huella: h, resultado: resultados[0] || null, resultados };
}

/** @param {Blob} blob @param {'app'|'galeria'} via @param {Date|null} tomada */
async function cargarArchivo(blob, via, tomada) {
  try {
    const a = await analizarArchivo(blob, st.tipo, { via, tomada: tomada || undefined });
    const rep = st.repetir;
    revisionNueva();
    st.foto = { img: a.img, base: a.base, via, bytes: a.bytes, tomada };
    if (rep) {
      /* La foto de «Volver a revisar»: mismas zonas, misma área, y se compara con la de antes. */
      st.repetir = null;
      st.antes = { id: rep.id, zonas: rep.zonas, miniatura: rep.miniatura || null, creada: rep.creada };
      ponerArea(rep.area);
      st.origen = a.origen;
      st.synthid = null; st.synthidAbierto = false; st.puntosDemo = [];
      pintarRepetir();
      empezarConZonas(rep.zonas, rep.tam || { w: a.img.width, h: a.img.height });
      return;
    }
    st.origen = a.origen;
    st.synthid = null; st.synthidAbierto = false;
  } catch (e) {
    console.error('Revisar: no se pudo cargar la foto', e);
    aviso(e instanceof ErrorFoto ? e.message : `No se pudo leer esa imagen (${/** @type {any} */ (e)?.name || 'error'}: ${/** @type {any} */ (e)?.message || e}).`, 'warn');
    return;
  }
  st.puntosDemo = [];
  empezarRevision();
}

/** @param {Imagen} imgDemo @param {{x:number,y:number}[]} [puntos] */
function cargarDemo(imgDemo, puntos) {
  const c = document.createElement('canvas');
  c.width = imgDemo.width; c.height = imgDemo.height;
  /** @type {CanvasRenderingContext2D} */ (c.getContext('2d')).putImageData(new ImageData(Uint8ClampedArray.from(imgDemo.data), imgDemo.width, imgDemo.height), 0, 0);
  revisionNueva();
  st.repetir = null; pintarRepetir();
  st.foto = { img: pixeles(c), base: c, via: 'demo', bytes: null, tomada: null };
  st.synthid = null; st.synthidAbierto = false;
  st.origen = { basico: 'origen', nivel: 'DEMO', motivo: 'Imagen de ejemplo dibujada por la app: no hay origen que probar. Con una foto real aquí sale si se tomó en la app, si viene de galería o si declara IA.', evidencia: {}, fuente: 'CÓDIGO' };
  const k = st.foto.img.width / imgDemo.width;
  st.puntosDemo = puntos ? puntos.map(p => ({ x: p.x * k, y: p.y * k })) : [];
  empezarRevision(!!puntos);
}

/** Deja la pestaña como recién abierta, lista para otra foto, sin recargar. */
export function nuevaRevision() {
  revisionNueva();
  st.repetir = null; pintarRepetir();
  cerrarCamara();
  st.foto = null; st.zonas = []; st.activa = -1; st.modo = 'ver'; st.trazo = null; st.ajuste = null;
  st.origen = null; st.synthid = null; st.synthidAbierto = false; st.puntosDemo = [];
  st.exacto = false; st.buscando = false;
  $('rv-ayuda').hidden = true; $('rv-anotar').hidden = true;
  $('rv-res').innerHTML = '';
  proporcion(4, 3); mostrar('vacia'); pintarZonas();
  $('rv-escena').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
}

/* ── Focal: tocar los puntos (plan B, ADR 0007) ─────────────────────────── */

export function actualizarAyuda() {
  const z = activa();
  if (!z) return;
  const n = z.puntos.length;
  $('rv-ayuda-t').textContent = z.nota ? z.nota + ' · toca un punto para quitarlo'
    : z.origenPuntos.startsWith('detector')
    ? `${n} ${n === 1 ? 'punto sugerido' : 'puntos sugeridos'} · toca uno para quitarlo o un elemento que falte para agregarlo`
    : st.exacto ? `${n} ${n === 1 ? 'punto' : 'puntos'} · punto exacto: toca justo lo más alto de cada elemento`
    : n ? `${n} ${n === 1 ? 'elemento' : 'elementos'} · si la silueta agarró algo de atrás, quita el punto y usa «Punto exacto»` : 'Toca cada elemento (maniquí, base, bolsa, planta) en cualquier parte: la app busca su punto más alto. O pide una sugerencia';
  /* «Revisar» espera a que lleguen las siluetas: con un punto a medio subir,
     la triangulación saldría de donde se tocó, no de la cima. */
  const pendientes = /** @type {PuntoFocal[]} */ (z.puntos).filter(p => p.pendiente).length;
  $('rv-listo').disabled = n < 3 || pendientes > 0 || st.buscando;
  $('rv-listo').textContent = pendientes ? 'Buscando cimas…' : 'Revisar';
  $('rv-deshacer').disabled = !n;
  const ex = $('rv-exacto');
  if (ex) { ex.classList.toggle('on', st.exacto); ex.setAttribute('aria-pressed', String(st.exacto)); }
}

/**
 * Toque inteligente: el punto aparece donde se tocó y, cuando llega la
 * silueta (Magic Touch), sube a la cima del elemento. Sin modelo (sin señal
 * la primera vez) o con una silueta derramada, se queda el punto tocado.
 * @param {Zona} z @param {{x:number,y:number}} q en píxeles de la imagen @param {number} cerca
 */
async function tocarElemento(z, q, cerca) {
  const f = /** @type {NonNullable<typeof st.foto>} */ (st.foto);
  const W = f.img.width, H = f.img.height;
  /** @type {PuntoFocal} */
  const p = { x: q.x, y: q.y, toque: { x: q.x, y: q.y }, pendiente: true };
  z.puntos.push(p);
  actualizarAyuda(); girar();
  /** @param {ReturnType<typeof import('./triangulo.js').cimaDeSilueta>} s @param {typeof import('./silueta.js').capaDe} capaDe */
  const aplicar = (s, capaDe) => {
    p.pendiente = false;
    if (!z.puntos.includes(p)) return;                       // lo quitaron mientras tanto
    if (!s) { aviso('No se distinguió bien ese elemento: quedó el punto que tocaste. Si no es su parte más alta, quítalo y toca justo arriba.'); return; }
    const cima = { x: s.cima.x * W, y: s.cima.y * H };
    /* Si se tocó dentro de un elemento ya marcado, es el mismo: no se repite.
       Si la silueta solo llegó hasta otro (se juntaron), se avisa con su
       número y se queda el punto tocado: puede ser otro elemento. */
    const otro = z.puntos.findIndex(o => o !== p && Math.hypot(o.x - cima.x, o.y - cima.y) < cerca);
    if (otro >= 0) {
      const o = /** @type {PuntoFocal} */ (z.puntos[otro]);
      const dentro = o.caja && q.x / W >= o.caja.x0 && q.x / W <= o.caja.x1 && q.y / H >= o.caja.y0 && q.y / H <= o.caja.y1;
      if (dentro) { z.puntos.splice(z.puntos.indexOf(p), 1); aviso('Ese elemento ya está marcado.'); }
      else aviso(`Se juntó con el ${otro + 1}: quedó el punto que tocaste. Si es otro elemento, toca más arriba o usa «Punto exacto».`);
      return;
    }
    p.x = cima.x; p.y = cima.y; p.caja = s.caja; p.capa = capaDe(s.objeto, s.W, s.H);
    z.origenPuntos = z.origenPuntos.startsWith('detector') ? 'detector+silueta' : 'silueta';
  };
  try {
    const { siluetaEn, capaDe } = await import('./silueta.js');
    /* Sobre la imagen chica: misma silueta, la mitad del tiempo. */
    const pedida = siluetaEn(fuenteChica(f), { x: q.x / W, y: q.y / H }, { marco: z.marco });
    try { aplicar(await conTope(pedida, 8000), capaDe); }
    catch (e) {
      if (/** @type {any} */ (e)?.message !== 'tope') throw e;
      /* Tardó: el punto se queda con su anillo y, si la silueta llega
         después, sube a la cima en vez de perderse. */
      aviso('El teléfono va lento: el punto sube a su cima en cuanto llegue la silueta.');
      pedida.then(s => { aplicar(s, capaDe); actualizarAyuda(); dibujar(1); }, () => { p.pendiente = false; actualizarAyuda(); dibujar(1); });
      return;
    }
  } catch {
    p.pendiente = false;
    aviso('El toque inteligente necesita señal la primera vez: quedó el punto que tocaste.', 'warn');
    if (z.origenPuntos === 'detector') z.origenPuntos = 'detector+manual';
  }
  actualizarAyuda(); dibujar(1);
}

/** La foto chica como lienzo, una vez por foto: la silueta corre sobre ella. @param {NonNullable<typeof st.foto>} f */
function fuenteChica(f) {
  const ff = /** @type {any} */ (f);
  if (!ff.chica) {
    const c = document.createElement('canvas');
    c.width = f.img.width; c.height = f.img.height;
    /** @type {CanvasRenderingContext2D} */ (c.getContext('2d')).putImageData(new ImageData(Uint8ClampedArray.from(f.img.data), f.img.width, f.img.height), 0, 0);
    ff.chica = c;
  }
  return /** @type {HTMLCanvasElement} */ (ff.chica);
}

/* Plan A como sugerencia: el detector propone, la persona confirma (detalle
   y mediciones en detector.js y sugerir.js). Solo dentro del recuadro de la
   zona: lo de afuera es otro departamento. Lo que la persona ya tocó se queda;
   las sugerencias se agregan sin pisarlo. Mientras busca, el lienzo no acepta
   toques y una línea barre la zona. */
async function sugerir() {
  const f = st.foto, z = activa(), b = $('rv-sugerir');
  if (!f || !z || st.buscando) return;
  b.disabled = true; b.textContent = 'Buscando…';
  st.buscando = true; st.cajasVistas = []; girar();
  const previos = /** @type {PuntoFocal[]} */ (z.puntos);
  try {
    const { sugerirPuntos } = await import('./detector.js');
    const r = await conTope(sugerirPuntos({ base: f.base, img: f.img }, z.marco, previos, { cerca: 0.04 * Math.max(f.img.width, f.img.height), alCaja: c => { st.cajasVistas.push(c); } }), 12000);
    if (!r.encontrados) aviso('No encontré maniquíes ni objetos en la zona: toca cada elemento y la app busca su punto más alto.', 'warn');
    else {
      /* Los de la persona vuelven tal cual (mismo objeto, misma silueta). */
      z.puntos = r.puntos.map(p => previos.includes(/** @type {any} */ (p)) ? /** @type {PuntoFocal} */ (p) : { x: p.x, y: p.y, sugerido: true });
      if (r.agregados) z.origenPuntos = previos.length ? 'detector+manual' : 'detector';
      const n = r.encontrados;
      /* Lo que no contó, y por qué: así se entiende por qué no puso un punto ahí. */
      const motivos = [...new Set((r.fuera || []).map(x => MOTIVO_FUERA[x.motivo]))];
      const sinContar = r.fuera?.length ? ` No conté ${r.fuera.length}: ${motivos.join(', ')}.` : '';
      /* En la barra de ayuda y no en un aviso flotante: el aviso tapaba la
         parte de arriba de la foto, que es donde quedan las cimas. */
      z.nota = r.agregados
        ? `Encontré ${n} ${n === 1 ? 'elemento' : 'elementos'}.${sinContar} ¿Falta alguno? Tócalo`
        : `Lo que encontré ya estaba marcado.${sinContar} ¿Falta alguno? Tócalo`;
      vibrar(8);
    }
  } catch (e) {
    aviso(/** @type {any} */ (e)?.message === 'tope'
      ? 'La búsqueda tardó demasiado en este teléfono: toca cada elemento y la app busca su punto más alto.'
      : 'No se pudo cargar el detector (la primera vez necesita señal). Toca los puntos a mano.', 'warn');
  } finally {
    st.buscando = false; st.cajasVistas = [];
    b.disabled = false; b.textContent = 'Sugerir';
    actualizarAyuda(); dibujar(1);
  }
}

/* Los modelos (~20 MB la primera vez) se bajan al elegir Focal, no al primer
   toque: así el toque inteligente responde a la primera. */
export function precargarModelos() {
  if (st.precargado || !navigator.onLine) return;
  st.precargado = true;
  import('./silueta.js').then(m => m.cargarSegmentador()).catch(() => { st.precargado = false; });
  import('./detector.js').then(m => m.cargarDetector()).catch(() => {});
}

/* ── Ejemplos (modo demo, sin cámara) ───────────────────────────────────── */

const EJEMPLOS = {
  tringla: [
    () => tringla([P.calido[0], P.calido[1], P.calido[2], P.frio[2], P.calido[3], P.calido[4], P.frio[0], P.frio[1], P.frio[3], P.neutro[2], P.neutro[3], P.neutro[4]], { w: 960, h: 720, semilla: 4, ruido: 5, sombra: 0.2 }),
    () => tringla([P.calido[0], P.calido[1], P.calido[2], P.calido[3], P.frio[0], P.frio[1], P.frio[2], P.frio[3], P.neutro[0], P.neutro[2], P.neutro[3], P.neutro[4]], { w: 960, h: 720, semilla: 6, ruido: 5, sombra: 0.2 }),
    /* Un azul muy pálido entre los fríos: ¿azul cielo o gris? Sale «revísalo a ojo». */
    () => tringla([P.calido[0], P.calido[1], P.calido[3], P.frio[0], P.frio[1], '#D6DCE6', P.frio[2], P.frio[3], P.neutro[2], P.neutro[3], P.neutro[4]], { w: 960, h: 720, semilla: 8, ruido: 5, sombra: 0.2 }),
  ],
  anaquel: [
    () => anaquel({ w: 960, h: 720, semilla: 8, ruido: 5, sombra: 0.15, huecos: [[0, 3], [0, 4], [2, 1]] }),
    () => anaquel({ w: 960, h: 720, semilla: 9, ruido: 5, sombra: 0.15 }),
  ],
  focal: [
    () => focal([0.42, 0.6, 0.82, 0.58, 0.4], { w: 960, h: 720, semilla: 3, ruido: 4 }),
    () => focal([0.62, 0.8, 0.8, 0.45], { w: 960, h: 720, semilla: 5, ruido: 4 }),
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
  const jpeg = new Uint8Array(await /** @type {Blob} */ (await new Promise(r => c.toBlob(/** @type {BlobCallback} */ (r), 'image/jpeg', 0.9))).arrayBuffer());
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

/**
 * Una revisión del historial vuelve a la pantalla como se guardó: la foto, las
 * zonas con sus resultados y marcas, el origen, el área y lo revisado a mano.
 * No se vuelve a medir: es la evidencia de ese día. Si fue un «Volver a
 * revisar», vuelve también la comparación con la de antes.
 * @param {any} reg @param {any} [previa] la revisión de antes, si sigue guardada
 */
async function reabrir(reg, previa) {
  cerrarCamara();
  let base;
  try {
    const bmp = await createImageBitmap(reg.foto);
    base = aLienzo(bmp, LADO_DECODIFICADO, bmp.width, bmp.height);
    bmp.close();
  } catch (e) { aviso('No se pudo abrir la foto guardada.', 'warn'); console.warn(e); return; }
  st.foto = { img: pixeles(base), base, via: reg.via, bytes: null, tomada: reg.tomada ? new Date(reg.tomada) : null };
  st.origen = reg.origen; st.synthid = null; st.synthidAbierto = false; st.puntosDemo = [];
  st.registro = reg.id;
  st.repetir = null; pintarRepetir();
  st.antes = previa ? { id: previa.id, zonas: previa.zonas, miniatura: previa.miniatura || null, creada: previa.creada } : null;
  ponerMiniActual(reg.miniatura);
  ponerArea(reg.area);
  ponerRevisado(reg.huella, reg.revisado || []);
  st.zonas = reg.zonas.map((/** @type {any} */ z) => ({ ...z, puntos: z.puntos || [], res: z.res ?? null }));
  st.notas = reg.notas || [];
  st.activa = 0; st.modo = 'ver'; st.trazo = null; st.ajuste = null;
  $('rv-ayuda').hidden = true;
  const lz = $('rv-lienzo');
  lz.width = base.width; lz.height = base.height;
  proporcion(base.width, base.height); mostrar('foto');
  dibujar(1); pintarZonas(); pintarResultados();
  marcarGuardada();
  $('rv-escena').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
}

/**
 * «↻ Volver a revisar»: la cámara se abre con la foto de antes en fantasma y
 * sus zonas encima, para encuadrar igual. La foto que siga (de la cámara o de
 * la galería) se mide con esas zonas y se compara.
 * @param {any} reg
 */
async function volverARevisar(reg) {
  nuevaRevision();
  st.repetir = reg;
  ponerArea(reg.area);
  pintarRepetir();
  try { await ponerFantasma(reg); } catch (e) { console.warn('Revisar: sin fantasma', e); }
  abrirCamara();
}

/** La foto de antes, con sus zonas punteadas, para ponerla sobre el video. @param {any} reg */
async function ponerFantasma(reg) {
  const bmp = await createImageBitmap(reg.foto);
  const c = aLienzo(bmp, 1280, bmp.width, bmp.height);
  bmp.close();
  const ctx = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d')), u = c.width / 400;
  ctx.setLineDash([8 * u, 6 * u]); ctx.lineWidth = 2.5 * u; ctx.strokeStyle = '#fff';
  for (const z of reg.zonas) ctx.strokeRect(z.marco.x * c.width, z.marco.y * c.height, z.marco.w * c.width, z.marco.h * c.height);
  const img = $('rv-fantasma');
  if (img.src.startsWith('blob:')) URL.revokeObjectURL(img.src);
  img.src = URL.createObjectURL(/** @type {Blob} */ (await new Promise(r => c.toBlob(/** @type {BlobCallback} */ (r), 'image/jpeg', 0.8))));
}

/** El aviso de «Volviendo a revisar» mientras se espera la foto nueva. */
function pintarRepetir() {
  const r = st.repetir, caja = $('rv-repetir-aviso');
  caja.hidden = !r;
  if (r) $('rv-repetir-t').textContent = `↻ Volviendo a revisar ${r.area ? `«${r.area}»` : 'la revisión'} ${cuandoEnFrase(r.creada)}: encuadra igual que la foto de fondo.`;
  if (!r && !st.stream) $('rv-fantasma').hidden = true;
  pintarArea();
}

/* ── Arranque ───────────────────────────────────────────────────────────── */

/** @param {Tipo} t */
function elegirTipo(t) {
  marcarTipo(t);
  if (t === 'focal') precargarModelos();
  if (st.stream) { ponerGuia(); return; }
  if (!st.foto) { st.zonas = []; $('rv-res').innerHTML = ''; proporcion(4, 3); mostrar('vacia'); pintarZonas(); return; }
  /* Mientras se ajusta una zona, los botones de arriba cambian qué es. */
  if (st.modo === 'ajustar') { cambiarTipo(t); return; }
  /* Con una foto: si solo está la zona de la guía, se revisa la foto entera
     como el tipo nuevo (lo de antes). Si ya hay zonas dibujadas, el tipo es
     para la siguiente zona. */
  if (st.modo === 'dibujar') { pintarZonas(); return; }
  if (st.foto.via === 'demo') { st.foto = null; st.zonas = []; $('rv-res').innerHTML = ''; proporcion(4, 3); mostrar('vacia'); pintarZonas(); return; }
  if (st.zonas.length === 1 && st.zonas[0].guia) { st.puntosDemo = []; empezarRevision(); return; }
  empezarDibujo();
}

/* Dibujar un recuadro con el dedo o el mouse. */
function engancharLienzo() {
  const lz = $('rv-lienzo');
  /* En el focal: arrastrar un punto lo ajusta (con lupa), y con «Punto
     exacto» la lupa sale desde que se apoya el dedo. Tocar sin mover sigue
     quitando el punto (eso lo hace el «click»). */
  lz.addEventListener('pointerdown', (/** @type {PointerEvent} */ e) => {
    const z = activa();
    if (st.modo !== 'tocar' || !z || !st.foto || st.buscando) return;
    const q = aImagen(e);
    if (!q) return;
    const cerca = 22 * st.foto.img.width / lz.getBoundingClientRect().width;
    const i = z.puntos.findIndex(p => Math.hypot(p.x - q.x, p.y - q.y) < cerca);
    if (i >= 0) st.arrastre = { i, x0: e.clientX, y0: e.clientY, movido: false };
    else if (!st.exacto) return;
    st.lupa = q;
    lz.setPointerCapture(e.pointerId);
    dibujar(1);
  });
  lz.addEventListener('pointermove', (/** @type {PointerEvent} */ e) => {
    if (!st.lupa) return;
    const q = aImagen(e, true);
    if (!q) return;
    const a = st.arrastre, z = activa();
    if (a && z) {
      if (!a.movido && Math.hypot(e.clientX - a.x0, e.clientY - a.y0) < 6) return;
      a.movido = true;
      const p = /** @type {PuntoFocal} */ (z.puntos[a.i]);
      p.x = q.x; p.y = q.y; p.sugerido = false;
      if (z.origenPuntos === 'detector') z.origenPuntos = 'detector+manual';
    }
    st.lupa = q;
    dibujar(1);
  });
  const soltarLupa = () => {
    if (!st.lupa) return;
    if (st.arrastre?.movido) { st.soltado = performance.now(); const z = activa(); if (z) z.nota = undefined; actualizarAyuda(); }
    st.arrastre = null; st.lupa = null;
    dibujar(1);
  };
  lz.addEventListener('pointerup', soltarLupa);
  lz.addEventListener('pointercancel', soltarLupa);
  /* Mientras se arrastra o se mira con la lupa, el dedo no mueve la página. */
  lz.addEventListener('touchmove', (/** @type {TouchEvent} */ e) => { if (st.lupa) e.preventDefault(); }, { passive: false });
  lz.addEventListener('pointerdown', (/** @type {PointerEvent} */ e) => {
    if (st.modo !== 'dibujar' || !st.foto) return;
    const q = aImagen(e, true);
    if (!q) return;
    lz.setPointerCapture(e.pointerId);
    st.trazo = { x0: q.x, y0: q.y, x1: q.x, y1: q.y };
    e.preventDefault();
  });
  lz.addEventListener('pointermove', (/** @type {PointerEvent} */ e) => {
    if (!st.trazo) return;
    const q = aImagen(e, true);
    if (!q) return;
    st.trazo.x1 = q.x; st.trazo.y1 = q.y;
    dibujar(1);
  });
  /* Soltar el dedo también dispara un «click»: sin esto, el focal recién
     dibujado ganaba un punto en la esquina del recuadro. */
  const soltar = () => { if (st.trazo) { st.soltado = performance.now(); terminarDibujo(st.trazo); } };
  lz.addEventListener('pointerup', soltar);
  lz.addEventListener('pointercancel', () => { st.trazo = null; dibujar(1); });
  lz.addEventListener('click', (/** @type {MouseEvent} */ e) => {
    const z = activa();
    if (st.modo !== 'tocar' || !z || !st.foto || performance.now() - st.soltado < 400) return;
    if (st.buscando) { aviso('Espera tantito: estoy buscando los elementos.'); return; }
    z.nota = undefined;
    const q = aImagen(e);
    if (!q) return;
    /* Tocar un punto (o donde se tocó para crearlo) lo quita; tocar un
       elemento nuevo lo agrega en su cima (toque inteligente). */
    const cerca = 22 * st.foto.img.width / lz.getBoundingClientRect().width;
    const ps = /** @type {PuntoFocal[]} */ (z.puntos);
    const i = ps.findIndex(p => Math.hypot(p.x - q.x, p.y - q.y) < cerca || (p.toque && Math.hypot(p.toque.x - q.x, p.toque.y - q.y) < cerca));
    if (i >= 0) { ps.splice(i, 1); actualizarAyuda(); dibujar(1); return; }
    if (ps.length >= 9) { aviso('Ya hay 9 elementos, el máximo que se revisa en un focal. Quita uno para agregar otro.', 'warn'); return; }
    if (st.exacto) {
      ps.push({ x: q.x, y: q.y });
      if (z.origenPuntos === 'detector') z.origenPuntos = 'detector+manual';
      actualizarAyuda(); dibujar(1);
    } else tocarElemento(z, q, cerca);
  });
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
  engancharLienzo();
  engancharAjuste();
  engancharAnotar();
  iniciarHistorial(reabrir, volverARevisar);
  $('rv-repetir-x').addEventListener('click', () => { st.repetir = null; pintarRepetir(); cerrarCamara(); if (!st.foto) mostrar('vacia'); });
  $('rv-zona-nueva').addEventListener('click', empezarDibujo);
  $('rv-zona-ajustar').addEventListener('click', empezarAjuste);
  $('rv-nueva-foto').addEventListener('click', nuevaRevision);
  $('rv-zonas-lista').addEventListener('click', (/** @type {MouseEvent} */ e) => {
    const b = /** @type {HTMLElement|null} */ (/** @type {HTMLElement} */ (e.target).closest('button'));
    if (!b) return;
    if (b.dataset.quitar !== undefined) {
      st.zonas.splice(Number(b.dataset.quitar), 1);
      if (!st.zonas.length) { st.puntosDemo = []; empezarRevision(); return; }
      st.activa = Math.min(st.activa, st.zonas.length - 1);
      if (st.modo === 'tocar' && activa()?.res) { st.modo = 'ver'; $('rv-ayuda').hidden = true; }
      if (st.modo === 'ajustar') marcarTipo(/** @type {Zona} */ (activa()).tipo);
    } else if (b.dataset.zona !== undefined) {
      const i = Number(b.dataset.zona), z = st.zonas[i];
      /* Al ajustar, tocar una zona solo la elige: sus puntos se piden al terminar. */
      if (z.tipo === 'focal' && !z.res && st.modo !== 'ajustar') { tocarZona(i); return; }
      st.activa = i;
      if (st.modo === 'ajustar') marcarTipo(z.tipo);
    }
    dibujar(1); pintarZonas(); pintarResultados();
  });
  $('rv-sugerir').addEventListener('click', sugerir);
  /* «Punto exacto»: para cuando la silueta agarra algo de atrás. */
  $('rv-exacto').addEventListener('click', () => { st.exacto = !st.exacto; actualizarAyuda(); aviso(st.exacto ? 'Punto exacto: el punto queda justo donde tocas.' : 'Toque inteligente: toca el elemento donde sea y la app busca su cima.'); });
  $('rv-deshacer').addEventListener('click', () => { activa()?.puntos.pop(); actualizarAyuda(); dibujar(1); });
  $('rv-listo').addEventListener('click', () => {
    const z = activa();
    if (!z) return;
    $('rv-ayuda').hidden = true; st.modo = 'ver';
    medirZona(z);
    animar(1100); pintarZonas(); pintarResultados(true);
  });
  /* La cámara no se queda prendida en otra pestaña. */
  document.querySelector('.tabs')?.addEventListener('click', () => setTimeout(() => {
    if (!$('panel-revisar').classList.contains('active')) { cerrarCamara(); if (!st.foto) mostrar('vacia'); else mostrar('foto'); }
  }, 0));
  proporcion(4, 3);
}

iniciar();

/* Para eval/revision.mjs y las capturas: el mismo código que corre en el teléfono. */
/** @type {any} */ (globalThis).__revision = { analizarArchivo, MARCOS, peor, puntosDeCajas, st, reporteParaCompartir, rondaElegida, imagenDeRonda, selloActual,
  sugerirPuntos: async (/** @type {any} */ a, /** @type {any} */ m, /** @type {any} */ p, /** @type {any} */ o) => (await import('./detector.js')).sugerirPuntos(a, m, p, o) };
