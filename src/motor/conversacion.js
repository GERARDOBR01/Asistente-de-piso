// La pregunta dentro de la conversación: de qué va, si sigue a la anterior y
// contra qué sección se responde.
//
// Lo que en app.js leía el historial global, aquí lo recibe: `hist` es la
// lista de turnos ({role, content, seccion?}) tal como la guarda la app. Así
// el laboratorio puede contestar una conversación entera en Node
// (lab/motor-node.mjs) con el mismo código que el teléfono.
//
// Salió de app.js con el motor en Node, sin cambiar nada de lo que hace
// (golden master idéntico). Sin DOM: se importa igual desde Node.
import { estado, alReiniciar } from '../estado.js';
import { normalizeText, tokenize } from './texto.js';
import { otraSeccionNombrada, rutaPorEvidencia } from './ruta.js';
import { esOperacionDeTienda } from './puerta.js';

/* ── EL VOCABULARIO DE LA SECCIÓN ─────────────────
   Sustituye a la lista fija de palabras de Hombres para decidir si una
   pregunta es del dominio: medido, «¿qué se debe limpiar?» y «¿cómo acomodo
   las tallas?» NO se reconocían con manuales de Mujer o Muebles cargados.

   Solo el manual activo. Con los once cargados la unión daba 2.952 palabras
   —«chocolate» de dulcería, «futbol» del manual de bicis— y «dame la receta
   del pastel de chocolate» pasaba a contar como pregunta del dominio: el
   patrón de fuera de tema exige que la palabra NO esté en el manual, y con
   once secciones encima ya casi todo está en algún manual.

   Todo el índice del manual, no solo los títulos: la lámina se titula
   LIMPIEZA y el asesor escribe «limpiar», pero el cuerpo sí trae la palabra
   tal cual («¿Qué se debe limpiar? Todo: mesas de exhibición…»).

   Antes la app lo rehacía a mano cada vez que cambiaba la sección o el
   corpus, y había que acordarse en cada sitio. Ahora se calcula cuando hace
   falta y se olvida con el corpus o al cambiar de sección. */
/** @type {{ activo: string | null, palabras: Set<string> } | null} */
let vocabulario = null;
alReiniciar(() => { vocabulario = null; });
export function vocabularioDeLaSeccion() {
  const activo = estado.manualActivo;
  if (vocabulario && vocabulario.activo === activo) return vocabulario.palabras;
  const palabras = new Set();
  for (const c of estado.docChunks) {
    if (activo && c.docName !== activo) continue;
    if (c.tf) for (const t in c.tf) palabras.add(t);
  }
  vocabulario = { activo, palabras };
  return palabras;
}

/* ── ¿ES DEL TEMA? ────────────────────────────── */
export const GREETING_PATTERNS=/^(?:\s*(?:hola|hey|hi|hello|buenos?\s+d[ií]as?|buenas?\s+tardes?|buenas?\s+noches?|qu[eé]\s+tal|saludos?|buen\s+d[ií]a))[\s!.?]*$/i;

export const VM_SCOPE_KEYWORDS=[
  'mercadep','hombres','entallado','gancho','sensor','marcademob','marcademoa','marcademoc','pos','maniqui','focal',
  'tringla','planograma','corner','exhib','mercad','visual','display','prenda','pantalon','camisa',
  'traje','zapato','calcetin','pijama','corbata','etiquet','barata','liquidacion','coloriz','enganch',
  'perimet','mueble','pasillo','saco','formal','MarcaDemoD','marca','ropa','accesorio','silueta','gondola',
  'vitrina','cross','slow','rotacion','bastilla','plastiflecha','descanso','triangul','boutique','juvenil'
];
export const OFF_TOPIC_PATTERNS=[
  /\b(clima|pronostico|pronóstico|tiempo\s+atmosferico|tiempo\s+atmosférico)\b/,
  /\b(receta|cocinar|comida)\b/,
  /* «Tarea» salía de aquí: en el piso es una palabra de trabajo —"¿cuál es mi
     tarea al abrir?"— y la pregunta se contestaba con la redirección de fuera
     de tema. Si el manual no la cubre, ahora sale como GAP, que es la respuesta
     honesta; antes salía un "solo puedo ayudarte con exhibición". */
  /\b(examen|universidad|escuela|matematicas|matemáticas)\b/,
  /\b(amazon|walmart|palacio|sears|costco|coppel)\b/,
  /\b(quien\s+eres|quién\s+eres|que\s+eres|qué\s+eres)\b(?!.*(hombres|mercadep|visual|mercad|exhib))/
];

