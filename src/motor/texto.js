// Texto: stopwords, sinónimos, normalización y tokenización (la misma regla para el índice y la pregunta).
//
// Movido tal cual desde index.html (Fase 2: módulos sin bundler). Sin DOM: se
// puede importar desde Node.
/* ════════════════════════════════════════════════
   STOPWORDS + SINÓNIMOS
════════════════════════════════════════════════ */
export const STOPWORDS=new Set(['de','la','el','en','y','a','los','del','se','las','un','por','con','una','para','es','al','lo','como','pero','sus','le','si','sobre','este','entre','cuando','desde','sin','que','hay','tiene','esta','son','muy','tambien','estar','hasta','puede','todo','asi','nos','ni','bien','ser','porque','todos','solo','anos','dos','mismo','hace','cada','eso','han','sido','tres','otro','tanto','donde','cual','esto','estos','estas','ese','esa','esos','esas','mi','tu','su','nos','les','me','te',
  /* «¿Qué dice el manual sobre X?» es la plantilla de los accesos rápidos, y
     «manual» está en la portada y en el índice de cualquier manual: la portada
     entraba como segunda tarjeta a todo lo que se preguntaba así. */
  'manual','manuales']);
/** @type {Record<string, string[]>} */
export const SYNONYMS={
  // ═══ TIPOS DE PRENDA ═══
  'chamarra':['parte alta','exterior','prenda exterior','outerwear'],
  'camisa':['parte alta','camiseria','prenda alta','blusa'],
  'playera':['parte alta','camiseta','tshirt','prenda alta'],
  'sueter':['parte alta','sweater','jersey','prenda alta'],
  'pantalon':['parte baja','prenda baja','bottom'],
  'short':['parte baja','prenda baja','bermuda'],
  'saco':['blazer','parte alta formal','jacket','americana'],
  'traje':['suit','conjunto formal','sastreria'],
  'corbata':['accesorio cuello','corbateria','necktie'],
  'tenis':['sneakers','calzado deportivo','calzado casual','zapatilla'],
  'zapato':['calzado','calzado vestir','calzado formal','shoe'],
  'bota':['calzado','boot','calzado alto'],
  'sandalia':['calzado','lapida','sandal'],
  'pijama':['ropa de dormir','loungewear','conjunto nocturno'],
  'bata':['bata de bano','loungewear','robe'],
  'boxer':['ropa interior','intimo','underwear'],
  'calcetin':['calcetines','medias','socks'],
  'cinturon':['cinturonera','accesorio','belt'],
  'lentes':['gafas','anteojos','sunglasses','accesorio'],
  'gorra':['cap','sombrero','accesorio cabeza'],
  'cartera':['billetera','tarjetero','accesorio piel'],
  // ═══ ESPACIOS Y MOBILIARIO ═══
  'mostrador':['POS','punto de venta','caja','checkout'],
  'caja':['POS','punto de venta','mostrador'],
  'mesa':['mesa lifestyle','mesa exhibicion','isla central','table'],
  'pared':['perimetro','perimetral','muro','wall'],
  'gancho':['enganchado','tringla','frontal','face-out','side-out','barra'],
  'barra':['perimetral','tintoreria','rod','rack'],
  'mueble':['mobiliario','modulo','corner','fixture'],
  'vitrina':['tratamiento especial','exhibidor cerrado','showcase'],
  'estante':['entrepano','repisa','shelf'],
  'canasta':['cesta','basket','contenedor'],
  'jaula':['jaula sneakers','exhibidor deportivo','sneaker wall'],
  'lapida':['mueble sandalias','exhibidor plano','sandalias mueble'],
  'gondola':['gondola ropa interior','mueble interior','fixture interior'],
  'pompa':['pierna display','forma pierna','maniqui parcial'],
  // ═══ ACCIONES DE PISO ═══
  'acomodar':['exhibir','clasificar','mercadear','colocar','organizar'],
  'ordenar':['clasificar','entallado','colorizar','organizar'],
  'decorar':['props','estilo de vida','composicion','ambientar'],
  'combinar':['cruce mercancia','cross merchandising','silueta','coordinar'],
  'mover':['rotar','reubicar','cambiar','trasladar'],
  /* «¿Cada cuánto se viste el maniquí?» y la lámina dice «actualiza la
     vestimenta cada 15 días»: ni «viste» llega a «vestir» —la derivación no va
     al infinitivo— ni nadie escribe «vestimenta». Las formas del asesor van en
     la lista, como en «revisar». «visto» no: los manuales dicen «visto de
     frente». */
  'vestir':['montar maniqui','armar silueta','coordinar outfit','vestimenta','viste','visten','vestirlo'],
  /* «La ropa del maniquí»: los manuales dicen prendas o vestimenta, casi nunca
     ropa. ACCESORIOS HOMBRE no la escribe ni una vez. */
  'ropa':['prenda','prendas','vestimenta'],
  'armar':['montar','instalar','hacer','construir','organizar'],
  'montar':['armar','instalar','exhibir','colocar'],
  'limpiar':['limpieza','basicos exhibicion','mantenimiento'],
  'doblar':['doblado','fold','plegar'],
  /* Dos huecos de vocabulario que la batería dejó al descubierto, y que la
     morfología no puede cubrir porque son palabras distintas, no formas de la
     misma. «¿Cómo cuelgo la ropa?» tiene que llegar a ENGANCHADO, que es como
     estos manuales titulan lo de colgar la prenda; y «¿qué tan llena debe ir la
     barra?» a SATURACIÓN, cuya lámina habla de capacidad y de producto
     apretado, y nunca escribe «llena». */
  'colgar':['enganchado','gancho','barra','tringla','colgado'],
  /* El asesor pregunta «¿qué porcentaje…?» y estos manuales escriben «30% de
     participación»: la palabra «porcentaje» no aparece ni una vez en ninguno de
     los once. Era el único aviso falso de palabra ausente que quedaba en la
     batería, y el hueco estaba aquí, no en la regla. */
  'porcentaje':['participacion','porciento','proporcion'],
  'saturacion':['capacidad','llena','lleno','apretado','holgura'],
  /* «¿Qué reviso antes de que llegue la regional?» volvía con cero fragmentos:
     la lámina que contesta se titula CHECK LIST y nunca escribe «revisar». Y la
     derivación no va hacia el infinitivo (ver `variantes`), así que «reviso» no
     llegaba ni a esta entrada: las formas que escribe el asesor van en la lista. */
  'revisar':['check list','checklist','reviso','revisa','revisan','revision','checar','checo'],
  'planchar':['planchado','vaporera','eliminar arrugas'],
  'cambiar':['rotar','actualizar','renovar'],
  // ═══ CONCEPTOS VM MERCADEP ═══
  'focal':['exhibicion especial','display especial','punto focal','foco'],
  'mundo':['departamento','seccion','area','zona'],
  'corner':['espacio marca','area concesion','brand space'],
  'generico':['area mercadep','espacio propio','multimarca'],
  'proyecto':['project','zona experimental','capsula'],
  'silueta':['outfit completo','look','coordinado'],
  'concepto':['familia','coleccion','linea','capsule'],
  'entallado':['tallas ordenadas','size run','secuencia tallas','piezas','pieza','cuantas piezas'],
  'piezas':['entallado','pieza','cantidad entallado','cuantas piezas'],
  'pieza':['entallado','piezas','cantidad entallado'],
  'coloracion':['colorizar','bloque color','gradiente color','order color'],
  'triangulacion':['composicion triangulo','jerarquia visual','piramide visual'],
  'descanso':['descanso visual','espacio vacio','respiro visual'],
  'equilibrio':['balance visual','simetria','distribucion'],
  'rotacion':['ciclo vida producto','nuevo al frente','FIFO'],
  'surtido':['capacidad mueble','reabastecimiento','reponer'],
  'liquidacion':['barata','rebaja','descuento','sale','clearance'],
  'barata':['liquidacion','rebaja','descuento','gran demo'],
  'planograma':['layout','plano piso','mapa seccion'],
  // ═══ MARCAS PROPIAS ═══
  'marca propia':['MarcaDemoB','MarcaDemoA','MarcaDemoC','marca mercadep'],
  'marcademob':['marca propia formal','marca institucional','prioridad 2 POS'],
  'marcademoa':['softline','contemporaneo','marca propia contemporaneo'],
  'marcademoc':['marca propia juvenil','juveniles mercadep','project anchor'],
  // ═══ REGLAS OPERATIVAS ═══
  'sensor':['galleta','sensor galleta','sensor blando','antirrobo','alarma'],
  'etiqueta':['plastiflecha','precio','etiquetado','tag'],
  'medida':['centimetros','separacion','distancia','cm'],
  'pasillo':['alineacion','circulacion','80 cm','flujo cliente','espacio'],
  /* Nadie en piso pregunta "¿cuánto pasillo dejo?": pregunta "¿cuánto espacio
     dejo para que pase la gente?". Sin este puente, la lámina de ALINEACIÓN
     —que dice "80 cm" y nunca escribe "pasillo"— no se alcanzaba. */
  'paso':['pasillo','circulacion','alineacion','80 cm'],
  'pase':['pasillo','circulacion','alineacion','80 cm'],
  'pasar':['pasillo','circulacion','alineacion','80 cm'],
  'circulacion':['pasillo','paso','alineacion','flujo cliente'],
  'caminar':['pasillo','circulacion','flujo cliente'],
  /* "Lo que acaba de llegar" es la forma normal de decir "colección reciente". */
  'llegar':['reciente','coleccion nueva','avance temporada','nuevo'],
  'reciente':['coleccion nueva','avance temporada','nuevo','al frente'],
  'alma':['alma papel','paper insert','relleno camisa'],
  'temporada':['coleccion nueva','avance','nueva llegada'],
  'nuevo':['coleccion nueva','avance temporada','reciente llegada'],
  'slow':['slow mover','producto lento','baja rotacion','stock viejo'],
  /* «¿Qué va primero en el POS?» es de las preguntas más comunes del piso, y
     los manuales no escriben «primero»: escriben «Prioridad 1: Artículos de
     marca», «Prioridad 1 · Pañuelos, moños, fajas», «priorizando: Tintos…».
     «prioridad» sale 130 veces en los 33 manuales reales y «primero», 12. */
  'primero':['prioridad','priorizando','priorizar'],
  /* El piso dice dónde va algo con palabras de la calle y el manual con las de
     la lámina. Con preguntas nuevas, 10 de 54 de dato llegaban al modelo con
     el aviso «esa palabra no está en el manual» aunque la respuesta estuviera
     en el contexto, y el modelo obedecía el aviso: «¿las latas las acomodo
     parado o acostado?» contra una lámina que dice «de manera horizontal». La
     batería vieja no tenía ninguna, por eso no se veía. */
  /* Una palabra por sinónimo: la puerta parte las frases en palabras sueltas, y
     «parte delantera» o «de manera horizontal» metían «parte» y «manera», que
     están en todos los manuales y tapaban palabras que sí faltan («frente» en
     VINOS). */
  'abajo':['inferior','nivel inferior','entrepano inferior'],
  'arriba':['superior','nivel superior','entrepano superior'],
  'adelante':['frente','delante','delantera'],
  'parado':['vertical','verticalmente'],
  'acostado':['horizontal','horizontalmente'],
  'poquito':['poco','poca','variedad'],
  'revolver':['mezclar','mezcla','mezclado','mezclados'],
  'distinto':['diferente','diferentes'],
  'letrero':['senalizador','senalizadores','senalizacion','identificador','cartulina'],
  'dividir':['divide','dividen','division','clasificadas','clasifican','mundos'],
  'colgante':['colgar','cuelga','cuelgan','colgado'],
  // ═══ PERFILES DE CLIENTE ═══
  'clasico':['cliente clasico','tradicional','conservador','formal'],
  'practico':['cliente practico','funcional','rapido','eficiente'],
  'vanguardista':['cliente vanguardista','trendy','moderno','fashion'],
  'creativo':['cliente creativo','artistico','personal style'],
  'natural':['cliente natural','sustentable','organico','etico'],
  'disruptivo':['cliente disruptivo','unico','streetwear','original'],
};
/** Minúsculas, sin acentos y sin signos: la forma en que se compara todo. @param {string|null|undefined} t */
export function normalizeText(t){return(t||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\s]/g,' ')}
/** @param {string} text @returns {string[]} */
export function extractKeywords(text){return[...new Set(normalizeText(text).split(/\s+/).filter(w=>w.length>3&&!STOPWORDS.has(w)))]}
/** @param {string[]} kws @returns {string[]} */
export function expandKeywords(kws){
  const e=[...kws];
  for(const k of kws){
    if(SYNONYMS[k])e.push(...SYNONYMS[k]);
    for(const[key,s]of Object.entries(SYNONYMS)){if(s.includes(k)){e.push(key);e.push(...s)}}
  }
  return[...new Set(e)]
}
/** @param {string} text @param {string[]} kws */
export function scoreText(text,kws){
  const norm=normalizeText(text);const first300=norm.slice(0,300);
  let score=0;
  for(const kw of kws){
    const esc=kw.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    score+=(norm.match(new RegExp(esc,'g'))||[]).length;
    if(first300.includes(kw))score+=3;
  }
  if(/\[mandatory\]/i.test(text))score+=4;
  if(/conflicto documentado/i.test(text))score+=5;
  return score
}

