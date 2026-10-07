// Asistente de Piso · Copyright (c) 2026 Gerardo Barrera.
// Licencia PolyForm Noncommercial 1.0.0: uso comercial solo con licencia escrita (LICENCIA-COMERCIAL.md).
//
// Triangulación y niveles del focal (ADR 0007, punto 4). Recibe los puntos
// altos de cada elemento del focal —de un detector o tocados por la persona—
// y revisa la geometría: una sola cima, desnivel suficiente y cuántas alturas
// distintas hay. El detector se inyecta; aquí solo hay números.

import { resultado, redondear } from './veredicto.js';

/** @typedef {import('./veredicto.js').Resultado} Resultado */
/** @typedef {{x:number,y:number}} Punto */

/* Regla con las fotos reales de tienda (7-oct, confirmada por Gerardo: «el
   asimétrico vale»). Un focal hace triángulo si tiene UNA cima: un elemento
   claramente más alto que todos los demás, esté al centro (simétrico) o a un
   lado (asimétrico, bajando por bases y bolsas). Los dos focales reales
   salieron así: uno con la cima al 25 % del ancho y otro con la cima en un
   extremo (maniquí en tarima, zapato en base, maniquí en piso).
   - GRAVE: todo casi a la misma altura (desnivel < 12 % del alto).
   - OBSERVACIÓN: dos o más elementos empatan arriba (a menos de 4 % del
     alto): no hay un punto alto que guíe la vista.
   - CUMPLE: una sola cima, con desnivel.
   La posición de la cima se reporta (simétrico/asimétrico) pero no castiga. */
export const REGLA_TRIANGULO = { centroDesde: 0.3, centroHasta: 0.7, desnivelMinimo: 0.12, tolerancia: 0.04 };

/* Alturas y niveles (básico de display de la guía). SUPUESTO POR CONFIRMAR:
   tres alturas o más (alto, medio y bajo) separadas al menos 4 % del alto
   de la foto; con solo dos alturas, OBSERVACIÓN. */
export const REGLA_NIVELES = { separacion: 0.04, minimo: 3 };

/**
 * @param {Punto[]} puntos      punto más alto de cada elemento (y crece hacia abajo)
 * @param {{width:number,height:number}} tam  tamaño de la foto
 * @param {{origen?:'detector'|'manual'|'detector+manual', regla?:typeof REGLA_TRIANGULO}} [op]
 * @returns {Resultado}
 */
export function revisarTriangulo(puntos, tam, op = {}) {
  const regla = op.regla || REGLA_TRIANGULO;
  /** @type {Record<string, string|number|boolean|null>} */
  const ev = { puntos: puntos.length, origen_puntos: op.origen || 'manual' };
  if (puntos.length < 3)
    return resultado('triangulacion', 'NO_CALIFICA', `Hacen falta al menos 3 elementos para hablar de triángulo (hay ${puntos.length}).`, ev, { puntos });
  const ps = puntos.slice().sort((a, b) => a.x - b.x);
  const H = tam.height;
  let cima = 0;
  ps.forEach((p, i) => { if (p.y < ps[cima].y) cima = i; });
  const xmin = ps[0].x, xmax = ps[ps.length - 1].x;
  const rel = xmax > xmin ? (ps[cima].x - xmin) / (xmax - xmin) : 0.5;
  const ys = ps.map(p => p.y);
  const desnivel = (Math.max(...ys) - Math.min(...ys)) / H;
  const tol = regla.tolerancia * H;
  /* Los que empatan con la cima: a menos de `tol` de su altura. */
  const empatan = ps.filter((p, i) => i !== cima && p.y - ps[cima].y < tol);
  const centrada = rel >= regla.centroDesde && rel <= regla.centroHasta;
  ev.cima_pos_pct = redondear(rel * 100, 0);
  ev.desnivel_pct = redondear(desnivel * 100, 0);
  ev.empatan_arriba = empatan.length;
  ev.forma = centrada ? 'simétrico' : 'asimétrico';
  const base = Math.max(...ys);
  const marcas = { puntos: ps, cima: ps[cima], triangulo: [ps[cima], { x: xmin, y: base }, { x: xmax, y: base }] };

  if (desnivel < regla.desnivelMinimo)
    return resultado('triangulacion', 'GRAVE', `Todo está casi a la misma altura (desnivel ${redondear(desnivel * 100, 0)} %): no hay triángulo. Usa niveles y desniveles.`, ev, { ...marcas, triangulo: null });
  if (empatan.length)
    return resultado('triangulacion', 'OBSERVACIÓN', `${empatan.length + 1} elementos quedan a la misma altura arriba: no hay una cima que guíe la vista. Sube uno o baja los otros.`, ev, { ...marcas, triangulo: null });
  const donde = centrada ? `la cima al centro (${redondear(rel * 100, 0)} %)` : `la cima a un lado (${redondear(rel * 100, 0)} % del ancho), asimétrico`;
  return resultado('triangulacion', 'CUMPLE', `Triángulo con ${donde} y desnivel de ${redondear(desnivel * 100, 0)} %.`, ev, marcas);
}

