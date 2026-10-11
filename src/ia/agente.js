// Asistente de Piso · Copyright (c) 2026 Gerardo Barrera.
// Licencia PolyForm Noncommercial 1.0.0: uso comercial solo con licencia escrita (LICENCIA-COMERCIAL.md).
//
// El agente lector: el modo IA con la IA al mando. El modelo decide qué leer
// del manual con herramientas locales y de solo lectura; el código pone los
// topes, valida cada argumento y comprueba las citas.
//
// Salió de app.js en el paso 7 del ADR 0005, sin cambiar nada de lo que hace,
// y sin DOM: con un proveedor falso, el ciclo entero corre en Node. Lo que es
// de la app entra como parámetro: el historial, las fichas, las imágenes de
// las páginas (`paginas`, manual → [{page,titulo,imagen}]) y los reintentos.
import { estado as corpus } from '../estado.js';
import { normalizeText } from '../motor/texto.js';
import { retrieve, chunkLabel } from '../motor/busqueda.js';
import { filtroSolidez } from '../motor/solidez.js';
import { nombreDeSeccion } from '../motor/secciones.js';
import { envolverComoDato, textoComoDato, REGLA_DATO } from '../seguridad/inyeccion.js';
import { errorDeProveedor } from './errores.js';
import { PROVIDERS, razonamientoGemini } from './proveedores.js';
import { jsonDeTexto } from './respuesta.js';
import { paginasDelManual } from '../motor/sigue.js';

/* ════════════════════════════════════════════════
   AGENTE LECTOR — el modo IA con la IA al mando

   El motor clásico decide con BM25 qué fragmentos ve el modelo y le da
   órdenes según lo que encontró. Si la búsqueda falla —«contemporáneo» no
   llega a «Contempo», «Trevsik» no llega a «Tresvik», las marcas están en
   un logo—, el modelo nunca ve la respuesta y obedece un «no está».

   Aquí el que decide es el modelo. Recibe el MAPA del manual (una línea por
   página, de la ficha) y herramientas que corren en el teléfono: leer páginas
   completas, mirar la imagen de una lámina, buscar literal. Lee lo que
   necesita y contesta citando lo que leyó.

   El código es el guardián, no el que decide:
   · pone topes de vueltas, páginas, imágenes y llamadas;
   · valida cada argumento: página que no existe o herramienta que no existe
     vuelve al modelo como error, nunca como excepción;
   · las herramientas son locales y de solo lectura: un texto raro dentro de
     un PDF no puede hacer nada más que ser leído;
   · comprueba que cada cita de la EVIDENCIA esté, literal, en una página que
     el agente leyó, y si no, baja la certeza y lo dice;
   · y ante cualquier fallo del ciclo, contesta el motor clásico.
════════════════════════════════════════════════ */
export const AGENTE_MAX_RONDAS=4;      // vueltas modelo → herramientas; la última ya no puede pedir nada
export const AGENTE_MAX_PAGINAS=8;     // páginas leídas por pregunta
export const AGENTE_MAX_IMAGENES=2;    // láminas vistas por pregunta
export const AGENTE_MAX_LLAMADAS=6;    // herramientas por vuelta
export const AGENTE_ANTICIPADAS=2;     // páginas que la búsqueda local le adelanta
export const AGENTE_MAX_TOKENS=2500;
export const AGENTE_MAX_TOKENS_CORTE=4500;  // una sola repetición con más margen si no cupo
export const CITA_MIN=0.8;             // parte de las palabras de una cita que debe estar en su página

export const HERRAMIENTAS=[
  {name:'leer_paginas',
   description:'Lee el texto completo de páginas del manual de la sección activa, con lo que se transcribió de sus imágenes. Úsala antes de afirmar cualquier dato. Máximo 4 páginas por llamada.',
   parameters:{type:'object',properties:{paginas:{type:'array',items:{type:'integer'},description:'Números de página del mapa'}},required:['paginas']}},
  {name:'ver_lamina',
   description:'Mira la imagen de una página: planogramas, diagramas, logos de marcas, fotos de exhibición. Úsala cuando la respuesta dependa de algo visual.',
   parameters:{type:'object',properties:{pagina:{type:'integer',description:'Número de página'}},required:['pagina']}},
  {name:'buscar',
   description:'Busca palabras en el manual de la sección activa (literal, con plurales, sinónimos y erratas). Devuelve páginas y un extracto. Útil para nombres raros o cuando el mapa no basta.',
   parameters:{type:'object',properties:{texto:{type:'string',description:'Palabras a buscar'}},required:['texto']}},
  {name:'buscar_en_otras_secciones',
   description:'Solo para decirle al asesor en qué OTRA sección cargada aparece algo que la suya no trae. Devuelve nombre de sección y páginas, nunca su contenido.',
   parameters:{type:'object',properties:{texto:{type:'string',description:'Palabras a buscar'}},required:['texto']}},
];

