// Erratas, fonética y el vocabulario de cada manual.
//
// Las cachés se olvidan solas cuando el corpus cambia (alReiniciar).
//
// Salió de app.js en el paso 3 del ADR 0005, sin cambiar nada de lo que hace
// (golden master idéntico). Sin DOM: se importa igual desde Node.
import { estado, alReiniciar } from '../estado.js';
import { normalizeText } from './texto.js';

/* ── ERRATAS ──────────────────────────────────────
   En el piso se escribe rápido y con el teclado del teléfono: «entayado»,
   «corvatas», «colorisación». Hoy eso devuelve cero, y cero se lee como "el
   manual no lo dice".

   Se busca la palabra del manual más parecida por trigramas, y solo cuando la
   escrita —y todas sus variantes de plural y género— no existe en el índice: si
   el asesor escribió una palabra que el manual usa, no hay nada que corregir.
   La candidata entra con el mismo descuento que un sinónimo, nunca sustituye a
   lo que se escribió, y con el listón alto (0.6 de solapamiento y tres letras de
   diferencia como mucho) para que «llanta» no se convierta en «plantilla». */
/** @typedef {{ palabras: Map<string, number>, raices: Map<string, number>, texto: string }} VocabDeManual */

/** @type {Map<string, string[]> | null} */
let vocabTrigramas=null;
/** @param {string} w */
export function trigramas(w){
  const s='  '+w+' ',out=[];
  for(let i=0;i+3<=s.length;i++)out.push(s.slice(i,i+3));
  return out
}
export function indiceTrigramas(){
  if(vocabTrigramas)return vocabTrigramas;
  const m=new Map();
  for(const t in estado.bm25.df){
    if(t.length<4)continue;
    const gs=trigramas(t);
    for(const g of gs){let a=m.get(g);if(!a)m.set(g,a=[]);a.push(t)}
  }
  return vocabTrigramas=m
}
/* Raíz de andar por casa: quita la terminación y deja el tronco. No pretende
   ser un lematizador; sirve para una sola pregunta, la de abajo. */
/** @param {string} w */
export function raizCorta(w){
  /* «-al» y «-il» están aquí por un caso del piso: «preferencial» es una
     derivación legítima de «preferencia», no una errata suya, y el corrector
     por trigramas las da por iguales (0.85 de parecido). Con la misma raíz, la
     corrección deja de contar como errata y entra con peso de sinónimo, que es
     lo que es: una apuesta, no la palabra que el asesor escribió bien. */
  return(w||'').replace(/(?:aciones|acion|ados|adas|ado|ada|ares|ales|iles|ar|er|ir|al|il|os|as|es|s|o|a|e)$/,'')
}
export const ERRATA_MIN=0.6;
/* Una errata de teclado cambia una o dos letras, no tres. Sin tope, el
   parecido por trigramas corregía palabras bien escritas que el manual
   simplemente no usa: «¿cómo se hace el inventario?» se leía como
   «inventados» —de la nota de la portada— y la portada salía de respuesta. */
/** @param {string} a @param {string} b */
export function distanciaEdicion(a,b){
  const m=a.length,n=b.length;
  let prev2=null,prev=Array.from({length:n+1},(_,j)=>j);
  for(let i=1;i<=m;i++){
    const cur=[i];
    for(let j=1;j<=n;j++){
      cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));
      if(prev2&&i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])cur[j]=Math.min(cur[j],prev2[j-2]+1);
    }
    prev2=prev;prev=cur;
  }
  return prev[n]
}
/** @param {string} w */
export const topeErrata=w=>w.length>=7?2:1;
/* Cómo suena, no cómo se escribe: s/z/c, ll/y, b/v, la h muda. Los trigramas no
   ven que «senzor» es «sensor» —en una palabra corta una sola letra rompe tres
   de cuatro trigramas— y el asesor escribe de oído. */
