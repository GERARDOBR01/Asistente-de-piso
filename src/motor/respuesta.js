// Qué se responde: las tarjetas del modo manual y el contexto que recibe el
// modelo, con lo que decidió la puerta.
//
// Es lo último del motor antes de la pantalla. La app pinta lo que sale de
// aquí (tarjetas, avisos, botones) y guarda el turno; el laboratorio lo llama
// igual desde Node (lab/motor-node.mjs) y obtiene las mismas tarjetas y el
// mismo contrato de decisión sin abrir un navegador.
//
// Salió de app.js con el motor en Node, sin cambiar nada de lo que hace
// (golden master idéntico). Sin DOM: se importa igual desde Node.
import { estado } from '../estado.js';
import { vocabDeDoc, masParecida } from './erratas.js';
import { normalizeText, variantes, tokenize } from './texto.js';
import { nombreDeSeccion } from './secciones.js';
import { filtroSolidez } from './solidez.js';
import { retrieve, chunkLabel, getPdfContext, getManualContext } from './busqueda.js';
import { NO_SE_CUENTA, palabrasDeTema, terminosAusentes, avisoDeCuenta, avisoDeAusentes, palabrasPorParecidas, contratoDeDecision, esOperacionDeTienda } from './puerta.js';
import { otraSeccionConEvidencia } from './ruta.js';
import { SEGUIMIENTO, consultaAmpliada, preguntaAnterior, assessQuestionScope, isGreetingQuestion, esPreguntaDeEstado, seccionDeLaPregunta } from './conversacion.js';

/* ════════════════════════════════════════════════
   MODO MANUAL: LAS TARJETAS
════════════════════════════════════════════════ */
export const FALLBACK_BUDGET=1800,FALLBACK_MAX_SECCIONES=3;
/* getManualContext nunca devuelve vacío: si nada coincide, igual entrega los
   fragmentos mejor puntuados, y los bonos de [MANDATORY] y de conflicto pesan
   aunque no haya un solo acierto de palabra. Para el modo manual eso mentiría
   —contestar "entallado" a quien preguntó por otra cosa—, así que aquí se exige
   al menos un acierto real antes de mostrar nada.

   Busca sobre el corpus completo: manual interno **y** el PDF que el asesor
   acaba de cargar. Antes solo miraba el manual interno, así que sin API key el
   manual recién subido se ignoraba por completo — el usuario veía su PDF en la
   lista y recibía respuestas que no salían de él.

   Exigir un acierto de la palabra literal era demasiado estricto: un manual
   puede contestar "¿cuánto dejo de pasillo?" con una lámina titulada
   ALINEACIÓN que dice "dejando 80 cm" y nunca escribe "pasillo". Ese salto es
   justo lo que hace el diccionario de sinónimos, así que también se acepta el
   fragmento que llegó por ahí — pero pidiendo dos coincidencias distintas,
   para que una casualidad suelta no cuente como respuesta.

   Queda fuera la coincidencia incidental: «¿cómo cambio la llanta del coche?»
   devuelve una lámina solo porque dice «cambio». Probé dos filtros para
   cortarla y medí los dos sobre siete manuales reales, porque ninguno se
   sostenía solo con intuición:

   · Por idf del término acertado. No funciona: «cambio» aparece en un único
     fragmento, así que puntúa 4.17 de idf, por encima de «sensor» (3.66).
     Raro no es lo mismo que relevante.
   · Por puntuación mínima. Tampoco: las distribuciones se solapan. «¿A qué
     hora abre la tienda?» llega a 7.5 porque «tienda» es palabra central del
     manual, mientras que «¿a qué altura va el sensor?» se queda en 2.3 en el
     manual de Blancos. Cualquier corte que tape el ruido tumba preguntas
     buenas: a 5 dejaba pasar 3 ruidos y mataba 5 legítimas.

   Así que no hay filtro. La garantía de este modo no es rechazar lo que no
   sabe, es no fingir que lo sabe: entrega el fragmento tal cual, con su página
   y diciendo que nadie lo interpretó, y quien lee ve en un vistazo que no
   contesta lo que preguntó. */
