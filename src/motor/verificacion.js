// Verificación de la respuesta del modelo contra el contexto que se le envió:
// cifras (con su unidad), páginas citadas, nombres que el manual no dice y la
// cifra pegada a otra cosa (atadura).
//
// Salió de app.js en el paso 6 del ADR 0005, sin cambiar nada de lo que hace.
// Sin DOM: se importa igual desde Node. El aviso en pantalla
// (renderAvisoVerificacion) se queda en app.js.
import { estado, alReiniciar } from '../estado.js';
import { STOPWORDS, UNIDADES, normalizeText, tokenize, variantes } from './texto.js';
import { nombreDeSeccion, seccionActiva } from './secciones.js';
import { mismaCosa } from './puerta.js';

/** @typedef {{valor: string, valores: string[], familia: string, i: number, fin: number, txt: string}} Cifra */
/** @typedef {Cifra & {palabras: string[], propias: boolean, tramo: string}} CifraConTramo */
/** @typedef {{valor: string, valores: string[], familia: string, txt: string, pagina: string | null, titulo: string, tit: string[], propias: string[], cerca: string[], rotulo: boolean}} Ocurrencia */
/** @typedef {{cifra: string, sujeto: string, pagina: string | null, pegadaA: string, rival: string, paginaRival: string | null}} Atadura */
/** @typedef {{cifras: string[], paginas: string[], nombres: string[], nombresDeLamina: string[], paginasDeLamina: string[], citadas: Set<string>, atadas: Atadura[], certezaBajada?: boolean}} Verificacion */
/** @typedef {{doc: string, page: number | string}} LaminaVista */

/* ════════════════════════════════════════════════
   VERIFICACIÓN CONTRA EL CONTEXTO

   Un modelo que alucina una medida no suena distinto de uno que la
   leyó: las dos respuestas llegan con la misma seguridad, y el asesor
   ejecuta la que tenga enfrente. Aquí se comprueba lo comprobable —
   que cada cifra de la respuesta esté en los fragmentos que se
   enviaron, y que cada página citada exista entre ellos.

   No detecta un razonamiento equivocado; detecta el dato traído de
   fuera del manual, que es la falla que llega al piso.
════════════════════════════════════════════════ */
/* ── LA UNIDAD ES PARTE DEL DATO ──────────────────
   Comprobar el número suelto no alcanza: «deja 80 cm de pasillo» pasaba la
   verificación porque en el manual existe «Cruce 80/20» y «Formal 50%». El 80
   está, pero no son centímetros — y lo que el asesor ejecuta en el piso es la
   medida, no el dígito. Se cotejan los pares número+unidad como una sola cosa,
   y solo las cifras que van sin unidad caen al cotejo del número desnudo. */
/* El cierre no puede ser \b: detrás de «%» viene un espacio o un punto, y entre
   dos caracteres que no son de palabra no hay límite de palabra. Con \b ningún
   porcentaje formaba par —«Formal 50% del piso» no daba nada— y todos caían al
   cotejo del número suelto: un «40%» inventado pasaba por bueno con que hubiera
   un «40 cm» en el contexto. En manuales que son porcentajes de participación
   de punta a punta, era la unidad que más importaba. */
const UNIDAD_RE=/(\d+(?:[.,]\d+)?)\s*(cm|mm|mts|mt|m|cent[ií]metros?|mil[ií]metros?|metros?|%|por\s*ciento|piezas?|pzs?|pz|d[ií]as?|semanas?|meses|mes|horas?|min|minutos?)(?![a-z0-9áéíóúñ])/gi;
/** @param {string | null | undefined} u @returns {string} */
function familiaUnidad(u){
  const t=(u||'').toLowerCase().replace(/\s+/g,'');
  if(/^(cm|cent)/.test(t))return'cm';
  if(/^(mm|mil)/.test(t))return'mm';
  /* «mes» y «min» empiezan por m: si se miran después de los metros, «3 meses»
     inventado se daba por bueno contra un «3 m» del manual. */
  if(/^mes/.test(t))return'mes';
  if(/^min/.test(t))return'minuto';
  if(/^(mts?|m|metro)/.test(t))return'm';
  if(t==='%'||/^porciento/.test(t))return'%';
  if(/^(pz|pieza)/.test(t))return'pieza';
  if(/^d[ií]a/.test(t))return'dia';
  if(/^seman/.test(t))return'semana';
  if(/^mes/.test(t))return'mes';
  if(/^hora/.test(t))return'hora';
  if(/^min/.test(t))return'minuto';
  return t
}
/** @param {string | null | undefined} texto @returns {Map<string, string>} */
function paresConUnidad(texto){
  const out=new Map();
  for(const m of(texto||'').matchAll(UNIDAD_RE)){
    const n=m[1].replace(',','.');
    out.set(n+'|'+familiaUnidad(m[2]),m[1]+' '+m[2]);
  }
  return out
}

