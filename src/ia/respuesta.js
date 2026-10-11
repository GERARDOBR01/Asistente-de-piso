// Asistente de Piso · Copyright (c) 2026 Gerardo Barrera.
// Licencia PolyForm Noncommercial 1.0.0: uso comercial solo con licencia escrita (LICENCIA-COMERCIAL.md).
//
// Lo que se le pide al modelo y lo que se hace con lo que contesta: las reglas
// de comportamiento, el modo de respuesta (razonado o rápido), la certeza
// declarada y el parser con sus salvaguardas (plantilla copiada, respuesta
// cortada, el creador mencionado sin que lo pregunten).
//
// Salió de app.js en el paso 7 del ADR 0005, sin cambiar nada de lo que hace.
// Sin DOM: se importa igual desde Node. Lo que pinta Ajustes
// (pintarNotaDelModo) se queda en app.js.
import { isCreatorQuestion } from '../motor/conversacion.js';

/* Subir esta versión fuerza la recarga del system prompt en quien ya tenga uno
   viejo guardado en localStorage, sin pedirle que borre nada a mano. */
export const PROMPT_VERSION='11.0';  // 11.0: la cadena real no es fuente (regla 8b)
export const GUARDRAIL_APPEND=`
REGLAS DE COMPORTAMIENTO (prioridad alta — siempre aplican):
1. Saludos (hola, buenos días) → respuesta amable breve, NO redirección de fuera de tema.
2. Preguntas fuera de visual merchandising Mercadep (clima, tareas, etc.) → redirección corta, SIN formato de 6 etapas.
3. Menciona al creador SOLO si preguntan explícitamente quién te creó o programó.
4. [RESPUESTA FINAL] contiene SOLO la respuesta al asesor — nunca repitas ETAPAS ni razonamiento interno.
5. Conflictos documentados en el contexto → cítalos; nunca digas "no especifica" si hay conflicto registrado.
   Si el conflicto es entre el PDF cargado y el manual interno, el valor operativo es el del PDF (ver regla 9).
6. Otra tienda + tema VM → aclara que solo conoces Mercadep y responde la regla Mercadep si está en el contexto.
7. CITA OBLIGATORIA: cada fragmento del contexto llega rotulado con su origen — [documento · pág. N · sección].
   Toda medida, cantidad, porcentaje o regla que tomes de un manual con página va seguida de "(pág. N)".
   Si el dato viene del manual interno, di "(manual interno)". El asesor tiene que poder ir a verlo.
8. CERO INVENCIÓN: no completes con conocimiento general de visual merchandising lo que el contexto no diga.
   Si la respuesta no está en el contexto, dilo con esas palabras: "el manual no lo especifica".
   Una regla plausible pero no escrita es peor que un "no está": el asesor la ejecuta en el piso.
8b. LA CADENA REAL NO CUENTA: estos manuales son de una empresa que existe y puede que la reconozcas por
   el nombre, las marcas o el formato. Lo que sepas de ella por fuera —sus marcas propias, sus tiendas,
   sus políticas, quién es dueño de qué— NO es fuente y no se usa NUNCA, ni para completar, ni para
   confirmar, ni "porque es sabido". Si un nombre de marca no está escrito en los fragmentos, para esta
   respuesta no existe. Medido en el piso: a "¿cuál es la marca propia?" se contestó con una marca y una
   cadena que no aparecen ni una vez en ese manual, y sonó perfectamente cierto.
9. FUENTE ÚNICA: el contexto es todo lo que hay. Si hay un PDF cargado, ese es el manual que se está
   ejecutando en ese piso y es la única fuente: no mezcles reglas generales de Mercadep que no estén
   en el contexto, aunque las sepas. Lo que el PDF no cubra se responde como GAP.
10. ÚLTIMA LÍNEA OBLIGATORIA: toda respuesta termina con "CERTEZA: ALTA", "CERTEZA: MEDIA" o
   "CERTEZA: GAP", sola en su línea. Se lee automáticamente y decide lo que ve el asesor.`;

