// Asistente de Piso · Copyright (c) 2026 Gerardo Barrera.
// Licencia PolyForm Noncommercial 1.0.0: uso comercial solo con licencia escrita (LICENCIA-COMERCIAL.md).
//
// Revisar (ADR 0007): los resultados. Las tarjetas por básico con su cifra y
// su evidencia, la evidencia de origen de la foto (con SynthID a mano), la
// lista para revisar a ojo y el reporte que se comparte.

import { peor } from './veredicto.js';
import { huella, formato, admiteSynthid, conSynthid } from './procedencia.js';
import { COLOR_NIVEL, $, st, aviso, vibrar, ease, esc } from './comun.js';
import { animar, redondo, dibujar } from './dibujo.js';
import { medirZona, pintarZonas } from './zonas.js';
import { nuevaRevision } from './ui.js';
import { guardarPronto, pintarArea } from './historial.js';

/** @typedef {import('./veredicto.js').Resultado} Resultado */
/** @typedef {import('./zonas.js').Zona} Zona */

/* ── Resultados ─────────────────────────────────────────────────────────── */

const ICONO_ORIGEN = '<svg class="ico" viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/></svg>';
const ICONO_LUPA = '<svg class="ico" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>';
const ICONO_COMPARTIR = '<svg class="ico" viewBox="0 0 24 24"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/></svg>';

/** La cifra grande de cada básico. @param {Resultado} r */
function cifra(r) {
  const ev = r.evidencia;
  if (r.nivel === 'NO_CALIFICA') return { n: null, de: '', txt: ev.vestidos ? 'vestidos: sin regla de color' : 'no se puede calificar con esta foto' };
  if (r.basico === 'colorizacion') {
    if (r.nivel === 'GRAVE') return { n: Number(ev.fuera_de_grupo), de: `/${ev.tramos}`, txt: 'tramos rompen los bloques de color' };
    if (r.nivel === 'OBSERVACIÓN' && Number(ev.dudosos)) return { n: Number(ev.dudosos), de: `/${ev.tramos}`, txt: 'tramos con color dudoso: revísalos a ojo' };
    if (r.nivel === 'OBSERVACIÓN' && Number(ev.fuera_de_rueda)) return { n: Number(ev.fuera_de_rueda), de: `/${ev.tramos}`, txt: 'tramos fuera de la rueda en su grupo' };
    if (r.nivel === 'OBSERVACIÓN') return { n: Number(ev.tramos), de: '', txt: 'tramos en bloques, en otro orden' };
    return { n: Number(ev.tramos), de: '', txt: 'tramos de color, todos en orden' };
  }
  if (r.basico === 'surtido') return { n: Number(ev.vacio_pct), de: '%', txt: `del mueble vacío${ev.huecos ? ` · ${ev.huecos} ${ev.huecos === 1 ? 'hueco' : 'huecos'}` : ''}` };
  if (r.basico === 'triangulacion') {
    if (r.nivel === 'OBSERVACIÓN') return { n: Number(ev.empatan_arriba) + 1, de: '', txt: 'elementos empatan arriba' };
    return { n: Number(ev.desnivel_pct), de: '%', txt: r.nivel === 'GRAVE' ? 'de desnivel (se pide 12 % o más)' : `de desnivel · ${ev.forma}` };
  }
  if (r.basico === 'niveles') return { n: Number(ev.niveles), de: '', txt: Number(ev.niveles) === 1 ? 'altura' : 'alturas distintas' };
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

/* La evidencia en palabras del piso. Lo técnico (umbral de bordes, balance de
   blancos con sus factores) se queda en el título del chip, para quien lo
   busque, y no en el texto. */
const DE_DONDE = { manual: 'puntos tocados a mano', detector: 'puntos sugeridos por la app', 'detector+manual': 'sugeridos y tocados', silueta: 'cimas por silueta', 'detector+silueta': 'sugeridos y por silueta' };
/** @type {Record<string, (v: any) => string | null>} */
const CHIP = {
  vestidos: () => 'tringla de vestidos',
  orden: v => `regla: ${v}`,
  tramos: v => `${v} tramos de color`,
  fondo_pct: v => v ? `fondo ${v} %` : null,
  luz_corregida: v => v ? 'luz corregida' : null,
  balance_blancos: v => /^sin/.test(String(v)) ? null : 'blancos ajustados',
  direccion: v => v === 'der-izq' ? 'de derecha a izquierda' : 'de izquierda a derecha',
  fuera_de_grupo: v => v ? `${v} fuera de su bloque` : 'bloques limpios',
  fuera_de_rueda: v => v ? `${v} fuera de la rueda` : null,
  dudosos: v => v ? `${v} con color dudoso` : null,
  brillos: v => v ? `${v} ${v === 1 ? 'brillo' : 'brillos'} sin contar` : null,
  grupos: () => null,
  bloques: v => v ? `bloques: ${v}` : null,
  celdas: v => `${v} celdas revisadas`,
  umbral_bordes: () => null,
  vacio_pct: v => `vacío ${v} %`,
  huecos: v => v ? `${v} ${v === 1 ? 'hueco' : 'huecos'}` : 'sin huecos',
  hueco_mayor_pct: v => v ? `hueco mayor ${v} %` : null,
  celdas_maniqui: v => `${v} celdas tapadas por maniquí (no cuentan)`,
  puntos: v => `${v} ${v === 1 ? 'elemento' : 'elementos'}`,
  origen_puntos: v => DE_DONDE[/** @type {'manual'} */ (v)] || null,
  cima_pos_pct: v => `cima al ${v} % del ancho`,
  desnivel_pct: v => `desnivel ${v} %`,
  empatan_arriba: v => v ? `${v + 1} empatan arriba` : null,
  forma: v => String(v),
  niveles: v => `${v} ${v === 1 ? 'altura' : 'alturas'}`,
};
/** @param {Record<string, any>} ev */
function chips(ev) {
  return Object.entries(ev).filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => {
      const crudo = `${k.replace(/_pct$/, ' %').replace(/_/g, ' ')} ${v === true ? 'sí' : v === false ? 'no' : String(v)}`;
      const txt = CHIP[k] ? CHIP[k](v) : crudo;
      return txt ? `<span title="${esc(crudo)}">${esc(txt)}</span>` : '';
    }).join('');
}