/* ── LOS NOMBRES QUE EL MANUAL NO DICE ────────────
   Medido en el piso, con 101 MUEBLES activo y la API conectada: a «¿cuál es la
   marca propia?» contestó «‹marca X› es la marca propia de liverpool». Ninguna de
   las dos palabras está en ese manual —comprobado sobre el texto crudo del PDF,
   38 páginas: cero de la marca, cero «liverpool»—. Esa marca sale en otra
   sección y Liverpool es la cadena de la que son estos manuales. El modelo la
   reconoció y completó con lo que sabe de ella, que es la única vía de
   invención que quedaba abierta: la verificación comprobaba cifras y páginas, y
   un nombre pasaba limpio.

   La capitalización de la RESPUESTA no sirve para detectarlo: la marca iba al
   principio de la frase y «liverpool» en minúscula. Lo que sí sirve es lo que el
   corpus sabe que es un nombre. Un nombre propio en estos manuales se reconoce
   por dos cosas a la vez: aparece en mayúscula a mitad de frase —«la marca Vestra
   Kids», «sistema de Mercaderías de Delmar», «la marca propia Damaia»— y no
   aparece nunca en minúscula. Las palabras corrientes fallan la segunda: «coloca»
   va en mayúscula al empezar renglón, pero también va en minúscula cien veces. */
