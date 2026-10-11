// Asistente de Piso · Copyright (c) 2026 Gerardo Barrera.
// Licencia PolyForm Noncommercial 1.0.0: uso comercial solo con licencia escrita (LICENCIA-COMERCIAL.md).
//
// «Sigue en el manual»: qué lámina leer después de una respuesta.
//
// Lo que completa una lámina suele estar en las siguientes del mismo capítulo:
// la clasificación de Muebles enumera «estilos de mobiliario», y cada estilo es
// una de las láminas que siguen. Y quien pregunta en el piso sigue la ruta de
// los básicos (basicos.js): marcas, clasificación, liquidación… Los botones
// solo apuntan a lo que el manual trae; nunca a temas de fuera.
//
// Salió de app.js en el paso 7 del ADR 0005, sin cambiar nada de lo que hace.
// Sin DOM: se importa igual desde Node. Lo que es de la app entra como
// parámetro: las imágenes de las páginas, la ficha, qué básicos cubre la
// sección (lo contesta el motor local) y cuáles ya se preguntaron.
import { estado } from '../estado.js';
import { normalizeText, tokenize } from './texto.js';
import { nombreDeSeccion } from './secciones.js';
import { basicoDe, siguientesBasicos } from './basicos.js';

/** @typedef {{texto: string, q: string, pagina: number | undefined}} Siguiente */

