// La puerta de evidencia: lo que la pregunta pide y el manual no trae.
//
// Palabras ausentes, la cifra que falta en un «¿cuántos?» y lo que no es de
// ningún manual de exhibición. La solidez (cuándo una coincidencia cuenta)
// está debajo, en solidez.js, porque la búsqueda la necesita.
//
// Salió de app.js en el paso 5 del ADR 0005, sin cambiar nada de lo que hace
// (golden master idéntico). Sin DOM: se importa igual desde Node.
import { estado } from '../estado.js';
import { STOPWORDS, normalizeText, expandKeywords, tokenize, palabrasDeConsulta, variantes, infinitivos } from './texto.js';
import { raizCorta, masParecida, vocabDeDoc, raicesDeDoc, textoDeDoc } from './erratas.js';
import { nombreDeSeccion } from './secciones.js';
import { palabrasDelPiso } from './aprendido.js';
import { esVerbo, palabraDeCifra, weightedTerms } from './busqueda.js';

/* ── LA PALABRA QUE ESTE MANUAL NO TIENE ──────────
   Medido con la batería: al enseñar al buscador la morfología del español
   —«doblo» → DOBLADO— el recall subió de 94% a 100%, pero tres preguntas cuya
   respuesta NO está en la sección activa pasaron de "coincidencia débil" a
   "evidencia sólida". Y sólida significa que el contexto va sin ningún aviso y
   el modelo lee «responde con esto».

   Los tres casos son el mismo: «¿cómo acomodo las sábanas?» estando en ZAPATOS
   engancha con «acomodar», que sí es del manual, mientras que «sábanas» no
   aparece ahí ni una vez. El buscador acierta —el asesor preguntó cómo acomodar
   algo— y aun así la respuesta sería de otra sección.

   Así que se mira la palabra que falta, no la que sobra: si una palabra de la
   pregunta no tiene NINGÚN camino hasta el manual activo —ni su forma, ni sus
   variantes, ni sus sinónimos— pero es tema de otro manual cargado, se dice.
   Las dos condiciones importan: sin la primera se avisaría de «llena» cuando el
   manual titula SATURACIÓN y el diccionario ya lleva de una a otra; sin la
   segunda se avisaría de cualquier palabra rara que no está en ningún manual,
   que es ruido y no una sección vecina. */
export const AUSENTE_MIN_FRAGS=3;
export const AUSENTE_MIN_LETRAS_SOLA=6;
/* Avisar de que una palabra no está en NINGÚN manual solo tiene sentido si esa
   palabra es un TEMA. Medido sobre las 88 preguntas buenas, la primera versión
   saltaba en 17 de ellas y ni una era un tema: «cuánto» ×11, «llevan»,
   «manejamos», «colgarla», «cuánta». Son la forma de preguntar, no lo que se
   pregunta — y estos manuales no escriben «cuánto», escriben «30% de
   participación».

   Así que se descartan por lo que son: las interrogativas, y las palabras con
   forma de verbo conjugado por el asesor. Descartar de más solo hace el aviso
   más callado, que es el lado seguro: la palabra que sí es tema y sí es de otro
   manual la sigue cogiendo la clase 1, que no pasa por aquí. */
export const INTERROGATIVAS=new Set(['cuanto','cuanta','cuantos','cuantas','cuando','cual','cuales',
  'como','donde','adonde','quien','quienes','porque','acaso','tambien','tampoco','entonces','ademas']);
export const FORMA_DE_VERBO=/(?:amos|emos|imos|aron|eron|ando|iendo|arla|arlo|arle|arse|arlos|arlas|aria|eria|an|en|as|es|mos)$/;
/* «vacaciones», «exhibiciones», «novedades»: terminan como verbo («-es») y son
   sustantivos. Sin esto, «¿cuántos días de vacaciones tengo?» contestaba con
   MANIQUÍES —por los «21 días»— sin avisar de que el manual no habla de eso. */
