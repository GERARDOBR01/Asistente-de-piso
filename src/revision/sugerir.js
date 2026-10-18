// Asistente de Piso · Copyright (c) 2026 Gerardo Barrera.
// Licencia PolyForm Noncommercial 1.0.0: uso comercial solo con licencia escrita (LICENCIA-COMERCIAL.md).
//
// «Sugerir» del focal (ADR 0007): el detector propone los elementos y la
// persona confirma. Medido el 11-oct con 5 focales reales (17 cimas
// etiquetadas, `eval/revision.mjs --sugerir`), el método de antes —detector
// sobre la foto entera y el punto en lo alto de cada caja— encontraba 8 de 17
// cimas, y 3 de sus 11 sugerencias caían en el fondo. Lo que cambia aquí:
//
// 1. Se detecta sobre el recorte del marco (con un margen), no sobre la foto
//    entera: un maniquí que en la foto completa salía con 0.57 sale con 0.75,
//    y aparece la bolsa que antes no se veía.
// 2. Fuera lo que es fondo: una caja que ocupa más de 60 % del marco, que
//    llega cortada al borde de arriba del recorte (sigue hacia el techo), o
//    una «persona» mucho más chica que la más alta (está al fondo).
// 3. Duplicados por IoU real y solo dentro de la misma categoría: la bolsa
//    sobre el maniquí ya no se pierde por estar dentro de su caja.
// 4. Cada caja se afina con la silueta (Magic Touch) desde un toque virtual en
//    su parte de arriba: si la silueta se sale de la caja, no se le cree y se
//    queda lo alto de la caja.
// 5. Se fusiona con lo que la persona ya tocó, sin pisarlo.
// 6. (17-oct) Solo lo que está en la exhibición: fuera lo que lleva puesto un
//    maniquí, su base, lo cortado por la orilla y lo que queda lejos del grupo
//    de maniquíes (ver enLaExhibicion).
//
// Aquí va lo puro (elegirCajas, cimaCreible, fusionarPuntos), sin DOM y con
// pruebas en lab/revision.test.mjs. Recortar, detectar y afinar con la silueta
// lo orquesta sugerirPuntos, en detector.js.

/** @typedef {{x:number,y:number,w:number,h:number,categoria:string,score:number}} Caja */
/** @typedef {{x:number,y:number,w:number,h:number}} Rect */

/** Lo que suele ir en un focal. Sin muebles: la mesa es la base, no un elemento. */
export const CATEGORIAS_FOCAL = ['person', 'potted plant', 'handbag', 'vase', 'backpack', 'suitcase', 'umbrella', 'teddy bear', 'bottle', 'tie'];
export const REGLA_SUGERIR = {
  margen: 0.08,          // el recorte crece esto por lado (en fracción del marco)
  minPersona: 0.25,      // un maniquí en el recorte casi siempre pasa de 0.25
  minObjeto: 0.35,      // por debajo, en las fotos medidas, eran fondo
  areaMaxima: 0.6,       // del recorte: lo que lo llena es pared o mueble
  personaMinima: 0.45,   // del alto de la persona más alta
  iou: 0.5,              // misma categoría y más que esto: es el mismo
  tope: 9,               // elementos que se revisan en un focal
};

/* Gerardo (17-oct): «a veces agrega la sugerencia en puntos fuera de la
   exhibición». En 27 focales reales, sin zona dibujada, los puntos de más eran:
   la corbata, la mochila puesta o la bolsa en la mano de un maniquí; la base
   de un maniquí («suitcase»); un maniquí o un cliente cortado por la orilla de
   la foto; un póster con una persona; y bolsas o ropa doblada de otro mueble.
   Lo que sigue lo quita sin tocar lo de en medio de la exhibición. */
export const REGLA_EXHIBICION = {
  activa: true,
  borde: 0.01,      // a menos de esto de la orilla del recorte, la caja está cortada por la foto
  parcial: 0.7,     // cortada por la orilla y más angosta o baja que esto del maniquí guía: es de otro lado
  flotando: 0.35,   // con los pies más arriba que esto (del alto del maniquí guía): un póster, otra área
  /* Medido en esos focales, en anchos de maniquí: lo de la exhibición queda a
     0.2-1.5 del grupo (una bolsa en su base a 1.2, el perchero del focal a
     1.5); el muro de bolsas de al lado, a 1.9. */
  margen: 1.6,      // un objeto va a menos de esto (del ancho medio de los maniquíes) del grupo
  puesto: 0.7,      // un objeto con esta parte dentro de un maniquí lo lleva puesto
  pies: 0.2,        // un objeto que empieza en el último 20 % de un maniquí, debajo de él, es su base
  arriba: 0.2,      // un objeto que termina en el 20 % de arriba del recorte es decoración del muro
};

