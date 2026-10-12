// Asistente de Piso · Copyright (c) 2026 Gerardo Barrera.
// Licencia PolyForm Noncommercial 1.0.0: uso comercial solo con licencia escrita (LICENCIA-COMERCIAL.md).
//
// La app (lo que queda de index.html por partir). Script clásico: sus
// declaraciones de nivel superior son globales, como cuando vivía inline.
// Lo que ya se movió a módulos llega por globalThis desde src/main.js.
pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
marked.setOptions({breaks:true,gfm:true});

/* ════════════════════════════════════════════════
   TOASTS — feedback visual no bloqueante
════════════════════════════════════════════════ */
function showToast(message, type='info', duration=4500) {
  const wrap = document.getElementById('toast-wrap');
  if (!wrap) { alert(message); return; }
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = message;
  t.style.whiteSpace = 'pre-line';
  /* En el celular los avisos salen arriba, encima de la cabecera: se cierran
     con un toque y no se apilan más de dos (se va el más viejo). */
  const cerrar = () => {
    if (t.dataset.cerrando) return;
    t.dataset.cerrando = '1';
    t.style.animation = 'toast-out .2s ease forwards';
    setTimeout(() => t.remove(), 220);
  };
  t.addEventListener('click', cerrar);
  wrap.appendChild(t);
  if (window.matchMedia && window.matchMedia('(max-width:600px)').matches) {
    const vivos = [...wrap.children].filter(x => !x.dataset.cerrando);
    vivos.slice(0, Math.max(0, vivos.length - 2)).forEach(x => x.click());
  }
  setTimeout(cerrar, duration);
}

/* Los proveedores (Gemini, OpenAI) y la clase de cada error viven en
   src/ia/proveedores.js. */

/* ════════════════════════════════════════════════
   MANUAL INTERNO BASE — Mercadep
════════════════════════════════════════════════ */
const MANUAL_INTERNO=`
=== BIBLIA DE CONOCIMIENTO — VISUAL MERCHANDISING HOMBRES MERCADEP ===
Estado: CONSOLIDACIÓN FINAL (12 manuales de referencia: M-01 a M-12, incluido el de Softline SL)
Nota: cliente ficticio. Marcas, mundos, porcentajes y números de manual son de demostración.

## 1. REGLAS DE EXHIBICIÓN GLOBALES

[MANDATORY] ENGANCHADO: El gancho siempre hacia la izquierda (signo ?). Pantalones Suit Separate colgados doblados. Conjuntos de pijamas usan gancho cristal (alto) y pinza (bajo) combinados. Batas de baño en barras.
[MANDATORY] ENTALLADO (General): Progresión estricta de chica a grande, izquierda a derecha, arriba a abajo, adelante hacia atrás. EXCEPCIÓN: Góndolas de ropa interior van de adelante hacia atrás.
[MANDATORY] SENSORES: Ocultos a 12-18 cm de la bastilla. Usar sensor blando (adherible) en corbatas para evitar daños.
[MANDATORY] ETIQUETADO OCULTO:
  · Ropa: Etiqueta siempre hacia adentro.
  · Ropa Interior: Blister (atrás), caja (costado derecho), sin empaque (costura izquierda).
  · Pijamas: Manga larga (puño izq), Manga corta (cuello trasero).
  · Accesorios: Sombreros (interior), cinturones (hebilla), joyería/llaveros (broche), plumas (tapón), lentes (pata derecha).
  · Zapatos: Casual/Vestir (suela pie derecho + caja costado derecho). Deportivo (unida en orificio superior izq o velcro).
[MANDATORY] MANIQUÍES Y DISPLAYS: Retirar sensores y etiquetas, planchar, actualizar cada 21 días. Piezas "Pompas" o "Pies" deben vestir productos de color contrastante (1 pieza por utilería).
[MANDATORY] MARCADEMOA (Softline): Prohibido mezclar meses. Identificador: "SL+Año/Mes+Estilo". Mes actual al frente, anterior al perímetro.
[MANDATORY] ALMAS DE PAPEL: Estrictamente prohibidas en Hombre Contemporáneo (Genérico/SL), Juveniles (Project), Tallas Especiales y Zona Urbana (Genérico).
[EXCEPTION] SILUETAS INCOMPLETAS: Si no hay marca para ambas partes (saco/pantalón), combinar marcas del mismo mundo.
[EXCEPTION] COLORIZACIÓN: Aplica únicamente en: Boutique Diseñadores, Contemporáneo Genérico, Camisas/Corbatas, Juveniles (MarcaDemoC/Project) y Zona Urbana.

## 2. JERARQUÍA DE CLASIFICACIÓN MAESTRA

SACOS Y PANTALONES: Mundos: Contemporáneo 40%, Formal 50%, Smart 10%. Marcas: MarcaDemoE, MarcaDemoF, MarcaDemoG, MarcaDemoB. Planograma: Smart al frente, Contemporáneo puente, Formal colinda Trajes.
DISEÑADORES: Corner 85%, Boutique 15%. Marcas: MarcaDemoE, MarcaDemoH, MarcaDemoG. Corner asignado. Boutique en alto tráfico genérico.
CASUAL: Corner 35%, Temp 25%, Gen 20%, Out 15%, Lino 5%. Marcas: MarcaDemoJ, MarcaDemoK, MarcaDemoL. Temp al frente. Outdoor tras corners. Lino colinda genérico.
HOMBRE CONTEMPORÁNEO: Genérico 75%, Corner 25%. Marcas: MarcaDemoA, MarcaDemoD, MarcaDemoH. Genérico agrupado por concepto.
JUVENILES: Corner 60%, Project 40%. Marcas: MarcaDemoJ, MarcaDemoC, MarcaDemoL. Corners en perímetro. Project a costados.
CAMISAS Y CORBATAS: Formal 55%, Contemporáneo 35%, Smart 10%. Marcas: MarcaDemoG, MarcaDemoF, MarcaDemoE. Smart al frente. Formal domina el piso.
TRAJES: Premium, Españolas, Smart, Contemporáneo, Formal, Etiqueta. Marcas: MarcaDemoG, MarcaDemoD, MarcaDemoB. Premium al frente. Etiqueta al fondo colindando Camisas.
TALLAS ESPECIALES: Casual 45%, Diseñadores 30%, Juveniles 25%. Marcas: MarcaDemoH, MarcaDemoB, MarcaDemoJ. Diseñadores al pasillo. Casual medio. Juveniles final.
ZONA URBANA: Genérico 70%, Corner 30%. Marcas: MarcaDemoK, MarcaDemoL. Recorrido continuo Genérico.
ROPA INTERIOR: Premium 40%, Contemporáneo 25%, Básicos 20%, Urbano 15%. Marcas: MarcaDemoE, MarcaDemoF, MarcaDemoD. Premium frente. Básicos al interior/fondo.
PIJAMAS: Contemporáneo 50%, Básicos 25%, Premium 15%, Loungewear 10%. Marcas: MarcaDemoA, MarcaDemoC, MarcaDemoG. Premium/Loungewear frente. Básicos fondo.
CALCETINES: Premium 40%, Contemporáneo 30%, Básicos 20%, Urbano 10%. Marcas: MarcaDemoG, MarcaDemoD, MarcaDemoB. Premium frente. Básicos interior.
ACCESORIOS: Formal 45%, Contemporáneo 35%, Urbano 20%. Marcas: MarcaDemoK, MarcaDemoE, MarcaDemoL. Urbano en rejas. Formal en cinturoneras.
ZAPATOS: Sneakers 35%, Tenis Casual 20%, Casual 15%, Vestir/Confort 10% c/u, Botas 5%, Sandalias 5%. Marcas: MarcaDemoK, MarcaDemoB, MarcaDemoJ, MarcaDemoL. Vestir al inicio. Sneakers al final o frente a Tenis Casual.

NOTA REBAJAS (BARATA): Todos operan con 40% al flujo (1ª Etapa) y 50%+20% al flujo (2ª/3ª Etapa).

## 3. MARCAS PROPIAS ESTRATÉGICAS

MarcaDemoB (Institucional Formal/Confort): Transversal en Formal, Casual, Zapatos y Tallas Especiales. Privilegio normativo de "Prioridad 2" en POS genéricos.
MARCADEMOA (Contemporáneo): Pilar de Hombre Contemporáneo. Rotación mensual estricta (SL+Año/Mes). Cruce de mercancía restrictivo (solo Softline SL).
MARCADEMOC (Juveniles/Loungewear): Marca ancla con utillería visual exclusiva (props: polaroids, pintura escurrida).

## 4. FÓRMULAS DE EXHIBICIÓN Y POS

PERÍMETROS: Bloques "Parte Alta + Exterior + Baja". Frontales exigen "prenda sobre prenda" (siluetas).
MESAS: Cruce 80/20. Estilo de vida (maniquí/busto) SIEMPRE en esquina superior derecha.
MUEBLES POS — Estratificación de 3 prioridades + Básico (Aguas en fondo). Modificador: O/I activa Térmicos en Interior/Pijamas.
  · Sacos/Pantalones: Pañuelos/Moños > Acc.cuello > Calcetines
  · Diseñadores: Art.marca > Gorras > Neceser
  · Casual: Calcetines > Set MarcaDemoB > Gorras
  · Contemporáneo: Acc.SL > Acc.sección > Gorras/Lentes
  · Juveniles: Calcetines urbanos > Gorras > Cangureras
  · Ropa Interior: R.int.caja > Sets > Térmicos(temp)
  · Pijamas: Calcetines > Sets > Térmicos(temp)
  · Accesorios: Lentes lectura > Sets > Aguas
  · Zapatos: Acc.limpieza > Plantillas > Calzadores
VITRINAS (Accesorios): Exclusivas para tratamiento especial (mancuernillas, carteras). Bloques limpios sin cajas.

## 5. PASILLOS Y DATOS TÉCNICOS CONFIRMADOS

Pasillos: 90 cm exactos.
Gancho: izquierda (signo de interrogación).
Sensor: 12-18 cm bastilla, sobre costura.
Sensor blando: solo para corbatas.
Colorización: solo en Genérico/Boutique.
Perímetros: patrón A, C, B (C = descanso visual).
Mesa: estilo de vida siempre esquina superior derecha.

## 6. ENTALLADO HOMBRES — REFERENCIA RÁPIDA

[MANDATORY] ENTALLADO (General): Progresión estricta de chica a grande, izquierda a derecha, arriba a abajo, adelante hacia atrás. EXCEPCIÓN: Góndolas de ropa interior van de adelante hacia atrás.
[CONFLICTO DOCUMENTADO] CANTIDAD DE PIEZAS EN ENTALLADO: manual M-03 indica 4 piezas · manual M-05 indica 5 piezas · manual M-09 indica 6 piezas. NUNCA responder "no especifica" — siempre citar este conflicto y la regla de progresión de tallas.

## 7. CONFLICTOS DOCUMENTADOS (responder con transparencia)

ENTALLADO: ver sección 6 arriba — 4 vs 5 vs 6 piezas según manual; citar el conflicto, no resolver arbitrariamente.
CHECKLIST: Varios manuales tienen títulos de otras secciones — error de origen corregido en esta biblia.
POS CALCETINES: Página duplicada de ropa interior en origen — ignorar duplicado.
CALZADO ANFIBIO: MarcaDemoL aparece en Tenis Casual Y Sandalias — GAP sin resolución definitiva.
LIQUIDACIÓN: Ubicación depende de pauta de corner — GAP si no hay pauta específica.
CAPACIDAD DE MUEBLE: No hay regla matemática en los manuales — GAP documentado.

## 8. MAPA DE CONFIANZA

Reglas Básicas: ALTA (estandarizado en los 12 manuales).
Jerarquías: MEDIA-ALTA (afectada por GAPs documentales, falta % en Trajes).
Perfiles de Cliente: ALTA (extraídos fielmente de infografías origen).
Props y Maniquíes: ALTA (SKUs y catálogos de utilería capturados al 100%).
Mitigación de Errores: ALTA (conflictos de checklist corregidos en este consolidado).

## 9. BÁSICOS DE DISPLAY MERCADEP (Referencia complementaria)

ENGANCHADO: Gancho apunta hacia adentro (signo de interrogación). Prenda derecha.
ROTACIÓN: Producto nuevo detrás, antiguo al frente (FIFO). Slow movers a mayor visibilidad.
COLORIZACIÓN POR BLOQUES: Izq a der: Blancos/crudos → Amarillos/naranja → Rosas/rojos → Morados/azules → Verdes → Cafés/beige → Grises → Negros. Estampados al final de cada bloque según color base.
FOCAL: 1-3 maniquíes, triangulación, producto estrella. Cambiar cada 3-4 semanas.
CROSS-MERCHANDISING: Relación lógica de uso. Máx 3-4 categorías. Producto protagonista claro.
SLOW MOVERS: Reubicar a focal → cross-merchandising → cambiar presentación → señalética → iluminación → estilo de vida.
SUPERVISIÓN DIARIA: Enganchado ✓ Alineación ✓ Colorización ✓ Maniquíes ✓ Tallas ✓ Limpieza ✓ Precios ✓
`;

/* Iconos de línea (los emojis no siguen el tema ni el grosor de las pestañas). */
const ICO={
  libro:'<svg class="ico-linea" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M8 7h6"/></svg>',
  doc:'<svg class="ico-linea" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>',
  lupa:'<svg class="ico-linea" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>',
  ojo:'<svg class="ico-linea" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></svg>',
};
/* Unos pliegues como los del fondo: el dibujo de los estados vacíos. */
const PLIEGUES='<svg class="vacio-pliegues" viewBox="0 0 120 72" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M6 60C26 52 44 58 58 44S90 24 114 30" opacity=".9"/><path d="M6 48C24 40 42 46 56 32S86 12 114 18" opacity=".6"/><path d="M6 36C22 28 40 34 54 20S82 2 114 6" opacity=".35"/></svg>';
/** Botón con icono y texto (el texto, escapado). */
const conIcono=(ico,texto)=>ICO[ico]+'<span>'+escapeHtml(texto)+'</span>';

/* ════════════════════════════════════════════════
   ACCESOS RÁPIDOS POR DEFECTO
════════════════════════════════════════════════ */
const DEFAULT_QUICK=[
  {label:'Entallado Hombres', q:'¿Cuántas piezas van en el entallado de Hombres y en qué orden?'},
  {label:'MarcaDemoB en POS', q:'¿Cuál es la prioridad de MarcaDemoB en los muebles POS y en qué secciones aplica?'},
  {label:'MarcaDemoA', q:'¿Cómo manejo la rotación de MarcaDemoA y qué es lo que nunca debo hacer?'},
  {label:'Ubicación por mundo', q:'¿Qué porcentaje de piso ocupa cada mundo en Sacos y Pantalones y cómo se ordenan?'},
  {label:'Almas de papel', q:'¿En qué secciones de Hombres están prohibidas las almas de papel?'},
  {label:'POS Contemporáneo', q:'¿Cuál es la estratificación del mueble POS en Hombre Contemporáneo?'},
];

/* ════════════════════════════════════════════════
   MOTOR 2 — CORPUS UNIFICADO Y RETRIEVAL BM25

   El manual interno y los PDF que carga el asesor viven en el
   mismo corpus y compiten con el mismo criterio. Antes cada uno
   tenía su propio camino: el conteo de keywords premiaba a los
   fragmentos largos y el modo sin API ni siquiera miraba el PDF.

   Cada entrada del corpus lleva de dónde salió — documento,
   página y sección — porque una respuesta que no se puede
   contrastar con la lámina no sirve en el piso.
════════════════════════════════════════════════ */
/* manualSections, docChunks, docFigures, corpus, docs y bm25 viven en
   src/estado.js (un solo objeto, ADR 0005 paso 2); aquí se siguen usando con
   su nombre de siempre a través de la capa de compatibilidad de src/main.js. */

/* El índice (indexChunk, BM25) vive en src/motor/indice.js. Aquí queda lo que
   depende de la pantalla: el vocabulario de la sección activa. */
function rebuildCorpus(){
  reconstruirIndice();
}

/* ── EL MANUAL DICE DE QUÉ SECCIÓN ES ─────────────
   El nombre de la sección lo lleva el propio manual (nombreDeSeccion,
   src/motor/secciones.js). El vocabulario de la sección activa —con qué se
   reconoce una pregunta del dominio— vive en src/motor/conversacion.js y se
   calcula cuando hace falta: ya no hay que rehacerlo a mano al cambiar de
   sección o de corpus. */

function initManualSections(){
  manualSections=MANUAL_INTERNO.trim().split(/\n(?=## )/)
    .filter(p=>p.trim().length>30)
    .map((p,i)=>{
      const text=p.trim();
      const first=text.split('\n')[0];
      return indexChunk({
        id:'man-'+i,source:'manual',docName:'Manual interno',page:null,
        heading:first.startsWith('## ')?first.slice(3).trim():'',
        text,figureIds:[]
      });
    });
  rebuildCorpus();
}

/* La búsqueda vive en src/motor/: busqueda.js (retrieve y el empaquetado del
   contexto), secciones.js (de qué sección es cada manual), puerta.js (cuándo
   la evidencia es sólida) y ruta.js (contra qué sección se responde). Lo que
   entró al contexto queda en `ultimosFragmentos` (src/estado.js). */

/* Y si la pregunta era de otra sección cargada, cuál: el botón que ofrece el
   cambio se pinta con la respuesta, que es donde el asesor está mirando. */
let ultimaOtraSeccion=null;
/* Y la sección que puede tener lo que a esta le falta. Es más suave que
   `ultimaOtraSeccion`: ahí no se responde nada, aquí se responde con el manual
   del asesor y además se le ofrece mirar al lado. */
let ultimaSeccionSugerida=null;
/* Contra qué manual se respondió de verdad, y si lo eligió la pregunta en vez
   del selector. Va a la tira de fuentes: responder por una sección que el asesor
   no eligió sin decírselo es la misma trampa, al revés. */
let ultimaSeccionUsada=null,ultimaSeccionPorPregunta=false;

/* ════════════════════════════════════════════════
   CONSTRUCCIÓN DE CONTEXTO
   Lo que recibe el modelo lo arma src/motor/respuesta.js
   (contextoParaModelo), con sus presupuestos y los avisos que
   lee. Aquí queda lo que solo sabe la app: el historial, el
   proveedor y el contexto del asesor.
════════════════════════════════════════════════ */

/* Las preguntas de seguimiento («¿y en juveniles?») y contra qué sección se
   responde viven en src/motor/conversacion.js, que recibe el historial. */
function consultaDeBusqueda(q,hist){return consultaAmpliada(q,hist||history)}
/* La sección de la pregunta, con la ruta ya calculada para este turno. */
function decidirSeccion(query){return seccionDeLaPregunta(query,rutaDe)}

/* ── LA SECCIÓN QUE ELIGE LA PREGUNTA ─────────────
   Con muchos manuales cargados y ninguno elegido, cada pregunta se buscaba en
   todos a la vez: el agente no corría —necesita UNA sección—, el modo manual
   mezclaba tarjetas de varias y el motor clásico mandaba al modelo fragmentos
   de tres secciones con un aviso. El asesor no tiene por qué elegir primero:
   casi siempre la pregunta dice de qué sección es. La nombra («en juveniles»),
   sigue la conversación anterior («¿y sandalias?»), o solo un manual tiene con
   qué responderla. Vale para esa pregunta y nada más: el selector se queda
   como estaba. Y si dos secciones responden igual de bien no se adivina: se
   le pregunta al asesor con un botón por sección, sin gastar una llamada. */
let rutaActual=null;    // la de la pregunta en curso: {q, doc, motivo, alternativas}
let rutaForzada=null;   // {q, doc}: la eligió el asesor en un empate
/* La ruta depende de la pregunta y de todo lo que la rodea: la sección
   elegida, qué manuales hay y qué se preguntó antes (rutaDeLaPregunta). */
const claveDeRuta=q=>[q,appState.manualActivo||'',docs.map(d=>d.name).join('|'),history.length].join('\u0001');
function enrutarSeccion(q){
  const r=rutaDeLaPregunta(q,history,rutaForzada);
  /* La sección que eligió el asesor en un empate vale para esa pregunta. */
  if(r.motivo==='elegida-por-ti')rutaForzada=null;
  return{...r,clave:claveDeRuta(q)}
}
/* La ruta de ESTA pregunta, si ya se calculó; si no —una prueba, una
   medición que llama directo—, se calcula aquí. */
function rutaDe(q){
  if(!rutaActual||rutaActual.clave!==claveDeRuta(q))rutaActual=enrutarSeccion(q);
  return rutaActual
}
/* El empate se contesta con una pregunta, no con una respuesta: un botón por
   sección, y al pulsarlo se repite lo mismo en esa. Nada sale del teléfono. */
function preguntarSeccion(q,alternativas){
  const nombres=alternativas.map(d=>'**'+nombreDeSeccion(d)+'**');
  const texto=`Eso aparece en ${nombres.slice(0,-1).join(', ')} y en ${nombres[nombres.length-1]}, y ${nombres.length===2?'las dos':'todas'} lo responden igual de bien. ¿En cuál estás?`;
  const el=appendMsg('assistant',texto,false);
  el.classList.add('pregunta-seccion');
  const fila=document.createElement('div');fila.className='chips-ia';
  for(const d of alternativas){
    const b=document.createElement('button');b.className='chip-ia';b.innerHTML=conIcono('libro',nombreDeSeccion(d));
    b.onclick=()=>{rutaForzada={q,doc:d};fila.querySelectorAll('button').forEach(x=>x.disabled=true);ask(q)};
    fila.appendChild(b);
  }
  el.appendChild(fila);
  history.push({role:'user',content:q});
  history.push({role:'assistant',content:texto,modo:'manual'});
  saveChatHistory();scrollToBottom();
  return el
}
/* En una línea, de qué sección salió y por qué, con botón a la otra si otra
   también tenía con qué. Solo cuando la eligió la app: si la eligió el asesor
   en el selector, ya lo sabe. */
function lineaDeRuta(q,ruta,soloBotones){
  if(!ruta||!RUTA_ROTULO[ruta.motivo]||!ruta.doc)return null;
  if(soloBotones&&!(ruta.alternativas||[]).length)return null;
  const wrap=document.createElement('div');wrap.className='ruta-seccion';
  const t=document.createElement('span');
  if(soloBotones)t.textContent='¿Era de otra sección?';
  else t.innerHTML=conIcono('libro',`Busqué en ${nombreDeSeccion(ruta.doc)} (${RUTA_ROTULO[ruta.motivo]})`);
  wrap.appendChild(t);
  for(const d of ruta.alternativas||[]){
    const b=document.createElement('button');b.className='chip-ia';b.textContent='¿Era de '+nombreDeSeccion(d)+'?';
    b.onclick=()=>{rutaForzada={q,doc:d};b.disabled=true;ask(q)};
    wrap.appendChild(b);
  }
  return wrap
}
function botonesDeRutaAlterna(loaderEl,q){
  const alt=lineaDeRuta(q,rutaActual&&rutaActual.q===q?rutaActual:null,true);
  if(alt)loaderEl.appendChild(alt);
}

/* Qué palabra de la pregunta no tiene la sección (`terminosAusentes`,
   src/motor/puerta.js) y cómo se le dice al modelo (`avisoPalabraAusente`,
   src/motor/respuesta.js). */

/* ── PREGUNTAS SOBRE EL PROPIO MANUAL ─────────────
   «¿De qué trata este manual?», «¿qué manuales tengo cargados?», «¿en qué
   sección estoy?»: se reconocen en src/motor/conversacion.js
   (esPreguntaDeEstado). No es que falte información: es que la respuesta no
   está en ninguna lámina, está en la app. Se le entregan los datos y redacta
   él; no se le enlata una respuesta, porque el asesor mezcla («¿qué manuales
   tengo y cuál me sirve para vinos?») y una plantilla fija contestaría media
   pregunta.

   Va dentro del contexto y no en el prompt de sistema, así que PROMPT_VERSION
   no se mueve y los prompts que el asesor tenga guardados siguen valiendo. */
/* La misma información, escrita para la pantalla. Es la única respuesta que el
   modo sin API key puede dar entera, porque no hay nada que interpretar: son
   los datos de la app. */
function estadoParaPantalla(){
  if(!docs.length)return'**No tienes ningún manual cargado.** Súbelo en la pestaña Manuales y te respondo con él.';
  const activo=appState.manualActivo;
  const lista=docs.map(d=>{
    const propios=docChunks.filter(c=>c.docName===d.name);
    const pags=new Set(propios.map(c=>c.page)).size;
    return `- **${nombreDeSeccion(d.name)}**${d.name===activo?' ← tu sección activa':''} · ${pags} páginas`;
  }).join('\n');
  const temas=accesosDelManual().map(b=>b.label);
  return`Tienes **${docs.length}** ${docs.length===1?'manual cargado':'manuales cargados'}:\n\n${lista}\n\n`
    +(activo?`Estás trabajando en **${nombreDeSeccion(activo)}**.`:'No has elegido sección, así que se busca en todas a la vez. Elige una arriba para que las respuestas salgan de un solo manual.')
    +(temas.length?`\n\nHabla de: ${temas.join(', ')}.`:'')
}
function contextoDeEstado(){
  if(!docs.length)return`=== ESTADO DE LA APP ===
No hay ningún manual cargado. El asesor pregunta por la app o por sus manuales.
Dile que todavía no ha subido ninguno y que puede cargar su PDF en la pestaña
"Manuales". No inventes secciones ni datos. Cierra con CERTEZA: ALTA.`;
  const activo=appState.manualActivo;
  const filas=docs.map(d=>{
    const propios=docChunks.filter(c=>c.docName===d.name);
    const pags=new Set(propios.map(c=>c.page)).size;
    const figs=docFigures.filter(f=>f.docName===d.name).length;
    return `· ${nombreDeSeccion(d.name)}${d.name===activo?'   ← ES LA SECCIÓN ACTIVA':''} — ${pags} páginas, ${propios.length} fragmentos, ${figs} láminas`;
  });
  /* De qué habla la sección: los rótulos que más se repiten en sus láminas. Ya
     se calculan para los accesos rápidos, y son la respuesta honesta a "¿de qué
     trata?" — salen del propio manual, no de un resumen inventado. */
  const temas=accesosDelManual().map(b=>b.label);
  return`=== ESTADO DE LA APP (datos ciertos; NO salen de ninguna lámina) ===
Manuales cargados: ${docs.length}
${filas.join('\n')}
Sección activa: ${activo?nombreDeSeccion(activo):'ninguna — el asesor no ha elegido, se busca en todos a la vez'}
${temas.length?`Temas de los que habla la sección activa: ${temas.join(', ')}.`:''}

El asesor está preguntando por la app o por el manual en sí, no por una regla de
piso. Responde con estos datos, en dos o tres frases, sin formato de etapas. No
cites páginas —esto no sale de ninguna— y no añadas nada que no esté aquí
arriba. Cierra con CERTEZA: ALTA.`
}

/* El contexto lo arma el motor (contextoParaModelo, src/motor/respuesta.js).
   Aquí se le pasa lo que solo sabe la app y se guarda lo que pinta la
   pantalla: el botón a otra sección y la tira de fuentes. */
function buildContext(query){
  ultimaOtraSeccion=null;
  ultimaSeccionSugerida=null;
  const b=contextoParaModelo(query,{hist:history,rutaDe,
    presupuesto:appState.provider==='gemini'?PDF_BUDGET_GEMINI:PDF_BUDGET,
    extra:appState.extraEnabled?appState.extra||'':'',textoDeEstado:contextoDeEstado});
  ultimaOtraSeccion=b.otraSeccion;
  ultimaSeccionSugerida=b.seccionSugerida;
  ultimaSeccionUsada=b.seccionUsada;
  ultimaSeccionPorPregunta=b.seccionPorPregunta;
  return b
}

/* ── BUSCAR EN TODOS MIS MANUALES ─────────────────
   Aquí vivía la consulta a la «referencia general Mercadep», y nunca funcionó:
   preguntaba por `man.solidos`, un campo que getManualContext no devuelve, así
   que la condición era siempre cierta y la función siempre devolvía vacío. El
   botón contestaba "la referencia general tampoco lo cubre" sin haber buscado.

   Arreglarlo tal cual habría sido peor que dejarlo roto: su fuente es el manual
   interno, que es de demostración —marcas ficticias, cifras inventadas— y
   devolverlo rotulado como política de la cadena le pone al asesor una regla
   falsa delante con toda la apariencia de verdadera.

   Así que el botón busca donde sí hay verdad: en los OTROS manuales del asesor.
   Es la misma pregunta contra el corpus entero, con cada dato citado a su
   sección y a su página. El manual interno se queda en su único papel legítimo:
   la fuente cuando no hay ningún PDF cargado. */
function contextoTodosLosManuales(query){
  if(docs.length<2)return'';
  ultimosFragmentos=[];
  /* Se pulsa después de contestar, con la pregunta ya en el historial: la
     «anterior» era ella misma, y «¿y en juveniles?» se buscaba como «¿y en
     juveniles? ¿y en juveniles?». La anterior es la de antes de esta. */
  const hist=history.slice();
  const ult=hist.map(m=>m.role).lastIndexOf('user');
  if(ult>=0&&hist[ult].content===query)hist.length=ult;
  const pdf=getPdfContext(consultaDeBusqueda(query,hist),PDF_BUDGET,null);
  if(!pdf.nivel)return'';
  const secciones=new Set(ultimosFragmentos.map(c=>c.docName));
  const activa=appState.manualActivo?nombreDeSeccion(appState.manualActivo):null;
  return`=== BÚSQUEDA EN TODAS LAS SECCIONES — NO ES LA SECCIÓN ACTIVA ===
El asesor pidió buscar esto en todos sus manuales, no solo en el que tiene
abierto${activa?` ("${activa}")`:''}. Cada fragmento viene rotulado con su documento y su página:
di SIEMPRE de qué sección sale cada dato, con el nombre de la sección y la
página. Si nada de lo de abajo responde, dilo y ya. No mezcles dos secciones en
una sola regla.
${secciones.size>1?'\n'+avisoVariasSecciones(secciones.size)+'\n':''}
${pdf.texto}`
}


/* ════════════════════════════════════════════════
   PARSER DE RESPUESTA + GUARDRAILS
════════════════════════════════════════════════ */
/* El prompt de reglas, el modo de respuesta, la certeza declarada y el parser
   viven en src/ia/respuesta.js. Aquí queda lo que pinta Ajustes. */
function pintarNotaDelModo(){
  const sel=document.getElementById('modo-respuesta-select'),nota=document.getElementById('modo-respuesta-nota');
  if(sel&&nota)nota.textContent=NOTA_DEL_MODO[modoValido(sel.value)];
}

/* ════════════════════════════════════════════════
   ESTADO DE LA APP
════════════════════════════════════════════════ */
const appState={
  provider:'gemini',apiKey:'',chatModel:'gemini-3.5-flash-lite',
  system:'',extra:'',tokenLimit:80000,
  aprendeEnabled:true,extraEnabled:true,temperature:0.2,
  modoRespuesta:'razonado',
  /* 'agente': la IA lee el manual con herramientas. 'clasico': búsqueda local
     y seis etapas. Se elige en Ajustes. */
  motor:'clasico'
};
/* La sección activa vive en src/estado.js (estado.manualActivo): es el alcance
   de la consulta y el motor la lee de ahí. appState.manualActivo la sigue
   nombrando para el resto de la app. */
Object.defineProperty(appState,'manualActivo',{get:()=>estado.manualActivo,set:v=>{estado.manualActivo=v},enumerable:true});
let history=[],sessionTokens=0,quickBtns=[],editingQuick=false,isGenerating=false,chatDescartado=false;
function estimateTokens(t){return Math.ceil((t||'').length/3.5)}

/* ════════════════════════════════════════════════
   TOKEN BAR
════════════════════════════════════════════════ */
function updateTokenBar(){
  const limit=appState.tokenLimit,pct=Math.min((sessionTokens/limit)*100,100);
  const fill=document.getElementById('token-bar-fill'),warn=document.getElementById('token-warning');
  document.getElementById('tk-used').textContent=sessionTokens.toLocaleString('es-MX');
  document.getElementById('tk-limit').textContent=limit.toLocaleString('es-MX');
  fill.style.width=pct+'%';
  if(pct>=100){fill.className='token-bar-fill limit';warn.className='token-warning limit show';warn.textContent='🔴 Límite alcanzado. Limpia el chat o reinicia el contador.'}
  else if(pct>=80){fill.className='token-bar-fill warn';warn.className='token-warning warn show';warn.textContent=`⚠ ${Math.round(pct)}% de tokens usados.`}
  else{fill.className='token-bar-fill';warn.className='token-warning'}
}
function resetTokens(){
  sessionTokens=0;updateTokenBar();
  const m=document.getElementById('token-reset-msg');m.style.display='inline';setTimeout(()=>m.style.display='none',2000);
}

/* ════════════════════════════════════════════════
   PROVIDER UI
════════════════════════════════════════════════ */
const PROV_INFO={
  openai:'API key de OpenAI. <a href="https://platform.openai.com/api-keys" target="_blank">platform.openai.com/api-keys</a>',
  gemini:'API key de Google AI Studio. <a href="https://aistudio.google.com/app/apikey" target="_blank">aistudio.google.com/app/apikey</a> — Plan gratuito disponible.'
};
function selectProvider(id,btn){
  appState.provider=id;
  document.querySelectorAll('.prov-tab').forEach(t=>t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('prov-info').innerHTML=PROV_INFO[id];
  document.getElementById('api-key-input').placeholder=PROVIDERS[id].placeholder;
  const chatSel=document.getElementById('chat-model-select');
  const p=PROVIDERS[id];
  chatSel.innerHTML=p.chatModels.map(m=>`<option value="${m}">${etiquetaDeModelo(m)}</option>`).join('');
  /* Si el modelo no existe en este proveedor se queda el primero de la lista.
     Antes appState seguía con el anterior: elegir Gemini y volver al chat sin
     guardar mandaba «gpt-4o-mini» a Google, que contestaba «modelo no
     encontrado». */
  if(!p.chatModels.includes(appState.chatModel))appState.chatModel=p.chatModels[0];
  chatSel.value=appState.chatModel;
  // v7.0 paso 3: cargar key del proveedor seleccionado
  try{
    const provKey='ap_api_key_'+id;
    const stored=sessionStorage.getItem(provKey)||'';
    document.getElementById('api-key-input').value=stored;
    appState.apiKey=stored;
    updateKeyStatus(stored);
  }catch{}
}

/* ════════════════════════════════════════════════
   INIT — v7.0 con sessionStorage para datos sensibles
════════════════════════════════════════════════ */
function loadSaved(){
  try{
    appState.provider=proveedorValido(localStorage.getItem('ap_provider'));
    // v7.0: API key migrada a sessionStorage — carga por proveedor
    try {
      const provKey = 'ap_api_key_' + appState.provider;
      appState.apiKey = sessionStorage.getItem(provKey) || '';
    } catch { appState.apiKey = ''; }
    // Limpieza defensiva: si quedó rastro en localStorage v6, eliminarlo
    if (!appState.apiKey) {
      try { localStorage.removeItem('ap_api_key'); } catch {}
    }
    const alCargar=modeloAlCargar(localStorage.getItem('ap_chat_model'),localStorage.getItem('ap_modelo_v2'),appState.provider);
    appState.chatModel=alCargar.modelo;
    try{localStorage.setItem('ap_modelo_v2','1');if(alCargar.migrar)localStorage.setItem('ap_chat_model',alCargar.modelo)}catch{}
    if(localStorage.getItem('ap_prompt_version')!==PROMPT_VERSION){
      appState.system=document.getElementById('system-prompt').value;
      try{localStorage.setItem('ap_system',appState.system);localStorage.setItem('ap_prompt_version',PROMPT_VERSION);}catch{}
    }else{
      appState.system=localStorage.getItem('ap_system')||document.getElementById('system-prompt').value;
    }
    appState.extra=localStorage.getItem('ap_extra')||'';
    appState.manualActivo=localStorage.getItem('ap_manual_activo')||null;
    appState.motor=localStorage.getItem('ap_motor')==='agente'?'agente':'clasico';
    const motorSel=document.getElementById('motor-select');if(motorSel)motorSel.value=appState.motor;
    appState.tokenLimit=parseInt(localStorage.getItem('ap_token_limit')||'80000',10);
    document.getElementById('api-key-input').value=appState.apiKey;
    document.getElementById('system-prompt').value=appState.system;
    document.getElementById('extra-ctx').value=appState.extra;
    document.getElementById('token-limit-input').value=appState.tokenLimit;
    const topeIn=document.getElementById('ficha-tope-input');if(topeIn)topeIn.value=topeFichaDia();
    const provBtn=document.querySelector(`.prov-tab:nth-child(${PROV_ORDEN.indexOf(appState.provider)+1})`);
    if(provBtn)selectProvider(appState.provider,provBtn);
    else selectProvider(PROV_ORDEN[0],document.querySelector('.prov-tab'));
    const chatSel=document.getElementById('chat-model-select');
    if([...chatSel.options].some(o=>o.value===appState.chatModel))chatSel.value=appState.chatModel;
    try{quickBtns=JSON.parse(localStorage.getItem('ap_quick'))||[...DEFAULT_QUICK]}catch{quickBtns=[...DEFAULT_QUICK]}
    /* Se guardan como '1'/'0'. Leerlos contra 'false' los volvía a encender en
       cada recarga: apagar la memoria no duraba más que la pestaña. */
    const apagado=v=>v==='0'||v==='false';
    appState.aprendeEnabled=!apagado(localStorage.getItem('ap_aprende_enabled'));
    appState.extraEnabled=!apagado(localStorage.getItem('ap_extra_enabled'));
    appState.temperature=parseFloat(localStorage.getItem('ap_temperature')||'0.2');
    appState.modoRespuesta=modoValido(localStorage.getItem('ap_modo_respuesta'));
    document.getElementById('modo-respuesta-select').value=appState.modoRespuesta;
    pintarNotaDelModo();
    document.getElementById('toggle-aprende').checked=appState.aprendeEnabled;
    document.getElementById('toggle-extra').checked=appState.extraEnabled;
    document.getElementById('temp-slider').value=Math.round(appState.temperature*100);
    document.getElementById('temp-display').textContent=appState.temperature.toFixed(2);
  }catch{appState.provider='gemini';quickBtns=[...DEFAULT_QUICK]}
  initManualSections();cargarAprendido();
  updateKeyStatus(appState.apiKey);
  // Mostrar aviso de key si está configurada
  const warnEl = document.getElementById('key-warning');
  if (warnEl && appState.apiKey) warnEl.classList.add('show');
  renderDocs();renderQuickBtns();updateTokenBar();
  // v7.0: banner de restore desde sessionStorage
  /* La conversación de esta sesión vuelve sola al recargar (dura hasta cerrar
     la app). Antes se ofrecía con un banner, y se perdía si nadie lo tocaba. */
  try{if(sessionStorage.getItem('ap_chat_history_v5'))loadChatHistory()}catch{}
  // v7.0 paso 3: sincronizar selector API Experta
  syncExpertSelector();
}

/* ════════════════════════════════════════════════
   CONTADOR DEL SYSTEM PROMPT
   Umbrales:
     warn  a partir de 3000 chars (~850 tokens) — aviso preventivo
     limit a partir de 4500 chars (~1280 tokens) — puede afectar respuesta
══════════════════════════════════════════════ */
function updateSystemPromptCounter(){
  const el=document.getElementById('system-prompt');
  const counter=document.getElementById('system-prompt-counter');
  const charsEl=document.getElementById('system-prompt-chars');
  const tokensEl=document.getElementById('system-prompt-tokens');
  if(!el||!counter||!charsEl||!tokensEl)return;
  const chars=el.value.length;
  const tokens=estimateTokens(el.value);
  charsEl.textContent=chars.toLocaleString('es-MX');
  tokensEl.textContent=tokens.toLocaleString('es-MX');
  counter.classList.remove('warn','limit');
  if(chars>=4500)counter.classList.add('limit');
  else if(chars>=3000)counter.classList.add('warn');
}
function initSystemPromptCounter(){
  const el=document.getElementById('system-prompt');
  if(!el)return;
  el.addEventListener('input',updateSystemPromptCounter);
  updateSystemPromptCounter();
}
function updateKeyStatus(key){
  const badge=document.getElementById('status-badge'),status=document.getElementById('key-status');
  const pName=PROVIDERS[appState.provider]?.name||'API';
  document.body.classList.toggle('sin-api',!(key&&key.length>10));
  if(!navigator.onLine){
    badge.className='status-pill warn';badge.textContent='Sin señal · manual';
  }else if(key&&key.length>10){
    badge.className='status-pill ok';badge.textContent='API conectada';
    status.className='key-status ok';status.textContent=`✓ ${pName} activa`;
  }else{
    badge.className='status-pill warn';badge.textContent='Modo manual';
  }
  if(key&&key.length>10){
    status.className='key-status ok';status.textContent=`✓ ${pName} activa`;
  }else{
    status.className='key-status warn';status.textContent='⚪ Sin clave: se responde con el manual, sin interpretación';
  }
}
function toggleKey(){const inp=document.getElementById('api-key-input');inp.type=inp.type==='password'?'text':'password'}
function updateTempDisplay(val){
  const t=parseInt(val,10)/100;
  document.getElementById('temp-display').textContent=t.toFixed(2);
  appState.temperature=t;
}

/* ════════════════════════════════════════════════
   CHAT PERSISTENCE — v7.0: sessionStorage
════════════════════════════════════════════════ */
function saveChatHistory(){
  try{
    if(history.length){
      sessionStorage.setItem('ap_chat_history_v5', JSON.stringify(history));
      sessionStorage.setItem('ap_chat_history_exists', '1');
      // Limpieza defensiva de localStorage v6
      try { localStorage.removeItem('ap_chat_history_v5'); localStorage.removeItem('ap_chat_history_exists'); } catch {}
    } else {
      sessionStorage.removeItem('ap_chat_history_v5');
      sessionStorage.removeItem('ap_chat_history_exists');
    }
  } catch (e) {
    if (e?.name === 'QuotaExceededError') {
      showToast('Memoria de sesión llena. El chat no se guardará hasta limpiar.', 'warn');
    }
  }
}
function loadChatHistory(){
  try{
    const s=sessionStorage.getItem('ap_chat_history_v5');
    if(!s)return;
    const h=JSON.parse(s);
    if(!Array.isArray(h)||!h.length)return;
    history=h;
    const box=document.getElementById('chat-messages');
    const empty=document.getElementById('chat-empty');if(empty)empty.remove();
    box.innerHTML='';
    for(const m of history){
      const div=document.createElement('div');div.className='msg '+m.role;
      const label=document.createElement('div');label.className='msg-label';label.textContent=m.role==='user'?'Tú':'Asistente';
      const body=document.createElement('div');body.className='msg-body';
      if(m.role==='user')body.textContent=m.content;else body.innerHTML=safeMarkdown(m.content);
      div.appendChild(label);div.appendChild(body);box.appendChild(div);
    }
    const nota=document.createElement('div');nota.className='chat-restaurado';
    nota.textContent='Conversación restaurada. Las láminas vuelven si repites la pregunta.';
    box.appendChild(nota);
    scrollToBottom();
    document.getElementById('restore-banner').classList.remove('show');
    sessionStorage.removeItem('ap_chat_history_exists');
  }catch{}
}
function restoreChatHistory(){loadChatHistory();}
function dismissRestoreBanner(){
  document.getElementById('restore-banner').classList.remove('show');
  try{sessionStorage.removeItem('ap_chat_history_exists')}catch{}
}
/* La primera pregunta nueva sobrescribe la conversación guardada, pero el
   banner seguía ofreciendo «Restaurar»: pulsarlo después traía la conversación
   nueva y la anterior ya no existía. Al preguntar, el banner se va. */
function ocultarBannerRestaurar(){
  const b=document.getElementById('restore-banner');
  if(b&&b.classList.contains('show'))dismissRestoreBanner();
}

/* ════════════════════════════════════════════════
   CONFIG — GUARDAR v7.0
════════════════════════════════════════════════ */
function saveConfig(evt){
  const activeProv=PROV_ORDEN.find((_,i)=>document.querySelectorAll('.prov-tab')[i]?.classList.contains('active'))||PROV_ORDEN[0];
  appState.provider=activeProv;
  appState.apiKey=document.getElementById('api-key-input').value.trim();
  appState.chatModel=document.getElementById('chat-model-select').value;
  appState.motor=document.getElementById('motor-select')?.value==='agente'?'agente':'clasico';
  appState.system=document.getElementById('system-prompt').value.trim();
  appState.extra=document.getElementById('extra-ctx').value.trim();
  appState.tokenLimit=parseInt(document.getElementById('token-limit-input').value,10)||80000;
  appState.aprendeEnabled=document.getElementById('toggle-aprende').checked;
  appState.extraEnabled=document.getElementById('toggle-extra').checked;
  appState.temperature=parseInt(document.getElementById('temp-slider').value,10)/100;
  appState.modoRespuesta=modoValido(document.getElementById('modo-respuesta-select').value);
  try{
    localStorage.setItem('ap_provider',appState.provider);
    localStorage.setItem('ap_modo_respuesta',appState.modoRespuesta);
    // v7.0 paso 3: API key por proveedor en sessionStorage
    const provKey = 'ap_api_key_' + activeProv;
    if (appState.apiKey) {
      try { sessionStorage.setItem(provKey, appState.apiKey); sessionStorage.removeItem('ap_api_key'); } catch {}
      /* Solo la marca de que hubo key, nunca la key: sirve para avisar cuando
         se borró al cerrar la app. */
      try { localStorage.setItem('ap_ia_usada', '1'); } catch {}
      try { localStorage.removeItem('ap_api_key'); } catch {}
    } else {
      try { sessionStorage.removeItem(provKey); sessionStorage.removeItem('ap_api_key'); } catch {}
    }
    localStorage.setItem('ap_chat_model',appState.chatModel);
    localStorage.setItem('ap_motor',appState.motor);
    localStorage.setItem('ap_system',appState.system);
    localStorage.setItem('ap_extra',appState.extra);
    localStorage.setItem('ap_token_limit',appState.tokenLimit);
    localStorage.setItem('ap_aprende_enabled',appState.aprendeEnabled?'1':'0');
    localStorage.setItem('ap_extra_enabled',appState.extraEnabled?'1':'0');
    localStorage.setItem('ap_temperature',appState.temperature);
    const tope=parseInt(document.getElementById('ficha-tope-input')?.value,10);
    if(tope>0)localStorage.setItem('ap_ficha_tope',String(tope));
  } catch (e) {
    if (e?.name === 'QuotaExceededError') {
      showToast('Almacenamiento lleno. No se pudo guardar la configuración.', 'error');
    }
  }
  updateKeyStatus(appState.apiKey);updateTokenBar();
  // Mostrar/ocultar aviso de sessionStorage
  const warnEl = document.getElementById('key-warning');
  if (warnEl) warnEl.classList.toggle('show', !!appState.apiKey);
  const btn=evt?.target||document.querySelector('.save-btn');btn.textContent='✓ Guardado';setTimeout(()=>btn.textContent='Guardar cambios',1800);
  // v7.0 paso 3: sincronizar selector API Experta
  syncExpertSelector();
  /* Con la key recién puesta, los manuales que la IA no ha leído se dicen: la
     lectura cuesta peticiones, así que la arranca el asesor desde Manuales. */
  renderAccionesDocs();
  const sinLeer=docs.filter(d=>paginasSinFicha(d.name).length).length;
  if(hayKeyParaIA()&&sinLeer&&!preparandoFicha)
    showToast(`📖 ${sinLeer===1?'Tu manual aún no está preparado':`${sinLeer} manuales aún no están preparados`} para el modo IA: en Manuales, «Preparar para el modo IA» deja que la IA lea las láminas una vez.`,'info',7000);
}

/* ════════════════════════════════════════════════
   TABLERO — LO QUE PREGUNTA TU EQUIPO

   La memoria de 👍/👎 servía para el modelo, no para quien dirige el piso. A
   una jefa o a una regional no le dice nada «12 éxitos, 3 fallos»; le sirve
   saber qué duda se repite y qué no trae el manual, porque eso es lo que se
   corrige con una junta o con retroalimentación a corporativo. Cada consulta
   se anota aquí: la sección, si el manual la cubrió, la lámina que contestó
   y el voto si lo hubo. Vive en el teléfono (localStorage) y solo sale si el
   asesor comparte el resumen. Lo cuenta igual el modo manual —que es con el
   que se trabaja con manuales reales— que el modo con API.
════════════════════════════════════════════════ */
const TABLERO_KEY='ap_tablero_v1',TABLERO_MAX=600;
let tablero=[],tableroPeriodo='todo';
function cargarTablero(){
  try{const s=localStorage.getItem(TABLERO_KEY);tablero=s?JSON.parse(s):[]}catch{tablero=[]}
  if(!Array.isArray(tablero))tablero=[];
}
function guardarTablero(){try{localStorage.setItem(TABLERO_KEY,JSON.stringify(tablero))}catch{}}
/* `dudoso`: hubo tarjetas, pero una palabra clave de la pregunta no está en el
   manual. Cuenta como no explicada hasta que alguien diga con 👍 que sí le
   sirvió: quien preguntó sabe mejor que el buscador si «espacio» era «pasillo». */
function registrarConsulta(q,encontro,chunk,modo,dudoso){
  /* Las preguntas del examen no son dudas del equipo: no van al tablero. */
  if(midiendo)return null;
  const ruta=rutaActual&&rutaActual.q===q&&rutaActual.doc?nombreDeSeccion(rutaActual.doc):null;
  const r={id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),t:Date.now(),
    q:String(q).slice(0,200),sec:seccionActiva()||ruta,ok:!!encontro,modo,voto:null};
  if(dudoso)r.dudoso=true;
  if((encontro||dudoso)&&chunk){
    if(chunk.source==='pdf')r.sec=nombreDeSeccion(chunk.docName);
    /* «CHECK LIST: 140 CASUAL HOMBRE»: el nombre de la sección ya va aparte. */
    let h=(chunk.heading||'').replace(/^#+\s*/,'').trim();
    if(r.sec&&normalizeText(h).endsWith(normalizeText(r.sec))&&h.length>r.sec.length)
      h=h.slice(0,h.length-r.sec.length).replace(/[\s:·\-–]+$/,'');
    r.h=h||null;
    r.p=chunk.page||null;
  }
  tablero.push(r);
  if(tablero.length>TABLERO_MAX)tablero=tablero.slice(-TABLERO_MAX);
  guardarTablero();
  notarConsultaParaAprender(r,q,chunk);
  if(document.getElementById('panel-memory').classList.contains('active'))renderTablero();
  return r.id
}
function votarConsulta(id,voto,nota){
  const r=tablero.find(x=>x.id===id);if(!r)return;
  r.voto=voto;
  /* La nota del 👎 es lo más valioso que deja el piso: dice qué esperaba.
     Antes solo iba a la memoria del modelo; aquí viaja con la pregunta. */
  if(voto==='mal'&&nota)r.nota=String(nota).slice(0,300);
  if(r.dudoso)r.ok=voto==='bien';
  guardarTablero();
}
/* 👍/👎 para la respuesta sin modelo. Sin esto «resuelta» solo podía querer
   decir «el manual traía algo», y el piloto necesita saber si le sirvió. */
function votoManual(msgEl,id,{q=null,doc=null,pagina=null}={}){
  const footer=document.createElement('div');footer.className='msg-footer';
  const pr=document.createElement('span');pr.className='fb-pregunta';pr.textContent='¿Te sirvió?';
  const bien=document.createElement('button');bien.className='fb-btn good';bien.type='button';bien.textContent='👍';bien.setAttribute('aria-label','Sí me sirvió');
  const mal=document.createElement('button');mal.className='fb-btn bad';mal.type='button';mal.textContent='👎';mal.setAttribute('aria-label','No me sirvió');
  const votar=(btn,voto)=>{
    if(bien.disabled)return;
    btn.classList.add('active');bien.disabled=mal.disabled=true;
    votarConsulta(id,voto);
    pr.textContent=voto==='bien'?'Anotado ✓':'Anotado en el tablero: esta no sirvió';
    if(q&&voto==='bien')confirmarCamino(q,doc,pagina,id);
    if(q&&voto==='mal')pedirLamina(msgEl,null,q,id,doc);
  };
  bien.onclick=()=>votar(bien,'bien');
  mal.onclick=()=>votar(mal,'mal');
  footer.append(pr,bien,mal);
  msgEl.appendChild(footer);
  return footer
}

function consultasDelPeriodo(){
  const dias={'7':7,'30':30}[tableroPeriodo];
  if(!dias)return tablero;
  const desde=Date.now()-dias*864e5;
  return tablero.filter(r=>r.t>=desde)
}
const fechaCorta=t=>new Date(t).toLocaleDateString('es-MX',{day:'numeric',month:'short'});
function rangoDeFechas(res){
  if(!res.desde)return'';
  const a=fechaCorta(res.desde),b=fechaCorta(res.hasta);
  return a===b?a:`${a} – ${b}`
}
function el(tag,cls,texto){
  const e=document.createElement(tag);
  if(cls)e.className=cls;
  if(texto!=null)e.textContent=texto;
  return e
}
function filaConBarra(etiqueta,detalle,n,max,unidad){
  const f=el('div','tb-fila');
  const et=el('div','tb-et',etiqueta);
  if(detalle)et.appendChild(el('small',null,detalle));
  const c=el('div','tb-cuenta',String(n));
  c.title=`${n} ${n===1?unidad:unidad+'s'}`;
  const barra=el('div','tb-barra');barra.title=c.title;
  const b=el('span');b.style.width=Math.max(4,Math.round(n*100/max))+'%';
  barra.appendChild(b);
  f.append(et,c,barra);
  return f
}
function renderTablero(){
  const cont=document.getElementById('tablero');if(!cont)return;
  const regs=consultasDelPeriodo();
  const res=resumirTablero(regs);
  cont.textContent='';

  const cab=el('div');
  cab.appendChild(el('div','tb-titulo','Lo que pregunta tu equipo'));
  cab.appendChild(el('div','tb-sub',res.total
    ?`${rangoDeFechas(res)} · en este teléfono. Nadie más lo ve hasta que compartes el resumen.`
    :'Cada duda que se hace en Preguntar se anota aquí: qué se pregunta más y qué no trae el manual. Se queda en este teléfono.'));
  cont.appendChild(cab);

  if(tablero.length){
    const per=el('div','tb-periodo');
    for(const [k,txt] of [['7','7 días'],['30','30 días'],['todo','Todo']]){
      const b=el('button','tb-chip'+(tableroPeriodo===k?' activo':''),txt);b.type='button';
      b.onclick=()=>{tableroPeriodo=k;renderTablero()};
      per.appendChild(b);
    }
    cont.appendChild(per);
  }

  if(!res.total){
    const vacio=el('div','tb-vacio');
    vacio.innerHTML=PLIEGUES+(tablero.length
      ?'<b>Nada en este periodo</b><span>Cambia a «Todo» para ver lo que se ha preguntado antes.</span>'
      :'<b>Aquí aparece lo que pregunta tu equipo</b><span>Las dudas que más se repiten y las que el manual no contesta. Se queda en este teléfono.</span>');
    cont.appendChild(vacio);
    const b=el('button','tb-btn primario',tablero.length?'No hay dudas en este periodo':'Ir a preguntar');b.type='button';
    if(tablero.length)b.disabled=true;else b.onclick=()=>switchTab('chat');
    const acc=el('div','tb-acciones');acc.appendChild(b);
    cont.appendChild(acc);
    bloqueAprendido(cont);
    return;
  }

  const tiles=el('div','tb-tiles');
  const tile=(n,l,sub)=>{const t=el('div','tb-tile');t.appendChild(el('div','tb-n',n));const lb=el('div','tb-l',l);if(sub)lb.appendChild(el('small',null,sub));t.appendChild(lb);return t};
  tiles.appendChild(tile(String(res.total),res.total===1?'duda':'dudas'));
  tiles.appendChild(tile(res.pct+' %','resueltas con el manual',`${res.sirvieron} de ${res.total}`));
  tiles.appendChild(tile(String(res.total-res.cubiertas),'no estaban en el manual',res.gaps.length&&res.gaps.length!==res.total-res.cubiertas?`${res.gaps.length} distintas`:null));
  if(res.noSirvieron.length)tiles.appendChild(tile(String(res.noSirvieron.length),'👎 no sirvieron','el manual traía algo, pero no ayudó'));
  cont.appendChild(tiles);

  const bloque=(titulo,sub)=>{const b=el('div','tb-bloque');b.appendChild(el('div','tb-h',titulo));if(sub)b.appendChild(el('div','tb-hsub',sub));return b};

  const bt=bloque('Lo más preguntado','Por la lámina que contestó. Lo que se repite es lo que conviene repasar con el equipo.');
  if(res.temas.length){
    const max=res.temas[0].n;
    for(const t of res.temas.slice(0,6)){
      const pags=[...t.paginas].sort((a,b)=>a-b);
      const det=[res.secciones.length>1?t.sec:null,pags.length?(pags.length===1?'pág. ':'págs. ')+pags.join(', '):null].filter(Boolean).join(' · ');
      bt.appendChild(filaConBarra(t.h,det,t.n,max,'duda'));
    }
  }else bt.appendChild(el('div','tb-vacio-lista','Todavía ninguna duda con lámina.'));
  cont.appendChild(bt);

  const bg=bloque('Lo que el manual no explica','Se preguntó y el manual no lo trae. Es la lista para mandar a quien hace los manuales.');
  if(res.gaps.length){
    for(const g of res.gaps.slice(0,12)){
      const f=el('div','tb-fila');
      const et=el('div','tb-et',g.q);
      et.appendChild(el('small',null,[res.secciones.length>1?g.sec:null,fechaCorta(g.t)].filter(Boolean).join(' · ')));
      f.append(et,el('div','tb-cuenta',g.n>1?'×'+g.n:''));
      bg.appendChild(f);
    }
  }else bg.appendChild(el('div','tb-vacio-lista','Todo lo que se preguntó estaba en el manual.'));
  cont.appendChild(bg);

  if(res.noSirvieron.length){
    const bn=bloque('Respuestas que no sirvieron','El manual traía algo, pero a quien preguntó no le ayudó: puede que la lámina no sea clara.');
    for(const r of res.noSirvieron.slice(-8).reverse()){
      const f=el('div','tb-fila');
      const et=el('div','tb-et',r.q);
      et.appendChild(el('small',null,[r.h?temaLegible(r.h):null,r.p?'pág. '+r.p:null,fechaCorta(r.t)].filter(Boolean).join(' · ')));
      f.append(et,el('div','tb-cuenta',''));
      bn.appendChild(f);
    }
    cont.appendChild(bn);
  }

  if(res.secciones.length>1){
    const bs=bloque('Dudas por sección');
    const max=res.secciones[0].n;
    for(const s of res.secciones)bs.appendChild(filaConBarra(s.sec,null,s.n,max,'duda'));
    cont.appendChild(bs);
  }

  const acc=el('div','tb-acciones');
  const comp=el('button','tb-btn primario','📤 Compartir resumen');comp.type='button';comp.onclick=compartirResumen;
  const imp=el('button','tb-btn','🖨 Imprimir');imp.type='button';imp.onclick=()=>window.print();
  const exa=el('button','tb-btn','⬇ Preguntas para examen');exa.type='button';exa.onclick=()=>exportarPreguntasReales();
  exa.title='Las dudas reales del equipo, en el formato del examen de medición: falta anotar la respuesta correcta de cada una.';
  const bor=el('button','tb-btn borrar','Borrar registro');bor.type='button';bor.onclick=borrarTablero;
  acc.append(comp,exa,imp,bor);
  cont.appendChild(acc);
  bloqueAprendido(cont);
}
function textoResumen(){
  const res=resumirTablero(consultasDelPeriodo());
  if(!res.total)return'';
  const l=[`📊 Asistente de piso: lo que preguntó el equipo (${rangoDeFechas(res)})`];
  if(res.secciones.length===1)l.push(`Sección: ${res.secciones[0].sec}`);
  l.push('',`• ${res.total} ${res.total===1?'duda':'dudas'}; ${res.sirvieron} resueltas con el manual (${res.pct} %).`);
  if(res.temas.length)l.push(`• Lo más preguntado: ${res.temas.slice(0,4).map(t=>`${t.h} (${t.n})`).join(', ')}.`);
  if(res.gaps.length){
    l.push(`• Lo que el manual no explica (${res.gaps.length}):`);
    for(const g of res.gaps.slice(0,8))l.push(`   – ${g.q}${g.n>1?` (×${g.n})`:''}`);
  }else l.push('• Todo lo que se preguntó estaba en el manual.');
  if(res.noSirvieron.length)l.push(`• ${res.noSirvieron.length} ${res.noSirvieron.length===1?'respuesta marcada':'respuestas marcadas'} como que no sirvió.`);
  if(res.secciones.length>1)l.push(`• Por sección: ${res.secciones.map(s=>`${s.sec} (${s.n})`).join(', ')}.`);
  return l.join('\n')
}
async function compartirResumen(){
  const texto=textoResumen();if(!texto)return;
  if(navigator.share){
    try{await navigator.share({title:'Lo que pregunta tu equipo',text:texto});return}
    catch(e){if(e&&e.name==='AbortError')return}
  }
  try{
    await navigator.clipboard.writeText(texto);
    showToast('📋 Resumen copiado. Pégalo en WhatsApp o en un correo.','success',3500);
  }catch{
    showToast('No se pudo copiar el resumen en este navegador.','error',4000);
  }
}
async function exportarPreguntasReales(){
  const preguntas=preguntasRealesParaExamen(consultasDelPeriodo());
  if(!preguntas.length){showToast('Todavía no hay dudas anotadas en este periodo.','warn',3000);return}
  const ex={examen:`Preguntas del piso ${new Date().toISOString().slice(0,10)}`,
    nota:'Preguntas reales del equipo. Falta anotar en cada una el dato esperado (k) y su página (p), o cambiar tipo a «no-esta» si el manual no lo trae. «visto» es lo que la app encontró: pista, no respuesta.',
    preguntas};
  const nombre=`preguntas-del-piso-${new Date().toISOString().slice(0,10)}.json`;
  const blob=new Blob([JSON.stringify(ex,null,1)],{type:'application/json'});
  const archivo=new File([blob],nombre,{type:'application/json'});
  if(navigator.canShare&&navigator.canShare({files:[archivo]})){
    try{await navigator.share({files:[archivo],title:'Preguntas del piso'});return}catch(e){if(e.name==='AbortError')return}
  }
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=nombre;
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function borrarTablero(){
  if(!confirm('¿Borrar todas las dudas anotadas en este teléfono? No se puede deshacer.'))return;
  tablero=[];guardarTablero();renderTablero();
  showToast('🗑️ Registro del tablero borrado','warn',2500);
}

/* ════════════════════════════════════════════════
   APRENDE DEL PISO

   El piso no habla como el manual: dice «burro» donde la lámina dice
   «perchero», o pregunta por «la mesa de la entrada» y la respuesta está en la
   pág. 7. La app aprende esos CAMINOS, nunca respuestas: una palabra del piso
   que lleva a una palabra del manual, y una forma de preguntar que lleva a una
   página. El dato sigue saliendo siempre del manual, con su página.

   Reemplaza a la «memoria de aprendizaje» de 👍/👎, que pegaba al prompt las
   preguntas que salieron mal: no movía nada medible y, peor, se colaba en la
   medición y la ensuciaba.

   Candados, porque lo que se aprende mal empeora lo que ya funcionaba:
   · cada palabra es de UNA sección: «burro» en MUEBLES no es «burro» en ZAPATOS;
   · se activa con dos confirmaciones de consultas distintas: una errata
     aislada, o un toque equivocado, no se aprende;
   · nunca cifras ni nada con dígitos: se aprende cómo se llama algo, no cuánto;
   · la palabra del manual tiene que estar en ESE manual;
   · todo se ve y se borra en el Tablero;
   · midiendo, no se usa ni se escribe nada (salvo que la medición lo pida).
   Vive en este teléfono (localStorage), como el tablero.
════════════════════════════════════════════════ */
const APRENDIDO_KEY='ap_aprendido_v1';
let aprendido={v:1,palabras:[],atajos:[]};
var indiceAprendido=null;
let ultimaConsultaAprende=null;

function cargarAprendido(){
  /* La memoria vieja se va: sus notas del 👎 ya viajan en el tablero. */
  try{localStorage.removeItem('ap_memory_v5');localStorage.removeItem('ap_memory_enabled')}catch{}
  try{aprendido=limpiarAprendido(JSON.parse(localStorage.getItem(APRENDIDO_KEY)||'null'))}
  catch{aprendido=aprendidoVacio()}
  indiceAprendido=null;
}
function guardarAprendido(){
  indiceAprendido=null;
  try{localStorage.setItem(APRENDIDO_KEY,JSON.stringify(aprendido))}catch{}
  const p=document.getElementById('panel-memory');
  if(p&&p.classList.contains('active'))renderTablero();
}
/* Leer lo aprendido y escribirlo son dos puertas distintas: una medición «con
   lo aprendido» lo usa, pero ninguna medición enseña nada. */
function puedeUsarAprendido(){
  if(!appState.aprendeEnabled)return false;
  if(typeof midiendo!=='undefined'&&midiendo)return!!(medicionActual&&medicionActual.conAprendido);
  return true
}
function puedeAprender(){
  return!!appState.aprendeEnabled&&!(typeof midiendo!=='undefined'&&midiendo)
}
function docDeSec(sec){return(docs.find(d=>secDe(d.name)===sec)||{}).name||null}
function construirIndiceAprendido(){
  const pal=new Map();
  for(const p of aprendido.palabras){
    if(!palabraActiva(p))continue;
    for(const v of variantes(p.piso)){
      if(!pal.has(v))pal.set(v,[]);
      pal.get(v).push(p);
    }
  }
  indiceAprendido={pal};
  return indiceAprendido
}
/* Las palabras aprendidas que aplican a `k` en esta consulta. Con sección, las
   de esa sección; sin ella (al elegir sección), las de todas: cada una apunta a
   una palabra que solo existe en su manual, así que empuja a su sección. */
function palabrasAprendidasPara(k,doc){
  if(!puedeUsarAprendido()||!aprendido.palabras.length)return[];
  const idx=indiceAprendido||construirIndiceAprendido();
  const lista=idx.pal.get(k)||[];
  if(!lista.length)return[];
  const sec=doc?secDe(doc):null;
  return sec?lista.filter(p=>p.sec===sec):lista
}
function atajosPara(q,doc){
  if(!puedeUsarAprendido()||!aprendido.atajos.length)return[];
  const sec=doc?secDe(doc):null;
  const t=new Set(terminosDeAtajo(q,doc));
  if(!t.size)return[];
  return aprendido.atajos.filter(a=>(!sec||a.sec===sec)&&jaccardTokens(t,new Set(a.terminos))>=APRENDE_JACCARD)
}
/* La búsqueda vive en src/motor/busqueda.js y no sabe de almacenamiento: se
   le dice aquí cómo consultar lo aprendido. */
usarAprendido({palabras:palabrasAprendidasPara,atajos:atajosPara});
/* Lo aprendido que tocó ESTA consulta, para decirlo en pantalla: si el asesor
   no ve el camino, no puede corregirlo. */
function aprendidoEn(q,doc){
  if(!puedeUsarAprendido())return[];
  const out=[];
  for(const k of palabrasDeConsulta(q))for(const p of palabrasAprendidasPara(k,doc))
    out.push({tipo:'palabra',id:p.id,texto:`«${palabraOriginal(q,k)}» = «${p.manual}»`});
  for(const a of atajosPara(q,doc))out.push({tipo:'atajo',id:a.id,texto:`pág. ${a.pagina}${docs.length>1?' de '+a.sec:''}`});
  return out
}
function lineaDeAprendido(q,doc){
  const usado=aprendidoEn(q,doc);
  if(!usado.length)return null;
  const l=document.createElement('div');l.className='ap-usado';
  const pal=usado.filter(u=>u.tipo==='palabra').map(u=>u.texto),at=usado.filter(u=>u.tipo==='atajo').map(u=>u.texto);
  l.textContent='📚 Usé lo que aprendió el piso: '+[pal.length?pal.join(', '):null,at.length?'buscar primero en '+at.join(', '):null].filter(Boolean).join('; ')+'. Se revisa o se borra en Tablero.';
  return l
}

/* ── Escribir ── */
function aprenderPalabra(doc,piso,manual,origen,idConsulta,{propuesta=false}={}){
  if(!puedeAprender()||!doc)return null;
  if(motivoParaNoAprender(doc,piso,manual))return null;
  const sec=secDe(doc),a=palabraAprendible(piso),b=palabraAprendible(manual);
  let p=aprendido.palabras.find(x=>x.sec===sec&&x.piso===a&&x.manual===b);
  if(p){
    if(propuesta)return p;
    if(p.propuesta){p.propuesta=false;p.conf=0}
    if(idConsulta&&p.consultas.includes(idConsulta))return p;
    p.conf++;if(idConsulta)p.consultas.push(idConsulta);p.t=Date.now();
    if(origen!==p.origen&&p.origen==='ia')p.origen=origen;
  }else{
    p={id:idAprende(),sec,piso:a,manual:b,conf:propuesta?0:1,consultas:idConsulta&&!propuesta?[idConsulta]:[],origen,propuesta,t:Date.now()};
    aprendido.palabras.push(p);
    aprendido.palabras=recortarSeccion(aprendido.palabras,sec,APRENDE_MAX_PALABRAS,palabraActiva);
  }
  p.consultas=p.consultas.slice(-20);
  guardarAprendido();
  return p
}
function aprenderAtajo(doc,q,pagina,idConsulta){
  if(!puedeAprender()||!doc||!(pagina>0))return null;
  const sec=secDe(doc),terminos=terminosDeAtajo(q,doc);
  if(!terminos.length)return null;
  const t=new Set(terminos);
  let a=aprendido.atajos.find(x=>x.sec===sec&&x.pagina===pagina&&jaccardTokens(t,new Set(x.terminos))>=APRENDE_JACCARD);
  if(a){
    if(idConsulta&&a.consultas.includes(idConsulta))return a;
    a.conf++;if(idConsulta)a.consultas.push(idConsulta);a.t=Date.now();a.consultas=a.consultas.slice(-20);
  }else{
    a={id:idAprende(),sec,terminos,ver:palabrasDeAtajo(q,doc).slice(0,8),pagina,conf:1,consultas:idConsulta?[idConsulta]:[],t:Date.now()};
    aprendido.atajos.push(a);
    aprendido.atajos=recortarSeccion(aprendido.atajos,sec,APRENDE_MAX_ATAJOS,x=>x.conf>=2);
  }
  guardarAprendido();
  return a
}
/* Las palabras con que el manual titula una página: a eso se refería el asesor
   cuando tocó esa página. */
function palabrasDeTituloDePagina(doc,pagina,q){
  const propio=new Set(tokenize(secDe(doc)||''));
  /* Una página con dos láminas —SENSORES y ETIQUETADO— tiene dos títulos. Si
     el resto de la pregunta coincide con el texto de una, es esa; si no
     coincide con ninguna, van las dos y decide la siguiente confirmación. */
  const frags=fragmentosDePagina(doc,pagina).filter(c=>c.heading&&c.isFicha!=='indice');
  const resto=new Set((q?palabrasDeConsulta(q):[]).filter(k=>!esVerbo(k)).flatMap(variantes));
  const coincide=c=>{const t=new Set(tokenize(c.heading+' '+c.text));let n=0;for(const k of resto)if(t.has(k))n++;return n};
  const mejor=frags.length?Math.max(...frags.map(coincide)):0;
  const cuenta=new Map();
  for(const c of mejor>0?frags.filter(c=>coincide(c)===mejor):frags){
    for(const k of tokenize(c.heading))if(palabraAprendible(k)&&k.length>=4&&!esVerbo(k)&&!propio.has(k))cuenta.set(k,(cuenta.get(k)||0)+1);
  }
  return[...cuenta].sort((a,b)=>b[1]-a[1]).map(x=>x[0]).slice(0,4)
}
/* El asesor tocó la página que contestaba. Deja el atajo y, si escribió
   palabras que el manual no usa, las empareja como candidatas con el título de
   esa página: con la segunda consulta que las confirme, quedan aprendidas. */
function aprenderDeLamina(doc,q,pagina,idConsulta){
  const atajo=aprenderAtajo(doc,q,pagina,idConsulta);
  const pares=[];
  const raras=palabrasRaras(q,doc).slice(0,2);
  if(raras.length)for(const r of raras)for(const m of palabrasDeTituloDePagina(doc,pagina,q)){
    const p=aprenderPalabra(doc,r,m,'lamina',idConsulta);
    if(p)pares.push(p);
  }
  const reg=tablero.find(x=>x.id===idConsulta);
  if(reg){reg.pl=pagina;reg.dl=secDe(doc);delete reg.hueco;guardarTablero()}
  return{atajo,pares}
}
/* Una pregunta que no llegó, seguida en minutos por otra parecida que sí: lo
   que cambió entre una y otra es cómo se dice en el manual. */
function aprenderDeReformulacion(ant,act){
  if(!ant||!act||ant.ok||!act.ok||!act.doc||ant.doc!==act.doc)return[];
  if(act.t-ant.t>APRENDE_VENTANA_REFORMULA)return[];
  const a=new Set(palabrasDeConsulta(ant.q).filter(k=>!esVerbo(k))),b=new Set(palabrasDeConsulta(act.q).filter(k=>!esVerbo(k)));
  const comunes=[...a].filter(k=>b.has(k));
  const raras=palabrasRaras(ant.q,act.doc).filter(k=>!b.has(k));
  const voc=vocabDeDoc(act.doc);
  const nuevas=[...b].filter(k=>!a.has(k)&&palabraAprendible(k)&&k.length>=4&&variantes(k).some(v=>voc.has(v)));
  /* Si no comparten nada, es otra pregunta, no la misma dicha de otro modo;
     salvo que la primera fuera de una sola palabra rara. */
  if(!raras.length||!nuevas.length||raras.length>2||nuevas.length>3)return[];
  if(!comunes.length&&a.size>1)return[];
  const out=[];
  for(const r of raras)for(const n of nuevas){const p=aprenderPalabra(act.doc,r,n,'reformulacion',act.id);if(p)out.push(p)}
  return out
}
function docDeConsulta(q,chunk){
  if(chunk&&chunk.source==='pdf')return chunk.docName;
  if(rutaActual&&rutaActual.q===q&&rutaActual.doc)return rutaActual.doc;
  return appState.manualActivo||(docs.length===1?docs[0].name:null)
}
/* Lo llama `registrarConsulta`. */
function notarConsultaParaAprender(r,q,chunk){
  if(!puedeAprender()||!r)return;
  const act={id:r.id,q,doc:docDeConsulta(q,chunk),ok:!!r.ok&&!r.dudoso,t:r.t};
  const ant=ultimaConsultaAprende;
  if(ant){
    const regAnt=tablero.find(x=>x.id===ant.id);
    if(regAnt&&regAnt.voto==='mal')ant.ok=false;
    aprenderDeReformulacion(ant,act);
  }
  ultimaConsultaAprende=act;
}

/* ── El 👎 pide la lámina ── */
function paginasCandidatas(q,doc){
  const res=retrieve(consultaDeBusqueda(q),{source:'pdf',limit:80,doc:doc||null});
  const vistas=new Map();
  for(const r of res){
    if(!r.c.page)continue;
    const k=r.c.docName+'|'+r.c.page;
    if(vistas.has(k))continue;
    vistas.set(k,{doc:r.c.docName,page:r.c.page,heading:(r.c.heading||'').replace(/^#+\s*/,'').trim()});
    if(vistas.size>=6)break;
  }
  return[...vistas.values()]
}
function pedirLamina(msgEl,antes,q,idConsulta,doc,{sinDato=false}={}){
  if(!puedeAprender()||!docChunks.length||msgEl.querySelector('.ap-lamina'))return;
  const caja=document.createElement('div');caja.className='ap-lamina';
  const t=document.createElement('div');t.className='ap-lamina-t';
  t.textContent=sinDato?'¿Sí está en el manual? Toca su página y la próxima vez la busco ahí:'
    :'¿En qué página estaba? Tócala y la app aprende el camino:';
  caja.appendChild(t);
  const fila=document.createElement('div');fila.className='ap-lamina-chips';
  const listo=(texto)=>{caja.textContent='';const d=document.createElement('div');d.className='ap-lamina-t';d.textContent=texto;caja.appendChild(d)};
  const elegir=(d,pagina)=>{
    const r=aprenderDeLamina(d,q,pagina,idConsulta);
    listo(r.atajo?`Anotado ✓ La próxima vez que pregunten así, busco primero en la pág. ${pagina}.`
      +(r.pares.length?` Y si «${r.pares[0].piso}» vuelve a llevar ahí, lo aprendo como «${r.pares[0].manual}».`:''):'Anotado ✓');
    const lam=paginaComoLamina(fragmentosDePagina(d,pagina),pagina,docPaginas);
    if(lam)renderEvidencia(caja,[lam],'senalada');
  };
  for(const c of paginasCandidatas(q,doc)){
    const b=document.createElement('button');b.type='button';b.className='ap-chip';
    b.textContent=`pág. ${c.page}`+(c.heading?' · '+(c.heading.length>28?c.heading.slice(0,27)+'…':c.heading):'')+(docs.length>1&&!doc?' · '+secDe(c.doc):'');
    b.onclick=()=>elegir(c.doc,c.page);
    fila.appendChild(b);
  }
  const docPropio=doc||docDeConsulta(q,null);
  if(docPropio){
    const num=document.createElement('input');num.type='number';num.min='1';num.inputMode='numeric';num.placeholder='Otra pág.';num.className='ap-num';num.setAttribute('aria-label','Número de página');
    const ok=document.createElement('button');ok.type='button';ok.className='ap-chip';ok.textContent='Listo';
    ok.onclick=()=>{
      const n=parseInt(num.value,10);
      if(!(n>0)||!paginasDelManual(docPropio,docPaginas).includes(n)){num.classList.add('ap-num-mal');return}
      elegir(docPropio,n);
    };
    fila.append(num,ok);
  }
  const no=document.createElement('button');no.type='button';no.className='ap-chip ap-chip-no';no.textContent='No está en el manual';
  no.onclick=()=>{
    const reg=tablero.find(x=>x.id===idConsulta);
    if(reg){reg.hueco=true;reg.ok=false;guardarTablero()}
    listo('Anotado ✓ Va al Tablero, en «Lo que el manual no explica».');
  };
  fila.appendChild(no);
  caja.appendChild(fila);
  if(antes&&antes.parentNode===msgEl)msgEl.insertBefore(caja,antes);else msgEl.appendChild(caja);
}
/* Un 👍 a una respuesta que dijo su página confirma el camino. */
function confirmarCamino(q,doc,pagina,idConsulta){
  if(doc&&pagina)aprenderAtajo(doc,q,Number(pagina),idConsulta);
}

/* ── «¿Quisiste decir…?» que se confirma ── */
function botonSiEso(pares,doc,idConsulta){
  const utiles=pares.filter(p=>!motivoParaNoAprender(doc,p.dijo,p.como));
  if(!puedeAprender()||!doc||!utiles.length)return null;
  const b=document.createElement('button');b.type='button';b.className='ap-chip ap-si';b.textContent='✓ Sí, eso';
  b.title='Si vuelve a pasar, la app aprende que en esta sección se dice así.';
  b.onclick=()=>{
    for(const p of utiles)aprenderPalabra(doc,p.dijo,p.como,'quisiste',idConsulta);
    b.disabled=true;b.textContent='Anotado ✓';
  };
  return b
}

/* ── La IA propone ── */
function palabrasRarasDelTablero(doc){
  const sec=secDe(doc),cuenta=new Map();
  for(const r of tablero){
    if(r.sec!==sec||(r.ok&&r.voto!=='mal'))continue;
    for(const k of palabrasRaras(r.q,doc))cuenta.set(k,(cuenta.get(k)||0)+1);
  }
  const ya=new Set(aprendido.palabras.filter(p=>p.sec===sec).map(p=>p.piso));
  return[...cuenta].filter(([k])=>!ya.has(k)).sort((a,b)=>b[1]-a[1]).map(x=>x[0]).slice(0,25)
}
function titulosDeSeccion(doc){
  const t=new Set();
  for(const c of docChunks)if(c.docName===doc&&c.heading&&!c.isFicha){const h=c.heading.replace(/^#+\s*/,'').trim();if(h.length>2&&h.length<70)t.add(h)}
  return[...t].slice(0,90)
}
const PROPONER_PROMPT=`Eres parte de una app que ayuda a asesores de piso de una tienda departamental a encontrar lo que dice su manual de exhibición.
Los asesores escriben palabras que el manual no usa. Te paso esas palabras y los títulos del manual de su sección.
Para cada palabra del piso, si UNA palabra que aparece tal cual en los títulos significa lo mismo en una tienda, devuélvela.
Si no hay un equivalente claro, no la incluyas. Nunca inventes palabras del manual ni devuelvas cifras.
Responde SOLO JSON: {"pares":[{"piso":"palabra del piso","manual":"palabra de los títulos"}]}`;
async function proponerConIA(doc,{silencioso=false}={}){
  if(!hayKeyParaIA()||!puedeAprender()||!doc)return 0;
  const raras=palabrasRarasDelTablero(doc);
  if(!raras.length){if(!silencioso)showToast('Todavía no hay palabras del piso sin resolver en esta sección.','info',3500);return 0}
  const provider=appState.provider,key=appState.apiKey,model=modeloDeFicha(provider);
  const pedido=`${PROPONER_PROMPT}\n\nSECCIÓN: ${secDe(doc)}\nPALABRAS DEL PISO: ${raras.join(', ')}\nTÍTULOS DEL MANUAL:\n${titulosDeSeccion(doc).join('\n')}${glosarioDeSeccion(doc,docFichas)?'\n'+glosarioDeSeccion(doc,docFichas):''}`;
  const llamar=async m=>{
    if(provider==='gemini'){
      const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`,{
        method:'POST',headers:PROVIDERS.gemini._headers(key),
        body:JSON.stringify({contents:[{role:'user',parts:[{text:pedido}]}],
          generationConfig:{maxOutputTokens:1200,temperature:0.1,responseMimeType:'application/json',thinkingConfig:razonamientoGemini(m)}})});
      const data=await res.json().catch(()=>({}));
      if(!res.ok)throw errorDeProveedor(res.status,data);
      return{texto:textoDeGemini(data)}
    }
    const res=await fetch('https://api.openai.com/v1/chat/completions',{
      method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`},
      body:JSON.stringify({model:m,max_tokens:1200,temperature:0.1,response_format:{type:'json_object'},messages:[{role:'user',content:pedido}]})});
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw errorDeProveedor(res.status,data);
    return{texto:data.choices?.[0]?.message?.content||''}
  };
  let n=0;
  try{
    /* `conReintentos` devuelve el objeto con el modelo que contestó. */
    const o=jsonDeTexto((await conReintentos(PROVIDERS[provider],model,llamar)).texto);
    const permitidas=new Set(raras);
    for(const p of (o&&Array.isArray(o.pares)?o.pares:[]).slice(0,30)){
      const piso=palabraAprendible(p&&p.piso);
      if(!permitidas.has(piso))continue;
      if(aprenderPalabra(doc,piso,p.manual,'ia',null,{propuesta:true}))n++;
    }
    if(!silencioso)showToast(n?`✨ La IA propuso ${n} ${n===1?'equivalencia':'equivalencias'}: confírmalas en Tablero.`:'La IA no encontró equivalencias claras.','info',4500);
  }catch(e){
    console.warn('proponer',e);
    if(!silencioso)showToast('No se pudieron pedir propuestas: '+(e.message||e),'warn',4500);
  }
  return n
}

/* ── Verlo, borrarlo, sacarlo y cargarlo ── */
function borrarAprendido(tipo,id){
  if(tipo==='palabra')aprendido.palabras=aprendido.palabras.filter(p=>p.id!==id);
  else aprendido.atajos=aprendido.atajos.filter(a=>a.id!==id);
  guardarAprendido();
}
function confirmarAprendido(id){
  const p=aprendido.palabras.find(x=>x.id===id);if(!p)return;
  p.propuesta=false;p.conf=Math.max(p.conf,APRENDE_CONFIRMACIONES);p.t=Date.now();
  if(p.origen!=='ia')p.origen='tablero';
  guardarAprendido();
}
function olvidarTodoAprendido(){
  if(!confirm('¿Olvidar todo lo que aprendió del piso en este teléfono? No se puede deshacer.'))return;
  aprendido=aprendidoVacio();guardarAprendido();
  showToast('🗑️ Se olvidó lo aprendido','warn',2500);
}
/* Sale sin preguntas: solo palabras, páginas y cuántas veces se confirmaron. */
function vocabularioParaExportar(){
  return{vocabulario:'Asistente de piso',version:VERSION_APP,fecha:new Date().toISOString(),
    palabras:aprendido.palabras.map(({sec,piso,manual,conf,origen,propuesta})=>({sec,piso,manual,conf,origen,...(propuesta?{propuesta:true}:{})})),
    atajos:aprendido.atajos.map(({sec,terminos,ver,pagina,conf})=>({sec,terminos,ver,pagina,conf}))}
}
async function exportarVocabulario(){
  if(!aprendido.palabras.length&&!aprendido.atajos.length){showToast('Todavía no hay nada aprendido.','warn',3000);return}
  const nombre=`vocabulario-del-piso-${new Date().toISOString().slice(0,10)}.json`;
  const blob=new Blob([JSON.stringify(vocabularioParaExportar(),null,1)],{type:'application/json'});
  const archivo=new File([blob],nombre,{type:'application/json'});
  if(navigator.canShare&&navigator.canShare({files:[archivo]})){
    try{await navigator.share({files:[archivo],title:'Vocabulario del piso'});return}catch(e){if(e.name==='AbortError')return}
  }
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=nombre;
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
/* Se suma a lo que ya hay: lo que viene de otro teléfono entra con sus
   confirmaciones, pero pasa los mismos candados. */
function importarVocabulario(datos){
  const nuevo=limpiarAprendido(datos);
  let n=0;
  for(const p of nuevo.palabras){
    const doc=docDeSec(p.sec);
    if(doc&&motivoParaNoAprender(doc,p.piso,p.manual))continue;
    const ya=aprendido.palabras.find(x=>x.sec===p.sec&&x.piso===p.piso&&x.manual===p.manual);
    if(ya){ya.conf=Math.max(ya.conf,p.conf);if(!p.propuesta)ya.propuesta=false}
    else{aprendido.palabras.push({...p,id:idAprende(),consultas:[],origen:p.origen==='ia'?'ia':'importada'});n++}
  }
  for(const a of nuevo.atajos){
    const ya=aprendido.atajos.find(x=>x.sec===a.sec&&x.pagina===a.pagina&&jaccardTokens(new Set(x.terminos),new Set(a.terminos))>=APRENDE_JACCARD);
    if(ya)ya.conf=Math.max(ya.conf,a.conf);
    else{aprendido.atajos.push({...a,id:idAprende(),consultas:[]});n++}
  }
  guardarAprendido();
  return n
}
function cargarVocabularioDeArchivo(){
  const inp=document.createElement('input');inp.type='file';inp.accept='application/json,.json';
  inp.onchange=async()=>{
    const f=inp.files&&inp.files[0];if(!f)return;
    try{
      const n=importarVocabulario(JSON.parse(await f.text()));
      showToast(n?`✓ Se cargaron ${n} ${n===1?'camino':'caminos'} aprendidos`:'No había nada nuevo que cargar','success',3000);
    }catch{showToast('Ese archivo no es un vocabulario del piso.','error',3500)}
  };
  inp.click();
}
function bloqueAprendido(cont){
  const b=el('div','tb-bloque ap-bloque');
  b.appendChild(el('div','tb-h','Lo que aprendió del piso'));
  b.appendChild(el('div','tb-hsub',appState.aprendeEnabled
    ?'Cómo pregunta tu equipo: palabras que usa el piso y la palabra del manual a la que se refieren, y páginas que contestan cierta pregunta. Nunca datos. Una palabra se activa con dos confirmaciones.'
    :'Está apagado en Ajustes («Aprender del piso»): no se usa ni se aprende nada.'));
  const activas=aprendido.palabras.filter(palabraActiva),porConfirmar=aprendido.palabras.filter(p=>!p.propuesta&&!palabraActiva(p)),propuestas=aprendido.palabras.filter(p=>p.propuesta);
  const varias=new Set([...aprendido.palabras,...aprendido.atajos].map(x=>x.sec)).size>1;
  const ORIGEN={lamina:'por la lámina que tocaron',reformulacion:'por una pregunta reformulada',quisiste:'por «Sí, eso»',ia:'propuesta por la IA',importada:'cargada de archivo',tablero:'confirmada aquí'};
  const fila=(texto,det,acciones)=>{
    const f=el('div','tb-fila ap-fila');
    const et=el('div','tb-et',texto);et.appendChild(el('small',null,det));
    const acc=el('div','ap-acc');for(const a of acciones)acc.appendChild(a);
    f.append(et,acc);return f
  };
  const boton=(txt,titulo,fn)=>{const x=el('button','ap-mini',txt);x.type='button';x.title=titulo;x.onclick=fn;return x};
  const grupo=(titulo,lista,conConfirmar)=>{
    if(!lista.length)return;
    b.appendChild(el('div','ap-sub',titulo));
    for(const p of lista.slice().sort((x,y)=>y.t-x.t).slice(0,30)){
      const acc=[];
      if(conConfirmar)acc.push(boton('✓','Confirmar: se activa ya',()=>confirmarAprendido(p.id)));
      acc.push(boton('🗑','Borrar',()=>borrarAprendido('palabra',p.id)));
      b.appendChild(fila(`«${p.piso}» → «${p.manual}»`,[varias?p.sec:null,ORIGEN[p.origen]||null,p.propuesta?null:`${p.conf} ${p.conf===1?'confirmación':'confirmaciones'}`].filter(Boolean).join(' · '),acc));
    }
  };
  grupo('Palabras activas',activas,false);
  grupo('Por confirmar',porConfirmar,true);
  grupo('Propuestas de la IA (no se usan hasta que las confirmes)',propuestas,true);
  if(aprendido.atajos.length){
    b.appendChild(el('div','ap-sub','Preguntas que ya saben su página'));
    for(const a of aprendido.atajos.slice().sort((x,y)=>y.t-x.t).slice(0,30))
      b.appendChild(fila((a.ver&&a.ver.length?a.ver:a.terminos).join(' · '),[varias?a.sec:null,`pág. ${a.pagina}`,`${a.conf} ${a.conf===1?'vez':'veces'}`].filter(Boolean).join(' · '),[boton('🗑','Borrar',()=>borrarAprendido('atajo',a.id))]));
  }
  if(!aprendido.palabras.length&&!aprendido.atajos.length)
    b.appendChild(el('div','tb-vacio-lista','Todavía nada. Aprende cuando alguien toca 👎 y dice en qué página estaba, cuando confirma «Sí, eso» o cuando reformula una pregunta que no llegó.'));
  const acc=el('div','tb-acciones ap-acciones');
  const ex=el('button','tb-btn','⬇ Vocabulario del piso');ex.type='button';ex.onclick=exportarVocabulario;
  ex.title='Palabras y páginas aprendidas, sin preguntas: para revisarlas o pasarlas a otro teléfono.';
  const im=el('button','tb-btn','⬆ Cargar vocabulario');im.type='button';im.onclick=cargarVocabularioDeArchivo;
  acc.append(ex,im);
  const docProp=appState.manualActivo||(docs.length===1?docs[0].name:null);
  if(hayKeyParaIA()&&docProp&&appState.aprendeEnabled){
    const ia=el('button','tb-btn','✨ Que la IA proponga');ia.type='button';
    ia.title='La IA mira las palabras del piso que el manual no usa y propone a cuál se refieren. Quedan por confirmar.';
    ia.onclick=async()=>{ia.disabled=true;await proponerConIA(docProp);ia.disabled=false};
    acc.appendChild(ia);
  }
  if(aprendido.palabras.length||aprendido.atajos.length){
    const bor=el('button','tb-btn borrar','Olvidar todo');bor.type='button';bor.onclick=olvidarTodoAprendido;acc.appendChild(bor);
  }
  b.appendChild(acc);
  cont.appendChild(b);
}

/* ════════════════════════════════════════════════
   TABS
════════════════════════════════════════════════ */
/* Vibración con sentido: solo al enviar, al cambiar de pestaña y (en Revisar)
   al dar el veredicto. Nunca de adorno, y nada con menos movimiento pedido. */
function vibrarCorto(){
  try{if(navigator.vibrate&&!matchMedia('(prefers-reduced-motion: reduce)').matches)navigator.vibrate(6)}catch{}
}
const PESTANAS=['chat','revisar','docs','memory','config'];
/* Cada pestaña guarda dónde se quedó: bajar en Manuales y pasar a Ajustes
   abría Ajustes a media página, y al volver la lista empezaba de cero. */
const scrollPorPestana={};
/* El botón atrás de Android (y el gesto) cerraba la app desde cualquier
   pestaña, incluso con una lámina abierta. Ahora atrás cierra el visor y, en
   las pestañas, regresa a Preguntar; desde Preguntar sale, como en cualquier
   app. Entre pestañas se reemplaza la entrada, así la pila nunca crece.
   Ojo: aquí `history` es el arreglo de la conversación; la del navegador es
   window.history. */
let ignorarPop=false;
const estadoNav=()=>window.history.state||{};
function pestanaActiva(){
  const barra=document.querySelector('.tabs');
  return PESTANAS[barra?Number(barra.style.getPropertyValue('--tab-i')||0):0]||'chat';
}
/* El toque en la barra: en la pestaña que ya está abierta, sube al inicio. */
function tocarPestana(name){
  if(name!==pestanaActiva()){switchTab(name);return}
  const quieto=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({top:0,behavior:quieto?'instant':'smooth'});
}
function navegarAPestana(previa,name){
  try{
    if(name==='chat'){
      /* Volver a Preguntar con la barra deshace la entrada que se empujó al salir. */
      if(estadoNav().tab&&estadoNav().tab!=='chat'){ignorarPop=true;window.history.back()}
    }else if(previa==='chat'&&!(estadoNav().tab&&estadoNav().tab!=='chat'))window.history.pushState({tab:name},'');
    else window.history.replaceState({tab:name},'');
  }catch{}
}
window.addEventListener('popstate',e=>{
  if(ignorarPop){ignorarPop=false;return}
  const visor=document.getElementById('visor');
  if(visor&&visor.classList.contains('abierto')){cerrarVisor({desdeHistorial:true});return}
  const tab=(e.state&&e.state.tab)||'chat';
  if(tab!==pestanaActiva())switchTab(tab,{desdeHistorial:true});
});
/* Al recargar con la lámina abierta, el visor ya no está: se quita su entrada. */
try{if(estadoNav().visor){const{visor,...resto}=estadoNav();window.history.replaceState(resto,'')}}catch{}
function switchTab(name,opciones={}){
  const pestanas=PESTANAS;
  const previa=pestanaActiva();
  if(previa!==name){
    scrollPorPestana[previa]=window.scrollY;
    if(!opciones.desdeHistorial)navegarAPestana(previa,name);
  }
  /* El panel nuevo entra del lado de la pestaña tocada: desde la derecha si
     está a la derecha de la anterior (CSS: .panel.active[data-dir]). Se marca
     antes de activarlo para que la animación arranque ya con su dirección. */
  const barra=document.querySelector('.tabs');
  const antes=barra?Number(barra.style.getPropertyValue('--tab-i')||0):0;
  const ahora=Math.max(0,pestanas.indexOf(name));
  const nuevo=document.getElementById('panel-'+name);
  if(nuevo)nuevo.dataset.dir=ahora<antes?'izq':'der';
  pestanas.forEach((t,i)=>{
    document.querySelectorAll('.tab')[i].classList.toggle('active',t===name);
    document.getElementById('panel-'+t).classList.toggle('active',t===name);
  });
  /* La pastilla de la barra se desliza a la pestaña activa (CSS: .tabs::before).
     Un toque corto de vibración confirma el cambio; el navegador lo ignora si
     no hubo un toque de la persona, y no se usa con «reducir movimiento». */
  if(barra)barra.style.setProperty('--tab-i',String(ahora));
  if(previa!==name)window.scrollTo({top:scrollPorPestana[name]||0,behavior:'instant'});
  /* La aurora del fondo (index.html, AURORA) se corre según la pestaña. */
  document.documentElement.style.setProperty('--seccion-i',String(ahora));
  try{
    vibrarCorto();
  }catch{}
  if(name==='memory')renderTablero();
  /* En el celular, enfocar la caja abre el teclado, y el teclado tapa justo la
     respuesta que se acaba de pedir: pasaba en cada envío y en cada acceso
     rápido. El foco automático queda para quien tiene ratón. */
  if(name==='chat'&&window.matchMedia('(pointer:fine)').matches){
    setTimeout(()=>{
      const inp=document.getElementById('user-input');
      if(inp)inp.focus();
    },50);
  }
}
/* La caja crece con lo que se escribe, hasta su tope; con rows=1 fija, una
   pregunta de dos renglones se leía cortada. */
function ajustarAltura(el){
  el.style.height='auto';
  el.style.height=Math.min(el.scrollHeight,110)+'px';
}
function ev(e){e.preventDefault()}
function dropFile(e){e.preventDefault();handleFiles(e.dataTransfer.files)}

/* ════════════════════════════════════════════════
   PROCESAMIENTO DE PDF — v7.0 con timeout + isEvalSupported
════════════════════════════════════════════════ */
const MAX_PDF_SIZE = 50 * 1024 * 1024;  // 50 MB
const PDF_TIMEOUT_MS = 30000;            // 30 s

function withTimeout(promise, ms, label='operación') {
  let t;
  return Promise.race([
    promise,
    new Promise((_, reject) => { t = setTimeout(
      () => reject(new Error(`Timeout: ${label} excedió ${ms/1000}s. El PDF puede estar corrupto, protegido con contraseña o tener un formato no estándar.`)),
      ms
    ); })
  ]).finally(() => clearTimeout(t));
}

/* ════════════════════════════════════════════════
   MOTOR 2 — DETECCIÓN DE FIGURAS

   Los planogramas de estos manuales NO son fotos: son dibujos
   vectoriales. En una lámina de planograma hay ~97 objetos de trazo y
   las únicas imágenes incrustadas son íconos de leyenda de 36×18 px.
   Sacar los bitmaps del PDF —lo que hace casi todo tutorial— devuelve
   la basura y se deja justo lo que el asesor viene a consultar.

   Por eso se hace lo que hacen los parsers serios (Marker, MinerU):
   renderizar la página y recortar la REGIÓN. Y para encontrar la
   región, el principio de PDFFigures 2.0 —geometría, sin modelos—:
   dónde hay tinta que no es texto.
════════════════════════════════════════════════ */
const FIG_SCALE=2;                 // resolución del render del que se recorta
/* La rejilla tiene que ser más fina que el hueco entre dos columnas. A 110
   celdas cada una mide 5.6 pt y el pasillo entre los paneles de una lámina mide
   10: cualquier vecindad los une y la página entera sale como una sola figura. */
const FIG_GRID_COLS=220;           // ancho de la rejilla de análisis, en celdas
const FIG_MIN_DENSITY=0.06;        // un marco vacío deja una caja enorme y sin nada dentro
/* Medido sobre el manual real: las figuras de verdad —fotos, planogramas—
   quedan entre 0.00 y 0.11 de cobertura de texto; los paneles de regla, entre
   0.27 y 0.90. El corte cae en el hueco que hay entre los dos grupos. */
const FIG_MAX_TEXT_COVER=0.25;
const FIG_MIN_SIDE=70;             // lado mínimo en puntos PDF
const FIG_MAX_AREA_RATIO=0.45;     // por encima de esto es el fondo de la diapositiva
const FIG_TEXT_PAD=3;              // margen al borrar la caja de un texto
const FIG_JPEG_QUALITY=0.72;
const FIG_MAX_WIDTH=1000;
const FIG_REPEAT_RATIO=0.1;        // la misma caja en el mismo sitio en varias láminas = plantilla

/* Tope de píxeles del render. Una lámina de gran formato a escala 2 pasaba de
   los ~16.7 M px que iOS permite por canvas: getContext devolvía null, el
   render lanzaba y la página se quedaba sin figuras, sin avisar. Por encima del
   tope se baja la escala, y el recorte usa la escala real (canvas.escala). */
const FIG_MAX_PX=12e6;
async function renderPageCanvas(page,scale){
  const base=page.getViewport({scale:1});
  const tope=Math.sqrt(FIG_MAX_PX/(base.width*base.height));
  if(scale>tope)scale=tope;
  const vp=page.getViewport({scale});
  const canvas=document.createElement('canvas');
  canvas.width=Math.ceil(vp.width);canvas.height=Math.ceil(vp.height);
  canvas.escala=scale;
  const ctx=canvas.getContext('2d');
  if(!ctx){canvas.width=canvas.height=0;throw new Error('sin memoria para el render de la página')}
  ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);
  await page.render({canvasContext:ctx,viewport:vp}).promise;
  return canvas
}

/* Los logos, los planogramas y los rótulos dibujados no están en la capa de
   texto del PDF: para quien lee solo el texto, una lámina de marcas dice
   «Marca Marca Marca». Por eso la página se guarda también como imagen, a un
   tamaño que un modelo lee bien y que cabe en el teléfono (~100 KB). */
const PAG_IMG_ANCHO=1024,PAG_IMG_CALIDAD=0.6;
function imagenDePagina(canvas){
  try{
    const k=Math.min(1,PAG_IMG_ANCHO/canvas.width);
    const c=document.createElement('canvas');
    c.width=Math.max(1,Math.round(canvas.width*k));c.height=Math.max(1,Math.round(canvas.height*k));
    const ctx=c.getContext('2d');
    if(!ctx)return null;
    ctx.drawImage(canvas,0,0,c.width,c.height);
    const url=c.toDataURL('image/jpeg',PAG_IMG_CALIDAD);
    c.width=c.height=0;
    return url
  }catch{return null}
}

/* Rejilla de tinta: qué celdas se apartan del color de fondo. El fondo se
   deduce del color más frecuente y no se asume blanco — estas láminas traen
   fondos de color y con un blanco fijo la página entera contaría como figura. */
function inkGrid(canvas,cols){
  const rows=Math.max(1,Math.round(cols*canvas.height/canvas.width));
  const small=document.createElement('canvas');
  small.width=cols;small.height=rows;
  const sctx=small.getContext('2d',{willReadFrequently:true});
  sctx.drawImage(canvas,0,0,cols,rows);
  const data=sctx.getImageData(0,0,cols,rows).data;
  small.width=small.height=0;
  const cuenta=new Map();
  for(let i=0;i<data.length;i+=4){
    const k=((data[i]>>4)<<8)|((data[i+1]>>4)<<4)|(data[i+2]>>4);
    cuenta.set(k,(cuenta.get(k)||0)+1);
  }
  let fondo=0,max=-1;
  for(const[k,v]of cuenta)if(v>max){max=v;fondo=k}
  const fr=((fondo>>8)&15)*17,fg=((fondo>>4)&15)*17,fb=(fondo&15)*17;
  const grid=new Uint8Array(cols*rows);
  for(let i=0,c=0;i<data.length;i+=4,c++){
    const d=Math.abs(data[i]-fr)+Math.abs(data[i+1]-fg)+Math.abs(data[i+2]-fb);
    grid[c]=d>60?1:0;
  }
  return{grid,cols,rows}
}

function borrarTexto(g,blocks,vpW,vpH){
  const cw=vpW/g.cols,ch=vpH/g.rows;
  for(const b of blocks){
    const x0=Math.max(0,Math.floor((b.x0-FIG_TEXT_PAD)/cw));
    const x1=Math.min(g.cols,Math.ceil((b.x1+FIG_TEXT_PAD)/cw));
    const y0=Math.max(0,Math.floor((b.y0-FIG_TEXT_PAD)/ch));
    const y1=Math.min(g.rows,Math.ceil((b.y1+FIG_TEXT_PAD)/ch));
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)g.grid[y*g.cols+x]=0;
  }
}

function dilatar(g){
  const out=new Uint8Array(g.grid.length);
  for(let y=0;y<g.rows;y++)for(let x=0;x<g.cols;x++){
    if(!g.grid[y*g.cols+x])continue;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      const ny=y+dy,nx=x+dx;
      if(ny>=0&&ny<g.rows&&nx>=0&&nx<g.cols)out[ny*g.cols+nx]=1;
    }
  }
  return{grid:out,cols:g.cols,rows:g.rows}
}

function componentes(g){
  const visto=new Uint8Array(g.grid.length);
  const cajas=[];
  const pila=[];
  for(let i=0;i<g.grid.length;i++){
    if(!g.grid[i]||visto[i])continue;
    let x0=i%g.cols,x1=x0,y0=(i/g.cols)|0,y1=y0,celdas=0;
    pila.push(i);visto[i]=1;
    while(pila.length){
      const p=pila.pop();celdas++;
      const px=p%g.cols,py=(p/g.cols)|0;
      if(px<x0)x0=px;if(px>x1)x1=px;
      if(py<y0)y0=py;if(py>y1)y1=py;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        const nx=px+dx,ny=py+dy;
        if(nx<0||ny<0||nx>=g.cols||ny>=g.rows)continue;
        const n=ny*g.cols+nx;
        if(g.grid[n]&&!visto[n]){visto[n]=1;pila.push(n)}
      }
    }
    cajas.push({x0,y0,x1:x1+1,y1:y1+1,celdas});
  }
  return cajas
}

function fusionarCajas(cajas,margen){
  let lista=cajas.map(c=>({...c}));
  let cambio=true;
  while(cambio){
    cambio=false;
    const out=[];
    for(const c of lista){
      let unido=false;
      for(const o of out){
        if(c.x0<o.x1+margen&&c.x1>o.x0-margen&&c.y0<o.y1+margen&&c.y1>o.y0-margen){
          o.x0=Math.min(o.x0,c.x0);o.y0=Math.min(o.y0,c.y0);
          o.x1=Math.max(o.x1,c.x1);o.y1=Math.max(o.y1,c.y1);
          o.celdas+=c.celdas;
          unido=true;cambio=true;break;
        }
      }
      if(!unido)out.push({...c});
    }
    lista=out;
  }
  return lista
}

function headingForBox(box,titulos){
  let best=null,bestD=Infinity;
  for(const h of titulos){
    const dy=box.y0-h.hy1;
    if(dy<-2||dy>HEADING_MAX_DY)continue;
    const solapa=Math.min(h.hx1,box.x1)-Math.max(h.hx0,box.x0)>0;
    const d=dy+(solapa?0:HEADING_OFFSET_PENALTY);
    if(d<bestD){best=h;bestD=d}
  }
  return best?best.heading:''
}

/* El pie de figura es el texto que la toca por arriba o por dentro. Con eso la
   figura ya se puede recuperar buscando —"planograma", "siluetas"— sin que
   ningún modelo haya mirado el dibujo. */
function captionParaFigura(box,blocks){
  let best=null,bestD=Infinity;
  for(const b of blocks){
    const solapa=Math.min(b.x1,box.x1)-Math.max(b.x0,box.x0);
    if(solapa<=0)continue;
    const dyArriba=box.y0-b.y1;
    const dentro=b.y0>=box.y0-4&&b.y1<=box.y1+4;
    const d=dentro?0:(dyArriba>=-4&&dyArriba<=70?dyArriba+1:Infinity);
    if(d<bestD){best=b;bestD=d}
  }
  return best?best.text.replace(/\s+/g,' ').trim().slice(0,160):''
}

/* Firma visual de 64 bits del recorte (average hash): se reduce a 8×8 en gris y
   cada celda vale 1 si supera la media. Sirve para saber que dos láminas son la
   MISMA imagen aunque estén en páginas distintas. Comparar la posición no basta
   —la plantilla se corre unos puntos de una lámina a otra— y comparar el JPEG
   byte a byte falla por un solo píxel de diferencia. */
function firmaVisual(canvas){
  const s=document.createElement('canvas');s.width=s.height=8;
  const ctx=s.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(canvas,0,0,8,8);
  const d=ctx.getImageData(0,0,8,8).data;
  s.width=s.height=0;
  const gris=[];
  for(let i=0;i<64;i++)gris.push((d[i*4]*3+d[i*4+1]*6+d[i*4+2])/10);
  const media=gris.reduce((a,b)=>a+b,0)/64;
  let hex='';
  for(let i=0;i<64;i+=4){
    let nib=0;
    for(let j=0;j<4;j++)if(gris[i+j]>media)nib|=1<<(3-j);
    hex+=nib.toString(16);
  }
  return hex
}

/* Los manuales guardados antes de que existiera la firma no la traen. Volver a
   procesar 38 páginas por eso sería absurdo: el recorte ya está guardado, así
   que se decodifica y se firma. */
function firmaDesdeDataUrl(dataUrl){
  return new Promise(resolve=>{
    const img=new Image();
    img.onload=()=>{
      const c=document.createElement('canvas');
      c.width=img.naturalWidth;c.height=img.naturalHeight;
      c.getContext('2d').drawImage(img,0,0);
      let f='';try{f=firmaVisual(c)}catch{}
      c.width=c.height=0;
      resolve(f);
    };
    img.onerror=()=>resolve('');
    img.src=dataUrl;
  })
}

/* 0 = misma imagen. Se compara nibble a nibble porque la firma viaja en hex
   para poder guardarse en IndexedDB como texto. Sin firma no se puede afirmar
   que dos recortes sean iguales: se devuelve el máximo, que es "distintos". */
function distanciaVisual(a,b){
  if(!a||!b||a.length!==b.length)return 64;
  let d=0;
  for(let i=0;i<a.length;i++){
    let x=parseInt(a[i],16)^parseInt(b[i],16);
    while(x){d+=x&1;x>>=1}
  }
  return d
}
/* 8×8 es una firma gruesa: dos planogramas distintos de la misma sección pueden
   parecerse. Por eso el corte es estrecho —recortes idénticos dan 0 y el ruido
   del JPEG no pasa de 2—, para no esconder nunca una lámina que sí es otra. */
const FIG_DIST_IGUAL=3;

function recortar(canvas,box,scale){
  const sx=Math.max(0,box.x0*scale),sy=Math.max(0,box.y0*scale);
  const sw=Math.min(canvas.width-sx,(box.x1-box.x0)*scale);
  const sh=Math.min(canvas.height-sy,(box.y1-box.y0)*scale);
  if(sw<4||sh<4)return null;
  const w=Math.min(FIG_MAX_WIDTH,sw),h=sh*(w/sw);
  const out=document.createElement('canvas');
  out.width=Math.round(w);out.height=Math.round(h);
  out.getContext('2d').drawImage(canvas,sx,sy,sw,sh,0,0,out.width,out.height);
  /* Cada canvas que no se suelta sigue contando contra el límite total de
     memoria de canvas del navegador del celular, y con varios manuales se
     llegaba a él. */
  const res={dataUrl:out.toDataURL('image/jpeg',FIG_JPEG_QUALITY),firma:firmaVisual(out)};
  out.width=out.height=0;
  return res
}

/* Un panel de color con texto encima deja, al borrar el texto, un rectángulo
   relleno indistinguible de una foto: misma densidad, mismo tamaño. Lo que sí
   los separa es cuánto de la caja ocupaba el texto — un panel de regla va casi
   lleno; un planograma trae rótulos sueltos y una foto, ninguno. */
function coberturaDeTexto(box,blocks){
  const area=(box.x1-box.x0)*(box.y1-box.y0);
  if(area<=0)return 1;
  let cubierto=0;
  for(const b of blocks){
    const w=Math.min(b.x1,box.x1)-Math.max(b.x0,box.x0);
    const h=Math.min(b.y1,box.y1)-Math.max(b.y0,box.y0);
    if(w>0&&h>0)cubierto+=w*h;
  }
  return Math.min(1,cubierto/area)
}

/* La geometría encuentra dibujos, pero no separa una foto de su panel cuando
   se tocan. Para las fotos hay una vía directa: preguntarle al PDF dónde
   coloca cada imagen. No sustituye a la detección geométrica —los planogramas
   no son imágenes— sino que la completa. El mínimo de tamaño se encarga de los
   íconos de leyenda de 36×18. */
async function rectangulosDeImagen(page,vp){
  const OPS=pdfjsLib.OPS;
  const ops=await page.getOperatorList();
  let ctm=vp.transform.slice();
  const pila=[],rects=[];
  for(let i=0;i<ops.fnArray.length;i++){
    const fn=ops.fnArray[i];
    if(fn===OPS.save)pila.push(ctm.slice());
    else if(fn===OPS.restore)ctm=pila.pop()||ctm;
    else if(fn===OPS.transform)ctm=pdfjsLib.Util.transform(ctm,ops.argsArray[i]);
    else if(fn===OPS.paintImageXObject||fn===OPS.paintJpegXObject||fn===OPS.paintImageMaskXObject){
      const p=[[0,0],[1,0],[0,1],[1,1]].map(q=>pdfjsLib.Util.applyTransform(q,ctm));
      const xs=p.map(q=>q[0]),ys=p.map(q=>q[1]);
      rects.push({x0:Math.min(...xs),y0:Math.min(...ys),x1:Math.max(...xs),y1:Math.max(...ys)});
    }
  }
  return rects
}

function seSolapan(a,b){
  const w=Math.min(a.x1,b.x1)-Math.max(a.x0,b.x0);
  const h=Math.min(a.y1,b.y1)-Math.max(a.y0,b.y0);
  if(w<=0||h<=0)return 0;
  const inter=w*h;
  return inter/Math.min((a.x1-a.x0)*(a.y1-a.y0),(b.x1-b.x0)*(b.y1-b.y0))
}

const FIG_OPLIST_TIMEOUT_MS=8000;
async function detectarFiguras(page,pageInfo,docName){
  const vp=page.getViewport({scale:1});
  /* Antes de renderizar: pedir la lista de operadores DESPUÉS del render deja
     colgada la promesa y se pierden las figuras de toda la página. Con su
     propio límite, además, un PDF raro no bloquea la carga entera. */
  let rectsImagen=[];
  try{
    rectsImagen=await withTimeout(rectangulosDeImagen(page,vp),FIG_OPLIST_TIMEOUT_MS,'Imágenes de la página');
  }catch(e){console.warn('rectangulosDeImagen',e.message)}
  const canvas=await renderPageCanvas(page,FIG_SCALE);
  try{
  /* La página entera, en chico, para que la IA la lea al preparar la ficha y
     la vuelva a mirar cuando una pregunta lo pida (ver_lamina). Sale del mismo
     render que busca figuras: no cuesta un render más. */
  pageInfo.imagen=imagenDePagina(canvas);
  const g=inkGrid(canvas,FIG_GRID_COLS);
  borrarTexto(g,pageInfo.textBoxes||pageInfo.blocks,vp.width,vp.height);
  const cw=vp.width/g.cols,ch=vp.height/g.rows;
  const areaPagina=vp.width*vp.height;
  const titulos=pageInfo.blocks.filter(b=>b.heading&&b.hy1!=null);

  /* Primero agrupar, después filtrar. Al revés, un planograma —que es un dibujo
     de líneas sueltas— se descarta trazo a trazo por poco denso y desaparece
     justo la lámina que más se consulta. Agrupado, el conjunto sí tiene cuerpo. */
  const piezas=componentes(g).filter(c=>c.celdas>=3&&Math.min(c.x1-c.x0,c.y1-c.y0)>2);
  const aPuntos=lista=>lista
    .map(c=>({x0:c.x0*cw,y0:c.y0*ch,x1:c.x1*cw,y1:c.y1*ch,celdas:c.celdas}))
    .filter(c=>(c.x1-c.x0)>=FIG_MIN_SIDE&&(c.y1-c.y0)>=FIG_MIN_SIDE)
    .filter(c=>((c.x1-c.x0)*(c.y1-c.y0))/areaPagina<=FIG_MAX_AREA_RATIO)
    .filter(c=>(c.celdas*cw*ch)/((c.x1-c.x0)*(c.y1-c.y0))>=FIG_MIN_DENSITY);

  /* Dos agrupados, porque no hay un solo margen bueno: uno amplio para que el
     dibujo de líneas quede entero, y otro estrecho para rescatar las fotos que
     viven DENTRO de un panel de regla — el panel se descarta por ser texto, y
     con él se iría la foto que ilustra la regla. */
  const amplias=aPuntos(fusionarCajas(piezas,2)).filter(c=>coberturaDeTexto(c,pageInfo.blocks)<=FIG_MAX_TEXT_COVER);
  const dentroDe=(a,b)=>a.x0>=b.x0-2&&a.y0>=b.y0-2&&a.x1<=b.x1+2&&a.y1<=b.y1+2;
  const finas=aPuntos(fusionarCajas(piezas,1))
    .filter(c=>coberturaDeTexto(c,pageInfo.blocks)<=FIG_MAX_TEXT_COVER/2)
    .filter(c=>!amplias.some(a=>dentroDe(c,a)));
  const geometricas=amplias.concat(finas);

  const imagenes=rectsImagen
    .filter(r=>(r.x1-r.x0)>=FIG_MIN_SIDE&&(r.y1-r.y0)>=FIG_MIN_SIDE)
    .filter(r=>((r.x1-r.x0)*(r.y1-r.y0))/areaPagina<=FIG_MAX_AREA_RATIO)
    .filter(r=>!geometricas.some(c=>seSolapan(r,c)>0.5));

  const cajas=geometricas.concat(imagenes);

  const figuras=[];
  for(const c of cajas){
    const txt=coberturaDeTexto(c,pageInfo.blocks);
    const corte=recortar(canvas,c,canvas.escala);
    if(!corte)continue;
    figuras.push({
      id:docName+'#f'+pageInfo.page+'-'+figuras.length,
      docName,page:pageInfo.page,box:c,dataUrl:corte.dataUrl,firma:corte.firma,txt,
      caption:captionParaFigura(c,pageInfo.blocks),
      /* Sin título en mayúsculas encima, la figura quedaba sin sección y el pie
         decía solo "pág. 11". El nombre de la lámina lo llevan ya los
         fragmentos de esa página: dárselo también a la figura es lo que permite
         reconocer que la imagen y el texto citado son de la misma sección. */
      heading:headingForBox(c,titulos)||pageInfo.titulo||'',
      vlmDescription:null
    });
  }
  return figuras
  }finally{
    canvas.width=canvas.height=0;   // suelta el bitmap grande cuanto antes, también si algo falla
  }
}

/* La banda de encabezado y el logo de esquina salen en TODAS las láminas. Son
   plantilla, no contenido: si se dejan, cada respuesta viene acompañada del
   logo como si fuera evidencia. */
function descartarRepetidas(figuras,totalPaginas){
  const clave=f=>[Math.round(f.box.x0/12),Math.round(f.box.y0/12),Math.round((f.box.x1-f.box.x0)/12),Math.round((f.box.y1-f.box.y0)/12)].join(':');
  const paginasPorClave=new Map();
  for(const f of figuras){
    const k=clave(f);
    if(!paginasPorClave.has(k))paginasPorClave.set(k,new Set());
    paginasPorClave.get(k).add(f.page);
  }
  const limite=Math.max(3,Math.ceil(totalPaginas*FIG_REPEAT_RATIO));

  /* La posición sola se deja engañar: basta con que la plantilla se corra unos
     puntos entre láminas para que cada instancia cuente como caja distinta y
     todas sobrevivan. La firma visual las reconoce estén donde estén, así que
     lo mismo dibujado en muchas páginas se descarta aunque no coincida en
     coordenadas. Los grupos se forman por vecindad con el primero de su clase:
     con recortes idénticos —que es el caso de una plantilla— alcanza. */
  const grupos=[];
  for(const f of figuras){
    if(!f.firma)continue;
    const g=grupos.find(g=>distanciaVisual(g.firma,f.firma)<=FIG_DIST_IGUAL);
    if(g){g.paginas.add(f.page);g.miembros.push(f)}
    else grupos.push({firma:f.firma,paginas:new Set([f.page]),miembros:[f]});
  }
  const plantilla=new Set();
  for(const g of grupos)if(g.paginas.size>=limite)for(const f of g.miembros)plantilla.add(f);

  return figuras.filter(f=>paginasPorClave.get(clave(f)).size<limite&&!plantilla.has(f))
}

function pagesToText(pages){
  return pages.map(pg=>
    `\n[Página ${pg.page}]\n`+pg.blocks.map(b=>(b.heading&&!b.isHeading?'## '+b.heading+'\n':'')+(b.isHeading?'## ':'')+b.text).join('\n\n')
  ).join('\n')
}

async function extractPdf(file,onProgress){
  return new Promise(resolve=>{
    const reader=new FileReader();
    reader.onerror = () => resolve({error:'No se pudo leer el archivo'});
    reader.onload=async e=>{
      /* pdf.js retiene fuentes y listas de operadores de cada documento hasta
         que se le pide soltarlas. Sin destroy, cada manual cargado seguía
         ocupando memoria del celular — también el que venció el tiempo. */
      let tarea=null;
      try{
        const buf=e.target.result;
        tarea=pdfjsLib.getDocument({
            data: new Uint8Array(buf),
            isEvalSupported: false,
            disableAutoFetch: true,
            disableStream: true
          });
        const pdf = await withTimeout(
          tarea.promise,
          PDF_TIMEOUT_MS,
          `Extracción de "${file.name}"`
        );
        const totalPages=pdf.numPages;
        const pages=[];
        let figuras=[];

        for(let i=1;i<=totalPages;i++){
          onProgress&&onProgress(i,totalPages);
          const page = await withTimeout(
            pdf.getPage(i),
            PDF_TIMEOUT_MS,
            `Página ${i} de "${file.name}"`
          );
          const content = await withTimeout(
            page.getTextContent(),
            PDF_TIMEOUT_MS,
            `Texto de la página ${i} de "${file.name}"`
          );
          const info=pageToBlocks(content,page.getViewport({scale:1}),i);
          pages.push(info);
          /* Si el motor visual falla en una página no se cae la carga: el texto
             de esa lámina sigue sirviendo, solo se queda sin figura. */
          try{
            figuras.push(...await withTimeout(
              detectarFiguras(page,info,file.name),
              PDF_TIMEOUT_MS,
              `Figuras de la página ${i} de "${file.name}"`
            ));
          }catch(e){console.warn('detectarFiguras pág.',i,e)}
          try{page.cleanup()}catch{}
        }

        const chars=pages.reduce((n,pg)=>n+pg.blocks.reduce((m,b)=>m+b.text.length,0),0);
        if(chars<50)return resolve({error:'El PDF no tiene capa de texto — parece escaneado o exportado como imagen. Aún no se puede leer sin OCR.'});
        resolve({error:null,pages,figures:descartarRepetidas(figuras,totalPages)})
      }catch(err){
        console.error('extractPdf error:', err);
        const msg = err.message?.includes('Timeout')
          ? err.message
          : 'No se pudo leer el PDF. Verifica que no esté protegido con contraseña o corrupto.';
        resolve({error:msg});
      }finally{
        if(tarea)tarea.destroy().catch(()=>{});
      }
    };
    reader.readAsArrayBuffer(file)
  })
}




/* ════════════════════════════════════════════════
   MANUALES GUARDADOS EN EL DISPOSITIVO

   Abrir, leer, listar y borrar viven en src/almacen/manuales.js. Aquí queda
   qué se guarda de cada manual y cómo se restaura al abrir la app.
════════════════════════════════════════════════ */
/* La lectura del PDF mejora con el tiempo: la 2 une los títulos de tabla de
   dos renglones («TENIS / CASUAL»); la 3 lee las tablas «MUNDO | Marca» con el
   rótulo al costado, fila por fila. Un manual guardado con una lectura anterior
   se restaura tal cual al abrir la app —el PDF no se guarda, no hay de dónde
   releerlo—, pero al volver a elegir el archivo se relee en vez de reusar lo
   guardado. La ficha y las descripciones de láminas, que costaron llamadas,
   pasan a la lectura nueva. */
const LECTURA_VERSION=4;
/* La versión de la app viaja en cada resultado de medición: dos corridas solo
   se comparan sabiendo con qué código salió cada una. Es la misma de sw.js
   (eval/arnes.mjs comprueba que coincidan). */
const VERSION_APP='ap-v1.25.2';
const lecturaVieja=d=>((d&&d.lectura)||1)<LECTURA_VERSION;
function heredarDescripciones(nuevas,viejas){
  let n=0;
  for(const f of nuevas){
    if(f.vlmDescription)continue;
    const v=(viejas||[]).find(o=>o.vlmDescription&&o.page===f.page&&distanciaVisual(o.firma,f.firma)<=FIG_DIST_IGUAL);
    if(v){f.vlmDescription=v.vlmDescription;n++}
  }
  return n
}


/* Los campos del índice invertido (tf, len) no se guardan: se recalculan al
   restaurar. Ocupan más que el texto del que salen y se derivan de él. */
async function guardarManual(hash,doc,chunks,figuras,extra){
  /* isFigure viaja también: sin él, al restaurar, la descripción que hizo la IA
     de una lámina se citaba como si fuera texto del manual.
     Los fragmentos de la ficha NO se guardan como fragmentos: se guarda la
     ficha y de ella se vuelven a sacar al restaurar. Así un fragmento escrito
     por la IA nunca puede volver disfrazado de texto del manual. */
  const limpio=chunks.filter(c=>!c.isFicha).map(c=>({id:c.id,source:c.source,docName:c.docName,page:c.page,heading:c.heading,text:c.text,figureIds:c.figureIds,isFigure:c.isFigure}));
  const x=extra||{paginas:docPaginas.get(doc.name)||[],ficha:docFichas.get(doc.name)||null};
  const registro={hash,doc,chunks:limpio,figuras,paginas:x.paginas||[],ficha:x.ficha||null,guardado:Date.now()};
  try{await txDB('readwrite',st=>st.put(registro))}
  catch(e){
    /* Las imágenes de página son lo más pesado (~100 KB cada una). Si no caben,
       el manual se guarda sin ellas: la ficha ya hecha sigue sirviendo, y solo
       se pierde `ver_lamina` hasta volver a cargar el PDF. */
    if(!registro.paginas.length)throw e;
    await txDB('readwrite',st=>st.put({...registro,paginas:[]}));
  }
}
/* Lo que se guarda junto al manual para el modo IA: la imagen de cada página y
   la ficha que la IA escribió leyéndolas. Se restaura en los dos caminos —al
   abrir la app y al volver a elegir el mismo PDF— con esta misma función. */
function restaurarExtrasDeManual(docName,g){
  if(g&&Array.isArray(g.paginas)&&g.paginas.length)docPaginas.set(docName,g.paginas);
  if(g&&g.ficha&&g.ficha.version===FICHA_VERSION){
    docFichas.set(docName,g.ficha);
    docChunks.push(...chunksDeFicha(docName,g.ficha));
  }
}

/* Un manual indexado antes de que la firma visual existiera se restaura sin
   ella, y sin firma no hay forma de saber que dos láminas son la misma imagen.
   Se calculan aquí, sobre el recorte ya guardado, y se reescribe el registro
   para no repetirlo la próxima vez. Si algo falla, la figura se queda sin firma
   y simplemente no se deduplica: nunca por eso se pierde una lámina. */
async function firmarPendientes(figuras,hash,guardado){
  const faltan=figuras.filter(f=>!f.firma);
  if(!faltan.length)return;
  for(const f of faltan){
    try{f.firma=await firmaDesdeDataUrl(f.dataUrl)}catch{f.firma=''}
  }
  if(hash&&guardado){
    try{await guardarManual(hash,guardado.doc,guardado.chunks,figuras,{paginas:guardado.paginas,ficha:docFichas.get(guardado.doc.name)||guardado.ficha})}catch(e){console.warn('refirmar',e)}
  }
}

/* Los manuales se guardaban en el dispositivo, pero al abrir la app no se
   restauraba ninguno: el asesor tenía que volver a elegir sus PDFs cada vez, y
   solo entonces se reconocía el hash y se ahorraba el procesado. Guardado sin
   restaurar es media función. Ahora se abre la app y sus secciones ya están,
   sin necesidad de tener el archivo a mano. Si hay dos versiones con el mismo
   nombre, manda la más reciente. */
async function restaurarManualesGuardados(){
  let guardados=[];
  try{guardados=await listarManuales()||[]}catch{}
  if(!guardados.length)return;
  guardados.sort((a,b)=>(b.guardado||0)-(a.guardado||0));
  const entraron=[];
  for(const g of guardados){
    if(!g||!g.doc||!g.chunks||!g.chunks.length)continue;
    if(docs.some(d=>d.hash===g.hash||d.name===g.doc.name))continue;
    docChunks.push(...g.chunks.map(indexChunk));
    docFigures.push(...(g.figuras||[]));
    docs.push({...g.doc,hash:g.hash});
    restaurarExtrasDeManual(g.doc.name,g);
    entraron.push(g);
  }
  if(!entraron.length)return;
  rebuildCorpus();
  validarSeccionActiva();
  if(docs.length===1&&!appState.manualActivo){
    appState.manualActivo=docs[0].name;
    try{localStorage.setItem('ap_manual_activo',appState.manualActivo)}catch{}
  }
  renderDocs();
  /* Las firmas visuales que falten se calculan después, sin hacer esperar. */
  for(const g of entraron)firmarPendientes(g.figuras||[],g.hash,g).catch(()=>{});
}

async function borrarManualesGuardados(){
  if(!confirm('¿Borrar de este teléfono todos los manuales guardados?'))return;
  try{
    await txDB('readwrite',st=>st.clear());
    showToast('🗑️ Manuales guardados borrados de este dispositivo. Los que ya están cargados siguen en esta sesión.','warn',4000);
  }catch(e){showToast('No se pudieron borrar los manuales guardados.','error',4000)}
  renderDocs();
}

async function renderAccionesDocs(){
  const wrap=document.getElementById('docs-acciones'),nota=document.getElementById('docs-nota'),btn=document.getElementById('btn-describir');
  if(!wrap)return;

  /* El botón de describir solo aparece si hay algo que describir y con qué:
     ofrecerlo sin key sería prometer algo que no va a pasar. */
  const conKey=appState.apiKey&&appState.apiKey.length>=10;
  const btnFicha=document.getElementById('btn-ficha');
  const sinLeer=docs.filter(d=>paginasSinFicha(d.name).length).length;
  if(btnFicha){
    if(preparandoFicha){btnFicha.style.display='';btnFicha.textContent='■ Detener la lectura con IA'}
    else if(sinLeer&&conKey){
      btnFicha.style.display='';
      btnFicha.textContent=fichaEnPausa()
        ?`📖 Seguir leyendo ${sinLeer} manual${sinLeer>1?'es':''} con IA (hoy van ${peticionesFichaHoy()} peticiones)`
        :`📖 Preparar ${sinLeer} manual${sinLeer>1?'es':''} para el modo IA`;
    }else btnFicha.style.display='none';
  }
  const btnMedir=document.getElementById('btn-medir');
  /* Sin key también: el modo manual se mide sin preguntarle a nadie. */
  if(btnMedir){btnMedir.style.display=docs.length?'':'none';btnMedir.textContent=conKey?'🧪 Medir el modo IA con un examen':'🧪 Medir el modo manual con un examen'}
  const pendientes=docFigures.filter(f=>!f.vlmDescription).length;
  if(btn){
    if(describiendo){btn.style.display='';btn.textContent='■ Detener descripción'}
    else if(pendientes&&appState.apiKey&&appState.apiKey.length>=10){
      btn.style.display='';
      btn.textContent=`👁 Describir ${pendientes} figura${pendientes>1?'s':''} con IA`;
    }else btn.style.display='none';
  }

  let guardados=[];
  try{guardados=await listarManuales()||[]}catch{}
  if(!guardados.length&&!(btn&&btn.style.display==='')&&!(btnFicha&&btnFicha.style.display==='')&&!(btnMedir&&btnMedir.style.display===''))
    {wrap.style.display='none';return}
  const figs=guardados.reduce((n,g)=>n+(g.figuras?g.figuras.length:0),0);
  nota.textContent=guardados.length
    ?`${guardados.length} manual${guardados.length>1?'es':''} guardado${guardados.length>1?'s':''} en este dispositivo (${figs} figuras). No sale a la red; se restaura sin volver a procesarlo.`
    :'';
  wrap.style.display='flex';
}

/* ════════════════════════════════════════════════
   DESCRIPCIÓN DE FIGURAS CON IA — opcional

   Con el caption por proximidad, una figura ya se encuentra: el
   planograma se recupera buscando "planograma". Lo que el caption no
   da es lo que hay DENTRO — los rótulos del plano, cuántas prendas
   hay en la barra, qué dice la medida escrita sobre la foto.

   Eso lo lee un modelo con visión, una sola vez por figura, y se
   guarda como texto indexado. Es opcional y va apagado: sin key la
   app funciona igual, solo sin esta capa.
════════════════════════════════════════════════ */
const VLM_PROMPT=`Estás viendo un recorte de un manual de exhibición de tienda. Describe SOLO lo que se ve, en español, en 2 a 4 frases:
· Transcribe literalmente cualquier rótulo, número, medida o porcentaje visible.
· Si es un plano o diagrama, di qué zonas y muebles aparecen y cómo se distribuyen.
· Si es una foto de producto o maniquí, di qué prendas se ven y cómo están colocadas.
No interpretes reglas ni añadas nada que no esté a la vista. Si algo no se distingue, dilo.`;
const VLM_MAX_TOKENS=300,VLM_PAUSA_MS=400;
let describiendo=false;

async function describirFiguraConIA(fig,provider,key,model,signal){
  if(provider==='gemini'){
    /* Sin apagar el razonamiento, un 3.x gastaba en pensar los 300 tokens y
       devolvía la descripción vacía. */
    const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{
      method:'POST',headers:PROVIDERS.gemini._headers(key),signal,
      body:JSON.stringify({
        contents:[{role:'user',parts:[{text:VLM_PROMPT},{inline_data:{mime_type:'image/jpeg',data:fig.dataUrl.split(',')[1]}}]}],
        generationConfig:{maxOutputTokens:VLM_MAX_TOKENS,temperature:0.1,thinkingConfig:razonamientoGemini(model)}
      })
    });
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw errorDeProveedor(res.status,data);
    return textoDeGemini(data).trim();
  }
  const res=await fetch('https://api.openai.com/v1/chat/completions',{
    method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`},signal,
    body:JSON.stringify({model,max_tokens:VLM_MAX_TOKENS,temperature:0.1,messages:[{role:'user',content:[
      {type:'text',text:VLM_PROMPT},
      {type:'image_url',image_url:{url:fig.dataUrl}}
    ]}]})
  });
  const data=await res.json();
  if(!res.ok)throw errorDeProveedor(res.status,data);
  return(data.choices?.[0]?.message?.content||'').trim();
}

function chunkDeFigura(fig){
  return indexChunk({
    id:fig.id+'-desc',source:'pdf',docName:fig.docName,page:fig.page,
    heading:fig.heading,isFigure:true,figureIds:[fig.id],
    text:(fig.caption?fig.caption+'\n':'')+fig.vlmDescription
  })
}

async function describirFiguras(){
  if(describiendo){describiendo=false;return}
  const provider=appState.provider,key=appState.apiKey;
  if(!key||key.length<10){showToast('Conecta una API key en Ajustes para describir figuras.','warn',4000);return}
  const pendientes=docFigures.filter(f=>!f.vlmDescription);
  if(!pendientes.length){showToast('Todas las figuras ya están descritas.','info',3000);return}

  describiendo=true;
  renderAccionesDocs();
  const procWrap=document.getElementById('proc-wrap'),procMsg=document.getElementById('proc-msg'),procBar=document.getElementById('proc-bar');
  procWrap.style.display='block';
  const model=appState.chatModel;
  let hechas=0,fallos=0;
  for(const fig of pendientes){
    if(!describiendo)break;
    procMsg.textContent=`👁 Describiendo figura ${hechas+1}/${pendientes.length} (pág. ${fig.page})…`;
    procBar.style.width=Math.round((hechas/pendientes.length)*100)+'%';
    try{
      fig.vlmDescription=(await conReintentos(PROVIDERS[provider],model,
        m=>describirFiguraConIA(fig,provider,key,m).then(text=>({text})))).text;
      if(fig.vlmDescription){docChunks.push(chunkDeFigura(fig));hechas++;fallos=0}
    }catch(e){
      console.warn('describirFigura',e);
      fallos++;
      /* Tres fallos seguidos es un problema de cuota o de key, no de una figura
         concreta: seguir sería quemar peticiones para nada. */
      if(fallos>=3){showToast(`Se detuvo tras 3 errores seguidos: ${e.message}`,'error',6000);break}
    }
    await new Promise(r=>setTimeout(r,VLM_PAUSA_MS));
  }
  describiendo=false;
  procWrap.style.display='none';
  rebuildCorpus();
  renderDocs();
  if(hechas)await reguardarManuales();
  showToast(hechas?`👁 ${hechas} figura${hechas>1?'s':''} descrita${hechas>1?'s':''} e indexada${hechas>1?'s':''}.`:'No se describió ninguna figura.',hechas?'success':'warn',4000);
}

/* Vuelve a guardar lo que ya está en el dispositivo para que las descripciones
   —que sí costaron peticiones— no haya que volver a pedirlas mañana. */
async function reguardarManuales(){
  for(const doc of docs){
    if(!doc.hash)continue;
    try{
      await guardarManual(doc.hash,doc,
        docChunks.filter(c=>c.docName===doc.name),
        docFigures.filter(f=>f.docName===doc.name));
    }catch(e){console.warn('reguardarManuales',e)}
  }
}

/* ════════════════════════════════════════════════
   FICHA DEL MANUAL — la IA lee cada lámina una vez

   Al cargar un manual con key, la IA lee cada página —el texto que sacó
   pdf.js y la imagen— y escribe su ficha: de qué trata, qué marcas y mundos
   nombra, lo que se lee en la imagen y no está en el texto (logos, rótulos de
   planogramas) y cómo lo preguntaría el piso. Una vez por manual, guardada en
   el teléfono: unos centavos de dólar con Flash-Lite.

   La ficha sirve para UBICAR, no para contestar. Con ella el agente sabe qué
   página leer, y la búsqueda local encuentra «contemporáneo» aunque la lámina
   diga «Contempo». Lo único de la ficha que puede sostener un dato es lo que la
   IA copió literal de la imagen (`texto_visual`), y viaja rotulado como tal.
════════════════════════════════════════════════ */
let docPaginas=new Map();   // manual → [{page,titulo,imagen}]
let docFichas=new Map();    // manual → {version,modelo,fecha,paginas:{n:ficha}}
const FICHA_VERSION=1;
const FICHA_MAX_TOKENS=1400,FICHA_PAUSA_MS=300,FICHA_TEXTO_MAX=6000;
/* Una petición por página se acababa la cuota gratis con un solo manual (~26
   páginas) y ya no quedaba para preguntar. Ahora va por tandas, y la lectura
   automática tiene un tope por día: lo demás de la cuota es para preguntar. */
const FICHA_TANDA=6;                 // páginas por petición
const FICHA_TOPE_DIA=12;             // peticiones de lectura al día, si Ajustes no dice otra cosa (~72 páginas)
let preparandoFicha=false;
const FICHA_PROMPT=`Eres el lector de un manual de exhibición de una tienda departamental. Te doy una o varias páginas, cada una marcada con «PÁGINA n»: su texto extraído y, después, su imagen. Devuelve SOLO un objeto JSON, sin nada antes ni después, con esta forma exacta:
{"paginas":[{"pagina":1,"titulo":"","resumen":"","temas":[],"marcas":[],"mundos":[],"muebles":[],"productos":[],"texto_visual":"","alias":[],"preguntas":[]}]}
Una entrada por página, con su número y en el mismo orden. Cada página se describe sola: no pases a una lo que está en otra.

- titulo: el nombre de la lámina tal como lo escribe el manual.
- resumen: una frase con lo que la página ordena o explica.
- temas: de 2 a 6 temas de la página, en palabras del piso (ej. "alineación de mesas", "sensores").
- marcas, mundos, muebles, productos: los nombres tal como aparecen escritos, en el texto o en la imagen. Lista vacía si no hay.
- texto_visual: transcribe LITERAL todo lo que se lee en la imagen y NO viene en el texto extraído: logos y nombres de marca, rótulos y cotas de planogramas y diagramas, títulos dentro de imágenes, cifras escritas sobre fotos. Si la imagen agrupa cosas, conserva el grupo (ej. "CONTEMPO: Marca1, Marca2 · CLÁSICO: Marca3"). Cadena vacía si la imagen no agrega texto.
- alias: abreviaturas y otras formas de nombrar lo mismo, cada una como "forma del manual = otra forma" (ej. "Contempo = contemporáneo", "POS = punto de venta").
- preguntas: de 3 a 5 preguntas cortas que un asesor de piso haría y que esta página contesta, como las diría en el piso.

No interpretes reglas que no estén, no inventes marcas ni cifras y no completes con lo que sepas de la tienda o de las marcas por fuera.`;

function hayKeyParaIA(){return!!(appState.apiKey&&appState.apiKey.length>=10&&navigator.onLine)}
/* El día de la cuota de Google termina a medianoche del Pacífico. */
function diaDeCuota(){return new Date().toLocaleDateString('en-CA',{timeZone:'America/Los_Angeles'})}
function peticionesFichaHoy(){
  try{const o=JSON.parse(localStorage.getItem('ap_ficha_dia')||'{}');return o.dia===diaDeCuota()?Number(o.n)||0:0}catch{return 0}
}
function contarPeticionFicha(){
  try{localStorage.setItem('ap_ficha_dia',JSON.stringify({dia:diaDeCuota(),n:peticionesFichaHoy()+1}))}catch{}
}
function topeFichaDia(){
  try{const v=parseInt(localStorage.getItem('ap_ficha_tope')||'',10);if(v>0)return v}catch{}
  return FICHA_TOPE_DIA
}
function fichaEnPausa(){return peticionesFichaHoy()>=topeFichaDia()}
/* La ficha la escribe siempre el modelo ligero: es leer y copiar, no razonar,
   y son decenas de páginas. */
function modeloDeFicha(provider){return provider==='gemini'?GEMINI_RESPALDO:'gpt-4o-mini'}
function textoDePaginaParaFicha(docName,page){
  return docChunks.filter(c=>c.docName===docName&&c.page===page&&!c.isFicha&&!c.isFigure)
    .map(c=>(c.heading?`[${c.heading}] `:'')+c.text).join('\n').slice(0,FICHA_TEXTO_MAX)
}
/* Lo que viene del modelo se trata como dato ajeno: solo los campos
   conocidos, solo texto, con tope de largo. Una ficha rara no puede meter
   nada más en el índice ni en el prompt. */
function limpiarFichaPagina(o){
  if(!o||typeof o!=='object'||Array.isArray(o))return null;
  const txt=(v,max)=>typeof v==='string'?v.replace(/\s+/g,' ').trim().slice(0,max):'';
  const lista=(v,n,max)=>Array.isArray(v)?[...new Set(v.filter(x=>typeof x==='string').map(x=>txt(x,max)).filter(Boolean))].slice(0,n):[];
  const visual=typeof o.texto_visual==='string'?o.texto_visual.replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim().slice(0,1500):'';
  return{titulo:txt(o.titulo,80),resumen:txt(o.resumen,300),temas:lista(o.temas,8,60),
    marcas:lista(o.marcas,30,50),mundos:lista(o.mundos,10,40),muebles:lista(o.muebles,12,50),
    productos:lista(o.productos,15,50),texto_visual:visual,alias:lista(o.alias,12,80),preguntas:lista(o.preguntas,5,140)}
}
/* De la respuesta, solo las páginas que se pidieron, cada una limpia. Si el
   modelo no puso números pero mandó una entrada por página, vale el orden; una
   sola página puede venir como objeto suelto. */
function fichasDeRespuesta(o,paginas){
  const out=new Map();
  if(!o||typeof o!=='object')return out;
  const lista=Array.isArray(o)?o:Array.isArray(o.paginas)?o.paginas:paginas.length===1?[o]:[];
  const porOrden=lista.length===paginas.length&&!lista.some(x=>x&&Number(x.pagina));
  lista.forEach((x,i)=>{
    const n=porOrden?paginas[i]:Number(x&&x.pagina)||(paginas.length===1?paginas[0]:NaN);
    if(!paginas.includes(n)||out.has(n))return;
    const f=limpiarFichaPagina(x);
    if(f)out.set(n,f);
  });
  return out
}
async function leerPaginasConIA({docName,paginas,imagenes,provider,key,model,signal}){
  const bloques=paginas.map(n=>({texto:`PÁGINA ${n}. TEXTO EXTRAÍDO:\n${textoDePaginaParaFicha(docName,n)||'(la página no tiene capa de texto)'}`,imagen:imagenes.get(n)||null}));
  const maxTokens=FICHA_MAX_TOKENS*paginas.length;
  let crudo='',tokens=0;
  if(provider==='gemini'){
    const parts=[{text:FICHA_PROMPT}];
    for(const b of bloques){parts.push({text:b.texto});if(b.imagen)parts.push({inline_data:{mime_type:'image/jpeg',data:b.imagen.split(',')[1]}})}
    const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{
      method:'POST',headers:PROVIDERS.gemini._headers(key),signal,
      body:JSON.stringify({contents:[{role:'user',parts}],
        generationConfig:{maxOutputTokens:maxTokens,temperature:0.1,responseMimeType:'application/json',thinkingConfig:razonamientoGemini(model)}})
    });
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw errorDeProveedor(res.status,data);
    crudo=textoDeGemini(data);tokens=data.usageMetadata?.totalTokenCount||0;
  }else{
    const content=[{type:'text',text:FICHA_PROMPT}];
    for(const b of bloques){content.push({type:'text',text:b.texto});if(b.imagen)content.push({type:'image_url',image_url:{url:b.imagen}})}
    const res=await fetch('https://api.openai.com/v1/chat/completions',{
      method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`},signal,
      body:JSON.stringify({model,max_tokens:maxTokens,temperature:0.1,response_format:{type:'json_object'},messages:[{role:'user',content}]})
    });
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw errorDeProveedor(res.status,data);
    crudo=data.choices?.[0]?.message?.content||'';tokens=data.usage?.total_tokens||0;
  }
  const fichas=fichasDeRespuesta(jsonDeTexto(crudo),paginas);
  if(!fichas.size)throw Object.assign(new Error('La ficha no vino en JSON'),{clase:'sin-json'});
  return{fichas,tokens}
}
/* Dos clases de fragmento por página, y la diferencia es de fondo:
   · «indice»: título, resumen, temas, marcas, alias y preguntas. Lo escribió
     la IA, así que solo sirve para ENCONTRAR la página: `retrieve` lo cambia
     por los fragmentos reales de esa página y nunca llega a leerse como manual.
   · «visual»: lo que la IA copió literal de la imagen. Es lo único que el texto
     del PDF no tiene, y entra rotulado como transcripción de la imagen. */
function chunksDeFicha(docName,ficha){
  const out=[];
  for(const[k,f]of Object.entries((ficha&&ficha.paginas)||{})){
    const page=Number(k);
    if(!page||!f)continue;
    if(f.texto_visual)out.push(indexChunk({id:`${docName}#ficha-v${page}`,source:'pdf',docName,page,
      heading:f.titulo||'',text:f.texto_visual,figureIds:[],isFicha:'visual'}));
    const indice=[f.titulo,f.resumen,(f.temas||[]).join(', '),(f.marcas||[]).join(', '),(f.mundos||[]).join(', '),
      (f.muebles||[]).join(', '),(f.productos||[]).join(', '),(f.alias||[]).join(' · '),(f.preguntas||[]).join(' ')]
      .filter(Boolean).join('\n');
    if(indice)out.push(indexChunk({id:`${docName}#ficha-i${page}`,source:'pdf',docName,page,
      heading:f.titulo||'',text:indice,figureIds:[],isFicha:'indice'}));
  }
  return out
}
function fichaCompleta(docName){
  const f=docFichas.get(docName);
  if(!f)return false;
  return paginasDelManual(docName,docPaginas).every(n=>f.paginas[n])
}
function paginasSinFicha(docName){
  const f=docFichas.get(docName);
  return paginasDelManual(docName,docPaginas).filter(n=>!(f&&f.paginas[n]))
}
async function prepararFicha(docName,{silencioso=false,sinTope=false}={}){
  const provider=appState.provider,key=appState.apiKey;
  if(!key||key.length<10)return{hechas:0,fallos:0,total:0,error:'sin key'};
  const ficha=docFichas.get(docName)||{version:FICHA_VERSION,modelo:'',fecha:0,paginas:{}};
  const imagenes=new Map((docPaginas.get(docName)||[]).map(p=>[p.page,p.imagen]));
  const pendientes=paginasSinFicha(docName);
  if(!pendientes.length)return{hechas:0,fallos:0,total:0};
  const model=modeloDeFicha(provider);
  const procWrap=document.getElementById('proc-wrap'),procMsg=document.getElementById('proc-msg'),procBar=document.getElementById('proc-bar');
  procWrap.style.display='block';
  let hechas=0,fallos=0,seguidos=0,tokens=0,peticiones=0,cortada=null;
  const seccion=nombreDeSeccion(docName);
  /* La cola son tandas de FICHA_TANDA páginas. Una tanda que no vuelve en JSON
     se lee página por página, y si pasa dos veces, todo lo que falta también:
     partirla en mitades costaba más peticiones que leer de una en una. Una
     página que el modelo se saltó vuelve una vez más, al final, y si se la
     vuelve a saltar cuenta como fallo. */
  const cola=[];
  for(let i=0;i<pendientes.length;i+=FICHA_TANDA)cola.push(pendientes.slice(i,i+FICHA_TANDA));
  const otraVez=new Set();
  let tandasRotas=0;
  /* Llamada suelta (el arnés del modo IA) o dentro de la tanda: el interruptor
     de «detener» es el mismo. */
  const propio=!preparandoFicha;
  if(propio)preparandoFicha=true;
  try{
    while(cola.length){
      if(!preparandoFicha)break;
      if(!sinTope&&fichaEnPausa()){
        cortada='tope';
        if(!silencioso)showToast(`Pausé la lectura de ${seccion} para dejarte cuota para preguntar (${peticionesFichaHoy()} peticiones hoy). Sigue mañana, o toca «Seguir leyendo» en Manuales.`,'info',8000);
        break;
      }
      const tanda=cola.shift();
      procMsg.textContent=`📖 La IA está leyendo ${seccion} · pág. ${tanda[0]}${tanda.length>1?'–'+tanda[tanda.length-1]:''} (${hechas+fallos}/${pendientes.length})`;
      procBar.style.width=Math.round(((hechas+fallos)/pendientes.length)*100)+'%';
      try{
        contarPeticionFicha();peticiones++;
        const r=await conReintentos(PROVIDERS[provider],model,
          m=>leerPaginasConIA({docName,paginas:tanda,imagenes,provider,key,model:m}));
        for(const[n,f]of r.fichas){ficha.paginas[n]=f;hechas++}
        tokens+=r.tokens||0;seguidos=0;
        const faltan=tanda.filter(n=>!r.fichas.has(n));
        const vuelven=faltan.filter(n=>!otraVez.has(n));
        vuelven.forEach(n=>otraVez.add(n));
        fallos+=faltan.length-vuelven.length;
        if(vuelven.length)cola.push(vuelven);
      }catch(e){
        console.warn('ficha págs.',tanda,e);
        /* El límite por minuto ya lo esperó conReintentos. Lo que llega aquí
           de cuota del día o de key no se arregla con la tanda siguiente. */
        if(e.clase==='cuota-dia'||e.clase==='key'){
          cortada=e.clase;
          if(!silencioso)showToast(e.clase==='key'?'La key no sirve: la lectura con IA se detuvo.':`Se acabó la cuota de hoy: ${seccion} quedó con ${Object.keys(ficha.paginas).length} de ${paginasDelManual(docName,docPaginas).length} páginas leídas. Mañana sigue donde se quedó.`,'warn',7000);
          break;
        }
        if(e.clase==='sin-json'&&tanda.length>1){
          if(++tandasRotas>=2){const resto=cola.flat();cola.length=0;cola.push(...resto.map(n=>[n]))}
          cola.unshift(...tanda.map(n=>[n]));
        }else{
          fallos+=tanda.length;seguidos++;
          /* Tres seguidas es cuota o key, no una página rara. */
          if(seguidos>=3){if(!silencioso)showToast(`La lectura de ${seccion} se detuvo tras 3 errores seguidos: ${e.message}`,'error',6000);break}
        }
      }
      await sleep(FICHA_PAUSA_MS);
    }
  }finally{
    procWrap.style.display='none';
    if(propio)preparandoFicha=false;
  }
  if(hechas){
    ficha.version=FICHA_VERSION;ficha.modelo=model;ficha.fecha=Date.now();
    docFichas.set(docName,ficha);
    docChunks=docChunks.filter(c=>!(c.isFicha&&c.docName===docName));
    docChunks.push(...chunksDeFicha(docName,ficha));
    rebuildCorpus();
    const doc=docs.find(d=>d.name===docName);
    if(doc&&doc.hash)guardarManual(doc.hash,doc,docChunks.filter(c=>c.docName===docName),docFigures.filter(f=>f.docName===docName))
      .catch(e=>console.warn('guardar ficha',e));
    /* Con el manual recién leído, la IA mira las palabras del piso que siguen
       sin resolver en esta sección y propone equivalencias: quedan por
       confirmar, nunca se usan solas. Una llamada, y solo si hay qué mirar. */
    if(!cortada&&!silencioso&&palabrasRarasDelTablero(docName).length>=3)proponerConIA(docName,{silencioso:true}).catch(()=>{});
  }
  return{hechas,fallos,total:pendientes.length,tokens,peticiones,cortada}
}
/* `solo`: la sección que se va a preguntar. Sin `solo`, todos los manuales
   (el botón de Manuales). `sinTope`: la persona pidió seguir leyendo. */
async function prepararFichasPendientes({solo=null,sinTope=false}={}){
  if(preparandoFicha||!hayKeyParaIA())return;
  const pendientes=docs.filter(d=>(!solo||d.name===solo)&&paginasSinFicha(d.name).length);
  if(!pendientes.length)return;
  preparandoFicha=true;renderAccionesDocs();
  let hechas=0;
  try{
    /* La sección activa primero: es la que el asesor va a preguntar. */
    pendientes.sort((a,b)=>(b.name===appState.manualActivo)-(a.name===appState.manualActivo));
    for(const d of pendientes){
      if(!preparandoFicha)break;
      const r=await prepararFicha(d.name,{sinTope});
      hechas+=r.hechas;
      if(r.cortada)break;          // tope, cuota o key: el manual siguiente no cambia nada
    }
  }finally{
    preparandoFicha=false;
    renderDocs();
  }
  if(hechas)showToast(`📖 La IA ya leyó ${hechas} lámina${hechas>1?'s':''}: ahora encuentra logos, abreviaturas y la forma de preguntar del piso.`,'success',4500);
}
/* En la lista de manuales: si la IA ya lo leyó, cuántas láminas. */
function estadoDeFicha(docName){
  const f=docFichas.get(docName);
  if(!f)return'';
  const total=paginasDelManual(docName,docPaginas).length,leidas=Object.keys(f.paginas||{}).length;
  return leidas>=total?' · 📖 leído por IA':` · 📖 IA ${leidas}/${total}`
}
function botonFicha(){
  if(preparandoFicha){preparandoFicha=false;renderAccionesDocs();return}
  try{appState.apiKey=sessionStorage.getItem('ap_api_key_'+appState.provider)||''}catch{}
  if(!hayKeyParaIA()){showToast('Conecta una API key en Ajustes para que la IA lea tus manuales.','warn',4000);return}
  prepararFichasPendientes({sinTope:fichaEnPausa()}).catch(e=>console.warn('ficha',e));
}

/* El mismo manual con otro archivo: «Manual Nuestra casa.pdf» y «Manual
   Nuestra casa-1.pdf», o la versión «(3)» de Sacos y Pantalones. El hash no los
   une —el PDF se volvió a exportar—, pero el texto es el mismo, y cargados los
   dos salían dos secciones con el mismo nombre en el selector y cada respuesta
   repetida en dos tarjetas. Se compara el texto de los fragmentos. */
const MISMO_CONTENIDO=0.9;
function firmaDeContenido(chunks){
  return new Set(chunks.map(c=>normalizeText(c.text||'').replace(/\s+/g,' ').trim().slice(0,160)).filter(t=>t.length>20))
}
function manualConMismoContenido(chunks){
  const nueva=firmaDeContenido(chunks);
  if(nueva.size<5)return null;
  for(const d of docs){
    const vieja=firmaDeContenido(docChunks.filter(c=>c.docName===d.name));
    let comunes=0;for(const t of nueva)if(vieja.has(t))comunes++;
    if(comunes/Math.max(nueva.size,vieja.size)>=MISMO_CONTENIDO)return d
  }
  return null
}
async function handleFiles(fileList){
  if(!fileList||!fileList.length)return;

  // v7.0: validación previa con mensajes específicos
  const accepted = [];
  const rejected = [];
  for (const file of Array.from(fileList)) {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      rejected.push({name: file.name, reason: 'no_pdf'});
      continue;
    }
    if (file.size > MAX_PDF_SIZE) {
      rejected.push({name: file.name, reason: 'too_large', size: file.size});
      continue;
    }
    if (docs.find(d => d.name === file.name) || accepted.find(f => f.name === file.name)) {
      rejected.push({name: file.name, reason: 'duplicate'});
      continue;
    }
    accepted.push(file);
  }

  if (rejected.length) {
    const msgs = rejected.map(r => {
      if (r.reason === 'too_large') {
        const sizeMb = (r.size / 1024 / 1024).toFixed(1);
        return `❌ "${r.name}" (${sizeMb} MB) supera el límite de 50 MB. Comprime el PDF o divide en partes.`;
      }
      if (r.reason === 'duplicate') return `⚠ "${r.name}" ya está cargado.`;
      if (r.reason === 'no_pdf') return `⚠ "${r.name}" no es un PDF.`;
      return `⚠ "${r.name}" rechazado.`;
    });
    showToast(msgs.join('\n'), 'error', 6000);
  }

  if (!accepted.length) return;

  const procWrap=document.getElementById('proc-wrap');
  const procMsg=document.getElementById('proc-msg');
  const procBar=document.getElementById('proc-bar');
  procWrap.style.display='block';
  const habia=docs.length;
  /* La sección activa ANTES de cargar, si era real. Si era un fantasma que la
     carga acaba de corregir, avisar de que «sigue siendo» la de antes decía
     que la sección activa seguía siendo el manual recién cargado. */
  const activoPrevio=docs.some(d=>d.name===appState.manualActivo)?appState.manualActivo:null;

  for(const file of accepted){
    procBar.style.width='0%';

    let hash=null;
    try{
      procMsg.textContent='⏳ Comprobando si este manual ya está indexado…';
      hash=await hashArchivo(file);
    }catch(e){console.warn('hashArchivo',e)}
    /* El nombre no identifica un manual: la misma descarga llega como
       «X (1).pdf», y al restaurarse entraba con el nombre guardado —«X.pdf»—
       como un segundo documento idéntico. Fragmentos duplicados, y quitar uno
       borraba los del otro. Lo que identifica al archivo es su contenido. */
    const yaCargado=hash&&docs.find(d=>d.hash===hash);
    if(yaCargado){
      showToast(`⚠ "${file.name}" es el mismo archivo que "${yaCargado.name}", que ya está cargado.`,'warn',4500);
      continue;
    }
    const guardado=hash?await leerManual(hash):null;
    if(guardado&&guardado.chunks&&guardado.chunks.length&&!lecturaVieja(guardado.doc)){
      docChunks.push(...guardado.chunks.map(indexChunk));
      restaurarExtrasDeManual(guardado.doc.name,guardado);
      const restauradas=guardado.figuras||[];
      await firmarPendientes(restauradas,hash,guardado);
      docFigures.push(...restauradas);
      docs.push({...guardado.doc,hash});
      rebuildCorpus();
      showToast(`✓ "${file.name}" restaurado de este dispositivo — no hizo falta reprocesarlo`,'success',3500);
      continue;
    }

    const result=await extractPdf(file,(page,total)=>{
      procBar.style.width=Math.round((page/total)*100)+'%';
      procMsg.textContent=`⏳ Página ${page}/${total} — reconstruyendo texto y figuras…`;
    });

    // Si la extracción marcó error, no agregar el doc
    if (result.error) {
      showToast(`❌ "${file.name}": ${result.error}`, 'error', 6000);
      continue;
    }

    const chunks=buildChunks(result.pages,file.name);
    const gemelo=manualConMismoContenido(chunks);
    if(gemelo){
      showToast(`⚠ "${file.name}" trae el mismo contenido que "${gemelo.name}", que ya está cargado. No lo agregué para no repetir cada respuesta. Si es una versión más nueva, quita el otro y vuelve a cargar este.`,'warn',7000);
      continue;
    }
    const figuras=result.figures||[];
    const doc={name:file.name,hash,size:(file.size/1024).toFixed(0)+' KB',chunkCount:chunks.length,pageCount:result.pages.length,figureCount:figuras.length,lectura:LECTURA_VERSION};
    const paginas=result.pages.filter(p=>p.imagen).map(p=>({page:p.page,titulo:p.titulo||'',imagen:p.imagen}));
    /* Releído porque lo guardado era de una lectura anterior: lo que ya pagó
       una llamada —descripciones de láminas y ficha— se conserva. */
    const releido=!!(guardado&&guardado.chunks&&guardado.chunks.length);
    if(releido)heredarDescripciones(figuras,guardado.figuras);
    docChunks.push(...chunks);
    for(const f of figuras)if(f.vlmDescription)docChunks.push(chunkDeFigura(f));
    docFigures.push(...figuras);
    docs.push(doc);
    if(paginas.length)docPaginas.set(file.name,paginas);
    if(releido)restaurarExtrasDeManual(file.name,{paginas:[],ficha:guardado.ficha});
    rebuildCorpus();
    showToast(releido
      ?`✓ "${file.name}" releído con la lectura nueva de tablas y títulos`
      :`✓ "${file.name}" procesado — ${result.pages.length} páginas, ${chunks.length} fragmentos, ${figuras.length} figuras`, 'success', 3000);
    /* Un manual con texto dirigido a un modelo («ignora tus instrucciones…»)
       se carga igual —puede ser un accidente—, pero se dice dónde está. Ese
       texto nunca llega al modelo como está: ver INSTRUCCIONES ESCONDIDAS. */
    const sospechosas=instruccionesEnManual(chunks);
    if(sospechosas.length)showToast(`⚠ "${file.name}" trae texto con forma de instrucción para una IA (pág. ${[...new Set(sospechosas.map(x=>x.page))].slice(0,5).join(', ')}). Se trata como dato: el modelo no lo obedece.`,'warn',9000);
    /* Guardar no debe poder tumbar la carga: si el dispositivo no tiene cuota
       o bloquea IndexedDB, el manual ya está usable en esta sesión. */
    if(hash)guardarManual(hash,doc,chunks,figuras,{paginas,ficha:docFichas.get(file.name)||null}).catch(e=>{
      console.warn('guardarManual',e);
      showToast(`"${file.name}" se puede usar ahora, pero no cupo en el almacenamiento del teléfono: la próxima vez habrá que volver a cargarlo.`,'warn',6000);
    });
  }
  procWrap.style.display='none';
  validarSeccionActiva();
  /* Con un solo manual no hay ambigüedad y se activa solo. Con varios NO se
     elige por el asesor —cuál de cinco es "el suyo" no lo sabe nadie más que
     él—, pero sí se le dice que puede elegir: si no, la respuesta se arma con
     los cinco y el dato sale citado a la página de un manual que no es el suyo. */
  if(docs.length===1&&!appState.manualActivo){
    appState.manualActivo=docs[0].name;
    try{localStorage.setItem('ap_manual_activo',appState.manualActivo)}catch{}
  }else if(docs.length>1&&!appState.manualActivo){
    showToast('📕 Tienes varios manuales cargados: cada pregunta busca en la sección que le toca, y si dos empatan te pregunto. Si trabajas siempre en una, elígela arriba.','info',7000);
  }else if(activoPrevio&&appState.manualActivo===activoPrevio&&docs.length>habia){
    /* Cargar un manual nuevo y que la sección activa siga siendo la de antes es
       silencioso y caro: todo lo que se pregunte del manual recién cargado se
       busca dentro del viejo, y sale "el manual no lo especifica" con el manual
       bueno a un clic. Pasó en el piso, con Muebles activo y Juveniles cargado. */
    const nuevos=docs.slice(habia).map(d=>nombreDeSeccion(d.name)).join(', ');
    showToast(`📕 Cargaste ${nuevos}. Tu sección activa sigue siendo ${nombreDeSeccion(appState.manualActivo)} — cámbiala arriba si vas a preguntar por la nueva.`,'warn',8000);
  }
  renderDocs();
  /* Con key conectada, la IA lee sola la sección activa, en segundo plano: el
     manual ya se puede consultar mientras tanto. Las otras se leen al elegirlas
     o con el botón de Manuales, para no gastar la cuota en lo que no se pregunta. */
  const activa=appState.manualActivo||(docs.length===1?docs[0].name:null);
  if(hayKeyParaIA()&&activa)prepararFichasPendientes({solo:activa}).catch(e=>console.warn('ficha',e));
}

function renderDocs(){
  const list=document.getElementById('doc-list'),ragInfo=document.getElementById('rag-info');
  /* En el celular, 15 manuales en tarjetas sueltas eran casi tres pantallas y el
     selector de sección quedaba al fondo. Ahora cada manual es una fila de una
     sola tarjeta (nombre arriba, datos en una línea) y pasando de 6 filas el
     resto se despliega con «Ver los N manuales». */
  const builtinHTML=`<div class="doc-item builtin"><div class="doc-icon">${ICO.libro}</div><div class="doc-texto"><span class="doc-name">Biblia Hombres — 12 manuales consolidados (M-01 a M-12, incluye Softline SL) · conocimiento sintético</span><span class="doc-meta"><span class="doc-tag">Integrado</span></span></div></div>`;
  const userHTML=docs.map((d,i)=>`
    <div class="doc-item"${i>=LISTA_CORTA-1&&!listaManualesAbierta()&&docs.length>LISTA_CORTA-1?' hidden':''}>
      <div class="doc-icon">${ICO.doc}</div>
      <div class="doc-texto">
        <span class="doc-name">${escapeHtml(d.name)}</span>
        <span class="doc-meta">${escapeHtml(d.size)}${d.pageCount?' · '+d.pageCount+' pág.':''} · ${d.chunkCount} frag.${d.figureCount?' · '+d.figureCount+' fig.':''}${estadoDeFicha(d.name)}${lecturaVieja(d)?' <span class="doc-releer" title="Se guardó con una lectura anterior del PDF: vuelve a elegirlo para leer mejor sus tablas">↻ releer</span>':''}</span>
      </div>
      <button class="doc-remove" onclick="removeDoc(${i})" aria-label="Quitar ${escapeHtml(d.name)}">✕</button>
    </div>`).join('');
  list.innerHTML=builtinHTML+userHTML;
  /* Con manuales ya cargados, la zona de carga se vuelve una fila: ya cumplió. */
  const zona=document.querySelector('#panel-docs .drop-zone');
  if(zona)zona.classList.toggle('compacta',docs.length>0);
  const verTodos=document.getElementById('docs-ver-todos');
  if(verTodos){
    const sobran=docs.length>LISTA_CORTA-1;
    verTodos.style.display=sobran?'':'none';
    verTodos.textContent=listaManualesAbierta()?'Ver menos':`Ver los ${docs.length} manuales`;
    verTodos.setAttribute('aria-expanded',String(listaManualesAbierta()));
  }
  /* El aviso de lectura vieja va una sola vez arriba; en la fila queda «↻ releer». */
  const aviso=document.getElementById('docs-aviso'),viejos=docs.filter(lecturaVieja).length;
  if(aviso){
    aviso.style.display=viejos?'':'none';
    aviso.textContent=viejos?`↻ ${viejos===1?'1 manual se leyó':viejos+' manuales se leyeron'} con una versión anterior: vuelve a elegir ${viejos===1?'su PDF':'sus PDF'} para leer mejor sus tablas.`:'';
  }
  /* El contador vive en la pestaña de manuales y cuenta los del asesor. En la
     del chat, «1» con cero manuales cargados parecía un mensaje sin leer. */
  const b=document.getElementById('badge');b.style.display=docs.length?'':'none';b.textContent=docs.length;
  if(docs.length>0){
    ragInfo.style.display='block';
    ragInfo.textContent=`RAG activo — ${docChunks.length} fragmentos y ${docFigures.length} figuras en ${docs.length} manual${docs.length>1?'es':''}.`;
  }else ragInfo.style.display='none';
  renderSelectorSeccion();
  renderQuickBtns();
  renderAccionesDocs();
}
/* Filas visibles con la lista cerrada, contando el manual integrado. */
const LISTA_CORTA=6;
/* Se recuerda en la sesión; si el almacenamiento falla, vale lo de esta visita. */
let listaAbierta=(()=>{try{return sessionStorage.getItem('ap_lista_manuales')==='1'}catch{return false}})();
const listaManualesAbierta=()=>listaAbierta;
function alternarListaManuales(){
  const abrir=listaAbierta=!listaAbierta;
  try{sessionStorage.setItem('ap_lista_manuales',abrir?'1':'0')}catch{}
  renderDocs();
  /* Al cerrar, el botón se quedaba muy abajo de donde estaba el dedo. */
  if(!abrir)document.getElementById('docs-ver-todos')?.scrollIntoView({block:'nearest'});
}

/* ── SELECTOR DE SECCIÓN ACTIVA ───────────────────
   Se pinta en la pestaña de manuales y en la cabecera del chat: no se puede
   responder sin que se vea contra qué manual se está respondiendo. */
function renderSelectorSeccion(){
  const opciones=[`<option value="">Todos los manuales (${docs.length})</option>`]
    .concat(docs.map(d=>`<option value="${escapeHtml(d.name)}"${appState.manualActivo===d.name?' selected':''}>${escapeHtml(nombreDeSeccion(d.name))}</option>`));
  /* La cabecera también dice de qué sección es: con un manual de Bebés cargado,
     «Departamento Hombres» es sencillamente falso. */
  const hdr=document.getElementById('hdr-seccion');
  const activa=seccionActiva();
  if(hdr)hdr.textContent=activa?'Visual Merchandising · '+activa:(docs.length>1?`Visual Merchandising · ${docs.length} manuales cargados`:'Visual Merchandising · Departamento Hombres');
  for(const id of['seccion-activa','seccion-activa-chat']){
    const wrap=document.getElementById(id+'-wrap');
    const sel=document.getElementById(id);
    if(!wrap||!sel)continue;
    /* Con un solo manual no hay nada que elegir: el selector solo estorbaría. */
    wrap.style.display=docs.length>1?'':'none';
    sel.innerHTML=opciones.join('');
    sel.value=appState.manualActivo||'';
  }
}
/* La sección activa se recuerda entre visitas, y puede nombrar un manual que ya
   no está cargado. Entonces la búsqueda filtraba por un documento fantasma y
   daba cero resultados en TODAS las preguntas; con un solo manual el selector
   ni se ve, así que no había forma de salir. */
function validarSeccionActiva(){
  if(!appState.manualActivo||docs.some(d=>d.name===appState.manualActivo))return;
  appState.manualActivo=docs.length===1?docs[0].name:null;
  try{localStorage.setItem('ap_manual_activo',appState.manualActivo||'')}catch{}
}
function cambiarSeccion(valor){
  appState.manualActivo=valor||null;
  try{localStorage.setItem('ap_manual_activo',appState.manualActivo||'')}catch{}
  renderSelectorSeccion();
  renderQuickBtns();
  if(valor&&hayKeyParaIA()&&!preparandoFicha&&paginasSinFicha(valor).length)
    prepararFichasPendientes({solo:valor}).catch(e=>console.warn('ficha',e));
  showToast(appState.manualActivo
    ?`📕 Sección activa: ${nombreDeSeccion(appState.manualActivo)}. Solo se consulta ese manual.`
    :'📚 Sin sección fija: cada pregunta busca en la sección que le toca.','info',3500);
}
function removeDoc(i){
  const name=docs[i].name,hash=docs[i].hash;
  docs.splice(i,1);
  /* Quitarlo de la lista y dejarlo guardado hacía que el contador siguiera
     diciendo que estaba en el dispositivo. Quitar es quitar. */
  if(hash)borrarManual(hash).catch(()=>{}).then(renderAccionesDocs);
  docChunks=docChunks.filter(c=>c.docName!==name);
  docFigures=docFigures.filter(f=>f.docName!==name);
  docPaginas.delete(name);docFichas.delete(name);
  /* Si se quitó el manual que estaba activo, la sección activa deja de existir:
     seguir filtrando por él dejaría el asistente mudo sin decir por qué. */
  if(appState.manualActivo===name)cambiarSeccion(docs.length===1?docs[0].name:'');
  rebuildCorpus();
  renderDocs();
  showToast(`🗑️ "${name}" eliminado`, 'warn', 2500);
}

/* ════════════════════════════════════════════════
   SOURCE INDICATOR
════════════════════════════════════════════════ */
function getSourceInfo(query,contextBuilt,memUsed,hasPdfs,ampliada){
  const sources=[];
  /* La respuesta sobre la app no salió de ninguna lámina, y anunciar "PDF ·
     pág. 3" debajo sería prometer una fuente que no se consultó. */
  if(typeof contextBuilt==='string'&&contextBuilt.startsWith('=== ESTADO DE LA APP'))
    return[{type:'manual',label:'ℹ️ Datos de la app, no del manual'}];
  /* Que la búsqueda se haya apoyado en la pregunta anterior no puede ser magia
     invisible: si el asesor no entiende por qué salió lo que salió, no puede
     corregir el tiro con otra pregunta. */
  if(ampliada)sources.push({type:'ampliada',label:'Búsqueda ampliada con tu pregunta anterior'});
  /* Con el contexto en la mano se puede decir QUÉ páginas se consultaron, no
     solo que "había un PDF": es la diferencia entre una etiqueta y una pista. */
  const paginas=typeof contextBuilt==='string'
    ?[...new Set([...contextBuilt.matchAll(/p[áa]g\.\s*(\d+)/gi)].map(m=>m[1]))]
    :[];
  /* Con varios manuales cargados, saber de cuál salió la respuesta es la mitad
     de la información. */
  /* Hay manuales que cubren varias secciones y su rótulo es larguísimo
     («206 APARATOS DE EJERCICIO, 207 MOTOS Y 211 MOVILIDAD ELÉCTRICA»): en la
     etiqueta se recorta, en el prompt viaja entero. */
  const corta=n=>n.length>42?n.slice(0,40)+'…':n;
  if(hasPdfs&&ultimaOtraSeccion){
    sources.push({type:'seccion',label:'⚠ Preguntaste por '+corta(ultimaOtraSeccion.nombre)});
  }
  else if(hasPdfs&&ultimaSeccionUsada){
    const n=corta(nombreDeSeccion(ultimaSeccionUsada));
    /* Si la sección la eligió la pregunta y no el selector, se dice: responder
       por un manual que el asesor no eligió sin avisar es la misma trampa. */
    sources.push({type:'seccion',label:ultimaSeccionPorPregunta?`${n} (${typeof ultimaSeccionPorPregunta==='string'?ultimaSeccionPorPregunta:'por tu pregunta'})`:n});
  }
  else if(hasPdfs&&docs.length>1)sources.push({type:'seccion',label:`${docs.length} manuales a la vez`});
  /* Con la pregunta apuntando a otra sección, las páginas que se consultaron son
     las de la sección activa: enseñarlas debajo de un "esto es de otra sección"
     es mandar al asesor a la página equivocada de un manual equivocado. */
  if(hasPdfs&&contextBuilt&&!ultimaOtraSeccion)sources.push({type:'pdf',label:paginas.length?`PDF · pág. ${paginas.slice(0,6).join(', ')}${paginas.length>6?'…':''}`:'PDF cargado'});
  /* Con un PDF cargado el manual interno ya no entra al contexto: anunciarlo
     como fuente era prometer una revisión que no ocurrió. */
  if(contextBuilt&&!hasPdfs)sources.push({type:'manual',label:'Manual interno'});
  if(memUsed&&memUsed.length)sources.push({type:'memory',label:'📚 Aprendido: '+memUsed.slice(0,2).map(u=>u.texto).join(', ')});
  if(appState.extraEnabled&&appState.extra.trim())sources.push({type:'extra',label:'Contexto asesor'});
  if(!sources.length)sources.push({type:'none',label:'Sin fuentes'});
  return sources
}

function renderSourceIndicator(container,query,contextBuilt,memUsed,hasPdfs,ampliada){
  const sources=getSourceInfo(query,contextBuilt,memUsed,hasPdfs,ampliada);
  const wrap=document.createElement('div');wrap.className='msg-sources';
  wrap.innerHTML=sources.map(s=>`<span class="src-tag ${s.type}">${escapeHtml(s.label)}</span>`).join('');
  container.appendChild(wrap)
}

/* ════════════════════════════════════════════════
   ERROR GUIDE
════════════════════════════════════════════════ */
const ERROR_GUIDE={
  400:{icon:'⚠️',msg:'Solicitud inválida.',solution:'Revisa que el mensaje no sea demasiado largo o tenga caracteres especiales.'},
  401:{icon:'🔑',msg:'Token inválido o expirado.',solution:'Genera una clave nueva en el sitio de tu proveedor y pégala en Ajustes.'},
  403:{icon:'🚫',msg:'Sin permiso para este modelo.',solution:'Cambia a un modelo diferente o verifica que tu plan lo incluya.'},
  404:{icon:'🔍',msg:'Modelo no encontrado.',solution:'El modelo seleccionado no existe o no está disponible para tu región.'},
  429:{icon:'⏳',msg:'Demasiadas consultas.',solution:'Espera 30 segundos — hay límite de consultas por minuto. El sistema reintentará automáticamente.'},
  500:{icon:'🔧',msg:'Error interno del servidor.',solution:'El servidor tuvo un error temporal. Vuelve a intentar en unos segundos.'},
  503:{icon:'🔧',msg:'Servicio no disponible.',solution:'El proveedor está caído o saturado. Espera un minuto o cambia de modelo en Ajustes.'},
};
const ERROR_KEYWORDS=[
  {keys:['image','image input','vision','multimodal'],icon:'🖼️',msg:'El modelo no soporta imágenes.',solution:'Elige en Ajustes un modelo que lea imágenes: cualquier Gemini de la lista o gpt-4o-mini.'},
  {keys:['high demand','overloaded','over capacity','temporary','congestion'],icon:'🔥',msg:'El modelo está saturado.',solution:'No es tu conexión ni tu manual: el proveedor está al tope. Ya se reintentó unas cuantas veces; espera un minuto o cambia de modelo en Ajustes.'},
  {keys:['rate limit','too many','quota','429'],icon:'⏳',msg:'Límite de consultas excedido.',solution:'Espera 30 segundos y vuelve a intentar. Hay un límite por minuto.'},
  {keys:['auth','unauthorized','invalid key','api_key','api key','token','permission denied'],icon:'🔑',msg:'Error de autenticación.',solution:'Tu clave API no es válida. Genera una nueva y actualízala en Ajustes.'},
  {keys:['not found','does not exist','not available','not support'],icon:'🔍',msg:'Modelo o recurso no encontrado.',solution:'El modelo elegido no existe o tu clave no tiene acceso a él. Cambia el modelo en Ajustes.'},
  {keys:['network','fetch','failed to fetch','abort','timeout'],icon:'📡',msg:'Error de conexión.',solution:'Revisa tu conexión a internet. Si usas VPN, desactívala o cambia de red.'},
];
function formatError(err){
  const msg=err.message||'';
  if(err.clase==='cuota-dia')return`⛔ Se acabó la cuota de hoy de tu key.\n\n<div class="err-detail"><span class="err-code">${escapeHtml(msg.slice(0,200))}</span><span class="err-solution">💡 Esperar no sirve hasta mañana. Mientras, el modo manual sigue contestando: quita la key en Ajustes o prueba otro proveedor.</span></div>`;
  const code=err.status?String(err.status):msg.match(/(\d{3})/)?.[1];
  /* El texto dice más que el número. Gemini saturado responde 503 con «high
     demand», que por el código se leería como «en mantenimiento»; y una key
     mal pegada responde 400 «API key not valid», que se leería como «el
     mensaje es demasiado largo», justo lo primero que ve quien prueba el demo. */
  const porTexto=/high demand|overloaded|over capacity|congestion/i.test(msg)
    ?ERROR_KEYWORDS.find(e=>e.keys.includes('high demand'))
    :/api.?key|unauthori[sz]ed|permission denied/i.test(msg)
    ?ERROR_KEYWORDS.find(e=>e.keys.includes('api_key')):null;
  if(porTexto)return`${porTexto.icon} ${porTexto.msg}\n\n<div class="err-detail"><span class="err-code">${escapeHtml(msg)}</span><span class="err-solution">💡 ${porTexto.solution}</span></div>`;
  const guide=ERROR_GUIDE[code];
  if(guide)return`${guide.icon} ${guide.msg}\n\n<div class="err-detail"><span class="err-code">Error ${code}</span><span class="err-solution">💡 ${guide.solution}</span></div>`;
  for(const entry of ERROR_KEYWORDS){
    if(entry.keys.some(k=>msg.toLowerCase().includes(k))){
      return`${entry.icon} ${entry.msg}\n\n<div class="err-detail"><span class="err-code">${escapeHtml(msg)}</span><span class="err-solution">💡 ${entry.solution}</span></div>`;
    }
  }
  return`⚠️ Error inesperado\n\n<div class="err-detail"><span class="err-code">${escapeHtml(msg||'Error desconocido')}</span><span class="err-solution">💡 Verifica tu conexión e intenta de nuevo. Si persiste, cambia de proveedor o modelo.</span></div>`
}

/* ════════════════════════════════════════════════
   STREAMING — helpers SSE para OpenAI y Gemini
   v7.0 — C1
════════════════════════════════════════════════ */
let currentAbort = null;
let ultimoErrorProveedor = null;   // el de la última pregunta: la medición lo lee para saber si paró la cuota

/* Los helpers SSE (OpenAI y Gemini) viven en src/ia/sse.js. */

/* Los reintentos y el respaldo: lo puro (esperas, qué se reintenta, qué es
   saturación, el modelo de respaldo, cómo se nombra cada modelo) vive en
   src/ia/reintentos.js. Aquí queda lo que tiene estado o avisa en pantalla. */
let respaldoActivo = null;                // {de, a, hasta}: solo en memoria, no en Ajustes

function modeloEfectivo(provider, model) {
  if (respaldoActivo && respaldoActivo.de === model && Date.now() < respaldoActivo.hasta
      && modeloDeRespaldo(provider, model) === respaldoActivo.a) return respaldoActivo.a;
  return model;
}
/* Qué modelo contestó, en la etiqueta del mensaje. Con el respaldo de por medio
   ya no es necesariamente el que dice Ajustes. */
function marcarModelo(msgEl,model,esRespaldo){
  const label=msgEl?.querySelector('.msg-label');
  if(!label||!model)return;
  msgEl.dataset.modelo=model;
  const pill=document.createElement('span');
  pill.className='msg-tokens msg-modelo';
  pill.textContent=nombreCortoDeModelo(model)+(esRespaldo?' · respaldo':'');
  label.appendChild(pill);
}

/* Un solo bucle para las dos formas de llamar. `intento(modelo)` hace la
   petición; lo que regresa lleva además `model`, el que de verdad contestó. */
async function conReintentos(provider, model, intento, {signal, onRetry, onRespaldo} = {}) {
  /* Midiendo, el modelo es la variable del experimento: no se cambia solo. */
  const sinRespaldo = typeof midiendo !== 'undefined' && midiendo;
  let actual = sinRespaldo ? model : modeloEfectivo(provider.id, model);
  if (actual !== model) onRespaldo?.(model, actual);
  let saturaciones = 0, esperas = 0;
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      const r = await intento(actual);
      return {...r, model: actual};
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      if (err.clase === 'cuota-dia') throw err;
      if (err.clase === 'limite-minuto') {
        if (++esperas > LIMITE_MINUTO_ESPERAS) { err.clase = 'cuota-dia'; throw err; }
        const ms = Math.min(LIMITE_MINUTO_ESPERA_MAX, Math.max(2000, (err.espera || 60000) + 1000));
        if (onRetry) onRetry(ms, 'limite-minuto');
        else showToast(`⏳ Límite por minuto del proveedor · sigo en ${Math.round(ms / 1000)} s`, 'warn', Math.min(ms, 6000));
        await sleep(ms, signal);
        attempt--;                       // esperar el minuto no gasta un reintento
        continue;
      }
      if (!isRetryable(err)) throw err;
      saturaciones = (err.clase === 'saturado' || (!err.clase && esSaturacion(err))) ? saturaciones + 1 : 0;
      const respaldo = sinRespaldo ? null : modeloDeRespaldo(provider.id, actual);
      if (respaldo && saturaciones >= RESPALDO_TRAS) {
        respaldoActivo = {de: actual, a: respaldo, hasta: Date.now() + RESPALDO_MEMORIA};
        if (onRespaldo) onRespaldo(actual, respaldo);
        else showToast(`${nombreCortoDeModelo(actual)} saturado · contesta ${nombreCortoDeModelo(respaldo)}`, 'warn', 3000);
        actual = respaldo; saturaciones = 0; attempt = -1;  // el respaldo empieza sus propios reintentos
        continue;
      }
      if (attempt === RETRY_DELAYS.length) {
        /* Si el respaldo tampoco pudo, no se recuerda: la siguiente pregunta
           vuelve a intentar con el que eligió el asesor. */
        if (respaldoActivo && respaldoActivo.a === actual) respaldoActivo = null;
        throw err;
      }
      const delay = RETRY_DELAYS[attempt];
      if (onRetry) onRetry(delay, err.clase || 'otro');
      showToast(`⏳ Reintento ${attempt + 1}/${RETRY_DELAYS.length} en ${delay / 1000}s…`, 'warn', delay);
      await sleep(delay, signal);
    }
  }
}

async function callWithRetryStream(provider, params) {
  return conReintentos(provider, params.model, model => provider.stream({...params, model}), params);
}

async function callWithRetry(provider, key, messages, model, maxTokens, temperature) {
  return conReintentos(provider, model, m => provider.call(key, messages, m, maxTokens, temperature));
}

function stopGeneration() {
  if (currentAbort) { currentAbort.abort(); }
}

/* Segunda consulta, explícita y a otra fuente. No se mezcla con la anterior ni
   se guarda en el historial como si fuera la respuesta del manual del asesor:
   es otro manual, y el mensaje lo dice antes de decir nada más. */
async function consultarTodosLosManuales(pregunta,btn){
  const contexto=contextoTodosLosManuales(pregunta);
  /* Los fragmentos que de verdad entraron, capturados antes de que cualquier
     otra búsqueda los pise: son de los que pueden salir las láminas. */
  const frags=ultimosFragmentos.slice();
  if(!contexto){
    showToast('Eso tampoco aparece en tus otros manuales.','warn',4000);
    btn.disabled=true;btn.innerHTML=conIcono('lupa','Tampoco está en tus otros manuales');
    return;
  }
  btn.disabled=true;btn.innerHTML=conIcono('lupa','Buscando en todas tus secciones…');
  const loaderEl=appendMsg('assistant','',true);
  try{
    const provider=PROVIDERS[appState.provider];
    const messages=[
      {role:'system',content:'Eres el especialista en Visual Merchandising de Mercadep. Responde SOLO con lo que diga el contexto, en 2-4 oraciones, sin formato de etapas. Cada dato va con el nombre de su sección y su página: "en 365 BLANCOS (pág. 20)…". Si el contexto no lo cubre, dilo y ya. Cierra con "CERTEZA: ALTA", "CERTEZA: MEDIA" o "CERTEZA: GAP" en su propia línea.'},
      {role:'user',content:contexto},
      {role:'user',content:pregunta}
    ];
    const{text,tokens,model:contesto}=await callWithRetry(provider,appState.apiKey,messages,appState.chatModel,900,appState.temperature);
    const limpio=sanitizeFinalAnswer(text,pregunta);
    const certeza=certezaDe(text);
    loaderEl.classList.remove('loading');
    loaderEl.querySelector('.msg-body').innerHTML=safeMarkdown(limpio);
    loaderEl.querySelector('.msg-label').innerHTML='Asistente <span class="certeza ref">todas tus secciones — no es tu sección activa</span>';
    marcarModelo(loaderEl,contesto,contesto!==appState.chatModel);
    const verif=verificarContraContexto(limpio,contexto);
    const alerta=renderAvisoVerificacion(verif);
    if(alerta)loaderEl.insertBefore(alerta,loaderEl.querySelector('.msg-body'));
    /* Lámina solo si TODO lo consultado salió de un mismo manual. Con dos
       secciones en juego, una foto debajo de un dato afirma de cuál de las dos
       sale, y eso aquí no se puede sostener. */
    const cuantos=new Set(frags.map(c=>c.docName)).size;
    if(cuantos===1)renderEvidencia(loaderEl,figurasDeFragmentos(frags,verif.citadas,limpio,certeza),'cita');
    sessionTokens+=tokens||estimateTokens(text);updateTokenBar();
    btn.innerHTML=conIcono('lupa','Buscado en todas tus secciones');
  }catch(err){
    loaderEl.classList.remove('loading');
    const body=loaderEl.querySelector('.msg-body');
    body.style.color='var(--amber)';
    body.innerHTML=safeMarkdown(formatError(err));
    btn.disabled=false;btn.innerHTML=conIcono('lupa','Buscar en mis otros manuales');
  }
  scrollToBottom();
}

/* ════════════════════════════════════════════════
   SEND MESSAGE — Streaming v7.0
════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════
   MODO SIN MODELO — retrieval local, cero red
   Sin API key el asistente no se calla: corre el mismo
   retrieval léxico que alimenta al modelo y entrega los
   fragmentos del manual tal cual, declarando que nadie
   los interpretó. Prefiero enseñar el límite a fingir
   una respuesta.
════════════════════════════════════════════════ */
/* Qué fragmentos enseña (relevantesSinModelo) y qué contesta
   (respuestaSinModelo) viven en src/motor/respuesta.js. Aquí se pintan. */
function seccionesPorRelevancia(q){
  const sec=docChunks.length?decidirSeccion(q):{doc:null,otraSeccion:null};
  return relevantesSinModelo(q,sec,history)
}
/* Una tarjeta por fragmento del manual. Todo por DOM y textContent: el texto
   viene de un PDF ajeno y no pasa por innerHTML. */
let invitoApi=false;
/* Lo que enseñaron de verdad las últimas tarjetas —el texto ya recortado al
   presupuesto y unido por lámina—, para medir lo que ve el asesor y no lo que
   puntuó la búsqueda. */
let ultimasTarjetas=[];
function rotuloDeFragmento(c){
  const partes=[c.source==='pdf'?nombreDeSeccion(c.docName):c.docName];
  if(c.page)partes.push('pág. '+c.page);
  if(c.heading)partes.push(c.heading);
  if(c.isFicha==='visual')partes.push('lo que se lee en la imagen (transcrito por IA)');
  return partes.join(' · ')
}
function resaltar(texto,terminos){
  const out=document.createDocumentFragment();
  let ultimo=0;
  for(const m of texto.matchAll(/[\p{L}\p{N}]+/gu)){
    const w=terminos.get(normalizeText(m[0]).trim());
    if(w===undefined)continue;
    out.append(texto.slice(ultimo,m.index));
    const mk=document.createElement('mark');
    if(w<1)mk.className='sin';   // llegó por sinónimo o variante, no por la palabra escrita
    mk.textContent=m[0];out.append(mk);
    ultimo=m.index+m[0].length;
  }
  out.append(texto.slice(ultimo));
  return out
}
/* Un fragmento largo se corta a la vista, y el dato podía quedar debajo del
   corte: «¿a qué altura va el sensor?» enseñaba el principio de REGLAS
   GLOBALES —el gancho, los pantalones colgados— y el «12-18 cm» había que ir a
   buscarlo con «Ver todo». Se enseñan primero los renglones que coinciden con
   la pregunta, en su orden, y el texto entero queda a un toque. */
function renglonesClave(lineas,terminos,max){
  const pun=lineas.map((l,i)=>{
    let s=0;
    for(const m of l.matchAll(/[\p{L}\p{N}]+/gu)){const w=terminos.get(normalizeText(m[0]).trim());if(w!==undefined)s+=w}
    return{i,s}
  });
  return pun.filter(p=>p.s>0).sort((a,b)=>b.s-a.s||a.i-b.i).slice(0,max).map(p=>p.i).sort((a,b)=>a-b)
}
function lineasDeFragmento(c,texto){
  /* El título ya va en la cabecera de la tarjeta: repetido como «## …» en la
     primera línea solo empujaba el texto hacia abajo. */
  const titulo=normalizeText(c.heading||'').trim();
  /* El PDF corta el renglón donde lo cortó la maqueta de la lámina, no donde
     termina la frase: «a 15 / cm de la bastilla, por / dentro». Se unen los
     renglones que siguen a una frase sin terminar. */
  const corrido=texto.replace(/([^.:;!?\n])\n(?=[a-záéíóúñ0-9(])/g,'$1 ');
  return corrido.split('\n').map(l=>l.replace(/^#+\s*/,'').trim())
    .filter((l,i)=>l&&!(i<2&&titulo&&normalizeText(l).trim()===titulo))
}
function tarjetaDeFragmento(c,texto,terminos){
  const card=document.createElement('div');card.className='frag-card';
  const head=document.createElement('div');head.className='frag-head';
  head.textContent=rotuloDeFragmento(c);
  const lineas=lineasDeFragmento(c,texto);
  const completo=lineas.join('\n');
  const body=document.createElement('div');body.className='frag-text';
  card.append(head,body);
  const clave=completo.length>420?renglonesClave(lineas,terminos,3):[];
  if(clave.length){
    const extracto=document.createDocumentFragment();
    let prev=-1;
    for(const i of clave){
      if(i>prev+1)extracto.append(prev<0?'… ':'\n… ');
      else if(prev>=0)extracto.append('\n');
      extracto.append(resaltar(lineas[i],terminos));
      prev=i;
    }
    if(prev<lineas.length-1)extracto.append(' …');
    body.appendChild(extracto);
    const mas=document.createElement('button');mas.className='frag-mas';mas.type='button';mas.textContent='Ver la sección completa ▾';
    let abierto=false;
    mas.onclick=()=>{
      abierto=!abierto;body.textContent='';
      if(abierto)body.appendChild(resaltar(completo,terminos));
      else{let p=-1;for(const i of clave){if(i>p+1)body.append(p<0?'… ':'\n… ');else if(p>=0)body.append('\n');body.append(resaltar(lineas[i],terminos));p=i}if(p<lineas.length-1)body.append(' …')}
      mas.textContent=abierto?'Ver menos ▴':'Ver la sección completa ▾';
    };
    card.appendChild(mas);
  }else{
    body.appendChild(resaltar(completo,terminos));
    if(completo.length>420){
      card.classList.add('cortado');
      const mas=document.createElement('button');mas.className='frag-mas';mas.type='button';mas.textContent='Ver todo ▾';
      mas.onclick=()=>{const c2=card.classList.toggle('cortado');mas.textContent=c2?'Ver todo ▾':'Ver menos ▴'};
      card.appendChild(mas);
    }
  }
  return card
}
/* ════════════════════════════════════════════════
   COMPARTIR UNA RESPUESTA (WhatsApp)

   En el piso la duda no se queda en quien preguntó: se reenvía al grupo de la
   sección o a la jefa. Se manda la pregunta, lo que dice el manual y de dónde
   sale, y la lámina como foto —en WhatsApp el texto va de pie de foto—. Si la
   respuesta traía un aviso, el aviso viaja con ella: reenviada sin él, una
   respuesta dudosa llega al grupo como si fuera segura.
══════════════════════════════════════════════════ */
const URL_PUBLICA='https://gerardobr01.github.io/Asistente-de-piso/';
function enlaceDeLaApp(){
  return location.protocol==='https:'?location.origin+location.pathname.replace(/index\.html$/,''):URL_PUBLICA
}
/* WhatsApp marca negritas con un asterisco, no con dos. */
function markdownAWhatsApp(md){
  return String(md||'')
    .replace(/```[\s\S]*?```/g,'')
    .replace(/^#{1,6}\s*(.+)$/gm,'*$1*')
    .replace(/\*\*(.+?)\*\*/g,'*$1*')
    .replace(/__(.+?)__/g,'_$1_')
    .replace(/`([^`]+)`/g,'$1')
    .replace(/^[ \t]*[-*][ \t]+/gm,'• ')
    .replace(/^>\s?/gm,'')
    .replace(/\[([^\]]+)\]\([^)]+\)/g,'$1')
    .replace(/\n{3,}/g,'\n\n')
    .trim()
}
function textoParaCompartir({pregunta,respuesta,fuente,aviso}){
  const l=['*❓ '+String(pregunta).trim()+'*',''];
  if(aviso)l.push(aviso,'');
  l.push(respuesta.length>900?respuesta.slice(0,900).replace(/\s+\S*$/,'')+' …':respuesta);
  if(fuente)l.push('','📄 '+fuente);
  l.push('','_Asistente de piso_ · '+enlaceDeLaApp());
  return l.join('\n')
}
function archivoDeLamina(fig){
  if(!fig||!/^data:image\/\w+;base64,/.test(fig.dataUrl||''))return null;
  try{
    const[cab,datos]=fig.dataUrl.split(',');
    const tipo=cab.slice(5,cab.indexOf(';'));
    const bin=atob(datos),buf=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++)buf[i]=bin.charCodeAt(i);
    return new File([buf],`lamina-pag-${fig.page||'x'}.${tipo==='image/png'?'png':'jpg'}`,{type:tipo});
  }catch{return null}
}
async function compartirRespuesta(datos){
  const texto=textoParaCompartir(datos);
  if(navigator.share){
    const f=archivoDeLamina(datos.figura);
    const conFoto=!!(f&&navigator.canShare&&navigator.canShare({files:[f]}));
    try{await navigator.share(conFoto?{files:[f],text:texto}:{text:texto});return}
    catch(e){if(e&&e.name==='AbortError')return}
  }
  /* Sin hoja de compartir (la computadora): WhatsApp Web con el texto. La
     lámina no cabe en un link, así que se avisa. */
  const w=window.open('https://wa.me/?text='+encodeURIComponent(texto),'_blank','noopener');
  if(w){if(datos.figura)showToast('La lámina no se puede adjuntar desde aquí: mándala desde el celular.','warn',3500);return}
  try{
    await navigator.clipboard.writeText(texto);
    showToast('📋 Respuesta copiada. Pégala en WhatsApp.','success',3000);
  }catch{showToast('No se pudo compartir desde este navegador.','error',3500)}
}
function botonCompartir(datos){
  const b=document.createElement('button');b.type='button';b.className='msg-copy msg-share';
  b.textContent='WhatsApp';b.setAttribute('aria-label','Compartir esta respuesta por WhatsApp');
  b.onclick=()=>compartirRespuesta(typeof datos==='function'?datos():datos);
  return b
}
/* Lo que se reenvía en modo manual es lo mismo que se ve en la tarjeta: los
   renglones que coinciden, no la sección entera. */
function extractoParaCompartir(t,terminos){
  const lineas=lineasDeFragmento(t.c,t.texto);
  const completo=lineas.join('\n');
  if(completo.length<=420)return completo;
  const clave=renglonesClave(lineas,terminos,3);
  return clave.length?'… '+clave.map(i=>lineas[i]).join('\n… ')+' …':completo.slice(0,420)+' …'
}

/* El contrato de decisión de la última respuesta del modo manual
   (src/motor/puerta.js). En el modo IA viaja en lo que devuelve buildContext. */
let ultimaDecision=null;
function responderSinModelo(q){
  rutaActual=null;
  ultimaDecision=null;
  ocultarBannerRestaurar();
  switchTab('chat');
  appendMsg('user',q,false);
  /* Qué contestar lo decide el motor (src/motor/respuesta.js); aquí se pinta. */
  const r=respuestaSinModelo(q,history,rutaDe);
  ultimaDecision=r.decision;
  if(r.tipo==='saludo'){
    const saludo='Hola. Estoy en **modo manual**: sin API key no interpreto nada, pero busco en el manual y te entrego lo que dice, tal cual.\n\nPregúntame de exhibición, entallado, sensores, POS o clasificación de mundos.';
    appendMsg('assistant',saludo,false);
    history.push({role:'user',content:q});
    history.push({role:'assistant',content:saludo});
    saveChatHistory();scrollToBottom();
    return;
  }
  /* Preguntar por los manuales cargados no necesita modelo ni búsqueda: la
     respuesta son los datos de la app. */
  if(r.tipo==='estado'){
    const cuerpo=estadoParaPantalla();
    appendMsg('assistant',cuerpo,false);
    history.push({role:'user',content:q});
    history.push({role:'assistant',content:cuerpo});
    saveChatHistory();scrollToBottom();
    return;
  }
  const ruta=r.ruta;
  if(r.tipo==='empate'){preguntarSeccion(q,ruta.alternativas);return}
  const{sec,tarjetas,fragmentos,nombrada,enOtra,activo,avisoAusente,porParecidas,avisoParecidas,avisoFlojo}=r;
  ultimasTarjetas=tarjetas;
  const avisoVisible=avisoAusente||avisoParecidas||avisoFlojo;
  /* Si una tarjeta es lo que la IA leyó en una imagen al preparar el manual,
     «nadie lo interpretó» deja de ser del todo cierto: se dice cuál es. */
  const aviso='⚪ Así lo dice el manual, tal cual: sin modelo conectado, nadie lo interpretó.'
    +(tarjetas.some(t=>t.c.isFicha==='visual')?' La tarjeta «transcrito por IA» es lo que la IA leyó en la imagen al preparar el manual.':'');
  const invitacion=!invitoApi&&navigator.onLine
    ?'Con una API key (en Ajustes) además te contesta en una frase, citando la página.':'';
  /* El caso que se vio en el piso: la key vive en sessionStorage y se borra al
     cerrar la app. Quien ya la había puesto seguía preguntando «en modo API»
     y recibía fragmentos sin darse cuenta. Si alguna vez hubo key en este
     teléfono y ahora no la hay, se dice en cada respuesta, en una línea. */
  let keyPerdida=false;
  try{keyPerdida=!appState.apiKey&&navigator.onLine&&localStorage.getItem('ap_ia_usada')==='1'}catch{}
  const activa=sec.doc?nombreDeSeccion(sec.doc):'';
  const cuerpo=fragmentos
    ?`${avisoVisible?`> ${avisoVisible}\n`:''}> ${aviso}\n\n${fragmentos}`
    :nombrada
    ?`**Preguntas por ${nombrada.nombre}, y tienes activa ${activa}.** No te enseño la lámina de ${activa}: estos manuales comparten plantilla y la misma regla puede traer otra cifra. Cambia de sección con el botón y te contesto con ${nombrada.nombre}.`
    :`**Nada${enOtra?' de esta sección':' del manual'} coincide con esa pregunta.** Prefiero decírtelo a contestarte con la sección equivocada: o el manual no lo especifica, o no lo dice con esas palabras.${enOtra?` **Pero eso sí aparece en ${enOtra}**, que también tienes cargada: cámbiala arriba y vuelve a preguntar.`:' Prueba con otras palabras o con un acceso rápido.'}`;
  const msgEl=appendMsg('assistant',fragmentos?'':cuerpo,false);
  /* Sin fragmentos es un «no está»: se pinta distinto, sin brillo de acento. */
  if(!fragmentos)msgEl.classList.add('sin-dato');
  const cuerpoEl=msgEl.querySelector('.msg-body');
  let avisoParecidasEl=null;
  if(fragmentos){
    const terminos=new Map(weightedTerms(consultaDeBusqueda(q),activo).map(x=>[x.t,x.w]));
    const linea=lineaDeRuta(q,ruta);
    if(linea)cuerpoEl.appendChild(linea);
    const aprendidoLinea=lineaDeAprendido(consultaDeBusqueda(q),activo);
    if(aprendidoLinea)cuerpoEl.appendChild(aprendidoLinea);
    if(avisoVisible){
      const aa=document.createElement('div');aa.className=avisoAusente?'frag-ausente':'frag-ausente frag-parecidas';aa.textContent=avisoVisible;
      cuerpoEl.appendChild(aa);
      avisoParecidasEl=avisoParecidas?aa:null;
    }
    const av=document.createElement('div');av.className='frag-aviso';av.textContent=aviso;
    cuerpoEl.appendChild(av);
    for(const t of tarjetas)cuerpoEl.appendChild(tarjetaDeFragmento(t.c,t.texto,terminos));
  }
  /* El mismo botón que con API key: cambia la sección y repite la pregunta. */
  if(nombrada&&docs.some(d=>d.name===nombrada.docName)){
    const cambiar=document.createElement('button');
    cambiar.className='ref-general';cambiar.type='button';
    cambiar.innerHTML=conIcono('libro',`Cambiar a ${nombrada.nombre} y repetir la pregunta`);
    cambiar.onclick=()=>{
      cambiar.disabled=true;
      cambiarSeccion(nombrada.docName);
      const input=document.getElementById('user-input');
      input.value=q;
      sendMessage();
    };
    cuerpoEl.appendChild(cambiar);
  }
  if(keyPerdida){
    const k=document.createElement('div');k.className='frag-ausente frag-parecidas';
    k.textContent='🔑 Estás en modo manual: tu API key se borró al cerrar la app (solo vive mientras está abierta). Vuelve a pegarla en Ajustes para el modo IA.';
    cuerpoEl.insertBefore(k,cuerpoEl.firstChild);
  }else if(invitacion){
    invitoApi=true;
    const pie=document.createElement('div');pie.className='frag-pie';pie.textContent=invitacion;
    cuerpoEl.appendChild(pie);
  }
  /* En modo manual los fragmentos se enseñan enteros en pantalla, así que su
     página es literalmente de dónde sale lo que se está leyendo: el rótulo lo
     dice con esas palabras y no habla de citas, porque aquí nadie citó nada. */
  const figs=fragmentos&&!avisoAusente?figurasDeFragmentos(tarjetas.map(t=>t.c),null,null):[];
  renderEvidencia(msgEl,figs,figs.origen==='cita'?'manual':'manualPagina');
  anotarBasico(activo,q);
  if(fragmentos&&!avisoAusente&&activo){
    const fila=filaSigue(activo,tarjetas.filter(t=>t.c.docName===activo).map(t=>t.c.page),q);
    if(fila)msgEl.appendChild(fila);
  }
  const idConsulta=registrarConsulta(q,!!fragmentos&&!avisoAusente,tarjetas[0]&&tarjetas[0].c,'manual',!!avisoAusente);
  /* «Lo encontré como…»: si era eso, un toque lo confirma, y con dos se
     aprende que en esta sección se dice así. */
  if(avisoParecidasEl){
    const si=botonSiEso(porParecidas.map(p=>({dijo:p.k,como:p.como})),activo,idConsulta);
    if(si)avisoParecidasEl.appendChild(si);
  }
  /* «Nada coincide» es justo cuando más sirve que el piso diga dónde estaba. */
  if(!fragmentos&&!enOtra&&activo)pedirLamina(msgEl,null,q,idConsulta,activo,{sinDato:true});
  if(fragmentos){
    const pie=votoManual(msgEl,idConsulta,{q,doc:activo,pagina:tarjetas[0]&&tarjetas[0].c.page});
    const terminos=new Map(weightedTerms(consultaDeBusqueda(q),activo).map(x=>[x.t,x.w]));
    const t0=tarjetas[0];
    pie.appendChild(botonCompartir(()=>({
      pregunta:q,
      respuesta:extractoParaCompartir(t0,terminos),
      fuente:rotuloDeFragmento(t0.c),
      aviso:avisoVisible,
      figura:figs.length&&figs.origen==='cita'?figs[0]:null
    })));
  }
  history.push({role:'user',content:q});
  history.push({role:'assistant',content:cuerpo,modo:'manual',seccion:r.seccionDelTurno});
  saveChatHistory();
  scrollToBottom();
}

/* El agente lector (el modo IA con la IA al mando) vive en src/ia/agente.js:
   sus herramientas, los adaptadores de cada proveedor, el ciclo y la
   verificación de citas. Aquí queda lo que depende de la pantalla y de los
   manuales cargados: qué sección lee, si contesta él y su última traza. */
let ultimaTrazaAgente=null;     // qué hizo el agente en la última pregunta (lo lee eval/modo-ia.mjs)
let ultimasLaminasVistas=[];    // las láminas que el motor clásico mandó como imagen (también la lee eval/)

/* ── ¿Contesta el agente? ──
   Con sección activa (o un solo manual), con key y con el motor elegido. Lo
   que no es una duda del manual —saludo, fuera de tema, preguntas sobre la
   app, quién te creó— lo sigue contestando el camino de siempre, que ya lo
   resuelve bien y sin gastar vueltas. */
/* El agente lee UNA sección. Si el asesor no eligió ninguna, la que eligió la
   pregunta (`enrutarSeccion`): con treinta manuales cargados y el selector en
   «Todos», antes el agente no corría nunca. */
function seccionAgente(q){
  if(appState.manualActivo&&docs.some(d=>d.name===appState.manualActivo))return appState.manualActivo;
  if(docs.length===1)return docs[0].name;
  const r=q!=null?rutaDe(q):rutaActual;
  return r&&r.doc&&docs.some(d=>d.name===r.doc)?r.doc:null
}
function motorAgenteDisponible(q){
  if(appState.motor!=='agente'||!docChunks.length||!seccionAgente(q))return false;
  const prov=PROVIDERS[appState.provider];
  if(!prov||typeof prov.agente!=='function')return false;
  if(esPreguntaDeEstado(q)||isCreatorQuestion(q))return false;
  const scope=assessQuestionScope(q);
  return!scope.isGreeting&&!scope.clearlyOff
}

/* El agente con lo que tiene la app: la sección, el historial, las fichas, las
   imágenes de las páginas y el bucle de reintentos con sus avisos. */
async function ejecutarAgente({q,provider,key,model,signal,onDelta,onRonda,onEstado,onRetry,onRespaldo}){
  const doc=seccionAgente(q);
  if(!doc)throw new Error('sin sección para el agente');
  const{estado,conv,herramientas,anticipadas}=prepararAgente({q,doc,consulta:consultaDeBusqueda(q),
    historial:history,fichas:docFichas,paginas:docPaginas});
  onEstado&&onEstado(anticipadas.length?`Leyendo el manual · pág. ${anticipadas.join(', ')}`:'Ubicando en el manual…');
  return cicloAgente({estado,conv,herramientas,provider,key,model,temperature:appState.temperature,
    signal,onDelta,onRonda,onEstado,onRetry,onRespaldo,reintentos:conReintentos})
}

/* Lo que el agente dijo que leyó contra lo que de verdad leyó (camposDelAgente,
   verificarCitas): src/ia/agente.js. */

let avisoSinRed=false;
async function sendMessage(){
  if(isGenerating)return;
  /* Solo la key de ESTE proveedor. Caer a la genérica `ap_api_key` —la última
     guardada, fuera del proveedor que fuera— mandaba la key de OpenAI a Google:
     la petición fallaba y el secreto ya había salido hacia otra empresa. */
  try{appState.apiKey=sessionStorage.getItem('ap_api_key_'+appState.provider)||''}catch{}
  /* Sin señal, con API key o sin ella, contesta el manual tal cual: en el
     piso la red se cae, y un «error de red» a media duda no le sirve a nadie.
     El modo manual corre completo en el teléfono. */
  const sinRed=!navigator.onLine;
  rutaActual=null;
  if(sinRed||!appState.apiKey||appState.apiKey.length<10){
    if(sinRed&&appState.apiKey&&!avisoSinRed){
      avisoSinRed=true;
      showToast('📵 Sin señal: te contesto con el manual tal cual, sin modelo.','warn',4500);
    }
    const inputSinKey=document.getElementById('user-input');
    const qSinKey=inputSinKey.value.trim();
    if(!qSinKey)return;
    inputSinKey.value='';ajustarAltura(inputSinKey);vibrarCorto();
    responderSinModelo(qSinKey);
    return;
  }
  if(sessionTokens>=appState.tokenLimit){showToast('🔴 Límite de tokens alcanzado. Limpia el chat o reinicia el contador.','error',5000);return}
  const input=document.getElementById('user-input');
  const q=input.value.trim();if(!q)return;
  /* Primero, de qué sección es. Un empate no gasta la llamada: se pregunta. */
  const ruta=rutaDe(q);
  if(ruta.motivo==='empate'){
    input.value='';ajustarAltura(input);ocultarBannerRestaurar();switchTab('chat');
    appendMsg('user',q,false);preguntarSeccion(q,ruta.alternativas);
    return;
  }
  input.value='';ajustarAltura(input);isGenerating=true;chatDescartado=false;vibrarCorto();
  ocultarBannerRestaurar();

  const sendBtn=document.getElementById('send-btn');
  sendBtn.disabled=false;
  sendBtn.textContent='■ Detener';
  sendBtn.classList.add('stop-mode');
  sendBtn.onclick=stopGeneration;

  switchTab('chat');
  sessionTokens+=estimateTokens(q);updateTokenBar();
  appendMsg('user',q,false);
  const loaderEl=appendMsg('assistant','',true);
  const msgBody=loaderEl.querySelector('.msg-body');
  let streamedText='';
  let pendingSanitize=null;
  let context='';

  /* Mientras el modelo escribe sus seis etapas internas no se enseña nada: la
     respuesta sale hasta [RESPUESTA FINAL]. En pantalla quedaban tres puntitos
     quietos veinte o treinta segundos y parecía colgada. Ahora la tarjeta dice
     qué está pasando y cuánto lleva, y si el proveedor se queda callado
     ESPERA_MAX, se corta la espera en vez de esperar para siempre. */
  const nombreModelo=(PROVIDERS[appState.provider]?.name||'el modelo').replace(/^Google /,'');
  const modo=modoValido(appState.modoRespuesta);
  const inicio=Date.now();
  let ultimoDato=Date.now(),reintento=0,sinRespuesta=false,respaldo=null,esperaLimite=0,llegoCortada=false;
  ultimoErrorProveedor=null;
  /* Con el agente, la tarjeta dice lo que está haciendo: qué página lee, qué
     lámina mira, qué busca. Es la misma espera, pero se ve el trabajo. */
  let estadoAgente='';
  const pintarEspera=()=>{
    if(!loaderEl.classList.contains('loading'))return;
    let caja=msgBody.querySelector('.espera');
    if(!caja){
      msgBody.innerHTML='<span class="espera" role="status"><span class="espera-puntos" aria-hidden="true"><span class="typing-dot">•</span><span class="typing-dot">•</span><span class="typing-dot">•</span></span><span class="espera-txt"></span><span class="espera-seg"></span></span>';
      caja=msgBody.querySelector('.espera');
    }
    const etapas=[...streamedText.matchAll(/ETAPA\s+(\d)/gi)];
    const etapa=etapas.length?etapas[etapas.length-1][1]:null;
    const lectura=modo==='rapido'?lecturaDe(streamedText,true):null;
    const modeloVivo=respaldo?respaldo.a:appState.chatModel;
    caja.querySelector('.espera-txt').textContent=
      esperaLimite>Date.now()&&!streamedText?`Límite por minuto de ${nombreModelo} · sigo en ${Math.ceil((esperaLimite-Date.now())/1000)} s`
      :llegoCortada&&!streamedText?'La respuesta llegó cortada · la pido otra vez'
      :reintento&&!streamedText?`${nombreModelo} ${nombreCortoDeModelo(modeloVivo)} está saturado · reintento ${reintento} de ${RETRY_DELAYS.length}`
      :respaldo&&!streamedText?`${nombreCortoDeModelo(respaldo.de)} saturado · contesta ${nombreCortoDeModelo(respaldo.a)}`
      :estadoAgente?estadoAgente
      :lectura?(/^no\s+est/i.test(lectura)?'No aparece en el manual · redactando':`Leyendo ${lectura}`)
      :etapa?`Razonando con el manual · etapa ${etapa} de 6`
      :streamedText?(modo==='rapido'?'Leyendo el manual…':'Razonando con el manual…')
      :`Esperando a ${nombreModelo}…`;
    caja.querySelector('.espera-seg').textContent=Math.round((Date.now()-inicio)/1000)+' s';
  };
  const reloj=setInterval(()=>{
    if(!sinRespuesta&&Date.now()-ultimoDato>ESPERA_MAX&&currentAbort){sinRespuesta=true;currentAbort.abort()}
    pintarEspera();
  },1000);
  pintarEspera();

  const renderChunk=(chunk)=>{
    streamedText+=chunk;
    ultimoDato=Date.now();
    if(pendingSanitize)clearTimeout(pendingSanitize);
    pendingSanitize=setTimeout(()=>{
      const visible=getStreamingDisplayText(streamedText);
      if(visible!==null){
        loaderEl.classList.remove('loading');
        msgBody.innerHTML=safeMarkdown(visible);
      }else{
        if(!loaderEl.classList.contains('loading')){loaderEl.classList.add('loading');msgBody.innerHTML=''}
        pintarEspera();
      }
      scrollToBottom();
    },180);
  };

  /* Todo lo que viene después va dentro del try. Antes armar el contexto corría
     fuera: si cualquier función de ahí fallaba, isGenerating se quedaba en true
     y el botón en «■ Detener» —con currentAbort aún vacío, así que pulsarlo no
     hacía nada— hasta recargar la página. */
  try{
  /* El agente contesta primero si le toca. Si falla por cualquier cosa que no
     sea «detener» o el silencio del proveedor, la misma pregunta sigue por el
     motor clásico: el asesor recibe respuesta, no un error del agente. */
  ultimaTrazaAgente=null;ultimasLaminasVistas=[];
  if(motorAgenteDisponible(q)){
    currentAbort=new AbortController();
    try{
      const r=await ejecutarAgente({q,provider:PROVIDERS[appState.provider],key:appState.apiKey,model:appState.chatModel,
        signal:currentAbort.signal,
        onDelta:t=>{if(!streamedText)estadoAgente='Escribiendo la respuesta con lo que leyó…';renderChunk(t)},
        onRonda:()=>{streamedText='';if(pendingSanitize)clearTimeout(pendingSanitize);ultimoDato=Date.now()},
        onEstado:t=>{estadoAgente=t;ultimoDato=Date.now();pintarEspera()},
        onRetry:(ms,clase)=>{streamedText='';if(pendingSanitize)clearTimeout(pendingSanitize);if(clase==='limite-minuto'){esperaLimite=Date.now()+ms}else reintento++;ultimoDato=Date.now()+(ms||RETRY_DELAYS[reintento-1]||0);pintarEspera()},
        onRespaldo:(de,a)=>{streamedText='';if(pendingSanitize)clearTimeout(pendingSanitize);respaldo={de,a};reintento=0;ultimoDato=Date.now();pintarEspera()}});
      if(chatDescartado)return;
      if(pendingSanitize)clearTimeout(pendingSanitize);
      context=r.contexto;
      const final=presentarRespuestaAgente(loaderEl,r,q);
      sessionTokens+=r.estado.tokens||estimateTokens(r.texto);updateTokenBar();
      history.push({role:'user',content:q});
      history.push({role:'assistant',content:final.texto,entendi:final.entendi,seccion:r.estado.doc});
      renderSourceIndicator(loaderEl.querySelector('.msg-footer'),q,context,aprendidoEn(q,r.estado&&r.estado.doc),true,false);
      botonesDeRutaAlterna(loaderEl,q);
      return;
    }catch(err){
      if(err.name==='AbortError'||chatDescartado)throw err;
      /* Sin cuota o sin key, el clásico tampoco va a poder: se dice una vez. */
      if(err.clase==='cuota-dia'||err.clase==='key')throw err;
      console.warn('agente → motor clásico',err);
      ultimaTrazaAgente={motor:'clasico',fallo:String(err.message||err).slice(0,200)};
      if(pendingSanitize)clearTimeout(pendingSanitize);
      streamedText='';estadoAgente='';reintento=0;
      loaderEl.classList.add('loading');msgBody.innerHTML='';pintarEspera();
    }
  }
  const ctx=buildContext(q);
  context=ctx.texto;
  /* El modo de respuesta (Ajustes) cambia las seis etapas por un paso de
     lectura en el motor clásico; el agente lector tiene su propio guion. */
  const system=promptDelModo(appState.system||document.getElementById('system-prompt').value.trim(),modo);
  const hasPdfs=docChunks.length>0;
  const scope=assessQuestionScope(q);
  /* La identidad sale del manual, no de una constante: delante de un manual de
     Bebés el asistente se presentaba como especialista de Hombres. */
  const seccion=seccionActiva();
  const quienEres=seccion
    ?`\n\nQUIÉN ERES EN ESTA CONSULTA: el especialista en Visual Merchandising de la sección **${seccion}**, que es la del manual cargado. Habla de esa sección y de ninguna otra.`
    :'';
  const sourceNotice=hasPdfs
    ?quienEres+'\n\n⚠ FUENTE ÚNICA: El PDF que el asesor cargó es el manual que se está ejecutando hoy en ese piso, y es la ÚNICA fuente de esta respuesta. No hay otra en el contexto: no completes con reglas generales de Mercadep ni con conocimiento de visual merchandising. Si el PDF no lo trae, la respuesta es "El manual no especifica [X]" — el asesor tiene un botón para consultar aparte la referencia general. Revisa TODO el contexto antes de decidir que algo "no está". Cada fragmento viene rotulado [documento · pág. N · sección]: cita la página de todo dato que tomes.'
    :'\n\n⚠ FUENTES DISPONIBLES: Solo hay manual interno Mercadep disponible. REVÍSALO para responder.';
  const fullSystem=system+GUARDRAIL_APPEND+REGLA_DATO()+sourceNotice;
  const messages=[{role:'system',content:fullSystem}];
  /* El historial va ANTES del contexto y se queda en tres intercambios. Con
     catorce mensajes después del contexto, las cifras de respuestas anteriores
     quedaban más cerca de la pregunta que la evidencia de esta, y volvían a
     salir en una respuesta que el contexto actual ya no sostiene. Lo último que
     el modelo lee antes de contestar es el manual y la pregunta. */
  messages.push(...historialParaModelo(history,6));
  /* Las láminas del contexto que casi no tienen texto (son una imagen) van
     también como imagen: src/ia/laminas.js. */
  const laminas=context&&!ctx.estado?laminasParaVer((ultimosFragmentos||[]).filter(c=>c.source==='pdf'),docChunks,
    (d,n)=>((docPaginas.get(d)||[]).find(p=>p.page===n)||{}).imagen,{deMarcas:basicoDe(q)==='marcas'}):[];
  if(context)messages.push({role:'user',content:'[CONTEXTO — DOCUMENTACIÓN DISPONIBLE]\n\nRevisa este contexto antes de responder. Toda tu respuesta debe basarse ÚNICAMENTE en esta información:\n\n'+context+notaDeLaminas(laminas),
    imagenes:laminas.map(l=>({page:l.page,dataUrl:l.dataUrl}))});
  ultimasLaminasVistas=laminas.map(l=>({doc:l.doc,page:l.page}));
  let userContent=q;
  if(scope.isGreeting){
    userContent+='\n\n[NOTA DEL SISTEMA: El usuario solo saluda. Responde amable en 1-2 oraciones invitándolo a preguntar sobre la sección del manual cargado. NO uses la redirección de fuera de tema.]';
  }else if(scope.clearlyOff&&!isCreatorQuestion(q)){
    userContent+=`\n\n[NOTA DEL SISTEMA: Esta pregunta parece fuera del dominio de visual merchandising. Responde con la redirección corta, sin ${modo==='rapido'?'LECTURA':'formato de 6 etapas'}.]`;
  }else if(scope.otherStore){
    userContent+='\n\n[NOTA DEL SISTEMA: Menciona otra tienda. Aclara que solo conoces manuales Mercadep; si la pregunta incluye un producto VM (corbata, sensor, etc.), responde la regla de Mercadep del contexto.]';
  }else if(scope.isVmQuestion){
    userContent+=modo==='rapido'
      ?'\n\n[NOTA DEL SISTEMA: Pregunta válida de visual merchandising. Empieza con la LECTURA y basa la respuesta en el contexto. Si hay conflicto documentado, cítalo — no digas "no especifica".]'
      :'\n\n[NOTA DEL SISTEMA: Pregunta válida de visual merchandising. Usa el formato de 6 etapas y basa la respuesta en el contexto. Si hay conflicto documentado, cítalo — no digas "no especifica".]';
  }
  if(ctx.estado){
    userContent+=`\n\n[NOTA DEL SISTEMA: Esto es una pregunta sobre la app o sobre el manual en sí. Responde con el bloque ESTADO DE LA APP, breve y sin ${modo==='rapido'?'LECTURA':'el formato de 6 etapas'}. No cites páginas.]`;
  }else if(ctx.sinCoincidencias){
    userContent+='\n\n[NOTA DEL SISTEMA: La búsqueda no encontró ni un fragmento que coincida con esta pregunta. Responde "El manual no especifica [X]" y cierra con CERTEZA: GAP. No improvises una regla.]';
  }else if(ctx.flojo){
    userContent+='\n\n[NOTA DEL SISTEMA: La coincidencia con el manual es débil. Si los fragmentos no responden exactamente lo que se preguntó, dilo con "El manual no especifica [X]" y CERTEZA: GAP en vez de estirar uno parecido.]';
  }
  messages.push({role:'user',content:userContent});

  currentAbort=new AbortController();


    const provider=PROVIDERS[appState.provider];
    const streamParams={
      key:appState.apiKey,
      messages,
      model:appState.chatModel,
      /* Margen para las seis etapas visibles. Subir esto NO era el arreglo del
         corte de respuesta —medido: con 8000 se seguía cortando—; eso se
         resuelve apagando el pensamiento interno del proveedor. */
      maxTokens:6000,
      temperature:appState.temperature,
      onDelta:renderChunk,
      /* Un corte a media respuesta se reintenta desde cero, pero el texto del
         intento fallido seguía en streamedText: la respuesta salía con media
         copia pegada delante. */
      onRetry:(ms,clase)=>{
        streamedText='';if(pendingSanitize)clearTimeout(pendingSanitize);
        if(clase==='limite-minuto')esperaLimite=Date.now()+ms;else reintento++;
        ultimoDato=Date.now()+(ms||RETRY_DELAYS[reintento-1]||0);pintarEspera();
      },
      /* El elegido salió saturado y contesta otro: la tarjeta lo dice y los
         reintentos vuelven a contar desde cero con el nuevo. */
      onRespaldo:(de,a)=>{
        streamedText='';if(pendingSanitize)clearTimeout(pendingSanitize);
        respaldo={de,a};reintento=0;ultimoDato=Date.now();pintarEspera();
      },
      signal:currentAbort.signal
    };
    let recibido;
    try{recibido=await callWithRetryStream(provider,streamParams)}
    catch(err){
      /* Un modelo que no acepta imágenes contesta 400: la misma pregunta va
         sin las láminas, con el texto de siempre. */
      if(err.name==='AbortError'||err.status!==400||!laminas.length)throw err;
      for(const m of messages)delete m.imagenes;
      laminas.length=0;ultimasLaminasVistas=[];
      streamedText='';if(pendingSanitize)clearTimeout(pendingSanitize);
      recibido=await callWithRetryStream(provider,streamParams);
    }
    if(chatDescartado)return;
    /* A veces llega el razonamiento sin la contestación, con el proveedor
       diciendo que terminó bien. Medido con el demo: 2 de 18 respuestas de 3.8
       Flash. Antes de enseñarle al asesor el aviso de «se cortó», se pide una
       vez más; casi siempre la segunda llega entera. */
    if(debeRepetirPorCorte(streamedText,llegoCortada)){
      llegoCortada=true;
      streamedText='';if(pendingSanitize)clearTimeout(pendingSanitize);
      ultimoDato=Date.now();pintarEspera();
      recibido=await callWithRetryStream(provider,streamParams);
      if(chatDescartado)return;
    }
    const{tokens,model:contesto}=recibido;

    // Forzar render final completo
    if(pendingSanitize){clearTimeout(pendingSanitize);}
    renderAssistantMessage(loaderEl,streamedText,tokens||estimateTokens(streamedText),q,context,laminas);
    marcarModelo(loaderEl,contesto,!!respaldo);

    sessionTokens+=tokens||estimateTokens(streamedText);updateTokenBar();
    history.push({role:'user',content:q});
    const{final}=parseAIResponse(streamedText);
    history.push({role:'assistant',content:sanitizeFinalAnswer(final,q),seccion:ctx.seccionUsada||null});
    renderSourceIndicator(loaderEl.querySelector('.msg-footer'),q,context,aprendidoEn(consultaDeBusqueda(q),ctx.seccionUsada||null),hasPdfs,ctx.ampliada);
    botonesDeRutaAlterna(loaderEl,q);
    {
      const doc=ctx.seccionUsada||null;
      anotarBasico(doc,q);
      const pags=[...new Set([...final.matchAll(/p[áa]g\.?\s*(\d+)/gi)].map(m=>Number(m[1])))];
      const fila=doc&&pags.length&&!/no especifica|no est[áa] en el manual/i.test(final)?filaSigue(doc,pags,q):null;
      if(fila)loaderEl.insertBefore(fila,loaderEl.querySelector('.msg-footer'));
    }
  }catch(err){
    if(pendingSanitize)clearTimeout(pendingSanitize);
    if(chatDescartado){loaderEl.remove();return}
    if(err.name==='AbortError'&&sinRespuesta){
      const parcial=getStreamingDisplayText(streamedText);
      if(parcial&&parcial.trim().length>50){
        renderAssistantMessage(loaderEl,streamedText+`\n\n_[${nombreModelo} dejó de mandar texto; la respuesta puede estar incompleta]_`,estimateTokens(streamedText),q,context,laminas);
      }else{
        loaderEl.classList.remove('loading');
        msgBody.style.color='var(--amber)';
        msgBody.innerHTML=safeMarkdown(`**${nombreModelo} no mandó nada en ${ESPERA_MAX/1000} s**, así que corté la espera. Puede ser la señal o que el servicio esté lento. Vuelve a preguntar, prueba otro modelo arriba del chat, o quita la clave en Ajustes y te contesto con el manual tal cual.`);
      }
    }else if(err.name==='AbortError'){
      if(streamedText.length>50){
        renderAssistantMessage(loaderEl,streamedText+'\n\n_[Generación detenida por el usuario]_',estimateTokens(streamedText),q,context,laminas);
        history.push({role:'user',content:q});
        const{final}=parseAIResponse(streamedText);
        history.push({role:'assistant',content:sanitizeFinalAnswer(final,q)+'\n\n_[Generación detenida por el usuario]_'});
      } else {
        loaderEl.remove();
      }
    } else {
      ultimoErrorProveedor=err;
      if(err.clase)loaderEl.dataset.claseError=err.clase;
      loaderEl.classList.remove('loading');
      msgBody.style.color='var(--amber)';
      msgBody.innerHTML=safeMarkdown(formatError(err));
    }
  }finally{
    clearInterval(reloj);
    saveChatHistory();
    isGenerating=false;chatDescartado=false;currentAbort=null;
    sendBtn.disabled=false;
    sendBtn.textContent='Enviar';
    sendBtn.classList.remove('stop-mode');
    sendBtn.onclick=sendMessage;
    scrollToBottom();
  }
}
function renderQuickEditor(){
  const list=document.getElementById('quick-editor-list');
  if(!quickBtns.length){list.innerHTML='<p style="font-size:11px;color:var(--text3);padding:6px 0">No hay accesos configurados.</p>';return}
  list.innerHTML=quickBtns.map((b,i)=>`
    <div class="quick-editor-item">
      <span class="quick-editor-label">${escapeHtml(b.label)}</span>
      <button class="quick-editor-remove" onclick="removeQuick(${i})">✕</button>
    </div>`).join('')
}
/* Los accesos rápidos de fábrica son de Hombres —«Entallado Hombres», «MarcaDemoB
   en POS»—: con un manual de Bebés o de Muebles cargado no llevan a ninguna
   parte, y un botón que no lleva a ninguna parte es lo que hace que una
   herramienta parezca rota en el piso. Los del manual se sacan de sus propios
   rótulos de lámina, se marcan aparte y no tocan los que el asesor configuró. */
const QUICK_DEL_MANUAL=6;
function accesosDelManual(){
  if(!docChunks.length)return[];
  /* Con la ficha, los accesos son preguntas de verdad —las que la IA vio que
     contesta cada lámina, dichas como en el piso—, una por lámina, en el orden
     del manual. Sin ficha, los títulos de lámina, como siempre. */
  const deFicha=preguntasDeFicha(appState.manualActivo||(docs.length===1?docs[0].name:null));
  if(deFicha.length)return deFicha;
  const activos=appState.manualActivo?docChunks.filter(c=>c.docName===appState.manualActivo):docChunks;
  const cuenta=new Map();
  for(const c of activos){
    const h=(c.heading||'').trim();
    /* Rótulos que son una sección de verdad: ni códigos, ni listas de marcas. */
    if(h.length<5||h.length>34||/^\d|:$/.test(h))continue;
    cuenta.set(h,(cuenta.get(h)||0)+1);
  }
  return[...cuenta.entries()].sort((a,b)=>b[1]-a[1]).slice(0,QUICK_DEL_MANUAL)
    .map(([h])=>({label:h.charAt(0)+h.slice(1).toLowerCase(),q:`¿Qué dice el manual sobre ${h.toLowerCase()}?`}))
}
/* Los accesos con la ruta de los básicos delante: los que el manual trae, en
   el orden en que se pregunta en el piso, y después los de siempre. */
function accesosConBasicos(){
  const base=accesosDelManual();
  const doc=appState.manualActivo||(docs.length===1?docs[0].name:null);
  if(!doc||!docChunks.length)return base;
  const cubiertos=coberturaDeBasicos(doc);
  const deBasicos=BASICOS.filter(b=>cubiertos.has(b.id)).slice(0,Math.ceil(QUICK_DEL_MANUAL/2))
    .map(b=>({label:b.nombre,q:b.pregunta}));
  return[...deBasicos,...base].slice(0,QUICK_DEL_MANUAL)
}
function preguntasDeFicha(docName){
  const f=docName&&docFichas.get(docName);
  if(!f)return[];
  const out=[],vistas=new Set();
  for(const n of Object.keys(f.paginas).map(Number).sort((a,b)=>a-b)){
    const p=(f.paginas[n].preguntas||[])[0];
    if(!p)continue;
    const k=normalizeText(p).replace(/\s+/g,' ').trim();
    if(vistas.has(k))continue;
    vistas.add(k);
    let corta=p.replace(/^¿\s*/,'').replace(/\?\s*$/,'');
    corta=corta.charAt(0).toUpperCase()+corta.slice(1);
    out.push({label:corta.length>34?corta.slice(0,32).trim()+'…':corta,q:p});
    if(out.length>=QUICK_DEL_MANUAL)break;
  }
  return out
}
function renderQuickBtns(){
  const c=document.getElementById('quick-btns');if(!c)return;
  c.innerHTML='';
  const pinta=(b,cls)=>{
    const btn=document.createElement('button');
    btn.className='quick-btn'+(cls?' '+cls:'');
    btn.textContent=b.label;
    btn.addEventListener('click',()=>ask(b.q));
    c.appendChild(btn);
  };
  const delManual=accesosConBasicos();
  for(const b of delManual)pinta(b,'del-manual');
  /* Con un manual cargado, los accesos de fábrica —«MarcaDemoB en POS»,
     «Entallado Hombres»— son del manual de demostración, no del suyo: se
     quedan solo si el asesor los personalizó. */
  const deFabrica=JSON.stringify(quickBtns)===JSON.stringify(DEFAULT_QUICK);
  if(!(delManual.length&&deFabrica))quickBtns.forEach(b=>pinta(b));
  renderChatVacio();
}

/* ── ESTADO VACÍO ─────────────────────────────────
   Es lo primero que ve quien abre el link: antes era «Arrastra los manuales
   aquí», una zona para soltar PDFs que en el celular ni se puede usar así. Ahora
   son preguntas que se tocan, y cada una enseña algo que el asistente hace
   distinto: cita, entiende la forma de hablar del piso, aguanta la errata y
   dice «no sé». */
const EJEMPLOS_DEMO=[
  {q:'¿a qué altura va el sensor en el pantalón?',nota:'Te dice la regla y de qué manual sale'},
  {q:'¿cuánto espacio dejo para que pase la gente?',nota:'Aunque no uses la palabra del manual («pasillo»)'},
  {q:'entayado de hombres',nota:'Con falta de ortografía, también'},
  {q:'¿a qué hora abre la tienda?',nota:'Y si el manual no lo dice, te lo dice'},
];
/* El aviso de instalación del navegador; lo usa el estado vacío (ver SIN SEÑAL E INSTALABLE). */
let instalacion=null;
function enModoApp(){return window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true}
function renderChatVacio(){
  const el=document.getElementById('chat-empty');if(!el)return;
  const seccion=seccionActiva();
  const conPdf=docChunks.length>0;
  const paginas=conPdf?new Set(docChunks.filter(c=>!appState.manualActivo||c.docName===appState.manualActivo).map(c=>c.docName+'#'+c.page)).size:0;
  const ejemplos=conPdf
    ?accesosConBasicos().slice(0,3).map(a=>({q:a.q,nota:'Una lámina de tu manual'})).concat([{q:'¿a qué hora abre la tienda?',nota:'Si el manual no lo dice, te lo dice'}])
    :EJEMPLOS_DEMO;
  el.innerHTML=PLIEGUES;
  const t=document.createElement('div');t.className='vacio-titulo';
  t.textContent=conPdf?(seccion?`Estás en ${seccion}`:`${docs.length} manuales cargados`):'Pregunta como lo dirías en piso';
  const s=document.createElement('div');s.className='vacio-sub';
  s.textContent=conPdf
    ?`${paginas} páginas de tu manual, en tu teléfono. Cada respuesta dice de qué página sale.`
    :'Te contesta con el manual y te dice de dónde sale el dato. Si el manual no lo dice, no inventa.';
  const lista=document.createElement('div');lista.className='vacio-ejemplos';
  for(const e of ejemplos){
    const b=document.createElement('button');b.className='vacio-ej';b.type='button';
    b.textContent=e.q;
    const n=document.createElement('small');n.textContent=e.nota;b.appendChild(n);
    b.onclick=()=>ask(e.q);
    lista.appendChild(b);
  }
  const nota=document.createElement('div');nota.className='vacio-nota';
  let demo=null;
  if(!conPdf){
    demo=document.createElement('button');demo.className='vacio-demo';demo.type='button';
    demo.textContent='Probar con un manual de ejemplo';
    const d=document.createElement('small');d.textContent='Un PDF de 8 láminas: lo lee aquí mismo y te enseña la lámina de cada respuesta';
    demo.appendChild(d);
    demo.onclick=()=>cargarManualDeEjemplo(demo);
    nota.append('Todo en esta demo es inventado: cliente, marcas y medidas. ');
    const a=document.createElement('button');a.className='vacio-link';a.type='button';
    a.textContent='Carga el tuyo en PDF';a.onclick=()=>switchTab('docs');
    nota.append(a,': se lee aquí mismo, sin subirlo a ningún lado.');
  }else{
    nota.textContent='Nada de esto sale de tu teléfono.';
  }
  el.append(t,s);
  if(demo)el.append(demo);
  el.append(lista,nota);
  if(instalacion&&!enModoApp()){
    const ins=document.createElement('button');ins.className='vacio-link vacio-instalar';ins.type='button';
    ins.textContent='📲 Instálala en tu celular: se abre desde su ícono y contesta sin señal';
    ins.onclick=instalarApp;
    el.append(ins);
  }
}

/* ── MANUAL DE EJEMPLO ────────────────────────────
   Sin un PDF la demo no enseña lo más importante —que lee el manual de verdad,
   detecta la sección y pone la lámina junto a la respuesta—, y para verlo había
   que tener a mano un manual de campaña. Este es sintético (docs/manual-demo/)
   y pasa por el mismo camino que uno del asesor: se procesa en el teléfono, se
   guarda en el dispositivo y se puede quitar como cualquier otro. */
async function cargarManualDeEjemplo(btn){
  const rotulo=btn?btn.firstChild.textContent:'';
  if(btn){btn.disabled=true;btn.firstChild.textContent='Abriendo el manual de ejemplo…'}
  try{
    const r=await fetch('docs/manual-demo.pdf');
    if(!r.ok)throw new Error('HTTP '+r.status);
    const blob=await r.blob();
    await handleFiles([new File([blob],'140 CASUAL HOMBRE.pdf',{type:'application/pdf'})]);
    switchTab('chat');
  }catch(e){
    console.warn('manual de ejemplo',e);
    showToast('No se pudo abrir el manual de ejemplo. Revisa la conexión y vuelve a intentarlo.','error',5000);
    if(btn&&btn.isConnected){btn.disabled=false;btn.firstChild.textContent=rotulo}
  }
}
function toggleQuickEdit(){
  editingQuick=!editingQuick;
  document.getElementById('quick-editor').style.display=editingQuick?'block':'none';
  if(editingQuick)renderQuickEditor();
  document.querySelector('.quick-edit-btn').textContent=editingQuick?'✕ Cerrar':'✏ Editar';
}
function removeQuick(i){quickBtns.splice(i,1);try{localStorage.setItem('ap_quick',JSON.stringify(quickBtns))}catch{}renderQuickBtns();renderQuickEditor()}
function addQuick(){
  const label=document.getElementById('new-quick-label').value.trim();
  const q=document.getElementById('new-quick-q').value.trim();
  if(!label||!q){showToast('Ingresa el nombre y la pregunta.','warn',3000);return}
  quickBtns.push({label,q});
  try{localStorage.setItem('ap_quick',JSON.stringify(quickBtns))}catch{}
  document.getElementById('new-quick-label').value='';document.getElementById('new-quick-q').value='';
  renderQuickBtns();renderQuickEditor();
}

/* ════════════════════════════════════════════════
   CHAT UI
════════════════════════════════════════════════ */
function handleKey(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage()}}
function scrollToBottom(){const b=document.getElementById('chat-messages');b.scrollTop=b.scrollHeight}
/* Limpiar tenía tres agujeros. No detenía la respuesta en curso, que al terminar
   volvía a meter la pregunta vieja en el historial «limpio» —y de ahí a la
   siguiente consulta y a la exportación—. No reiniciaba el contador, aunque el
   aviso de límite dice justamente «limpia el chat». Y borraba todo de un toque,
   con el botón pegado al de exportar. */
function clearChat(){
  if(history.length&&!confirm('¿Borrar toda la conversación?'))return;
  if(isGenerating&&currentAbort){chatDescartado=true;currentAbort.abort()}
  sessionTokens=0;updateTokenBar();
  history=[];
  document.getElementById('chat-messages').innerHTML=`<div class="chat-empty" id="chat-empty"></div>`;
  renderChatVacio();
  saveChatHistory();
  showToast('🗑️ Chat limpiado', 'success', 2000);
}
function exportChat(){
  if(!history.length){showToast('No hay conversación para exportar.','warn',3000);return}
  const date=new Date().toLocaleString('es-MX',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
  const seccion=seccionActiva();
  const lines=[`# Asistente de piso`,``,`**Fecha:** ${date}`,...(seccion?[`**Sección:** ${seccion}`]:[]),``,`---`,``];
  history.forEach(m=>{
    lines.push(`## ${m.role==='user'?'Tú':'Asistente'}`);
    lines.push(``);
    lines.push(m.content);
    lines.push(``);
  });
  const blob=new Blob([lines.join('\n')],{type:'text/markdown;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=`asistente-piso-${Date.now()}.md`;
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  showToast('⬇ Conversación exportada a Markdown', 'success', 2500);
}
/* Mientras se genera, sendMessage se va sin hacer nada: el acceso rápido
   pisaba lo que el asesor llevaba escrito y no pasaba nada, sin decir por qué. */
function ask(q){
  if(isGenerating){showToast('Espera a que termine la respuesta, o pulsa ■ Detener.','warn',2500);return}
  document.getElementById('user-input').value=q;switchTab('chat');sendMessage()
}

function hasKey(prov){try{return!!(sessionStorage.getItem('ap_api_key_'+prov)||'').length}catch{return false}}

/* ════════════════════════════════════════════════
   API EXPERTA — Selector de modelo por rol
   v7.0 paso 3
════════════════════════════════════════════════ */
function switchExpert(btn){
  const provider=btn.dataset.provider;
  const model=btn.dataset.model;

  if(!hasKey(provider)){
    showToast('⚠ Configura tu API key de '+provider+' primero','warn',4000);
    return;
  }

  document.querySelectorAll('.api-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');

  /* Si el modelo guardado en Ajustes es de este proveedor, se respeta: el botón
     elige proveedor, no pisa el 3.6 o el 3.8 que el asesor escogió. */
  let guardado=null;try{guardado=localStorage.getItem('ap_chat_model')}catch{}
  const elegido=PROVIDERS[provider].chatModels.includes(guardado)?guardado:model;
  appState.provider=provider;
  appState.chatModel=elegido;

  // Sincronizar selector visual de Ajustes para que saveConfig no sobreescriba
  const provBtns=document.querySelectorAll('.prov-tab');
  provBtns.forEach((t,i)=>t.classList.toggle('active',PROV_ORDEN[i]===provider));
  document.getElementById('prov-info').innerHTML=PROV_INFO[provider];
  document.getElementById('api-key-input').placeholder=PROVIDERS[provider].placeholder;
  const chatSel=document.getElementById('chat-model-select');
  chatSel.innerHTML=PROVIDERS[provider].chatModels.map(m=>`<option value="${m}">${etiquetaDeModelo(m)}</option>`).join('');
  chatSel.value=elegido;
  /* El campo de la key también cambia de proveedor. Si se quedaba la del
     anterior, «Guardar cambios» la escribía encima de la buena del nuevo. */
  try{
    const k=sessionStorage.getItem('ap_api_key_'+provider)||'';
    document.getElementById('api-key-input').value=k;appState.apiKey=k;updateKeyStatus(k);
  }catch{}

  showToast(`${PROVIDERS[provider].name.replace(/^Google /,'')} · ${nombreCortoDeModelo(elegido)}`,'success',2000);
}

function syncExpertSelector(){
  const btns=document.querySelectorAll('.api-btn');
  btns.forEach(b=>{
    const prov=b.dataset.provider;
    b.classList.toggle('active',b.dataset.provider===appState.provider);
    b.classList.toggle('locked',!hasKey(prov));
  });
}
function appendMsg(role,text,loading){
  const box=document.getElementById('chat-messages');
  const empty=document.getElementById('chat-empty');if(empty)empty.remove();
  const div=document.createElement('div');div.className='msg '+role+(loading?' loading':'');
  let body='';
  if(loading)body=`<span class="typing-dot">•</span><span class="typing-dot">•</span><span class="typing-dot">•</span>`;
  else if(role==='user')body=escapeHtml(text);
  else body=safeMarkdown(text);
  const tk=role==='user'?`<span class="msg-tokens">~${estimateTokens(text).toLocaleString('es-MX')} tk</span>`:'';
  div.innerHTML=`<div class="msg-label">${role==='user'?'Tú':'Asistente'} ${tk}</div><div class="msg-body">${body}</div>`;
  box.appendChild(div);scrollToBottom();return div
}

/* ════════════════════════════════════════════════
   RENDER RESPUESTA ASISTENTE
════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════
   EVIDENCIA VISUAL

   La figura que acompaña a la respuesta sale de los mismos fragmentos
   que se consultaron: misma página, y misma sección cuando la hay. No
   se ilustra "algo bonito de ese manual" — se enseña la lámina de la
   que salió el dato, que es lo que el asesor puede ir a contrastar.
════════════════════════════════════════════════ */
const MAX_EVIDENCIA=3;

/* La tira de evidencia se armaba con TODOS los fragmentos que entraron al
   contexto —41 en una pregunta normal—, así que acompañaba la respuesta con
   láminas de páginas que la respuesta ni miró. El caso que lo destapó: a
   «¿a qué temperatura debe estar la sección?» el modelo contestó bien que el
   manual no lo especifica, y debajo salieron dos láminas igual. La imagen
   afirmaba que el dato salía de ahí, y no salía de ningún lado.

   Ahora manda lo que la respuesta CITÓ. Sin cita, ninguna imagen: enseñar una
   lámina que no sostiene lo que se lee es peor que no enseñar nada, porque el
   asesor cree la foto antes que el texto.

   `citas` son las páginas que citó el modelo. En modo sin API se pasa null: ahí
   los fragmentos se enseñan enteros en pantalla, así que su página es
   literalmente de dónde sale lo que se está leyendo. */
/* Una respuesta que admite que no sabe no puede venir acompañada de una lámina:
   la imagen afirma que el dato sale de ahí, y no sale de ningún lado. Es el bug
   que destapó todo esto y vuelve por la puerta de atrás en cuanto se permite
   enseñar lámina sin cita, así que se comprueba explícitamente. */
const SIN_DATO=/no\s+(?:lo\s+)?especifica|no\s+(?:lo\s+)?encontr|no\s+(?:est[áa]|aparece|figura)\s+en\s+(?:el|los)\s+manual|no\s+hay\s+(?:regla|dato|informaci[óo]n)/i;
/* Solo cuenta si la respuesta ABRE diciendo que no está. «Las marcas de
   CONTEMPO son Tommy y Guess (pág. 13); el manual no especifica en qué mueble
   van» trae el dato, y esconder la lámina por la segunda mitad dejaba al asesor
   sin la tabla de la que sale la primera. */
function esRespuestaSinDato(respuesta,certeza){
  if(certeza==='GAP')return true;
  const primera=(respuesta||'').trim().split(/(?<=[.!?])\s/)[0]||'';
  return SIN_DATO.test(primera)
}

function figurasDeFragmentos(chunks,citas,respuesta,certeza){
  if(!docFigures.length||!chunks||!chunks.length)return[];
  if(esRespuestaSinDato(respuesta,certeza))return[];

  /* Sin modelo no hay cita, y la lámina se sacaba de TODAS las tarjetas: a
     «¿a qué altura va el sensor?» la acompañaba el planograma de la mesa de
     entrada, que venía en la tercera tarjeta por un «altura máxima de pila», y
     no la del pantalón de la primera. Manda la tarjeta mejor puntuada, que es
     la que el asesor lee primero; si su página no trae lámina, no se enseña
     ninguna en vez de la de una coincidencia floja. */
  const sinModelo=citas===null;
  if(citas===null){
    const primera=chunks.find(c=>c.source==='pdf'&&c.page);
    if(!primera)return[];
    chunks=[primera];
  }

  /* Que el modelo no escribiera "(pág. N)" no significa que la respuesta no
     tenga de dónde salir: significa que se saltó el formato. Antes eso dejaba
     al asesor sin ninguna lámina —la falla más visible de esta función—, así
     que se cae al fragmento mejor puntuado de los que SÍ se consultaron, y el
     pie de la tira cambia para no prometer una cita que no existe. */
  let porCita=true;
  if(citas&&!citas.size){
    /* Con varios manuales cargados, el mejor fragmento suelto puede ser de un
       manual que apenas aportó nada a la respuesta: medido, «¿qué marcas van en
       casual caballero?» acababa enseñando la lámina de MARCAS del manual de
       Mujer. Manda el documento que MÁS fragmentos puso, y dentro de él el
       mejor puntuado —que es el primero, porque llegan ordenados. */
    const porDoc=new Map();
    for(const c of chunks)if(c.source==='pdf'&&c.page)porDoc.set(c.docName,(porDoc.get(c.docName)||0)+1);
    if(!porDoc.size)return[];
    /* Sin sección activa y con varias en el contexto, "el que más aportó" no
       significa nada: medido, «¿qué porcentaje es el cliente práctico?» trae
       cinco cifras verdaderas y distintas —44%, 38.5%, 39.3%, 35.3%, 43.8%— una
       por sección, y la lámina salía siempre de MUJER CLÁSICA. Una imagen que
       dice "de aquí sale el dato" cuando hay cinco datos es una afirmación
       falsa, así que sin cita explícita no se enseña ninguna. */
    if(!appState.manualActivo&&porDoc.size>1)return[];
    const dominante=[...porDoc].sort((a,b)=>b[1]-a[1])[0][0];
    const primero=chunks.find(c=>c.source==='pdf'&&c.page&&c.docName===dominante);
    if(!primero)return[];
    citas=new Set([String(primero.page)]);
    chunks=chunks.filter(c=>c.docName===dominante);
    porCita=false;
  }

  /* Con dos manuales cargados «pág. 11» es ambiguo: los dos tienen una. El
     número se resuelve contra los fragmentos que de verdad se enviaron, que sí
     saben de qué documento salieron; y si la respuesta nombra un manual, ese
     manda sobre el otro. */
  const nombrados=respuesta
    ?docs.filter(d=>respuesta.includes(d.name)||respuesta.includes(d.name.replace(/\.pdf$/i,''))).map(d=>d.name)
    :[];
  const paginas=new Map();
  for(const c of chunks){
    if(c.source!=='pdf'||!c.page)continue;
    if(citas&&!citas.has(String(c.page)))continue;
    if(nombrados.length&&!nombrados.includes(c.docName))continue;
    const k=c.docName+'|'+c.page;
    if(!paginas.has(k))paginas.set(k,new Set());
    if(c.heading)paginas.get(k).add(normalizeText(c.heading));
  }
  if(!paginas.size)return[];

  /* Dentro de una página citada puede haber varias láminas. Primero la de la
     misma sección que el fragmento; luego la que comparte palabras con la
     respuesta, que es la que el asesor espera ver. */
  /* Las cifras sueltas se quedan fuera del cotejo: la respuesta «(pág. 3) … el
     20.8%» comparte el «8» y el «3» con una lámina titulada «VANGUARDISTA
     (8.3%)», que no tiene nada que ver. Para buscar en el manual un número es
     un dato; para reconocer una lámina es una coincidencia. */
  const terminos=respuesta?new Set(tokenize(respuesta).filter(t=>!/^\d+$/.test(t))):null;
  /* El rótulo y el pie los escribió el manual; la descripción la escribió un
     modelo mirando el recorte. Pesaban igual, así que una descripción larga y
     genérica de la IA le ganaba a un pie exacto del propio manual. Lo que dice
     el documento vale el doble de lo que dice quien lo interpretó. */
  const comunes=(txt)=>{
    if(!terminos||!txt)return 0;
    let n=0;
    for(const t of new Set(tokenize(txt)))if(!/^\d+$/.test(t)&&terminos.has(t))n++;
    return n
  };
  const puntuar=f=>{
    const titulos=paginas.get(f.docName+'|'+f.page);
    let p=f.heading&&titulos.has(normalizeText(f.heading))?4:0;
    p+=Math.min(comunes((f.caption||'')+' '+(f.heading||'')),2)*2;
    p+=Math.min(comunes(f.vlmDescription),2);
    return p
  };
  let orden=docFigures.filter(f=>paginas.has(f.docName+'|'+f.page))
    .map((f,i)=>({f,p:puntuar(f),i}))
    .sort((a,b)=>b.p-a.p||a.i-b.i);
  /* Si alguna lámina se pudo identificar —su sección es la del fragmento citado,
     o su rótulo aparece en la respuesta—, se enseña esa y nada más. Las otras de
     la misma página ya no son evidencia, son relleno: a la pregunta por el
     cliente práctico la acompañaban dos láminas de VANGUARDISTA. Solo cuando no
     hay forma de distinguir se enseña la página entera. */
  if(orden.length&&orden[0].p>0)orden=orden.filter(o=>o.p>0);

  /* Dos recortes de la misma imagen llenaban la tira con lo mismo repetido —es
     lo que se vio en pantalla: el mismo edificio dos veces—. Se descarta el
     repetido, pero solo si además comparte sección: a 8×8 dos iconos de perfil
     distintos («VANGUARDISTA (11.5%)» y «(8.3%)») salen a distancia 1, y son
     láminas diferentes. Si el manual las tituló distinto, son distintas.
     Sin firma, `distanciaVisual` devuelve el máximo, así que una figura sin
     firmar nunca se descarta por parecido. */
  const salida=[];
  const mismoTitulo=(a,b)=>normalizeText(a.heading||'')===normalizeText(b.heading||'');
  /* Si ninguna lámina de la página se pudo identificar, se enseña UNA y no tres.
     Tres imágenes debajo de un dato se leen como tres pruebas del dato, y lo
     único que se puede sostener es que son de esa página. */
  const identificada=!!(orden.length&&orden[0].p>0);
  /* Sin modelo no hay respuesta con la que reconocer la lámina, solo la sección
     de la tarjeta. Si la única lámina de la página está rotulada con OTRA
     sección, no es la de esta duda: «¿cómo doblo las playeras?» enseñaba el
     dibujo de ENTALLADO —misma pág. 4— bajo «la lámina de la que sale esto».
     Mejor ninguna que una que afirma algo falso. */
  if(sinModelo&&!identificada){
    orden=orden.filter(o=>!o.f.heading);
    if(!orden.length)return[];
  }
  const tope=identificada?MAX_EVIDENCIA:1;
  for(const{f}of orden){
    if(salida.length>=tope)break;
    if(salida.some(g=>distanciaVisual(g.firma,f.firma)<=FIG_DIST_IGUAL&&mismoTitulo(g,f)))continue;
    salida.push(f);
  }
  salida.origen=porCita?(identificada?'cita':'pagina'):'consultado';
  return salida
}

/* El rótulo promete exactamente lo que se puede sostener, ni una palabra más:
   si la respuesta citó la página y la lámina se identificó, se dice; si solo se
   sabe la página, se dice; y si el modelo no citó nada, se dice que la lámina
   es del fragmento que se consultó — no que la respuesta la cite. */
const ROTULO_EVIDENCIA={
  cita:['Lámina de la página que cita la respuesta:','Láminas de las páginas que cita la respuesta:'],
  pagina:['De la página que cita la respuesta — no pude distinguir cuál lámina sostiene el dato:','De las páginas que cita la respuesta — no pude distinguir cuáles sostienen el dato:'],
  consultado:['Lámina del fragmento que se consultó (la respuesta no citó página):','Láminas de los fragmentos que se consultaron (la respuesta no citó página):'],
  manual:['Del manual, la lámina de la que sale esto:','Del manual, las láminas de las que sale esto:'],
  manualPagina:['De la misma página del manual (no sé si esta lámina es justo la de tu duda):','De la misma página del manual (no sé si estas láminas son justo las de tu duda):'],
  senalada:['La página que señalaste:','Las páginas que señalaste:'],
};
function renderEvidencia(container,figuras,origen){
  if(!figuras||!figuras.length)return;
  const wrap=document.createElement('div');wrap.className='evidencia';
  const titulo=document.createElement('div');titulo.className='evidencia-titulo';
  const rot=ROTULO_EVIDENCIA[origen||figuras.origen||'manual']||ROTULO_EVIDENCIA.manual;
  titulo.textContent=rot[figuras.length===1?0:1];
  wrap.appendChild(titulo);
  const varios=docs.length>1;
  const tira=document.createElement('div');tira.className='evidencia-tira';
  for(const f of figuras){
    const fig=document.createElement('figure');fig.className='evidencia-fig';
    const img=document.createElement('img');
    img.src=f.dataUrl;img.loading='lazy';
    img.alt=(f.caption||f.heading||'Figura')+' — página '+f.page;
    const pie=document.createElement('figcaption');
    /* Con más de un manual cargado, «pág. 11» a secas no le sirve a nadie. Y sin
       rótulo de sección el pie se quedaba en «pág. 2» a secas: ahí manda el
       nombre de la sección, que siempre se puede deducir del manual. */
    const deQuien=varios||!f.heading?nombreDeSeccion(f.docName)+' · ':'';
    pie.textContent=deQuien+'pág. '+f.page+(f.heading?' · '+f.heading:'');
    fig.appendChild(img);fig.appendChild(pie);
    /* Ampliar dentro del globo no alcanzaba: en el celular la lámina seguía del
       ancho del mensaje y las cotas del planograma no se leían. */
    fig.onclick=()=>abrirVisor(f.dataUrl,pie.textContent,img.alt,{docName:f.docName,page:f.page},img);
    tira.appendChild(fig);
  }
  wrap.appendChild(tira);
  container.appendChild(wrap);
}

/* Visor a pantalla completa. Doble toque (o doble clic) acerca al doble y se
   recorre arrastrando; el pellizco nativo también funciona. */
let visorLamina=null;   // {docName,page} de la lámina abierta, para «Explícame esta lámina»
/* Con View Transitions, la miniatura crece hasta el visor como el mismo
   elemento (y vuelve a su lugar al cerrar); sin ellas, abre como antes. */
let visorDesde=null;
const conTransicion=fn=>{
  if(!document.startViewTransition||matchMedia('(prefers-reduced-motion: reduce)').matches){fn();return}
  document.startViewTransition(fn);
};
function abrirVisor(src,pie,alt,lamina,desde){
  if(desde&&!desde.__enTransicion){
    visorDesde=desde;desde.style.viewTransitionName='lamina';
    conTransicion(()=>{desde.style.viewTransitionName='';document.getElementById('visor-img').style.viewTransitionName='lamina';abrirVisor(src,pie,alt,lamina,Object.assign({},{__enTransicion:true}))});
    return;
  }
  const v=document.getElementById('visor'),img=document.getElementById('visor-img'),sc=document.getElementById('visor-scroll');
  visorLamina=lamina&&lamina.page?lamina:null;
  const explica=document.getElementById('visor-explica');
  if(explica)explica.style.display=visorLamina&&appState.motor==='agente'&&hayKeyParaIA()&&docs.some(d=>d.name===visorLamina.docName)?'':'none';
  img.src=src;img.alt=alt||'';
  document.getElementById('visor-pie').textContent=pie||'';
  sc.classList.remove('zoom');
  v.classList.add('abierto');
  document.body.style.overflow='hidden';
  /* Una entrada en la historia: el botón atrás cierra la lámina, no la app. */
  try{if(!estadoNav().visor)window.history.pushState({...estadoNav(),visor:true},'')}catch{}
}
/* La lámina abierta, explicada por el agente: la mira (ver_lamina) y la
   cuenta con su texto. Si es de otra sección cargada, se cambia a esa. */
function explicarLamina(){
  const l=visorLamina;
  if(!l)return;
  cerrarVisor();
  if(appState.manualActivo!==l.docName&&docs.length>1)cambiarSeccion(l.docName);
  ask(`Explícame la lámina de la pág. ${l.page}: qué muestra y cómo se monta.`);
}
function cerrarVisor(opciones={}){
  if(!opciones.desdeHistorial&&estadoNav().visor){
    try{ignorarPop=true;window.history.back()}catch{ignorarPop=false}
  }
  const img=document.getElementById('visor-img'),desde=visorDesde&&visorDesde.isConnected?visorDesde:null;
  visorDesde=null;
  const cerrar=()=>{
    document.getElementById('visor').classList.remove('abierto');
    img.removeAttribute('src');img.style.viewTransitionName='';
    if(desde)desde.style.viewTransitionName='lamina';
    document.body.style.overflow='';
  };
  if(!desde){cerrar();return}
  conTransicion(cerrar);
  setTimeout(()=>{desde.style.viewTransitionName=''},400);
}
(function(){
  const sc=document.getElementById('visor-scroll');
  let ultimoToque=0;
  const alternar=(x,y)=>{
    const img=document.getElementById('visor-img');
    const r=img.getBoundingClientRect();
    const fx=(x-r.left)/r.width,fy=(y-r.top)/r.height;
    const zoom=sc.classList.toggle('zoom');
    if(zoom)requestAnimationFrame(()=>{
      sc.scrollLeft=fx*img.clientWidth-sc.clientWidth/2;
      sc.scrollTop=fy*img.clientHeight-sc.clientHeight/2;
    });
  };
  sc.addEventListener('dblclick',e=>alternar(e.clientX,e.clientY));
  sc.addEventListener('touchend',e=>{
    const ahora=Date.now();
    if(ahora-ultimoToque<300&&e.changedTouches[0]){e.preventDefault();alternar(e.changedTouches[0].clientX,e.changedTouches[0].clientY)}
    ultimoToque=ahora;
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape')cerrarVisor()});
})();

/* La verificación contra el contexto (cifras con su unidad, páginas, nombres
   y atadura) vive en src/motor/verificacion.js (ADR 0005, paso 6). Aquí queda
   el aviso en pantalla. */
function renderAvisoVerificacion(res){
  const atadas=(res&&res.atadas)||[];
  if(!res||(!res.cifras.length&&!res.paginas.length&&!(res.nombres||[]).length&&!atadas.length))return null;
  const el=document.createElement('div');
  el.className='verify-warn';
  const frases=[];
  for(const a of atadas.slice(0,3)){
    const donde=a.pagina?` está en la pág. ${escapeHtml(a.pagina)}`:' está en el manual';
    const junto=a.pegadaA?` junto a <strong>${escapeHtml(a.pegadaA)}</strong>`:', pero pegado a otra cosa';
    frases.push(`⚠ El <strong>${escapeHtml(a.cifra)}</strong> que dice para <em>${escapeHtml(a.sujeto)}</em>${donde}${junto}; para <em>${escapeHtml(a.sujeto)}</em> el manual dice <strong>${escapeHtml(a.rival)}</strong>${a.paginaRival?` (pág. ${escapeHtml(a.paginaRival)})`:''}.`);
  }
  const partes=[];
  if(res.cifras.length)partes.push(`${res.cifras.length===1?'el dato':'los datos'} <strong>${res.cifras.slice(0,4).map(escapeHtml).join(', ')}</strong>`);
  if((res.nombres||[]).length)partes.push(`${res.nombres.length===1?'el nombre':'los nombres'} <strong>${res.nombres.slice(0,4).map(escapeHtml).join(', ')}</strong>`);
  if(res.paginas.length)partes.push(`${res.paginas.length===1?'la página citada':'las páginas citadas'} <strong>${res.paginas.slice(0,4).map(escapeHtml).join(', ')}</strong>`);
  if(partes.length)frases.push(`⚠ No pude verificar ${partes.join(' ni ')} en los fragmentos que se consultaron.`);
  el.innerHTML=frases.join('<br>')+` Contrasta contra el manual antes de aplicarlo${res.certezaBajada?'; por eso la certeza quedó en media':''}.`;
  if(atadas.length)el.dataset.atadura=String(atadas.length);
  return el
}

/* Los nombres que la respuesta leyó en una lámina que es imagen: no hay texto
   con qué cotejarlos, así que no son un aviso amarillo ni bajan la certeza,
   pero se dicen —la verificación no calla— con la página para compararlos. */
function renderNotaLamina(res){
  const nombres=(res&&res.nombresDeLamina)||[];
  if(!nombres.length)return null;
  const pags=(res.paginasDeLamina||[]).map(p=>'pág. '+escapeHtml(p)).join(' y ');
  const el=document.createElement('div');
  el.className='verify-lamina';
  const lista=nombres.slice(0,4).map(escapeHtml).join(', ')+(nombres.length>4?'…':'');
  el.innerHTML=`Leído en la imagen de la ${pags}, que no trae texto para comprobarlo: <strong>${lista}</strong>. Compáralo con la lámina.`;
  return el
}

const CERTEZA_ROTULO={ALTA:{txt:'certeza alta',cls:'alta'},MEDIA:{txt:'certeza media',cls:'media'},GAP:{txt:'no está en el manual',cls:'gap'}};
/* laminasVistas: las páginas que el motor clásico le mandó al modelo como
   imagen en ESTA pregunta (src/ia/laminas.js). Lo que la respuesta lee en ellas
   no está en el texto y se dice aparte (renderNotaLamina). */
function renderAssistantMessage(loaderEl,rawText,tokens,originalQuestion,contextoEnviado,laminasVistas){
  const{thinking,final,parsed,cortada}=parseAIResponse(rawText);
  const cleanFinal=sanitizeFinalAnswer(final,originalQuestion);
  const verif=verificarContraContexto(cleanFinal,contextoEnviado,{laminas:laminasVistas});
  /* La certeza la declara el modelo, pero no puede ser ALTA con un dato que la
     app no pudo comprobar en lo que el modelo tenía delante —o que encontró
     pegado a otra cosa—. Un «certeza alta» encima de un aviso amarillo le dice
     al asesor que el aviso sobra. */
  let certeza=certezaDe(final);
  if(certeza==='ALTA'&&(verif.cifras.length||verif.paginas.length||(verif.nombres||[]).length||(verif.atadas||[]).length)){
    certeza='MEDIA';verif.certezaBajada=true;
  }
  const msgBody=loaderEl.querySelector('.msg-body');
  const msgLabel=loaderEl.querySelector('.msg-label');
  loaderEl.classList.remove('loading');
  msgBody.innerHTML=safeMarkdown(cleanFinal);
  /* Arriba de la respuesta, de qué manual y qué página (como en el canvas):
     el asesor ve la página antes que el dato. Solo las páginas que la
     verificación encontró de verdad en lo que se le mandó al modelo. */
  const pagsCitadas=[...verif.citadas].map(Number).sort((x,y)=>x-y);
  if(contextoEnviado&&pagsCitadas.length&&certeza!=='GAP'){
    const citados=(ultimosFragmentos||[]).filter(c=>c.source==='pdf'&&verif.citadas.has(String(c.page)));
    /* Todos los manuales citados, no solo el primero: una respuesta que junta
       dos secciones decía una sola arriba. */
    const manuales=[...new Set(citados.map(c=>c.docName))];
    /* Y los mundos de las tablas citadas que la respuesta nombra («MUNDOS Y
       MARCAS · VESTIR» → VESTIR): de un vistazo, en qué mundo va. */
    const resp=normalizeText(cleanFinal);
    const mundos=[...new Set(citados.map(c=>(c.heading||'').split(' · ')[1]||'').filter(m=>m&&resp.includes(normalizeText(m))))].slice(0,3);
    const cab=document.createElement('div');cab.className='resp-cab';
    cab.innerHTML=ICO.doc+(manuales.length?manuales.slice(0,2):[null]).map(d=>`<span class="resp-manual">${escapeHtml(d?nombreDeSeccion(d):'Tu manual')}</span>`).join('')
      +pagsCitadas.slice(0,3).map(n=>`<span class="resp-pag">pág. ${n}</span>`).join('')
      +mundos.map(m=>`<span class="resp-pag resp-mundo">${escapeHtml(m)}</span>`).join('');
    /* Fuera del cuerpo: lo que se copia y lo que se califica es la respuesta. */
    loaderEl.insertBefore(cab,msgBody);
  }
  const insignia=CERTEZA_ROTULO[certeza];
  msgLabel.innerHTML=`Asistente ${insignia?`<span class="certeza ${insignia.cls}">${insignia.txt}</span> `:''}<span class="msg-tokens">~${tokens.toLocaleString('es-MX')} tk</span>`;

  /* El razonamiento a medias no es una respuesta. Se dice antes de que el
     asesor lea nada, porque un texto cortado a mitad de frase se parece
     demasiado a una contestación. */
  if(cortada){
    const corte=document.createElement('div');
    corte.className='verify-warn';
    corte.textContent='⚠ La respuesta se cortó antes de terminar: esto es el razonamiento, no la contestación. Vuelve a preguntar, o pregunta algo más concreto.';
    loaderEl.insertBefore(corte,msgBody);
  }

  const alerta=renderAvisoVerificacion(verif);
  /* El aviso va ARRIBA del cuerpo. Colgado debajo, el asesor ya había leído —y
     en el piso, ejecutado— el dato que el aviso venía a poner en duda. */
  if(alerta)loaderEl.insertBefore(alerta,msgBody);
  if(verif.certezaBajada)loaderEl.dataset.certezaBajada='1';
  /* Una cifra pegada a otra cosa se resuelve mirando la lámina: su página entra
     en la tira de evidencia aunque la respuesta no la citara. */
  const citadasFig=new Set(verif.citadas);
  for(const a of verif.atadas||[]){if(a.pagina)citadasFig.add(String(a.pagina));if(a.paginaRival)citadasFig.add(String(a.paginaRival))}
  let figsApi=contextoEnviado?figurasDeFragmentos(ultimosFragmentos,citadasFig,cleanFinal,certeza):[];
  if(contextoEnviado&&!figsApi.length&&(verif.atadas||[]).length){
    const pag=paginaComoLamina(ultimosFragmentos,verif.atadas[0].pagina||verif.atadas[0].paginaRival,docPaginas);
    if(pag){figsApi=[pag];figsApi.origen='pagina'}
  }
  /* La página citada no trae un recorte (una tabla de MUNDOS Y MARCAS, una
     lámina que es toda imagen): va la página entera. Si el chat no alcanzó a
     nombrar algo, la lámina lo enseña. Primero la que el modelo vio como
     imagen, luego la primera citada. */
  if(contextoEnviado&&!figsApi.length&&verif.citadas.size&&!esRespuestaSinDato(cleanFinal,certeza)){
    const vista=ultimasLaminasVistas.find(l=>verif.citadas.has(String(l.page)));
    const pag=paginaComoLamina(ultimosFragmentos,vista?vista.page:[...verif.citadas].map(Number).sort((x,y)=>x-y)[0],docPaginas);
    if(pag){figsApi=[pag];figsApi.origen='pagina'}
  }
  /* Lo leído en la lámina-imagen va justo antes de la lámina, para compararlo. */
  const notaLamina=renderNotaLamina(verif);
  if(notaLamina)loaderEl.appendChild(notaLamina);
  if(contextoEnviado)renderEvidencia(loaderEl,figsApi);
  /* Al tablero va la respuesta terminada: una cortada o detenida no dice si el
     manual lo cubría. La lámina que cuenta es la citada; si no citó, la primera. */
  let idConsulta=null,fuenteCitada=null;
  /* Se fija ahora: al tocar 👎, `ultimosFragmentos` puede ser ya de otra pregunta. */
  const docDeRespuesta=contextoEnviado?((ultimosFragmentos||[]).find(c=>c.source==='pdf')?.docName||ultimaSeccionUsada||docDeConsulta(originalQuestion,null)):null;
  if(contextoEnviado&&!cortada&&!/_\[Generación detenida/.test(rawText)){
    const frags=ultimosFragmentos||[];
    const fuente=frags.find(c=>c.page&&verif.citadas.has(String(c.page)))||frags[0];
    if(fuente&&fuente.page&&verif.citadas.has(String(fuente.page)))fuenteCitada=fuente;
    idConsulta=registrarConsulta(originalQuestion,!esRespuestaSinDato(cleanFinal,certeza),fuente,'api');
  }

  const footer=document.createElement('div');footer.className='msg-footer';

  /* La pregunta era de otra sección cargada. Decirlo no basta: el asesor está en
     el piso con el teléfono en una mano, y "cámbiala arriba en el selector" es
     una instrucción que no va a seguir. El botón cambia la sección y vuelve a
     preguntar lo mismo, que es lo que quería hacer. */
  if(ultimaOtraSeccion&&docs.some(d=>d.name===ultimaOtraSeccion.docName)){
    const otra=ultimaOtraSeccion;
    const cambiar=document.createElement('button');
    cambiar.className='ref-general';
    cambiar.innerHTML=conIcono('libro',`Cambiar a ${otra.nombre} y repetir la pregunta`);
    cambiar.onclick=()=>{
      cambiar.disabled=true;
      cambiarSeccion(otra.docName);
      const input=document.getElementById('user-input');
      input.value=originalQuestion;
      sendMessage();
    };
    footer.appendChild(cambiar);
  }

  /* La sección activa tiene lo que se preguntó, pero una palabra de la pregunta
     no aparece en ella y sí es tema de otra cargada. Se responde igual —el
     manual del asesor manda— y además se le ofrece mirar al lado. */
  if(!ultimaOtraSeccion&&ultimaSeccionSugerida&&docs.some(d=>d.name===ultimaSeccionSugerida.docName)){
    const sug=ultimaSeccionSugerida;
    const btnSug=document.createElement('button');
    btnSug.className='ref-general';
    btnSug.innerHTML=conIcono('libro',`Buscar esto en ${sug.nombre}`);
    btnSug.onclick=()=>{
      btnSug.disabled=true;
      cambiarSeccion(sug.docName);
      const input=document.getElementById('user-input');
      input.value=originalQuestion;
      sendMessage();
    };
    footer.appendChild(btnSug);
  }

  /* Con un PDF cargado, el manual interno ya no entra al contexto: lo que la
     sección del asesor no cubra sale como GAP, y ahí es donde tiene sentido
     buscar en el resto de SUS manuales —pedido a propósito y rotulado como lo
     que es, en vez de mezclado de oficio en cada respuesta—. Con un solo manual
     cargado no aparece: no hay otro sitio donde mirar. */
  if(docs.length>1&&esRespuestaSinDato(cleanFinal,certeza)){
    const refBtn=document.createElement('button');
    refBtn.className='ref-general';
    refBtn.innerHTML=conIcono('lupa','Buscar en mis otros manuales');
    refBtn.onclick=()=>consultarTodosLosManuales(originalQuestion,refBtn);
    footer.appendChild(refBtn);
  }

  if(parsed&&thinking&&!assessQuestionScope(originalQuestion).clearlyOff){
    const block=document.createElement('div');block.className='reasoning-block';
    block.innerHTML=safeMarkdown(thinking);
    /* En el modo rápido el razonamiento es una sola línea: dónde lo leyó. */
    const soloLectura=/^\s*LECTURA\s*:/i.test(thinking);
    const ver=soloLectura?'Ver dónde lo leyó':'Ver razonamiento',ocultar=soloLectura?'Ocultar lectura':'Ocultar razonamiento';
    const btn=document.createElement('button');btn.className='reasoning-toggle';
    btn.innerHTML=`<span class="rt-icon">▶</span> ${ver}`;
    btn.onclick=()=>{
      const open=block.classList.toggle('open');
      btn.classList.toggle('open',open);
      btn.innerHTML=open?`<span class="rt-icon" style="transform:rotate(90deg)">▶</span> ${ocultar}`:`<span class="rt-icon">▶</span> ${ver}`;
    };
    footer.appendChild(btn);
    loaderEl.appendChild(block);
  }

  const fbWrap=document.createElement('div');fbWrap.className='feedback-wrap';fbWrap.style.display='flex';fbWrap.style.alignItems='center';fbWrap.style.gap='6px';
  const goodBtn=document.createElement('button');goodBtn.className='fb-btn good';goodBtn.textContent='👍';
  const badBtn=document.createElement('button');badBtn.className='fb-btn bad';badBtn.textContent='👎';
  const fbDone=document.createElement('span');fbDone.className='fb-done';fbDone.style.display='none';fbDone.textContent='Guardado ✓';

  const noteWrap=document.createElement('div');noteWrap.className='fb-note-wrap';
  const noteEl=document.createElement('textarea');noteEl.className='fb-note';noteEl.rows=2;noteEl.placeholder='¿Qué estuvo mal? (opcional)';
  const sendBtn=document.createElement('button');sendBtn.className='fb-send';sendBtn.textContent='Enviar feedback';
  noteWrap.appendChild(noteEl);noteWrap.appendChild(document.createElement('br'));noteWrap.appendChild(sendBtn);

  /* Un voto por respuesta. «Enviar feedback» se podía pulsar varias veces y cada
     pulsación sumaba otro fallo a la memoria; y un 👍 después de un 👎 ya
     enviado dejaba registrados los dos. Enviado uno, los botones se cierran. */
  const cerrarVoto=()=>{goodBtn.disabled=true;badBtn.disabled=true;sendBtn.disabled=true};
  goodBtn.onclick=()=>{
    if(goodBtn.disabled||goodBtn.classList.contains('active'))return;
    goodBtn.classList.add('active');badBtn.classList.remove('active');cerrarVoto();
    noteWrap.style.display='none';fbDone.style.display='';
    if(idConsulta)votarConsulta(idConsulta,'bien');
    if(fuenteCitada)confirmarCamino(originalQuestion,fuenteCitada.docName,fuenteCitada.page,idConsulta);
    // v7.0: feedback visual inmediato
    showToast('✓ Respuesta marcada como correcta', 'success', 1800);
  };
  badBtn.onclick=()=>{
    if(badBtn.disabled||badBtn.classList.contains('active'))return;
    badBtn.classList.add('active');goodBtn.classList.remove('active');
    noteWrap.style.display='block';
    /* Lo más útil que puede dejar un 👎 es dónde SÍ estaba. */
    if(contextoEnviado)pedirLamina(loaderEl,noteWrap,originalQuestion,idConsulta,docDeRespuesta);
  };
  sendBtn.onclick=()=>{
    if(sendBtn.disabled)return;
    cerrarVoto();
    noteWrap.style.display='none';fbDone.style.display='';
    if(idConsulta)votarConsulta(idConsulta,'mal',noteEl.value.trim());
    showToast('✓ Anotado en el tablero', 'success', 1800);
  };

  fbWrap.appendChild(goodBtn);fbWrap.appendChild(badBtn);
  footer.appendChild(fbWrap);
  footer.appendChild(fbDone);

  const copyBtn=document.createElement('button');copyBtn.className='msg-copy';copyBtn.textContent='Copiar';
  copyBtn.onclick=()=>{
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(cleanFinal).then(()=>{copyBtn.textContent='✓ Copiado';setTimeout(()=>copyBtn.textContent='Copiar',1500)}).catch(()=>{copyBtn.textContent='✕ No disponible';setTimeout(()=>copyBtn.textContent='Copiar',2000)});
    }else{
      copyBtn.textContent='✕ No disponible';setTimeout(()=>copyBtn.textContent='Copiar',2000);
    }
  };
  footer.appendChild(copyBtn);
  /* La cortada no se comparte: es el razonamiento, no la respuesta. La lámina
     solo viaja si la respuesta la citó y se identificó; «de la misma página»
     no alcanza para mandarla al grupo como prueba. */
  if(!cortada)footer.appendChild(botonCompartir({
    pregunta:originalQuestion,
    respuesta:markdownAWhatsApp(cleanFinal),
    fuente:fuenteCitada?rotuloDeFragmento(fuenteCitada):'',
    aviso:alerta?'⚠ La app no pudo comprobar todo en el manual: revisa la lámina antes de montarlo.':'',
    figura:figsApi.length&&figsApi.origen==='cita'?figsApi[0]:null
  }));

  loaderEl.appendChild(noteWrap);
  loaderEl.appendChild(footer);
}

/* ── La respuesta del agente en pantalla ──
   Pasa por el mismo renderAssistantMessage que el motor clásico —certeza,
   verificación de cifras y nombres, lámina citada, tablero, compartir— y
   encima lleva lo que solo el agente sabe: qué entendió, qué leyó y si sus
   citas están de verdad en esas páginas. */
function presentarRespuestaAgente(loaderEl,r,q){
  const{thinking,final}=parseAIResponse(r.texto);
  const campos=camposDelAgente(thinking);
  const dicha=certezaDe(final);
  const citas=verificarCitas(campos.evidencia,r.estado);
  /* ALTA quiere decir «cada dato tiene su cita literal». Si una cita no está
     donde dice, o no hay ninguna, no es ALTA, la haya escrito quien la haya
     escrito. */
  let texto=r.texto;
  if(dicha==='ALTA'&&(citas.malas.length||!campos.evidencia.length))texto=texto.replace(/(CERTEZA\s*:?\s*\**\s*)ALTA/i,'$1MEDIA');
  const finalTexto=parseAIResponse(texto).final;
  const certeza=certezaDe(finalTexto);
  const limpio=sanitizeFinalAnswer(finalTexto,q);
  const esGap=esRespuestaSinDato(limpio,certeza);
  ultimosFragmentos=r.estado.chunks;
  ultimaOtraSeccion=null;
  ultimaSeccionUsada=r.estado.doc;ultimaSeccionPorPregunta=(rutaActual&&rutaActual.q===q&&RUTA_ROTULO[rutaActual.motivo])||false;
  ultimaSeccionSugerida=esGap&&r.estado.otras.length===1?{docName:r.estado.otras[0].docName,nombre:r.estado.otras[0].nombre}:null;
  renderAssistantMessage(loaderEl,texto,r.estado.tokens||estimateTokens(texto),q,r.contexto);
  marcarModelo(loaderEl,r.model,!!r.respaldo);
  const cuerpo=loaderEl.querySelector('.msg-body'),footer=loaderEl.querySelector('.msg-footer');
  if(citas.malas.length){
    const el=document.createElement('div');el.className='verify-warn';
    el.textContent=`⚠ Revisé las citas del asistente y ${citas.malas.length===1?'una no coincide':citas.malas.length+' no coinciden'} con lo que leyó: `
      +citas.malas.slice(0,2).map(m=>`«${extracto(m.cita,70)}» (${m.motivo})`).join('; ')+'. Contrasta con la lámina antes de aplicarlo.';
    loaderEl.insertBefore(el,cuerpo);
  }
  /* «Mostrando resultados de…»: el asesor ve cómo se entendió lo que escribió
     y, si no era eso, lo corrige él mismo con la siguiente pregunta. */
  if(campos.correcciones.length){
    const el=document.createElement('div');el.className='entendi';
    el.innerHTML='Entendí '+campos.correcciones.map(c=>`<strong>${escapeHtml(c.manual)}</strong> <span>(escribiste «${escapeHtml(c.escribio)}»)</span>`).join(', ');
    /* Si lo entendió bien, un toque lo confirma: con dos, esa palabra del piso
       queda aprendida para esta sección, también sin modelo. */
    const reg=tablero.length&&tablero[tablero.length-1].q===String(q).slice(0,200)?tablero[tablero.length-1]:null;
    const pares=campos.correcciones.map(c=>({dijo:tokenize(c.escribio),como:tokenize(c.manual)}))
      .filter(p=>p.dijo.length===1&&p.como.length===1).map(p=>({dijo:p.dijo[0],como:p.como[0]}));
    const si=botonSiEso(pares,r.estado.doc,reg&&reg.id);
    if(si)el.appendChild(si);
    loaderEl.insertBefore(el,loaderEl.querySelector('.msg-label').nextSibling);
  }
  const leidas=[...r.estado.leidas.keys()];
  const traza=document.createElement('div');traza.className='msg-traza';
  traza.textContent='📖 '+(leidas.length?`Leyó pág. ${leidas.join(', ')}`:'No leyó páginas')
    +(r.estado.vistas.size?` · miró la lámina de la pág. ${[...r.estado.vistas].join(', ')}`:'');
  loaderEl.insertBefore(traza,footer);
  if(campos.opciones.length)loaderEl.insertBefore(filaDeChips(esGap?'¿Quisiste decir…?':'También lo puedo entender como:',campos.opciones),footer);
  const citadas=[...new Set([...limpio.matchAll(/p[áa]g\.?\s*(\d+)/gi)].map(m=>Number(m[1])))];
  const sugerencias=sugerenciasDeFicha(docFichas.get(r.estado.doc),[...new Set([...citadas,...leidas])],q);
  anotarBasico(r.estado.doc,q);
  const sigue=esGap?[]:sigueEnElManual(r.estado.doc,citadas.length?citadas:leidas,q).filter(s=>!sugerencias.includes(s.q));
  const todas=[...sugerencias,...sigue].slice(0,Math.max(3,sugerencias.length));
  if(todas.length)loaderEl.insertBefore(filaDeChips(esGap?'Esto sí lo trae el manual:':'También te puede servir:',todas),footer);
  ultimaTrazaAgente={motor:'agente',rondas:r.estado.rondas,cortes:r.estado.cortes||0,paginas:leidas.length,imagenes:r.estado.imagenes,tokens:r.estado.tokens,
    herramientas:r.estado.llamadas,citas:citas.total,citasMalas:citas.malas.length,correcciones:campos.correcciones.length};
  return{texto:limpio,entendi:campos.entendi}
}
function filaDeChips(titulo,preguntas){
  const wrap=document.createElement('div');wrap.className='chips-ia'+(/^Sigue en el manual/.test(titulo)?' chips-sigue':'');
  const t=document.createElement('span');t.className='chips-titulo';t.textContent=titulo;
  wrap.appendChild(t);
  for(const p of preguntas){
    const texto=typeof p==='string'?p:p.texto,q=typeof p==='string'?p:p.q;
    const b=document.createElement('button');b.className='chip-ia';b.textContent=texto;
    /* La página del botón, como en el canvas: «Estilo nórdico  p. 15». */
    const pag=typeof p==='string'?null:p.pagina;
    if(pag){b.textContent=texto.replace(/ · pág\. \d+$/,'');const s=document.createElement('span');s.className='chip-pag';s.textContent='p. '+pag;b.appendChild(s)}
    b.onclick=()=>ask(q);
    wrap.appendChild(b);
  }
  return wrap
}
/* ════════════════════════════════════════════════
   «SIGUE EN EL MANUAL»

   Qué lámina leer después vive en src/motor/sigue.js. Aquí quedan los
   básicos que ya se preguntaron en la sesión y cuáles cubre la sección.
════════════════════════════════════════════════ */
const basicosPreguntados=new Map();      // sección → básicos preguntados en esta sesión
let coberturaBasicos=new Map(),firmaCobertura='';
function anotarBasico(doc,q){
  const b=basicoDe(q||'');
  if(!doc||!b)return;
  if(!basicosPreguntados.has(doc))basicosPreguntados.set(doc,new Set());
  basicosPreguntados.get(doc).add(b);
}
/* Qué básicos trae la sección y en qué página: la pregunta de cada uno,
   contestada por el motor local sin red, y solo cuenta si sale con su
   lámina y sin aviso. Una vez por sección, mientras no cambie el corpus. */
function coberturaDeBasicos(doc){
  const firma=docs.map(d=>d.name).join('|')+'#'+docChunks.length+'#'+(appState.manualActivo||'');
  if(firma!==firmaCobertura){coberturaBasicos=new Map();firmaCobertura=firma}
  if(coberturaBasicos.has(doc))return coberturaBasicos.get(doc);
  const m=new Map();
  if(doc&&(appState.manualActivo===doc||(docs.length===1&&docs[0].name===doc))){
    const guardada=rutaActual;
    try{
      for(const b of BASICOS){
        rutaActual=null;
        const r=respuestaSinModelo(b.pregunta,[],rutaDe);
        const t=r.tarjetas&&r.tarjetas[0];
        if(r.fragmentos&&t&&t.c.docName===doc&&t.c.page&&!r.avisoAusente&&!r.avisoFlojo&&!r.avisoParecidas)m.set(b.id,t.c.page);
      }
    }catch(e){console.warn('básicos',e)}
    finally{rutaActual=guardada}
  }
  coberturaBasicos.set(doc,m);
  return m
}
/* Los botones salen de src/motor/sigue.js con lo que sabe la app: las imágenes
   de las páginas, la ficha, qué básicos cubre la sección y cuáles ya se
   preguntaron. */
function sigueEnElManual(doc,paginas,q,max=3){
  return siguientesDelManual(doc,paginas,q,{paginasGuardadas:docPaginas,ficha:doc?docFichas.get(doc):null,
    cubiertos:()=>coberturaDeBasicos(doc),preguntados:basicosPreguntados.get(doc)||new Set(),max})
}
function filaSigue(doc,paginas,q){
  const s=sigueEnElManual(doc,paginas,q);
  return s.length?filaDeChips('Sigue en el manual:',s):null;
}

/* ════════════════════════════════════════════════
   MEDIR EL MODO IA CON TUS MANUALES

   El motor del modo IA solo se puede juzgar con manuales reales y un modelo
   real, y ninguno de los dos debería viajar: los manuales son de la empresa y
   la key es del asesor. Así que la medición corre aquí, en su teléfono o su
   computadora, con lo que ya tiene cargado. Se le da un EXAMEN (un JSON con
   preguntas de piso y lo que debe traer cada respuesta), la app pregunta con
   cada motor como lo haría el asesor, califica igual que eval/modo-ia.mjs y
   entrega un archivo de resultados para compartir. La key nunca entra en ese
   archivo, y la medición no deja rastro en el tablero ni en la memoria.
════════════════════════════════════════════════ */
/* Lo puro —qué examen se acepta, cómo se califica, el resumen— vive en
   src/piso/medicion.js. */
const MEDICION_PAUSA_MS=6000;          // el plan gratis de Gemini corta por minuto
let midiendo=false,medicionDetener=false,medicionActual=null;

function abrirMedicion(){
  if(midiendo){mostrarPanelMedicion();return}
  document.getElementById('examen-input').click();
}
/* La sección del examen se busca por el nombre que la app le da al manual
   («101 MUEBLES»), no por el archivo: cada quien lo descarga con otro nombre. */
function docDeSeccion(seccion){
  if(!seccion)return appState.manualActivo||(docs.length===1?docs[0].name:null);
  const n=s=>normalizeText(s).replace(/\s+/g,' ').trim();
  const buscada=n(seccion);
  const exacto=docs.find(d=>n(nombreDeSeccion(d.name))===buscada);
  if(exacto)return exacto.name;
  const codigo=(buscada.match(/^\d{2,4}/)||[])[0];
  const porCodigo=codigo&&docs.filter(d=>n(nombreDeSeccion(d.name)).startsWith(codigo+' '));
  if(porCodigo&&porCodigo.length===1)return porCodigo[0].name;
  const parcial=docs.filter(d=>n(nombreDeSeccion(d.name)).includes(buscada)||buscada.includes(n(nombreDeSeccion(d.name))));
  return parcial.length===1?parcial[0].name:null
}


/* ── Una pregunta, como la haría el asesor ── */
function limpiarChatSilencioso(){
  history=[];
  document.getElementById('chat-messages').innerHTML=`<div class="chat-empty" id="chat-empty"></div>`;
}
async function medirPregunta(x,motor,doc,opc={}){
  const motorPrevio=appState.motor;
  const libre=!!opc.libre;
  if(motor!=='manual')appState.motor=motor;
  /* «Como el asesor»: sin sección elegida, que la elija la pregunta. */
  appState.manualActivo=libre?null:doc;
  limpiarChatSilencioso();
  let toque=false;
  /* En un empate la app pregunta «¿en cuál estás?»; el asesor tocaría la suya.
     Se toca por él —la sección del examen— y se cuenta el toque. */
  const preparar=(q,contar)=>{
    rutaActual=null;rutaForzada=null;
    if(!libre)return;
    const r=enrutarSeccion(q);
    if(r.motivo==='empate'&&opc.esperadoDoc&&r.alternativas.includes(opc.esperadoDoc)){
      rutaForzada={q,doc:opc.esperadoDoc};if(contar)toque=true;
    }
    rutaActual=null;
  };
  const preguntar=async(q,contar)=>{
    preparar(q,contar);
    if(motor==='manual'){responderSinModelo(q);return}
    document.getElementById('user-input').value=q;sessionTokens=0;
    await sendMessage();
  };
  try{
    for(const t of x.turnos){
      if(medicionDetener)break;
      await preguntar(t,false);
    }
    const box=document.getElementById('chat-messages');
    const t0=performance.now();let tPrimer=null;
    const iv=setInterval(()=>{
      const el=[...box.querySelectorAll('.msg.assistant')].pop();
      if(tPrimer===null&&el&&!el.classList.contains('loading')&&(el.querySelector('.msg-body')?.textContent||'').trim())tPrimer=performance.now()-t0;
    },50);
    ultimaTrazaAgente=null;ultimoErrorProveedor=null;
    try{await preguntar(x.q,true)}finally{clearInterval(iv)}
    const tTotal=performance.now()-t0;
    const el=[...box.querySelectorAll('.msg.assistant')].pop();
    const ruta=libre&&rutaActual&&rutaActual.q===x.q
      ?{seccion:rutaActual.doc?nombreDeSeccion(rutaActual.doc):null,motivo:rutaActual.motivo}:null;
    return{tPrimer:tPrimer===null?tTotal:tPrimer,tTotal,ruta,toque,
      atadura:Number(el?.querySelector('.verify-warn[data-atadura]')?.dataset.atadura||0),
      certezaBajada:el?.dataset.certezaBajada==='1',
      cuerpo:el?.querySelector('.msg-body')?.innerText||'',
      etiqueta:el?.querySelector('.msg-label')?.innerText||'',
      avisos:[...(el?.querySelectorAll('.verify-warn')||[])].map(w=>w.innerText).join(' | '),
      botones:[...(el?.querySelectorAll('.ref-general')||[])].map(b=>b.textContent).join(' | '),
      entendi:el?.querySelector('.entendi')?.innerText||'',
      traza:el?.querySelector('.msg-traza')?.innerText||'',
      contesto:el?.querySelector('.msg-modelo')?.textContent||'',
      error:!!el?.querySelector('.err-detail'),
      claseError:(el&&el.dataset.claseError)||(ultimoErrorProveedor&&ultimoErrorProveedor.clase)||null,
      /* Qué páginas tuvo delante el motor: con eso se sabe si una falla es de la
         búsqueda (el dato no llegó) o del modelo (llegó y contestó otra cosa). */
      paginasVistas:motor==='manual'
        ?paginasCitadasMed(el?.querySelector('.msg-body')?.innerText||'')
        :[...new Set((ultimosFragmentos||[]).filter(c=>c.page).map(c=>c.page))],
      modeloReal:(el&&el.dataset.modelo)||null,
      agente:ultimaTrazaAgente};
  }finally{appState.motor=motorPrevio;rutaForzada=null}
}

/* ── La tanda completa: fichas, preguntas, progreso guardado ── */
async function cargarExamen(input){
  const f=input.files&&input.files[0];
  input.value='';
  if(!f)return;
  let ex;
  try{ex=JSON.parse(await f.text())}catch{showToast('Ese archivo no es un examen: no se pudo leer como JSON.','error',5000);return}
  const preguntas=validarExamen(ex);
  if(!preguntas.length){showToast('El examen no trae preguntas que se puedan medir.','error',5000);return}
  let guardado=null;
  const clave=claveDeExamen(ex,preguntas);
  try{guardado=JSON.parse(localStorage.getItem(clave)||'null')}catch{}
  medicionActual={nombre:(ex&&ex.examen)||f.name,clave,preguntas,filas:guardado&&Array.isArray(guardado.filas)?guardado.filas:[],
    motores:guardado&&guardado.motores||['clasico','agente'],libre:!!(guardado&&guardado.libre),estado:'listo'};
  mostrarPanelMedicion();
}
async function correrMedicion(){
  const m=medicionActual;
  if(!m||midiendo)return;
  try{appState.apiKey=sessionStorage.getItem('ap_api_key_'+appState.provider)||''}catch{}
  m.motores=['clasico','agente','manual'].filter(k=>document.getElementById('med-'+k)?.checked);
  m.libre=!!document.getElementById('med-libre')?.checked;
  /* Lo aprendido del piso se mide aparte y a propósito: por defecto la medición
     es del código, no de la memoria de este teléfono. */
  m.conAprendido=!!document.getElementById('med-aprendido')?.checked;
  if(!m.motores.length){showToast('Elige al menos un motor.','warn',3000);return}
  /* El modo manual no pregunta a nadie: se mide sin key. */
  if(m.motores.some(k=>k!=='manual')&&!hayKeyParaIA()){showToast('Conecta tu API key en Ajustes: la medición pregunta al modelo desde este teléfono. El modo manual sí se puede medir sin key.','warn',6000);return}
  const faltan=[...new Set(m.preguntas.map(x=>x.seccion))].filter(s=>!docDeSeccion(s));
  if(faltan.length&&!confirm(`No encuentro cargadas estas secciones: ${faltan.join(', ')}. Sus preguntas se saltan. ¿Seguir?`))return;
  const viejos=docs.filter(lecturaVieja);
  if(viejos.length&&!confirm(`${viejos.length===1?'Este manual se leyó':'Estos manuales se leyeron'} con la lectura anterior del PDF: ${viejos.map(d=>nombreDeSeccion(d.name)).join(', ')}. Para medir la lectura nueva, vuelve a elegir sus PDF en Manuales. ¿Medir así de todos modos?`))return;
  midiendo=true;medicionDetener=false;m.estado='corriendo';
  const activoPrevio=appState.manualActivo,historialPrevio=history;
  let cerrojo=null;
  try{cerrojo=await navigator.wakeLock?.request('screen')}catch{}
  try{
    if(m.motores.includes('agente')){
      const secciones=[...new Set(m.preguntas.map(x=>docDeSeccion(x.seccion)).filter(Boolean))].filter(d=>paginasSinFicha(d).length);
      for(const d of secciones){
        if(medicionDetener)break;
        m.estado=`preparando la ficha de ${nombreDeSeccion(d)}`;pintarMedicion();
        const rf=await prepararFicha(d,{silencioso:true,sinTope:true});
        if(rf.cortada){
          showToast(rf.cortada==='key'?'La key no sirve: revísala en Ajustes.':'Se acabó la cuota de hoy preparando las fichas. Mañana, al volver a abrir el examen, sigue donde se quedó.','warn',9000);
          medicionDetener=true;break;
        }
      }
      /* Medir el agente con fichas a medias da un número que no es del agente:
         se dice en el panel y queda en el archivo de resultados. */
      const incompletas=[...new Set(m.preguntas.map(x=>docDeSeccion(x.seccion)).filter(Boolean))]
        .filter(d=>paginasSinFicha(d).length).map(d=>`${nombreDeSeccion(d)} (${paginasSinFicha(d).length} págs.)`);
      m.avisoFicha=incompletas.length?`Fichas incompletas: ${incompletas.join(', ')}. El agente se mide con lo que hay.`:'';
    }
    const conAp=!!m.conAprendido;
    const claveFila=(motor,libre,x,ap)=>motor+'|'+(libre?1:0)+(ap?'|a':'')+'|'+x.seccion+'|'+x.q;
    /* Una fila con error no es un resultado: al reanudar se vuelve a preguntar. */
    const hechas=new Set(m.filas.filter(f=>!f.error).map(f=>claveFila(f.motor,f.libre,f,f.aprendido&&f.aprendido!=='apagado')));
    const tanda=[];
    for(const x of m.preguntas)for(const motor of m.motores)if(!hechas.has(claveFila(motor,m.libre,x,conAp)))tanda.push({x,motor});
    const guardar=()=>{try{localStorage.setItem(m.clave,JSON.stringify({filas:m.filas,motores:m.motores,libre:m.libre}))}catch{}};
    const resumenAp=conAp?`${aprendido.palabras.filter(palabraActiva).length} palabras · ${aprendido.atajos.length} atajos`:'apagado';
    for(const[i,{x,motor}]of tanda.entries()){
      if(medicionDetener)break;
      const doc=docDeSeccion(x.seccion);
      if(!doc)continue;
      const esperadoDoc=x.tipo==='otra'?docDeSeccion(x.otra):doc;
      m.estado=`${motor}${m.libre?' sin sección':''} · ${i+1} de ${tanda.length} · ${x.q.slice(0,60)}`;pintarMedicion();
      const r=await medirPregunta(x,motor,doc,{libre:m.libre,esperadoDoc});
      r.esperado=esperadoDoc?nombreDeSeccion(esperadoDoc):null;r.motor=motor;
      const fila={...x,motor,libre:m.libre,aprendido:resumenAp,...r,...calificarMedicion(x,r),
        modelo:motor==='manual'?'sin modelo':(r.modeloReal||appState.chatModel),modeloPedido:motor==='manual'?null:appState.chatModel,
        lectura:LECTURA_VERSION,version:VERSION_APP,fecha:new Date().toISOString()};
      const k=claveFila(motor,m.libre,x,conAp);
      m.filas=m.filas.filter(f=>claveFila(f.motor,f.libre,f,f.aprendido&&f.aprendido!=='apagado')!==k);
      m.filas.push(fila);
      guardar();
      pintarMedicion();
      /* Lo que cortó la cuota del día no es un resultado: se quita, y mañana
         se retoma desde aquí con el mismo examen. */
      if(r.error&&(r.claseError==='cuota-dia'||r.claseError==='key'||/quota|per day|resource.?exhausted|cuota/i.test(r.cuerpo))){
        m.filas.pop();
        guardar();
        showToast(r.claseError==='key'
          ?'La key no sirve (el proveedor la rechazó). Revísala en Ajustes y vuelve a abrir el examen: sigue donde se quedó.'
          :'Se acabó la cuota del día de tu key. Vuelve a abrir el mismo examen mañana: sigue donde se quedó.','warn',9000);
        break;
      }
      /* La pausa es por la cuota por minuto del proveedor: el modo manual no la gasta. */
      if(motor!=='manual'&&i<tanda.length-1&&!medicionDetener)await new Promise(ok=>setTimeout(ok,MEDICION_PAUSA_MS));
    }
  }finally{
    midiendo=false;
    m.estado=medicionDetener?'detenida':'terminada';
    appState.manualActivo=activoPrevio;renderSelectorSeccion();
    limpiarChatSilencioso();history=historialPrevio;saveChatHistory();
    try{await cerrojo?.release()}catch{}
    pintarMedicion();
  }
}
/* ── Antes de gastar una hora y la cuota del día: ¿está todo listo? ──
   Una sola llamada mínima para saber si la key sirve y si queda cuota; lo
   demás se revisa en el teléfono. Dice cuántas llamadas va a costar la tanda
   y en qué orden conviene correrla. */
const AGENTE_VUELTAS_ESTIMADAS=2.5;
async function chequeoAntesDeMedir(){
  const m=medicionActual;if(!m||midiendo)return;
  const motores=['clasico','agente','manual'].filter(k=>document.getElementById('med-'+k)?.checked);
  const lineas=[];
  const ok=t=>lineas.push({ok:true,t}),mal=t=>lineas.push({ok:false,t});
  const secciones=[...new Set(m.preguntas.map(x=>x.seccion))];
  const faltan=secciones.filter(s=>!docDeSeccion(s));
  faltan.length?mal(`Sin cargar: ${faltan.join(', ')}. Sus preguntas se saltan.`):ok(`Las ${secciones.length} secciones del examen están cargadas.`);
  const viejos=docs.filter(lecturaVieja);
  viejos.length?mal(`Lectura anterior del PDF en ${viejos.map(d=>nombreDeSeccion(d.name)).join(', ')}: vuelve a elegir esos PDF en Manuales.`):ok('Todos los manuales con la lectura nueva.');
  const docsEx=[...new Set(m.preguntas.map(x=>docDeSeccion(x.seccion)).filter(Boolean))];
  const sinFicha=docsEx.reduce((n,d)=>n+paginasSinFicha(d).length,0);
  if(motores.includes('agente'))sinFicha?mal(`Faltan ${sinFicha} páginas de ficha: se leen al empezar (${sinFicha} llamadas).`):ok('Fichas completas.');
  const conModelo=motores.filter(k=>k!=='manual');
  if(conModelo.length){
    try{appState.apiKey=sessionStorage.getItem('ap_api_key_'+appState.provider)||''}catch{}
    if(!hayKeyParaIA())mal('No hay key en Ajustes: solo se puede medir el modo manual.');
    else{
      m.estado='probando la key…';pintarMedicion();
      try{
        await callWithRetry(PROVIDERS[appState.provider],appState.apiKey,[{role:'user',content:'Responde solo: ok'}],appState.chatModel,5,0);
        ok(`La key responde con ${nombreCortoDeModelo(appState.chatModel)}.`);
      }catch(e){
        mal(e.clase==='cuota-dia'?'La cuota de hoy de esta key ya se acabó: mide mañana, o solo el modo manual.'
          :e.clase==='key'?'El proveedor rechaza la key: revísala en Ajustes.'
          :`La prueba de la key falló: ${String(e.message||e).slice(0,120)}`);
      }
    }
    const n=m.preguntas.length;
    const llamadas=Math.round((conModelo.includes('clasico')?n:0)+(conModelo.includes('agente')?n*AGENTE_VUELTAS_ESTIMADAS+sinFicha:0));
    const tope=(conModelo.includes('clasico')?n:0)+(conModelo.includes('agente')?n*AGENTE_MAX_RONDAS+sinFicha:0);
    const minutos=Math.ceil(n*conModelo.length*(MEDICION_PAUSA_MS/1000+12)/60);
    lineas.push({ok:null,t:`Costo estimado: ~${llamadas} llamadas (tope ${tope}), unos ${minutos} min con la pantalla encendida.`});
    if(conModelo.length>1)lineas.push({ok:null,t:'Si tu plan tiene pocas llamadas al día, corre primero solo el clásico completo y el agente al día siguiente: una tanda entera vale más que dos a medias.'});
  }
  m.chequeo=lineas;m.estado='listo';pintarMedicion();
}
function resultadoMedicion(){
  const m=medicionActual;
  return{examen:m.nombre,fecha:new Date().toISOString(),version:VERSION_APP,lectura:LECTURA_VERSION,
    proveedor:appState.provider,modelo:appState.chatModel,libre:!!m.libre,
    aprendizaje:m.conAprendido?{palabras:aprendido.palabras.filter(palabraActiva).length,atajos:aprendido.atajos.length}:'apagado',
    manuales:docs.map(d=>({seccion:nombreDeSeccion(d.name),paginas:d.pageCount||null,lectura:(d.lectura||1),
      paginasSinFicha:paginasSinFicha(d.name).length,ficha:estadoDeFicha(d.name).replace(/^ · /,'')||'sin ficha'})),
    resumen:resumenMedicion(m.filas),resultados:m.filas}
}
async function compartirMedicion(soloDescargar){
  const nombre=`medicion-modo-ia-${new Date().toISOString().slice(0,10)}.json`;
  const blob=new Blob([JSON.stringify(resultadoMedicion(),null,1)],{type:'application/json'});
  const archivo=new File([blob],nombre,{type:'application/json'});
  if(!soloDescargar&&navigator.canShare&&navigator.canShare({files:[archivo]})){
    try{await navigator.share({files:[archivo],title:'Medición del modo IA'});return}catch(e){if(e.name==='AbortError')return}
  }
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=nombre;
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function borrarMedicion(){
  const m=medicionActual;
  if(!m||midiendo||!confirm('¿Borrar el avance de esta medición?'))return;
  try{localStorage.removeItem(m.clave)}catch{}
  m.filas=[];m.estado='listo';pintarMedicion();
}
function mostrarPanelMedicion(){
  let p=document.getElementById('medicion-panel');
  if(!p){
    p=document.createElement('div');p.id='medicion-panel';p.className='test-panel-like';
    document.body.appendChild(p);
  }
  pintarMedicion();
}
function cerrarPanelMedicion(){
  if(midiendo&&!confirm('La medición sigue corriendo. ¿Detenerla y cerrar?'))return;
  medicionDetener=true;
  document.getElementById('medicion-panel')?.remove();
}
function pintarMedicion(){
  const p=document.getElementById('medicion-panel'),m=medicionActual;
  if(!p||!m)return;
  const res=resumenMedicion(m.filas);
  const total=m.preguntas.length*m.motores.length;
  const secciones=[...new Set(m.preguntas.map(x=>x.seccion))];
  const faltan=secciones.filter(s=>!docDeSeccion(s));
  const conModelo=m.motores.filter(k=>k!=='manual').length;
  const minutos=Math.ceil(Math.max(0,m.preguntas.length*conModelo-m.filas.filter(f=>f.motor!=='manual').length)*(MEDICION_PAUSA_MS/1000+12)/60);
  p.innerHTML=`
    <div class="test-head">
      <strong>Medir el modo IA</strong>
      <span class="test-veredicto ${midiendo?'mal':'bien'}">${escapeHtml(m.estado)}</span>
      <button onclick="cerrarPanelMedicion()" aria-label="Cerrar">✕</button>
    </div>
    <div class="med-controles">
      ${m.avisoFicha?`<div class="med-nota"><b>⚠ ${escapeHtml(m.avisoFicha)}</b></div>`:''}
      ${(m.chequeo||[]).length?`<div class="med-nota">${m.chequeo.map(l=>`${l.ok===true?'✅':l.ok===false?'⚠️':'ℹ️'} ${escapeHtml(l.t)}`).join('<br>')}</div>`:''}
      <div class="med-nota">${escapeHtml(m.nombre)} · ${m.preguntas.length} preguntas de ${secciones.length} secciones${faltan.length?` · <b>sin cargar:</b> ${faltan.map(escapeHtml).join(', ')}`:''}.
        Corre con tu key desde este teléfono; la key no entra en el archivo de resultados. Quedan ~${minutos} min: deja la pantalla encendida.</div>
      <label><input type="checkbox" id="med-clasico" ${m.motores.includes('clasico')?'checked':''} ${midiendo?'disabled':''}> Motor clásico</label>
      <label><input type="checkbox" id="med-agente" ${m.motores.includes('agente')?'checked':''} ${midiendo?'disabled':''}> Agente lector</label>
      <label><input type="checkbox" id="med-manual" ${m.motores.includes('manual')?'checked':''} ${midiendo?'disabled':''}> Modo manual (sin key)</label>
      <label title="Sin sección elegida, como pregunta el asesor: la app elige la sección de cada pregunta y, si dos empatan, se toca la del examen."><input type="checkbox" id="med-libre" ${m.libre?'checked':''} ${midiendo?'disabled':''}> Como el asesor: sin elegir sección</label>
      <label title="Por defecto se mide el código, sin lo que este teléfono aprendió del piso. Encendido, se mide con lo aprendido, para compararlo contra la medición sin él."><input type="checkbox" id="med-aprendido" ${m.conAprendido?'checked':''} ${midiendo?'disabled':''}> Con lo aprendido del piso</label>
      ${midiendo?'<button class="ref-general" onclick="medicionDetener=true;this.disabled=true">■ Detener</button>'
        :`<button class="ref-general" onclick="chequeoAntesDeMedir()">🩺 Chequeo antes de medir</button>
          <button class="ref-general" onclick="correrMedicion()">${m.filas.length?'▶ Seguir':'▶ Empezar'}</button>`}
      ${m.filas.length&&!midiendo?`<button class="ref-general" onclick="compartirMedicion(false)">📤 Compartir resultados</button>
        <button class="ref-general" onclick="compartirMedicion(true)">⬇ Descargar</button>
        <button class="ref-general" onclick="borrarMedicion()">Borrar avance</button>`:''}
    </div>
    <div class="test-resumen">${Object.entries(res).map(([motor,r])=>`<span><b>${escapeHtml(motor)}</b> datos ${r.aciertos} · no está ${r.noEstaBienDicho} · otra sección ${r.otraSeccion} · 1er texto ${r.primerTextoP50}${r.contestoElAgente?` · contestó el agente ${r.contestoElAgente}`:''}${r.seccionElegidaBien?` · sección bien ${r.seccionElegidaBien}${r.toquesDeEmpate?` (${r.toquesDeEmpate} toques)`:''}`:''}${r.avisosDeAtadura?` · cifra mal atada ${r.avisosDeAtadura}`:''}</span>`).join('')||'<span>Sin resultados todavía.</span>'}<span><b>avance</b> ${m.filas.length}/${total}</span></div>
    <div class="test-scroll"><table class="test-tabla"><tbody>${m.filas.slice().reverse().map(f=>`
      <tr class="${f.ok?'ok':'no'}">
        <td>${f.ok?'✓':'✕'}</td>
        <td class="test-tipo">${escapeHtml(f.motor)}${f.libre?' · sin sección':''} · ${escapeHtml(f.tipo)}</td>
        <td>${escapeHtml(f.q)}<div class="test-nota">${escapeHtml(f.seccion)}${f.cat?' · '+escapeHtml(f.cat):''}${f.ruta?` · eligió ${escapeHtml(f.ruta.seccion||'ninguna')}${f.seccionOk?'':' ✕'}`:''}</div></td>
        <td class="test-det">${escapeHtml((f.cuerpo||'').slice(0,220))}</td>
      </tr>`).join('')}</tbody></table></div>`;
}

/* ════════════════════════════════════════════════
   TEMA (dark / light)
══════════════════════════════════════════════ */
function toggleTheme() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const newTheme = isLight ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', newTheme);
  document.getElementById('theme-icon').textContent = newTheme === 'light' ? '🌙' : '☀';
  try { localStorage.setItem('ap_theme', newTheme); } catch {}
}

function loadTheme() {
  /* Es lo primero que corre al arrancar: si el navegador bloquea el
     almacenamiento y esto lanza, no llega a ejecutarse nada de lo demás. */
  let guardado = null;
  try { guardado = localStorage.getItem('ap_theme'); } catch {}
  const saved = guardado ||
    (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  if (saved === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    const icon = document.getElementById('theme-icon');
    if (icon) icon.textContent = '🌙';
  }
}

/* ════════════════════════════════════════════════
   ARRANQUE
════════════════════════════════════════════════ */
loadTheme();
{const pv=document.getElementById('pie-version');if(pv)pv.textContent=VERSION_APP}
initSystemPromptCounter();
loadSaved();
cargarTablero();

/* ════════════════════════════════════════════════
   SIN SEÑAL E INSTALABLE (sw.js, manifest.webmanifest)

   El service worker guarda la página, pdf.js, su worker, las librerías y las
   fuentes; los manuales ya vivían en IndexedDB. Con eso el modo manual abre y
   contesta en modo avión. En la junta, esa es la prueba: se quita la señal y
   se sigue preguntando.
════════════════════════════════════════════════ */
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();instalacion=e;renderChatVacio()});
window.addEventListener('appinstalled',()=>{instalacion=null;renderChatVacio();showToast('📲 Instalada. Ábrela desde su ícono: funciona sin señal.','success',4000)});
async function instalarApp(){
  if(!instalacion)return;
  const ev=instalacion;instalacion=null;
  ev.prompt();
  try{await ev.userChoice}catch{}
  renderChatVacio();
}
function claveActual(){try{return sessionStorage.getItem('ap_api_key_'+appState.provider)||''}catch{return''}}
window.addEventListener('offline',()=>{updateKeyStatus(claveActual());showToast('📵 Sin señal. Sigo contestando con tus manuales, aquí en el teléfono.','warn',4000)});
window.addEventListener('online',()=>{avisoSinRed=false;updateKeyStatus(claveActual())});
if('serviceWorker' in navigator&&location.protocol!=='file:'){
  navigator.serviceWorker.register('sw.js').then(reg=>{
    /* Primera instalación: avisar una vez que ya se puede usar sin señal. */
    if(navigator.serviceWorker.controller)return;
    const sw=reg.installing||reg.waiting;
    if(sw)sw.addEventListener('statechange',()=>{
      if(sw.state==='activated')showToast('✓ Lista para usarse sin señal en este teléfono.','success',3500);
    });
  }).catch(e=>console.warn('service worker',e));
}
if(!navigator.onLine)updateKeyStatus(claveActual());
const restauracion=restaurarManualesGuardados().catch(e=>console.warn('restaurar',e));

/* El arnés de medición (?test=1) vive en src/pruebas/arnes.js y solo se baja
   cuando se pide: no viaja al teléfono ni se guarda sin señal. */

if(new URLSearchParams(location.search).has('test')){
  /* Espera a que se restauren los manuales guardados, si los hay: medir solo
     contra el manual interno cuando el asesor tiene un PDF cargado daría un
     número que no es el suyo. */
  restauracion.then(()=>import('./pruebas/arnes.js')).then(m=>setTimeout(m.renderPanelPruebas,50))
    .catch(e=>console.error('arnés',e));
}
