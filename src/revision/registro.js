// Asistente de Piso · Copyright (c) 2026 Gerardo Barrera.
// Licencia PolyForm Noncommercial 1.0.0: uso comercial solo con licencia escrita (LICENCIA-COMERCIAL.md).
//
// Revisar (ADR 0007): lo que se guarda de una revisión en el historial y cómo
// se resume. Puro y sin DOM: la foto y la miniatura (Blob) las pone
// historial.js; aquí van las zonas, los resultados, el origen, el área y lo
// revisado a mano, como datos planos que IndexedDB puede guardar.

import { peor } from './veredicto.js';

/** @typedef {import('./veredicto.js').Nivel} Nivel */
/** @typedef {import('./veredicto.js').Resultado} Resultado */

/** Cuántas revisiones caben. A ~300 KB cada una, unos 90 MB en el teléfono. */
export const TOPE_HISTORIAL = 300;

/** Largo máximo del nombre de un área. */
export const LARGO_AREA = 40;

/**
 * Copia de solo datos: números, textos, booleanos, null, arreglos y objetos
 * simples. Se cae lo demás (el lienzo de la silueta de un punto, funciones):
 * IndexedDB no guarda un HTMLCanvasElement y la transacción se aborta.
 * @param {any} v @returns {any}
 */
export function aDatos(v) {
  if (v === null || typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return v;
  if (Array.isArray(v)) return v.map(aDatos).filter(x => x !== undefined);
  if (typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) {
    /** @type {Record<string, any>} */
    const o = {};
    for (const [k, x] of Object.entries(v)) { const d = aDatos(x); if (d !== undefined) o[k] = d; }
    return o;
  }
  return undefined;
}

/** @param {string} s */
export function normalizarArea(s) {
  return String(s || '').replace(/\s+/g, ' ').trim().slice(0, LARGO_AREA);
}

/** Para comparar sin acentos ni mayúsculas. @param {string} s */
const llano = s => normalizarArea(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * El resumen que se ve en la lista: el peor nivel de la revisión y el peor de
 * cada básico. Una zona sin resultados (un focal que espera sus puntos) no cuenta.
 * @param {{res: Resultado[]|null}[]} zonas
 * @returns {{nivel: Nivel|null, basicos: Record<string, Nivel>}}
 */
export function resumen(zonas) {
  /** @type {Record<string, Nivel[]>} */
  const por = {};
  for (const z of zonas) for (const r of z.res || []) (por[r.basico] ??= []).push(r.nivel);
  /** @type {Record<string, Nivel>} */
  const basicos = {};
  for (const [b, ns] of Object.entries(por)) basicos[b] = peor(ns);
  const todos = Object.values(por).flat();
  return { nivel: todos.length ? peor(todos) : null, basicos };
}

/**
 * Los datos de una revisión para guardar (sin la foto ni la miniatura).
 * @param {{zonas: any[], origen: any, area: string, via: string, tomada: Date|null, revisado: string[], tam: {w:number,h:number}}} r
 */
export function registroDe(r) {
  const zonas = r.zonas.map(z => aDatos({
    tipo: z.tipo, marco: z.marco, guia: z.guia, puntos: z.puntos, origenPuntos: z.origenPuntos,
    vestidos: z.vestidos, maniquies: z.maniquies, res: z.res,
  }));
  const { nivel, basicos } = resumen(zonas);
  return {
    zonas, nivel, basicos,
    origen: aDatos(r.origen),
    huella: String(r.origen?.evidencia?.huella || ''),
    area: normalizarArea(r.area),
    via: r.via,
    tomada: r.tomada ? r.tomada.getTime() : null,
    revisado: r.revisado.filter(x => typeof x === 'string'),
    tam: { w: r.tam.w, h: r.tam.h },
  };
}

/**
 * Las áreas para sugerir mientras se escribe: las ya usadas (la más usada y
 * reciente primero) y luego las de siempre, sin repetir y que empiecen o
 * contengan lo escrito (sin acentos ni mayúsculas).
 * @param {{area:string, creada:number}[]} registros @param {string} escrito @param {string[]} [base]
 * @returns {string[]}
 */
export function sugerenciasDeArea(registros, escrito, base = []) {
  /** @type {Map<string, {area:string, n:number, ultima:number}>} */
  const usadas = new Map();
  for (const r of registros) {
    const a = normalizarArea(r.area);
    if (!a) continue;
    const k = llano(a), u = usadas.get(k);
    if (u) { u.n++; if (r.creada > u.ultima) { u.ultima = r.creada; u.area = a; } } else usadas.set(k, { area: a, n: 1, ultima: r.creada });
  }
  const orden = [...usadas.values()].sort((a, b) => b.n - a.n || b.ultima - a.ultima).map(u => u.area);
  const vistas = new Set(orden.map(llano));
  const todas = [...orden, ...base.filter(a => !vistas.has(llano(a)))];
  const q = llano(escrito);
  if (!q) return todas;
  return [...todas.filter(a => llano(a).startsWith(q)), ...todas.filter(a => !llano(a).startsWith(q) && llano(a).includes(q))];
}

/**
 * Qué borrar para que el historial no pase del tope: las más viejas.
 * @param {{id:string, creada:number}[]} registros @param {number} [tope]
 * @returns {string[]} ids
 */
export function aRecortar(registros, tope = TOPE_HISTORIAL) {
  if (registros.length <= tope) return [];
  return [...registros].sort((a, b) => a.creada - b.creada).slice(0, registros.length - tope).map(r => r.id);
}

/**
 * Agrupa por día para la lista: «Hoy», «Ayer» o la fecha.
 * @param {number} ms @param {number} [ahora]
 */
export function cuando(ms, ahora = Date.now()) {
  const d = new Date(ms), h = new Date(ahora);
  const dia = (/** @type {Date} */ x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dias = Math.round((dia(h) - dia(d)) / 86400000);
  const hora = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (dias === 0) return `Hoy · ${hora}`;
  if (dias === 1) return `Ayer · ${hora}`;
  const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${d.getDate()} ${MES[d.getMonth()]}${d.getFullYear() !== h.getFullYear() ? ' ' + d.getFullYear() : ''} · ${hora}`;
}
