// Datos 100 % sintéticos para el prototipo. Nada aquí es de un cliente real:
// las marcas (MarcaDemoA–D), los mundos, los porcentajes y los números de
// lámina son inventados, al igual que en la demo pública del repo.
//
// Cada fragmento tiene la forma que el motor espera (interface Fragmento de
// src/tipos.d.ts): id, source:'pdf', docName, page, heading, text. El motor
// los indexa (BM25) al montarlos; el prototipo no reimplementa búsqueda.

/** @typedef {{id:string,source:'pdf',docName:string,page:number,heading:string,text:string}} Frag */

/** Dos "secciones" (manuales), para mostrar el asistente por sección (idea de los agentes especializados). */
export const MANUALES = [
  {
    name: 'Campaña Verano (demo)',
    chunks: [
      { page: 3, heading: 'ZAPATOS · Plataforma frontal',
        text: 'Las sandalias de dama van en la plataforma frontal de la sección ZAPATOS, en el 40 % del piso asignado a calzado de temporada. Se acomodan por color, de claro a oscuro, de izquierda a derecha. La fórmula de exhibición es tres pares al frente y el resto escalonado detrás.' },
      { page: 4, heading: 'ZAPATOS · Tenis',
        text: 'Los tenis deportivos ocupan el 25 % del piso de ZAPATOS. Se agrupan por marca: MarcaDemoA y MarcaDemoB al frente, MarcaDemoC en la segunda fila. La altura de la repisa superior no debe pasar de 1.60 m.' },
      { page: 6, heading: 'ZAPATOS · Clasificación de la sección',
        text: 'La sección ZAPATOS se clasifica en cuatro mundos: Dama, Caballero, Infantil y Deportivo. Cada mundo lleva su rótulo en mayúsculas y su lámina de surtido.' },
    ],
  },
  {
    name: 'Blancos y Básicos (demo)',
    chunks: [
      { page: 2, heading: 'BLANCOS · Sábanas',
        text: 'Las sábanas se doblan en tercios y se apilan por tamaño: individual, matrimonial, queen y king, de arriba hacia abajo. El frente de la pila lleva la etiqueta de precio visible. MarcaDemoD ocupa la cabecera del mueble.' },
      { page: 5, heading: 'BLANCOS · Toallas',
        text: 'Las toallas se exhiben enrolladas en la torre central, por color dentro de cada familia. El 30 % del mueble es para la familia premium. No se mezclan dos familias en el mismo nivel.' },
      { page: 8, heading: 'BÁSICOS · Fórmula de exhibición',
        text: 'La fórmula básica de exhibición es: color de claro a oscuro, tallas de menor a mayor, y la marca ancla siempre a la altura de los ojos. Esto aplica a todos los mundos salvo indicación de la lámina de la campaña.' },
    ],
  },
];

/** Preguntas de ejemplo (se muestran como chips). La trampa debe salir "sin evidencia". */
export const EJEMPLOS = [
  '¿dónde van las sandalias?',
  '¿cómo se acomodan las sábanas?',
  '¿cuál es la fórmula de exhibición?',
  '¿qué hago si se va la luz?', // trampa: ningún manual lo contesta
];

/**
 * La rúbrica de la revisión por foto (los cuatro niveles de Veristack que usa
 * src/revision). Aquí solo para explicar en pantalla; el veredicto lo calcula
 * el código real (noCalifica de src/revision/veredicto.js).
 */
export const RUBRICA = [
  { nivel: 'CUMPLE', texto: 'La foto tiene luz y foco suficientes para calificar.' },
  { nivel: 'OBSERVACIÓN', texto: 'Califica, pero con un detalle a revisar.' },
  { nivel: 'GRAVE', texto: 'Problema serio de evidencia.' },
  { nivel: 'NO_CALIFICA', texto: 'Sin evidencia suficiente (oscura, movida o muy chica): nunca se inventa un CUMPLE.' },
];
