// Asistente de Piso · Copyright (c) 2026 Gerardo Barrera.
// Licencia PolyForm Noncommercial 1.0.0: uso comercial solo con licencia escrita (LICENCIA-COMERCIAL.md).
//
// Triangulación del focal (ADR 0007, punto 4). Recibe los puntos altos de
// cada elemento del focal —de un detector o tocados por la persona (plan B)—
// y revisa la geometría: la cima al centro, las alturas bajando hacia los
// lados y desnivel suficiente. El detector se inyecta; aquí solo hay números.

import { resultado, redondear } from './veredicto.js';

/** @typedef {import('./veredicto.js').Resultado} Resultado */
/** @typedef {{x:number,y:number}} Punto */

/* SUPUESTO (ADR 0007): el tercio central, 12 % de desnivel y una tolerancia
   de 4 % del alto para «baja hacia el lado». */
export const REGLA_TRIANGULO = { centroDesde: 1 / 3, centroHasta: 2 / 3, desnivelMinimo: 0.12, tolerancia: 0.04 };

/**
 * @param {Punto[]} puntos      punto más alto de cada elemento (y crece hacia abajo)
 * @param {{width:number,height:number}} tam  tamaño de la foto
 * @param {{origen?:'detector'|'manual', regla?:typeof REGLA_TRIANGULO}} [op]
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
  /* Que baje hacia los lados: de la cima hacia afuera, cada punto igual o más
     abajo que el anterior (con tolerancia). */
  let rompen = 0;
  for (let i = cima; i > 0; i--) if (ps[i - 1].y < ps[i].y - tol) rompen++;
  for (let i = cima; i < ps.length - 1; i++) if (ps[i + 1].y < ps[i].y - tol) rompen++;
  ev.cima_pos_pct = redondear(rel * 100, 0);
  ev.desnivel_pct = redondear(desnivel * 100, 0);
  ev.rompen_bajada = rompen;
  const base = Math.max(...ys);
  const marcas = { puntos: ps, cima: ps[cima], triangulo: [ps[cima], { x: xmin, y: base }, { x: xmax, y: base }] };

  if (desnivel < regla.desnivelMinimo)
    return resultado('triangulacion', 'GRAVE', `Todo está casi a la misma altura (desnivel ${redondear(desnivel * 100, 0)} %): no hay triángulo. Usa niveles y desniveles.`, ev, { ...marcas, triangulo: null });
  if (cima === 0 || cima === ps.length - 1)
    return resultado('triangulacion', 'GRAVE', `El punto más alto está en un extremo: es una escalera, no un triángulo.`, ev, { ...marcas, triangulo: null });
  const centrada = rel >= regla.centroDesde && rel <= regla.centroHasta;
  if (centrada && !rompen)
    return resultado('triangulacion', 'CUMPLE', `Triángulo: la cima al centro (${redondear(rel * 100, 0)} %) y las alturas bajan hacia los lados (desnivel ${redondear(desnivel * 100, 0)} %).`, ev, marcas);
  const porque = [!centrada ? `la cima está corrida (${redondear(rel * 100, 0)} % del ancho)` : '', rompen ? `${rompen} ${rompen === 1 ? 'elemento rompe' : 'elementos rompen'} la bajada` : ''].filter(Boolean).join(' y ');
  return resultado('triangulacion', 'OBSERVACIÓN', `Hay triángulo, pero ${porque}.`, ev, marcas);
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
  const cats = op.categorias || ['person', 'potted plant', 'handbag', 'vase', 'chair', 'backpack', 'suitcase', 'umbrella', 'bench', 'teddy bear', 'bottle', 'tie'];
  const buenas = cajas.filter(c => c.score >= min && cats.includes(c.categoria)).sort((a, b) => b.score - a.score);
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
