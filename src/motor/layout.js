// Cómo se lee una lámina: de los trozos de texto de pdf.js a bloques con título.
//
// Solo geometría: no sabe de manuales ni de búsqueda.
//
// Salió de app.js en el paso 3 del ADR 0005, sin cambiar nada de lo que hace
// (golden master idéntico). Sin DOM: se importa igual desde Node.

/* ════════════════════════════════════════════════
   MOTOR 2 — RECONSTRUCCIÓN LAYOUT-AWARE

   El manual de un cliente no es texto corrido: es una presentación.
   En una misma lámina conviven dos reglas distintas, una en cada
   columna, a la misma altura. El motor 1 agrupaba los fragmentos
   solo por coordenada Y, así que fusionaba ambas columnas en una
   línea y le entregaba al modelo una regla que no existe: el
   "¿Qué es?" de ALINEACIÓN pegado al de LIMPIEZA.

   Aquí el texto se reconstruye en tres pasos —fragmentos → líneas
   (cortadas donde hay hueco horizontal) → bloques (agrupados por
   cercanía)— y solo al final se ordena, por bandas horizontales y
   de izquierda a derecha dentro de cada banda.
════════════════════════════════════════════════ */
/**
 * @typedef {{ str?: string, transform: number[], width: number, height: number }} ItemDeTexto  lo que da pdf.js por cada trozo de texto
 * @typedef {{ transform: number[], height: number, rotation?: number }} Vista  el viewport de pdf.js
 * @typedef {{ text: string, x0: number, x1: number, yBot: number, yTop: number, h: number }} Linea
 * @typedef {{ lines: string[], heading: string,
 *   hx0: number|null, hx1: number|null, hy1: number|null, hy0: number|null, hh: number|null,
 *   x0: number, x1: number, yTop: number, yBot: number,
 *   lastX0: number, lastX1: number, lastYBot: number, lastH: number }} BloqueCrudo
 * @typedef {BloqueCrudo & { hx0: number, hx1: number, hy1: number, hy0: number, hh: number }} TituloCrudo
 * @typedef {{ text: string, heading: string, isHeading: boolean,
 *   hx0: number|null, hx1: number|null, hy1: number|null,
 *   x0: number, y0: number, x1: number, y1: number, esTitulo?: boolean }} Bloque
 * @typedef {Bloque & { hx0: number, hx1: number, hy1: number }} Titulo
 * @typedef {{ page: number, blocks: Bloque[], titulo: string,
 *   textBoxes: Array<{ x0: number, y0: number, x1: number, y1: number }> }} Pagina
 */

/* El producto de dos matrices afines de PDF [a b c d e f], con la misma fórmula
   y el mismo orden de operaciones que pdfjsLib.Util.transform (pdf.js 3.11):
   así el layout no depende de pdf.js y corre en Node. */
/** @param {number[]} m1 @param {number[]} m2 @returns {number[]} */
export const multiplicar = (m1, m2) => [
  m1[0] * m2[0] + m1[2] * m2[1],
  m1[1] * m2[0] + m1[3] * m2[1],
  m1[0] * m2[2] + m1[2] * m2[3],
  m1[1] * m2[2] + m1[3] * m2[3],
  m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
  m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
];

export const LINE_GAP_RATIO=1.2;      // hueco que corta una línea, en múltiplos de la altura de fuente
export const BLOCK_GAP_RATIO=1.7;     // separación vertical máxima dentro de un bloque
export const BLOCK_OVERLAP_MIN=0.25;  // solape horizontal mínimo para seguir en el mismo bloque
export const LINE_OTRA_LETRA=1.4;     // razón de tamaños de letra que, con hueco, separa dos celdas

/** @param {ItemDeTexto[]} items @param {Vista} vp @returns {Linea[]} */
export function textItemsToLines(items,vp){
  const rot=(((vp.rotation||0)%360)+360)%360;
  const swap=(rot===90||rot===270);
  const raw=[];
  for(const it of items){
    const s=it.str||'';
    if(!s.trim())continue;
    const t=multiplicar(vp.transform,it.transform);
    const h=Math.abs(swap?it.width:it.height)||Math.hypot(t[2],t[3])||10;
    const w=Math.abs(swap?it.height:it.width)||0;
    raw.push({str:s,x0:t[4],x1:t[4]+w,yBot:t[5],h,cw:s.length?w/s.length:h*0.5});
  }
  if(!raw.length)return[];
  raw.sort((a,b)=>a.yBot-b.yBot||a.x0-b.x0);

  // Franjas de misma línea base
  /** @type {Array<{yBot:number,h:number,items:typeof raw}>} */
  const rows=[];
  for(const it of raw){
    const row=rows[rows.length-1];
    if(row&&Math.abs(it.yBot-row.yBot)<=Math.max(2,row.h*0.5)){
      row.items.push(it);row.h=Math.max(row.h,it.h);
    }else rows.push({yBot:it.yBot,h:it.h,items:[it]});
  }

  // Cada franja se corta donde hay un hueco horizontal: ahí acaba una
  // columna y empieza otra. Es el corte que el motor 1 nunca hizo.
  /** @type {Linea[]} */
  const lines=[];
  for(const row of rows){
    row.items.sort((a,b)=>a.x0-b.x0);
    /** @type {Linea|null} */
    let seg=null;
    let hAnt=0;
    for(const it of row.items){
      const gapTol=Math.max(it.cw*2.5,row.h*LINE_GAP_RATIO);
      /* Otra letra con hueco de por medio es otra celda: el rótulo «SMART
         CASUAL» (22 pt) y la marca «Jack & Paul» (12 pt) a su derecha. */
      const otraCelda=hAnt&&Math.max(it.h,hAnt)/Math.min(it.h,hAnt)>LINE_OTRA_LETRA&&it.x0-(seg?seg.x1:0)>Math.min(it.h,hAnt)*0.8;
      if(seg&&it.x0-seg.x1<=gapTol&&!otraCelda){
        seg.text+=(it.x0-seg.x1>it.cw*0.4?' ':'')+it.str;
        seg.x1=Math.max(seg.x1,it.x1);
        seg.h=Math.max(seg.h,it.h);
      }else{
        if(seg)lines.push(seg);
        seg={text:it.str,x0:it.x0,x1:it.x1,yBot:row.yBot,yTop:0,h:Math.max(it.h,row.h)};
      }
      hAnt=it.h;
    }
    if(seg)lines.push(seg);
  }
  for(const ln of lines){
    ln.text=ln.text.replace(/\s+/g,' ').trim();
    ln.yTop=ln.yBot-ln.h;
  }
  return lines.filter(l=>l.text)
}