/** ¿Hubo IA en esta medición? Solo la de los puntos del focal (MediaPipe, en el teléfono). @param {Resultado} r */
const conIA = r => /detector|silueta/.test(String(r.evidencia?.origen_puntos || ''));

/** Cómo se lee el origen en pantalla: sin metadatos no es una falla del montaje. @param {any} o */
function nivelOrigen(o) {
  if (o.nivel === 'DEMO') return 'EJEMPLO';
  if (o.nivel === 'NO_CALIFICA') return 'SIN DATOS';
  return o.nivel;
}

/** El origen con lo que la persona anotó de SynthID, si anotó algo. */
function origenVisto() {
  return st.synthid && st.origen ? conSynthid(st.origen, st.synthid) : st.origen;
}

/** @param {any} o @param {string} [titulo] @param {boolean} [conSynthidBoton] solo con una foto real cargada */
export function tarjetaOrigen(o, titulo = 'Evidencia de la foto', conSynthidBoton = false) {
  const ev = o.evidencia || {};
  const pie = ev.huella ? `<div class="rv-huella">SHA-256 ${esc(ev.huella)}… · ${Math.round(ev.bytes / 1024)} KB${ev.c2pa ? ` · C2PA ${esc(ev.c2pa)} (firma sin validar)` : ''}${ev.iptc ? ` · IPTC ${esc(ev.iptc)}` : ''}</div>` : '';
  const consejo = o.nivel === 'NO_CALIFICA' || o.nivel === 'OBSERVACIÓN'
    ? '<p class="rv-consejo">Para que cuente como evidencia: tómala desde aquí, o mándala por WhatsApp como <b>Documento</b> para que conserve sus datos.</p>' : '';
  const sid = conSynthidBoton && st.foto?.bytes && admiteSynthid(st.origen) ? bloqueSynthid() : '';
  return `<div class="rv-origen" data-n="${esc(o.nivel === 'NO_CALIFICA' ? 'SIN_DATOS' : o.nivel)}">${ICONO_ORIGEN}<div class="rv-origen-c"><div class="rv-origen-t">${esc(titulo)}<b>${esc(nivelOrigen(o))}</b></div><p>${esc(o.motivo)}</p>${consejo}${sid}${pie}</div></div>`;
}