/* Cuando nada es sólido, el modo manual callaba aunque la sección tuviera la
   lámina. «¿dónde van las piedras decorativas?» en FLORES Y VELAS acierta
   «piedras» en la página 8 —la respuesta— y no «decorativas»: un acierto, y con
   catorce manuales se exigen dos. Con modelo, ese mismo caso entra como
   contexto flojo y el modelo juzga; sin modelo no había nadie que juzgara, y se
   contestaba «nada coincide».

   Se probó afinar el listón por fragmento —palabra rara, el primero que se
   despega del segundo, la palabra en el título— y ninguno separa: «piedras»
   (en 2 fragmentos) acierta igual que «juntas» (2) en «¿cuándo es la junta con
   la regional?», y «cava» en el título aparece tanto en preguntas buenas como
   en las que no están. Lo que sí separa es otra cosa, y son tres condiciones:

   1. Con sección. Sin ella no hay manual contra el que comprobar qué falta, y
      «¿cuál es la clave del wifi?» salía con TENIS de ZAPATOS.
   2. Las tarjetas que se enseñan cubren cada palabra de tema que el manual SÍ
      tiene. Si la palabra está en el manual pero en otra lámina, las tarjetas
      contestan otra cosa: «¿de qué color es el mantel de la mesa de
      liquidación?» acierta «mantel» y deja fuera «color», que MESA FINA usa en
      otras páginas. La palabra que el manual no tiene no se exige: de eso avisa
      `terminosAusentes` si es de otro manual, y si no es de nadie
      («decorativas») no hay lámina que la traiga.

   3. Ninguna palabra de tema es ajena a todos los manuales (ver abajo).

   Lo que pasa se enseña como coincidencia floja: nivel 1 en el contrato
   (`parcial`, «coincidencia-floja») y una nota encima de las tarjetas. Medido
   con las cinco baterías de desarrollo: arregla 4 de dato y 0 rotas; los «no
   está» siguen bien, con su aviso. */
/** @param {Resultado[]} resultados @param {string} consulta @param {string | null} doc @returns {Resultado[]} */
export function coincidenciaFloja(resultados,consulta,doc){
  if(!doc)return[];
  const voc=vocabDeDoc(doc),propio=new Set(tokenize(nombreDeSeccion(doc)));
  /* El nombre de la sección no distingue dentro de ella (igual que en retrieve). */
  const tema=palabrasDeTema(consulta).map(k=>variantes(k)).filter(f=>!f.some(v=>propio.has(v)));
  /** @param {Resultado} r */
  const textoDe=r=>' '+normalizeText((r.c.heading||'')+' '+r.c.text).replace(/\s+/g,' ')+' ';
  /* El acierto tiene que ser la palabra escrita (o su errata corregida). Un
     «altura» que cuenta porque la lámina trae una medida no basta solo:
     «¿a qué altura va el techo?» se llevaba la lámina de SENSORES. */
  const flojos=resultados.filter(r=>r.hitsErrata>=1||(r.hits>=1&&tema.some(f=>f.some(v=>textoDe(r).includes(' '+v+' '))))).slice(0,12);
  if(!flojos.length)return[];
  const texto=flojos.slice(0,FALLBACK_MAX_SECCIONES).map(textoDe).join('');
  for(const formas of tema){
    /* Una palabra que no está en ningún manual cargado —ni como errata— dice
       que la pregunta es de fuera. Con dos aciertos se toleraba; con uno, no:
       «¿a qué altura va el techo?» se llevaba ALTURAS Y NIVELES. Las unidades
       no cuentan: «¿a qué hora?» pide la forma de la respuesta («17:00»), no
       un tema. */
    if(!formas.some(v=>estado.bm25.df[v]||NO_SE_CUENTA.has(v))&&!masParecida(formas[0]))return[];
    if(!formas.some(v=>voc.has(v)))continue;
    if(!formas.some(v=>texto.includes(' '+v+' ')))return[];
  }
  return flojos.map(r=>({...r,flojo:true}))
}

/**
 * Los fragmentos que enseñaría el modo manual, en orden.
 * @param {string} q
 * @param {{doc: string | null, otraSeccion: unknown}} sec la sección de la pregunta (seccionDeLaPregunta)
 * @param {Turno[]} hist
 * @returns {Resultado[]}
 */
