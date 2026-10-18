// Asistente de Piso · Copyright (c) 2026 Gerardo Barrera.
// Licencia PolyForm Noncommercial 1.0.0: uso comercial solo con licencia escrita (LICENCIA-COMERCIAL.md).
//
// Revisar (ADR 0007): lo que comparten las piezas de la pantalla. El estado de
// la revisión en curso (`st`), los textos por tipo y lo mínimo del DOM. No
// importa a ninguna otra pieza de la pantalla.

/** @typedef {import('./veredicto.js').Imagen} Imagen */
/** @typedef {import('./veredicto.js').Resultado} Resultado */
/** @typedef {'tringla'|'anaquel'|'focal'} Tipo */
/** @typedef {{x:number,y:number,w:number,h:number}} Marco */
/** @typedef {'manual'|'detector'|'detector+manual'|'silueta'|'detector+silueta'} OrigenPuntos */
/** Un punto del focal: la cima de un elemento. `toque`, `caja` y `capa` vienen del toque inteligente.
 * `pendiente`: su silueta todavía no llega. `sugerido`: lo puso «Sugerir».
 * @typedef {{x:number,y:number,toque?:{x:number,y:number},caja?:{x0:number,y0:number,x1:number,y1:number},capa?:HTMLCanvasElement,pendiente?:boolean,sugerido?:boolean}} PuntoFocal */
/** @typedef {import('./zonas.js').Zona} Zona */

/* Lo que encuadra la guía, en fracción de la foto. Es lo mismo que miden
   color.js y surtido.js: la guía no es decoración. */
export const MARCOS = {
  tringla: { x: 0.04, y: 0.1, w: 0.92, h: 0.8 },
  anaquel: { x: 0.04, y: 0.04, w: 0.92, h: 0.92 },
  focal: { x: 0.03, y: 0.03, w: 0.94, h: 0.94 },
};
export const TEXTOS = {
  tringla: { vacia: 'Apunta a la tringla', guia: 'La franja va a la altura del pecho de las prendas', basico: 'Colorización' },
  anaquel: { vacia: 'Apunta al anaquel o a la mesa', guia: 'Encuadra el mueble completo', basico: 'Surtido' },
  focal: { vacia: 'Apunta al focal', guia: 'Encuadra el focal completo', basico: 'Triangulación' },
};
export const NOMBRE_TIPO = { tringla: 'Tringla', anaquel: 'Mesa o anaquel', focal: 'Focal' };
export const ARTICULO = { tringla: 'la tringla', anaquel: 'la mesa o el anaquel', focal: 'el focal' };
export const COLOR_NIVEL = { CUMPLE: '#5BC79A', 'OBSERVACIÓN': '#E2B755', GRAVE: '#F07878', NO_CALIFICA: '#A9BFE0', DEMO: '#A9BFE0' };

export const $ = (/** @type {string} */ id) => /** @type {any} */ (document.getElementById(id));

export const st = {
  /** @type {Tipo} */ tipo: 'tringla',
  /** @type {MediaStream|null} */ stream: null,
  /** @type {null|{img:Imagen, base:HTMLCanvasElement, via:'app'|'galeria'|'demo', bytes:Uint8Array|null, tomada:Date|null}} */ foto: null,
  /** @type {Zona[]} */ zonas: [],
  /** zona que se mira o se edita */ activa: -1,
  /** @type {'ver'|'dibujar'|'tocar'|'ajustar'|'anotar'} */ modo: 'ver',
  /** @type {null|{x0:number,y0:number,x1:number,y1:number}} recuadro que se está dibujando */ trazo: null,
  /** @type {null|{esquina:null|[number,number], m0:Marco, p0:{x:number,y:number}, movido:boolean}} zona que se mueve o se estira */ ajuste: null,
  /** @type {{x:number,y:number}[]} puntos del ejemplo de focal */ puntosDemo: [],
  /** cuándo se soltó el último recuadro (ms) */ soltado: 0,
  /** el toque pone el punto justo donde se toca, sin silueta */ exacto: false,
  /** @type {any} */ origen: null,
  /** el área o departamento de la revisión (historial y reporte) */ area: '',
  /** @type {string|null} id de la revisión en el historial; null = todavía no se guarda */ registro: null,
  /** @type {null|{id:string, zonas:any[], miniatura:Blob|null, creada:number, url?:string}} la revisión de antes, con la que se compara («Volver a revisar») */ antes: null,
  /** @type {any} la revisión guardada que se vuelve a revisar: espera la foto nueva */ repetir: null,
  /** @type {string} la miniatura marcada de la revisión en pantalla (para «Antes y después») */ miniActual: '',
  /** @type {import('./notas.js').Nota[]} flechas, trazos y notas a mano, en fracción de la foto */ notas: [],
  /** @type {null|import('./notas.js').Nota} la que se está dibujando */ notaViva: null,
  /** @type {null|{x:number,y:number}} dónde va la nota que se está escribiendo */ notaPunto: null,
  /** @type {null|import('./referencia.js').Referencia} la tringla de la campaña o un CUMPLE, para comparar */ referencia: null,
  /** lo que la persona vio en SynthID @type {null|import('./procedencia.js').VistoSynthid} */ synthid: null,
  /** ya tocó «Revisar con SynthID»: se ve la pregunta */ synthidAbierto: false,
  demo: { tringla: 0, anaquel: 0, focal: 0 },
  anim: 0,
  /** «Sugerir» está buscando: el lienzo no acepta toques */ buscando: false,
  /** hay un bucle de dibujo en curso (barrido o anillo) */ girando: false,
  /** ya se pidieron los modelos del focal */ precargado: false,
  /** @type {null|{i:number,x0:number,y0:number,movido:boolean}} punto que se arrastra */ arrastre: null,
  /** @type {null|{x:number,y:number}} dónde mira la lupa, en píxeles de la imagen */ lupa: null,
  /** @type {Array<{x:number,y:number,w:number,h:number,categoria:string,score:number}>} lo que va encontrando «Sugerir» */ cajasVistas: [],
};