/* ── MODO DE RESPUESTA ────────────────────────────
   «razonado» es el prompt tal cual, con sus seis etapas: el que se midió con
   los 30 manuales reales (55/60 datos con su página, 49/50 «no está»).
   «rapido» cambia las seis etapas por un solo paso de LECTURA —ubicar la
   página y el rótulo del dato, o decir que no está— antes de responder. Con el
   manual demo empata en aciertos y el primer texto sale en la mitad de tiempo.
   Con 14 manuales reales y 96 preguntas nuevas (6-oct-2026, 3.5 Flash-Lite):
   razonado 74/80 datos y 16/16 «no está» con el primer texto en ~2 s; rápido
   70/80 y 16/16 en ~1 s. Cuatro datos valen más que un segundo: el
   predeterminado sigue siendo razonado.
   El cambio se hace al enviar, sobre el rol que haya en Ajustes: el texto
   guardado no se toca y no hace falta subir PROMPT_VERSION. */
export const MODOS_RESPUESTA=['razonado','rapido'];
export const ETAPAS_DESDE='ALGORITMO OBLIGATORIO',ETAPAS_HASTA='[RESPUESTA FINAL AL ASESOR]';
export const LECTURA_EN_VEZ_DE_ETAPAS=`FORMATO OBLIGATORIO — cada respuesta usa este formato:

[PENSAMIENTO INTERNO]
LECTURA: una sola línea con la página y el rótulo del fragmento que trae el dato ("pág. N · RÓTULO"), o "no está" si después de revisar TODO el contexto no aparece. El asesor pregunta como habla en piso: "alarma" es sensor, "espacio para que pase la gente" es pasillo, "entayado" es entallado.
Si la LECTURA encontró una regla que contesta la pregunta, aunque sea en negativo ("nunca", "no va"), la respuesta es esa regla con su página. "El manual no especifica" es solo para cuando la LECTURA dice "no está".

`;
/** @param {string | null | undefined} m @returns {string} */
export function modoValido(m){return m&&MODOS_RESPUESTA.includes(m)?m:'razonado'}
/* Un rol reescrito a mano, sin el bloque de etapas, se respeta tal cual: mejor
   el rol del asesor que un formato armado a medias. */
/** @param {string} system @param {string} modo @returns {string} */
export function promptDelModo(system,modo){
  if(modo!=='rapido')return system;
  const i=system.indexOf(ETAPAS_DESDE),j=system.indexOf(ETAPAS_HASTA);
  if(i<0||j<i)return system;
  return system.slice(0,i)+LECTURA_EN_VEZ_DE_ETAPAS+system.slice(j);
}
/* «pág. 6 · SENSORES» mientras el modelo escribe: en el modo rápido es lo
   primero que llega, y decirlo en la tarjeta vale más que tres puntitos. Con
   `completa`, solo cuando la línea ya terminó: a media línea salía «pág. 6 · SEN». */
/** @param {string | null | undefined} texto @param {boolean} [completa] @returns {string | null} */
export function lecturaDe(texto,completa){
  const m=(texto||'').match(completa?/LECTURA\s*:\s*([^\n]*\S)\s*\n/i:/LECTURA\s*:\s*([^\n]*\S)\s*(?:\n|$)/i);
  return m?m[1].replace(/^["«“]\s*|\s*["»”]$/g,'').trim():null;
}
/* En Ajustes, debajo del selector: con qué se midió cada modo. Elegir sin ese
   dato sería elegir a ciegas. */
/** @type {Record<string, string>} */
export const NOTA_DEL_MODO={
  razonado:'Medido con 14 manuales reales y preguntas nuevas: 74/80 datos con su página y 16/16 «no está». Primer texto en ~2 s.',
  rapido:'Medido con los mismos 14 manuales y preguntas: 70/80 datos con su página y 16/16 «no está». Primer texto en ~1 s.'
};

/* ¿Es un saludo, es del tema, pregunta quién hizo la app? (isGreetingQuestion,
   assessQuestionScope, isCreatorQuestion: src/motor/conversacion.js). */
/* ── CERTEZA DECLARADA ────────────────────────────
   La ETAPA 5 del prompt clasifica la certeza desde siempre, pero moría dentro
   del razonamiento: nada la comprobaba y el asesor no la veía. Ahora la
   respuesta cierra con una línea que la máquina puede leer, y esa línea decide
   dos cosas visibles: el distintivo del mensaje y si se enseña lámina o no.
   Una respuesta que admite el hueco no puede venir acompañada de una foto. */