export function relevantesSinModelo(q,sec,hist){
  /* En modo manual el filtro de sección vale igual: si el asesor dijo con qué
     manual trabaja —o la pregunta lo dijo por él—, no tiene por qué recibir la
     lámina de otro. Y si la pregunta nombra otra sección que la activa, no se
     enseña la lámina de la activa: con catorce manuales de la misma plantilla,
     es una cifra creíble y de otra sección. */
  if(sec.otraSeccion)return[];
  const doc=sec.doc;
  /* Con manuales cargados, solo manuales: sin `source` el manual interno de
     demostración se colaba entre las tarjetas cuando no había sección elegida. */
  const source=estado.docChunks.length?'pdf':null;
  /* Se filtra y DESPUÉS se corta. Cortando antes, los fragmentos que solo
     trae el diccionario llenaban los doce lugares, el filtro los quitaba a
     todos y la lámina con la palabra escrita se había quedado en el 13.º:
     «que ba en la tore» salía en blanco teniendo TORRE en su página 11. */
  /** @type {Resultado[]} */
  let ultimos=[];
  /** @param {string} c */
  const buscar=c=>{ultimos=retrieve(c,{limit:60,doc,source});return ultimos.filter(filtroSolidez(c)).slice(0,12)};
  if(esOperacionDeTienda(q))return[];
  const consulta=consultaAmpliada(q,hist);
  /* Y la misma regla que con el modelo: una pregunta de una sola palabra se
     amplía de oficio con la anterior, pero si la palabra sola se sostiene manda
     ella. Sin esto, «¿cómo colorizo?» tras una pregunta de sábanas contestaba
     "nada coincide en esta sección" teniendo COLORIZACIÓN en su página 14. */
  if(consulta!==q&&!SEGUIMIENTO.test(q)){
    const sola=buscar(q);
    if(sola.length)return sola;
  }
  const amp=buscar(consulta);
  return amp.length?amp:coincidenciaFloja(ultimos,consulta,doc)
}

/**
 * Lo que contesta el modo manual, sin pintarlo: qué tarjetas, qué aviso y
 * qué decidió la puerta. `rutaDe` da la ruta de la pregunta; solo se pide
 * cuando hace falta (un saludo no tiene ruta).
 * @param {string} q
 * @param {Turno[]} hist
 * @param {(q: string) => Ruta} rutaDe
 * @returns {RespuestaSinModelo}
 */
