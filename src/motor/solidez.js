// La solidez: cuándo una coincidencia es sólida, floja o nada.
//
// Es la capa de abajo de la puerta de evidencia: la usa la búsqueda para
// contar lo que se exige, así que no puede depender de ella. Lo demás de la
// puerta (palabras ausentes, cifras, el contrato de decisión) está en
// puerta.js, encima de la búsqueda.
//
// Salió de app.js en el paso 4 del ADR 0005, sin cambiar nada de lo que hace
// (golden master idéntico). Sin DOM: se importa igual desde Node.
import { estado } from '../estado.js';
import { palabrasDeConsulta } from './texto.js';

/* Un fragmento «sólido» es el que coincidió de verdad con la pregunta.
   Contarlos es lo que permite avisar al modelo de que no se encontró nada, en
   vez de entregarle fragmentos sueltos bajo la orden de "responde solo con
   esto" — que es la vía por la que entraban casi todas las invenciones.

   El listón depende de la escala. Con los 10 fragmentos del manual interno,
   pedir un acierto bastaba. Con cinco manuales reales cargados —572 fragmentos—
   un solo acierto de palabra común deja pasar cualquier cosa: medido, «¿a qué
   hora abre la tienda?» acierta «tienda» y se lleva 8412 caracteres de contexto,
   y «¿cómo cambio la llanta del coche?» se lleva una lámina de PLANCHADO.

   Medido sobre los 5 manuales, 8 preguntas buenas contra 5 de ruido: la
   puntuación NO separa (6.49 de una buena contra 6.7 de un ruido), pero
   `hits+hitsSyn` sí — todas las buenas llegan a 2 y ningún ruido pasa de 1.

   Pero el mismo listón aplicado al manual interno tumba respuestas buenas, y no
   es una contradicción: es que un acierto vale distinto según con cuánto
   compita. El interno son 10 secciones de mil caracteres, y cada una ES un tema
   entero —acertar «producto» dentro de «BÁSICOS DE DISPLAY» apunta de verdad a
   la regla de slow movers—. Los manuales reales son fragmentos de 185
   caracteres: ahí la misma palabra suelta es una coincidencia.

   Así que la exigencia escala con el corpus. Los dos regímenes medidos están
   lejos —10 fragmentos el interno, 88 a 572 los reales—, así que el corte no es
   un número afinado al borde: cualquier valor entre ambos se comporta igual.

   Dos caminos, porque son dos tipos de evidencia distintos: la palabra que el
   asesor escribió (`hits`), o dos términos del diccionario a la vez (`hitsSyn`),
   que es el caso de «¿cuánto espacio dejo para que pase la gente?» — no comparte
   ni una palabra con la lámina de ALINEACIÓN y aun así es su respuesta.

   La excepción de una sola palabra no es un parche: «¿qué va en el POS?» y
   «maniquis» son preguntas de una palabra y no pueden aportar dos aciertos.

   Y no es una decisión binaria, porque medido no puede serlo: a escala real
   «¿cómo acomodo las tallas?» —una pregunta central del piso— deja la misma
   huella que «¿a qué hora abre la tienda?»: un solo acierto en el mejor
   fragmento. Cortar ahí en seco contesta "el manual no especifica" a una
   pregunta que el manual sí contesta, y eso vacía la herramienta mucho más
   rápido que un contexto de más.

   Así que hay tres niveles. Con evidencia sólida se responde normal; con
   evidencia débil se entrega el contexto PERO avisando de que la coincidencia es
   floja, y es el modelo —que sabe leer si esos fragmentos vienen al caso— quien
   decide; sin ninguna coincidencia no se finge nada. El corte duro sigue siendo
   la red de seguridad; el aviso de invención vive en la regla CERO INVENCIÓN y
   en la verificación, no aquí. */
export const CORPUS_GRANDE=40;
/** @param {string | number} consulta la pregunta, o cuántas palabras tiene @returns {number} */
export function exigenciaDeSolidez(consulta){
  const palabras=(typeof consulta==='number'?consulta:palabrasDeConsulta(consulta).length)||1;
  return Math.max(1,Math.min(estado.corpus.length>CORPUS_GRANDE?2:1,palabras))
}
/* Algo, aunque sea poco: un acierto de la palabra escrita, dos del diccionario,
   o una errata corregida.

   Lo tercero faltaba, y se veía en una pregunta de una sola palabra mal
   escrita: «¿cómo va colorisacion?» corregía bien —COLORIZACIÓN— y devolvía
   CERO fragmentos, porque la corrección pesaba como un sinónimo y el listón del
   diccionario son dos. Un sinónimo es una apuesta del sistema y por eso se le
   piden dos; una errata corregida es la palabra que el asesor escribió, y pedir
   dos equivale a no contestarle nunca cuando escribe rápido. */
/** @param {Resultado} r */
export const hayAlgo=r=>r.hits>=1||r.hitsSyn>=2||r.hitsErrata>=1;
/** @param {string | number} consulta @returns {(r: Resultado) => boolean} */
export function filtroSolidez(consulta){
  const exigidos=exigenciaDeSolidez(consulta);
  return r=>hayAlgo(r)&&(r.hits+r.hitsSyn+r.hitsErrata)>=(r.exigidos??exigidos)
}
/* 2 = sólido · 1 = flojo · 0 = nada */
/** @param {Resultado[]} results @param {string | number} consulta @returns {0 | 1 | 2} */
export function nivelDeEvidencia(results,consulta){
  if(results.some(filtroSolidez(consulta)))return 2;
  return results.some(hayAlgo)?1:0
}