export const CERTEZA_RE=/(?:^|\n)\s*\**\s*CERTEZA\s*:?\s*\**\s*(ALTA|MEDIA|GAP)\s*\**\s*\.?\s*$/i;
/** @param {string | null | undefined} texto @returns {string | null} */
export function certezaDe(texto){
  const m=(texto||'').match(CERTEZA_RE);
  return m?m[1].toUpperCase():null
}
/** @param {string | null | undefined} texto @returns {string} */
export function sinLineaDeCerteza(texto){
  return(texto||'').replace(CERTEZA_RE,'').trim()
}
/* El prompt pide la frase «El manual no especifica [X]» y a veces el modelo
   copia los corchetes: «no especifica [de qué color van los ganchos]». Los
   demás corchetes (las citas [manual · pág. N]) se quedan como están. Mientras
   se escribe, el corchete todavía no cierra y se quita solo el que abre. */
/** @param {string | null | undefined} texto @returns {string} */
export function sinCorchetesDePlantilla(texto){
  return(texto||'').replace(/(no\s+especifica\s+)\[([^\]\n]*)\]?/gi,
    (/** @type {string} */_,/** @type {string} */antes,/** @type {string} */dentro)=>antes+(/^\s*x\s*$/i.test(dentro)?'ese dato':dentro));
}
/* El prompt dibuja la respuesta como «[Respuesta directa en 2-4 oraciones…]» y
   a veces el modelo copia también esos corchetes: la contestación entera salía
   envuelta en [ ]. Una cita [manual · pág. N] no es envoltura: lleva la página
   al principio. Mientras se escribe, el corchete de cierre todavía no llega. */
/** @param {string} texto @returns {string} */
export function sinEnvolturaDePlantilla(texto){
  const t=(texto||'').trim();
  const m=t.match(/^\[([^\[\]]{40,})\]?$/);
  if(!m||/p[áa]g\.?\s*\d/i.test(m[1].slice(0,60)))return texto;
  return m[1].trim();
}

