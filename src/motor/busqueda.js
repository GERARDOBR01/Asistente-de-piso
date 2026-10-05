// La búsqueda: términos con peso, retrieve y el empaquetado del contexto.
//
// Lo aprendido en el piso entra por aprendido.js.
//
// Salió de app.js en el paso 4 del ADR 0005, sin cambiar nada de lo que hace
// (golden master idéntico). Sin DOM: se importa igual desde Node.
import { estado, alReiniciar } from '../estado.js';
import { STOPWORDS, normalizeText, expandKeywords, tokenize, palabrasDeConsulta, variantes } from './texto.js';
import { raizCorta, distanciaEdicion, fonetica, masParecida } from './erratas.js';
import { bm25Score } from './indice.js';
import { textoComoDato, envolverComoDato } from '../seguridad/inyeccion.js';
import { nombreDeSeccion, secDe } from './secciones.js';
import { exigenciaDeSolidez, nivelDeEvidencia } from './solidez.js';
import { palabrasDelPiso, atajosDelPiso } from './aprendido.js';

/* Los sinónimos siguen siendo el puente entre cómo pregunta la gente
   ("acomodar") y cómo escribe el manual ("distribución"), pero pesan
   menos que la palabra que el asesor realmente escribió: expandir sin
   descontar es lo que hacía que una consulta se fuera por la tangente. */
export const SYNONYM_WEIGHT=0.55;
export const APRENDE_BONO_ATAJO=0.25;           // sobre el mejor puntaje de la consulta

/* Cada término recuerda de qué palabra del asesor salió (`g`). Sin eso,
   «pasillos» aportaría un acierto por cada forma que probamos y el conteo de
   aciertos —que es el que decide si hay respuesta o no— quedaría inflado por
   una sola palabra. */
/** @param {string} query @param {string | null} [doc] @returns {Termino[]} */
export function weightedTerms(query,doc){
  const palabras=palabrasDeConsulta(query);
  /** @type {Map<string, { w: number, g: string }>} */
  const terms=new Map();
  /** @type {Map<string, string>} */
  const corregidas=new Map();
  /** @param {string} t @param {number} w @param {string} g */
  const add=(t,w,g)=>{if(t&&!terms.has(t))terms.set(t,{w,g})};
  /* Se prueban TODAS las formas que existan en el índice, no solo cuando la
     escrita falta. La regla vieja —"si la palabra existe, el manual ya usa esa
     forma"— era cierta mientras el acierto se medía por trozo de palabra;
     midiendo palabras enteras es falsa: «pasillo» aparece en la sección de
     Tallas Especiales y «Pasillos: 90 cm» en la de datos técnicos, y quedarse
     con la primera forma dejaba fuera precisamente la lámina que contesta.
     No infla el conteo: todas las formas comparten grupo (`k`) y `hits` cuenta
     grupos, no términos. */
  /** @param {string} t @param {number} w @param {string} g */
  const conVariantes=(t,w,g)=>{
    add(t,w,g);
    let existe=!!estado.bm25.df[t];
    for(const v of variantes(t))if(estado.bm25.df[v]){add(v,w,g);existe=true}
    return existe
  };
  for(const k of palabras){
    for(const t of tokenize(k)){
      /* Ni la palabra ni ninguna de sus formas está en el manual: puede ser una
         errata, y entonces se prueba la palabra más parecida con descuento. */
      if(!conVariantes(t,1,k)&&!esVerbo(k)){
        /* La errata se marca con «!» y no con «~» para poder contarla aparte:
           una palabra del diccionario es una apuesta del sistema, pero una
           errata corregida ES la palabra que el asesor escribió, bien escrita.

           Con una condición que costó una prueba del arnés: solo cuenta como
           errata si la raíz cambia. El corrector busca por trigramas y no sabe
           distinguir una errata de una forma legítima —«cambio» y «cambiar»
           salen igual de parecidas que «colorisacion» y «colorizacion»—, pero
           la raíz sí: en el primer caso es la misma («cambi») y en el segundo
           no. Y una forma legítima ya tuvo su oportunidad en `variantes`; si
           falló ahí, no es una errata del asesor. Sin esto, «¿cómo cambio la
           llanta del coche?» volvía a pasar por pregunta contestable. */
        const cerca=masParecida(t);
        if(cerca){
          add(cerca,SYNONYM_WEIGHT,(raizCorta(cerca)===raizCorta(t)?'~':'!')+k);
          /* A sus sinónimos solo si está a una letra: «prmero» → «primero» sí;
             «incapacidad» → «capacidad» (dos) llevaba a SURTIDO y LIMPIEZA. */
          if(distanciaEdicion(t,cerca)<=1)corregidas.set(k,cerca);
        }
      }
    }
  }
  /* Aquí NO se usan los infinitivos, y está medido: metiéndolos, «¿cómo cambio
     la llanta del coche?» alcanzaba los sinónimos de «cambiar» —rotar,
     actualizar, renovar— y dos de ellos bastaban para que la pregunta pasara
     por contestable. El recall de la batería es el mismo con ellos y sin ellos
     (88 de 88), así que no compran nada y cuestan una prueba de ruido. Donde sí
     hacen falta es en `terminosAusentes`, que es una comprobación y no una
     búsqueda: allí ensanchar solo puede callar un aviso, nunca inventarlo. */
  /* La palabra corregida también llama a la puerta del diccionario: «q va
     prmero en el pos» corregía a «primero», pero los sinónimos se buscaban con
     «prmero», y «Prioridad 1» —como lo escriben los manuales— no llegaba. */
  for(const k of palabras){
    for(const base of variantes(k))for(const phrase of expandKeywords([base])){
      if(phrase===base)continue;
      /* El diccionario está escrito en singular («pasillo») y el manual titula
         en plural («Pasillos: 90 cm»): el sinónimo se quedaba a una letra de su
         propia lámina. */
      for(const t of tokenize(phrase))conVariantes(t,SYNONYM_WEIGHT,'~'+k);
    }
    /* Los de la palabra corregida van a medio peso: son la apuesta de una
       apuesta. Cuentan para no dejar en blanco la pregunta, pero no ordenan:
       a peso entero, «las caisas ban con bolsa» corregía a «camisas» y sus
       sinónimos —prenda alta, blusa— subían ENGANCHADO sobre la lámina que
       dice «sin bolsa». */
    if(corregidas.has(k))for(const base of variantes(/** @type {string} */ (corregidas.get(k))))for(const phrase of expandKeywords([base])){
      if(phrase===base)continue;
      for(const t of tokenize(phrase))conVariantes(t,SYNONYM_WEIGHT/2,'~'+k);
    }
    /* Lo que aprendió el piso entra como una palabra más del diccionario —mismo
       peso, mismo grupo—: ayuda a llegar, pero no vale como palabra escrita. */
    for(const p of palabrasDelPiso(k,doc))for(const t of tokenize(p.manual))conVariantes(t,SYNONYM_WEIGHT,'~'+k);
  }
  return[...terms].map(([t,{w,g}])=>({t,w,g}))
}