/* El solape se mide contra la ÚLTIMA línea del bloque, no contra su caja
   acumulada. Midiendo contra la caja, en cuanto un bloque toca un título ancho
   se vuelve ancho él mismo, y a partir de ahí absorbe las dos columnas: una
   sola lámina termina siendo un bloque con la página entera dentro.

   Y un título en mayúsculas siempre abre bloque. En estos manuales cada regla
   empieza por su nombre —ALINEACIÓN, LIMPIEZA, SURTIDO—, así que ese es el
   corte semántico real de la lámina. */
/** @param {Linea[]} lines @returns {BloqueCrudo[]} */
export function linesToBlocks(lines){
  lines.sort((a,b)=>a.yTop-b.yTop||a.x0-b.x0);
  /** @type {BloqueCrudo[]} */
  const blocks=[];
  /** @param {BloqueCrudo} b @param {Linea} ln */
  const attach=(b,ln)=>{
    b.lines.push(ln.text);
    b.x0=Math.min(b.x0,ln.x0);b.x1=Math.max(b.x1,ln.x1);
    b.yBot=Math.max(b.yBot,ln.yBot);
    b.lastX0=ln.x0;b.lastX1=ln.x1;b.lastYBot=ln.yBot;b.lastH=ln.h;
  };
  for(const ln of lines){
    const esTitulo=isHeadingText(ln.text);
    /** @type {BloqueCrudo|null} */
    let best=null,bestGap=Infinity;
    if(!esTitulo)for(const b of blocks){
      const gap=ln.yTop-b.lastYBot;
      const tol=Math.max(b.lastH,ln.h);
      if(gap>tol*BLOCK_GAP_RATIO||gap<-tol)continue;
      const ov=Math.min(b.lastX1,ln.x1)-Math.max(b.lastX0,ln.x0);
      const narrow=Math.min(b.lastX1-b.lastX0,ln.x1-ln.x0)||1;
      if(ov/narrow<BLOCK_OVERLAP_MIN)continue;
      if(gap<bestGap){best=b;bestGap=gap}
    }
    if(best)attach(best,ln);
    else blocks.push({
      lines:esTitulo?[]:[ln.text],heading:esTitulo?ln.text:'',
      hx0:esTitulo?ln.x0:null,hx1:esTitulo?ln.x1:null,hy1:esTitulo?ln.yBot:null,
      hy0:esTitulo?ln.yTop:null,hh:esTitulo?ln.h:null,
      x0:ln.x0,x1:ln.x1,yTop:ln.yTop,yBot:ln.yBot,
      lastX0:ln.x0,lastX1:ln.x1,lastYBot:ln.yBot,lastH:ln.h
    });
  }
  return blocks
}

/* Orden de lectura: bandas horizontales de arriba abajo, y dentro de cada
   banda de izquierda a derecha. Ordenar por Y a secas intercala las columnas. */
/** @param {BloqueCrudo[]} blocks @returns {BloqueCrudo[]} */
export function orderBlocks(blocks){
  blocks.sort((a,b)=>a.yTop-b.yTop||a.x0-b.x0);
  /** @type {Array<{yBot:number,items:BloqueCrudo[]}>} */
  const bands=[];
  for(const b of blocks){
    const band=bands[bands.length-1];
    if(band&&b.yTop<band.yBot-Math.min(b.lastH,4)){
      band.items.push(b);band.yBot=Math.max(band.yBot,b.yBot);
    }else bands.push({yBot:b.yBot,items:[b]});
  }
  const out=[];
  for(const band of bands){band.items.sort((a,b)=>a.x0-b.x0);out.push(...band.items)}
  return out
}

/* Un encabezado de tabla que no cabe en su celda se parte en dos renglones:
   «TENIS» arriba y «CASUAL» abajo. Como cada renglón en mayúsculas abre su
   bloque, el cuerpo —«N % de participación»— quedaba bajo «CASUAL», igual que
   el de la columna vecina, y el contexto traía dos CASUAL con cifras distintas:
   el modelo no tenía cómo saber cuál era el de tenis. Se unen solo si:
   el de arriba está solo (sin cuerpo y sin otro título pegado encima), el de
   abajo sí titula algo, van pegados, en la misma columna y con la misma letra.
   Una lista de rótulos en mayúsculas no se une: son tres o más apilados, o
   ninguno titula nada. */