/** @param {string} final @param {string} question @returns {string} */
export function sanitizeFinalAnswer(final,question){
  let text=sinCorchetesDePlantilla(sinLineaDeCerteza(final));
  if(!text)return'';
  if(!isCreatorQuestion(question)){
    text=text
      .replace(/(?:fui|c)?(?:reado|desarrollado|programado)\s+por\s+gerardo\b[^.!?\n]*[.!?]?/gi,'')
      .replace(/gerardo\s+barrera[^.!?\n]*[.!?]?/gi,'')
      .trim();
  }
  text=text
    .replace(/^\[PENS\w*\s+\w+[^\]]*\]\s*/i,'')
    .replace(/^LECTURA\s*:[^\n]*\n/i,'')
    .replace(/^\[RESP\w*\s+FINAL[^\]]*\]\s*/i,'')
    .replace(/^ETAPA\s+\d[^\n]*\n/gm,'')
    .trim();
  text=sinEnvolturaDePlantilla(text);
  return text||final.trim();
}
/** @typedef {{thinking: string | null, final: string, parsed: boolean, cortada?: boolean}} RespuestaLeida */
/** @param {string | null | undefined} text @returns {RespuestaLeida} */
export function parseAIResponse(text){
  const raw=(text||'').trim();
  if(!raw)return{thinking:null,final:'',parsed:false};

  // Caso 1 — Formato ideal: ambos bloques con corchetes presentes
  /* Las marcas toleran erratas del modelo: «[PENSAMIENTO NTRNO]» y «[RESPUESTA
     FINAL AL SESOR]» salieron en una respuesta medida, y como no casaban con
     nada, el asesor recibió la plantilla entera, corchetes incluidos. */
  const thinkMatch=raw.match(/\[PENS\w*\s+\w+[^\]]*\]([\s\S]*?)(?=\[RESP\w*\s+FINAL)/i);
  const finalMatch=raw.match(/\[RESP\w*\s+FINAL[^\]]*\]([\s\S]*?)$/i);
  if(thinkMatch&&finalMatch){
    return{thinking:thinkMatch[1].trim(),final:finalMatch[1].trim(),parsed:true};
  }

  // Caso 2 — RESPUESTA FINAL sin corchetes de cierre
  const lineFinal=raw.match(/(?:\[)?RESP\w*\s+FINAL(?:\s+AL\s+\w+)?(?:\])?\s*\n([\s\S]*)$/i);
  if(lineFinal){
    const idx=raw.search(/(?:\[)?RESP\w*\s+FINAL/i);
    return{thinking:raw.slice(0,idx).trim(),final:lineFinal[1].trim(),parsed:true};
  }

  // Caso 3 — ETAPA 6 presente: buscar texto DESPUÉS de la línea de tono/calibración
  if(/ETAPA\s+6/i.test(raw)&&/ETAPA\s+1/i.test(raw)){
    const etapa6Idx=raw.search(/ETAPA\s+6[^\n]*/i);
    const afterEtapa6=raw.slice(etapa6Idx);
    // Saltar la primera línea (que es "ETAPA 6 — RESPUESTA CALIBRADA")
    // y también cualquier línea corta de instrucción (tono, terminología)
    const lines=afterEtapa6.split('\n');
    const contentLines=[];
    let skipping=true;
    for(const line of lines){
      if(skipping){
        // Saltar líneas de cabecera/instrucción (cortas o con palabras clave de etapa)
        if(/ETAPA\s+6|^tono\s*=|terminolog[ií]a|focal\s*·|lento|slow/i.test(line)||line.trim().length<3){
          continue;
        }
        skipping=false;
      }
      contentLines.push(line);
    }
    const final=contentLines.join('\n').trim();
    if(final.length>20){
      const thinkStart=raw.search(/(?:\[PENSAMIENTO\s+INTERNO|\bETAPA\s+1)/i);
      const thinking=thinkStart>=0?raw.slice(thinkStart,etapa6Idx).trim():'';
      return{thinking,final,parsed:true};
    }
  }

  /* Caso 3b — modo rápido sin la marca de respuesta: la LECTURA y, debajo, la
     respuesta. Sin este caso, la línea de LECTURA salía pegada encima de la
     contestación como si fuera parte de ella. */
  const conLectura=raw.match(/^(?:\[PENSAMIENTO\s+INTERNO[^\]]*\]\s*)?(LECTURA\s*:[^\n]*)\n+([\s\S]*\S[\s\S]*)$/i);
  if(conLectura)return{thinking:conLectura[1].trim(),final:conLectura[2].trim(),parsed:true};

  /* Caso 4 — fallback: devolver texto completo sin parsear.

     Con una salvedad: si el texto trae las marcas del razonamiento por etapas
     pero no llegó nunca a la respuesta final, no es una respuesta sin formato,
     es una respuesta que se cortó. Devolverla tal cual dejaba en pantalla el
     razonamiento a medias haciéndose pasar por contestación, que es la peor
     forma de fallar: parece que contestó. */
  const razonando=/\[PENSAMIENTO\s+INTERNO|\bETAPA\s+[1-5]\b|Clasifico la pregunta|Busco en el contexto|^\s*LECTURA\s*:/i.test(raw);
  return{thinking:null,final:raw,parsed:false,cortada:razonando};
}
/* Una sola repetición por pregunta: si la segunda también llega cortada, se
   enseña con su aviso en vez de insistir. */
/** @param {string} texto @param {boolean} yaSeRepitio @returns {boolean} */
export function debeRepetirPorCorte(texto,yaSeRepitio){return!yaSeRepitio&&!!parseAIResponse(texto).cortada}
/** @param {string} streamedText @returns {string | null} */
export function getStreamingDisplayText(streamedText){
  const parsed=parseAIResponse(streamedText);
  if(parsed.parsed&&parsed.final)return sinEnvolturaDePlantilla(sinCorchetesDePlantilla(sinLineaDeCerteza(parsed.final)));
  const partial=streamedText.match(/\[RESP\w*\s+FINAL[^\]]*\]([\s\S]*)$/i);
  if(partial)return sinEnvolturaDePlantilla(sinCorchetesDePlantilla(sinLineaDeCerteza(partial[1])));
  return null;
}

/* El modelo a veces envuelve el JSON en ```json o le pega una frase delante.
   Se rescata el objeto; si no hay objeto, no hay ficha —nunca se inventa una. */
/** @param {string | null | undefined} t @returns {any} */
export function jsonDeTexto(t){
  const s=(t||'').trim();
  if(!s)return null;
  try{return JSON.parse(s)}catch{}
  const sinCerca=s.replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'');
  try{return JSON.parse(sinCerca)}catch{}
  const i=s.indexOf('{'),j=s.lastIndexOf('}');
  if(i>=0&&j>i){try{return JSON.parse(s.slice(i,j+1))}catch{}}
  return null
}