/* ── SynthID: la marca de agua de la IA de Google, revisada a mano ─────────
   No hay API pública: en el teléfono la foto ORIGINAL se comparte a Gemini
   («¿esto es IA?»); en la computadora se abre el portal. La foto sale del
   teléfono solo si la persona toca el botón. Lo que vio lo anota aquí. */

const SYNTHID_PORTAL = 'https://synthid.com';
const VISTOS = /** @type {const} */ ([['generada', 'Hecha con IA'], ['editada', 'Partes con IA'], ['no', 'Sin marca']]);

function bloqueSynthid() {
  const red = navigator.onLine;
  const pregunta = st.synthidAbierto || st.synthid
    ? `<div class="rv-sid-r" role="group" aria-label="Qué dijo SynthID"><span>¿Qué dijo?</span>${VISTOS.map(([v, t]) =>
      `<button type="button" data-sid="${v}" aria-pressed="${st.synthid === v}">${t}</button>`).join('')}</div>` : '';
  const abrir = red
    ? `<a class="rv-sid-b" id="rv-synthid" href="${SYNTHID_PORTAL}" target="_blank" rel="noopener">${ICONO_LUPA}Abrir SynthID</a>`
    : `<button type="button" class="rv-sid-b" disabled>${ICONO_LUPA}SynthID necesita señal</button>`;
  return `<div class="rv-sid">
    ${abrir}
    <p class="rv-sid-n">Revisa si la foto trae la marca de agua de la IA de Google. Inicia sesión con Google, sube la misma foto y anota aquí lo que dijo. La foto sale del teléfono solo si tú la subes.</p>
    ${red ? '<button type="button" class="rv-sid-g" id="rv-synthid-gemini">o mándala a Gemini (elige Gemini en la lista)</button>' : ''}
    ${pregunta}</div>`;
}

function conectarSynthid() {
  const a = $('rv-synthid');
  /* El enlace abre el portal solo; aquí únicamente se deja lista la pregunta. */
  if (a) a.onclick = () => { if (!st.synthidAbierto) { st.synthidAbierto = true; setTimeout(pintarResultados, 0); } };
  const g = $('rv-synthid-gemini');
  if (g) g.onclick = mandarAGemini;
  const otra = $('rv-otra');
  if (otra) otra.onclick = nuevaRevision;
  document.querySelectorAll('#rv-res [data-sid]').forEach(x => {
    /** @type {HTMLElement} */ (x).onclick = () => {
      const v = /** @type {any} */ (/** @type {HTMLElement} */ (x).dataset.sid);
      st.synthid = st.synthid === v ? null : v;   // tocar lo mismo otra vez lo quita
      pintarResultados();
    };
  });
}

/* Gemini en el teléfono: compartir el archivo original. Si el sistema no
   puede compartir archivos, queda el portal. */
async function mandarAGemini() {
  const f = st.foto;
  if (!f?.bytes) return;
  st.synthidAbierto = true;
  pintarResultados();
  const fmt = formato(f.bytes);
  const ext = fmt === 'jpeg' ? 'jpg' : fmt === 'desconocido' ? 'jpg' : fmt;
  const archivo = new File([/** @type {BlobPart} */ (f.bytes)], `foto-original.${ext}`, { type: `image/${fmt === 'desconocido' ? 'jpeg' : fmt}` });
  const nav = /** @type {any} */ (navigator);
  if (nav.canShare?.({ files: [archivo] })) {
    try {
      await nav.share({ files: [archivo], text: '¿Esta imagen se hizo o se editó con IA de Google? Revísala con SynthID.' });
      aviso('Elige Gemini y pregúntale si es IA. Luego anota aquí lo que dijo.');
      return;
    } catch (e) { if (/** @type {any} */ (e)?.name === 'AbortError') return; }
  }
  window.open(SYNTHID_PORTAL, '_blank', 'noopener');
  aviso('Sube ahí la misma foto que elegiste y anota aquí lo que dijo.');
}