/** @param {string | null | undefined} q */
export function isCreatorQuestion(q){
  return/\b(quien|quién)\s+(te\s+)?(cre[oó]|hizo|program[oó]|desarroll[oó])|\b(creador|autor|de\s+quien\s+eres|de\s+quién\s+eres)\b/i.test(q||'');
}
/** @param {string | null | undefined} q */
export function isGreetingQuestion(q){
  return GREETING_PATTERNS.test((q||'').trim());
}
/** @param {string | null | undefined} q */
export function assessQuestionScope(q){
  const norm=normalizeText(q||'');
  const isGreeting=isGreetingQuestion(q);
  /* Con un manual cargado manda su vocabulario, no la lista de Hombres: es lo
     que hace que «¿qué se debe limpiar?» cuente como pregunta del dominio en un
     manual de Muebles. La lista fija se queda para cuando no hay PDF. */
  const vocabularioManual=vocabularioDeLaSeccion();
  const enElManual=vocabularioManual.size&&tokenize(q||'').some(t=>vocabularioManual.has(t));
  const hasVm=enElManual||VM_SCOPE_KEYWORDS.some(k=>norm.includes(k));
  const clearlyOff=!isGreeting&&!hasVm&&OFF_TOPIC_PATTERNS.some(p=>p.test(norm));
  const otherStore=hasVm&&/\b(amazon|walmart|palacio|sears|costco|coppel|zara|hm|h\s*&\s*m)\b/i.test(q||'');
  const isVmQuestion=hasVm&&!clearlyOff&&!isGreeting&&!isCreatorQuestion(q);
  return{hasVm,clearlyOff,otherStore,isGreeting,isVmQuestion};
}

/* ── PREGUNTAS SOBRE EL PROPIO MANUAL ─────────────
   «¿De qué trata este manual?», «¿qué manuales tengo cargados?», «¿en qué
   sección estoy?». Doce preguntas así, medidas con los once cargados: ninguna
   se contestaba bien. Caían por el camino normal del buscador y salían con
   evidencia floja o con cero fragmentos. No es que falte información: es que
   la respuesta no está en ninguna lámina, está en la app.

   Los patrones se prueban contra el texto normalizado —sin acentos y sin
   signos—, no contra lo que se escribió. Escritos sobre el texto crudo, «\b»
   detrás de «qué» no casa nunca: para el motor de expresiones la «é» no es una
   letra, así que entre «é» y el espacio no hay frontera de palabra. «¿Qué te
   puedo preguntar?» se caía justo por ahí. */
export const PREGUNTA_DE_ESTADO=[
  /\b(manuales|secciones)\b.{0,40}\b(tengo|tienes|cargad\w*|disponibles|subid\w*)\b/,
  /\b(tengo|tienes)\b.{0,20}\b(manuales|secciones)\b/,
  /\ben que (seccion|manual)\b.{0,30}\b(estoy|estamos|trabajo|trabajamos)\b/,
  /\bde que (trata|va|habla)\b.{0,30}\b(manual|seccion|documento)\b/,
  /\bque\b.{0,20}\b(te puedo|puedo|se puede)\s+(preguntar|consultar)\b/,
  /\b(que sabes hacer|que puedes hacer|para que sirves|como funcionas|que eres capaz)\b/,
  /\bcuantas paginas\b/,
];
/** @param {string | null | undefined} q */
export function esPreguntaDeEstado(q){
  const n=normalizeText(q||'');
  return PREGUNTA_DE_ESTADO.some(r=>r.test(n))
}

/* ── PREGUNTAS DE SEGUIMIENTO ─────────────────────
   Nadie repite la pregunta entera: se pregunta «¿y en juveniles?» y se espera
   que el asistente siga el hilo. La búsqueda usaba solo la frase escrita, así
   que esas tres palabras recuperaban lo que podían y la respuesta salía de
   fragmentos que no venían al caso.

   Solo se amplía la BÚSQUEDA: el turno que se le manda al modelo sigue siendo
   lo que el asesor escribió, porque el hilo de la conversación ya viaja en el
   historial. */
export const SEGUIMIENTO=/^\s*(?:¿\s*)?(?:y|e|entonces|pero|ok|vale|ah|ahi|ah[ií])\b/i;
/** @param {Turno[]} hist */
export function preguntaAnterior(hist){
  const previas=hist.filter(m=>m.role==='user');
  const previa=previas[previas.length-1];
  return previa&&previa.content?previa.content:''
}
/* El umbral anterior —menos de 4 palabras propias— ampliaba casi siempre, porque
   en español las que quedan tras quitar «como», «se», «los», «en» son dos o
   tres: «explicame los perimetros en juveniles» son 3 y «como se arman las
   mesas» son 2. Medido en el piso: la ampliación pegó la pregunta anterior a una
   pregunta nueva y el asistente contestó la anterior, palabra por palabra.

   Ahora solo se amplía de entrada cuando la pregunta está literalmente
   incompleta: empieza por conector de seguimiento, o no llega a dos palabras
   propias. Lo demás se rescata más tarde, y solo si sale sólido. */