export const SUSTANTIVO=/(?:ciones|siones|dades|tudes|ajes|ores|umbres)$/;
/** @param {string} w */
export function esPalabraDeTema(w){
  return !INTERROGATIVAS.has(w)&&(SUSTANTIVO.test(w)||!FORMA_DE_VERBO.test(w))
}
/* Los pares de palabras que el asesor escribió PEGADAS, sin nada en medio. Es
   la unidad que hacía falta: «marca propia» es una cosa y «marca» y «propia»
   por separado son otra. Se exige que las dos sean palabras de contenido, así
   que «¿a qué altura va el sensor?» no produce el par «altura sensor» —que no
   escribió nadie— porque entre las dos hay «va el». */
/** @param {string} query @returns {string[]} */
export function paresDeConsulta(query){
  const secuencia=normalizeText(query||'').split(/\s+/).filter(Boolean);
  const out=[];
  for(let i=0;i+1<secuencia.length;i++){
    const a=secuencia[i],b=secuencia[i+1];
    if(a.length<4||b.length<4||STOPWORDS.has(a)||STOPWORDS.has(b))continue;
    if(/^\d/.test(a)||/^\d/.test(b))continue;
    out.push(a+' '+b);
  }
  return out
}
/* Lo que el asesor HACE y cómo lo dice, no DE QUÉ pregunta. Medido con 14
   manuales reales y 110 preguntas con respuesta: 9 de los 11 avisos falsos de
   «el manual no menciona» eran esto. «¿las plumas se pueden QUEDAR en su caja?»,
   «no me ALCANZA el inventario», «¿puedo GUARDAR cajas en la vitrina?», «¿en
   qué SENTIDO va el entallado?», «las piernas… en OTRA SECCIÓN»: la tarjeta
   correcta salía, pero con la advertencia encima, y con API key el aviso le
   ganaba a la regla —«las cervezas cómo se ACOMODAN» contestaba «eso está en
   Mesa Fina»—. El manual no escribe esas palabras porque no son el tema.
   VERBOS_DE_PISO no se toca: allí un verbo deja de contar como acierto en la
   búsqueda, y «se AGRUPAN en los tapetes» sí ayuda a encontrar ÁRBOLES. */
export const PALABRAS_DE_RELACION=new Set(['sentido','lado','lados','orden','forma','formas','manera','modo','parte','partes','lugar','tipo','cosa','cosas',
  'otra','otro','otras','otros','seccion','secciones','caso','veces','algo','nada','junto','juntos','juntas']);
/* Sin «sacar», «bajar», «juntar» ni «pasar»: por la conjugación se llevaban
   «saco» (la prenda), «bajo» (BAJO PLATO), «partes bajas», «junta» y «pasas»
   (las del POS), que en estos manuales sí son el tema. */
export const VERBOS_DE_ACCION=new Set(['quedar','guardar','alcanzar','agrupar','acomodar','poner','meter','mover','cambiar','pegar',
  'subir','llegar','tocar','faltar','sobrar','caber','poder','querer','traer','encontrar']);
/** @param {string} w @returns {boolean} */
export function esPalabraDeAccion(w){
  if(palabraDeCifra(w))return false;
  if(PALABRAS_DE_RELACION.has(w)||VERBOS_DE_ACCION.has(w)||esVerbo(w))return true;
  /* «alcanza», «acomodan», «agrupo», «puedo»: la conjugación vuelve al
     infinitivo, con el diptongo deshecho (pued- → pod-). */
  const m=w.match(/^(.{3,})(?:amos|emos|imos|ando|iendo|an|en|as|es|o|a|e)$/);
  if(!m)return false;
  const r=m[1],dip=r.replace(/ue([^aeiou]*)$/,'o$1').replace(/ie([^aeiou]*)$/,'e$1');
  for(const x of new Set([r,dip]))for(const t of['ar','er','ir'])if(VERBOS_DE_ACCION.has(x+t))return true;
  return false
}
/* Un par de la pregunta, en las formas en que lo puede escribir el manual:
   «mesa show» está en Mesa Fina como «mesas show», y «primera etapa» como
   «1° ETAPA». Sin esto, las dos salían como frases de OTRO manual. */