/** @param {string} query @returns {string[]} */
export function queryShingles(query){
  const toks=normalizeText(query).split(/\s+/).filter(Boolean);
  const out=[];
  for(let n=3;n>=2;n--)for(let i=0;i+n<=toks.length;i++){
    const s=toks.slice(i,i+n).join(' ');
    if(s.length>7)out.push(s);
  }
  return out.slice(0,8)
}

export const CHECKLIST=/\bcheck ?list\b|\bchecklist\b|lista de (?:verificacion|revision)/;
export const PIDE_CHECKLIST=/check|lista|revis|verific|pendiente|todo lo que/;
export const NUMERIC_INTENT=/\bcuant|\bcuánt|\bcuanto|medida|altura|distancia|separacion|separación|porcentaje|cantidad|piezas|\bcm\b|\bmts?\b|metro|%/i;

/* «¿A qué altura va el sensor?» se contesta con «de 8 a 12 cm de la
   bastilla», y la lámina nunca escribe «altura». Esa palabra dice qué tipo de
   respuesta se busca —una medida—, igual que «porcentaje» pide una cifra: una
   lámina con una medida la cumple. Sin esto, en DISEÑADORES la lámina de
   SENSORES puntuaba primera y aun así se quedaba fuera, porque de las dos
   palabras que se le exigían solo traía «sensor». */
export const PALABRAS_DE_MEDIDA=new Set(['altura','alturas','distancia','distancias','separacion','separaciones','medida','medidas']);
export const CON_MEDIDA=/\d\s*(?:cm|centimetros?|mts?|metros?|mm)\b/;
/* Un rótulo es un fragmento sin una sola frase: la lista de marcas de un
   planograma, «Izquierda / Arriba / Adelante», «Nórdico / Industrial /
   Brutalista». Muchas veces ES la respuesta —«¿qué marcas van en premium?», «30%
   de participación»—, pero no a un «¿dónde…?» ni a un «¿cómo…?»: ahí ganaba por
   corto y por llevar la palabra en el título. En ROPA INTERIOR, «¿dónde van los
   básicos?» salía con la lista de marcas de BÁSICOS y no con
   «va en el interior de la sección o en la parte trasera». Los renglones se unen
   como en la tarjeta: el PDF corta la frase donde cortó la maqueta. */
export const PIDE_INSTRUCCION=/\b(?:donde|como|cuando|por ?que|para que)\b/;
/* Lo mismo con el precio: «¿a partir de qué precio va un vino en la cava?» se
   contesta con «mayor a $1,200.00», y salía antes MUEBLES TIPO CAVA, que dice
   «punto de precio» sin dar ninguno. Solo cuando se pregunta una cantidad:
   «¿dónde va la etiqueta de precio?» no pide ninguna. */