/**
 * Alturas y niveles: cuántas alturas distintas hay entre los elementos.
 * @param {Punto[]} puntos @param {{width:number,height:number}} tam
 * @param {{origen?:'detector'|'manual'|'detector+manual', regla?:typeof REGLA_NIVELES, desnivelMinimo?:number}} [op]
 * @returns {Resultado}
 */
export function revisarNiveles(puntos, tam, op = {}) {
  const regla = op.regla || REGLA_NIVELES;
  /** @type {Record<string, string|number|boolean|null>} */
  const ev = { puntos: puntos.length, origen_puntos: op.origen || 'manual' };
  if (puntos.length < 2)
    return resultado('niveles', 'NO_CALIFICA', `Hacen falta al menos 2 elementos para comparar alturas (hay ${puntos.length}).`, ev, { puntos });
  const ys = puntos.map(p => p.y / tam.height).sort((a, b) => a - b);
  /* Alturas que se separan al menos `separacion` de la anterior forman otro nivel. */
  /** @type {number[][]} */
  const niveles = [[ys[0]]];
  for (let i = 1; i < ys.length; i++) {
    if (ys[i] - ys[i - 1] >= regla.separacion) niveles.push([ys[i]]);
    else niveles[niveles.length - 1].push(ys[i]);
  }
  const desnivel = ys[ys.length - 1] - ys[0];
  ev.niveles = niveles.length;
  ev.desnivel_pct = redondear(desnivel * 100, 0);
  const marcas = { puntos, niveles: niveles.map(n => n.reduce((s, y) => s + y, 0) / n.length * tam.height) };
  if (desnivel < (op.desnivelMinimo ?? REGLA_TRIANGULO.desnivelMinimo) || niveles.length < 2)
    return resultado('niveles', 'GRAVE', `Todo a la misma altura (desnivel ${redondear(desnivel * 100, 0)} %). Usa bases, mesas o bustos para crear niveles.`, ev, marcas);
  if (niveles.length < regla.minimo)
    return resultado('niveles', 'OBSERVACIÓN', niveles.length === 2 ? 'Solo hay 2 alturas: falta un nivel medio entre lo alto y lo bajo.' : `Solo hay ${niveles.length} alturas; se piden ${regla.minimo}.`, ev, marcas);
  return resultado('niveles', 'CUMPLE', `${niveles.length} alturas distintas, con ${redondear(desnivel * 100, 0)} % de desnivel.`, ev, marcas);
}

/* Silueta de un toque (MediaPipe Magic Touch, en silueta.js). Si el objeto
   tocado ocupa más de este pedazo de la foto, o su silueta llega al borde de
   arriba, la silueta se «derramó» (al techo, a la pared) y no se le cree. */
export const REGLA_SILUETA = { areaMaxima: 0.35, bordeArriba: 0.005 };

/**
 * La cima del objeto que se tocó, a partir de la máscara del segmentador.
 * El objeto es la región conexa que contiene el pixel tocado (sea 0 o 255 en
 * la máscara: se toma el valor que tiene ahí). Su cima es el renglón más alto;
 * en x, la mediana de ese renglón.
 * @param {Uint8Array|Uint8ClampedArray} mask  un byte por pixel
 * @param {number} W @param {number} H
 * @param {{x:number,y:number}} toque  en fracción de la imagen
 * @param {typeof REGLA_SILUETA} [regla]
 * @returns {{cima:{x:number,y:number}, caja:{x0:number,y0:number,x1:number,y1:number}, area:number, objeto:Uint8Array, W:number, H:number}|null}
 *   cima, caja y área en fracción; `objeto` marca con 1 sus píxeles (para pintarlo); null si no hay objeto creíble
 */