/* El corte por longitud dejaba fuera «cm», que en un manual de exhibición es
   de las palabras que más información llevan: la lámina que contesta "¿cuánto
   dejo de pasillo?" dice literalmente "dejando 80 cm" y no menciona la palabra
   pasillo. También entran las cifras sueltas, porque aquí un "40%" es un dato,
   no ruido. */
export const UNIDADES=new Set(['cm','mm','mt','mts','m2','kg','ml','lt','pz','pzs']);
/** @param {string|null|undefined} t @returns {string[]} */
export function tokenize(t){return normalizeText(t).split(/\s+/)
  .filter(w=>!STOPWORDS.has(w)&&(w.length>2||UNIDADES.has(w)||/^\d+$/.test(w)))}

/* Las palabras de la pregunta se parten con la MISMA regla que el índice, no con
   una más estricta. `extractKeywords` corta en >3 letras, y como `weightedTerms`
   arrancaba de ahí, «POS», «cm», «SL» y las cifras nunca llegaban a buscarse: el
   arreglo que ya tenía `tokenize` para el índice se quedaba a medias porque la
   consulta entraba filtrada de antes. Medido: «¿qué va en el POS?» devolvía CERO
   términos y por tanto cero fragmentos — la pregunta más común del piso.
   `extractKeywords` se queda como está para la memoria de aprendizaje, que sí
   quiere solo palabras largas. */
