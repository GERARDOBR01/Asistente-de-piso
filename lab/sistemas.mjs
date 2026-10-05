// Las configuraciones de búsqueda que el laboratorio sabe medir.
//
// Cada una es `{ nombre, buscar(fila) → {ids, abstiene, tarjetas?, ctx?} }`,
// donde `fila` es una pregunta del volcado de la app (lab/volcar.mjs).
//
//   lexico   la búsqueda de la app tal cual: el ranking de retrieve() y lo que
//            enseñó el modo manual. Es la línea base.

export async function cargarSistema(nombre, entorno) {
  const [tipo, ...resto] = nombre.split(':');
  if (tipo === 'lexico') return lexico();
  throw new Error(`Sistema desconocido: ${nombre} (${resto.join(':')})`);
}

function lexico() {
  return {
    nombre: 'lexico',
    buscar: f => ({
      ids: (f.ranking || []).map(r => r[0]),
      /* La app se abstiene si no enseña tarjetas o si avisa que la palabra no
         está: lo mismo que cuenta calificarManual como «dijo que no está». */
      abstiene: !!f.sinDato || !!f.ausente,
      tarjetas: f.tarjetas, ctx: f.ctx, sinDato: f.sinDato, ausente: f.ausente, parecidas: f.parecidas,
    }),
  };
}