export function respuestaSinModelo(q,hist,rutaDe){
  if(isGreetingQuestion(q))return{tipo:'saludo',decision:null};
  /* Preguntar por los manuales cargados no necesita modelo ni búsqueda: la
     respuesta son los datos de la app. */
  if(esPreguntaDeEstado(q))return{tipo:'estado',
    decision:contratoDeDecision({pregunta:q,consulta:q,seccion:estado.manualActivo,nivel:2,evidencia:[],deLaApp:true})};
  const ruta=rutaDe(q);
  if(ruta.motivo==='empate')return{tipo:'empate',ruta,
    decision:contratoDeDecision({pregunta:q,consulta:q,seccion:null,nivel:0,evidencia:[],empate:ruta.alternativas})};
  /* La misma decisión que con API key, para saber en qué sección se buscó y
     si la pregunta nombraba otra que la activa. */
  const sec=estado.docChunks.length?seccionDeLaPregunta(q,rutaDe):{doc:null,otraSeccion:null,porPregunta:false};
  const relevantes=relevantesSinModelo(q,sec,hist).slice(0,FALLBACK_MAX_SECCIONES);
  let fragmentos='',chars=0;
  /** @type {Tarjeta[]} */
  const tarjetas=[];
  for(const r of relevantes){
    if(chars>=FALLBACK_BUDGET)break;
    const etiqueta=chunkLabel(r.c)+'\n';
    const espacio=FALLBACK_BUDGET-chars-etiqueta.length;
    if(espacio<80)break;
    const trozo=r.c.text.length>espacio?r.c.text.slice(0,espacio)+'\n[...]':r.c.text;
    fragmentos+=etiqueta+trozo+'\n\n';chars+=etiqueta.length+trozo.length;
    /* Dos fragmentos de la misma lámina y la misma sección son una sola cosa
       para quien lee: van en la misma tarjeta, no en dos con el mismo rótulo. */
    const misma=tarjetas.find(t=>t.c.docName===r.c.docName&&t.c.page===r.c.page&&t.c.heading===r.c.heading);
    if(misma)misma.texto+='\n'+trozo;
    else tarjetas.push({c:r.c,texto:trozo});
  }
  fragmentos=fragmentos.trim();
  /* Sin modelo también hay que decirle dónde está lo que busca. Se veía en
     pantalla: con CASUAL activo, «¿cómo acomodo las sábanas?» contestaba "nada
     coincide" mientras BLANCOS —cargado, a un clic— tenía la lámina. */
  /** @type {string | null} */
  let enOtra=null;
  const nombrada=sec.otraSeccion;
  if(!nombrada&&!fragmentos&&estado.docChunks.length&&ruta.doc&&estado.docs.length>1&&!esOperacionDeTienda(q)){
    const otra=otraSeccionConEvidencia(consultaAmpliada(q,hist),ruta.doc);
    if(otra)enOtra=otra.nombre;
    else{
      const falta=terminosAusentes(q,ruta.doc);
      if(falta.length&&falta[0].duenos.length)enOtra=nombreDeSeccion(falta[0].duenos[0].docName);
    }
  }
  /* Hay tarjetas, pero la palabra que manda en la pregunta no está en el
     manual: «¿cuántos días de descanso tengo?» salía con MANIQUÍES por el «21
     días», y «¿cuánto cuesta la playera?» con la mesa de entrada. Se enseñan
     igual —puede que sirvan— pero con la advertencia arriba, sin lámina que
     las respalde, y al tablero va como duda que el manual no explica. */
  const activo=sec.doc||(estado.docs.length===1?estado.docs[0].name:null);
  const ausentes=fragmentos&&activo?terminosAusentes(q,activo):[];
  const avisoCuenta=fragmentos&&!ausentes.length?avisoDeCuenta(q,tarjetas,activo):'';
  const avisoAusente=avisoCuenta?avisoCuenta:ausentes.length?avisoDeAusentes(ausentes):'';
  /* La tarjeta llegó solo por el diccionario: ni una palabra escrita por el
     asesor, ni una errata corregida. Medido con 30 manuales, así llegaban 20 de
     las 21 preguntas «que no están» que aun así enseñaban tarjeta, y solo 2 de
     las 186 buenas. Es más suave que el de arriba: la lámina se queda, porque
     sí es del manual. */
  const primera=relevantes[0];
  const porParecidas=fragmentos&&!avisoAusente&&primera&&primera.hits===0&&primera.hitsErrata===0
    ?palabrasPorParecidas(q,consultaAmpliada(q,hist),activo,primera):[];
  /* Es una nota, no una alarma: dice lo que pasó —la palabra no está, se
     buscó por otra— y deja al asesor juzgar con la tarjeta delante. */
  const avisoParecidas=porParecidas.length
    ?'ℹ Tu manual no dice '+porParecidas.map(p=>`«${p.dijo}»`).join(' ni ')+'; lo encontré como '+porParecidas.map(p=>`«${p.como}»`).join(' y ')+'.':'';
  const flojo=!!(primera&&primera.flojo);
  /* La coincidencia floja se dice, pero como nota: la lámina sí es del manual
     y sí trae lo que se preguntó; lo que no hay es una que lo diga todo junto. */
  const avisoFlojo=flojo&&!avisoAusente&&!avisoParecidas
    ?'ℹ Ninguna lámina dice todo lo que preguntas junto; esto es lo más cercano en tu sección. Revisa que sí sea lo que buscas.':'';
  const decision=contratoDeDecision({pregunta:q,consulta:consultaAmpliada(q,hist),seccion:activo,porPregunta:sec.porPregunta,
    nivel:fragmentos?(flojo?1:2):0,evidencia:tarjetas.map(t=>t.c),
    otraSeccion:nombrada||(enOtra?{nombre:enOtra,motivo:'evidencia'}:null),
    ausentes,avisoCifra:!!avisoCuenta,parecidas:porParecidas.length>0,operacion:esOperacionDeTienda(q)});
  return{tipo:fragmentos?'tarjetas':'nada',ruta,sec,activo,relevantes,tarjetas,fragmentos,nombrada,enOtra,
    ausentes,avisoAusente,porParecidas,avisoParecidas,avisoFlojo,decision,
    /* La sección con que se recuerda el turno: de ahí sigue un «¿y en…?». */
    seccionDelTurno:(tarjetas[0]&&tarjetas[0].c.docName)||ruta.doc||null};
}

/* ════════════════════════════════════════════════
   CON MODELO: EL CONTEXTO
   PDF: 12000 chars · Manual: 6000 · Extra: 600
════════════════════════════════════════════════ */
export const PDF_BUDGET=12000,MANUAL_BUDGET=6000,EXTRA_BUDGET=600;
export const PDF_BUDGET_GEMINI=20000;

