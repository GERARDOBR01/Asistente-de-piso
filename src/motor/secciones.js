// De qué sección es cada manual, y qué sección nombra la pregunta.
//
// Nombres, identificadores y la sección activa; sin búsqueda.
//
// Salió de app.js en el paso 4 del ADR 0005, sin cambiar nada de lo que hace
// (golden master idéntico). Sin DOM: se importa igual desde Node.
import { estado, alReiniciar } from '../estado.js';
import { normalizeText, tokenize, variantes } from './texto.js';

/* El nombre del archivo, cuando trae el código de sección delante: «237 ZAPATOS
   HOMBRES», «388 VINOS Y LICORES». Así se descarga del portal y así la llama el
   asesor. Se corta en «MANUAL», que es lo que siempre viene detrás. Se exige
   una palabra de verdad después del código, para que «205_201_20BICI_N» —dos
   códigos seguidos y una palabra rota— no cuente como nombre. */
/** @param {string} docName @returns {string | null} */
export function seccionEnArchivo(docName){
  const limpio=docName.replace(/^[0-9a-f]{6,}-/i,'').replace(/\.pdf$/i,'')
    .replace(/[_\-]+/g,' ').replace(/\s+/g,' ').trim();
  const m=limpio.match(/^\d{2,4}\s+[A-Za-zÁÉÍÓÚÑáéíóúñ]{3,}(?:\s+[A-Za-zÁÉÍÓÚÑáéíóúñ]+)*/);
  if(!m)return null;
  const nombre=m[0].replace(/\s+manual\b.*$/i,'').trim();
  return nombre.length>5?nombre.toUpperCase():null
}
/** @param {string} a @param {string} b */
export function compartenPalabra(a,b){
  /* Por prefijo: al descargar se pierde el acento y «DULCERÍA» llega partida
     como «DULCER A». Sigue siendo la misma palabra. */
  /** @param {string} s */
  const pal=s=>tokenize(s).filter(t=>t.length>3&&!/^\d+$/.test(t));
  const A=pal(a),B=pal(b);
  return A.some(x=>B.some(y=>x.startsWith(y)||y.startsWith(x)))
}
/* Lo que el manual dice de sí mismo en el texto: «El cliente de la sección 285
   ROPA INTERIOR…», «Al entrar a la sección 323 ARTÍCULOS DE VIAJE…». Medido
   sobre 33 manuales reales, es la fuente que más acierta: el check list venía
   copiado de otro manual —el de calcetines dice «281 ROPA INTERIOR», igual
   que el de ropa interior, y el de blancos «365», que es el número de
   librería— y el primer título de la lámina daba «URBANO» por ACCESORIOS
   HOMBRE. Se cuentan las menciones y, si hay varias secciones nombradas (el de
   calcetines también nombra a su vecina, ROPA INTERIOR), desempata el archivo. */
export const MENCION_SECCION=/secci[oó]n(?:es)?\s+(?:de\s+)?(\d{2,4}(?:\s*(?:,|y|-)\s*\d{2,4})*(?:\s+(?:[A-ZÁÉÍÓÚÑ&]{2,}|Y|DE))+)/g;
/** @type {Map<string, string | null> | null} */
let nombresEnTexto=null;
/** @param {string} docName @returns {string | null} */
export function seccionEnTexto(docName){
  if(!nombresEnTexto)nombresEnTexto=new Map();
  if(nombresEnTexto.has(docName))return/** @type {string | null} */ (nombresEnTexto.get(docName));
  const cuenta=new Map();
  for(const c of estado.docChunks){
    if(c.docName!==docName)continue;
    for(const m of (c.text||'').matchAll(MENCION_SECCION)){
      /* «Realiza cruce con producto de la sección 110 DECORACIÓN TEXTIL»,
         «puede colindar con la sección 111 COLCHONES»: eso nombra a una
         vecina, no a la sección del manual. Con el manual real de Decoración
         Hogar las dos menciones de cruce empataban con las dos propias y el
         desempate por largo lo bautizaba «110 DECORACIÓN TEXTIL». */
      if(/\b(?:cruce|colind\w*|vecin\w*|complement\w*|juntos?|cerca)\b/i.test((c.text||'').slice(Math.max(0,m.index-50),m.index)))continue;
      const n=m[1].replace(/\s+/g,' ').replace(/(?:\s+(?:Y|DE))+$/,'').trim();
      if(!/[A-ZÁÉÍÓÚÑ]{3,}/.test(n))continue;
      cuenta.set(n,(cuenta.get(n)||0)+1);
    }
  }
  const archivo=docName.replace(/\.pdf$/i,'');
  let mejor=null,puntos=-1;
  for(const[n,k]of cuenta){
    const p=k+(compartenPalabra(n,archivo)?100:0)+n.length/1000;
    if(p>puntos){puntos=p;mejor=n}
  }
  nombresEnTexto.set(docName,mejor);
  return mejor
}
/* «Manual Baño.pdf», «Manual Flores y Velas 2022 (1).pdf»: sin código de
   sección, el archivo sin la palabra «manual» es mejor nombre que el primer
   título de la lámina, que en estos manuales es «La importancia de la imagen
   en la sección». */