export const TITULO_APILADO_GAP=0.8;   // hueco máximo entre los dos renglones, en alturas de letra
export const TITULO_APILADO_MAX=40;
/** @param {BloqueCrudo[]} blocks @returns {BloqueCrudo[]} */
export function unirTitulosApilados(blocks){
  /** @param {number} a0 @param {number} a1 @param {number} b0 @param {number} b1 */
  const solape=(a0,a1,b0,b1)=>Math.min(a1,b1)-Math.max(a0,b0);
  /** @param {TituloCrudo} a @param {TituloCrudo} b */
  const pegado=(a,b)=>{
    const h=Math.max(a.hh,b.hh);
    const gap=b.hy0-a.hy1;
    if(gap<-h*0.3||gap>h*TITULO_APILADO_GAP)return false;
    if(Math.abs(a.hh-b.hh)>0.2*h)return false;
    return solape(a.hx0,a.hx1,b.hx0,b.hx1)>=0.5*Math.min(a.hx1-a.hx0,b.hx1-b.hx0)
  };
  const titulos=/** @type {TituloCrudo[]} */(blocks.filter(b=>b.heading&&b.hy0!=null&&b.hh));
  if(titulos.length<2)return blocks;
  /** @param {BloqueCrudo} b */
  const tituloSolo=b=>!b.lines.length;
  /** @param {TituloCrudo} b */
  const titulaAlgo=b=>b.lines.length>0||blocks.some(c=>!c.heading&&c.lines.length&&
    c.yTop>=b.hy1-2&&c.yTop-b.hy1<=b.hh*6&&solape(c.x0,c.x1,b.hx0,b.hx1)>0);
  /** @type {Set<BloqueCrudo>} */
  const quitar=new Set();
  for(const a of titulos){
    if(!tituloSolo(a)||quitar.has(a))continue;
    if(titulos.some(o=>o!==a&&tituloSolo(o)&&pegado(o,a)))continue;   // tercero de una pila
    const b=titulos.find(o=>o!==a&&!quitar.has(o)&&pegado(a,o));
    if(!b||!titulaAlgo(b))continue;
    if(titulos.some(o=>o!==b&&o!==a&&pegado(b,o)))continue;          // b está a media pila
    const unido=a.heading.trim()+' '+b.heading.trim();
    if(unido.length>TITULO_APILADO_MAX)continue;
    b.heading=unido;
    b.hx0=Math.min(a.hx0,b.hx0);b.hx1=Math.max(a.hx1,b.hx1);b.hy0=a.hy0;
    b.x0=Math.min(a.x0,b.x0);b.x1=Math.max(a.x1,b.x1);b.yTop=Math.min(a.yTop,b.yTop);
    quitar.add(a);
  }
  return quitar.size?blocks.filter(b=>!quitar.has(b)):blocks
}

/** @param {string} [t] */
export function isHeadingText(t){
  const s=(t||'').trim();
  if(s.length<3||s.length>80)return false;
  if(/[,;]$/.test(s))return false;  // "TODO LUGAR," es media frase de una cita, no un título
  const letters=s.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g,'');
  if(letters.length<3)return false;
  return letters===letters.toUpperCase()
}

/* El título de un bloque es el que tiene ENCIMA y en su misma columna, no el
   último que apareció en el orden de lectura. En una lámina de dos reglas en
   paralelo, el orden de lectura pone ALINEACIÓN, luego LIMPIEZA, y solo
   después los cuerpos de ambas: heredar "el último título visto" le cuelga a
   la regla de alineación la etiqueta de limpieza. Citar mal la sección es peor
   que no citarla. */
export const HEADING_MAX_DY=500;      // más abajo de esto ya es otra sección de la lámina
export const HEADING_OFFSET_PENALTY=120; // un título que no solapa en X puede seguir siendo el tuyo, pero pesa
/** @param {Bloque[]} blocks @returns {Bloque[]} */
export function assignHeadings(blocks){
  /* Candidato es todo bloque que empiece por título, aunque traiga cuerpo pegado:
     SURTIDO arrastra su primera línea de texto y aun así titula las tres cajas
     que tiene debajo. Se compara contra la caja del título, no la del bloque. */
  const titulos=/** @type {Titulo[]} */(blocks.filter(b=>b.heading&&b.hy1!=null));
  for(const b of blocks){
    if(b.heading)continue;
    /** @type {Titulo|null} */
    let best=null,bestD=Infinity;
    for(const h of titulos){
      const dy=b.y0-h.hy1;
      if(dy<-2||dy>HEADING_MAX_DY)continue;
      /* Un título centrado sobre varias columnas no solapa con ninguna, así que
         no puede exigirse solape: se penaliza y se deja competir por cercanía. */
      const solapa=Math.min(h.hx1,b.x1)-Math.max(h.hx0,b.x0)>0;
      const d=dy+(solapa?0:HEADING_OFFSET_PENALTY);
      if(d<bestD){best=h;bestD=d}
    }
    if(best)b.heading=best.heading;
  }
  return blocks
}

/* Cada lámina lleva su nombre arriba a la izquierda —"Rotación", "Planograma",
   "Perímetros de Básicos"—, pero en minúsculas, así que isHeadingText no lo ve
   y acaba de primera línea del cuerpo. Es el rótulo que el asesor reconocería,
   y sin él una página sin títulos en mayúsculas se queda sin sección ninguna. */