/** @param {string} w */
export function fonetica(w){
  return w.replace(/h/g,'').replace(/ll/g,'y').replace(/v/g,'b').replace(/qu/g,'k')
    .replace(/c([ei])/g,'s$1').replace(/z/g,'s').replace(/c/g,'k').replace(/(.)\1+/g,'$1')
}
/** @type {Map<string, string> | null} */
let vocabFonetico=null;
export function indiceFonetico(){
  if(vocabFonetico)return vocabFonetico;
  const m=new Map();
  for(const t in estado.bm25.df){
    if(t.length<4)continue;
    const k=fonetica(t);
    const a=m.get(k);
    if(!a||estado.bm25.df[t]>estado.bm25.df[a])m.set(k,t);
  }
  return vocabFonetico=m
}
/* La errata se corrige hacia el manual que el asesor tiene abierto. El
   vocabulario es el de todos los manuales cargados, y con treinta a la vez
   «botyas» en VINOS Y LICORES se corregía a «botas» —de ZAPATOS, más común y a
   una letra— en vez de a «botellas», que es la palabra de su lámina. Primero
   se busca entre las palabras de la sección activa y, si ahí no hay nada, en
   todas, como antes. */
/** @type {Map<string, Map<string, string>>} */
let foneticoPorDoc=new Map();
/** @param {string} doc */
export function indiceFoneticoDeDoc(doc){
  let m=foneticoPorDoc.get(doc);
  if(m)return m;
  m=new Map();
  for(const[t]of vocabDeDoc(doc)){
    if(t.length<4||!(t in estado.bm25.df))continue;
    const k=fonetica(t),a=m.get(k);
    if(!a||estado.bm25.df[t]>estado.bm25.df[a])m.set(k,t);
  }
  foneticoPorDoc.set(doc,m);
  return m
}
/* Las palabras en inglés se escriben como suenan: «snikers» es SNEAKERS, y los
   trigramas lo llevaban a «stickers» —de Papelería, a dos letras— con lo que «ke
   marcas ban en snikers» salía en blanco en ZAPATOS. Se indexa cómo se lee la
   palabra del manual en voz alta: «ea» y «ee» suenan i, «oo» suena u. Solo
   cuenta el sonido idéntico, nunca el parecido. */
/** @param {string} t */
export const COMO_SE_LEE=t=>t.replace(/ea|ee/g,'i').replace(/oo/g,'u');
/** @type {Map<string, string> | null} */
let vocabLeido=null;
export function indiceLeido(){
  if(vocabLeido)return vocabLeido;
  const m=new Map();
  for(const t in estado.bm25.df){
    if(t.length<4||COMO_SE_LEE(t)===t)continue;
    const k=fonetica(COMO_SE_LEE(t)),a=m.get(k);
    if(!a||estado.bm25.df[t]>estado.bm25.df[a])m.set(k,t);
  }
  return vocabLeido=m
}
/* El índice también lee así palabras españolas —«proveedor» sonaría
   «probidor»—, que nadie pronuncia de esa forma. Por eso la lectura en inglés
   solo gana a una apuesta floja: si el corrector de siempre encuentra algo a una
   letra o que suena igual en español, manda él («probidor» → «probador»). */
