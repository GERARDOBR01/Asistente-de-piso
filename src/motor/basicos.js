// Asistente de Piso · Copyright (c) 2026 Gerardo Barrera.
// Licencia PolyForm Noncommercial 1.0.0: uso comercial solo con licencia escrita (LICENCIA-COMERCIAL.md).
//
// La ruta de los básicos. Quien pregunta en el piso casi siempre empieza por
// lo mismo y en el mismo orden: qué marcas hay, cómo se clasifica la sección,
// dónde va la liquidación… Es el orden del CHECK LIST de los manuales. Después
// de una respuesta, la app sugiere el siguiente básico que todavía no se
// preguntó, y solo si el manual lo trae (eso lo decide app.js con el motor
// local). Aquí solo vive la lista y el orden: puro, sin estado.

import { normalizeText } from './texto.js';

/**
 * @typedef {Object} Basico
 * @property {string} id
 * @property {string} nombre     corto, para un botón
 * @property {string} pregunta   como la haría el piso
 * @property {string[]} claves   raíces sin acentos; con espacio, frase exacta
 */

/** @type {Basico[]} */
export const BASICOS = [
  { id: 'marcas', nombre: 'Marcas y mundos', pregunta: '¿Qué marcas hay y en qué mundo van?', claves: ['marca', 'mundo'] },
  { id: 'clasificacion', nombre: 'Clasificación', pregunta: '¿Cómo se clasifica la sección?', claves: ['clasific', 'categor', 'tipo de mercancia', 'estructura de la seccion', 'estilo'] },
  { id: 'liquidacion', nombre: 'Liquidación', pregunta: '¿Dónde va la liquidación?', claves: ['liquidac', 'remate', 'descontinuad'] },
  { id: 'etiquetas', nombre: 'Etiquetas y sensores', pregunta: '¿Cómo van las etiquetas de precio y los sensores?', claves: ['etiquet', 'sensor', 'cascabel', 'precio'] },
  { id: 'exhibicion', nombre: 'Básicos de exhibición', pregunta: '¿Cuáles son los básicos de exhibición?', claves: ['surtido', 'alineac', 'limpieza', 'planchad', 'doblad', 'basicos de exhibicion'] },
  { id: 'display', nombre: 'Básicos de display', pregunta: '¿Cómo se hace la triangulación y las alturas del display?', claves: ['triangul', 'composic', 'altura', 'equilibri', 'display', 'focal'] },
  { id: 'pos', nombre: 'POS y caja', pregunta: '¿Cómo se exhibe el POS?', claves: ['pos', 'caja', 'punto de venta'] },
  { id: 'campanas', nombre: 'Campañas y cartulinas', pregunta: '¿Qué campañas y cartulinas van?', claves: ['campana', 'cartulin', 'senaliz'] },
];

/** Las claves cortas (pos, caja) van como palabra entera; las largas, como raíz. */
const CORTA = 4;

/** ¿De qué básico es la pregunta? El primero de la lista que coincide, o null.
 * @param {string} q @returns {string|null} */
export function basicoDe(q) {
  const t = ' ' + normalizeText(q).replace(/\s+/g, ' ').trim() + ' ';
  const palabras = t.trim().split(' ');
  for (const b of BASICOS) {
    for (const k of b.claves) {
      if (k.includes(' ') ? t.includes(' ' + k + ' ') || t.includes(' ' + k)
        : k.length <= CORTA ? palabras.includes(k) : palabras.some(w => w.startsWith(k))) return b.id;
    }
  }
  return null;
}

/**
 * Los básicos que siguen después del actual, en el orden de la lista y dando
 * la vuelta, sin los ya preguntados y solo los que el manual trae.
 * @param {string|null} actual   el básico de la pregunta (o null)
 * @param {Set<string>} preguntados
 * @param {Map<string, number>} cubiertos  id → página donde el manual lo trae
 * @returns {Basico[]}
 */
export function siguientesBasicos(actual, preguntados, cubiertos) {
  const i = BASICOS.findIndex(b => b.id === actual);
  const orden = i < 0 ? BASICOS : [...BASICOS.slice(i + 1), ...BASICOS.slice(0, i)];
  return orden.filter(b => b.id !== actual && !preguntados.has(b.id) && cubiertos.has(b.id));
}
