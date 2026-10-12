// Asistente de Piso · Copyright (c) 2026 Gerardo Barrera.
// Licencia PolyForm Noncommercial 1.0.0: uso comercial solo con licencia escrita (LICENCIA-COMERCIAL.md).
//
// Qué láminas ve el modelo como imagen en el motor clásico.
//
// Hay láminas que son una imagen con su título: «Clasificación de
// Departamentos» trae Mundo · Tipo de producto · Segmento · Marca dibujados, y
// el PDF solo tiene «Cambia en temporada de Rebajas» como texto. Con eso el
// modelo contestaba «se clasifica por departamento» sin decir cuáles. Si una
// de esas láminas llega al contexto, va también su imagen, y el modelo lee en
// ella lo que el texto no trae. Solo las de poco texto: una lámina que ya se
// lee bien no gana nada y cuesta tokens.
//
// Sin DOM: se importa igual desde Node.

export const LAMINA_POCO_TEXTO = 250;   // caracteres de texto en toda la página por debajo de los cuales es «lámina imagen»
/* Una sola: medido con Básicos Display, dos imágenes (la buena y otra de poco
   texto que no venía al caso) subían la espera a ~14 s y el modelo repartía la
   atención. */
export const LAMINAS_MAX = 1;           // imágenes por pregunta
export const LAMINAS_DE_CONTEXTO = 4;   // solo entre los primeros fragmentos del contexto

/**
 * @param {Array<{docName: string, page: number, text?: string, heading?: string, isFicha?: unknown}>} fragmentos  lo que recibió el modelo, en orden
 * @param {Array<{docName: string, page: number, text?: string, isFicha?: unknown}>} todos  todos los fragmentos de los manuales
 * @param {(doc: string, page: number) => string | null | undefined} imagenDe  la imagen guardada de la página (data URL) o nada
 * @param {{ deMarcas?: boolean }} [opciones]  deMarcas: la pregunta es por marcas (basicoDe = 'marcas')
 * @returns {Array<{doc: string, page: number, dataUrl: string}>}
 */
export function laminasParaVer(fragmentos, todos, imagenDe, { deMarcas = false } = {}) {
  /** @type {Map<string, number>} */
  const texto = new Map();
  for (const c of todos) {
    if (c.isFicha) continue;   // lo que la IA ya transcribió no es texto del PDF
    const k = c.docName + '#' + c.page;
    texto.set(k, (texto.get(k) || 0) + (c.text || '').length);
  }
  const out = [];
  const vistas = new Set();
  for (const c of fragmentos.slice(0, LAMINAS_DE_CONTEXTO)) {
    const k = c.docName + '#' + c.page;
    if (vistas.has(k)) continue;
    vistas.add(k);
    /* Las marcas muchas veces son LOGOS: en una tabla de MUNDOS Y MARCAS el
       «1.» puede ser un logo sin texto, y hay secciones donde la fila entera
       son logos. A una pregunta de marcas va la lámina de marcas aunque traiga
       texto. */
    const deLaminaDeMarcas = deMarcas && /marca/i.test(c.heading || '');
    if (!deLaminaDeMarcas && (texto.get(k) || 0) >= LAMINA_POCO_TEXTO) continue;
    const dataUrl = imagenDe(c.docName, c.page);
    if (!dataUrl) continue;
    out.push({ doc: c.docName, page: c.page, dataUrl });
    if (out.length >= LAMINAS_MAX) break;
  }
  return out;
}

/** La nota que acompaña a las imágenes en el mensaje del contexto.
 * @param {Array<{doc: string, page: number}>} laminas */
export function notaDeLaminas(laminas) {
  if (!laminas.length) return '';
  const pags = laminas.map(l => `pág. ${l.page}`).join(' y ');
  return `\n\n[LÁMINA COMO IMAGEN: después de este texto va la imagen de ${pags}. Es una lámina con casi todo dibujado y poco texto en el PDF. Si en ella hay un diagrama, unos círculos, una tabla o una lista que responde la pregunta, transcríbela COMPLETA, cada elemento con su nombre tal como está escrito, y cítala con su página igual que el texto. Solo lo que se lee en la imagen: no describas ni supongas lo que no está escrito.]`;
}