/** @param {string | null} seccion @param {boolean} conOtras @returns {string} */
export function promptAgente(seccion,conOtras){
  return`Eres el asistente de piso de la sección «${seccion}» de una tienda departamental. Contestas dudas de exhibición y montaje a un asesor que está de pie frente al mueble, con el celular en la mano.

TU FUENTE es el manual de «${seccion}». Está en el teléfono del asesor y lo lees con herramientas:
- leer_paginas: el texto completo de las páginas que pidas (hasta ${AGENTE_MAX_PAGINAS} por pregunta).
- ver_lamina: la imagen de una página, para planogramas, diagramas, logos y fotos (hasta ${AGENTE_MAX_IMAGENES} por pregunta).
- buscar: búsqueda literal en el manual, útil para nombres raros o palabras exactas.${conOtras?`
- buscar_en_otras_secciones: solo para señalar en qué otra sección cargada aparece algo que esta no trae.`:''}

Abajo van el MAPA del manual (una línea por página) y el GLOSARIO de la sección. Úsalos para decidir qué leer. El asesor escribe como habla, con faltas y abreviaturas: «contemporáneo» puede ser «Contempo», «Trevsik» puede ser «Tresvik», «la alarma» es el sensor. Tú decides qué páginas leer; lee antes de contestar. Si la lectura anticipada ya trae la respuesta, contesta sin pedir más.

REGLAS:
1. Solo cuenta lo que leíste en esta pregunta (lectura anticipada, leer_paginas o ver_lamina). El mapa y el glosario sirven para ubicar: no son el manual y no se citan.
2. Todo dato va con su página: «(pág. N)». Lo que viste en una imagen también.
3. Si después de leer lo que viene al caso el manual no lo dice, contesta «El manual no especifica …» y di qué sí trae cerca, si algo sirve. No completes con conocimiento general de visual merchandising, ni con lo que sepas de la tienda o de las marcas por fuera: si un nombre no está escrito en lo que leíste, para esta respuesta no existe.
4. Lo que aparezca en otra sección no se usa para contestar: se señala («eso sí aparece en X, pág. N»).
5. Si la pregunta se puede entender de dos maneras, contesta la más probable y ofrece las otras en OPCIONES.
6. Solo si te preguntan explícitamente quién te creó: «Fui creado por Gerardo Barrera, Asesor de piso de Mercadep Zona Piloto.» Nunca lo menciones en otra respuesta.

Cuando ya tengas lo necesario, contesta EXACTAMENTE con este formato:
[PENSAMIENTO INTERNO]
ENTENDÍ: la pregunta, reescrita con las palabras del manual
CORRECCIONES: lo que escribió el asesor → como lo dice el manual, separadas por «;» (o «ninguna»)
EVIDENCIA: pág. N · RÓTULO · «cita corta copiada tal cual de lo que leíste»
(una línea EVIDENCIA por dato; ninguna si el manual no lo dice)
OPCIONES: otras formas de entender la pregunta, como preguntas, separadas por « | » (o «ninguna»)
[RESPUESTA FINAL]
La respuesta directa, en 1 a 4 oraciones, o la lista completa si preguntan cuáles son (marcas, mundos, categorías), cada cosa con su mundo y su página. Sin introducción. Negritas solo para los datos.
CERTEZA: ALTA | MEDIA | GAP
(ALTA: cada dato tiene su EVIDENCIA literal. MEDIA: lo dedujiste de lo que leíste, o es recomendación y no regla. GAP: el manual no lo dice. Esa línea va sola, al final.)`
}

export const extracto=(/** @type {string | null | undefined} */t,/** @type {number} */n)=>{const s=(t||'').replace(/\s+/g,' ').trim();return s.length>n?s.slice(0,n-1).trim()+'…':s};

/* El MAPA es lo que el agente ve del manual antes de leer: una línea por
   página. Con ficha, lo que la IA vio en cada lámina; sin ella, los títulos y
   el arranque del texto. Nunca es fuente de una respuesta —la regla 1 lo dice
   y la verificación de citas lo hace cumplir—, solo le dice dónde mirar. */
/** @param {string} doc @param {Map<string, FichaManual>} fichas @param {Map<string, PaginaGuardada[]>} paginas @returns {string} */
export function mapaDeSeccion(doc,fichas,paginas){
  const f=fichas.get(doc);
  const lineas=[];
  for(const n of paginasDelManual(doc,paginas)){
    const fp=f&&f.paginas[n];
    let linea;
    if(fp){
      const nombra=[...fp.mundos,...fp.marcas.slice(0,10)].join(', ');
      linea=`pág. ${n} · ${fp.titulo||'(sin título)'} — ${fp.resumen}${fp.temas.length?' · temas: '+fp.temas.join(', '):''}${nombra?' · nombra: '+nombra:''}${fp.texto_visual?' · trae texto dentro de la imagen':''}`;
    }else{
      const propios=corpus.docChunks.filter(c=>c.docName===doc&&c.page===n&&!c.isFicha);
      const titulos=[...new Set(propios.map(c=>c.heading).filter(Boolean))].slice(0,4);
      linea=`pág. ${n} · ${titulos.join(' / ')||'(sin título)'} — ${extracto(propios.map(c=>c.text).join(' '),110)}`;
    }
    lineas.push(extracto(linea,300));
  }
  return lineas.join('\n')
}
/* Las marcas, los mundos y las abreviaturas de toda la sección, juntos: es lo
   que permite entender «Trevsik» o «contemporáneo» sin leer nada todavía. */