/* El aviso va DENTRO del contexto y en primera posición porque es donde el
   modelo lo lee junto a la orden de "responde solo con esto". Sin él, ante una
   pregunta que el manual no cubre recibía fragmentos sueltos y la instrucción
   de responder con ellos: obedecía, y componía una regla que nadie escribió. */
/* El aviso lleva la pregunta de ESTE turno escrita dentro. Sin ella, el modelo
   recibe la orden de responder "el manual no especifica [X]" sin que nadie le
   diga cuál es la X, y lo único parecido a una respuesta que tiene delante es la
   suya del turno anterior: la copia entera. */
/** @param {string} q */
export const avisoSinCoincidencias=q=>`=== SIN COINCIDENCIAS EN EL MANUAL ===
Ningún fragmento del manual responde a esta pregunta. Responde exactamente
"El manual no especifica X" y nada más, donde X es lo que se preguntó en ESTE
turno: "${(q||'').trim()}". No respondas a ninguna pregunta anterior de la
conversación: esa ya se contestó. NO completes con conocimiento general
de visual merchandising, ni con reglas de otras secciones, ni con lo que parezca
razonable. Lo que sigue es una muestra del manual para que sepas de qué trata:
NO es la respuesta y no debes tomar datos de ahí.`;

/* La pregunta nombra una sección que NO es la activa. Es el caso que en el piso
   sale caro: los fragmentos de la sección activa se parecen a los de la otra
   —misma plantilla— así que el modelo puede componer con ellos una respuesta
   perfectamente redactada y con la cifra de la sección equivocada. No se le pide
   que tenga cuidado: se le prohíbe responder con datos. */
/** @param {string} activa @param {string | undefined} otra */
export const avisoOtraSeccionNombrada=(activa,otra)=>`=== LA PREGUNTA ES DE OTRA SECCIÓN ===
El asesor está trabajando con la sección "${activa}", pero la pregunta nombra
"${otra}", que también tiene cargada. Los fragmentos de abajo son de "${activa}"
y NO sirven para responder por "${otra}", por parecidos que resulten: estos
manuales comparten plantilla y lo que cambia son justo los datos.
Responde solo esto, sin ninguna cifra ni regla:
"Estás trabajando en ${activa} y me preguntas por ${otra}. Cambia de sección con
el botón de aquí abajo y te respondo con ese manual."
Cierra con CERTEZA: GAP.`;

/* La sección activa no trae nada, pero otra cargada sí. No se responde desde
   ella —el asesor no ha dicho que quiera cambiar— pero callarlo es lo que hizo
   que el asistente dijera "no está en el manual" con el manual bueno cargado. */
/** @param {string} activa @param {string | undefined} otra */
export const avisoOtraSeccionEvidencia=(activa,otra)=>`=== PUEDE ESTAR EN OTRA SECCIÓN ===
En "${activa}" no hay nada que responda a esta pregunta. En "${otra}", que el
asesor también tiene cargada, sí hay material que coincide.
Responde "El manual de ${activa} no especifica [X]", di que eso sí aparece en
"${otra}" y que puede cambiar de sección con el botón de aquí abajo. No tomes
ningún dato de los fragmentos. Cierra con CERTEZA: GAP.`;

/* Sin sección elegida, el contexto mezcla manuales que comparten plantilla. La
   misma pregunta tiene entonces varias respuestas verdaderas a la vez: medido,
   «¿qué porcentaje es el cliente práctico?» devuelve 44%, 38.5%, 39.3%, 35.3% y
   43.8%, una por sección. Elegir una es acertar en una y fallar en cuatro. */
/** @param {number} n */
export const avisoVariasSecciones=n=>`=== ${n} SECCIONES A LA VEZ ===
El asesor no ha elegido sección, así que abajo hay fragmentos de ${n} secciones
distintas. Estos manuales comparten plantilla y lo que cambia son justo los
datos: la misma pregunta puede tener una respuesta distinta y correcta en cada
sección. NO elijas una cifra y la des como LA respuesta. Si las secciones
difieren, da el dato POR SECCIÓN, cada uno con el nombre de su sección y su
página. Si no puedes separarlas, dilo y pide que se elija sección arriba.`;

/* Evidencia floja: se entrega igual, pero diciendo lo que es. El modelo sabe
   leer si unos fragmentos vienen al caso; lo que no puede hacer es adivinar que
   la búsqueda apenas encontró nada. */