/** @param {string} docName @returns {string | null} */
export function seccionEnArchivoSinCodigo(docName){
  if(!/manual/i.test(docName))return null;
  /* Primero los guiones bajos: «_Manual Gourmet» no tiene frontera de palabra
     antes de «Manual» y la palabra se quedaba en el nombre. */
  const n=docName.replace(/\.pdf$/i,'').replace(/[_\-]+/g,' ').replace(/\(\d+\)/g,' ')
    .replace(/\bmanual(?:es)?\b|\bde exhibici[oó]n\b|\b(?:19|20)\d{2}\b/gi,' ')
    .replace(/\s+/g,' ').trim().replace(/^(?:de|del)\s+/i,'').trim();
  return /[A-Za-zÁÉÍÓÚÑáéíóúñ]{3,}/.test(n)?n.toUpperCase():null
}
/** @param {string} docName @returns {string} */
export function nombreDeSeccion(docName){
  const enTexto=seccionEnTexto(docName);
  if(enTexto)return enTexto;
  const propios=estado.docChunks.filter(c=>c.docName===docName);
  /** @param {string | undefined} h */
  const util=h=>h&&h.trim().length>5&&!/:$/.test(h.trim());
  const archivo=seccionEnArchivo(docName);
  /* Estos manuales numeran la sección en el rótulo: «271 CASUAL», «512 MUJER
     CLÁSICA», «101 MUEBLES». Es el nombre con el que el asesor la llama. */
  for(const c of propios){
    const m=(c.heading||'').match(/^(\d{2,4}\s+[A-ZÁÉÍÓÚÑ][^:]*)$/);
    if(m&&util(m[1]))return m[1].trim();
  }
  for(const c of propios){
    const m=(c.heading||'').match(/CHECK\s*LIST\s*:?\s*(.+)/i);
    if(m&&util(m[1])){
      /* El check list rotula a veces con la familia de la tienda y no con la
         sección: el manual de vinos y licores se llama ahí «388 DIVERSOS», y
         por «diversos» no lo busca nadie. Si el archivo trae el código y no
         comparte ni una palabra con ese rótulo, manda el archivo. */
      if(archivo&&!compartenPalabra(m[1],archivo))return archivo;
      return m[1].trim();
    }
  }
  /* Antes que el primer título de la página 2: ese título es de la lámina, no
     de la sección. El manual de zapatos salía llamándose «ENTRADA PEATONAL». */
  if(archivo)return archivo;
  const sinCodigo=seccionEnArchivoSinCodigo(docName);
  if(sinCodigo)return sinCodigo;
  const primera=propios.find(c=>util(c.heading)&&/** @type {number} */ (c.page)<=2&&!/^(propuesta|planograma|marcas?|conjunto|exterior)\b/i.test(/** @type {string} */ (c.heading)));
  if(primera)return/** @type {string} */ (primera.heading).trim();
  /* Último recurso: el nombre de archivo. Llega con hash, guiones bajos y a
     veces con el escape de la URL a medio deshacer, así que se limpia. */
  return docName.replace(/^[0-9a-f]{6,}-/i,'').replace(/\.pdf$/i,'')
    .replace(/%?20/g,' ').replace(/[_\-]+/g,' ').replace(/\s+/g,' ')
    .replace(/^\d+\s+\d+\s+/,'').trim()||docName
}
/* ── LA SECCIÓN QUE NOMBRA LA PREGUNTA ────────────
   Estos manuales son la misma plantilla con distintos datos. Medido entre
   101 MUEBLES y 251 JUVENILES: 22 títulos idénticos —PROPUESTA DE VALOR,
   CIRCULACIÓN DEL CLIENTE, DISPLAY, ALINEACIÓN, LIMPIEZA…— y bajo ALINEACIÓN
   los dos dicen 80 cm. Pero «¿qué porcentaje es el cliente clásico?» vale 25.6%
   en Muebles y 0% en Juveniles.

   Eso hace que preguntar con la sección equivocada activa sea peor que no tener
   manual: la respuesta no sale vacía, sale un número creíble y falso, con su
   página y su lámina. Y ningún ajuste de la búsqueda lo puede evitar, porque el
   vocabulario de los dos manuales es el mismo.

   Lo único que los distingue es cómo se llama la sección, y eso el asesor lo
   escribe: «los perímetros EN JUVENILES». Así que el nombre de la sección se
   busca dentro de la pregunta.

   Un término solo identifica si de verdad señala a un manual: «juveniles»
   aparece casi solo en el suyo, pero «muebles» aparece en todos —son muebles de
   exhibición— y no identifica nada. Se exige que la mayoría de los fragmentos
   que contienen el término sean de ese documento. */