/** @param {string} doc @param {Map<string, FichaManual>} fichas @returns {string} */
export function glosarioDeSeccion(doc,fichas){
  const f=fichas.get(doc);
  if(!f)return'';
  const marcas=new Map(),mundos=new Map(),alias=new Set();
  const anota=(/** @type {Map<string, Set<string>>} */m,/** @type {string} */k,/** @type {string} */n)=>{if(!m.has(k))m.set(k,new Set());/** @type {Set<string>} */(m.get(k)).add(n)};
  for(const[n,fp]of Object.entries(f.paginas)){
    for(const m of fp.marcas||[])anota(marcas,m,n);
    for(const m of fp.mundos||[])anota(mundos,m,n);
    for(const a of fp.alias||[])alias.add(a);
  }
  const fmt=(/** @type {Map<string, Set<string>>} */mp)=>[...mp].map(([k,s])=>`${k} (pág. ${[...s].join(', ')})`).join('; ');
  return[marcas.size?'Marcas: '+fmt(marcas):'',mundos.size?'Mundos: '+fmt(mundos):'',alias.size?'Alias: '+[...alias].join(' · '):'']
    .filter(Boolean).join('\n').slice(0,3000)
}

/* El historial que ve un modelo. Las respuestas del modo manual eran 1,800
   caracteres de fragmentos tal cual; mandadas de vuelta, el modelo las leía
   como contexto de esta pregunta. Se quedan como lo que fueron. Y de las del
   agente viaja también lo que entendió, que es lo que resuelve un «¿y en el
   clásico?». Solo role y content: OpenAI rechaza campos que no conoce. */
/**
 * @param {Array<{role: string, content: string, modo?: string, entendi?: string}>} historial
 * @param {number} [n]
 * @returns {MensajeIA[]}
 */
export function historialParaModelo(historial,n=6){
  return historial.slice(-n).map(m=>{
    if(m.role==='assistant'&&m.modo==='manual')return{role:'assistant',content:'(Esa vez contesté sin modelo, enseñando fragmentos del manual tal cual.)'};
    if(m.role==='assistant'&&m.entendi)return{role:'assistant',content:`(Entendí: ${m.entendi})\n${m.content}`};
    return{role:m.role,content:m.content}
  })
}

