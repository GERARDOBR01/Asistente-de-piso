// Asistente de Piso · Copyright (c) 2026 Gerardo Barrera.
// Licencia PolyForm Noncommercial 1.0.0: uso comercial solo con licencia escrita (LICENCIA-COMERCIAL.md).
//
// «Aprende del piso», la parte pura: qué es una palabra que se puede
// aprender, por qué un par no se aprende, con qué raíces se compara una
// pregunta con un atajo, qué palabras de la pregunta no usa el manual y cómo
// se limpia lo que llega de fuera (del teléfono o de un archivo compartido).
//
// Salió de app.js en el paso 7 del ADR 0005, sin cambiar nada de lo que hace.
// Sin DOM: se importa igual desde Node. Lo aprendido, su almacenamiento y
// las dos puertas (usar y aprender) se quedan en app.js; cómo lo consulta el
// motor está en aprendido.js.
import { STOPWORDS, normalizeText, tokenize, variantes, expandKeywords, palabrasDeConsulta } from './texto.js';
import { raizCorta, vocabDeDoc } from './erratas.js';
import { esVerbo } from './busqueda.js';
import { secDe } from './secciones.js';

export const APRENDE_CONFIRMACIONES=2;          // consultas distintas para activar una palabra
export const APRENDE_MAX_PALABRAS=60;           // por sección
export const APRENDE_MAX_ATAJOS=120;            // por sección
export const APRENDE_JACCARD=0.6;               // parecido de la pregunta con el atajo
export const APRENDE_VENTANA_REFORMULA=3*60e3;  // una reformulación llega en minutos
/** @typedef {{id: string, sec: string, piso: string, manual: string, conf: number, consultas: string[], origen: string, propuesta: boolean, t: number}} PalabraDelPiso */
/** @typedef {{id: string, sec: string, terminos: string[], ver: string[], pagina: number, conf: number, consultas: string[], t: number}} AtajoDelPiso */
/** @typedef {{v: number, palabras: PalabraDelPiso[], atajos: AtajoDelPiso[]}} Aprendido */
/** @returns {Aprendido} */
export function aprendidoVacio(){return{v:1,palabras:[],atajos:[]}}
/* Lo que se carga —del teléfono o de un archivo compartido— se trata como dato
   ajeno: solo campos conocidos, solo palabras, con tope. */
/** @param {any} d @returns {Aprendido} */
export function limpiarAprendido(d){
  const out=aprendidoVacio();
  if(!d||typeof d!=='object')return out;
  const txt=(/** @type {unknown} */v,/** @type {number} */n)=>typeof v==='string'?v.trim().slice(0,n):'';
  const ids=(/** @type {unknown} */v)=>Array.isArray(v)?v.filter((/** @type {unknown} */x)=>typeof x==='string').slice(-20):[];
  for(const p of Array.isArray(d.palabras)?d.palabras:[]){
    const piso=palabraAprendible(p&&p.piso),manual=palabraAprendible(p&&p.manual),sec=txt(p&&p.sec,120);
    if(!piso||!manual||!sec||piso===manual)continue;
    out.palabras.push({id:txt(p.id,24)||idAprende(),sec,piso,manual,conf:Math.max(0,Math.min(99,Number(p.conf)||0)),
      consultas:ids(p.consultas),origen:['lamina','reformulacion','quisiste','ia','importada','tablero'].includes(p.origen)?p.origen:'importada',
      propuesta:!!p.propuesta,t:Number(p.t)||Date.now()});
  }
  for(const a of Array.isArray(d.atajos)?d.atajos:[]){
    const sec=txt(a&&a.sec,120),pagina=Number(a&&a.pagina);
    const terminos=Array.isArray(a&&a.terminos)?[...new Set(a.terminos.map(palabraAprendible).filter(Boolean))].slice(0,12):[];
    if(!sec||!(pagina>0&&pagina<10000)||!terminos.length)continue;
    const ver=Array.isArray(a.ver)?a.ver.map(palabraAprendible).filter(Boolean).slice(0,8):[];
    out.atajos.push({id:txt(a.id,24)||idAprende(),sec,terminos,ver,pagina,conf:Math.max(1,Math.min(99,Number(a.conf)||1)),
      consultas:ids(a.consultas),t:Number(a.t)||Date.now()});
  }
  return out
}
export function idAprende(){return Date.now().toString(36)+Math.random().toString(36).slice(2,6)}
/* Una palabra suelta, sin dígitos: «burro» sí; «12», «30%» o «2do» no. */
/** @param {unknown} w @returns {string} */
export function palabraAprendible(w){
  const n=normalizeText(String(w||'')).trim();
  return /^[a-z]{3,30}$/.test(n)&&!STOPWORDS.has(n)?n:''
}
export const palabraActiva=(/** @type {PalabraDelPiso} */p)=>!p.propuesta&&p.conf>=APRENDE_CONFIRMACIONES;
/* Las raíces con las que se compara una pregunta con un atajo: las palabras de
   tema, sin verbos ni el nombre de la sección («¿dónde van los burros en
   MUEBLES?» y «burros» son la misma consulta dentro de MUEBLES). */