export const DISCRIMINA_MIN=0.7;
export const DOMINANCIA_MIN=0.4;
/** @type {Identificador[] | null} */
let identificadores=null;
/** @returns {Identificador[]} */
export function identificadoresDeSeccion(){
  if(identificadores)return identificadores;
  identificadores=[];
  if(!estado.docChunks.length)return identificadores;
  const porTermino=new Map();
  for(const c of estado.docChunks){
    if(!c.tf)continue;
    for(const t in c.tf){
      let m=porTermino.get(t);
      if(!m){m=new Map();porTermino.set(t,m)}
      m.set(c.docName,(m.get(c.docName)||0)+1);
    }
  }
  for(const d of estado.docs){
    const nombre=nombreDeSeccion(d.name);
    /* También el nombre del archivo: «Manual_Juveniles_Urban_Zone» trae «urban
       zone», que el rótulo interno no tiene y el asesor sí usa. */
    const crudo=d.name.replace(/^[0-9a-f]{6,}-/i,'').replace(/\.pdf$/i,'').replace(/[_\-]+/g,' ');
    const delNombre=new Set([...tokenize(nombre),...tokenize(crudo)]);
    /* Los nombres bajados del portal llegan con el escape de la URL a medio
       deshacer y el «%20» pegado a la palabra: «205_201_20BICI_N.pdf» daba
       «20bici», que no es nada. Se prueba también sin ese 20 delante — pero solo
       cuando lo que sigue son letras, para no convertir «205» en «5». */
    for(const t of[...delNombre])if(/^20[a-z]{2,}$/.test(t))delNombre.add(t.slice(2));
    const terminos=[];
    for(const t of delNombre){
      if(t==='manual')continue;
      const m=porTermino.get(t);
      /* Un código de sección («251», «101») puede no estar en el cuerpo del
         manual y aun así ser el identificador más limpio que existe. */
      if(!m){if(/^\d{2,4}$/.test(t))terminos.push(t);continue}
      let total=0;for(const v of m.values())total+=v;
      if(total&&(m.get(d.name)||0)/total>=DISCRIMINA_MIN)terminos.push(t);
    }
    /* Si la sección se quedó sin una sola palabra —solo con su número— el
       asesor no la puede nombrar: escribe «en blancos», no «en 365». Ahí se
       baja el listón hasta la dominancia clara: más del doble que el segundo
       manual y al menos el 40%. Medido, «blancos» tiene 10 de 15 fragmentos
       —67%, tres puntos por debajo del corte— con el segundo en 4, y entra;
       «muebles» (16 propios de 85, con dulcería en 15) y «casual» (15 propios
       contra 26 en zapatos) siguen fuera, que es lo correcto: son ambiguos.

       Solo cuando no hay ninguna, nunca como añadido. «512 MUJER CLÁSICA» ya
       se identifica por «clásica»; sumarle «mujer» bloquearía preguntas
       legítimas de vestidos de fiesta, que también son de mujer. */
    if(!terminos.some(t=>!/^\d+$/.test(t))){
      for(const t of delNombre){
        if(t==='manual'||/^\d+$/.test(t))continue;
        const m=porTermino.get(t);
        if(!m)continue;
        let total=0,mayorAjeno=0,mio=0;
        for(const[dn,v]of m){
          total+=v;
          if(dn===d.name)mio=v;else if(v>mayorAjeno)mayorAjeno=v;
        }
        if(total&&mio/total>=DOMINANCIA_MIN&&mio>mayorAjeno*2)terminos.push(t);
      }
    }
    if(terminos.length)identificadores.push({docName:d.name,nombre,terminos});
  }
  return identificadores
}
/** @param {string} q @returns {Identificador[]} */
export function seccionesNombradasEnPregunta(q){
  const lista=identificadoresDeSeccion();
  /* Con un solo manual cargado no hay con qué confundirse. */
  if(lista.length<2)return[];
  const toks=new Set(tokenize(q||''));
  /* Singular o plural da igual: «la corbata en camisas» nombra CAMISAS Y
     CORBATAS igual que «las corbatas». El género no: «fino» no es MESA FINA.
     Cada sección recuerda con qué palabra se la nombró (`termino`): con otra
     sección activa, `decidirSeccion` mira si esa palabra también es de la
     activa antes de mandar al asesor a otra. */
  /** @param {string} t */
  const nombra=t=>toks.has(t)||toks.has(t+'s')||toks.has(t+'es')||(t.length>4&&t.endsWith('s')&&(toks.has(t.slice(0,-1))||(t.endsWith('es')&&toks.has(t.slice(0,-2)))));
  const out=[];
  for(const id of lista){const t=id.terminos.find(nombra);if(t)out.push({...id,termino:t})}
  return out
}
/** @param {string} q */
export function seccionNombradaEnPregunta(q){return seccionesNombradasEnPregunta(q)[0]||null}
/* ¿La palabra va dicha como nombre de sección? Al principio de la pregunta o
   justo detrás de «en», «de» o «para», sin artículo: «en muebles», «papelería
   qué va en el POS». Con artículo —«los muebles», «la ropa»— es un tema. */