/* ── Escena: vacía, cámara o foto ───────────────────────────────────────── */

/** @param {'vacia'|'camara'|'foto'} modo */
export function mostrar(modo) {
  $('rv-vacia').hidden = modo !== 'vacia';
  $('rv-video').hidden = modo !== 'camara';
  $('rv-lienzo').hidden = modo !== 'foto';
  /* Al volver a revisar, la foto de antes (en fantasma) es la guía. */
  $('rv-guia').hidden = modo !== 'camara' || !!st.repetir;
  $('rv-fantasma').hidden = modo !== 'camara' || !st.repetir;
  $('rv-ayuda').hidden = true;
  const d = $('rv-disparo');
  d.classList.toggle('vivo', modo === 'camara');
  d.setAttribute('aria-label', modo === 'camara' ? 'Tomar la foto' : 'Abrir la cámara');
}

/** La escena toma la forma de la foto, sin pasar de ~70 % del alto de la pantalla.
 * @param {number} w @param {number} h */
export function proporcion(w, h) {
  const e = $('rv-escena');
  e.style.aspectRatio = `${w} / ${h}`;
  e.style.width = `min(100%, calc(70vh * ${(w / h).toFixed(4)}))`;
  e.style.marginInline = 'auto';
}

/** @param {string} msg @param {string} [tipo] */
export function aviso(msg, tipo = 'info') {
  const t = /** @type {any} */ (globalThis).showToast;
  if (typeof t === 'function') t(msg, tipo); else console.warn(msg);
}

/** @template T @param {Promise<T>} p @param {number} ms @returns {Promise<T>} */
export function conTope(p, ms) {
  return new Promise((ok, ko) => { const t = setTimeout(() => ko(new Error('tope')), ms); p.then(r => { clearTimeout(t); ok(r); }, e => { clearTimeout(t); ko(e); }); });
}

export const activa = () => (st.activa >= 0 ? st.zonas[st.activa] : null);

/** Los botones de arriba marcan el tipo `t`, que es el de la próxima zona. @param {Tipo} t */
export function marcarTipo(t) {
  st.tipo = t;
  document.querySelectorAll('.rv-tipo').forEach(b => {
    const on = /** @type {HTMLElement} */ (b).dataset.tipo === t;
    b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on));
  });
  $('rv-vacia-t').textContent = TEXTOS[t].vacia;
}

/**
 * La fuente reducida a `max` px de lado en un lienzo (uno nuevo, o `c` para
 * reusarlo: la toma en vivo mide dos veces por segundo).
 * @param {CanvasImageSource & {width:number,height:number}} fuente @param {number} max
 * @param {number} [ancho] @param {number} [alto] medidas reales, si `fuente` no las trae
 * @param {HTMLCanvasElement} [c]
 */
export function aLienzo(fuente, max, ancho = fuente.width, alto = fuente.height, c = document.createElement('canvas')) {
  const f = Math.min(1, max / Math.max(ancho, alto));
  c.width = Math.round(ancho * f); c.height = Math.round(alto * f);
  const ctx = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(fuente, 0, 0, c.width, c.height);
  return c;
}

/** Los píxeles que se analizan: 640 px de lado. @param {HTMLCanvasElement} c @param {HTMLCanvasElement} [destino] @returns {Imagen} */
export function pixeles(c, destino) {
  const ch = aLienzo(c, 640, c.width, c.height, destino);
  return /** @type {CanvasRenderingContext2D} */ (ch.getContext('2d')).getImageData(0, 0, ch.width, ch.height);
}

/** Dónde se ve la foto en la página: object-fit: contain puede dejar franjas en el lienzo. */
export function areaFoto() {
  const lz = $('rv-lienzo'), r = lz.getBoundingClientRect();
  const k = Math.min(r.width / lz.width, r.height / lz.height), w = lz.width * k, h = lz.height * k;
  return { x: r.left + (r.width - w) / 2, y: r.top + (r.height - h) / 2, w, h };
}

/** Coordenadas de un toque, en píxeles de la imagen analizada. @param {MouseEvent} e @param {boolean} [recortar] */
export function aImagen(e, recortar = false) {
  const f = /** @type {NonNullable<typeof st.foto>} */ (st.foto), a = areaFoto();
  let x = (e.clientX - a.x) / a.w, y = (e.clientY - a.y) / a.h;
  if (recortar) { x = Math.min(1, Math.max(0, x)); y = Math.min(1, Math.max(0, y)); }
  else if (x < 0 || y < 0 || x > 1 || y > 1) return null;
  return { x: x * f.img.width, y: y * f.img.height };
}

/** Vibración corta, si el teléfono la tiene y no se pidió menos movimiento. @param {number|number[]} ms */
export function vibrar(ms) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  try { navigator.vibrate?.(ms); } catch { /* sin vibración */ }
}

export const ease = (/** @type {number} */ t) => 1 - (1 - t) ** 3;

/** @param {string} s */
export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] || c);
