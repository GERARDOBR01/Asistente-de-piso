// La ruta: contra qué sección se responde una pregunta.
//
// Evidencia por sección; la conversación y los botones se quedan en app.js.
//
// Salió de app.js en el paso 4 del ADR 0005, sin cambiar nada de lo que hace
// (golden master idéntico). Sin DOM: se importa igual desde Node.
import { estado } from '../estado.js';
import { normalizeText, expandKeywords } from './texto.js';
import { vocabDeDoc } from './erratas.js';
import { nombreDeSeccion, seccionesNombradasEnPregunta, seccionNombradaComoTal, dichaComoSeccion } from './secciones.js';
import { nivelDeEvidencia } from './solidez.js';
import { retrieve, PDF_CANDIDATOS } from './busqueda.js';

/* Una sola búsqueda sobre todo lo cargado, agrupada por manual: con treinta
   manuales, treinta búsquedas por separado serían treinta barridos. Sin `doc`
   el nombre de la sección sí cuenta, que aquí es justo lo que distingue. */
/** @param {string} consulta @returns {Array<{ docName: string, nivel: number, score: number }>} */
export function evidenciaPorSeccion(consulta){
  /** @type {Map<string, Resultado[]>} */
  const por=new Map();
  for(const r of retrieve(consulta,{source:'pdf',limit:400})){
    if(!por.has(r.c.docName))por.set(r.c.docName,[]);
    /** @type {Resultado[]} */ (por.get(r.c.docName)).push(r);
  }
  return[...por].map(([docName,rs])=>({docName,nivel:nivelDeEvidencia(rs,consulta),score:rs[0].score}))
    .filter(c=>c.nivel>=1)
    .sort((a,b)=>b.nivel-a.nivel||b.score-a.score)
}

/* Con la sección activa vacía, ¿alguna otra cargada sí responde? Se pregunta
   solo cuando la activa no dio nada, así que no cuesta nada en el caso normal.

   Exigir evidencia sólida aquí era demasiado: medido, «¿cómo se exhiben las
   bicicletas?» encuentra en su manual la lámina titulada BICICLETAS —pág. 32,
   la respuesta exacta— pero se queda en nivel 1 porque solo casa una palabra.
   Y bajar a nivel 1 a secas tampoco vale: otro manual daba nivel 1 con un
   fragmento que no venía a cuento. Así que se pide que el mejor DESTAQUE sobre
   el segundo. Aquí no se responde nada, solo se señala a dónde ir: el precio de
   señalar mal es un botón que el asesor ignora. */
export const DESTAQUE_MIN=1.25;
/** @param {string} consulta @param {string | null} activo @returns {{ docName: string, nombre: string, motivo: 'evidencia' } | null} */
export function otraSeccionConEvidencia(consulta,activo){
  /** @type {Array<{ docName: string, nivel: number, score: number }>} */
  const cand=[];
  for(const d of estado.docs){
    if(d.name===activo)continue;
    const r=retrieve(consulta,{source:'pdf',limit:PDF_CANDIDATOS,doc:d.name});
    const nivel=nivelDeEvidencia(r,consulta);
    if(nivel>=1&&r.length)cand.push({docName:d.name,nivel,score:r[0].score});
  }
  if(!cand.length)return null;
  cand.sort((a,b)=>b.nivel-a.nivel||b.score-a.score);
  const[mejor,segundo]=cand;
  if(mejor.nivel<2&&segundo&&segundo.score*DESTAQUE_MIN>mejor.score)return null;
  return{docName:mejor.docName,nombre:nombreDeSeccion(mejor.docName),motivo:'evidencia'}
}

/* ¿La pregunta nombra OTRA sección cargada que no es la activa? Es el caso
   que en el piso sale caro: los manuales comparten plantilla, así que con la
   sección equivocada la respuesta sale con una cifra creíble y falsa. */
/**
 * @param {string} query la pregunta escrita
 * @param {string} activo la sección activa
 * @returns {{ docName: string, nombre: string, motivo: 'nombrada' } | null}
 */
export function otraSeccionNombrada(query,activo){
  /* Con la pregunta ESCRITA, nunca con la ampliada: si la ampliación pegó la
     pregunta anterior, sus palabras señalarían a la sección de aquel turno. */
  const nombradas=seccionesNombradasEnPregunta(query);
  /* Si nombra varias y una es la activa, manda la activa. */
  const nombrada=nombradas.some(n=>n.docName===activo)?null:nombradas[0]||null;
  if(!nombrada||nombrada.docName===activo)return null;
  /* Si el manual activo también usa esa palabra, puede ser tema suyo y no el
     nombre de otra sección: en MESA FINA, «¿dónde van los accesorios de bar?»
     mandaba a ACCESORIOS HOMBRE, y en FLORES Y VELAS, «los accesorios» —que es
     un título de su propio manual— también. Ahí solo manda a otra sección si la
     palabra va dicha como sección: «en accesorios, ¿cada cuánto…?». La palabra
     que la activa no escribe nunca sigue mandando siempre: «¿dónde van los
     vinos?» en ZAPATOS es de VINOS Y LICORES. Medido con 1938 preguntas de los
     títulos de cada manual: 12 cambios de sección sin motivo, ahora 0. */
  if(nombrada.termino&&!/^\d+$/.test(nombrada.termino)){
    const voc=vocabDeDoc(activo);
    const t=nombrada.termino;
    const formas=[t,t+'s',t+'es',t.replace(/e?s$/,'')];
    /* Y si la activa la usa en un TÍTULO, es suya aunque se diga como sección:
       en FLORES Y VELAS, «¿qué va en accesorios?» pregunta por su lámina
       ACCESORIOS, no por el manual de ACCESORIOS HOMBRE. */
    const enTitulo=estado.docChunks.some(c=>c.docName===activo&&c.heading&&normalizeText(c.heading).split(/\s+/).some(w=>formas.includes(w)));
    /* Y también si la activa la dice con otra palabra: ACCESORIOS HOMBRE no
       escribe «ropa» ni una vez, pero «¿cada cuánto le cambio la ropa al
       maniquí?» es suya —«actualiza la vestimenta cada 15 días»— y no de ROPA
       INTERIOR. Solo sinónimos de una palabra: «ropa de dormir» no cuenta. */
    const porSinonimo=expandKeywords(formas).filter(s=>!/\s/.test(s)).some(s=>voc.has(normalizeText(s).trim()));
    if((formas.some(v=>voc.has(v))||porSinonimo)&&(enTitulo||!dichaComoSeccion(query,formas)))return null;
  }
  return{docName:nombrada.docName,nombre:nombrada.nombre,motivo:'nombrada'}
}