/** @param {string} q @param {string[]} formas */
export function dichaComoSeccion(q,formas){
  const t=normalizeText(q||'').split(/\s+/).filter(Boolean);
  return t.some((w,i)=>formas.includes(w)&&(i===0||/^(en|de|para)$/.test(t[i-1])))
}
/* La sección que no tiene ni una palabra propia —101 MUEBLES solo tiene su
   número, GOURMET ni eso— también se nombra en el piso: «en muebles, ¿qué
   pasillo dejo?». La palabra suelta no identifica, porque todos los manuales
   hablan de muebles; pero dicha COMO sección sí (`dichaComoSeccion`). «¿Qué va
   en los muebles del POS?» no la nombra. Y solo para elegir dónde buscar cuando
   no hay sección activa (`enrutarSeccion`): con una elegida, «muebles» es tema
   de esa sección y no un motivo para mandar al asesor a otra. La palabra tiene
   que ser exclusiva de un nombre: «hombres» no vale, porque está en ZAPATOS
   HOMBRES y en ACCESORIOS HOMBRE. */
/** @param {string} q @returns {Identificador | null} */
export function seccionNombradaComoTal(q){
  if(estado.docs.length<2)return null;
  const ids=identificadoresDeSeccion();
  const conPalabra=new Set(ids.filter(i=>i.terminos.some(t=>!/^\d+$/.test(t))).map(i=>i.docName));
  const palabras=estado.docs.map(d=>({docName:d.name,nombre:nombreDeSeccion(d.name),
    toks:tokenize(nombreDeSeccion(d.name)).filter(t=>t.length>=4&&!/^\d+$/.test(t)&&t!=='manual')}));
  /** @param {{ docName: string }} d */
  const ajenas=d=>new Set(palabras.filter(p=>p.docName!==d.docName).flatMap(p=>p.toks.flatMap(t=>variantes(t))));
  const hallados=new Set();
  for(const p of palabras){
    if(conPalabra.has(p.docName))continue;
    const otras=ajenas(p);
    const suyas=p.toks.filter(t=>!variantes(t).some(v=>otras.has(v)));
    if(suyas.some(t=>dichaComoSeccion(q,[t,t+'s',t+'es',t.replace(/e?s$/,'')])))hallados.add(p.docName);
  }
  if(hallados.size!==1)return null;
  const docName=[...hallados][0];
  return{docName,nombre:nombreDeSeccion(docName),terminos:[]}
}
/** @returns {string | null} */
export function seccionActiva(){
  if(!estado.docChunks.length)return null;
  if(estado.manualActivo)return nombreDeSeccion(estado.manualActivo);
  const nombres=estado.docs.map(d=>nombreDeSeccion(d.name));
  return nombres.length===1?nombres[0]:null
}

/** @type {Map<string, string> | null} */
let secPorDoc=null;
/** El nombre de la sección de un manual, recordado. @param {string | null | undefined} doc */
export function secDe(doc){
  if(!doc)return null;
  if(!secPorDoc)secPorDoc=new Map();
  if(!secPorDoc.has(doc))secPorDoc.set(doc,nombreDeSeccion(doc));
  return secPorDoc.get(doc)
}

/* Lo que depende del corpus se olvida cuando el corpus cambia. */
alReiniciar(() => {
  nombresEnTexto = null;
  identificadores = null;
  secPorDoc = null;
});