/* ── Herramientas: corren en el teléfono, solo leen ── */
/** @param {string} doc @param {Map<string, PaginaGuardada[]>} [paginas] @returns {EstadoAgente} */
export function nuevoEstadoAgente(doc,paginas=new Map()){
  return{doc,paginas,leidas:new Map(),vistas:new Set(),chunks:[],otras:[],rondas:0,tokens:0,imagenes:0,llamadas:[]}
}
/** @param {EstadoAgente} estado @param {number} page @returns {string} */
export function leerPaginaAgente(estado,page){
  if(estado.leidas.has(page))return /** @type {string} */(estado.leidas.get(page));
  const propios=corpus.docChunks.filter(c=>c.docName===estado.doc&&c.page===page&&c.isFicha!=='indice');
  const texto=envolverComoDato(propios.map(c=>chunkLabel(c)+'\n'+textoComoDato(c.text)).join('\n\n'));
  estado.leidas.set(page,texto);
  estado.chunks.push(...propios);
  return texto
}
/** @param {unknown} v @returns {string} */
export function textoDeArg(v){return typeof v==='string'?v.replace(/\s+/g,' ').trim().slice(0,200):''}
/** @param {LlamadaAgente | null | undefined} ll @param {EstadoAgente} estado @returns {{texto: string, imagen?: {page: number, dataUrl: string}}} */
export function ejecutarHerramienta(ll,estado){
  const args=ll&&ll.args&&typeof ll.args==='object'&&!Array.isArray(ll.args)?ll.args:{};
  const validas=paginasDelManual(estado.doc,estado.paginas);
  const existe=new Set(validas);
  const rango=validas.length?`tiene de la pág. ${validas[0]} a la ${validas[validas.length-1]}`:'no tiene páginas';
  switch(ll&&ll.name){
    case'leer_paginas':{
      const crudas=Array.isArray(args.paginas)?args.paginas:args.pagina!=null?[args.pagina]:[];
      const pedidas=[...new Set(crudas.map((/** @type {any} */n)=>parseInt(n,10)).filter(Number.isFinite))];
      if(!pedidas.length)return{texto:'Error: pide al menos un número de página del mapa.'};
      const salida=[];
      const fuera=pedidas.filter(n=>!existe.has(n));
      if(fuera.length)salida.push(`Error: ${fuera.length===1?'la página':'las páginas'} ${fuera.join(', ')} no existe${fuera.length===1?'':'n'} (el manual ${rango}).`);
      const repetidas=pedidas.filter(n=>existe.has(n)&&estado.leidas.has(n));
      if(repetidas.length)salida.push(`${repetidas.length===1?'La pág.':'Las págs.'} ${repetidas.join(', ')} ya ${repetidas.length===1?'la':'las'} leíste arriba.`);
      for(const n of pedidas.filter(n=>existe.has(n)&&!estado.leidas.has(n)).slice(0,4)){
        if(estado.leidas.size>=AGENTE_MAX_PAGINAS){salida.push(`Límite de ${AGENTE_MAX_PAGINAS} páginas por pregunta: contesta con lo que ya leíste.`);break}
        salida.push(leerPaginaAgente(estado,n)||`[pág. ${n}] no tiene texto: prueba ver_lamina.`);
      }
      return{texto:salida.join('\n\n')}
    }
    case'ver_lamina':{
      const n=parseInt(args.pagina,10);
      if(!existe.has(n))return{texto:`Error: la página ${args.pagina} no existe (el manual ${rango}).`};
      if(estado.vistas.has(n))return{texto:`Ya viste la lámina de la pág. ${n}.`};
      if(estado.imagenes>=AGENTE_MAX_IMAGENES)return{texto:`Límite de ${AGENTE_MAX_IMAGENES} láminas por pregunta: contesta con lo que ya viste.`};
      /* Lo que se ve en una lámina se cita con su página, así que su texto
         cuenta como leído: es contra lo que se verifica la cita. */
      const texto=leerPaginaAgente(estado,n);
      const img=(estado.paginas.get(estado.doc)||[]).find(p=>p.page===n);
      if(!img||!img.imagen)return{texto:`No tengo la imagen de la pág. ${n} (el manual se cargó sin ella). Esto es su texto:\n${texto}`};
      estado.vistas.add(n);estado.imagenes++;
      return{texto:`La imagen de la pág. ${n} va a continuación. Su texto:\n${texto}`,imagen:{page:n,dataUrl:img.imagen}}
    }
    case'buscar':{
      const t=textoDeArg(args.texto);
      if(!t)return{texto:'Error: dime qué palabras buscar.'};
      const r=retrieve(t,{source:'pdf',limit:12,doc:estado.doc}).filter(x=>x.hits+x.hitsSyn+x.hitsErrata>0);
      const porPagina=new Map();
      for(const x of r)if(!porPagina.has(x.c.page))porPagina.set(x.c.page,x);
      if(!porPagina.size)return{texto:`Sin coincidencias literales para «${t}». Prueba otra palabra o elige por el mapa.`};
      return{texto:[...porPagina.values()].slice(0,5).map(x=>`pág. ${x.c.page} · ${x.c.heading||'sin título'} · «${extracto(textoComoDato(x.c.text),160)}»`).join('\n')}
    }
    case'buscar_en_otras_secciones':{
      const t=textoDeArg(args.texto);
      if(!t)return{texto:'Error: dime qué palabras buscar.'};
      const hallazgos=[];
      for(const d of corpus.docs){
        if(d.name===estado.doc)continue;
        const r=retrieve(t,{source:'pdf',limit:6,doc:d.name}).filter(filtroSolidez(t));
        if(r.length)hallazgos.push({docName:d.name,nombre:nombreDeSeccion(d.name),paginas:[...new Set(r.map(x=>x.c.page))].slice(0,3)});
      }
      estado.otras=hallazgos;
      if(!hallazgos.length)return{texto:`Ninguna otra sección cargada trae «${t}».`};
      return{texto:hallazgos.map(h=>`${h.nombre}: pág. ${h.paginas.join(', ')}`).join('\n')+'\nNo tienes esos textos: dile al asesor dónde está, pero no contestes con datos de ahí.'}
    }
    default:
      return{texto:`Error: la herramienta «${ll&&ll.name}» no existe. Usa leer_paginas, ver_lamina o buscar.`}
  }
}
/** @param {LlamadaAgente} ll @returns {string} */
export function describirLlamada(ll){
  const a=ll.args||{};
  if(ll.name==='leer_paginas')return`Leyendo el manual · pág. ${(Array.isArray(a.paginas)?a.paginas:[a.pagina]).filter((/** @type {unknown} */x)=>x!=null).slice(0,4).join(', ')}`;
  if(ll.name==='ver_lamina')return`Mirando la lámina de la pág. ${a.pagina}`;
  if(ll.name==='buscar')return`Buscando «${textoDeArg(a.texto)}» en el manual`;
  if(ll.name==='buscar_en_otras_secciones')return`Buscando «${textoDeArg(a.texto)}» en tus otras secciones`;
  return'Revisando el manual…'
}

/* ── Adaptadores: el mismo ciclo habla con Gemini y con OpenAI ──
   La conversación interna es neutral: system, user, assistant (con sus
   llamadas) y tool (con sus resultados e imágenes). Cada proveedor la traduce. */