export const TITULO_PAG_BANDA=0.28;   // franja superior donde vive el nombre de la lámina
export const TITULO_PAG_MAX=60;
/** @param {Bloque[]} blocks @param {number} altura */
export function tituloDePagina(blocks,altura){
  for(const b of blocks.slice(0,4)){
    if(b.y0>altura*TITULO_PAG_BANDA)break;
    if(b.heading)continue;                       // ya tiene título propio
    const t=b.text.trim();
    if(t.includes('\n'))continue;                // el nombre de la lámina es una línea
    if(t.length<3||t.length>TITULO_PAG_MAX)continue;
    /* En la portada el número de departamento va arriba y solo —"276 Y 279"—:
       no nombra nada. Pedir tres letras lo descarta sin tocar los rótulos. */
    if(t.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g,'').length<3)continue;
    if(/[.,;:•●]/.test(t))continue;              // eso ya es cuerpo, no rótulo
    b.esTitulo=true;                             // pasa a título: que no cuente dos veces
    return t;
  }
  return''
}

/* ════════════════════════════════════════════════
   TABLAS CON RÓTULO AL COSTADO — «MUNDO | Marca | lista»

   Casi todos los manuales traen la lámina MUNDOS Y MARCAS como una tabla:
   a la izquierda el mundo (PREMIUM, CONTEMPO…) centrado en su celda, y a la
   derecha la lista de marcas en una o dos columnas. Leída como texto suelto,
   el rótulo queda a media altura de su lista, así que el título «de encima»
   le cae a la lista de la fila de abajo: una marca de CONTEMPO salía como
   PREMIUM. Y las dos
   columnas de marcas se intercalaban.

   Aquí se reconoce esa forma —una columna que solo tiene rótulos en
   mayúsculas, con contenido a su derecha— y cada fila se vuelve un bloque con
   su rótulo de título: lo que está a la derecha de PREMIUM es de PREMIUM. Las
   filas se separan por los huecos verticales del contenido, no por la mitad
   entre rótulos: una fila alta junto a una baja no reparte bien a medias.
════════════════════════════════════════════════ */
export const TABLA_HUECO_FILA=0.9;   // hueco vertical que separa dos grupos de contenido, en alturas de letra

/* Columnas de contenido por su borde izquierdo, cada una de arriba abajo. */
/** @param {Linea[]} ls @param {number} h @returns {Linea[][]} */
function columnasDe(ls,h){
  /** @type {Linea[][]} */
  const cols=[];
  for(const l of [...ls].sort((a,b)=>a.x0-b.x0)){const c=cols[cols.length-1];if(c&&l.x0-c[0].x0<2*h)c.push(l);else cols.push([l])}
  return cols.map(c=>c.sort((a,b)=>a.yBot-b.yBot))   // por línea base: pdf.js da alturas de letra infladas
}

/* Una celda que no cabe se parte: «Tipo de» / «producto», «Pre-» /
   «elaborados». El renglón de abajo sigue al de arriba si este acaba en
   guion o en conector, o si aquel empieza en minúscula. Una lista de marcas
   no: cada marca empieza en mayúscula. */
const CONECTOR_FINAL=/(?:^|\s)(?:de|del|y|e|o|la|el|los|las|en|a|al|con|por|para)$/i;
/** @param {string} arriba @param {string} abajo */
const sigueRenglon=(arriba,abajo)=>/-$/.test(arriba)||CONECTOR_FINAL.test(arriba)||/^[a-záéíóúüñ]/.test(abajo);
/** @param {string[]} textos @returns {string[]} */
export function unirRenglones(textos){
  /** @type {string[]} */
  const out=[];
  for(const t of textos){
    const i=out.length-1;
    if(i>=0&&sigueRenglon(out[i],t))out[i]+=(/-$/.test(out[i])?'':' ')+t;
    else out.push(t);
  }
  return out
}

/* A qué encabezado va cada columna de contenido. Uno alineado a la izquierda
   la solapa; uno centrado sobre una celda ancha («MARCA» sobre dos columnas
   de marcas) empieza a la derecha de donde empieza su contenido, así que la
   columna que no solapa a nadie es del primer encabezado a su derecha. */
/** @param {Linea[]} ls @param {Linea[]} encabezados @param {number} h @returns {Array<[Linea, Linea[]]>} */
function celdasPorEncabezado(ls,encabezados,h){
  const hs=[...encabezados].sort((a,b)=>a.x0-b.x0);
  /** @type {Map<Linea, Linea[]>} */
  const de=new Map(hs.map(c=>[c,[]]));
  for(const col of columnasDe(ls,h)){
    const x0=Math.min(...col.map(l=>l.x0)),x1=Math.max(...col.map(l=>l.x1));
    /** @type {Linea|undefined} */
    let mejor,mejorS=0;
    for(const c of hs){const s=Math.min(c.x1,x1)-Math.max(c.x0,x0);if(s>mejorS){mejor=c;mejorS=s}}
    if(!mejor)mejor=hs.find(c=>c.x0>x0)||hs[hs.length-1];
    /** @type {Linea[]} */(de.get(mejor)).push(...col);
  }
  return [...de].filter(([,v])=>v.length)
}

/**
 * @param {Linea[]} lines
 * @returns {{ resto: Linea[], bloques: Bloque[] }}
 */