/** @param {string} q @returns {string[]} */
export function palabrasDeConsulta(q){return[...new Set(tokenize(q))]}

/* Formas candidatas de una palabra, para que el plural del asesor encuentre el
   singular del manual. Se generan solo del lado de la pregunta: el índice no se
   toca, así que los manuales ya guardados siguen valiendo. No pretende ser un
   lematizador —«muebles» produce también «muebl», que no es palabra—; las
   variantes que no existen simplemente no coinciden con nada y no estorban. */
/** @param {string} w @returns {string[]} */
export function variantes(w){
  const v=[w];
  /** @param {string} x */
  const plural=x=>{
    if(x.length>4&&x.endsWith('s')){
      v.push(x.slice(0,-1));
      if(x.endsWith('es'))v.push(x.slice(0,-2));
      if(x.endsWith('ces'))v.push(x.slice(0,-3)+'z');
    }
  };
  plural(w);
  /* Y al revés: el asesor escribe «maniquis» y el manual titula «MANIQUÍES».
     Singularizar era la mitad del camino —la forma que el manual usa puede ser
     la plural—, así que también se prueba añadiendo la terminación. Las que no
     existen no coinciden con nada y no estorban. */
  for(const x of[...v])if(x.length>3&&!x.endsWith('s')){v.push(x+'s');v.push(x+'es')}
  /* El asesor pregunta "¿dónde acomodo lo rebajado?" y el manual escribe "la
     mercancía rebajada": misma palabra, otro género, y el buscador devolvía
     CERO fragmentos. Se prueba el género contrario en cada forma, incluida la
     singularizada, para que «rebajados» también llegue a «rebajada». */
  for(const x of[...v])if(x.length>4&&/[oa]$/.test(x))v.push(x.slice(0,-1)+(x.endsWith('o')?'a':'o'));
  /* El asesor escribe el verbo y el manual titula el sustantivo. Medido sobre
     87 preguntas con respuesta conocida en los once manuales, cuatro de los
     cinco fallos de recall eran esto y solo esto: «doblo» no llegaba a DOBLADO,
     «cuelgo» no llegaba a COLGADO, «colorizo» no llegaba a COLORIZACIÓN, y
     «rebajado» no llegaba a «rebaja» —que el diccionario ya sabía llevar hasta
     LIQUIDACIÓN—. No era vocabulario: la lámina estaba ahí y se llamaba casi
     igual.

     Dos derivaciones, en los dos sentidos: del verbo conjugado a la raíz
     («doblo» → dobl) y del participio a la raíz («rebajado» → rebaj). Sobre
     cada raíz se prueban las terminaciones con las que estos manuales titulan.

     Y la diptongación, que es la que rompe el caso más común del piso: en
     español la raíz cambia al conjugar —colgar/cuelgo, cerrar/cierro— así que
     de «cuelg» se prueba también «colg». Sin eso, la mitad de los verbos
     irregulares no alcanzan nunca su propio título. */
  if(w.length>4){
    const raices=[];
    const part=w.match(/^(.{3,})(?:ados|adas|ado|ada)$/);
    if(part)raices.push({raiz:part[1],part:true});
    /* «¿cómo se doblan los pantalones?»: la tercera del plural también es
       verbo, y sin ella «doblan» solo llegaba a DOBLADO de rebote, como errata. */
    const conj=w.match(/^(.{3,})(?:an|en|[aeo])$/);
    if(conj)raices.push({raiz:conj[1],part:false});
    /* El mismo verbo en singular: «¿cómo se clasifican los cubiertos?» y el
       manual de Mesa Fina dice «La cubertería se clasifica por estilos». Es la
       misma persona gramatical que usa el manual para dar la regla, y no va
       hacia el infinitivo, que es por donde se colaba «cambio» → «cambiar». */
    if(/[^aeiou](?:an|en)$/.test(w))v.push(w.slice(0,-1));
    /* Y al revés, de la primera persona del asesor a la del manual: «¿cómo
       etiqueto…?» y la lámina dice «se etiquetan en la costura». Misma regla de
       arriba: la persona con que el manual da la regla, nunca el infinitivo. */
    if(conj&&/o$/.test(w))for(const t of['an','en'])v.push(conj[1]+t);
    /* Solo se deriva hacia el sustantivo, nunca hacia el verbo. La primera
       versión probaba también el infinitivo y reabrió un agujero que ya estaba
       cerrado: «cambio» alcanzaba «cambiar», y «¿cómo cambio la llanta del
       coche?» volvía a pasar por pregunta contestable —el arnés interno lo
       cazó en el acto—. Es asimétrico a propósito, porque el problema lo es: el
       asesor escribe el verbo y el manual titula el sustantivo, nunca al revés.
       Del participio sí se vuelve al sustantivo corto («rebajado» → «rebaja»),
       que es de donde el diccionario sabe seguir hasta LIQUIDACIÓN. */
    /* «-eza» por «¿cuándo se limpia?»: la lámina se titula LIMPIEZA y dice
       «limpiar», y la pregunta solo encontraba el check list. */
    const SUF_VERBO=['ado','ada','ados','adas','acion','aciones','eza'];
    const SUF_PARTICIPIO=['a','o','ar'];
    for(const{raiz,part}of raices){
      const dip=raiz.replace(/ue([^aeiou]*)$/,'o$1').replace(/ie([^aeiou]*)$/,'e$1');
      for(const r of dip===raiz?[raiz]:[raiz,dip])
        for(const suf of part?SUF_PARTICIPIO:SUF_VERBO)v.push(r+suf);
    }
  }
  return[...new Set(v)]
}

/* El diccionario de sinónimos está escrito en infinitivo —«acomodar»,
   «colgar», «planchar»— y el asesor escribe conjugado. La derivación fuerte no
   genera el infinitivo a propósito: por ahí se colaba «cambio» → «cambiar», y
   con él las preguntas que no son del manual. Así que se genera aquí, y solo
   para llamar a la puerta del diccionario: lo que entre por ella pesa lo que
   pesa un sinónimo, no lo que pesa la palabra que el asesor escribió.

   Sin esto, «¿cómo acomodo las tallas?» no llegaba a «colocar» —que es como lo
   dice el manual de CASUAL, que nunca escribe «acomodar»— y la pregunta salía
   marcada como si hablara de algo ajeno a su propia sección. */
/** @param {string} w @returns {string[]} */
export function infinitivos(w){
  if(w.length<5)return[];
  const m=w.match(/^(.{3,})(?:ados|adas|ado|ada|o|a|e)$/);
  if(!m)return[];
  const r=m[1];
  const dip=r.replace(/ue([^aeiou]*)$/,'o$1').replace(/ie([^aeiou]*)$/,'e$1');
  const out=[];
  for(const x of dip===r?[r]:[r,dip])out.push(x+'ar',x+'er',x+'ir');
  return out
}