/** Cómo se dice en el piso por qué no se contó algo. */
export const MOTIVO_FUERA = {
  puesto: 'lo que lleva puesto un maniquí', base: 'la base de un maniquí', orilla: 'lo cortado por la orilla de la foto',
  flota: 'una figura que no está en el piso de la exhibición', lejos: 'lo que está lejos del grupo', arriba: 'la decoración de arriba',
};

/** @param {Rect} a @param {Rect} b */
const cruceX = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));

/**
 * Solo lo que está en la exhibición (ver REGLA_EXHIBICION).
 * - Maniquíes: el guía es el más alto de los que no toca la orilla. Fuera los
 *   cortados por la orilla y más chicos que él, y los que «flotan» (pies muy
 *   por arriba de los suyos).
 * - Objetos: fuera lo que queda arriba de todo (decoración del muro) y, si hay
 *   maniquíes, lo que uno lleva puesto, su base, lo cortado por la orilla y lo
 *   que queda lejos del grupo. Sin maniquíes no hay grupo contra el cual medir.
 * @param {Caja[]} cajas en píxeles del recorte @param {{w:number,h:number}} recorte
 * @param {typeof REGLA_EXHIBICION} [regla]
 * @param {{categoria:string, motivo:keyof typeof MOTIVO_FUERA}[]} [fuera] aquí se anota lo que se quitó y por qué
 * @returns {Caja[]}
 */
export function enLaExhibicion(cajas, recorte, regla = REGLA_EXHIBICION, fuera = []) {
  if (!regla.activa) return cajas;
  const W = recorte.w, H = recorte.h;
  const enBorde = (/** @type {Caja} */ c) => c.x <= regla.borde * W || c.x + c.w >= (1 - regla.borde) * W;
  let personas = cajas.filter(c => c.categoria === 'person');
  if (personas.length) {
    const libres = personas.filter(p => !enBorde(p));
    const guia = (libres.length ? libres : personas).reduce((a, b) => (b.h > a.h ? b : a));
    personas = personas.filter(p => {
      if (p === guia) return true;
      if (enBorde(p) && (p.w < regla.parcial * guia.w || p.h < regla.parcial * guia.h)) { fuera.push({ categoria: p.categoria, motivo: 'orilla' }); return false; }
      if (guia.y + guia.h - (p.y + p.h) > regla.flotando * guia.h) { fuera.push({ categoria: p.categoria, motivo: 'flota' }); return false; }
      return true;
    });
  }
  const area = (/** @type {Caja} */ c) => Math.max(1, c.w * c.h);
  const dentro = (/** @type {Caja} */ o, /** @type {Caja} */ p) => cruceX(o, p) * Math.max(0, Math.min(o.y + o.h, p.y + p.h) - Math.max(o.y, p.y)) / area(o);
  const x0 = Math.min(...personas.map(p => p.x)), x1 = Math.max(...personas.map(p => p.x + p.w));
  const margen = personas.length ? regla.margen * personas.reduce((s, p) => s + p.w, 0) / personas.length : 0;
  /** @param {Caja} o @returns {keyof typeof MOTIVO_FUERA | null} */
  const motivo = o => {
    if (o.y + o.h <= regla.arriba * H) return 'arriba';
    if (!personas.length) return null;
    if (personas.some(p => dentro(o, p) >= regla.puesto && o.y + o.h / 2 < p.y + p.h * (1 - regla.pies))) return 'puesto';
    if (personas.some(p => o.y >= p.y + p.h * (1 - regla.pies) && cruceX(o, p) >= 0.5 * o.w)) return 'base';
    if (enBorde(o)) return 'orilla';
    if (o.x + o.w / 2 < x0 - margen || o.x + o.w / 2 > x1 + margen) return 'lejos';
    return null;
  };
  const objetos = cajas.filter(o => {
    if (o.categoria === 'person') return false;
    const m = motivo(o);
    if (m) fuera.push({ categoria: o.categoria, motivo: m });
    return !m;
  });
  return cajas.filter(c => personas.includes(c) || objetos.includes(c));
}

/** @param {Rect} a @param {Rect} b */
export function iou(a, b) {
  const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const i = ix * iy;
  return i ? i / (a.w * a.h + b.w * b.h - i) : 0;
}