/** @param {string} q @param {string | null | undefined} doc @returns {string[]} */
export function palabrasDeAtajo(q,doc){
  const propio=new Set(doc?tokenize(secDe(doc)||''):[]);
  return palabrasDeConsulta(q).filter(k=>!esVerbo(k)&&!/\d/.test(k)&&!propio.has(k)&&k.length>=3)
}
/** @param {string} q @param {string | null | undefined} doc @returns {string[]} */
export function terminosDeAtajo(q,doc){return[...new Set(palabrasDeAtajo(q,doc).map(raizCorta))]}
/* Deja cada sección en `max` elementos. */
/**
 * @template {{id: string, sec: string, t: number}} T
 * @param {T[]} lista @param {string} sec @param {number} max @param {(x: T) => boolean} activa
 * @returns {T[]}
 */
export function recortarSeccion(lista,sec,max,activa){
  const deSec=lista.filter(x=>x.sec===sec);
  if(deSec.length<=max)return lista;
  /* Se van primero las viejas sin confirmar; lo activo se queda. */
  const fuera=new Set(deSec.filter(x=>!activa(x)).sort((a,b)=>a.t-b.t).slice(0,deSec.length-max).map(x=>x.id));
  return lista.filter(x=>!fuera.has(x.id))
}
/* Por qué NO se aprende un par; vacío si se puede. Sirve también para no
   ofrecer un «✓ Sí, eso» que no enseñaría nada. */
/** @param {string | null | undefined} doc @param {string} piso @param {string} manual @returns {string} */
export function motivoParaNoAprender(doc,piso,manual){
  const a=palabraAprendible(piso),b=palabraAprendible(manual);
  if(!a||!b)return'no es una palabra';
  if(a===b||variantes(a).includes(b)||raizCorta(a)===raizCorta(b))return'es la misma palabra';
  if(esVerbo(a)||esVerbo(b))return'es un verbo';
  if(doc){
    const voc=vocabDeDoc(doc);
    if(!variantes(b).some(v=>voc.has(v)))return'el manual no la usa';
    if(variantes(a).some(v=>voc.has(v)))return'el manual ya la usa';
  }
  for(const v of variantes(a))for(const frase of expandKeywords([v]))if(tokenize(frase).includes(b))return'ya está en el diccionario';
  return''
}
/* Las palabras de la pregunta que ese manual no usa: son las «raras» del piso. */
/** @param {string} q @param {string | null | undefined} doc @returns {string[]} */
export function palabrasRaras(q,doc){
  if(!doc)return[];
  const voc=vocabDeDoc(doc),propio=new Set(tokenize(secDe(doc)||''));
  return palabrasDeConsulta(q).filter(k=>palabraAprendible(k)&&k.length>=4&&!esVerbo(k)&&!propio.has(k)
    &&!variantes(k).some(v=>voc.has(v)))
}