/** @param {string} w @returns {string | null} */
export function masParecida(w){
  const porLetras=masParecidaPorLetras(w);
  const leida=w.length>=4&&indiceLeido().get(fonetica(w));
  if(!leida||leida===w)return porLetras;
  if(porLetras&&(distanciaEdicion(w,porLetras)<=1||fonetica(porLetras)===fonetica(w)))return porLetras;
  return leida
}
/** @param {string} w @returns {string | null} */
export function masParecidaPorLetras(w){
  const activo=estado.docChunks.length&&estado.manualActivo?estado.manualActivo:null;
  const delActivo=activo?vocabDeDoc(activo):null;
  /** @param {string} t */
  const enActivo=t=>!!delActivo&&delActivo.has(t);
  const fw=fonetica(w);
  /* «que ba en la tore»: TORRE está en la página 11 y la palabra tiene cuatro
     letras, así que el corrector ni la miraba. En una palabra tan corta una
     letra ya es otra palabra, por eso aquí solo vale el sonido idéntico —la rr
     que se escribe r— y nunca el parecido. */
  if(w.length===4){
    const t=(activo&&indiceFoneticoDeDoc(activo).get(fw))||indiceFonetico().get(fw);
    return t&&t!==w?t:null
  }
  if(w.length<5)return null;
  const idx=indiceTrigramas(),gs=trigramas(w),cuenta=new Map();
  for(const g of gs){const a=idx.get(g);if(!a)continue;for(const t of a)cuenta.set(t,(cuenta.get(t)||0)+1)}
  let mejor=null,mejorP=0,propia=null,propiaP=0;
  for(const[t,c]of cuenta){
    if(Math.abs(t.length-w.length)>3)continue;
    const p=c/Math.max(gs.length,trigramas(t).length);
    if(p<ERRATA_MIN||distanciaEdicion(w,t)>topeErrata(w))continue;
    if(p>mejorP){mejorP=p;mejor=t}
    if(enActivo(t)&&p>propiaP){propiaP=p;propia=t}
  }
  if(propia)return propia;
  /* Letras cambiadas de lugar: «Trevsik» por «Tresvik». Con nombres de marca
     es la errata más común —se escriben de memoria— y no la alcanzaba nada: la
     «t» se movió dos lugares, rompe la mitad de los trigramas (0.44) y suena a
     dos letras de distancia. Mismas letras, misma primera letra, seis o más:
     con menos, dos palabras distintas comparten letras por casualidad. */
  if(w.length>=6){
    const firma=[...w].sort().join('');
    let ana=null,anaDf=0;
    for(const t in estado.bm25.df){
      if(t.length!==w.length||t[0]!==w[0]||t===w)continue;
      if(activo&&!enActivo(t))continue;
      if([...t].sort().join('')!==firma)continue;
      /* Letras movidas, no otra palabra con las mismas letras: «cartón» es
         anagrama de «contar» (a cuatro ediciones) y se corregía a ella, así que
         «¿las plumas se quedan en su caja de cartón?» perdía el aviso de que el
         manual no habla de cartón. «Trevsik» está a una. */
      if(distanciaEdicion(w,t)>2)continue;
      if(estado.bm25.df[t]>anaDf){anaDf=estado.bm25.df[t];ana=t}
    }
    if(ana&&(activo||!mejor))return ana;
  }
  if(!activo&&mejor)return mejor;
  const oido=(activo?indiceFoneticoDeDoc(activo):indiceFonetico()).get(fw);
  if(oido&&oido!==w)return oido;
  /* Cómo suena Y una letra comida, que es la errata del pulgar: «likidcion»,
     «mankies», «serveas». Ni los trigramas (demasiados rotos en una palabra
     corta) ni el sonido exacto las alcanzaban, y eran la palabra clave de la
     pregunta. Misma primera letra, a una edición de sonido, y entre varias la
     que más usa el manual. Solo en palabras de seis o más: en una de cinco,
     una letra ya es otra palabra, y «motos» salía como «moños». */
  /** @param {number} tope @param {number} difLargo @param {(k: string) => boolean} extra @param {boolean} soloActivo */
  const cercaDe=(tope,difLargo,extra,soloActivo)=>{
    /** @type {string | null} */
    let cerca=null,df=0;
    for(const[k,t]of indiceFonetico()){
      if(k[0]!==fw[0]||Math.abs(k.length-fw.length)>difLargo||t===w||!extra(k))continue;
      if(soloActivo&&!enActivo(t))continue;
      if(estado.bm25.df[t]>df&&distanciaEdicion(fw,k)<=tope){df=estado.bm25.df[t];cerca=t}
    }
    return cerca
  };
  /* Las dos letras que se come el pulgar en una palabra larga: «liidasion»,
     «likidacon», «clasiican», «laavajiyas». A una sola edición no llegaban a
     LIQUIDACIÓN, CLASIFICACIÓN ni LAVAVAJILLAS. Con dos ediciones cualquier
     palabra se parece a otra, así que el listón sube: ocho sonidos o más, las
     dos primeras letras y la última iguales, y la palabra buena más larga que
     la errata, porque el pulgar come letras. Sin esto último «mascotas» se
     leía como «macetas» y la pregunta trampa encontraba la lámina de PROPS.
     «incapacidad» → «capacidad» sigue fuera, porque empieza distinto. */
  /** @param {string} k */
  const dosLetras=k=>k.length>fw.length&&k.slice(0,2)===fw.slice(0,2)&&k.slice(-1)===fw.slice(-1);
  /** @param {boolean} soloActivo */
  const pasos=soloActivo=>(fw.length>=6&&cercaDe(1,1,()=>true,soloActivo))
    ||(fw.length>=8&&cercaDe(2,2,dosLetras,soloActivo))||null;
  if(!activo)return pasos(false);
  const propiaCerca=pasos(true);
  if(propiaCerca)return propiaCerca;
  /* Nada en la sección activa: lo de siempre, en todos los manuales. */
  if(mejor)return mejor;
  const oidoTodos=indiceFonetico().get(fw);
  if(oidoTodos&&oidoTodos!==w)return oidoTodos;
  return pasos(false)
}