export const AVISO_COINCIDENCIA_FLOJA=`=== COINCIDENCIA DÉBIL ===
La búsqueda encontró poco para esta pregunta. Lee los fragmentos: si responden,
responde citando la página. Si NO responden exactamente lo que se preguntó, di
"El manual no especifica [X]" y cierra con CERTEZA: GAP. No estires un fragmento
parecido para que parezca una respuesta.`;

/* No prohíbe responder —los fragmentos que llegaron son del manual del asesor y
   pueden venir al caso—; le quita al modelo la única excusa que tenía para
   estirar uno parecido: ahora sabe qué palabra falta y de quién es. */
/** @param {string} activa @param {Ausente[]} items @param {string | null} otra @param {boolean} hayFragmentos */
export function avisoPalabraAusente(activa,items,otra,hayFragmentos){
  /** @param {Ausente[]} a */
  const lista=a=>a.map(i=>`"${i.palabra}"`).join(' y ');
  const deNadie=items.filter(i=>i.enNinguno);
  const deOtra=items.filter(i=>!i.enNinguno);
  const partes=[];
  if(deOtra.length)partes.push(`El asesor preguntó por ${lista(deOtra)}, y el manual de "${activa}" no
${deOtra.length===1?'lo dice':'los dice'} en ningún sitio.${otra?`
Eso sí aparece en "${otra}", que el asesor también tiene cargada.`:''}`);
  if(deNadie.length)partes.push(`${lista(deNadie)} no ${deNadie.length===1?'aparece':'aparecen'} en NINGUNO de los manuales
cargados. No es que esté en otra sección: es un término que ninguno de estos
manuales usa. Si lo conoces por fuera, aquí no cuenta.`);
  return`=== ${items.length===1?'UNA PALABRA DE LA PREGUNTA NO ESTÁ':'HAY PALABRAS DE LA PREGUNTA QUE NO ESTÁN'} EN ESTE MANUAL ===
${partes.join('\n')}
${hayFragmentos?`Los fragmentos de abajo salieron de las OTRAS palabras de la pregunta, así que
pueden hablar de otra cosa. Léelos: si no responden exactamente lo que se
preguntó, di`:`Dilo así:`} "El manual de ${activa} no especifica [X]"${otra?`, di que eso sí está
en "${otra}" y que puede cambiar de sección con el botón de aquí abajo`:''} y cierra
con CERTEZA: GAP. No traslades a ${activa} una regla que sea de otra sección, y no
completes con nada que no esté en los fragmentos — ni marcas, ni nombres, ni
reglas que te suenen de la cadena.`
}

/**
 * El contexto que recibe el modelo para esta pregunta y lo que decidió la
 * puerta. Deja en `estado.ultimosFragmentos` lo que entró de verdad.
 * @param {string} query
 * @param {{ hist: Turno[], rutaDe: (q: string) => Ruta, presupuesto?: number, extra?: string,
 *   textoDeEstado?: () => string }} o `textoDeEstado`: lo que se le dice al
 *   modelo cuando preguntan por la app (los datos los tiene la app, no el motor)
 * @returns {ContextoDelModelo}
 */