/** @param {string} q */
export function pideUnPrecio(q){
  return /\b(?:que|cual|cuanto|minimo|maximo|mayor|menor)\s+(?:es\s+el\s+)?precio|\bcuest(?:a|an)\b|\bpesos\b/.test(normalizeText(q).replace(/\s+/g,' '))
}
/** @param {Fragmento} c @returns {boolean} */
export function esRotulo(c){
  if(c.rotulo===undefined){
    const corrido=(c.text||'').replace(/([^.:;!?\n])\n(?=[a-záéíóúñ0-9(])/g,'$1 ');
    /* Frase: seis palabras, o tres que cierran con punto. Lo segundo es por
       las listas numeradas de características —«1. Varias formas y tamaños.»—,
       que son frases cortas y no rótulos. */
    c.rotulo=!corrido.split('\n').some(l=>{
      const n=(l.match(/\p{L}{2,}/gu)||[]).length;
      return n>=6||(n>=3&&/\.\s*$/.test(l))
    });
  }
  return c.rotulo
}
/* La lámina que se llama como lo que se preguntó. «¿Cómo etiqueto un producto
   SIN CAJA?» tiene su respuesta en una lámina titulada SIN CAJA —«se etiquetan
   en la costura»—, y salían primero CON CAJA y CAJA CON COLGADOR, que traen más
   palabras de la pregunta. El título contrario es la otra mitad: quien pregunta
   «sin caja» ya descartó la de «con caja». Solo títulos de dos palabras o más,
   porque los de una —BÁSICOS, PREMIUM, CORNER— son justo los rótulos que ya
   ganan de más. */
/** @type {Record<string, string>} */
export const OPUESTOS={sin:'con',con:'sin'};
/** @param {string} query */
export function titulosDeLaPregunta(query){
  const q=normalizeText(query).split(/\s+/).filter(Boolean);
  const formas=q.map(w=>new Set(w.length>3?variantes(w):[w]));
  /** @type {Array<{ pol: string, formas: Set<string> }>} */
  const pares=[];
  for(let i=0;i+1<q.length;i++)if(OPUESTOS[q[i]]&&q[i+1].length>=3&&!STOPWORDS.has(q[i+1]))pares.push({pol:q[i],formas:formas[i+1]});
  return{
    /** @param {string[]} h */
    nombrado(h){
      if(h.length<2)return false;
      for(let i=0;i+h.length<=q.length;i++)if(h.every((t,j)=>formas[i+j].has(t)))return true;
      return false
    },
    /* +1 si el título trae la pareja de la pregunta («sin caja»), −1 si trae la
       contraria («con caja»). Con «sin», también un título que nombra la cosa
       y dice «con» en otro sitio: CAJA CON COLGADOR es un producto con caja.
       Nombrarla a secas no basta para descartarla: SACOS Y PANTALONES no es lo
       contrario de «saco sin pantalón», es la sección entera. */
    /** @param {string[]} h */
    polaridad(h){
      let r=0;
      for(const{pol,formas:f}of pares)for(let j=0;j<h.length;j++){
        if(!f.has(h[j]))continue;
        const antes=h[j-1];
        if(antes===pol)r=Math.max(r,1);
        else if(antes===OPUESTOS[pol]||(pol==='sin'&&h.includes('con')))return -1;
      }
      return r
    }
  }
}

/* Devuelve los fragmentos ordenados, y con cuántas palabras de la pregunta
   coincidieron de verdad (`hits`). Ese conteo es lo que permite al modo sin
   API decir "esto no está en el manual" en vez de entregar lo menos malo. */
/* Los verbos con que se pregunta en el piso: «¿cómo ACOMODO los vinos?»,
   «¿dónde VAN las cervezas?», «¿cuántos cubos PONGO?». El manual casi nunca los
   usa —dice «Los vinos se exhiben en la cava»—, así que como palabra exigida
   dejaban fuera la lámina que contesta: con 30 manuales reales cargados, 27 de
   186 preguntas verificadas salían sin ninguna tarjeta. Siguen sumando puntaje
   donde aparecen, pero no cuentan como acierto ni como palabra que exigir: si
   contaran, «¿dónde van los perros?» pasaría por contestable solo por el «van». */
export const VERBOS_DE_PISO=new Set(['va','van','vaya','vayan','pongo','pone','ponen','poner','pongan','ponga','acomodo','acomoda','acomodan','acomodar','acomodamos','hago','hace','hacen','hacer','exhibo','exhibe','exhiben','exhibir','armo','arma','arman','armar','ordeno','ordena','ordenan','ordenar','coloco','coloca','colocan','colocar','sirve','sirven','servir','uso','usa','usan','usar','lleva','llevan','llevar','cuanto','cuanta','cuantos','cuantas','quito','quita','quitan','quitar','necesito','debo','deben','tengo','tienen','tener','dejo','deja','dejan','dejar',
  /* «¿Puedo poner…?» pregunta si se permite, y el tema viene después. Desde que
     la primera persona alcanza la tercera del plural —«etiqueto» → «etiquetan»—,
     «puedo» acertaba en cualquier lámina con «pueden» y contaba como palabra. */
  'puedo','pueden','podemos',
  /* Y las que dicen QUÉ TIPO de respuesta se busca, no DE QUÉ: los manuales
     escriben «56% de participación», casi nunca «porcentaje». Contando como
     acierto, «¿qué porcentaje tiene contempo?» ponía primero a LIBRERÍA —«menor
     porcentaje de participación», sin rastro de Contempo— y con Casual activa
     mandaba al asesor a Librería en vez de a los cuatro manuales que sí lo
     tienen. La cifra la tiene que traer la palabra de la que se pregunta. */
  'porcentaje','porcentajes','porciento','participacion']);
/* Y como se escriben en el piso: «donde BAN las sandalias», «q YEBA el
   precio», «para ke SIRBEN los roperos», «como ACOMDO los vinos». Con 186
   preguntas reales pasadas por erratas de celular, 52 salían sin ninguna
   tarjeta, y en la mayoría la única errata era el verbo: «ban» no era «van»,
   contaba como palabra exigida y el corrector lo llevaba a «baño». Se compara
   cómo suena, y con una letra de diferencia solo si la palabra no existe en los
   manuales: «orden» está en ellos y no es una errata de «ordena». */
export const VERBOS_FONETICOS=new Set([...VERBOS_DE_PISO].map(fonetica));
/** @type {Map<string, boolean>} */
let verbosVistos=new Map();
/** @param {string} w @returns {boolean} */
export function esVerbo(w){
  if(verbosVistos.has(w))return/** @type {boolean} */ (verbosVistos.get(w));
  let si=VERBOS_DE_PISO.has(w)||VERBOS_FONETICOS.has(fonetica(w));
  if(!si&&w.length>=5&&!estado.bm25.df[w]){
    const f=fonetica(w);
    for(const v of VERBOS_FONETICOS)if(v.length>=5&&v[0]===f[0]&&distanciaEdicion(f,v)<=1){si=true;break}
    /* Y lo que el corrector ya sabe llevar a una de estas palabras: «porcntaje»
       suena a «porkntaje» y «porcentaje» a «porsentaje» —dos letras—, pero los
       trigramas sí lo llevan a «porcentaje». */
    if(!si){const c=masParecida(w);si=!!c&&VERBOS_DE_PISO.has(c)}
  }
  verbosVistos.set(w,si);
  return si
}
/** @param {string} g */
export const esVerboDePiso=g=>esVerbo(g.replace(/^[~!]/,''));
/** @param {string} query @param {OpcionesDeBusqueda} [opts] @returns {Resultado[]} */
export function retrieve(query,opts){
  const{source=null,limit=40,doc=null}=opts||{};
  let terms=weightedTerms(query,doc);
  /* Dentro de UNA sección, su propio nombre no distingue nada: todo el manual
     de CASUAL HOMBRE es de hombre. «entayado de hombres» contestaba con la
     portada —titulada «140 CASUAL HOMBRE»— antes que con ENTALLADO. Entre
     secciones sí distingue, y ahí (sin `doc`) se queda. */
  if(doc){
    const propio=new Set(tokenize(nombreDeSeccion(doc)));
    /** @param {string} g */
    const esDelNombre=g=>variantes(g.replace(/^[~!]/,'')).some(v=>propio.has(v));
    const resto=terms.filter(x=>!esDelNombre(x.g));
    /* Si tras quitar el nombre solo quedan verbos, la pregunta ES el nombre:
       «¿cómo acomodo los vinos?» en VINOS Y LICORES. */
    if(resto.some(x=>!esVerboDePiso(x.g)))terms=resto;
  }
  if(!terms.length)return[];
  /* Lo que se exige se mide sobre lo que de verdad se busca. Contarlo sobre la
     pregunta entera pedía dos aciertos a «¿el saco va junto al pantalón?» en
     SACOS Y PANTALONES, donde a la búsqueda solo le queda «junto». */
  const exigidos=exigenciaDeSolidez([...new Set(terms.map(x=>x.g.replace(/^[~!]/,'')))].filter(g=>!esVerbo(g)).length);
  const strongContables=new Set(terms.filter(x=>x.w===1&&!esVerboDePiso(x.g)).map(x=>x.t));
  const flojosContables=new Set(terms.filter(x=>x.w!==1&&!esVerboDePiso(x.g)).map(x=>x.t));
  const strong=terms.filter(t=>t.w===1);
  const flojos=terms.filter(t=>t.w!==1);
  const palabrasEscritas=new Set(strong.filter(x=>!esVerboDePiso(x.g)).map(x=>x.g)).size||1;
  const shingles=queryShingles(query);
  /* Los manuales dan la participación siempre igual: «30% de participación».
     Si se pregunta por el porcentaje, esa frase es la respuesta, y no el
     planograma de la página siguiente con «50%+ 20%», que ganaba por corto. */
  /* «que porsentaje tiene premium»: la errata también pide la cifra. */
  const pidePorcentaje=/porcentaje|porciento|participacion/.test(normalizeText(query))||query.includes('%')
    ||palabrasDeConsulta(query).some(w=>palabraDeCifra(w));
  const wantsNumber=NUMERIC_INTENT.test(query)||pidePorcentaje;
  const pidePrecio=pideUnPrecio(query);
  const pideInstruccion=PIDE_INSTRUCCION.test(normalizeText(query));
  const titulos=titulosDeLaPregunta(query);
  /** @type {Resultado[]} */
  const out=[];
  for(const c of estado.corpus){
    if(source&&c.source!==source)continue;
    /* Sección activa: el asesor trabaja UN manual, y filtrar aquí deja fuera de
       una sola vez el contexto, las láminas y la verificación. */
    if(doc&&c.docName!==doc)continue;
    let score=bm25Score(/** @type {FragmentoIndexado} */ (c),terms);
    if(score<=0)continue;
    /* El acierto se cuenta por palabra entera, no por trozo. Con `includes` a
       secas, «cambia» —variante de género de «cambio»— acertaba dentro de
       «cambiar», y "¿cómo cambio la llanta del coche?" pasaba por pregunta
       contestable: un acierto bastaba para que el modelo recibiera fragmentos
       bajo la orden de responder con ellos. Las formas legítimas ya las genera
       `variantes` de este lado; lo que se pierde aquí no es morfología, es
       coincidencia parcial. Los espacios se normalizan porque `normalizeText`
       conserva los saltos de línea y una palabra a principio de renglón no
       quedaría rodeada de espacios. */
    const norm=' '+normalizeText((c.heading?c.heading+' ':'')+c.text).replace(/\s+/g,' ')+' ';
    /** @param {string} t */
    const contiene=t=>norm.includes(' '+t+' ');
    const gAcierto=new Set();
    const conMedida=CON_MEDIDA.test(norm);
    for(const{t,g}of strong)if(strongContables.has(t)&&(contiene(t)||(conMedida&&PALABRAS_DE_MEDIDA.has(g))))gAcierto.add(g);
    const hits=gAcierto.size;
    /* Los aciertos por sinónimo se cuentan aparte: valen menos que la palabra
       que el asesor escribió, pero un fragmento que solo se encontró por el
       diccionario es exactamente el caso para el que existe el diccionario.
       Aquí sí cuenta cada término y no cada palabra de origen: que una lámina
       diga «alineación», «circulación» y «80 cm» a la vez es evidencia, aunque
       las tres salgan de haber escrito «pasillo». */
    let hitsSyn=0,hitsErrata=0;
    for(const{t,g}of flojos)if(flojosContables.has(t)&&contiene(t)){if(g[0]==='!')hitsErrata++;else hitsSyn++}
    let phrase=0;
    for(const sh of shingles)if(norm.includes(sh))phrase++;
    score+=Math.min(phrase,3)*1.5;
    if(c.heading){
      const h=normalizeText(c.heading);
      for(const{t}of strong)if(h.includes(t)){score+=2;break}
    }
    if(wantsNumber&&c.hasDigits)score+=1.5;
    if(pidePorcentaje&&/\d\s*%\s*de\s+participaci[oó]n/i.test(c.text))score+=3;
    if(pidePrecio&&/\$\s?\d/.test(c.text))score+=3;
    /* El check list repite en un renglón cada regla del manual, y en una página
       corta: BM25 lo subía por encima de la lámina que la explica. «¿para dónde
       va el gancho?» contestaba con «Ganchos hacia la izquierda y 3 cm…» en vez
       de ENGANCHADO, con su dibujo. Baja salvo que se pregunte por él. */
    if(c.heading&&CHECKLIST.test(normalizeText(c.heading))&&!PIDE_CHECKLIST.test(normalizeText(query)))score*=0.6;
    if(pideInstruccion&&esRotulo(c))score*=0.6;
    if(c.heading){
      const h=normalizeText(c.heading).split(/\s+/).filter(Boolean);
      const pol=titulos.polaridad(h);
      /* La pareja exacta pesa más que el título nombrado: además de nombrar,
         descarta el caso contrario. A ×1.5, SIN CAJA seguía detrás de dos
         láminas que llegan por «caja» → «punto de venta», que es otra caja. */
      if(pol<0)score*=0.5;
      else if(pol>0)score*=2;
      else if(titulos.nombrado(h))score*=1.5;
    }
    /* Estos dos bonos suben un fragmento por lo que ES, no por lo que se
       preguntó. Sin evidencia léxica de por medio convertían cualquier regla
       obligatoria en la respuesta a todo, que es como una pregunta de cocina
       acababa devolviendo la sección de entallado. */
    if(hits+hitsSyn+hitsErrata>0){
      if(/\[mandatory\]/i.test(c.text))score+=2;
      if(/conflicto documentado/i.test(c.text))score+=2.5;
    }
    /* Cuántas de las palabras que escribió el asesor trae el fragmento. BM25
       suma cada término por separado, y tres sinónimos pesaban más que la
       palabra escrita: en CALCETINES, «¿dónde va la liquidación?» salía con
       TEMPORADA BARATA —«barata» y «descuento», del diccionario— y no con la
       lámina que dice «liquidación» tal cual. Un fragmento que las trae todas
       vale el doble que uno que no trae ninguna. La errata corregida cuenta
       como escrita, porque es la palabra del asesor bien escrita. */
    score*=1+Math.min(palabrasEscritas,hits+hitsErrata)/palabrasEscritas;
    out.push({c,score,hits,hitsSyn,hitsErrata,exigidos});
  }
  /* La página que el piso señaló para esta forma de preguntar sube un escalón.
     Solo reordena lo que ya llegó por sus palabras: un atajo no mete una
     página que la búsqueda no encontró, ni pasa por encima de la solidez. */
  const atajos=out.length?atajosDelPiso(query,doc):[];
  if(atajos.length){
    const mejor=Math.max(...out.map(r=>r.score));
    const paginas=new Set(atajos.map(a=>a.sec+'|'+a.pagina));
    for(const r of out)if(r.c.page&&paginas.has(secDe(r.c.docName)+'|'+r.c.page)){r.score+=mejor*APRENDE_BONO_ATAJO;r.atajo=true}
  }
  out.sort((a,b)=>b.score-a.score||b.hits-a.hits);
  return(out.some(r=>r.c.isFicha==='indice')?paginasEnVezDeFicha(out,terms):out).slice(0,limit)
}
/* La ficha que escribió la IA dice que ESA página habla de lo preguntado, pero
   no es el manual: en su lugar entran los fragmentos reales de la página, con
   la puntuación y los aciertos que ganó la ficha. Así «¿qué marcas son
   contemporáneas?» llega a la lámina que titula «Contempo», y lo que se lee —en
   pantalla o en el contexto del modelo— sigue siendo texto del manual. */
/** @type {Map<string, Fragmento[]> | null} */
let fragmentosPorPagina=null;
/** @param {string} docName @param {number | undefined} page @returns {Fragmento[]} */
export function fragmentosDePagina(docName,page){
  if(!fragmentosPorPagina){
    fragmentosPorPagina=new Map();
    for(const c of estado.corpus){
      if(c.isFicha==='indice'||!c.page)continue;
      const k=c.docName+'|'+c.page;
      if(!fragmentosPorPagina.has(k))fragmentosPorPagina.set(k,[]);
      /** @type {Fragmento[]} */ (fragmentosPorPagina.get(k)).push(c);
    }
  }
  return fragmentosPorPagina.get(docName+'|'+page)||[]
}
/* Entra UN fragmento de la página, el que más se parece a la pregunta. Con los
   tres primeros, medido con dos manuales reales, 23 de 51 respuestas del modo
   manual salían con las tres tarjetas de la misma página, y la que sí traía la
   respuesta quedaba fuera. Los demás fragmentos de la página siguen compitiendo
   con su propia puntuación. */
/** @param {Resultado[]} resultados @param {Termino[]} [terms] @returns {Resultado[]} */
export function paginasEnVezDeFicha(resultados,terms){
  /** @type {Set<Fragmento>} */
  const vistos=new Set();
  /** @type {Resultado[]} */
  const salida=[];
  /** @param {Resultado} r */
  const meter=r=>{if(!vistos.has(r.c)){vistos.add(r.c);salida.push(r)}};
  for(const r of resultados){
    if(r.c.isFicha!=='indice'){meter(r);continue}
    let mejor=null,mejorP=-1;
    for(const c of fragmentosDePagina(r.c.docName,r.c.page)){
      if(vistos.has(c))continue;
      const p=terms?bm25Score(/** @type {FragmentoIndexado} */ (c),terms):0;
      if(p>mejorP){mejorP=p;mejor=c}
    }
    if(mejor)meter({...r,c:mejor});
  }
  return salida
}

/* La etiqueta de origen viaja pegada al fragmento hasta el prompt, para que
   el modelo pueda citar la página y el asesor pueda ir a verla. */
/** @param {Fragmento} c @returns {string} */
export function chunkLabel(c){
  const parts=[c.docName];
  if(c.page)parts.push('pág. '+c.page);
  if(c.heading)parts.push(c.heading);
  if(c.isFigure)parts.push('figura descrita por IA');
  if(c.isFicha==='visual')parts.push('lo que se lee en la imagen, transcrito por IA');
  return'['+parts.join(' · ')+']'
}

/* Se enviaban ~20 fragmentos por pregunta —41 con dos manuales cargados—, y eso
   es lo que quema la cuota. Estos cuatro filtros se midieron sobre 24 preguntas
   de respuesta conocida en los 7 manuales reales, incluidas seis en las que el
   asesor NO usa las palabras de la lámina (que son las únicas que ponen a prueba
   un corte por puntuación). Bajan el contexto de 7199 a 2860 caracteres —60%
   menos— sin perder una sola respuesta.

   El corte es RELATIVO al mejor fragmento de esa consulta, no absoluto: ya se
   probó y se descartó el umbral fijo, porque las puntuaciones no son comparables
   entre manuales —«¿a qué hora abre la tienda?» llega a 7.5 y una pregunta buena
   se queda en 2.3—. Relativo, cada pregunta trae su propia escala.

   α=0.25 y no más: el caso más ajustado de los medidos —«¿dónde coloco la alarma
   en el pantalón?», que llega por sinónimo— se queda al 52% del mejor. Con 0.25
   hay el doble de holgura; con 0.35 el ahorro sube al 72% pero el margen cae a
   la mitad, y no vale la pena para una pregunta que no esté en la muestra. */
export const CTX_ALPHA=0.25;             // corte relativo al mejor fragmento
export const CTX_JACCARD=0.8;            // dos fragmentos casi iguales: sobra uno
export const CTX_MAX_POR_PAGINA=3;       // una lámina verbosa no se come el presupuesto

/** @param {Set<string>} a @param {Set<string>} b */
export function jaccardTokens(a,b){
  let comunes=0;
  for(const t of a)if(b.has(t))comunes++;
  return comunes/(a.size+b.size-comunes||1)
}

/* ── DOS TEMAS EN UNA FRASE ────────────────────────
   «¿Cómo doblo la mercancía y cada cuándo se resurte?» son dos preguntas, y el
   corte de packChunks es relativo al MEJOR fragmento de la consulta entera: si
   un tema puntúa alto, el otro se queda por debajo del 25% y desaparece del
   contexto. Medido: esa pregunta traía DOBLADO y perdía SURTIDO, y el asesor
   recibía media respuesta — que es de lo que se quejó en el piso.

   No se toca el corte, que está medido y protege del ruido: se le da a cada
   tema su propia escala. Cada parte se busca por separado, sus puntuaciones se
   normalizan contra su propio mejor fragmento, y la mezcla se ordena ya en esa
   escala común. La consulta entera también aporta, porque hay fragmentos que
   solo casan con la frase completa. */
/** @param {string} q @returns {string[]} */
export function partesDeConsulta(q){
  const trozos=(q||'').split(/\s+y\s+/i).map(s=>s.trim());
  if(trozos.length<2)return[];
  const utiles=trozos.filter(s=>palabrasDeConsulta(s).length>=1);
  return utiles.length>=2?utiles:[]
}
/** @param {string} query @param {Resultado[]} results @param {OpcionesDeBusqueda} [opts] @returns {Resultado[]} */
export function mezclarPorPartes(query,results,opts){
  const partes=partesDeConsulta(query);
  if(partes.length<2||!results.length)return results;
  /** @type {Map<Fragmento, Resultado>} */
  const mejor=new Map();
  /** @param {Resultado[]} lista */
  const meter=lista=>{
    const top=lista.length?(lista[0].score||1):1;
    for(const r of lista){
      const rel=r.score/top;
      const prev=mejor.get(r.c);
      if(!prev||rel>prev.score)mejor.set(r.c,Object.assign({},r,{score:rel}));
    }
  };
  meter(results);
  for(const p of partes)meter(retrieve(p,opts));
  return[...mejor.values()].sort((a,b)=>b.score-a.score||b.hits-a.hits)
}

/** @param {Array<{ c: Fragmento, score: number }>} results @param {number} maxChars @param {number} [maxFrag] @returns {string} */
export function packChunks(results,maxChars,maxFrag){
  let out='',chars=0,n=0;
  const corte=results.length?results[0].score*CTX_ALPHA:0;
  /** @type {Array<{ doc: string, set: Set<string> }>} */
  const firmas=[];
  /** @type {Map<string, number>} */
  const porPagina=new Map();
  for(const r of results){
    if(chars>=maxChars)break;
    if(maxFrag&&n>=maxFrag)break;
    if(r.score<corte)continue;
    if(r.c.page){
      const k=r.c.docName+'|'+r.c.page;
      if((porPagina.get(k)||0)>=CTX_MAX_POR_PAGINA)continue;
      porPagina.set(k,(porPagina.get(k)||0)+1);
    }
    /* Los 7 manuales comparten plantilla, así que el mismo párrafo aparece
       cinco veces con otro número dentro. Repetirlo no informa, solo ocupa.
       Dos precauciones que costaron una respuesta en la prueba con dos manuales
       cargados: la firma incluye el TÍTULO, porque el dato distintivo suele
       vivir ahí —«PRÁCTICO» en un manual y «PRÁCTICO (20.8%):» en el otro, con
       el mismo párrafo debajo—; y nunca se comparan fragmentos de documentos
       distintos, porque que dos manuales digan lo mismo no vuelve prescindible
       al del asesor. Sin esto, el 20.8% de Blancos desaparecía del contexto por
       parecerse a una lámina de Caballero. */
    const firma=new Set(tokenize((r.c.heading||'')+' '+r.c.text));
    if(firmas.some(g=>g.doc===r.c.docName&&jaccardTokens(firma,g.set)>=CTX_JACCARD))continue;
    const header=chunkLabel(r.c)+'\n';
    const space=maxChars-chars-header.length;
    if(space<80)break;
    /* Antes el último fragmento entraba cortado a la mitad con «[...]». Media
       regla es peor que ninguna: el modelo la cita completa igual, y la
       verificación numérica no encuentra la cifra que quedó fuera.
       Pero cortar AQUÍ el empaquetado entero —que es lo que hacía un `break`—
       tiraba también todos los fragmentos siguientes, más cortos y que sí
       cabían: una lámina larga en tercer lugar dejaba fuera la que traía la
       respuesta. El que no cabe se salta; los demás siguen entrando. */
    if(r.c.text.length>space)continue;
    out+=header+textoComoDato(r.c.text)+'\n\n';
    chars+=header.length+r.c.text.length;
    n++;
    firmas.push({doc:r.c.docName,set:firma});
    estado.ultimosFragmentos.push(r.c);
  }
  /* Lo que va al modelo, entre las marcas con el sello de la sesión. */
  return envolverComoDato(out.trim())
}

export const MUESTRA_SIN_COINCIDENCIAS=1200;

/** @param {string} query @param {number} maxChars @param {number} [maxFrag] @returns {Contexto} */
export function getManualContext(query,maxChars,maxFrag){
  const opts={source:'manual'};
  const results=retrieve(query,opts);
  const nivel=nivelDeEvidencia(results,query);
  if(!nivel)return{texto:estado.manualSections.slice(0,2).map(s=>s.text).join('\n\n').slice(0,MUESTRA_SIN_COINCIDENCIAS),nivel:0};
  return{texto:packChunks(mezclarPorPartes(query,results,opts),maxChars,maxFrag),nivel}
}

/* 40 candidatos era generoso de más: después de los filtros de packChunks nunca
   sobreviven más de 9, así que puntuar el doble solo alarga la lista. */
export const PDF_CANDIDATOS=20;
/** @param {string} query @param {number} maxChars @param {string | null} [doc] sin él, la sección activa @returns {Contexto} */
export function getPdfContext(query,maxChars,doc){
  if(!estado.docChunks.length)return{texto:'',nivel:0};
  const opts={source:'pdf',limit:PDF_CANDIDATOS,doc:doc===undefined?estado.manualActivo:doc};
  const results=retrieve(query,opts);
  const nivel=nivelDeEvidencia(results,query);
  if(nivel)return{texto:packChunks(mezclarPorPartes(query,results,opts),maxChars),nivel};
  /* Sin una sola coincidencia sólida: en vez de callar, se entrega una muestra
     corta de cada manual para que el modelo vea de qué trata y pueda decir que
     no encontró la regla, no que el manual no existe. Corta a propósito: cuanto
     más material se le pone delante bajo la orden de "responde solo con esto",
     más fácil es que componga una respuesta plausible con lo que haya. */
  /* Y solo del manual del asesor si eligió sección. Con once cargados la
     muestra traía la portada de los once: se ve en pantalla, debajo de un aviso
     que dice "esto no es la respuesta", una ristra de secciones que no son la
     suya. La muestra existe para que el modelo sepa de qué va SU manual. */
  const fuente=opts.doc?estado.docChunks.filter(c=>c.docName===opts.doc):estado.docChunks;
  /** @type {Map<string, Fragmento[]>} */
  const byDoc=new Map();
  for(const c of fuente)if(!byDoc.has(c.docName))byDoc.set(c.docName,[]);
  for(const c of fuente){const arr=/** @type {Fragmento[]} */ (byDoc.get(c.docName));if(arr.length<Math.max(1,Math.floor(4/byDoc.size)))arr.push(c)}
  /** @type {Array<{ c: Fragmento, score: number, hits: number }>} */
  const sampled=[];
  for(const arr of byDoc.values())for(const c of arr)sampled.push({c,score:0,hits:0});
  return{texto:packChunks(sampled,MUESTRA_SIN_COINCIDENCIAS),nivel:0}
}

/* «porcentaje» va en VERBOS_DE_PISO para que no cuente como acierto, pero aquí
   sí dice algo: en MESA FINA o FLORES Y VELAS, que no traen ni un «% de
   participación», «¿qué porcentaje tiene formal?» tiene que avisar. Se reconoce
   también mal escrita («porsentaje») por cómo suena. */
export const PALABRAS_DE_CIFRA=['porcentaje','porcentajes','porciento','participacion'];
/** @param {string} w */
export const palabraDeCifra=w=>PALABRAS_DE_CIFRA.find(p=>p===w||fonetica(p)===fonetica(w))||null;

/* Lo que depende del corpus se olvida cuando el corpus cambia. */
alReiniciar(() => {
  verbosVistos = new Map();
  fragmentosPorPagina = null;
});
