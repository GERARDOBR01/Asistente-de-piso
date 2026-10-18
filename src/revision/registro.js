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

/** Para comparar áreas sin acentos ni mayúsculas. @param {string} s */
export const llano = s => normalizarArea(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

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

/* ── Antes y después ──────────────────────────────────────────────────── */

/** @typedef {'corregido'|'mejoro'|'igual'|'empeoro'|'nuevo'|'sin dato'} Cambio */

const GRAVEDAD = /** @type {Record<string, number>} */ ({ CUMPLE: 0, 'OBSERVACIÓN': 1, GRAVE: 2 });

/**
 * Cada básico de la revisión de ahora contra el de antes, zona por zona (las
 * zonas de «Volver a revisar» van en el mismo orden). Corregido: antes no
 * cumplía y ahora cumple. Si alguna de las dos no calificó, no hay con qué
 * comparar. Una zona de otro tipo, o una que antes no estaba, es nueva.
 * @param {{tipo:string, res: Resultado[]|null}[]} antes @param {{tipo:string, res: Resultado[]|null}[]} ahora
 * @returns {{zona:number, basico:string, antes:Nivel|null, ahora:Nivel, cambio:Cambio}[]}
 */
export function comparar(antes, ahora) {
  /** @type {{zona:number, basico:string, antes:Nivel|null, ahora:Nivel, cambio:Cambio}[]} */
  const filas = [];
  ahora.forEach((z, i) => {
    const za = antes[i] && antes[i].tipo === z.tipo ? antes[i] : null;
    for (const r of z.res || []) {
      const ra = za?.res?.find(x => x.basico === r.basico) || null;
      /** @type {Cambio} */
      let cambio;
      if (!ra) cambio = 'nuevo';
      else if (!(ra.nivel in GRAVEDAD) || !(r.nivel in GRAVEDAD)) cambio = 'sin dato';
      else if (GRAVEDAD[ra.nivel] > 0 && GRAVEDAD[r.nivel] === 0) cambio = 'corregido';
      else if (GRAVEDAD[r.nivel] < GRAVEDAD[ra.nivel]) cambio = 'mejoro';
      else if (GRAVEDAD[r.nivel] === GRAVEDAD[ra.nivel]) cambio = 'igual';
      else cambio = 'empeoro';
      filas.push({ zona: i, basico: r.basico, antes: ra ? ra.nivel : null, ahora: r.nivel, cambio });
    }
  });
  return filas;
}

/**
 * En una frase y en números: cuántos se corrigieron de los que estaban mal.
 * @param {{antes:Nivel|null, ahora:Nivel, cambio:Cambio}[]} filas
 */
export function resumenCambios(filas) {
  const malos = filas.filter(f => f.antes && f.antes !== 'CUMPLE' && f.antes !== 'NO_CALIFICA');
  const corregidos = filas.filter(f => f.cambio === 'corregido').length;
  const empeoraron = filas.filter(f => f.cambio === 'empeoro').length;
  const pendientes = malos.length - corregidos;
  const texto = !malos.length
    ? (empeoraron ? `${empeoraron} ${empeoraron === 1 ? 'empeoró' : 'empeoraron'}` : 'Ya cumplía')
    : `${corregidos} de ${malos.length} ${malos.length === 1 ? 'corregido' : 'corregidos'}${empeoraron ? ` · ${empeoraron} ${empeoraron === 1 ? 'empeoró' : 'empeoraron'}` : ''}`;
  return { corregidos, pendientes, empeoraron, todo: malos.length > 0 && pendientes === 0 && !empeoraron, texto };
}

/**
 * Los datos de una revisión para guardar (sin la foto ni la miniatura).
 * `antes`: la revisión de la que esta es «Volver a revisar».
 * @param {{zonas: any[], origen: any, area: string, via: string, tomada: Date|null, revisado: string[], tam: {w:number,h:number}, antes?: {id:string, zonas:any[]}|null, notas?: any[]}} r
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
    antes: r.antes ? r.antes.id : null,
    notas: aDatos(r.notas || []),
    cambios: r.antes ? resumenCambios(comparar(r.antes.zonas, zonas)) : null,
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

/* ── Ronda: las exhibiciones de un área en un día ──────────────────────── */

/** Lo que vale cada exhibición en el índice. NO_CALIFICA no cuenta: no dice nada del montaje. */
export const PUNTOS = /** @type {Record<string, number>} */ ({ CUMPLE: 1, 'OBSERVACIÓN': 0.5, GRAVE: 0 });

/** El día local de un instante, como número para comparar. @param {number} ms */
const diaDe = ms => { const d = new Date(ms); return d.getFullYear() * 10000 + d.getMonth() * 100 + d.getDate(); };

/**
 * Las revisiones que siguen vigentes: si una se volvió a revisar, cuenta la de después.
 * @template {{id:string, antes?:string|null}} R @param {R[]} registros @returns {R[]}
 */
export function vigentes(registros) {
  const reemplazadas = new Set(registros.map(r => r.antes).filter(Boolean));
  return registros.filter(r => !reemplazadas.has(r.id));
}

/**
 * La ronda de un área en el día de `cuandoMs`: cada zona de cada revisión
 * vigente es una exhibición. Índice: promedio de CUMPLE 1, OBSERVACIÓN ½,
 * GRAVE 0 (sin las que no calificaron). Pendientes: lo que no cumple, primero
 * lo GRAVE y en el orden en que se revisó.
 * @param {{id:string, area:string, creada:number, antes?:string|null, zonas:{tipo:string, res:Resultado[]|null}[], cambios?:any}[]} registros
 * @param {string} area @param {number} cuandoMs
 */
export function ronda(registros, area, cuandoMs) {
  const k = llano(area), dia = diaDe(cuandoMs);
  const delDia = registros.filter(r => llano(r.area) === k && diaDe(r.creada) === dia).sort((a, b) => a.creada - b.creada);
  const vig = vigentes(delDia);
  const exhibiciones = vig.flatMap(r => r.zonas.map((z, i) => {
    const res = z.res || [];
    const nivel = res.length ? peor(res.map(x => x.nivel)) : null;
    const peorRes = res.find(x => x.nivel === nivel) || null;
    return { id: r.id, zona: i, zonas: r.zonas.length, tipo: z.tipo, nivel, basico: peorRes?.basico || '', motivo: peorRes?.motivo || '', creada: r.creada };
  }));
  const calificadas = exhibiciones.filter(e => e.nivel && e.nivel in PUNTOS);
  const indice = calificadas.length ? calificadas.reduce((s, e) => s + PUNTOS[/** @type {string} */ (e.nivel)], 0) / calificadas.length : null;
  /** @type {Record<string, number>} */
  const cuenta = { CUMPLE: 0, 'OBSERVACIÓN': 0, GRAVE: 0, NO_CALIFICA: 0, PENDIENTE: 0 };
  for (const e of exhibiciones) cuenta[e.nivel || 'PENDIENTE']++;
  const pendientes = exhibiciones.filter(e => e.nivel === 'GRAVE' || e.nivel === 'OBSERVACIÓN')
    .sort((a, b) => (a.nivel === 'GRAVE' ? 0 : 1) - (b.nivel === 'GRAVE' ? 0 : 1) || a.creada - b.creada);
  const corregidas = vig.filter(r => r.antes && delDia.some(a => a.id === r.antes)).length;
  return { area: normalizarArea(area), dia: cuandoMs, revisiones: vig.length, ids: vig.map(r => r.id), exhibiciones, indice, cuenta, pendientes, corregidas };
}

/**
 * Las rondas que hay en el historial (un área en un día), la más reciente primero.
 * @param {{area:string, creada:number}[]} registros @returns {{area:string, dia:number, n:number}[]}
 */
export function rondas(registros) {
  /** @type {Map<string, {area:string, dia:number, n:number}>} */
  const m = new Map();
  for (const r of registros) {
    const k = `${llano(r.area)}|${diaDe(r.creada)}`, x = m.get(k);
    if (x) { x.n++; if (r.creada > x.dia) { x.dia = r.creada; x.area = normalizarArea(r.area); } } else m.set(k, { area: normalizarArea(r.area), dia: r.creada, n: 1 });
  }
  return [...m.values()].sort((a, b) => b.dia - a.dia);
}

/** El índice como se lee en piso: «75 %». @param {number|null} i */
export const porcentaje = i => (i === null ? '—' : `${Math.round(i * 100)} %`);

/**
 * Lo mismo, dentro de una frase: «de hoy, 9:07», «de ayer, 21:30», «del 3 sep, 8:00».
 * @param {number} ms @param {number} [ahora]
 */
export function cuandoEnFrase(ms, ahora = Date.now()) {
  const [dia, hora] = cuando(ms, ahora).split(' · ');
  return `${dia === 'Hoy' ? 'de hoy' : dia === 'Ayer' ? 'de ayer' : `del ${dia}`}, ${hora}`;
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