export function tablasDeRotulos(lines){
  const sinCambio={resto:lines,bloques:/** @type {Bloque[]} */([])};
  /* Un rótulo empieza con letra o número: «➔ STD» es una viñeta de lista. */
  const rotulos=lines.filter(l=>isHeadingText(l.text)&&/^[A-Za-zÁÉÍÓÚÜÑ0-9(]/.test(l.text));
  if(rotulos.length<2)return sinCambio;
  const cy=/** @param {{yTop:number,yBot:number}} l */l=>(l.yTop+l.yBot)/2;
  /** @param {{x0:number,x1:number}} a @param {{x0:number,x1:number}} b */
  const solapeX=(a,b)=>Math.min(a.x1,b.x1)-Math.max(a.x0,b.x0);
  /** @param {Linea} l */
  const conLetras=l=>/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]/.test(l.text);
  /** @type {Set<Linea>} */
  const usadas=new Set();
  /** @type {Bloque[]} */
  const bloques=[];

  /* Un rótulo que no cabe se parte en dos renglones («CREMAS Y» / «LICORES»).
     Solo se unen de dos en dos: tres apilados son una lista, no un rótulo. */
  /** @type {Array<{text:string,x0:number,x1:number,yTop:number,yBot:number,h:number,lineas:Linea[]}>} */
  const etiquetas=[];
  const orden=[...rotulos].sort((a,b)=>a.yTop-b.yTop||a.x0-b.x0);
  /** @param {Linea} a @param {Linea} b */
  const pegados=(a,b)=>{const h=Math.max(a.h,b.h),gap=b.yTop-a.yBot;
    return gap>-h*0.3&&gap<h*0.6&&solapeX(a,b)>=0.5*Math.min(a.x1-a.x0,b.x1-b.x0)};
  for(let i=0;i<orden.length;i++){
    const a=orden[i],b=orden.find((o,j)=>j>i&&pegados(a,o));
    const c=b&&orden.find(o=>o!==a&&o!==b&&(pegados(b,o)||pegados(o,a)));
    if(b&&!c){
      etiquetas.push({text:a.text+' '+b.text,x0:Math.min(a.x0,b.x0),x1:Math.max(a.x1,b.x1),yTop:a.yTop,yBot:b.yBot,h:Math.max(a.h,b.h),lineas:[a,b]});
      orden.splice(orden.indexOf(b),1);
    }else etiquetas.push({...a,lineas:[a]});
  }

  /* Columnas de rótulos: misma franja horizontal que TODOS los de la columna
     (no en cadena: un título ancho encima no junta columnas vecinas) y ninguno
     a la misma altura que otro. */
  /** @type {Array<typeof etiquetas>} */
  const columnas=[];
  /** @param {typeof etiquetas[0]} o @param {typeof etiquetas[0]} e */
  const misma=(o,e)=>(o.yBot<=e.yTop+1||e.yBot<=o.yTop+1)&&
    (solapeX(o,e)>=0.5*Math.min(o.x1-o.x0,e.x1-e.x0)||Math.abs((o.x0+o.x1)/2-(e.x0+e.x1)/2)<2*Math.max(o.h,e.h));
  for(const e of etiquetas){
    const libres=columnas.filter(c=>c.every(o=>misma(o,e)));
    for(const c of libres)c.push(e);
    if(!libres.length)columnas.push([e]);
  }

  for(const col1 of columnas){
    /* Un rótulo sin nada a su derecha (el pie «285 ROPA INTERIOR», que cae en
       la misma franja) no es fila de la tabla. */
    const col0=col1.filter(e=>lines.some(l=>!isHeadingText(l.text)&&l.x0>=e.x1-2&&l.yBot>e.yTop-2*e.h&&l.yTop<e.yBot+2*e.h)||
      lines.some(l=>l.x0>=e.x1-2&&l.yBot>e.yTop-e.h*0.3&&l.yTop<e.yBot+e.h*0.3));
    if(col0.length<2)continue;
    const col=[...col0].sort((a,b)=>a.yTop-b.yTop);
    if(col.some(e=>e.lineas.some(l=>usadas.has(l))))continue;
    const colX0=Math.min(...col.map(e=>e.x0)),colX1=Math.max(...col.map(e=>e.x1));
    const h=Math.max(...col.map(e=>e.h));
    const enColumna=/** @param {Linea} l */l=>l.x0<colX1-2&&l.x1>colX0+2;
    const aLaDerecha=/** @param {Linea} l */l=>l.x0>=colX1-2;
    const deEtiqueta=new Set(col.flatMap(e=>e.lineas));
    /* La columna de rótulos no tiene cuerpo entre ellos: si lo tiene, son
       títulos con su texto debajo, no una tabla. Unos trozos sueltos sí
       pasan (hay PDF que dejan una palabra de otra celda con coordenadas de
       esta columna); una frase ya no. */
    const yA=col[0].yTop,yZ=col[col.length-1].yBot;
    const sueltas=lines.filter(l=>!deEtiqueta.has(l)&&enColumna(l)&&l.yTop>yA&&l.yBot<yZ);
    if(sueltas.reduce((n,l)=>n+l.text.length,0)>30)continue;

    /* Fila de encabezados: «MUNDO | MARCA | EXHIBICIÓN», todo en mayúsculas. */
    const enFila=/** @param {{yTop:number,yBot:number,h:number}} e */e=>lines.filter(l=>!deEtiqueta.has(l)&&aLaDerecha(l)&&l.yBot>e.yTop-e.h*0.3&&l.yTop<e.yBot+e.h*0.3);
    /** @type {{label:string,cols:Linea[]}|null} */
    let encabezado=null;
    const fila0=enFila(col[0]);
    if(fila0.length&&fila0.every(l=>isHeadingText(l.text)))
      encabezado={label:col[0].text,cols:fila0.sort((a,b)=>a.x0-b.x0)};
    const filas=encabezado?col.slice(1):col;
    if(filas.length<(encabezado?1:2))continue;

    /* Límites de la tabla: arriba el encabezado (o una fila entera), abajo
       una fila entera; y nunca pasar de una línea que cruza la columna de
       rótulos (el párrafo de arriba, la nota o el pie de abajo). */
    const fA=filas[0],fZ=filas[filas.length-1],alto=/** @param {{yTop:number,yBot:number}} e */e=>e.yBot-e.yTop;
    const paso=filas.length>1?cy(filas[1])-cy(fA):2*(cy(fA)-cy(col[0]));
    const pasoFin=filas.length>1?cy(fZ)-cy(filas[filas.length-2]):paso;
    let arriba=encabezado?Math.max(col[0].yBot,...encabezado.cols.map(l=>l.yBot)):fA.yTop-Math.max(paso-alto(fA),h);
    let abajo=fZ.yBot+Math.max(pasoFin-alto(fZ),h);
    for(const l of lines){
      if(deEtiqueta.has(l)||!enColumna(l))continue;
      if(l.yBot<=filas[0].yTop&&l.yBot>arriba)arriba=l.yBot;
      if(l.yTop>=filas[filas.length-1].yBot&&l.yTop<abajo)abajo=l.yTop;
    }
    const cuerpo=lines.filter(l=>!deEtiqueta.has(l)&&!usadas.has(l)&&aLaDerecha(l)&&l.yTop>=arriba-1&&l.yBot<=abajo+1&&!(encabezado&&encabezado.cols.includes(l)));
    if(!cuerpo.length)continue;

    /* Grupos de contenido separados por hueco vertical (en cualquier columna). */
    cuerpo.sort((a,b)=>a.yTop-b.yTop);
    /** @type {Array<{yTop:number,yBot:number,lineas:Linea[]}>} */
    const grupos=[];
    for(const l of cuerpo){
      const g=grupos[grupos.length-1];
      if(g&&l.yTop<=g.yBot+TABLA_HUECO_FILA*Math.max(l.h,h*0.6)){g.lineas.push(l);g.yBot=Math.max(g.yBot,l.yBot)}
      else grupos.push({yTop:l.yTop,yBot:l.yBot,lineas:[l]});
    }
    /** @type {Map<typeof filas[0], typeof grupos>} */
    const porFila=new Map(filas.map(f=>[f,[]]));
    for(const g of grupos){
      const dentro=filas.filter(f=>cy(f)>=g.yTop-1&&cy(f)<=g.yBot+1);
      const f=dentro.length===1?dentro[0]:[...(dentro.length?dentro:filas)].sort((a,b)=>Math.abs(cy(a)-cy(g))-Math.abs(cy(b)-cy(g)))[0];
      /** @type {typeof grupos} */(porFila.get(f)).push(g);
    }
    /* Cada rótulo tiene que titular algo con texto de verdad. */
    if(filas.some(f=>!/** @type {typeof grupos} */(porFila.get(f)).some(g=>g.lineas.some(l=>conLetras(l)&&!isHeadingText(l.text)))))continue;

    /* El título de la tabla: el más cercano encima, en su franja. */
    const x1Tabla=Math.max(colX1,...cuerpo.map(l=>l.x1));
    const arribaDe=lines.filter(l=>isHeadingText(l.text)&&!deEtiqueta.has(l)&&!(encabezado&&encabezado.cols.includes(l))&&l.yBot<=arriba+1&&solapeX(l,{x0:colX0,x1:x1Tabla})>0)
      .sort((a,b)=>b.yBot-a.yBot)[0];
    const prefijo=arribaDe?arribaDe.text.replace(/\s+/g,' ').trim()+' · ':'';

    for(const f of filas){
      const gs=/** @type {typeof grupos} */(porFila.get(f));
      const partes=[];
      /* Con dos o más encabezados, cada celda va con el suyo: «EXHIBICIÓN:
         Por color». Suelto entre las marcas, «Por color» no decía que es como se
         exhibe el mundo, y el modelo contestaba otra regla. */
      const celdas=encabezado&&encabezado.cols.length>1?celdasPorEncabezado(gs.flatMap(g=>g.lineas).filter(conLetras),encabezado.cols,h):null;
      /* La fila dice qué es su rótulo: «MUNDO VESTIR». Sin encabezado, lo dice
         el título de la tabla cuando habla de mundos; así «el mundo vestir»
         se encuentra con las palabras del piso. */
      if(celdas&&encabezado){
        partes.push(encabezado.label+' '+f.text);
        for(const [c,ls] of celdas){
          const v=unirRenglones(ls.map(l=>l.text));
          partes.push(c.text+':'+(v.length===1?' '+v[0]:'\n'+v.join('\n')));
        }
      }else{
        if(encabezado)partes.push(encabezado.label+' '+f.text+' — '+encabezado.cols.map(l=>l.text).join(', '));
        else if(arribaDe&&/\bMUNDOS?\b/.test(arribaDe.text))partes.push('MUNDO '+f.text);
        /* Dentro del grupo, columna por columna y de arriba abajo: 1-4 y
           luego 5-9, no 1, 5, 2, 6… */
        for(const g of gs)partes.push(columnasDe(g.lineas.filter(conLetras),h).flat().map(l=>l.text).join('\n'));
      }
      const todas=[...f.lineas,...gs.flatMap(g=>g.lineas)];
      bloques.push({
        text:partes.filter(Boolean).join('\n'),
        heading:prefijo+f.text,isHeading:false,
        hx0:f.x0,hx1:f.x1,hy1:f.yBot,
        x0:Math.min(...todas.map(l=>l.x0)),y0:Math.min(...todas.map(l=>l.yTop)),
        x1:Math.max(...todas.map(l=>l.x1)),y1:Math.max(...todas.map(l=>l.yBot))
      });
    }
    for(const e of col)for(const l of e.lineas)usadas.add(l);
    if(encabezado)for(const l of encabezado.cols)usadas.add(l);
    for(const l of cuerpo)usadas.add(l);
  }
  if(!bloques.length)return sinCambio;
  return{resto:lines.filter(l=>!usadas.has(l)),bloques}
}