/** @param {RespuestaHttp} res @param {(o: any) => void} alObjeto */
export async function leerSSE(res,alObjeto){
  const reader=res.body.getReader(),decoder=new TextDecoder('utf-8');
  let buffer='';
  const linea=(/** @type {string} */l)=>{
    const t=l.trim();
    const j=t.startsWith('data:')?t.slice(5).trim():t;
    if(!j||j==='[DONE]'||j[0]!=='{')return;
    try{alObjeto(JSON.parse(j))}catch{}
  };
  while(true){
    const{value,done}=await reader.read();
    if(done)break;
    buffer+=decoder.decode(value,{stream:true});
    const ls=buffer.split('\n');buffer=ls.pop()||'';
    ls.forEach(linea);
  }
  linea(buffer);
}
/* Gemini 3 firma su razonamiento (`thoughtSignature`) dentro de las partes
   que devuelve, y exige recibirlas de vuelta tal cual en la siguiente vuelta.
   Por eso las partes del modelo se guardan crudas y se devuelven sin tocar;
   solo se juntan los trozos de texto del streaming que no llevan firma. */
/** @param {any[]} partes @returns {any[]} */
export function compactarPartes(partes){
  /** @type {any[]} */
  const out=[];
  for(const p of partes){
    const previa=out[out.length-1];
    const soloTexto=(/** @type {any} */x)=>x&&typeof x.text==='string'&&Object.keys(x).length===1;
    if(soloTexto(p)&&soloTexto(previa))previa.text+=p.text;
    else out.push(soloTexto(p)?{text:p.text}:p);
  }
  return out
}
/** @param {MensajeAgente[]} conv @returns {{systemInstruction?: {parts: {text: any}[]}, contents: {role: string, parts: any[]}[]}} */
export function convAGemini(conv){
  let systemInstruction;
  const contents=[];
  for(const m of conv){
    if(m.role==='system'){systemInstruction={parts:[{text:m.content}]};continue}
    if(m.role==='user'){contents.push({role:'user',parts:[{text:m.content}]});continue}
    if(m.role==='assistant'){
      let parts=m.crudo&&m.crudo.gemini
        ?m.crudo.gemini
        :[...(m.content?[{text:m.content}]:[]),...(m.llamadas||[]).map(l=>({functionCall:{name:l.name,args:l.args||{}}}))];
      if(!parts.length)parts=[{text:m.content||''}];
      contents.push({role:'model',parts});continue
    }
    if(m.role==='tool'){
      /** @type {any[]} */
      const parts=/** @type {NonNullable<MensajeAgente['resultados']>} */(m.resultados).map(r=>({functionResponse:{...(r.idReal?{id:r.id}:{}),name:r.name,response:{resultado:r.content}}}));
      for(const im of m.imagenes||[])parts.push({text:`Imagen de la pág. ${im.page}:`},{inline_data:{mime_type:'image/jpeg',data:im.dataUrl.split(',')[1]}});
      contents.push({role:'user',parts});
    }
  }
  return{systemInstruction,contents}
}
/** @param {MensajeAgente[]} conv @returns {any[]} */
export function convAOpenAI(conv){
  /** @type {any[]} */
  const out=[];
  for(const m of conv){
    if(m.role==='system'||m.role==='user'){out.push({role:m.role,content:m.content});continue}
    if(m.role==='assistant'){
      /** @type {Record<string, unknown>} */
      const msg={role:'assistant',content:m.content||''};
      if(m.llamadas&&m.llamadas.length)msg.tool_calls=m.llamadas.map(l=>({id:l.id,type:'function',function:{name:l.name,arguments:JSON.stringify(l.args||{})}}));
      out.push(msg);continue
    }
    if(m.role==='tool'){
      for(const r of /** @type {NonNullable<MensajeAgente['resultados']>} */(m.resultados))out.push({role:'tool',tool_call_id:r.id,content:r.content});
      /* OpenAI no acepta imágenes en un mensaje de herramienta: van en uno del
         usuario justo después. */
      if((m.imagenes||[]).length)out.push({role:'user',content:/** @type {NonNullable<MensajeAgente['imagenes']>} */(m.imagenes).flatMap(im=>[
        {type:'text',text:`Imagen de la pág. ${im.page}:`},{type:'image_url',image_url:{url:im.dataUrl}}])});
    }
  }
  return out
}
/** @param {ParamsAgente} p @returns {Promise<VueltaAgente>} */
export async function agenteGemini({key,model,conv,herramientas,forzarRespuesta,maxTokens,temperature,onDelta,signal}){
  const{systemInstruction,contents}=convAGemini(conv);
  /** @type {Record<string, any>} */
  const body={contents,generationConfig:{maxOutputTokens:maxTokens,temperature:temperature??0.2,thinkingConfig:razonamientoGemini(model)}};
  if(systemInstruction)body.systemInstruction=systemInstruction;
  if(herramientas&&herramientas.length){
    body.tools=[{functionDeclarations:herramientas}];
    body.toolConfig={functionCallingConfig:{mode:forzarRespuesta?'NONE':'AUTO'}};
  }
  const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`,{
    method:'POST',headers:PROVIDERS.gemini._headers(key),body:JSON.stringify(body),signal
  });
  if(!res.ok){const data=await res.json().catch(()=>({}));throw errorDeProveedor(res.status,data)}
  /** @type {any[]} */
  const partes=[];
  let texto='',tokens=0,razon='';
  await leerSSE(res,obj=>{
    for(const p of obj?.candidates?.[0]?.content?.parts||[]){
      partes.push(p);
      if(typeof p.text==='string'&&p.text&&!p.thought){texto+=p.text;onDelta&&onDelta(p.text)}
    }
    const m=obj?.usageMetadata?.totalTokenCount;
    if(m)tokens=m;
    if(obj?.candidates?.[0]?.finishReason)razon=obj.candidates[0].finishReason;
    if(obj?.promptFeedback?.blockReason)razon='BLOCK:'+obj.promptFeedback.blockReason;
  });
  const llamadas=partes.filter(p=>p.functionCall).map((p,i)=>({
    id:p.functionCall.id||('g'+i),idReal:!!p.functionCall.id,name:p.functionCall.name,args:p.functionCall.args||{}}));
  return{texto,llamadas,crudo:{gemini:compactarPartes(partes)},tokens,fin:finDeRespuesta(razon)}
}
/* Por qué terminó la respuesta. Una cortada por tokens no es una respuesta
   mala: es una respuesta que no cupo, y se califica distinto. */
/** @param {unknown} r @returns {'corte' | 'bloqueo' | 'ok'} */
export function finDeRespuesta(r){
  const t=String(r||'').toUpperCase();
  if(t==='MAX_TOKENS'||t==='LENGTH')return'corte';
  if(/SAFETY|RECITATION|PROHIBITED|BLOCK|CONTENT_FILTER|SPII|BLOCKLIST/.test(t))return'bloqueo';
  return'ok'
}
/** @param {ParamsAgente} p @returns {Promise<VueltaAgente>} */
export async function agenteOpenAI({key,model,conv,herramientas,forzarRespuesta,maxTokens,temperature,onDelta,signal}){
  /** @type {Record<string, any>} */
  const body={model,messages:convAOpenAI(conv),max_tokens:maxTokens,temperature:temperature??0.2,stream:true,stream_options:{include_usage:true}};
  if(herramientas&&herramientas.length){
    body.tools=herramientas.map(h=>({type:'function',function:h}));
    body.tool_choice=forzarRespuesta?'none':'auto';
  }
  const res=await fetch('https://api.openai.com/v1/chat/completions',{
    method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`},body:JSON.stringify(body),signal
  });
  if(!res.ok){const data=await res.json().catch(()=>({}));throw errorDeProveedor(res.status,data)}
  let texto='',tokens=0,razon='';
  /** @type {Array<{id: string, name: string, args: string}>} */
  const acum=[];
  await leerSSE(res,obj=>{
    const d=obj?.choices?.[0]?.delta;
    if(d&&typeof d.content==='string'&&d.content){texto+=d.content;onDelta&&onDelta(d.content)}
    for(const tc of d?.tool_calls||[]){
      const i=tc.index??0;
      const a=acum[i]||(acum[i]={id:'',name:'',args:''});
      if(tc.id)a.id=tc.id;
      if(tc.function?.name)a.name+=tc.function.name;
      if(tc.function?.arguments)a.args+=tc.function.arguments;
    }
    if(obj?.usage?.total_tokens)tokens=obj.usage.total_tokens;
    if(obj?.choices?.[0]?.finish_reason)razon=obj.choices[0].finish_reason;
  });
  const llamadas=acum.filter(Boolean).map((a,i)=>({id:a.id||('o'+i),idReal:!!a.id,name:a.name,args:jsonDeTexto(a.args)||{}}));
  return{texto,llamadas,crudo:null,tokens,fin:finDeRespuesta(razon)}
}
/* Los dos proveedores ganan su forma de hablar con el agente. */
/** @type {any} */(PROVIDERS.gemini).agente=agenteGemini;
/** @type {any} */(PROVIDERS.openai).agente=agenteOpenAI;

