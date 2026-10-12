// Los fragmentos: de los bloques de cada página a trozos indexados.
//
// Un fragmento nunca cruza de página.
//
// Salió de app.js en el paso 3 del ADR 0005, sin cambiar nada de lo que hace
// (golden master idéntico). Sin DOM: se importa igual desde Node.
import { indexChunk } from './indice.js';
import { normalizeText } from './texto.js';

/** @typedef {{ page: number, titulo?: string, blocks: import('./layout.js').Bloque[] }} PaginaLeida */

/* ════════════════════════════════════════════════
   RAG — CHUNKS DEL PDF CARGADO

   Un chunk = un bloque de la lámina, no 700 caracteres a ciegas.
   Nunca cruza de página, porque la cita de página es lo que hace
   la respuesta verificable, y arrastra el título de su sección.
════════════════════════════════════════════════ */
export const CHUNK_MAX=900;
export const TITULO_HUERFANO_RENGLON=40;   // renglón más largo de una lámina «solo listas»

/** @param {string} text @returns {string[]} */
export function splitLongBlock(text){
  if(text.length<=CHUNK_MAX)return[text];
  const parts=[];
  let rest=text;
  while(rest.length>CHUNK_MAX){
    const ventana=rest.slice(0,CHUNK_MAX);
    let cut=Math.max(ventana.lastIndexOf('. '),ventana.lastIndexOf('\n'));
    if(cut<CHUNK_MAX*0.5)cut=ventana.lastIndexOf(' ');
    if(cut<CHUNK_MAX*0.3)cut=CHUNK_MAX;
    parts.push(rest.slice(0,cut+1).trim());
    rest=rest.slice(cut+1);
  }
  if(rest.trim())parts.push(rest.trim());
  return parts
}

/** @param {PaginaLeida[]} pages @param {string} docName @returns {FragmentoIndexado[]} */
export function buildChunks(pages,docName){
  /** @type {FragmentoIndexado[]} */
  const chunks=[];
  let heading='';
  let n=0;
  /** @type {Array<{page:number,heading:string,text:string}>} */
  let trozos=[];
  /** @param {number} page @param {string} text */
  const push=(page,text)=>{
    const clean=text.trim();
    if(clean.length<15)return;
    trozos.push({page,heading,text:clean});
  };
  for(const pg of pages){
    trozos=[];
    let buf='';
    /* El título arrancaba con el documento y no con la página, así que una
       lámina sin títulos en mayúsculas heredaba el de la anterior: el fragmento
       del producto descontinuado se citaba como "pág. 9 · ESQUINEROS", que es
       una sección de la pág. 8. Y como el título se indexa, no solo se citaba
       mal: se buscaba mal. Cada página arranca con el suyo. */
    heading=pg.titulo||'';
    for(const b of pg.blocks){
      const h=(b.heading||'').replace(/\s+/g,' ').trim();
      if(h&&h!==heading){
        if(buf.trim())push(pg.page,buf);
        buf='';heading=h;
      }
      if(b.isHeading||b.esTitulo)continue;
      if(b.text.length>CHUNK_MAX){
        if(buf.trim())push(pg.page,buf);
        buf='';
        for(const part of splitLongBlock(b.text))push(pg.page,part);
        continue;
      }
      if(buf.length+b.text.length+1>CHUNK_MAX){push(pg.page,buf);buf=''}
      buf+=(buf?'\n':'')+b.text;
    }
    if(buf.trim())push(pg.page,buf);
    /* El nombre de la lámina («Básicos de Vitrina») se perdía si todo lo que
       hay debajo trae su propio título en mayúsculas (FOCAL, AMBIENTE):
       ningún fragmento lo llevaba y «cuáles son los básicos de vitrina» no
       encontraba la página. Si ningún fragmento lo usa y la lámina es solo de
       listas cortas (una infografía, no reglas con su explicación), va delante
       del título de cada uno, salvo donde ya está («Marcas» en MUNDOS Y
       MARCAS). En una lámina con frases no: «Básicos de Vitrina · SIMETRÍA»
       le ganaba a la página de BÁSICOS en «dónde van los básicos». */
    const t=(pg.titulo||'').replace(/\s+/g,' ').trim();
    /* Renglón de lista: corto, o la fila de una tabla («Botones — Material, Tamaño»). */
    const deLista=/** @param {string} l */l=>l.length<=TITULO_HUERFANO_RENGLON||(/ — /.test(l)&&!/\.\s/.test(l));
    const soloListas=trozos.every(x=>x.text.split('\n').every(deLista));
    if(t&&soloListas&&!trozos.some(x=>x.heading===t)){
      const tn=normalizeText(t).replace(/\s+/g,' ').trim();
      for(const x of trozos)if(x.heading&&!normalizeText(x.heading).replace(/\s+/g,' ').includes(tn))x.heading=t+' · '+x.heading;
    }
    for(const x of trozos)chunks.push(indexChunk({
      id:docName+'#'+(n++),source:'pdf',docName,page:x.page,heading:x.heading,text:x.text,figureIds:[]
    }));
  }
  return chunks
}