export function contextoParaModelo(query,{hist,rutaDe,presupuesto=PDF_BUDGET,extra='',textoDeEstado=()=>''}){
  estado.ultimosFragmentos=[];
  /* Antes que nada: si la pregunta es sobre la app, ni se busca. Con los avisos
     normales delante, el modelo recibiría la orden de responder "el manual no
     especifica" encima de un bloque que sí contesta. */
  if(esPreguntaDeEstado(query)){
    return{texto:textoDeEstado(),sinCoincidencias:false,flojo:false,ampliada:false,
      nivel:2,otraSeccion:null,variasSecciones:false,ausentes:[],estado:true,
      seccionUsada:estado.manualActivo,seccionPorPregunta:false,seccionSugerida:null,
      decision:contratoDeDecision({pregunta:query,consulta:query,seccion:estado.manualActivo,nivel:2,evidencia:[],deLaApp:true})}
  }
  /* Operación de tienda —la luz, la caja registradora, el horario de uno—: el
     modo manual ya no enseñaba láminas, pero con API key la búsqueda seguía y el
     modelo recibía EQUILIBRIO por «la luz del focal». Medido: «se fue la luz,
     ¿qué hago?» contestaba con el peso visual de cada sección. Ningún manual de
     exhibición la contesta, así que se trata como lo que no coincide con nada. */
  if(estado.docChunks.length&&esOperacionDeTienda(query)){
    return{texto:avisoSinCoincidencias(query),sinCoincidencias:true,flojo:false,ampliada:false,
      nivel:0,otraSeccion:null,variasSecciones:false,ausentes:[],
      seccionUsada:estado.manualActivo,seccionPorPregunta:false,seccionSugerida:null,
      decision:contratoDeDecision({pregunta:query,consulta:query,seccion:estado.manualActivo,nivel:0,evidencia:[],operacion:true})}
  }
  let consulta=consultaAmpliada(query,hist);
  let ampliada=consulta!==query;
  const hasPdfs=estado.docChunks.length>0;
  const parts=[];
  const pdfBudget=presupuesto;
  const seccion=hasPdfs?seccionDeLaPregunta(query,rutaDe):{doc:null,otraSeccion:null,porPregunta:false};
  /** @type {{ nombre?: string, docName?: string, motivo: string } | null} */
  let otraSeccion=seccion.otraSeccion;
  let nivel=0;
  if(hasPdfs){
    /* Con un manual cargado, el interno NO entra. Traía cifras propias —90 cm de
       pasillo, 40%, 50%— que el modelo citaba como si fueran del manual del
       asesor. Lo que el PDF no cubra se consulta aparte y rotulado. */
    let pdf=getPdfContext(consulta,pdfBudget,seccion.doc);
    /* La pregunta de una sola palabra se amplía de oficio con la anterior, y no
       siempre es un seguimiento: puede ser un tema nuevo dicho en corto. Se vio
       en pantalla —«¿cómo colorizo?» después de una pregunta de sábanas acababa
       buscando sábanas—. Si la palabra sola se sostiene, manda ella; si no se
       sostiene, la ampliación sigue siendo lo mejor que hay. Solo aplica a la
       regla de una palabra: cuando la pregunta empieza por «y», «entonces»,
       «pero», está literalmente incompleta y no hay nada que preferir. */
    if(ampliada&&!SEGUIMIENTO.test(query)){
      const previos=estado.ultimosFragmentos.slice();
      estado.ultimosFragmentos=[];
      const sola=getPdfContext(query,pdfBudget,seccion.doc);
      if(sola.nivel===2){pdf=sola;consulta=query;ampliada=false}
      else estado.ultimosFragmentos=previos;
    }
    /* Rescate: la pregunta tal cual no encontró nada. Puede ser un seguimiento
       que no empieza por conector —«¿en juveniles?»— así que se reintenta con la
       anterior pegada, y solo se acepta si sale SÓLIDO. Con evidencia floja lo
       único que se logra es arrastrar el tema del turno anterior a una pregunta
       nueva.

       Y nunca se rescata una pregunta de fuera de tema: tras «¿cuánto participa
       outdoor?», «¿qué receta me recomiendas para la cena?» se pegaba a la
       anterior y pasaba por pregunta contestable. */
    if(pdf.nivel===0&&!ampliada&&!assessQuestionScope(query).clearlyOff){
      const previa=preguntaAnterior(hist);
      if(previa){
        /* Se vacía la lista antes de reintentar: sin coincidencias, packChunks
           ya metió ahí la muestra del manual, y si el reintento salía bien se
           quedaban pegados a los buenos. */
        estado.ultimosFragmentos=[];
        const alt=getPdfContext(previa+' '+consulta,pdfBudget,seccion.doc);
        if(alt.nivel===2){pdf=alt;consulta=previa+' '+consulta;ampliada=true}
      }
    }
    nivel=pdf.nivel;
    /* Solo si la sección activa se quedó a cero se mira si otra la tiene. */
    if(!otraSeccion&&nivel===0&&seccion.doc&&estado.docs.length>1)
      otraSeccion=otraSeccionConEvidencia(consulta,seccion.doc);
    if(pdf.texto)parts.push(`=== MANUAL OPERATIVO — PDF CARGADO POR EL ASESOR (ÚNICA FUENTE VÁLIDA) ===\n${pdf.texto}`);
  }else{
    let man=getManualContext(consulta,pdfBudget+MANUAL_BUDGET);
    if(man.nivel===0&&!ampliada&&!assessQuestionScope(query).clearlyOff){
      const previa=preguntaAnterior(hist);
      if(previa){
        estado.ultimosFragmentos=[];
        const alt=getManualContext(previa+' '+consulta,pdfBudget+MANUAL_BUDGET);
        if(alt.nivel===2){man=alt;consulta=previa+' '+consulta;ampliada=true}
      }
    }
    nivel=man.nivel;
    if(man.texto)parts.push(`=== MANUAL INTERNO MERCADEP ===\n${man.texto}`);
  }
  const extraRecortado=(extra||'').trim().slice(0,EXTRA_BUDGET);
  if(extraRecortado)parts.push(`=== CONTEXTO DEL ASESOR ===\n${extraRecortado}`);
  let texto=parts.join('\n\n---\n\n');
  const sinCoincidencias=nivel===0&&!!texto;
  const flojo=nivel===1;
  if(otraSeccion){
    /* Manda sobre todo lo demás: aunque la sección activa tenga material de
       sobra, ese material no responde a lo que se preguntó. Y se vacía la lista
       de fragmentos, que es la garantía dura de que no saldrá debajo la lámina
       de la sección equivocada, conteste lo que conteste el modelo. */
    const activa=nombreDeSeccion(/** @type {string} */ (seccion.doc));
    texto=(otraSeccion.motivo==='nombrada'
      ?avisoOtraSeccionNombrada(activa,otraSeccion.nombre)
      :avisoOtraSeccionEvidencia(activa,otraSeccion.nombre))+'\n\n'+texto;
    estado.ultimosFragmentos=[];
  }else if(sinCoincidencias){
    texto=avisoSinCoincidencias(query)+'\n\n'+texto;
    /* Lo que se envió es una muestra, no evidencia de nada. Vaciar la lista es
       la garantía dura de que no saldrá una lámina debajo de una respuesta que
       el manual no sostiene, conteste lo que conteste el modelo. */
    estado.ultimosFragmentos=[];
  }else if(flojo)texto=AVISO_COINCIDENCIA_FLOJA+'\n\n'+texto;
  /* Se responde con el manual del asesor, pero diciendo qué palabra suya no
     está ahí. Va después de los avisos anteriores —y por tanto se lee antes—
     porque cambia cómo hay que leer los fragmentos. */
  /** @type {Ausente[]} */
  let ausentes=[];
  /** @type {{ docName: string, nombre: string } | null} */
  let seccionSugerida=null;
  /* También cuando no se encontró nada, que es cuando más falta hace: «el
     manual no especifica» a secas deja al asesor sin saber si preguntó mal o si
     preguntó en la sección equivocada. */
  if(hasPdfs&&seccion.doc&&!otraSeccion){
    /* La palabra que no es de nadie solo se avisa cuando el resto de la pregunta
       SÍ encontró algo: con nivel 0 ya hay un aviso diciendo que no se encontró
       nada, y dos avisos dicen lo mismo dos veces. */
    ausentes=terminosAusentes(query,seccion.doc).filter(a=>!a.enNinguno||nivel>=1);
    if(ausentes.length){
      const activa=nombreDeSeccion(seccion.doc);
      /* Se nombra otra sección solo si TODAS las que tienen dueño apuntan al
         mismo manual. Con dos dueños distintos, mandar al asesor a uno es
         elegir por él. */
      const conDueno=ausentes.filter(a=>a.duenos.length);
      const primero=conDueno.length?conDueno[0].duenos[0].docName:null;
      const unSoloDueno=primero&&conDueno.every(a=>a.duenos[0].docName===primero)?primero:null;
      if(unSoloDueno)seccionSugerida={docName:unSoloDueno,nombre:nombreDeSeccion(unSoloDueno)};
      texto=avisoPalabraAusente(activa,ausentes,unSoloDueno?nombreDeSeccion(unSoloDueno):null,estado.ultimosFragmentos.length>0)+'\n\n'+texto;
    }
  }
  /* Va delante de todo lo demás: es el marco con el que hay que leer el resto. */
  const secciones=new Set(estado.ultimosFragmentos.map(c=>c.docName));
  const variasSecciones=!seccion.doc&&secciones.size>1;
  if(variasSecciones)texto=avisoVariasSecciones(secciones.size)+'\n\n'+texto;
  /* Lo que decidió la puerta, con la misma forma que en el modo manual. */
  const decision=contratoDeDecision({pregunta:query,consulta,seccion:seccion.doc,porPregunta:seccion.porPregunta,
    nivel,evidencia:estado.ultimosFragmentos,otraSeccion,ausentes,variasSecciones,ampliada});
  return{texto,sinCoincidencias,flojo,ampliada,nivel,otraSeccion,variasSecciones,ausentes,
    seccionUsada:seccion.doc,seccionPorPregunta:seccion.porPregunta,seccionSugerida,decision}
}