/* ════════════════════════════════════════════════
   REJILLAS DE CELDAS — «Botones | Material | Tamaño»

   La clasificación de una sección suele ser una rejilla: a la izquierda el
   tipo de producto, a la derecha sus criterios, una caja por celda y todo en
   minúsculas. tablasDeRotulos pide rótulos en mayúsculas, así que la rejilla
   salía como palabras sueltas —«Hilos Grosor Color Botones…»— y «cómo se
   clasifican los botones» no la encontraba.

   Se reconoce por la forma, no por la letra: cuatro o más filas de celdas
   cortas, con la primera y la segunda celda alineadas de fila en fila, sin
   frases de por medio. Y por lo que dice: los rótulos no se repiten y los
   valores sí (Material, Tamaño, Color…); un planograma con una prenda por caja
   no es una clasificación. Cada fila se vuelve un bloque titulado por su
   primera celda, y el rótulo grande a la izquierda de toda la rejilla
   («Tipo de producto») dice qué son.
════════════════════════════════════════════════ */
export const REJILLA_FILAS_MIN=4;
export const REJILLA_CELDA_MAX=28;      // caracteres de una celda
export const REJILLA_VALORES_DISTINTOS=0.6;
/**
 * @param {Linea[]} lines
 * @returns {{ resto: Linea[], bloques: Bloque[] }}
 */