/* Sin sección elegida, ¿de cuál es la pregunta? La que nombra, la de la
   conversación si es un seguimiento, o la única que tiene con qué responder.
   Si dos responden igual de bien, empate: lo decide el asesor. Lo que depende
   de la conversación llega de fuera, para poder correrla sin ella (Node, lab). */
/**
 * @param {string} q la pregunta escrita
 * @param {{ ampliada?: () => string, anterior?: string | null, elipsis?: boolean }} [conversacion]
 *   `ampliada`: la consulta con la pregunta anterior pegada si es un seguimiento
 *   (se pide solo si hace falta); `anterior`: la sección del turno anterior;
 *   `elipsis`: si la pregunta está incompleta («¿y en juveniles?»).
 * @returns {{ doc: string | null, motivo: string, alternativas: string[] }}
 */
export function rutaPorEvidencia(q,{ampliada=()=>q,anterior=null,elipsis=false}={}){
  /** @type {(doc: string | null, motivo: string, alternativas?: string[]) => { doc: string | null, motivo: string, alternativas: string[] }} */
  const ruta=(doc,motivo,alternativas=[])=>({doc,motivo,alternativas});
  const nombradas=seccionesNombradasEnPregunta(q);
  if(!nombradas.length){
    /* «en muebles, ¿qué pasillo dejo?»: MUEBLES no tiene palabra propia, pero
       dicha como sección la nombra (`seccionNombradaComoTal`). */
    const comoTal=seccionNombradaComoTal(q);
    if(comoTal)return ruta(comoTal.docName,'nombrada');
  }
  if(nombradas.length===1)return ruta(nombradas[0].docName,'nombrada');
  let cand=evidenciaPorSeccion(ampliada());
  if(nombradas.length>1){
    const solo=new Set(nombradas.map(n=>n.docName));
    cand=cand.filter(c=>solo.has(c.docName));
    if(!cand.length)return ruta(null,'empate',nombradas.slice(0,3).map(n=>n.docName));
  }else{
    if(anterior&&elipsis){
      /* Un seguimiento se queda en la sección de la pregunta anterior, salvo que
         lo escrito —sin la ampliación, que arrastra la pregunta anterior y por
         tanto su sección— no esté ahí y otra lo tenga claro: «¿y los cojines?»
         después de una pregunta de zapatos es otra sección, no un seguimiento. */
      const propia=evidenciaPorSeccion(q);
      if(propia.some(c=>c.docName===anterior)||!propia.some(c=>c.nivel>=2))return ruta(anterior,'seguimiento');
      cand=propia;
    }else if(anterior&&cand.some(c=>c.docName===anterior&&c.nivel>=2)){
      /* El asesor que viene preguntando de su sección no cambia de sección
         porque otra también hable de pasillos o del POS: si la de la
         conversación responde con evidencia sólida, se queda. Medido con cinco
         manuales reales, así es como «¿qué va en el pos?» deja de preguntar
         «¿en cuál estás?» a media conversación. Las otras quedan de botón. */
      return ruta(anterior,'seguimiento',cand.filter(c=>c.docName!==anterior&&c.nivel>=2).slice(0,2).map(c=>c.docName));
    }
  }
  if(!cand.length)return ruta(null,'ninguna');
  const[mejor,segundo]=cand;
  /** @param {{ nivel: number, score: number }} c */
  const cerca=c=>c.nivel===mejor.nivel&&c.score*DESTAQUE_MIN>mejor.score;
  if(segundo&&cerca(segundo)){
    /* Dos con evidencia sólida y parecida: eso lo decide el asesor. Con
       evidencia floja en las dos no hay nada que preguntar: se busca en todos
       y el «no está» sale solo. */
    if(mejor.nivel>=2)return ruta(null,'empate',cand.filter(cerca).slice(0,3).map(c=>c.docName));
    return ruta(null,'ninguna');
  }
  return ruta(mejor.docName,nombradas.length>1?'nombrada':'evidencia',
    cand.slice(1).filter(c=>c.nivel>=2).slice(0,2).map(c=>c.docName));
}