/** @param {string | null | undefined} q */
export function esElipsis(q){return SEGUIMIENTO.test(q||'')||tokenize(q||'').length<=1}
/** Lo que se busca: la pregunta, o la anterior más ella si está incompleta.
    Si sale distinta de `q`, se amplió. @param {string} q @param {Turno[]} hist */
export function consultaAmpliada(q,hist){
  if(!esElipsis(q))return q;
  const previa=preguntaAnterior(hist);
  if(!previa)return q;
  return previa+' '+q
}

/* ── LA SECCIÓN QUE ELIGE LA PREGUNTA ─────────────
   Con muchos manuales cargados y ninguno elegido, cada pregunta se buscaba en
   todos a la vez. El asesor no tiene por qué elegir primero: casi siempre la
   pregunta dice de qué sección es. La nombra («en juveniles»), sigue la
   conversación anterior («¿y sandalias?»), o solo un manual tiene con qué
   responderla. Vale para esa pregunta y nada más: el selector se queda como
   estaba. Y si dos secciones responden igual de bien no se adivina: se le
   pregunta al asesor con un botón por sección (`motivo: 'empate'`). */
/** Cómo se le dice al asesor por qué se buscó en esa sección. @type {Record<string, string>} */
export const RUTA_ROTULO={nombrada:'por tu pregunta',evidencia:'por tu pregunta',seguimiento:'sigue la conversación','elegida-por-ti':'la elegiste'};
/** La sección de la última respuesta, si sigue cargada. @param {Turno[]} hist */
export function seccionDelTurnoAnterior(hist){
  for(let i=hist.length-1;i>=0;i--){
    const h=hist[i];
    if(h.role==='assistant')return h.seccion&&estado.docs.some(d=>d.name===h.seccion)?h.seccion:null;
  }
  return null
}
/**
 * La ruta de una pregunta: depende de ella y de todo lo que la rodea —la
 * sección elegida, qué manuales hay y qué se preguntó antes—.
 * @param {string} q
 * @param {Turno[]} hist
 * @param {{q: string, doc: string} | null} [forzada] la sección que eligió el asesor en un empate
 * @returns {Ruta}
 */
export function rutaDeLaPregunta(q,hist,forzada=null){
  /** @param {string | null} doc @param {string} motivo @param {string[]} [alternativas] @returns {Ruta} */
  const ruta=(doc,motivo,alternativas=[])=>({q,doc,motivo,alternativas});
  const docs=estado.docs;
  if(!estado.docChunks.length||!docs.length)return ruta(null,'sin-manuales');
  if(docs.length===1)return ruta(docs[0].name,'unica');
  const activo=estado.manualActivo;
  if(activo&&docs.some(d=>d.name===activo))return ruta(activo,'elegida');
  if(forzada&&forzada.q===q&&docs.some(d=>d.name===forzada.doc))return ruta(forzada.doc,'elegida-por-ti');
  /* Lo de operación de tienda —la luz, la caja, el horario de uno— no es de
     ninguna sección: sin esto, «mi jefe me cambió el horario» empataba entre
     dos manuales y la app preguntaba «¿en cuál estás?». */
  if(esPreguntaDeEstado(q)||isCreatorQuestion(q)||esOperacionDeTienda(q))return ruta(null,'ninguna');
  const scope=assessQuestionScope(q);
  if(scope.isGreeting||scope.clearlyOff)return ruta(null,'ninguna');
  const r=rutaPorEvidencia(q,{ampliada:()=>consultaAmpliada(q,hist),anterior:seccionDelTurnoAnterior(hist),elipsis:esElipsis(q)});
  return ruta(r.doc,r.motivo,r.alternativas);
}

/**
 * ¿Contra qué manual se responde esta pregunta? Tres respuestas posibles, y
 * las tres se le dicen al asesor en la tira de fuentes: la sección que eligió,
 * la que nombró en la pregunta, o ninguna. `rutaDe` da la ruta de la pregunta
 * (en la app, la ya calculada para este turno).
 * @param {string} query
 * @param {(q: string) => Ruta} rutaDe
 * @returns {Seccion}
 */
export function seccionDeLaPregunta(query,rutaDe){
  const activo=estado.manualActivo;
  /* Sin sección elegida, la pregunta manda: si dice "en juveniles", se busca en
     juveniles y no en los cinco manuales a la vez; y si no la nombra, manda la
     sección que sí tiene con qué responder (`rutaDeLaPregunta`). */
  if(!activo||!estado.docs.some(d=>d.name===activo)){
    const ruta=rutaDe(query);
    return{doc:ruta.doc,otraSeccion:null,porPregunta:RUTA_ROTULO[ruta.motivo]||false}
  }
  /* Con sección elegida, la pregunta solo la cambia si nombra otra
     (`otraSeccionNombrada`, src/motor/ruta.js). */
  return{doc:activo,otraSeccion:otraSeccionNombrada(query,activo),porPregunta:false}
}