/** @param {MensajeAgente[]} conv */
export function quitarImagenes(conv){
  for(const m of conv){
    if(m.role!=='tool'||!(m.imagenes||[]).length)continue;
    m.imagenes=[];
    const res=/** @type {NonNullable<MensajeAgente['resultados']>} */(m.resultados);
    const ult=res[res.length-1];
    if(ult)ult.content+='\n(La imagen no se pudo mandar: usa el texto de la página y lo transcrito de su imagen.)';
  }
}

/* ── Lo que el agente ve antes de la primera vuelta ──
   Sistema + mapa + glosario van primero y no cambian entre preguntas de la
   misma sección: es el prefijo que el caché implícito del proveedor reusa.
   Lectura anticipada: las páginas que la búsqueda local ya encuentra sólidas
   van leídas desde el principio. En la mayoría de las preguntas eso ahorra
   una vuelta entera; si no sirven, el agente pide otras. */
/**
 * @param {{q: string, doc: string, consulta: string, historial: Array<{role: string, content: string, modo?: string, entendi?: string}>, fichas: Map<string, FichaManual>, paginas: Map<string, PaginaGuardada[]>}} p
 */
export function prepararAgente({q,doc,consulta,historial,fichas,paginas}){
  const estado=nuevoEstadoAgente(doc,paginas);
  const seccion=nombreDeSeccion(doc);
  const conOtras=corpus.docs.length>1;
  const herramientas=HERRAMIENTAS.filter(h=>conOtras||h.name!=='buscar_en_otras_secciones');
  const glosario=glosarioDeSeccion(doc,fichas);
  const system=promptAgente(seccion,conOtras)+REGLA_DATO()
    +`\n\n=== MAPA DEL MANUAL DE «${seccion}» (para ubicar; no es el manual) ===\n${textoComoDato(mapaDeSeccion(doc,fichas,paginas))}`
    +(glosario?`\n\n=== GLOSARIO DE LA SECCIÓN (para ubicar; no es el manual) ===\n${textoComoDato(glosario)}`:'');
  /** @type {number[]} */
  const anticipadas=[];
  for(const r of retrieve(consulta,{source:'pdf',limit:20,doc}).filter(filtroSolidez(consulta))){
    if(!anticipadas.includes(/** @type {number} */(r.c.page)))anticipadas.push(/** @type {number} */(r.c.page));
    if(anticipadas.length>=AGENTE_ANTICIPADAS)break;
  }
  const textoAnticipado=anticipadas.map(n=>leerPaginaAgente(estado,n)).join('\n\n');
  const conv=[{role:'system',content:system},...historialParaModelo(historial,6),{role:'user',content:
    (textoAnticipado?`=== LECTURA ANTICIPADA · pág. ${anticipadas.join(', ')} (la búsqueda local cree que pueden servir; si no, pide otras) ===\n${textoAnticipado}\n\n`:'')
    +`PREGUNTA DEL ASESOR: ${q}`}];
  return{estado,conv,herramientas,anticipadas}
}