/** El título de una página, si sirve como botón. @param {string} doc @param {number} n @returns {string} */
export function tituloDePagina(doc,n){
  const c=estado.docChunks.find(x=>x.docName===doc&&x.page===n&&x.heading&&!x.isFicha&&!x.isFigure);
  const h=c?/** @type {string} */(c.heading).replace(/^#+\s*/,'').replace(/\s+/g,' ').trim():'';
  /* Ni códigos, ni rótulos cortados («Vanguardista (2.6%):»), ni el check
     list, que es un formato para llenar y no algo que aprender. */
  if(h.length<4||h.length>60||/^\d|:$|%/.test(h)||/^check\s*list/i.test(h))return'';
  return h===h.toUpperCase()?h.charAt(0)+h.slice(1).toLowerCase():h;
}

/* Las páginas de un manual: las que tienen texto y las que solo traen imagen
   (`paginas`, manual → [{page,titulo,imagen}], las guarda la app al cargar). */
/** @param {string} docName @param {Map<string, PaginaGuardada[]>} [paginas] @returns {number[]} */
export function paginasDelManual(docName,paginas=new Map()){
  const s=new Set(estado.docChunks.filter(c=>c.docName===docName&&c.page&&!c.isFicha).map(c=>/** @type {number} */(c.page)));
  for(const p of paginas.get(docName)||[])s.add(p.page);
  return[...s].sort((a,b)=>a-b)
}

/* Hasta 3 botones: la lámina que sigue y el siguiente básico, intercalados.
   `paginas` va en el orden de la respuesta. Se miran las 3 láminas que siguen
   a CADA una, y van primero las que esas páginas ya mencionan. Pesa más la
   mención de una página con viñetas o corta, porque esa es un índice:
   «● Estilos de mobiliario» en la clasificación de Muebles lleva a «Estilo
   nórdico», la lámina de después. No cuentan las palabras de la pregunta ni
   las del nombre de la sección: «muebles» sale en todo el manual de Muebles.
   `cubiertos` es una función porque cuesta (contesta cada básico con el
   motor): solo se pide si hay páginas de dónde partir. */
/**
 * @param {string | null | undefined} doc
 * @param {Array<number | undefined> | null | undefined} paginas
 * @param {string | null | undefined} q
 * @param {{paginasGuardadas?: Map<string, PaginaGuardada[]>, ficha?: FichaManual | null,
 *   cubiertos?: () => Map<string, number>, preguntados?: Set<string>, max?: number}} [opciones]
 * @returns {Siguiente[]}
 */
export function siguientesDelManual(doc,paginas,q,{paginasGuardadas=new Map(),ficha=null,cubiertos=()=>new Map(),preguntados=new Set(),max=3}={}){
  const pags=/** @type {number[]} */([...new Set((paginas||[]).filter(n=>Number.isFinite(n)&&/** @type {number} */(n)>0))]);
  if(!doc||!pags.length)return[];
  const porPagina=pags.map(n=>estado.docChunks.filter(c=>c.docName===doc&&c.page===n&&!c.isFicha).map(c=>(c.heading||'')+' '+c.text).join('\n'));
  const vistas=new Set(pags);
  const titulos=new Set(pags.map(n=>normalizeText(tituloDePagina(doc,n))));
  const propia=new Set(tokenize(q||''));
  const raiz=(/** @type {string} */ w)=>w.slice(0,5);
  const comunes=new Set([...tokenize(q||''),...tokenize(nombreDeSeccion(doc)||'')].map(raiz));
  const menciones=pags.map((_,i)=>{
    const crudo=porPagina[i]||'',tk=tokenize(crudo);
    const vinetas=(crudo.match(/[●•▪■]/g)||[]).length;
    return{peso:vinetas>=2?3:tk.length<40?2:1,raices:new Set(tk.filter(w=>w.length>3).map(raiz))};
  });
  const todas=paginasDelManual(doc,paginasGuardadas);
  /** @type {Array<{n: number, t: string, orden: number, puntos: number}>} */
  const candidatas=[];
  pags.forEach((p,i)=>todas.filter(n=>n>p).slice(0,3).forEach((n,k)=>{
    if(vistas.has(n)||candidatas.some(c=>c.n===n))return;
    const t=tituloDePagina(doc,n);
    if(!t)return;
    const rs=tokenize(t).filter(w=>w.length>3).map(raiz).filter(r=>!comunes.has(r));
    const puntos=Math.max(0,...menciones.map(m=>rs.some(r=>m.raices.has(r))?m.peso:0));
    candidatas.push({n,t,orden:i*3+k,puntos});
  }));
  candidatas.sort((a,b)=>b.puntos-a.puntos||a.orden-b.orden);
  /** @type {Siguiente[]} */
  const siguen=[];
  for(const{n,t}of candidatas){
    const k=normalizeText(t);
    if(titulos.has(k))continue;
    titulos.add(k);
    const tk=tokenize(t);
    if(!tk.length||tk.every(w=>propia.has(w)))continue;
    const fp=ficha&&ficha.paginas[n];
    const p=fp&&(/** @type {string[]} */(fp.preguntas)||[])[0];
    siguen.push({texto:p||`${t} · pág. ${n}`,q:p||`¿Qué dice el manual sobre ${t.toLowerCase()}?`,pagina:n});
    vistas.add(n);
    if(siguen.length>=2)break;
  }
  const cubre=cubiertos();
  /** @type {Siguiente[]} */
  const basicos=[];
  for(const b of siguientesBasicos(basicoDe(q||''),preguntados,cubre)){
    const n=cubre.get(b.id);
    if(vistas.has(/** @type {number} */(n)))continue;
    vistas.add(/** @type {number} */(n));
    basicos.push({texto:b.pregunta,q:b.pregunta,pagina:n});
    if(basicos.length>=2)break;
  }
  const out=[];
  for(let i=0;i<2;i++){if(siguen[i])out.push(siguen[i]);if(basicos[i])out.push(basicos[i])}
  return out.slice(0,max)
}

/* De la ficha de las páginas que se leyeron: las preguntas que esas láminas
   contestan y que no son la misma que ya se hizo. Una por página. */
/**
 * @param {FichaManual | null | undefined} ficha
 * @param {number[]} paginas
 * @param {string | null | undefined} q
 * @param {number} [max]
 * @returns {string[]}
 */
export function sugerenciasDeFicha(ficha,paginas,q,max=3){
  const f=ficha;
  if(!f)return[];
  const propia=new Set(tokenize(q||''));
  /** @type {string[]} */
  const out=[];
  for(const n of paginas){
    for(const p of/** @type {string[]} */((f.paginas[n]&&f.paginas[n].preguntas)||[])){
      const t=tokenize(p);
      if(!t.length||t.filter(w=>propia.has(w)).length/t.length>0.6)continue;
      if(!out.includes(p)){out.push(p);break}
    }
    if(out.length>=max)break;
  }
  return out
}