/** @type {Record<string, string>} */
export const ORDINAL_A_CIFRA={primera:'1',primer:'1',primero:'1',segunda:'2',segundo:'2',tercera:'3',tercer:'3',tercero:'3'};
/** @param {string} par @returns {string[]} */
export function formasDePar(par){
  const[a,b]=par.split(' ');
  /** @param {string} w */
  const de=w=>[...new Set(variantes(w).concat(ORDINAL_A_CIFRA[w]||[]))];
  const out=[];
  for(const x of de(a))for(const y of de(b))out.push(' '+x+' '+y+' ');
  return out
}
/* El presente de un verbo en infinitivo, con el diptongo que toque: «colgar»
   está en el manual como «nunca se cuelgan», «mover» como «mueve». Son formas
   de la misma palabra, no sinónimos. */
/** @param {string} w @returns {string[]} */
export function conjugaciones(w){
  const m=w.match(/^(.{2,})(ar|er|ir)$/);
  if(!m)return[];
  const raices=new Set([m[1],m[1].replace(/o([^aeiou]+)$/,'ue$1'),m[1].replace(/e([^aeiou]+)$/,'ie$1')]);
  const finales=m[2]==='ar'?['a','an','as','o','e','en']:['e','en','es','o','a','an'];
  return[...raices].flatMap(r=>finales.map(f=>r+f))
}
/** Las palabras de una pregunta «X o Y», cada una con su alternativa.
 * @param {string} query @returns {Map<string, string[]>} */