export function tablaDeCeldas(lines){
  const sinCambio={resto:lines,bloques:/** @type {Bloque[]} */([])};
  /** @param {Linea} l */
  const corta=l=>l.text.length<=REJILLA_CELDA_MAX&&l.text.split(' ').length<=4&&
    !/[.;:•●➔]/.test(l.text)&&/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(l.text);
  const cand=lines.filter(corta);
  if(cand.length<REJILLA_FILAS_MIN*2)return sinCambio;
  /** @param {{x0:number,x1:number}} a @param {{x0:number,x1:number}} b */
  const solapeX=(a,b)=>Math.min(a.x1,b.x1)-Math.max(a.x0,b.x0);
  /** @param {{yTop:number,yBot:number}} l */
  const cy=l=>(l.yTop+l.yBot)/2;
  /** @param {{x0:number,x1:number}} l */
  const cx=l=>(l.x0+l.x1)/2;

  /* Celdas de dos renglones. */
  /** @typedef {{text:string,x0:number,x1:number,yTop:number,yBot:number,h:number,lineas:Linea[]}} Celda */
  /** @type {Celda[]} */
  const celdas=[];
  /** @type {Set<Linea>} */
  const tomadas=new Set();
  const orden=[...cand].sort((a,b)=>a.yTop-b.yTop||a.x0-b.x0);
  for(const a of orden){
    if(tomadas.has(a))continue;
    tomadas.add(a);
    const b=orden.find(o=>!tomadas.has(o)&&o.yTop-a.yBot<a.h*0.6&&o.yTop-a.yBot>-a.h*0.3&&
      solapeX(a,o)>=0.5*Math.min(a.x1-a.x0,o.x1-o.x0)&&sigueRenglon(a.text,o.text));
    if(b){
      tomadas.add(b);
      celdas.push({text:unirRenglones([a.text,b.text]).join(' '),x0:Math.min(a.x0,b.x0),x1:Math.max(a.x1,b.x1),
        yTop:a.yTop,yBot:b.yBot,h:Math.max(a.h,b.h),lineas:[a,b]});
    }else celdas.push({text:a.text,x0:a.x0,x1:a.x1,yTop:a.yTop,yBot:a.yBot,h:a.h,lineas:[a]});
  }

  /* Filas: celdas a la misma altura, de izquierda a derecha. */
  /** @type {Celda[][]} */
  const filas=[];
  for(const c of [...celdas].sort((a,b)=>cy(a)-cy(b))){
    const f=filas[filas.length-1];
    if(f&&Math.abs(cy(c)-cy(f[0]))<=0.5*Math.max(c.h,f[0].h))f.push(c);else filas.push([c]);
  }
  for(const f of filas)f.sort((a,b)=>a.x0-b.x0);

  /** @param {Celda} a @param {Celda} b */
  const alineadas=(a,b)=>{const h=Math.max(a.h,b.h);return Math.abs(cx(a)-cx(b))<2*h||Math.abs(a.x0-b.x0)<h};
  /* Corridas de filas seguidas con primera y segunda celda alineadas. */
  /** @type {Celda[][][]} */
  const corridas=[];
  /** @type {Celda[][]} */
  let corrida=[];
  /** @type {Celda[]} */
  const fuera=[];   // lo que cae en una fila pero a la izquierda de los rótulos (el rótulo de la rejilla)
  for(let f of filas){
    if(f.length<2)continue;
    const ant=corrida[corrida.length-1];
    if(ant){
      const k=f.findIndex((c,i)=>i+1<f.length&&alineadas(ant[0],c)&&alineadas(ant[1],f[i+1]));
      if(k>0){fuera.push(...f.slice(0,k));f=f.slice(k)}
    }
    const paso=corrida.length>1?cy(ant[0])-cy(corrida[corrida.length-2][0]):0;
    if(ant&&alineadas(ant[0],f[0])&&alineadas(ant[1],f[1])&&cy(f[0])-cy(ant[0])<=Math.max(4*Math.max(f[0].h,ant[0].h),1.6*paso))corrida.push(f);
    else{if(corrida.length)corridas.push(corrida);corrida=[f]}
  }
  if(corrida.length)corridas.push(corrida);

  /** @type {Set<Linea>} */
  const usadas=new Set();
  /** @type {Bloque[]} */
  const bloques=[];
  for(const run of corridas){
    if(run.length<REJILLA_FILAS_MIN)continue;
    const rotulos=run.map(f=>f[0].text.toLowerCase());
    if(new Set(rotulos).size<rotulos.length)continue;
    const valores=run.flatMap(f=>f.slice(1).map(c=>c.text.toLowerCase()));
    if(new Set(valores).size>REJILLA_VALORES_DISTINTOS*valores.length)continue;
    const yA=Math.min(...run[0].map(c=>c.yTop)),yZ=Math.max(...run[run.length-1].map(c=>c.yBot));
    const x0=Math.min(...run.map(f=>f[0].x0)),x1=Math.max(...run.flatMap(f=>f.map(c=>c.x1)));
    const deRun=new Set(run.flatMap(f=>f.flatMap(c=>c.lineas)));
    /* Una frase dentro de la rejilla: no es una rejilla. */
    if(lines.some(l=>!deRun.has(l)&&!corta(l)&&l.yTop<yZ&&l.yBot>yA&&l.x0<x1&&l.x1>x0))continue;
    /* El rótulo de toda la rejilla, solo a su izquierda y a media altura. */
    const eje=[...filas.filter(f=>f.length===1).map(f=>f[0]),...fuera].filter(c=>c.x1<=x0+2&&cy(c)>yA&&cy(c)<yZ);
    const nombre=eje.map(c=>c.text).join(' ');
    /* El título de la rejilla: el más cercano encima, en su franja. */
    const arribaDe=lines.filter(l=>isHeadingText(l.text)&&!deRun.has(l)&&l.yBot<=yA+1&&solapeX(l,{x0,x1})>0)
      .sort((a,b)=>b.yBot-a.yBot)[0];
    const prefijo=arribaDe?arribaDe.text.replace(/\s+/g,' ').trim()+' · ':'';
    for(const f of run){
      const todas=f.flatMap(c=>c.lineas);
      bloques.push({
        text:(nombre?nombre+': ':'')+f[0].text+' — '+f.slice(1).map(c=>c.text).join(', '),
        heading:prefijo+f[0].text,isHeading:false,
        hx0:f[0].x0,hx1:f[0].x1,hy1:f[0].yBot,
        x0:Math.min(...todas.map(l=>l.x0)),y0:Math.min(...todas.map(l=>l.yTop)),
        x1:Math.max(...todas.map(l=>l.x1)),y1:Math.max(...todas.map(l=>l.yBot))
      });
    }
    for(const l of deRun)usadas.add(l);
    for(const c of eje)for(const l of c.lineas)usadas.add(l);
  }
  if(!bloques.length)return sinCambio;
  return{resto:lines.filter(l=>!usadas.has(l)),bloques}
}