/** Lo que se revisa a mano: los básicos de la guía que una foto no mide. */
function listaManual() {
  const tipos = new Set(st.zonas.map(z => z.tipo));
  const l = ['Limpieza', 'Alineación', 'Planchado', 'Enganchado y dirección de ganchos', 'Etiquetas de precio y sensores'];
  if (tipos.has('anaquel')) l.push('Doblado de chica a grande', 'Rotación');
  if (tipos.has('tringla')) l.push('Entallado: una prenda por talla');
  if (tipos.has('focal')) l.push('Composición', 'Equilibrio', 'Simetría', 'Concepto: el look completo');
  l.push('Pasillo de 90 cm');
  return l;
}

const BASICO = { colorizacion: 'Colorización', surtido: 'Surtido', triangulacion: 'Triangulación', niveles: 'Alturas y niveles' };

/** Todos los resultados, con su zona. */
function todos() {
  return st.zonas.flatMap((z, i) => (z.res || []).map(r => ({ r, z, i })));
}

/** @param {boolean} [subir] llevar la vista a la cifra: solo cuando se acaba de medir algo */
export function pintarResultados(subir = false) {
  const caja = $('rv-res');
  const lista = todos();
  if (!lista.length) { caja.innerHTML = st.origen && st.foto ? tarjetaOrigen(origenVisto(), undefined, true) : ''; conectarSynthid(); pintarArea(); return; }
  const varias = st.zonas.length > 1;
  const general = peor(lista.map(x => x.r.nivel));
  const cuenta = (/** @type {string} */ n) => lista.filter(x => x.r.nivel === n).length;
  const resumen = varias || lista.length > 1
    ? `<div class="rv-general" data-n="${esc(general)}"><span>Revisión · ${st.zonas.length} ${st.zonas.length === 1 ? 'zona' : 'zonas'} · ${lista.length} básicos</span><b><i></i>${esc(general)}</b><small>${['CUMPLE', 'OBSERVACIÓN', 'GRAVE', 'NO_CALIFICA'].filter(cuenta).map(n => `${cuenta(n)} ${n.toLowerCase().replace('_', ' ')}`).join(' · ')}</small></div>`
    : '';
  /* La zona activa primero, para que lo que se acaba de medir quede arriba. */
  const orden = lista.slice().sort((a, b) => (b.i === st.activa ? 1 : 0) - (a.i === st.activa ? 1 : 0) || a.i - b.i);
  caja.innerHTML = `${resumen}
    ${orden.map(({ r, z, i }, j) => {
      const c = cifra(r);
      return `<div class="rv-ver" data-n="${esc(r.nivel)}">
      <div class="rv-ver-top"><span class="rv-basico">${varias ? `Zona ${i + 1} · ` : ''}${esc(BASICO[/** @type {'surtido'} */ (r.basico)] || r.basico)}</span><span class="rv-nivel"><i></i>${esc(r.nivel)}</span></div>
      <div class="rv-cifra-fila"><span class="rv-cifra"><b data-cifra="${c.n === null ? '' : c.n}">${c.n === null ? '—' : j ? esc(String(c.n)) : '0'}</b><small>${esc(c.de)}</small></span><span class="rv-cifra-txt">${esc(c.txt)}</span></div>
      <p class="rv-motivo">${esc(r.motivo)}</p>
      <div class="rv-ev">${chips(r.evidencia)}</div>
      <div class="rv-fuente">${conIA(r)
        ? 'fuente: CÓDIGO · los puntos los ubicó IA en tu teléfono (MediaPipe) · el veredicto, el código · nada se sube'
        : 'fuente: CÓDIGO · medido en este teléfono · sin IA'}</div>
      ${z.tipo === 'tringla' ? `<button type="button" class="rv-vestidos" data-vestidos="${i}" aria-pressed="${!!z.vestidos}">${z.vestidos ? 'Es de vestidos · revisar con la regla de color' : '¿Es de vestidos? La regla de color no aplica'}</button>` : ''}
    </div>`;
    }).join('')}
    ${st.origen ? tarjetaOrigen(origenVisto(), undefined, true) : ''}
    <div class="rv-lista"><h3>Lo que no se ve en una foto</h3><p>Se revisa a mano; la app no lo adivina.</p>
      ${listaManual().map(m => `<label><input type="checkbox" data-item="${esc(m)}"${revisadoAMano().has(m) ? ' checked' : ''}> ${esc(m)}</label>`).join('')}</div>
    <button class="rv-compartir" id="rv-compartir" type="button">${ICONO_COMPARTIR}Compartir la revisión</button>
    <p class="rv-nota">Se comparte la foto marcada y el resumen con la huella de la foto original.</p>
    <button class="rv-otra" id="rv-otra" type="button">↺ Revisar otra foto</button>`;
  /* El veredicto se siente: un toque corto si cumple, dos si algo está mal. */
  if (subir) vibrar(general === 'GRAVE' || general === 'OBSERVACIÓN' ? [14, 70, 14] : 12);
  /* Todas las cifras suben, una tras otra. */
  caja.querySelectorAll('.rv-ver [data-cifra]').forEach((/** @type {HTMLElement} */ el, /** @type {number} */ i) => {
    if (!el.dataset.cifra) return;
    el.textContent = '0';
    setTimeout(() => contar(el, Number(el.dataset.cifra)), i * 140);
  });
  /* Primero se ven las marcas sobre la foto; luego la cifra sube a la vista.
     Nunca mientras la persona toca puntos o dibuja: le movería la foto. */
  if (subir) setTimeout(() => {
    if (st.modo !== 'ver') return;
    const v = caja.querySelector('.rv-general, .rv-cifra-fila');
    const r = v?.getBoundingClientRect();
    if (r && r.bottom > innerHeight - 90) v.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
  }, 950);
  $('rv-compartir').onclick = compartir;
  /* Vestidos llevan su propio mercadeo (presentación de básicos): la persona lo dice y la zona se vuelve a medir. */
  caja.querySelectorAll('[data-vestidos]').forEach((/** @type {HTMLElement} */ b) => b.addEventListener('click', () => {
    const z = st.zonas[Number(b.dataset.vestidos)];
    if (!z) return;
    z.vestidos = !z.vestidos;
    st.activa = st.zonas.indexOf(z);
    medirZona(z);
    animar(700); pintarZonas(); pintarResultados();
  }));
  caja.querySelectorAll('.rv-lista input').forEach((/** @type {HTMLInputElement} */ inp) => inp.addEventListener('change', () => {
    const s = revisadoAMano();
    if (inp.checked) s.add(/** @type {string} */ (inp.dataset.item)); else s.delete(/** @type {string} */ (inp.dataset.item));
    guardarRevisado();
    guardarPronto();
  }));
  conectarSynthid();
  /* Cada resultado nuevo (o cambiado) queda en el historial. */
  guardarPronto(); pintarArea();
}

