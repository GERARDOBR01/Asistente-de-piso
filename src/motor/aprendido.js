// Lo que aprendió el piso, visto desde el motor.
//
// Las palabras y los atajos viven en el teléfono (src/app.js); aquí solo está
// cómo preguntarlos. Lo usan la búsqueda (sinónimos y atajos) y la puerta (una
// palabra que el piso ya enseñó no falta). Sin DOM: se importa desde Node.

/* ── LO QUE APRENDIÓ EL PISO ──────────────────────
   «Aprende del piso» guarda en el teléfono las palabras y los atajos que
   confirmaron los asesores (src/app.js). El motor no sabe de almacenamiento:
   la app le dice cómo consultarlos con `usarAprendido`. Sin eso —en Node, en
   el laboratorio— no hay nada aprendido y la búsqueda es la del manual. */
/** @typedef {{ manual: string }} PalabraAprendida */
/** @typedef {{ sec: string, pagina: number }} Atajo */
const loAprendido = {
  /** @type {(k: string, doc: string | null | undefined) => PalabraAprendida[]} */
  palabras: () => [],
  /** @type {(q: string, doc: string | null | undefined) => Atajo[]} */
  atajos: () => [],
};
/** @param {Partial<typeof loAprendido>} a */
export function usarAprendido(a) { Object.assign(loAprendido, a); }

/** Las palabras del manual que el piso enseñó para `k`. @param {string} k @param {string | null | undefined} doc */
export const palabrasDelPiso = (k, doc) => loAprendido.palabras(k, doc);
/** Los atajos que el piso enseñó para esta forma de preguntar. @param {string} q @param {string | null | undefined} doc */
export const atajosDelPiso = (q, doc) => loAprendido.atajos(q, doc);