/* ── El ciclo: modelo → herramientas → modelo, con topes ──
   `reintentos(provider, model, intento, opciones)` es el bucle de reintentos y
   respaldo de la app (conReintentos); en Node, cualquier función que llame a
   `intento(model)` y devuelva lo suyo con `model`. */
/**
 * @param {{estado: EstadoAgente, conv: MensajeAgente[], herramientas: ParamsAgente['herramientas'],
 *   provider: {agente: (p: ParamsAgente) => Promise<VueltaAgente>}, key: string, model: string, temperature?: number | null,
 *   signal?: AbortSignal | null, onDelta?: (t: string) => void, onRonda?: (n: number) => void, onEstado?: (t: string) => void,
 *   onRetry?: (ms: number, clase: string) => void, onRespaldo?: (de: string, a: string) => void,
 *   reintentos: (provider: any, model: string, intento: (m: string) => Promise<VueltaAgente>, opciones: object) => Promise<VueltaAgente>}} p
 * @returns {Promise<{texto: string, estado: EstadoAgente, model: string, respaldo: {de: string, a: string} | null, contexto: string}>}
 */
export async function cicloAgente({estado,conv,herramientas,provider,key,model,temperature,signal,onDelta,onRonda,onEstado,onRetry,onRespaldo,reintentos}){
  let modeloUsado=model,respaldo=null,sinImagenes=false,margen=AGENTE_MAX_TOKENS;
  estado.cortes=0;
  for(let ronda=1;ronda<=AGENTE_MAX_RONDAS;ronda++){
    const ultima=ronda===AGENTE_MAX_RONDAS;
    onRonda&&onRonda(ronda);
    let r;
    try{
      r=await reintentos(provider,model,(/** @type {string} */m)=>provider.agente({key,model:m,conv,herramientas,forzarRespuesta:ultima,
        maxTokens:margen,temperature,onDelta,signal}),
        {signal,onRetry,onRespaldo:(/** @type {string} */de,/** @type {string} */a)=>{respaldo={de,a};onRespaldo&&onRespaldo(de,a)}});
    }catch(/** @type {any} */err){
      /* Una imagen dentro de la respuesta a una herramienta es lo único de este
         protocolo que no todos los modelos aceptan. Si el proveedor la rechaza,
         la vuelta se repite sin imágenes y el agente sigue con el texto. */
      if(err.name!=='AbortError'&&err.status===400&&!sinImagenes&&conv.some(m=>(m.imagenes||[]).length)){
        sinImagenes=true;quitarImagenes(conv);ronda--;continue;
      }
      throw err
    }
    modeloUsado=r.model||modeloUsado;
    estado.tokens+=r.tokens||0;estado.rondas=ronda;
    /* Bloqueada por el proveedor: no es del manual; que conteste el clásico. */
    if(r.fin==='bloqueo')throw new Error('el proveedor bloqueó la respuesta');
    /* No cupo antes de la respuesta final: se repite esa vuelta una vez con más
       margen. Sin esto, un tope de tokens se calificaba como respuesta mala. */
    if(r.fin==='corte'&&!r.llamadas.length&&!/RESPUESTA\s+FINAL/i.test(r.texto||'')&&margen<AGENTE_MAX_TOKENS_CORTE){
      estado.cortes++;margen=AGENTE_MAX_TOKENS_CORTE;
      onRonda&&onRonda(ronda);ronda--;continue;
    }
    if(!r.llamadas.length||ultima){
      if(!(r.texto||'').trim())throw new Error('el agente terminó sin respuesta');
      return{texto:r.texto,estado,model:modeloUsado,respaldo,contexto:[...estado.leidas.values()].join('\n\n')}
    }
    conv.push({role:'assistant',content:r.texto,llamadas:r.llamadas,crudo:r.crudo});
    /** @type {NonNullable<MensajeAgente['resultados']>} */
    const resultados=[];
    /** @type {NonNullable<MensajeAgente['imagenes']>} */
    const imagenes=[];
    r.llamadas.forEach((ll,i)=>{
      if(i>=AGENTE_MAX_LLAMADAS){
        resultados.push({id:ll.id,idReal:ll.idReal,name:ll.name,content:`No se ejecutó: máximo ${AGENTE_MAX_LLAMADAS} herramientas por vuelta.`});
        return
      }
      onEstado&&onEstado(describirLlamada(ll));
      let res;
      try{res=ejecutarHerramienta(ll,estado)}catch(/** @type {any} */e){res={texto:`Error al ejecutar ${ll.name}: ${e.message}`}}
      estado.llamadas.push(ll.name);
      resultados.push({id:ll.id,idReal:ll.idReal,name:ll.name,content:res.texto});
      if(res.imagen)imagenes.push(res.imagen);
    });
    if(ronda===AGENTE_MAX_RONDAS-1&&resultados.length)
      resultados[resultados.length-1].content+='\n\n(Es la última vuelta con herramientas: en la siguiente contesta con lo que leíste, en el formato indicado.)';
    conv.push({role:'tool',resultados,imagenes});
  }
  throw new Error('el agente no cerró')
}