/* ── Compartir ──────────────────────────────────────────────────────────── */

function resumenTexto() {
  const o = origenVisto(), lista = todos();
  const l = ['Revisión con foto · Asistente de Piso'];
  if (st.area) l.push(`Área: ${st.area}`);
  if (lista.length > 1) l.push(`Resultado: ${peor(lista.map(x => x.r.nivel))} (${lista.length} básicos en ${st.zonas.length} ${st.zonas.length === 1 ? 'zona' : 'zonas'})`);
  for (const { r, i } of lista) l.push(`${st.zonas.length > 1 ? `Zona ${i + 1} · ` : ''}${BASICO[/** @type {'surtido'} */ (r.basico)] || r.basico}: ${r.nivel}. ${r.motivo}`);
  if (o) l.push(`Evidencia de la foto: ${nivelOrigen(o)}. ${o.motivo}`);
  if (o?.evidencia?.huella) l.push(`Huella SHA-256 de la foto original: ${o.evidencia.huella}…`);
  const marcados = listaManual().filter(m => revisadoAMano().has(m));
  if (marcados.length) l.push(`Revisado a mano: ${marcados.join(', ')}.`);
  l.push(lista.some(x => conIA(x.r))
    ? 'Medido por código en el teléfono; los puntos del focal los ubicó IA en el mismo teléfono. Nada se subió.'
    : 'Medido por código en el teléfono, sin IA.');
  return l.join('\n');
}

/* La lista de lo que se revisa a mano, por foto (su huella): se guarda en el
   teléfono y viaja al compartir. */
