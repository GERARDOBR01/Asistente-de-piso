// El estado del corpus, en un solo objeto (ADR 0005, paso 2).
//
// Antes eran seis `let` sueltos en el script de la app, y el arnés los
// reasignaba a mano para montar un corpus de prueba: guardaba cada uno, lo
// cambiaba y lo devolvía al final, sin `finally` en la mitad de los casos.
// Un módulo no puede reasignar lo que importa, así que el motor que vaya
// saliendo de `app.js` lee y escribe `estado.corpus`, no `corpus`.
//
// Sin DOM ni almacenamiento: se importa igual en el navegador y en Node.

/**
 * @typedef {{ name: string, [k: string]: unknown }} Manual
 * @typedef {{ N: number, avgdl: number, df: Record<string, number>, k1: number, b: number }} Bm25
 */

export const estado = {
  /** Las secciones del manual interno (el de fábrica). @type {Fragmento[]} */
  manualSections: [],
  /** Los fragmentos de los PDF cargados. @type {Fragmento[]} */
  docChunks: [],
  /** Las láminas detectadas en los PDF. @type {Array<Record<string, unknown>>} */
  docFigures: [],
  /** `manualSections` + `docChunks`, indexado. Lo rehace `reconstruirIndice` (src/motor/indice.js). @type {Fragmento[]} */
  corpus: [],
  /** Los manuales cargados. @type {Manual[]} */
  docs: [],
  /** Las estadísticas de BM25 sobre `corpus`. @type {Bm25} */
  bm25: { N: 0, avgdl: 1, df: Object.create(null), k1: 1.5, b: 0.75 },
  /** La sección en la que se consulta; `null` = todos los manuales. En el piso
      se trabaja UNA sección: con cinco manuales de la misma plantilla
      cargados, la respuesta se armaba con los cinco y el dato salía citado a
      la página de un manual que no era el suyo. En la app se nombra
      `appState.manualActivo`. @type {string | null} */
  manualActivo: /** @type {string | null} */ (null),
  /** Los fragmentos que entraron DE VERDAD al contexto de la última pregunta
      (`packChunks`), no los que puntuaron alto: es la única lista contra la
      que tiene sentido verificar la respuesta y de la que salen las láminas
      que la acompañan. @type {Fragmento[]} */
  ultimosFragmentos: [],
};

/** @typedef {keyof typeof estado} Clave */
export const CLAVES = /** @type {Clave[]} */ (Object.keys(estado));

/* ── Cachés ───────────────────────────────────────────────────────────────
   Cada parte del motor guarda cosas que se derivan del corpus (trigramas,
   fonética, nombres…) y tiene que olvidarlas cuando el corpus cambia. Antes,
   `rebuildCorpus` las ponía en null una por una y había que acordarse de
   agregar cada caché nueva ahí. Ahora cada una se registra junto a su código. */
/** @type {Array<() => void>} */
const reinicios = [];

/** Registra cómo olvidar una caché que depende del corpus. @param {() => void} fn */
export function alReiniciar(fn) { reinicios.push(fn); }

/** Olvida todas las cachés registradas, en el orden en que se registraron. */
export function reiniciarCaches() { for (const fn of reinicios) fn(); }

/* ── Montar un corpus de prueba ───────────────────────────────────────────
   Cambia solo las claves que se pasan y devuelve con qué volver a como
   estaba. `rehacer` es lo que reconstruye el índice (en la app,
   `rebuildCorpus`); se llama al montar y al volver. */
/**
 * @param {Partial<typeof estado>} parcial
 * @param {() => void} [rehacer]
 * @returns {() => void} vuelve al estado de antes
 */
export function montar(parcial, rehacer = () => {}) {
  /** @type {Partial<typeof estado>} */
  const antes = {};
  for (const k of /** @type {Clave[]} */ (Object.keys(parcial))) {
    if (!CLAVES.includes(k)) throw new Error(`«${k}» no es parte del estado del corpus`);
    Object.assign(antes, { [k]: estado[k] });
  }
  Object.assign(estado, parcial);
  rehacer();
  return () => { Object.assign(estado, antes); rehacer(); };
}

/**
 * Corre `fn` con un corpus de prueba y vuelve siempre al de antes, aunque
 * `fn` truene. Si `fn` devuelve una promesa, vuelve cuando termine.
 * @template T
 * @param {Partial<typeof estado>} parcial
 * @param {() => T} fn
 * @param {() => void} [rehacer]
 * @returns {T}
 */
export function conEstado(parcial, fn, rehacer) {
  const volver = montar(parcial, rehacer);
  let r;
  try { r = fn(); } catch (e) { volver(); throw e; }
  if (r && typeof (/** @type {any} */ (r)).then === 'function') return /** @type {any} */ (r).finally(volver);
  volver();
  return r;
}