export function alternativasDeConsulta(query){
  const t=normalizeText(query).split(/\s+/).filter(Boolean);
  /** @type {Map<string, string[]>} */
  const m=new Map();
  for(let i=1;i<t.length-1;i++){
    if(t[i]!=='o'&&t[i]!=='u')continue;
    const a=t[i-1],b=t[i+1];
    if(STOPWORDS.has(a)||STOPWORDS.has(b))continue;
    m.set(a,[...(m.get(a)||[]),b]);m.set(b,[...(m.get(b)||[]),a]);
  }
  return m
}
/** @param {string} query @param {string | null} activo @returns {Ausente[]} */
export function terminosAusentes(query,activo){
  if(!activo||!estado.docChunks.length)return[];
  const propio=vocabDeDoc(activo),propioRaiz=raicesDeDoc(activo);
  /** @type {Ausente[]} */
  const fuera=[];
  /** @type {Set<string>} */
  const enFrase=new Set();

  /* 1 · La FRASE que este manual no usa. Es la unidad que hacía falta para el
     caso del piso: «preferencial» sola no se puede juzgar —el corrector de
     erratas la empareja con «preferencia», que sí está en MUEBLES dentro de
     «de preferencia, coloca…», que no tiene nada que ver—. El par «marca
     preferencial» no está en ningún manual, y eso sí es una respuesta. */
  for(const par of paresDeConsulta(query)){
    if(par.split(' ').some(esPalabraDeAccion))continue;
    /* Las otras formas solo sirven para EXIMIR al manual del asesor. Para
       señalar a otro manual se exige el par tal cual: con plurales, «colección
       nueva» daba a MUEBLES por dueño —que dice «colecciones nuevas de cada
       mes»— y el aviso saltaba en Diseñadores, que lo dice al revés. */
    if(formasDePar(par).some(f=>textoDeDoc(activo).includes(f)))continue;
    const duenos=[];
    for(const d of estado.docs){
      if(d.name===activo)continue;
      if(textoDeDoc(d.name).includes(' '+par+' '))duenos.push({docName:d.name,n:1});
    }
    if(duenos.length){
      fuera.push({palabra:par,duenos,frase:true});
      for(const w of par.split(' '))enFrase.add(w);
    }
    /* Se probó también avisar del par que no está en NINGÚN manual, para coger
       «marca preferencial». Medido: saltaba en 15 de las 88 preguntas buenas
       —«espacio dejo», «puedo cruzar», «participa outdoor», «altura pongo»—
       porque un par de palabras adyacentes de una pregunta casi nunca está
       literal en un manual. Quince falsos por un acierto no es un cambio, es
       ruido con otra forma. Esa pregunta la cogen la regla 8b del prompt y la
       verificación de nombres, que no dependen de acertar la búsqueda. */
  }

  /* 2 · La PALABRA sin ningún camino hasta este manual. */
  /** @param {string} k @returns {{ dentro: boolean, formas: Set<string> }} */
  const buscarEnManual=k=>{
    const formas=new Set();
    const propias=new Set();
    /* «porsentaje» no está en ningún índice, así que el corrector no la lleva a
       «porcentaje»; por el sonido sí, y con ella llega «participación». */
    const cifra=palabraDeCifra(k);
    for(const v of variantes(k).concat(infinitivos(k),cifra&&cifra!==k?[cifra]:[])){
      formas.add(v);propias.add(v);
      for(const frase of expandKeywords([v]))for(const x of tokenize(frase))formas.add(x);
    }
    /* Si lo que escribió es una errata de una palabra que el manual sí tiene, no
       falta nada: falta una letra. El corrector ya la encontró antes que yo. */
    const cerca=masParecida(k);
    if(cerca)formas.add(cerca);
    /* Una palabra que el piso ya enseñó no falta: se dice de otro modo. */
    for(const p of palabrasDelPiso(k,activo))formas.add(p.manual);
    /* La raíz sirve para las formas de la propia palabra —«acomodo» contra
       «acomoda»—, no para sus sinónimos. Con los sinónimos por raíz, «ganchos»
       nunca faltaba en ACCESORIOS: el diccionario la lleva a «barra», y «barr»
       es raíz de algo del manual. Lo mismo «vitrina», «cinturones» o «lentes»
       en secciones que no los tienen. Los sinónimos siguen contando tal cual. */
    for(const v of[...propias])for(const c of conjugaciones(v)){propias.add(c);formas.add(c)}
    const raices=new Set([...propias].map(raizCorta).filter(r=>r.length>2));
    let dentro=false;
    for(const f of formas)if(propio.has(f)){dentro=true;break}
    if(!dentro)for(const r of raices)if(propioRaiz.has(r)){dentro=true;break}
    return{dentro,formas};
  };
  /* «¿La liquidación va adelante o atrás?»: si el manual tiene una de las dos,
     esa es la respuesta y la otra no falta. Con el aviso, el modelo contestaba
     «atrás» y luego mandaba al asesor a otra sección a buscar «adelante». */
  const alternativas=alternativasDeConsulta(query);
  for(const k of palabrasDeConsulta(query)){
    if(k.length<5||/^\d/.test(k)||enFrase.has(k)||ORDINAL_A_CIFRA[k]||esPalabraDeAccion(k))continue;
    const{dentro,formas}=buscarEnManual(k);
    if(dentro)continue;
    if((alternativas.get(k)||[]).some(w=>buscarEnManual(w).dentro))continue;
    const duenos=[];
    for(const d of estado.docs){
      if(d.name===activo)continue;
      const v=vocabDeDoc(d.name);
      let n=0;
      for(const f of formas)n+=v.get(f)||0;
      if(n>=AUSENTE_MIN_FRAGS)duenos.push({docName:d.name,n});
    }
    if(duenos.length){duenos.sort((a,b)=>b.n-a.n);fuera.push({palabra:k,duenos})}
    /* Y si no es de nadie, tampoco es del manual del asesor. Medido en el piso:
       «marca preferencial» —una palabra que no aparece en ninguno de los once
       manuales— se contestó con «‹marca X› es la marca preferencial». El resto de la
       pregunta («marca») encontraba láminas de sobra, así que el contexto salía
       sin un solo aviso. Se pide una palabra larga para no señalar cualquier
       cosa: las cortas son las de relleno. */
    else if(k.length>=AUSENTE_MIN_LETRAS_SOLA&&esPalabraDeTema(k))fuera.push({palabra:k,duenos:[],enNinguno:true});
  }
  return fuera
}