/** @param {{items: ItemDeTexto[]}} content @param {Vista} vp @param {number} pageNum @returns {Pagina} */
export function pageToBlocks(content,vp,pageNum){
  const lines=textItemsToLines(content.items,vp);
  /* Para tapar el texto al buscar figuras hay que usar la caja de cada LÍNEA.
     La del bloque es la unión de todas sus líneas: en una lámina donde el texto
     rodea a una foto, esa unión se traga la foto y la página se queda sin nada
     que detectar. */
  const textBoxes=lines.map(l=>({x0:l.x0,y0:l.yTop,x1:l.x1,y1:l.yBot}));
  const finales=bloquesDeLineas(lines);
  return{page:pageNum,textBoxes,blocks:finales,titulo:tituloDePagina(finales,vp.height)}
}
/** @param {Linea[]} lines @returns {Bloque[]} */
export function bloquesDeLineas(lines){
  const conRotulos=tablasDeRotulos(lines);
  const {resto,bloques:rejillas}=tablaDeCeldas(conRotulos.resto);
  const blocks=orderBlocks(unirTitulosApilados(linesToBlocks(resto)));
  const out=assignHeadings(blocks.map(b=>({
    text:(b.lines.length?b.lines.join('\n'):b.heading).trim(),
    heading:b.heading,
    isHeading:!b.lines.length&&!!b.heading,
    hx0:b.hx0,hx1:b.hx1,hy1:b.hy1,
    x0:b.x0,y0:b.yTop,x1:b.x1,y1:b.yBot
  })).filter(b=>b.text));
  /* Las filas de la tabla van donde empieza la tabla, en su orden. */
  for(const tablas of [conRotulos.bloques,rejillas]){
    if(!tablas.length)continue;
    const y=Math.min(...tablas.map(t=>t.y0));
    const i=out.findIndex(b=>b.y0>=y&&!tablas.includes(b));
    out.splice(i<0?out.length:i,0,...tablas);
  }
  return out
}