/** @type {Set<string> | null} */
let entidadesCorpus=null;
/** Olvida los nombres fichados: se rehacen del corpus la próxima vez. */
export function reiniciarEntidades(){entidadesCorpus=null}
alReiniciar(reiniciarEntidades);
/** @returns {Set<string>} */
export function entidadesDelCorpus(){
  if(entidadesCorpus)return entidadesCorpus;
  const mayus=new Map(),minus=new Set();
  /* Lo que va detrás de un punto, un guion de viñeta o un salto de línea puede
     ir en mayúscula por gramática, no por ser un nombre. */
  /* «¡Recuerda!» abre frase igual que tras un punto. Sin el «¡», «Recuerda»
     —que en los manuales solo va así o en «RECUERDA:»— quedaba fichado como
     nombre propio, y cada respuesta que cerraba con «Recuerda que…» salía con
     «⚠ No pude verificar el nombre Recuerda»: 18 de 26 avisos en 268 respuestas
     medidas con 14 manuales reales, casi todos en respuestas correctas. */
  const inicioDeFrase=/[.!?:;•·➔→\-–—(\[\n¡¿"“«'*]/;
  for(const c of estado.docChunks){
    const txt=(c.heading?c.heading+'. ':'')+(c.text||'');
    for(const m of txt.matchAll(/[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ]{2,}/g)){
      let i=m.index-1;
      while(i>=0&&txt[i]===' ')i--;
      if(i<0||inicioDeFrase.test(txt[i]))continue;
      const t=normalizeText(m[0]).trim();
      if(t)mayus.set(t,(mayus.get(t)||0)+1);
    }
    for(const m of txt.matchAll(/[a-záéíóúñ][a-záéíóúñ]{2,}/g)){
      const t=normalizeText(m[0]).trim();
      if(t)minus.add(t);
    }
  }
  entidadesCorpus=new Set();
  /* Que no aparezca en minúscula en NINGUNA de sus formas: «Colchones»,
     «Pijamas» o «Avances» van en mayúscula en las listas de las láminas, pero
     «colchón», «pijama» y «avance» se escriben en minúscula en el texto. Una
     marca no tiene plural ni femenino escritos en minúscula. */
  for(const[t]of mayus)if(!variantes(t).some(v=>minus.has(v)))entidadesCorpus.add(t);
  return entidadesCorpus
}
/** @param {string | null | undefined} respuesta @param {string | null | undefined} contexto @returns {string[]} */
export function nombresSinRespaldo(respuesta,contexto){
  if(!respuesta||!contexto)return[];
  const ents=entidadesDelCorpus();
  const ctx=' '+normalizeText(contexto).replace(/\s+/g,' ')+' ';
  const enContexto=(/** @type {string} */t)=>ctx.includes(' '+t+' ');
  /* Vienen del prompt, no del manual, así que no son invenciones. */
  /* Y los nombres de todas las secciones cargadas: «eso sí está en 246, 247
     SACOS Y PANTALONES» lo dice la app —es la sección que tiene la palabra—, no
     el modelo de su cosecha. */
  const propios=new Set(['mercadep','certeza','gap','alta','media'].concat(tokenize(seccionActiva()||''),
    ...(estado.docs||[]).map(d=>tokenize(nombreDeSeccion(d.name)||''))));
  const out=new Map();
  const texto=respuesta;
  /* La respuesta llega en markdown: «**Recuerda:**», «- Coloca», «¿Dónde…?» o
     «(Coloca…» empiezan frase igual que tras un punto, y sin contarlos salían
     marcados como nombres que el manual no dice. */
  const inicioDeFrase=/[.!?:;•·➔→\n\-–—(\[*_¿¡"“«>#]/;
  for(const m of texto.matchAll(/[A-Za-zÁÉÍÓÚÑáéíóúñ][A-Za-zÁÉÍÓÚÑáéíóúñ]{2,}/g)){
    const t=normalizeText(m[0]).trim();
    if(!t||propios.has(t)||enContexto(t))continue;
    /* El corpus lo tiene fichado como nombre: da igual cómo lo escriba la
       respuesta, no está en los fragmentos que se consultaron. */
    if(ents.has(t)){out.set(t,m[0]);continue}
    /* Y la red para un nombre de fuera del corpus —otra cadena, otra marca—:
       va en mayúscula a mitad de frase y no está en el contexto. */
    if(!/^[A-ZÁÉÍÓÚÑ]/.test(m[0]))continue;
    let i=m.index-1;
    while(i>=0&&texto[i]===' ')i--;
    if(i<0||inicioDeFrase.test(texto[i]))continue;
    out.set(t,m[0]);
  }
  return[...out.values()]
}

/* ── LO QUE SE LEYÓ EN UNA LÁMINA-IMAGEN ──────────
   Las láminas que casi no traen texto (MUNDOS Y MARCAS hecha de logos,
   «Clasificación de Departamentos» dibujada) van al modelo como imagen
   (src/ia/laminas.js). Lo que lee ahí —la marca que es un logo, la categoría
   que está dibujada— no está en ningún texto que se pueda cotejar, y salía con «⚠ No pude
   verificar» y la certeza bajada: 7 de 42 respuestas correctas, medido con 15
   manuales reales el 11-oct-2026.
   Si la respuesta cita la página que vio como imagen, esos nombres se dicen
   aparte —«leído de la imagen de la pág. N»—, sin bajar la certeza, y la lámina
   va debajo de la respuesta para compararlos. Se siguen enseñando: desde el
   texto no se distingue un logo leído de un nombre que el modelo trajo de lo
   que sabe. Se probó dejar con ⚠ los que el corpus tiene escritos en OTRO
   manual, y no sirve: «barata», «regular» o una marca que es logo en una
   sección y texto en otra se quedaban marcados. Sin imagen citada, todo sigue
   como antes. */
/**
 * @param {string[]} nombres  los que no están en el contexto de texto
 * @param {string} respuesta
 * @param {LaminaVista[] | null | undefined} laminas  las páginas que el modelo vio como imagen
 * @returns {{nombres: string[], deLamina: string[], paginas: string[]}}
 */
export function separarNombresDeLamina(nombres,respuesta,laminas){
  const igual={nombres,deLamina:[],paginas:[]};
  if(!nombres.length||!laminas||!laminas.length)return igual;
  /* «pág. 17», «pág 17», «página 16», «[Manual.pdf · pág. 14]». */
  const citadas=new Set([...respuesta.matchAll(/p[áa]g(?:\.|ina)?\s*(\d+)/gi)].map(m=>m[1]));
  const paginas=[...new Set(laminas.map(l=>String(l.page)).filter(p=>citadas.has(p)))];
  if(!paginas.length)return igual;
  return{nombres:[],deLamina:nombres,paginas}
}

/** «Se divide en 5 mundos:» y debajo los cinco. Ese 5 no está en el manual —lo
   contó el modelo— y salía como «⚠ No pude verificar el dato 5» con la certeza
   bajada (11-oct-2026, 15 manuales reales: la única falsa alarma que quedó).
   Un número sin unidad que dice exactamente cuántos elementos enumera la
   propia respuesta es un conteo de la respuesta, no un dato del manual: los
   elementos sí se verifican uno por uno. Con unidad («5 cm») nunca es conteo.
   @param {string} respuesta @returns {Set<string>} */
export function conteosDeLista(respuesta){
  /** @type {Set<string>} */
  const out=new Set();
  const lineas=(respuesta||'').split('\n');
  const vineta=/^\s*(?:[-*•]|\d+[.)])\s+\S/;
  for(let i=0;i<lineas.length;i++){
    for(const m of lineas[i].matchAll(/(?<![\d.,$])(\d{1,2})(?![\d.,%)])\s+(?!cm\b|mm\b|m\b|mts?\b|metros?\b|cent|mil[ií]m|%|por\s*ciento|d[ií]as?\b|semanas?\b|mes|horas?\b|min)[a-záéíóúñ]+/gi)){
      const n=Number(m[1]);
      if(n<2)continue;
      /* La lista de abajo: viñetas o números seguidos, saltando renglones vacíos. */
      let items=0;
      for(let j=i+1;j<lineas.length;j++){
        if(!lineas[j].trim()){if(items)break;continue}
        if(!vineta.test(lineas[j]))break;
        items++;
      }
      /* O en el mismo renglón tras dos puntos: «en 3 mundos: A, B y C». */
      const resto=lineas[i].slice((m.index||0)+m[0].length);
      const dos=resto.indexOf(':');
      const enLinea=dos<0?0:resto.slice(dos+1).replace(/\(.*?\)/g,'').split(/,|\s+y\s+|\s+e\s+/).map(x=>x.trim()).filter(x=>/\p{L}/u.test(x)).length;
      if(items===n||enLinea===n)out.add(m[1]);
    }
  }
  return out
}

/* «Vinos debe ser mayor a $1,200.00»: el cotejo partía la cifra en «1,200» y
   «00» y no encontraba «1,200» porque detrás venía «.00». Se escriben igual de
   los dos lados antes de comparar: sin separador de miles y sin decimales en
   cero. «20.8» y «1.50» no cambian. */
/** @param {string | null | undefined} t @returns {string} */
export function cifrasCanonicas(t){
  return(t||'').replace(/(\d)[.,](?=\d{3}(?!\d))/g,'$1').replace(/(\d)[.,]0+(?![\d])/g,'$1')
}
/* «la sección de 101 Muebles»: el número es el de la sección, que la app sabe
   por el propio manual, y no tiene por qué estar en los fragmentos enviados.
   Solo se quita delante de la palabra con que empieza el nombre de su sección,
   para que un «101» suelto se siga cotejando. */
/** @param {string | null | undefined} texto @returns {string} */
function sinNumerosDeSeccion(texto){
  let t=texto||'';
  for(const d of estado.docs||[]){
    const s=nombreDeSeccion(d.name)||'';
    const cifras=s.match(/^[\d,\sy]+(?=\s)/);
    if(!cifras)continue;
    const nums=cifras[0].match(/\d+/g),palabra=s.slice(cifras[0].length).trim().split(/\s+/)[0];
    if(!nums||!palabra)continue;
    const re=new RegExp('(?<![\\d.,])(?:'+nums.join('|')+')((?:\\s*(?:,|y)\\s*\\d+)*\\s+'+palabra.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','gi');
    t=t.replace(re,(/** @type {string} */_,/** @type {string} */resto)=>resto.replace(/\d+/g,''));
  }
  return t
}
/**
 * @param {string | null | undefined} respuesta
 * @param {string | null | undefined} contexto
 * @param {{laminas?: LaminaVista[] | null}} [opciones]  laminas: las páginas que el modelo vio como imagen
 * @returns {Verificacion}
 */
export function verificarContraContexto(respuesta,contexto,{laminas=null}={}){
  /** @type {Verificacion} */
  const vacio={cifras:[],paginas:[],nombres:[],nombresDeLamina:[],paginasDeLamina:[],citadas:new Set(),atadas:[]};
  if(!respuesta||!contexto)return vacio;

  const texto=cifrasCanonicas(sinNumerosDeSeccion(respuesta
    .replace(/^\s*\d+[.)]\s/gm,'')                  // "1." de una lista no es un dato
    .replace(/\(?\s*p[áa]g\.?\s*\d+\s*\)?/gi,' '))); // las páginas se revisan aparte

  const ctx=cifrasCanonicas(contexto.replace(/\s+/g,' '));

  /* Primero los pares. Lo que ya quedó verificado —o marcado— como par no se
     vuelve a revisar como número suelto: «80 cm» se señala una vez, con su
     unidad, que es como el asesor lo va a leer. */
  const paresCtx=paresConUnidad(ctx);
  const paresResp=paresConUnidad(texto);
  const marcadosPorUnidad=[];
  const yaVistos=new Set();
  for(const[clave,legible]of paresResp){
    /* «Piezas» es la palabra con que se cuenta, no una medida: «máximo 8 piezas
       en nichos» dice lo mismo que el manual —«en nichos máximo 8»—, que cuenta
       camisas. Si el par no está, se coteja el número solo; en cm o % la
       unidad sí cambia el dato y se sigue exigiendo. */
    if(clave.endsWith('|pieza')&&!paresCtx.has(clave)){
      /* …pero el número tiene que estar contando algo, no midiendo: «12 piezas»
         no se respalda con un «12 cm». */
      const esc=clave.split('|')[0].replace(/[.,]/g,'[.,]');
      if(new RegExp('(?<![\\d.,])'+esc+'(?![\\d]|[.,]\\d)(?!\\s*(?:cm|mm|mts?|m\\b|cent|mil[ií]m|metros?|%|por\\s*ciento|d[ií]as?|semanas?|mes|horas?|min))','i').test(ctx))continue;
    }
    yaVistos.add(clave.split('|')[0]);
    if(!paresCtx.has(clave))marcadosPorUnidad.push(legible);
  }

  const cifras=new Set();
  for(const m of texto.matchAll(/\d+(?:[.,]\d+)?/g)){
    const n=m[0];
    if(n.length===4&&/^(19|20)\d\d$/.test(n))continue;  // un año no es una medida
    if(yaVistos.has(n.replace(',','.')))continue;       // ya se revisó con su unidad
    cifras.add(n);
  }
  /* El separador decimal se acepta indistinto (20.8 y 20,8 son el mismo dato).
     Ojo con encadenar dos replace aquí: el primero introduce una coma dentro
     de la clase de caracteres y el segundo la vuelve a sustituir, produciendo
     «20[.[.,]]8», que no coincide con nada. Así, TODA cifra decimal se marcaba
     como no verificable aunque estuviera en el contexto —y estos manuales son
     decimales por todas partes: 20.8%, 38.5%, 11.5%—. Una sola pasada. */
  const conteos=conteosDeLista(respuesta);
  const noVerificadas=[...cifras].filter(n=>{
    if(conteos.has(n))return false;
    const esc=n.replace(/[.,]/g,'[.,]');
    /* Tampoco vale como coincidencia el principio de un decimal: «20» no es
       «20.8%», y el modelo que redondea una participación cambia el dato. */
    return!new RegExp('(?<![\\d.,])'+esc+'(?![\\d]|[.,]\\d)').test(ctx)
  });

  const paginasCitadas=new Set();
  for(const m of respuesta.matchAll(/p[áa]g\.?\s*(\d+)/gi))paginasCitadas.add(m[1]);
  const paginasReales=new Set();
  for(const m of contexto.matchAll(/p[áa]g\.\s*(\d+)/gi))paginasReales.add(m[1]);
  const paginasInventadas=[...paginasCitadas].filter(p=>!paginasReales.has(p));

  /* Las páginas citadas que sí existen en el contexto no son solo lo que
     sobrevive a la verificación: son la única lista honesta de la que se pueden
     sacar las láminas que acompañan a la respuesta. */
  const citadas=new Set([...paginasCitadas].filter(p=>paginasReales.has(p)));

  const nombres=separarNombresDeLamina(nombresSinRespaldo(respuesta,contexto),respuesta,laminas);
  return{cifras:marcadosPorUnidad.concat(noVerificadas),paginas:paginasInventadas,
    nombres:nombres.nombres,nombresDeLamina:nombres.deLamina,paginasDeLamina:nombres.paginas,citadas,
    atadas:verificarAtadura(respuesta,contexto)}
}

/* ── LA CIFRA PEGADA A OTRA COSA ──────────────────
   Medido con un manual real: en una tabla de participación cada columna trae
   su porcentaje, y una respuesta que le daba a SNEAKERS el de la columna TENIS
   CASUAL pasaba limpia, porque esa cifra sí está en el contexto: se
   comprobaba que la cifra existiera, no a qué iba pegada.
   Aquí cada cifra dicha se compara por su VECINDAD —el título de su fragmento
   y su tramo de renglón— con las demás cifras de la misma unidad. Solo se
   marca con evidencia positiva: otra cifra está más pegada al sujeto de la
   respuesta que la dicha. Una paráfrasis sin rival no se marca: «deja 80 cm de
   pasillo» contra «dejando 80 cm entre muebles» no tiene con qué contradecirse,
   y un aviso falso enseña al asesor a ignorar los avisos. */
const ATADURA_RELLENO=new Set(['participacion','porcentaje','porcentajes','seccion','manual','pagina','lamina','total','indica','senala','dice','segun','debe','deben','lleva','llevan','colocar','coloca','coloque','coloquen','poner','usar','exhibicion','exhibir','asigna','asignado','asignada','corresponde','corresponden','representa','aproximadamente','cerca','menos','hasta','minimo','maximo','medida','cifra','dato','siempre','nunca','tambien','cada','respuesta','certeza','alta','media','centimetros','centimetro','milimetros','metros','metro','piezas','pieza','dias','semanas','meses','horas','minutos','ciento']);
/** @param {string | null | undefined} t @returns {string[]} */
function palabrasDeSujeto(t){
  return normalizeText(t||'').split(/\s+/).filter(w=>w.length>=4&&!/\d/.test(w)&&!STOPWORDS.has(w)&&!ATADURA_RELLENO.has(w)&&!UNIDADES.has(w))
}
/** @param {string} t @returns {Cifra[]} */
function cifrasDeTexto(t){
  /** @type {Cifra[]} */
  const out=[];
  /* «de 2 a 4 piezas», «10-15 cm»: el rango es un solo dato con dos extremos, y
     cualquiera de los dos es suyo. */
  for(const m of(t||'').matchAll(UNIDAD_RE)){
    const valor=m[1].replace(',','.');
    const antes=t.slice(Math.max(0,m.index-12),m.index).match(/(\d+(?:[.,]\d+)?)\s*(?:a|o|ó|y|al|-|–)\s*$/i);
    out.push({valor,valores:antes?[antes[1].replace(',','.'),valor]:[valor],familia:familiaUnidad(m[2]),i:m.index,fin:m.index+m[0].length,txt:m[0].trim()});
  }
  for(const m of(t||'').matchAll(/(?<![\d.,])\d{6,}(?![\d])/g))
    out.push({valor:m[0],valores:[m[0]],familia:'sku',i:m.index,fin:m.index+m[0].length,txt:m[0]});
  return out.sort((a,b)=>a.i-b.i)
}
/* El tramo que le toca a cada cifra de un renglón o una frase. Con una sola
   cifra es todo el texto. Con varias se corta por comas (no la decimal), punto
   y coma, viñetas y « y »: «Tenis casual 25% y Sneakers 35%» son dos tramos.
   Si el tramo de una cifra se queda sin palabras propias —«25% de»—, hereda
   las del texto que no son de otra cifra, y se avisa con `propias:false`. */
/** @param {string} t @returns {CifraConTramo[]} */
function tramosDeCifras(t){
  const cifras=cifrasDeTexto(t);
  if(!cifras.length)return[];
  if(cifras.length===1){
    const pal=palabrasDeSujeto(t.slice(0,cifras[0].i)+' '+t.slice(cifras[0].fin));
    return[{...cifras[0],palabras:pal,propias:pal.length>0,tramo:t}];
  }
  const cortes=[0];
  for(const m of t.matchAll(/,(?!\d)|;|·|•|\||\s(?:y|e)\s/g))cortes.push(m.index);
  cortes.push(t.length);
  const tramoDe=(/** @type {Cifra} */c)=>{for(let k=0;k<cortes.length-1;k++)if(c.i>=cortes[k]&&c.i<cortes[k+1])return[cortes[k],cortes[k+1]];return[0,t.length]};
  const propios=cifras.map(c=>{const[a,b]=tramoDe(c);const txt=t.slice(a,b);return{txt,pal:palabrasDeSujeto(txt.replace(c.txt,' '))}});
  const ocupadas=new Set(propios.flatMap(p=>p.pal));
  const sueltas=palabrasDeSujeto(t).filter(w=>!ocupadas.has(w));
  return cifras.map((c,k)=>{
    const pal=propios[k].pal;
    return{...c,palabras:pal.length?pal:sueltas,propias:pal.length>0,tramo:propios[k].txt}
  })
}
/** @param {string | null | undefined} respuesta @param {string | null | undefined} contexto @returns {Atadura[]} */
export function verificarAtadura(respuesta,contexto){
  if(!respuesta||!contexto)return[];
  /* El nombre de la sección no ata nada: toda la página es de esa sección. */
  const ajenas=new Set(estado.docs.flatMap(d=>palabrasDeSujeto(nombreDeSeccion(d.name)+' '+d.name.replace(/\.pdf$/i,''))));
  const sujeto=(/** @type {string[]} */ws)=>ws.filter(w=>!ajenas.has(w));
  /** @type {Ocurrencia[]} */
  const ocurrencias=[];
  const esRotulo=(/** @type {string | undefined} */l)=>/^\s*\[.*\]\s*$/.test(l||'');
  const esCorte=(/** @type {string | undefined} */l)=>/^\s*(===|---)/.test(l||'');
  /* El PDF corta donde cortó la maqueta: «◆ N % en el flujo» / «principal del
     cliente» es una sola frase. Se vuelve a unir, con la misma regla que las
     tarjetas del modo manual, antes de decidir qué va pegado a qué. */
  /** @type {string[]} */
  const lineas=[];
  for(const l of contexto.split('\n')){
    const prev=lineas[lineas.length-1];
    if(prev!=null&&!esRotulo(prev)&&!esCorte(prev)&&!esRotulo(l)&&!esCorte(l)&&prev.trim()&&!/[.:;!?]\s*$/.test(prev)&&/^\s*[a-záéíóúñü(]/.test(l))
      lineas[lineas.length-1]=prev.replace(/\s+$/,'')+' '+l.trim();
    else lineas.push(l);
  }
  /** @type {string[]} */
  let titulo=[];
  /** @type {string | null} */
  let pagina=null;
  let tituloTxt='';
  for(let i=0;i<lineas.length;i++){
    const l=lineas[i];
    if(esRotulo(l)){
      const partes=l.trim().slice(1,-1).split(' · ');
      pagina=null;const tit=[];
      for(const p of partes.slice(1)){
        const m=p.match(/^p[áa]g\.\s*(\d+)$/i);
        if(m)pagina=m[1];else if(!/por IA/.test(p))tit.push(p);
      }
      tituloTxt=tit.join(' · ');titulo=sujeto(palabrasDeSujeto(tituloTxt));
      continue
    }
    if(esCorte(l)){titulo=[];tituloTxt='';pagina=null;continue}
    const tramos=tramosDeCifras(l);
    for(const c of tramos){
      const propias=c.propias?sujeto(c.palabras):[];
      const cerca=[];
      if(!c.propias)for(const j of[i-1,i+1]){
        const v=lineas[j];
        if(v&&!esRotulo(v)&&!esCorte(v)&&!cifrasDeTexto(v).length)cerca.push(...sujeto(palabrasDeSujeto(v)));
      }
      /* Rótulo: la cifra va con un nombre corto —una celda, un elemento de
         lista—, no dentro de una oración. «Sneakers 35%, Casual 15%» ata;
         «las mesas miden 90 cm» no ata el 90 a las mesas de otra frase. */
      const resto=c.tramo.replace(c.txt,' ').split(/\s+/).filter((/** @type {string} */w)=>/\p{L}/u.test(w));
      const rotulo=(tramos.length>1&&c.tramo.trim()!==l.trim())||resto.length<=3;
      ocurrencias.push({valor:c.valor,valores:c.valores,familia:c.familia,txt:c.txt,pagina,titulo:tituloTxt,tit:titulo,propias,cerca,rotulo});
    }
  }
  if(!ocurrencias.length)return[];
  const toca=(/** @type {string[]} */ws,/** @type {string[]} */S)=>S.filter(s=>ws.some(v=>mismaCosa(s,v)));
  /* Asimétrico a propósito: la cifra dicha cuenta a su favor cualquier palabra
     de su vecindad; la rival solo lo que la ata por estructura —su título o su
     rótulo—. Y la rival gana solo si explica TODO lo que explica la dicha y algo
     más: en un planograma, «flujo principal» puede rotular una cifra y «etapa»
     la de la respuesta; ninguna explica a la otra, y eso no es evidencia de
     nada. «Tenis casual 18%» sí se marca si el 18% solo explica «casual» y otra
     cifra explica «tenis casual». */
  const aFavor=(/** @type {Ocurrencia} */o,/** @type {string[]} */S)=>[...new Set([...toca(o.tit,S),...toca([...o.propias,...o.cerca],S)])];
  const enContra=(/** @type {Ocurrencia} */o,/** @type {string[]} */S)=>[...new Set([...toca(o.tit,S),...(o.rotulo?toca(o.propias,S):[])])];
  const comparten=(/** @type {{valores: string[]}} */a,/** @type {{valores: string[]}} */b)=>a.valores.some(v=>b.valores.includes(v));
  const texto=respuesta.replace(/\(?\s*p[áa]g\.?\s*\d+\s*\)?/gi,' ').replace(/[*_`#>]/g,' ');
  const frases=texto.split(/\n+|(?<=[.!?])\s+/);
  const out=[],vistas=new Set();
  for(const f of frases){
    for(const c of tramosDeCifras(f)){
      const S=[...new Set(sujeto(c.palabras))];
      if(!S.length)continue;
      const propias=ocurrencias.filter(o=>o.familia===c.familia&&comparten(o,c));
      if(!propias.length)continue;       // eso ya lo marca el cotejo de cifras
      /** @type {string[]} */
      let favor=[];
      let mejor=propias[0];
      for(const o of propias){const f=aFavor(o,S);if(f.length>favor.length||o===propias[0]){if(f.length>=favor.length){favor=f;mejor=o}}}
      let rival=null,ganan=favor;
      for(const o of ocurrencias){
        if(o.familia!==c.familia||comparten(o,c))continue;
        const e=enContra(o,S);
        /* Y tiene que cubrir al menos la mitad del sujeto: con «deja 80 cm de
           pasillo entre mesas», una rival que solo comparte «mesas» no basta. */
        if(e.length>ganan.length&&favor.every(x=>e.includes(x))&&e.length*2>=S.length){rival=o;ganan=e}
      }
      if(!rival)continue;
      /* El sujeto se enseña como lo escribió la respuesta, no normalizado. */
      const originales=c.tramo.split(/\s+/).map(w=>w.replace(/[^\p{L}\p{N}-]/gu,'')).filter(w=>w&&ganan.some(g=>mismaCosa(normalizeText(w),g)));
      const clave=c.txt+'|'+ganan.join(' ');
      if(vistas.has(clave))continue;vistas.add(clave);
      out.push({cifra:c.txt,sujeto:[...new Set(originales)].join(' ')||ganan.join(' '),
        pagina:mejor.pagina,pegadaA:mejor.titulo,rival:rival.txt,paginaRival:rival.pagina});
    }
  }
  return out
}

/* La página entera como lámina, para cuando la página que hay que mirar no
   trae un recorte detectado. Sale de la imagen que se guardó al cargar el PDF;
   sin ella no hay nada honesto que enseñar. Las imágenes de cada página
   (`paginas`, manual → [{page,titulo,imagen}]) las guarda la app al cargar. */
/**
 * @param {Fragmento[] | null | undefined} fragmentos
 * @param {string | number | null | undefined} pagina
 * @param {Map<string, {page: number | string, titulo?: string, imagen?: string}[]>} paginas
 */
export function paginaComoLamina(fragmentos,pagina,paginas){
  if(!pagina)return null;
  const c=(fragmentos||[]).find(x=>x.source==='pdf'&&String(x.page)===String(pagina));
  if(!c)return null;
  const p=(paginas.get(c.docName)||[]).find(x=>String(x.page)===String(pagina));
  if(!p||!p.imagen)return null;
  return{id:`${c.docName}#pagina-${pagina}`,docName:c.docName,page:Number(pagina),heading:p.titulo||c.heading||'',caption:'',dataUrl:p.imagen,firma:''}
}