/* ── ¿CUÁNTOS? ────────────────────────────────────
   «¿Cuántos maniquíes van por sección?» enseñaba la lámina de MANIQUÍES como
   si contestara, y esa lámina no da ninguna cantidad de maniquíes: da cada
   cuántos días se renuevan. El número estaba, pero era de otra cosa. Cuando se
   pregunta cuántos de algo, la tarjeta tiene que traer un número pegado a eso
   —«3 tipos de perímetro», «un zapato por charola», «carga mínima 3
   artículos»— o un número suelto en la lámina que lleva su nombre —ALTURAS:
   «para las mesas coloca máximo 4»—. Si ninguna lo trae, se dice. */
export const NUMEROS_EN_LETRA=new Set(['un','una','uno','dos','tres','cuatro','cinco','seis','siete','ocho','nueve','diez','once','doce','quince','veinte']);
/* Lo que no se cuenta: unidades de medida y de tiempo. «¿a cuántos cm va el
   sensor?» y «¿cada cuántos días?» son otra pregunta. */
export const NO_SE_CUENTA=new Set(['cm','centimetros','metros','mts','mt','pulgadas','dias','semanas','meses','horas','minutos','veces','pesos']);
/** @param {string} q @returns {string | null} */
export function cosaQueSeCuenta(q){
  const t=normalizeText(q).split(/\s+/).filter(Boolean);
  for(let i=0;i<t.length-1;i++){
    if(!/^cuant[oa]s$/.test(t[i]))continue;
    if(i>0&&(t[i-1]==='cada'||t[i-1]==='a'))return null;
    const x=t[i+1];
    if(x.length<4||/^\d/.test(x)||NO_SE_CUENTA.has(x))return null;
    return x;
  }
  return null
}
/** @param {string | undefined} a @param {string | undefined} b */
export function mismaCosa(a,b){
  /** @param {string | undefined} w */
  const s=w=>(w||'').replace(/(es|s)$/,'');
  const A=s(a),B=s(b);
  return !!A&&(A===B||(A.length>=5&&B.length>=5&&A.slice(0,5)===B.slice(0,5)))
}
/** @param {string} texto @param {string | undefined} titulo @param {string} x */
export function traeCifraDe(texto,titulo,x){
  const tok=(texto||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .match(/\d+(?:[.,]\d+)?%?|[a-zñ]+|[.:;•]/g)||[];
  const enTitulo=normalizeText(titulo||'').split(/\s+/).some(w=>w&&mismaCosa(w,x));
  /** @param {string} w */
  const esNumero=w=>/^\d/.test(w)||NUMEROS_EN_LETRA.has(w);
  /* El renglón no cuenta como fin de frase: el PDF corta donde cortó la
     maqueta, y «bloques de 2 ó 3 / piezas» es una sola frase. */
  /** @param {string | undefined} w */
  const finDeFrase=w=>!w||/^[.:;•]$/.test(w);
  for(let i=0;i<tok.length;i++){
    const w=tok[i];
    if(!esNumero(w))continue;
    /* «2 o 3 piezas», «10 a 15»: el rango cuenta como un solo número. */
    let j=i+1;
    while(j+1<tok.length&&/^(a|o|y|al|hasta)$/.test(tok[j])&&esNumero(tok[j+1]))j+=2;
    const sig=tok[j];
    if(!/^\d/.test(w)){
      /* «un» casi siempre es artículo: «nunca un maniquí sin zapatos» no dice
         cuántos. Cuenta si reparte —«un zapato por charola»— o si lo acota
         —«solo un estilo de vida»—. */
      if(!mismaCosa(sig,x))continue;
      if(/^un[oa]?$/.test(w)&&tok[j+1]!=='por'&&!/^(solo|solamente|unicamente|maximo|minimo)$/.test(tok[i-1]||''))continue;
      return true
    }
    if(mismaCosa(sig,x))return true;
    if(i>0&&mismaCosa(tok[i-1],x))return true;
    if(finDeFrase(sig)){
      if(enTitulo)return true;
      for(let k=Math.max(0,i-4);k<i;k++)if(mismaCosa(tok[k],x))return true;
    }
  }
  return false
}
/** @param {string} texto @param {string | undefined} titulo @param {string} x */
export function hablaDe(texto,titulo,x){
  return normalizeText((titulo||'')+' '+(texto||'')).split(/\s+/).some(w=>w&&mismaCosa(w,x))
}
/* ── LO QUE PASA EN LA TIENDA, NO EN EL MUEBLE ─────
   «¿Qué hago si se va la luz?» enseñaba EQUILIBRIO, porque la lámina habla de
   la luz del focal; «¿cómo uso la caja registradora?» enseñaba MUEBLES EN
   POS, porque el diccionario lleva «caja» al punto de venta. Las palabras son
   del manual y la pregunta no: es de operación de tienda, y ningún manual de
   exhibición la contesta. Son frases, no palabras sueltas: «¿cómo va la luz en
   el focal?» y «¿qué va en la caja?» sí son del manual. */
export const OPERACION_DE_TIENDA=[
  /\bse (va|fue|vaya|iba) la luz\b/,/\b(sin|no hay) luz\b/,/\bapagon/,
  /\bcaja registradora\b/,/\bcorte de caja\b/,/\bcuadrar (la )?caja\b/,
  /* Lo de recursos humanos, dicho en primera persona. «Jefe» y «horario» sí
     salen en los manuales —PROCESOS DE IMPLEMENTACIÓN habla del jefe de
     departamento y del horario de surtido—, así que «mi jefe me cambió el
     horario, ¿se puede?» encontraba esa lámina con dos aciertos. Lo que la
     hace ajena es el «mi»: el manual no habla del jefe ni del horario de nadie. */
  /\bmi (jefe|jefa|gerente|supervisora?|horario|turno|sueldo|salario|nomina|quincena|comision|contrato|descanso|vacaciones)\b/,
  /\bcuanto (gana|ganan|ganamos|gano|pagan|cobra|cobran)\b/,/\bdias de vacaciones\b/,
];
/* La palabra como la escribió el asesor —«maniquíes», «góndola»— y no como
   queda normalizada para buscar. */
/** @param {string} q @param {string} x */
export function palabraOriginal(q,x){
  return(q.match(/[\p{L}\p{N}]+/gu)||[]).find(w=>normalizeText(w).trim()===x)||x
}
/* El aviso de «¿cuántos?» para unas tarjetas ({c,texto}) de la sección
   `activo`, o '' si alguna trae la cifra. */
/** @param {string} q @param {Tarjeta[]} tarjetas @param {string | null} activo @returns {string} */
export function avisoDeCuenta(q,tarjetas,activo){
  /* Lo mismo con el porcentaje: «¿qué porcentaje tiene ‹sección›?» —que es
     la sección entera— enseñaba MOBILIARIO, MERCADEO y CLASIFICACIÓN, sin un
     solo % entre las tres. Si ninguna tarjeta trae un porcentaje, se dice. */
  const pidePct=palabrasDeConsulta(q).some(w=>palabraDeCifra(w))||/%/.test(q);
  if(pidePct&&!tarjetas.some(t=>/\d\s*%/.test(t.texto)))
    return '⚠ Estas láminas no dan ningún porcentaje. Te enseño lo más cercano que encontré: revisa si te sirve.';
  const cuenta=cosaQueSeCuenta(q);
  if(!cuenta)return'';
  /* El título solo dice de qué es la lámina si no es el nombre de la sección:
     en SACOS Y PANTALONES todas las láminas «son de sacos», y con eso cualquier
     número de la página pasaba por cuántos sacos van por barra. */
  const delNombre=!!activo&&tokenize(nombreDeSeccion(activo)).some(w=>mismaCosa(w,cuenta));
  if(tarjetas.some(t=>traeCifraDe(t.texto,delNombre?'':t.c.heading,cuenta)))return'';
  /* Y si ninguna tarjeta habla siquiera de lo que se cuenta, tampoco lo
     contesta: «¿cuántos maniquíes van en la sección?» en DISEÑADORES enseñaba
     TEMPORADA BARATA y DISPLAY, que no nombran maniquíes, sin ningún aviso. */
  const hablan=tarjetas.some(t=>hablaDe(t.texto,t.c.heading,cuenta));
  return avisoSinCifra(q,cuenta,hablan)
}
/** @param {string} q @param {string} x @param {boolean} [habla] */
export function avisoSinCifra(q,x,habla=true){
  const pal=q.match(/[\p{L}\p{N}]+/gu)||[];
  const original=palabraOriginal(q,x);
  const cuantos=/^cu[aá]ntas$/i.test(pal.find(w=>/^cu[aá]nt[oa]s$/i.test(w))||'')?'cuántas':'cuántos';
  return habla
    ?`⚠ El manual habla de «${original}», pero no dice ${cuantos}. Te enseño lo que sí dice: revisa si te sirve.`
    :`⚠ No encontré en el manual ${cuantos} «${original}». Te enseño lo más cercano: revisa si te sirve.`
}
/** @param {string} q */
export function esOperacionDeTienda(q){
  const n=normalizeText(q||'').replace(/\s+/g,' ');
  return OPERACION_DE_TIENDA.some(p=>p.test(n))
}

/* ── LO QUE SE LE DICE AL ASESOR EN MODO MANUAL ───
   Sin modelo, las tarjetas se enseñan tal cual; estos avisos van encima. */

/* La pregunta trae palabras que esta sección no tiene: se enseñan las
   tarjetas igual —puede que sirvan— pero diciendo cuáles faltan y, si son de
   otra sección, de cuál. */
/** @param {Ausente[]} ausentes @returns {string} */
export function avisoDeAusentes(ausentes){
  /** @param {Ausente[]} a */
  const lista=a=>a.map(i=>'«'+i.palabra+'»').join(' ni ');
  const deNadie=ausentes.filter(i=>i.enNinguno),deOtra=ausentes.filter(i=>!i.enNinguno);
  const partes=[];
  if(deNadie.length)partes.push(`El manual no menciona ${lista(deNadie)}.`);
  if(deOtra.length)partes.push(`${lista(deOtra)} no ${deOtra.length===1?'está':'están'} en esta sección; sí en ${nombreDeSeccion(deOtra[0].duenos[0].docName)}.`);
  return '⚠ '+partes.join(' ')+' Te enseño lo más cercano que encontré: revisa que sí sea lo que buscas.'
}

/* La tarjeta llegó solo por el diccionario: qué palabra del asesor no está en
   su manual, y con cuál se encontró. «Tu manual no dice X; lo encontré como Y».
   Se llama solo cuando la primera tarjeta no trae ni una palabra escrita ni
   una errata corregida. */
/**
 * @param {string} q la pregunta escrita
 * @param {string} consulta la consulta con que se buscó (puede venir ampliada)
 * @param {string | null} activo
 * @param {Resultado} primera la primera tarjeta
 * @returns {Array<{ dijo: string, k: string, como: string }>}
 */
export function palabrasPorParecidas(q,consulta,activo,primera){
  const voc=activo?vocabDeDoc(activo):null;
  const pesos=weightedTerms(consulta,activo);
  const enTarjeta=' '+normalizeText((primera.c.heading||'')+' '+primera.c.text).replace(/\s+/g,' ')+' ';
  const out=[];
  for(const k of new Set(pesos.filter(x=>x.g&&x.g[0]==='~').map(x=>x.g.slice(1)))){
    if(k.length<4||esVerbo(k)||(voc&&variantes(k).some(v=>voc.has(v))))continue;
    const como=pesos.find(x=>x.g==='~'+k&&enTarjeta.includes(' '+x.t+' '));
    if(como)out.push({dijo:palabraOriginal(q,k),k,como:como.t});
  }
  return out
}

/* ── EL CONTRATO DE DECISIÓN ──────────────────────
   Lo que decidió la puerta, en un solo objeto con la misma forma en el modo
   IA (buildContext) y en el modo manual (responderSinModelo). Hasta ahora la
   decisión vivía repartida en banderas —nivel, otraSeccion, ausentes, el
   aviso de la cifra, «lo encontré como»— y cada consumidor la reconstruía a
   su manera. El contrato la dice una vez, y la leen el laboratorio
   (lab/volcar.mjs), el motor en Node, las trazas y el servidor MCP.

   Describe la decisión que ya se tomó; no cambia ninguna respuesta (ADR 0005,
   paso 5). Los cambios a la puerta (Fase 3) se miden contra él, y por eso
   lleva versión: dos volcados con distinta `versionPolitica` no se comparan
   como si fueran la misma regla.

   Los cuatro estados:
   · respaldada: evidencia sólida y nada que la pregunta pida y falte.
   · parcial: hay evidencia, pero floja, o falta una palabra, la cifra que se
     pidió, o solo llegó por el diccionario.
   · aclarar: la respuesta es una pregunta al asesor (dos secciones empatan,
     o pregunta por otra sección que la activa).
   · sin_evidencia: nada del manual la respalda. */
export const VERSION_POLITICA='puerta-1';

/* Las palabras de la pregunta que cuentan para «cubiertas»: las de tema, sin
   los verbos con que se pregunta en el piso ni las interrogativas. */
/** @param {string} pregunta */
export function palabrasDeTema(pregunta){
  return palabrasDeConsulta(pregunta).filter(k=>k.length>=3&&!esVerbo(k)&&!INTERROGATIVAS.has(k))
}

/**
 * @param {HechosDeDecision} h lo que ya se sabe de la pregunta
 * @returns {Decision}
 */
export function contratoDeDecision(h){
  const ausentes=h.ausentes||[];
  const evidencia=[];
  const vistos=new Set();
  for(const c of h.evidencia||[]){
    if(vistos.has(c.id))continue;
    vistos.add(c.id);
    evidencia.push({id:c.id,doc:c.docName,pagina:c.page??null});
  }
  /* Cubierta: la palabra (o alguna de sus formas) está escrita en la
     evidencia. Lo que llegó solo por el diccionario no cuenta como cubierto. */
  const texto=' '+(h.evidencia||[]).map(c=>normalizeText((c.heading||'')+' '+c.text)).join(' ').replace(/\s+/g,' ')+' ';
  const faltan=ausentes.map(a=>a.palabra);
  const cubiertas=evidencia.length
    ?palabrasDeTema(h.pregunta).filter(k=>!faltan.includes(k)&&variantes(k).some(v=>texto.includes(' '+v+' ')))
    :[];
  /** @type {string[]} */
  const razones=[];
  if(h.deLaApp)razones.push('pregunta-de-la-app');
  if(h.operacion)razones.push('operacion-de-tienda');
  if(h.empate&&h.empate.length)razones.push('empate-de-secciones');
  if(h.otraSeccion)razones.push(h.otraSeccion.motivo==='nombrada'?'otra-seccion-nombrada':'en-otra-seccion');
  if(!h.deLaApp&&!h.operacion&&!(h.empate&&h.empate.length)&&!h.otraSeccion&&(!evidencia.length||h.nivel===0))razones.push('sin-coincidencias');
  if(evidencia.length&&h.nivel===1)razones.push('coincidencia-floja');
  if(ausentes.some(a=>!a.enNinguno))razones.push('palabra-ausente');
  if(ausentes.some(a=>a.enNinguno))razones.push('palabra-de-ningun-manual');
  if(h.avisoCifra)razones.push('sin-la-cifra');
  if(h.parecidas)razones.push('solo-por-sinonimo');
  if(h.variasSecciones)razones.push('varias-secciones');
  if(h.ampliada)razones.push('consulta-ampliada');
  /** @type {EstadoDeDecision} */
  let estado;
  if((h.empate&&h.empate.length)||(h.otraSeccion&&h.otraSeccion.motivo==='nombrada'))estado='aclarar';
  else if(h.deLaApp)estado='respaldada';
  else if(h.operacion||!evidencia.length||h.nivel===0)estado='sin_evidencia';
  else if(h.nivel===2&&!ausentes.length&&!h.avisoCifra&&!h.parecidas)estado='respaldada';
  else estado='parcial';
  return{
    consultaResuelta:h.consulta,
    alcance:{seccion:h.seccion??null,porPregunta:!!h.porPregunta,...(h.empate&&h.empate.length?{alternativas:h.empate}:{})},
    estado,evidencia,cubiertas,faltan,razones,
    versionPolitica:VERSION_POLITICA,
  }
}