/* ── Lo que el agente dijo que leyó, contra lo que de verdad leyó ── */
/** @param {string | null | undefined} thinking */
export function camposDelAgente(thinking){
  const t=thinking||'';
  const linea=(/** @type {string} */k)=>{const m=t.match(new RegExp('^[\\s*_-]*'+k+'[*_]*\\s*:\\s*(.+)$','im'));return m?m[1].trim():''};
  const nada=(/** @type {string} */v)=>!v||/^[«"]?(ninguna?s?|no|n\/a|—|-)[»"]?\.?$/i.test(v.trim());
  const entendi=linea('ENTEND[IÍ]');
  const corr=linea('CORRECCIONES');
  const correcciones=nada(corr)?[]:corr.split(/\s*;\s*/).map(x=>{
    const m=x.match(/^[«"“]?(.+?)[»"”]?\s*(?:→|->|=>)\s*[«"“]?(.+?)[»"”]?\.?$/);
    return m?{escribio:m[1].trim(),manual:m[2].trim()}:null
  }).filter(x=>x&&x.escribio&&x.manual&&normalizeText(x.escribio).trim()!==normalizeText(x.manual).trim()).slice(0,3);
  const evidencia=[];
  for(const m of t.matchAll(/EVIDENCIA[*_]*\s*:\s*(?:p[áa]g(?:ina)?s?\.?\s*(\d+))?([^\n«"“]*)[«"“]([^»"”\n]+)[»"”]/gi))
    evidencia.push({page:m[1]?Number(m[1]):null,rotulo:m[2].replace(/[·|]/g,' ').trim(),cita:m[3].trim()});
  const op=linea('OPCIONES');
  const opciones=nada(op)?[]:op.split(/\s*\|\s*/).map(x=>x.trim()).filter(x=>x.length>3&&!nada(x)).slice(0,3);
  return{entendi:nada(entendi)?'':entendi,correcciones,evidencia,opciones}
}
/** @param {Array<{page: number | null, rotulo?: string, cita: string}> | null | undefined} evidencia @param {EstadoAgente} estado */
export function verificarCitas(evidencia,estado){
  const malas=[];
  const paginas=new Map([...estado.leidas].map(([n,t])=>[n,' '+normalizeText(t).replace(/\s+/g,' ')+' ']));
  for(const e of evidencia||[]){
    const palabras=normalizeText(e.cita).split(/\s+/).filter(w=>w.length>=3||/\d/.test(w));
    if(!palabras.length)continue;
    const cubre=(/** @type {string} */txt)=>palabras.filter(w=>txt.includes(' '+w+' ')).length/palabras.length;
    if(e.page!=null&&paginas.has(e.page)&&cubre(/** @type {string} */(paginas.get(e.page)))>=CITA_MIN)continue;
    let otra=null;
    for(const[n,txt]of paginas)if(cubre(txt)>=CITA_MIN){otra=n;break}
    /* Sin número de página es un descuido de formato, no una invención: si la
       cita está en algo que leyó, vale. */
    if(otra!=null&&e.page==null)continue;
    malas.push({...e,motivo:otra!=null?`está en la pág. ${otra}, no en la ${e.page}`
      :e.page!=null&&!paginas.has(e.page)?`la pág. ${e.page} no la leyó`:'no aparece en lo que leyó'});
  }
  return{total:(evidencia||[]).length,malas}
}