const CLAVE_REVISADO = 'ap_rv_revisado';
/** @type {Map<string, Set<string>>} */
const revisados = new Map();
const huellaActual = () => String(st.origen?.evidencia?.huella || 'sin-huella');
/** @returns {Set<string>} */
export function revisadoAMano() {
  const h = huellaActual();
  if (!revisados.has(h)) {
    let guardado = [];
    try { guardado = (JSON.parse(localStorage.getItem(CLAVE_REVISADO) || '{}') || {})[h] || []; } catch { /* sin almacenamiento */ }
    revisados.set(h, new Set(Array.isArray(guardado) ? guardado.filter(x => typeof x === 'string') : []));
  }
  return /** @type {Set<string>} */ (revisados.get(h));
}
/** Al reabrir del historial, lo revisado a mano vuelve con la foto. @param {string} h huella @param {string[]} lista */
export function ponerRevisado(h, lista) {
  revisados.set(h || 'sin-huella', new Set(lista));
}

function guardarRevisado() {
  try {
    const todo = JSON.parse(localStorage.getItem(CLAVE_REVISADO) || '{}') || {};
    todo[huellaActual()] = [...revisadoAMano()];
    /* Las 30 fotos más recientes bastan. */
    const llaves = Object.keys(todo);
    for (const k of llaves.slice(0, Math.max(0, llaves.length - 30))) delete todo[k];
    localStorage.setItem(CLAVE_REVISADO, JSON.stringify(todo));
  } catch { /* sin almacenamiento: se queda en la sesión */ }
}

/**
 * La imagen para compartir, de 1080 px de ancho: la foto marcada y, debajo,
 * cada veredicto con su insignia de color, su cifra y su motivo, lo revisado a
 * mano, la evidencia de la foto y una leyenda. En WhatsApp se lee sola, sin el
 * texto que la acompaña.
 */