/**
 * El recorte del marco con su margen, en píxeles de la imagen.
 * @param {Rect} marco en fracción @param {number} W @param {number} H @param {number} [margen]
 * @returns {Rect}
 */
export function recorteDe(marco, W, H, margen = REGLA_SUGERIR.margen) {
  const x0 = Math.max(0, (marco.x - margen * marco.w) * W), y0 = Math.max(0, (marco.y - margen * marco.h) * H);
  const x1 = Math.min(W, (marco.x + marco.w * (1 + margen)) * W), y1 = Math.min(H, (marco.y + marco.h * (1 + margen)) * H);
  return { x: Math.round(x0), y: Math.round(y0), w: Math.round(x1 - x0), h: Math.round(y1 - y0) };
}

/**
 * De las cajas del detector (en píxeles del recorte) a los elementos del focal.
 * @param {Caja[]} cajas
 * @param {{w:number,h:number,cortadoArriba:boolean}} recorte  `cortadoArriba`: el recorte no empieza en el borde de la foto
 * @param {typeof REGLA_SUGERIR} [regla]
 * @param {{categoria:string, motivo:keyof typeof MOTIVO_FUERA}[]} [fuera] lo que se quitó por no ser de la exhibición
 * @returns {Caja[]}
 */
export function elegirCajas(cajas, recorte, regla = REGLA_SUGERIR, fuera = []) {
  let buenas = cajas.filter(c => CATEGORIAS_FOCAL.includes(c.categoria)
    && c.score >= (c.categoria === 'person' ? regla.minPersona : regla.minObjeto)
    && (c.w * c.h) / (recorte.w * recorte.h) <= regla.areaMaxima
    /* Cortada por arriba del recorte: sigue hacia el techo, es fondo. */
    && !(recorte.cortadoArriba && c.y <= 1));
  const altoMax = Math.max(0, ...buenas.filter(c => c.categoria === 'person').map(c => c.h));
  buenas = buenas.filter(c => c.categoria !== 'person' || c.h >= regla.personaMinima * altoMax)
    .sort((a, b) => b.score - a.score);
  /** @type {Caja[]} */
  const quedan = [];
  for (const c of buenas) if (!quedan.some(q => q.categoria === c.categoria && iou(q, c) > regla.iou)) quedan.push(c);
  /* La base de un elemento no es otro elemento: un objeto que empieza justo
     donde termina otro, y debajo de él, es el pedestal o la caja en que está
     (el detector la llama «suitcase»). Medido en un focal real con dos
     bolsas sobre bases. */
  /* Tiene que ser al menos igual de ancha y el de arriba quedar casi entero
     sobre ella: dos bolsas en bases escalonadas se tocan sin ser base una de
     la otra. */
  const base = (/** @type {Caja} */ b) => b.categoria !== 'person' && quedan.some(a => a !== b
    && Math.abs(a.y + a.h - b.y) <= 0.04 * recorte.h && b.w >= 0.9 * a.w
    && Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) >= 0.8 * a.w);
  return enLaExhibicion(quedan.filter(c => !base(c)), recorte, REGLA_EXHIBICION, fuera).slice(0, regla.tope);
}

/**
 * ¿Se le cree a la silueta de una caja? Su cima tiene que caer dentro de la
 * caja a lo ancho y cerca de su parte de arriba: si sube mucho más, se juntó
 * con lo de atrás; si baja mucho, agarró solo un pedazo.
 * @param {Rect} caja en píxeles @param {{x:number,y:number}} cima en píxeles @param {number} H alto de la imagen
 */
export function cimaCreible(caja, cima, H) {
  return cima.x >= caja.x && cima.x <= caja.x + caja.w
    && cima.y >= caja.y - 0.03 * H && cima.y <= caja.y + 0.25 * caja.h;
}

/**
 * Lo que ya tocó la persona se queda; de lo sugerido entra lo que no choca.
 * @template {{x:number,y:number}} P
 * @param {P[]} previos @param {P[]} nuevos @param {number} cerca en píxeles @param {number} [tope]
 * @returns {{puntos: P[], agregados: number}}
 */
export function fusionarPuntos(previos, nuevos, cerca, tope = REGLA_SUGERIR.tope) {
  const puntos = [...previos];
  let agregados = 0;
  for (const n of nuevos) {
    if (puntos.length >= tope) break;
    if (puntos.some(p => Math.hypot(p.x - n.x, p.y - n.y) < cerca)) continue;
    puntos.push(n); agregados++;
  }
  return { puntos, agregados };
}