export function cimaDeSilueta(mask, W, H, toque, regla = REGLA_SILUETA) {
  const sx = Math.min(W - 1, Math.max(0, Math.round(toque.x * (W - 1))));
  const sy = Math.min(H - 1, Math.max(0, Math.round(toque.y * (H - 1))));
  const valor = mask[sy * W + sx];
  const visto = new Uint8Array(W * H);
  const pila = [sy * W + sx];
  visto[sy * W + sx] = 1;
  let n = 0, x0 = W, y0 = H, x1 = -1, y1 = -1;
  /** @type {number[]} */
  let fila = [];
  while (pila.length) {
    const i = /** @type {number} */ (pila.pop());
    const x = i % W, y = (i - x) / W;
    n++;
    if (y < y0) { y0 = y; fila = [x]; } else if (y === y0) fila.push(x);
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
    if (x > 0 && !visto[i - 1] && mask[i - 1] === valor) { visto[i - 1] = 1; pila.push(i - 1); }
    if (x < W - 1 && !visto[i + 1] && mask[i + 1] === valor) { visto[i + 1] = 1; pila.push(i + 1); }
    if (y > 0 && !visto[i - W] && mask[i - W] === valor) { visto[i - W] = 1; pila.push(i - W); }
    if (y < H - 1 && !visto[i + W] && mask[i + W] === valor) { visto[i + W] = 1; pila.push(i + W); }
  }
  const area = n / (W * H);
  if (area > regla.areaMaxima || y0 / H < regla.bordeArriba) return null;
  fila.sort((a, b) => a - b);
  const cx = fila[fila.length >> 1];
  return { cima: { x: cx / W, y: y0 / H }, caja: { x0: x0 / W, y0: y0 / H, x1: (x1 + 1) / W, y1: (y1 + 1) / H }, area, objeto: visto, W, H };
}

/**
 * Cajas de un detector → puntos altos. Se quedan las categorías que suelen ir
 * en un focal y con confianza suficiente; las cajas casi iguales se funden.
 * @param {{x:number,y:number,w:number,h:number,categoria:string,score:number}[]} cajas
 * @param {{minScore?:number, categorias?:string[]}} [op]
 * @returns {Punto[]}
 */
export function puntosDeCajas(cajas, op = {}) {
  const min = op.minScore ?? 0.3;
  /* Sin muebles (mesa, banca, silla): son la base del focal, no un elemento.
     Medido con los focales del manual: el detector marcaba la mesa entera. */
  const cats = op.categorias || ['person', 'potted plant', 'handbag', 'vase', 'backpack', 'suitcase', 'umbrella', 'teddy bear', 'bottle', 'tie'];
  let buenas = cajas.filter(c => c.score >= min && cats.includes(c.categoria)).sort((a, b) => b.score - a.score);
  /* Una «persona» mucho más chica que la más alta está al fondo (clientes o
     maniquíes de otro departamento), no en el focal. */
  const altoMax = Math.max(0, ...buenas.filter(c => c.categoria === 'person').map(c => c.h));
  buenas = buenas.filter(c => c.categoria !== 'person' || c.h >= 0.45 * altoMax);
  /** @type {typeof buenas} */
  const quedan = [];
  for (const c of buenas) {
    const tapa = quedan.some(q => {
      const ix = Math.max(0, Math.min(q.x + q.w, c.x + c.w) - Math.max(q.x, c.x));
      const iy = Math.max(0, Math.min(q.y + q.h, c.y + c.h) - Math.max(q.y, c.y));
      return (ix * iy) / Math.min(q.w * q.h, c.w * c.h) > 0.6;
    });
    if (!tapa) quedan.push(c);
  }
  return quedan.map(c => ({ x: c.x + c.w / 2, y: c.y }));
}