export function reporteParaCompartir() {
  const lz = $('rv-lienzo');
  dibujar(1);
  const ANCHO = 1080, M = 48, u = ANCHO / 400;
  const altoFoto = Math.round(lz.height * ANCHO / lz.width);
  const medir = /** @type {CanvasRenderingContext2D} */ (document.createElement('canvas').getContext('2d'));
  /** @param {string} t @param {string} font @param {number} ancho */
  const renglones = (t, font, ancho) => {
    medir.font = font;
    /** @type {string[]} */
    const out = [];
    let r = '';
    for (const pal of t.split(' ')) {
      const prueba = r ? r + ' ' + pal : pal;
      if (r && medir.measureText(prueba).width > ancho) { out.push(r); r = pal; } else r = prueba;
    }
    if (r) out.push(r);
    return out;
  };
  const F = {
    titulo: '700 40px Geist, system-ui, sans-serif', sub: '500 26px Geist, system-ui, sans-serif',
    basico: '700 30px Geist, system-ui, sans-serif', nivel: '700 24px "Geist Mono", ui-monospace, monospace',
    motivo: '500 27px Geist, system-ui, sans-serif', chica: '500 23px Geist, system-ui, sans-serif',
  };
  const lista = todos(), o = origenVisto(), varias = st.zonas.length > 1;
  /** @type {Array<{alto:number, pinta:(ctx:CanvasRenderingContext2D, y:number) => void}>} */
  const bloques = [];
  const d = new Date(), f2 = (/** @type {number} */ n) => String(n).padStart(2, '0');
  const fecha = `${f2(d.getDate())}/${f2(d.getMonth() + 1)}/${d.getFullYear()} · ${f2(d.getHours())}:${f2(d.getMinutes())}`;
  bloques.push({ alto: 110, pinta: (ctx, y) => {
    ctx.font = F.titulo; ctx.fillStyle = '#F4F2F0'; ctx.fillText('Revisión con foto', M, y + 8);
    ctx.font = F.sub; ctx.fillStyle = '#9A97A2'; ctx.fillText(`${st.area ? st.area + ' · ' : 'Asistente de Piso · '}${fecha}`, M, y + 62);
  } });
  for (const { r, i } of lista) {
    const c = cifra(r);
    const mot = renglones(r.motivo, F.motivo, ANCHO - 2 * M - 56);
    const linea = c.n === null ? c.txt : `${c.n}${c.de} · ${c.txt}`;
    bloques.push({ alto: 74 + 38 + mot.length * 36 + 28, pinta: (ctx, y) => {
      const color = COLOR_NIVEL[/** @type {'CUMPLE'} */ (r.nivel)] || '#fff';
      redondo(ctx, M, y, ANCHO - 2 * M, 74 + 38 + mot.length * 36 + 8, 22);
      ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.fill();
      ctx.fillStyle = color; ctx.fillRect(M, y + 18, 6, 74 + 38 + mot.length * 36 - 28);
      ctx.font = F.basico; ctx.fillStyle = '#F4F2F0';
      ctx.fillText(`${varias ? `Zona ${i + 1} · ` : ''}${BASICO[/** @type {'surtido'} */ (r.basico)] || r.basico}`, M + 28, y + 20);
      ctx.font = F.nivel;
      const tn = r.nivel.replace('_', ' '), wn = ctx.measureText(tn).width + 36;
      redondo(ctx, ANCHO - M - 20 - wn, y + 16, wn, 42, 21); ctx.fillStyle = color; ctx.fill();
      ctx.fillStyle = r.nivel === 'GRAVE' ? '#fff' : '#16171B'; ctx.fillText(tn, ANCHO - M - 20 - wn + 18, y + 25);
      ctx.font = F.sub; ctx.fillStyle = '#D8D5DE'; ctx.fillText(linea, M + 28, y + 70);
      ctx.font = F.motivo; ctx.fillStyle = '#B7B3BF';
      mot.forEach((t, k) => ctx.fillText(t, M + 28, y + 112 + k * 36));
    } });
  }
  const marcados = listaManual().filter(m => revisadoAMano().has(m));
  const pie = [
    marcados.length ? `Revisado a mano: ${marcados.join(', ')}.` : 'Lo que no se ve en la foto (limpieza, etiquetas, planchado…) se revisa a mano.',
    o ? `Evidencia de la foto: ${nivelOrigen(o)}. ${o.motivo}` : '',
    o?.evidencia?.huella ? `Huella SHA-256 de la foto original: ${o.evidencia.huella}…` : '',
    lista.some(x => conIA(x.r)) ? 'Veredicto por código en el teléfono; los puntos del focal los ubicó IA en el mismo teléfono. Nada se subió.' : 'Medido por código en el teléfono, sin IA. Nada se subió.',
    'Leyenda: verde CUMPLE · ámbar OBSERVACIÓN · rojo GRAVE · azul NO CALIFICA.',
  ].filter(Boolean).flatMap(t => renglones(t, F.chica, ANCHO - 2 * M));
  bloques.push({ alto: 24 + pie.length * 34, pinta: (ctx, y) => {
    ctx.font = F.chica; ctx.fillStyle = '#8F8C98';
    pie.forEach((t, k) => ctx.fillText(t, M, y + 12 + k * 34));
  } });
  const SEP = 22;
  const altoPanel = 40 + bloques.reduce((s, b) => s + b.alto + SEP, 0) + 20;
  const c = document.createElement('canvas');
  c.width = ANCHO; c.height = altoFoto + altoPanel;
  const ctx = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  ctx.drawImage(lz, 0, 0, ANCHO, altoFoto);
  ctx.fillStyle = '#111217'; ctx.fillRect(0, altoFoto, ANCHO, altoPanel);
  ctx.fillStyle = COLOR_NIVEL[/** @type {'CUMPLE'} */ (lista.length ? peor(lista.map(x => x.r.nivel)) : 'NO_CALIFICA')];
  ctx.fillRect(0, altoFoto, ANCHO, 4 * u);
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  let y = altoFoto + 40;
  for (const b of bloques) { b.pinta(ctx, y); y += b.alto + SEP; }
  return c;
}

async function compartir() {
  const c = reporteParaCompartir();
  const blob = /** @type {Blob} */ (await new Promise(r => c.toBlob(/** @type {BlobCallback} */ (r), 'image/jpeg', 0.9)));
  const texto = resumenTexto();
  const d = new Date(), f2 = (/** @type {number} */ n) => String(n).padStart(2, '0');
  const que = st.zonas.length > 1 ? 'area' : st.zonas[0]?.tipo || st.tipo;
  const nombre = `revision-${que}-${d.getFullYear()}-${f2(d.getMonth() + 1)}-${f2(d.getDate())}-${f2(d.getHours())}${f2(d.getMinutes())}.jpg`;
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