/* El vocabulario de CADA manual por separado, no solo el del activo. Sirve para
   la pregunta que importa aquí: ¿esta palabra existe en el manual del asesor, o
   solo en el de al lado? */
/** @type {Map<string | undefined, VocabDeManual> | null} */
let vocabPorDoc=null;
export function construirVocabPorDoc(){
  const porDoc=vocabPorDoc=new Map();
  for(const c of estado.docChunks){
    let s=porDoc.get(c.docName);
    if(!s)porDoc.set(c.docName,s={palabras:new Map(),raices:new Map(),texto:''});
    if(c.tf)for(const t in c.tf){
      s.palabras.set(t,(s.palabras.get(t)||0)+1);
      const r=raizCorta(t);
      if(r.length>2)s.raices.set(r,(s.raices.get(r)||0)+1);
    }
    /* El texto entero normalizado, para poder buscar FRASES y no solo palabras
       sueltas. Es lo que distingue el caso que se vio en el piso: «propia» sí
       está en el manual de MUEBLES —una vez, dentro de ESTILO INDUSTRIAL,
       hablando de estética— y «marca propia» no está en absoluto. */
    s.texto+=' '+normalizeText((c.heading?c.heading+' ':'')+(c.text||'')).replace(/\s+/g,' ');
  }
}
/** @param {string} doc */
export function vocabDeDoc(doc){
  if(!vocabPorDoc)construirVocabPorDoc();
  return(/** @type {Map<string | undefined, VocabDeManual>} */(vocabPorDoc).get(doc)||{palabras:new Map(),raices:new Map()}).palabras
}
/* Y las raíces, que es con lo que hay que comparar para decidir si una palabra
   «no está» en un manual: el asesor escribe «acomodo» y el manual escribe
   «acomoda» o «acomodar». Comparando formas exactas, tres preguntas buenas de
   la batería salían con el aviso de palabra ausente puesto sobre un verbo
   corriente. La raíz las une y deja fuera lo que de verdad falta: «sábanas» no
   comparte raíz con nada de ZAPATOS. */
/** @param {string} doc */
export function raicesDeDoc(doc){
  if(!vocabPorDoc)construirVocabPorDoc();
  return(/** @type {Map<string | undefined, VocabDeManual>} */(vocabPorDoc).get(doc)||{palabras:new Map(),raices:new Map()}).raices
}
/** @param {string} doc */
export function textoDeDoc(doc){
  if(!vocabPorDoc)construirVocabPorDoc();
  return(/** @type {Map<string | undefined, VocabDeManual>} */(vocabPorDoc).get(doc)||{texto:''}).texto
}

/* Lo que depende del corpus se olvida cuando el corpus cambia. */
alReiniciar(() => {
  vocabTrigramas = null;
  vocabFonetico = null;
  vocabLeido = null;
  foneticoPorDoc = new Map();
  vocabPorDoc = null;
});
