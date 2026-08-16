# Asistente de piso — demo

Asistente conversacional de una sola página para el personal de piso de una tienda:
responde dudas de montaje y estándar de exhibición desde el celular, parado frente al
mueble, **sin instalar nada y sin cuenta**.

> **Demo con conocimiento 100 % sintético.** El cliente (*Mercadep*), las marcas
> (`MarcaDemoA`–`MarcaDemoL`), los mundos, los porcentajes de piso y los números de manual
> son inventados. Ningún manual, marca, medida ni dato operativo de un cliente real vive en
> este repositorio ni en su historial.

**[▶ Abrir el demo](https://gerardobr01.github.io/Visual_Lv-/)**

## Qué resuelve

El manual de montaje de una campaña son decenas de páginas en PDF. Nadie las carga al piso,
así que las dudas se resuelven preguntando —si hay a quién— o adivinando. Este asistente
pone ese conocimiento a un toque de distancia, en el lenguaje con el que realmente se
pregunta: *"¿a qué altura va el sensor?"*, no *"criterios de colocación de dispositivo EAS"*.

## Dos modos, y el de abajo es el interesante

| | **Modo manual** (sin API key) | **Modo razonado** (con API key) |
|---|---|---|
| Qué hace | Busca en el manual y entrega los fragmentos que coinciden, **tal cual**, con su página y su lámina | Responde interpretando, en 6 etapas: intención → expansión → retrieval → razonamiento → certeza → respuesta |
| Dónde corre | Entero en tu dispositivo, incluida la lectura del PDF y el recorte de figuras | El retrieval en tu dispositivo; la interpretación en el proveedor que elijas |
| Sale a la red | **No.** Ni una petición | Sí: la pregunta y el contexto recuperado van a Google AI Studio o a OpenAI |
| Qué cuesta | Nada | Tu propia key y tus propios tokens |

El modo manual existe porque un demo que primero te pide una API key no es un demo. Pero
sobre todo existe porque **declara su límite en vez de disimularlo**: dice "sin modelo
conectado, nadie interpretó esto" y entrega la fuente. Y si nada del manual coincide con la
pregunta, lo dice — no rellena con la sección más cercana.

## Cómo está hecho

- **Un solo archivo `index.html`.** Sin build, sin bundler, sin backend propio, sin
  servidor que mantener. Se publica como archivo estático y se abre desde un link.
- **Conocimiento embebido y estructurado**, con un diccionario de sinónimos y alias por
  término — la gente no pregunta con el vocabulario del manual. "Acomodar" tiene que
  encontrar "exhibir", "clasificar" y "mercadear".
- **Retrieval léxico local con BM25**: se extraen las palabras de la pregunta, se expanden
  con sus sinónimos —que pesan menos que la palabra que el usuario escribió de verdad— y se
  puntúan los fragmentos por relevancia, con peso extra para las reglas `[MANDATORY]`, los
  conflictos documentados y, cuando la pregunta pide una cantidad, para los fragmentos que
  traen cifras.
- **Conflictos documentados como feature.** Cuando dos manuales se contradicen (el entallado
  lleva 4, 5 o 6 piezas según cuál leas), el sistema tiene prohibido responder "el manual no
  especifica": cita el conflicto y la regla general.
- **Cuando la búsqueda no encuentra nada, se dice.** El contexto llega encabezado por un
  aviso de que no hubo coincidencias y con la orden de contestar "el manual no especifica",
  en vez de entregar fragmentos sueltos bajo la instrucción de "responde solo con esto" —
  que es obedecer y componer una regla que nadie escribió. En ese caso tampoco se guarda
  evidencia: no puede salir una lámina debajo de una respuesta que el manual no sostiene.
  Son **tres niveles, no dos**, y eso salió de medir: a escala real «¿cómo acomodo las
  tallas?» —una pregunta central del piso— deja la misma huella que «¿a qué hora abre la
  tienda?». Con evidencia sólida se responde normal; con evidencia débil el contexto va
  igual pero avisando de que la coincidencia es floja, y decide el modelo, que sabe leer si
  esos fragmentos vienen al caso; sin ninguna coincidencia no se finge nada. Cortar en seco
  el caso intermedio contesta "no lo especifica" a preguntas que el manual sí contesta, y eso
  vacía la herramienta más rápido que un contexto de más.
- **Una sección a la vez.** El asesor elige con qué manual está trabajando y solo ese se
  consulta; queda un «todos» explícito para comparar. No es un lujo de interfaz: medido con
  cinco manuales reales de la misma plantilla, «¿cuánto pasillo dejo?» armaba la respuesta con
  fragmentos de los cinco y enseñaba tres láminas de tres manuales distintos. El dato salía
  bien y **citado a la página de un manual que no era el suyo**, que es peor que un dato
  inventado: el asesor va a esa página y no está.
- **La identidad la pone el manual.** El nombre de la sección se saca del propio documento
  —«271 CASUAL», «436 COLECCIONES BEBÉS»— y con él se presenta el asistente, se rotulan las
  respuestas y se generan accesos rápidos con los títulos de sus propias láminas. Antes se
  presentaba como especialista de Hombres delante de un manual de Bebés, y el filtro de tema
  —vocabulario de Hombres— dejaba fuera preguntas tan de piso como «¿qué se debe limpiar?».
- **Una sola fuente por respuesta.** Con un PDF cargado, el conocimiento interno no entra al
  contexto. Traía cifras propias —90 cm de pasillo, 40%, 50%— que el modelo citaba como si
  fueran del manual del asesor, y la verificación las daba por buenas porque estaban en el
  contexto: para quien lee en el piso, eso es exactamente un dato inventado. Lo que el PDF
  no cubra se consulta aparte, con un botón, y la respuesta viene rotulada como lo que es.
- **Cada respuesta declara su certeza** —`ALTA`, `MEDIA` o `GAP`— en una última línea que se
  lee automáticamente, no se muestra, y decide el distintivo del mensaje y si se enseña
  lámina o no.

### Cómo se mide

Abrir `index.html?test=1` corre el arnés: preguntas de respuesta conocida sobre el manual
interno —incluidas las que llegan por sinónimo, las escritas con errata, las de seguimiento
y tres de ruido que deben quedar sin respuesta—, más las comprobaciones de verificación
numérica, de láminas y de certeza. Reporta recall, cuánto ruido se atrapa y **el margen del
caso más ajustado sobre el corte relativo `CTX_ALPHA`**, que es el número que hay que volver
a mirar cada vez que se toca el vocabulario. Corre entero en el dispositivo, sin API y sin
red, sobre las mismas funciones que usa el chat.

Si hay manuales cargados corre además una segunda tanda **contra ellos**. No puede comprobar
respuestas concretas —cada manual dice lo suyo—, así que mide lo que es igual en cualquier
manual de piso: que las preguntas de siempre (pasillo, gancho, tallas, limpieza, surtido)
encuentren algo, que el ruido no, que con una sección activa **ni un fragmento ni una
lámina** salgan de otro manual, y que preguntar por una sección teniendo otra activa avise
en vez de contestar. Esa última prueba se arma sola con el identificador que cada manual da
de sí mismo, así que corre igual con manuales que el sistema no ha visto nunca. Medido sobre
**once manuales reales cargados a la vez** —1.150 fragmentos, 706 figuras, 82 MB, 3 minutos
de carga—: 33/33.

Lo que ese lote mide de verdad no es el acierto, es **de dónde sale el dato**. Con las once
secciones cargadas y una activa, 88 preguntas de trabajo (ocho por sección) devolvieron
**cero fragmentos de otro manual y cero avisos indebidos**; y nombrando otra sección, las
once avisan con **cero fragmentos y cero láminas**, que es lo que hace imposible la cifra
creíble y falsa. La contraprueba de por qué importa: «¿cómo circula el cliente en la
sección?» la contestan diez secciones **con siete cifras distintas**, todas verdaderas en su
manual.

### El motor de lectura de manuales

Un manual de campaña no es un documento de texto corrido: es una presentación. En una misma
lámina conviven dos reglas distintas, una en cada columna, a la misma altura. Eso condiciona
todo lo demás:

- **Reconstrucción por columnas.** El texto se rearma en tres pasos —fragmentos → líneas,
  cortadas donde hay hueco horizontal → bloques, agrupados por cercanía— y solo al final se
  ordena, por bandas y de izquierda a derecha. Agrupar por coordenada vertical, que es lo
  que hace casi cualquier extractor, fusiona las dos columnas y produce una regla que no
  existe.
- **Cada fragmento sabe de dónde salió.** Documento, página y sección viajan pegados al
  texto hasta el prompt, y la sección se asigna por posición —el título que está encima y en
  la misma columna—, no por orden de lectura. Citar mal la sección es peor que no citarla:
  por eso el título vigente se reinicia en cada página y, cuando la lámina no lleva ninguno
  en mayúsculas, se usa su propio nombre —el rótulo corto de la franja superior, "Rotación",
  "Perímetros de Básicos"—, que es lo que el asesor tiene delante en la hoja.
- **Figuras.** Los planogramas de estos manuales son dibujos vectoriales, no fotos: extraer
  las imágenes incrustadas devuelve íconos de leyenda de 36×18 px y se deja justo lo que más
  se consulta. Así que se hace lo que hacen los parsers serios (Marker, MinerU): renderizar
  la página y recortar la región, encontrándola por geometría —dónde hay tinta que no es
  texto— como en [PDFFigures 2.0](http://pdffigures2.allenai.org/), sin ningún modelo. Para
  las fotos, además, se le pregunta al PDF dónde coloca cada imagen. Cada figura hereda el
  texto que la rodea, así que **ya es buscable sin ninguna IA**.
- **Verificación de lo verificable.** Con API key, cada cifra de la respuesta se comprueba
  contra los fragmentos que realmente se enviaron, y cada página citada contra las que
  existen. Lo que no cuadra sale marcado. No detecta un razonamiento equivocado; detecta el
  dato traído de fuera del manual, que es el que llega al piso.
- **La lámina que acompaña sale de lo que la respuesta citó**, no de lo que el buscador
  trajo: las páginas citadas se cruzan con los fragmentos enviados para saber de qué manual
  son, y si la respuesta no cita ninguna página no se muestra ninguna imagen. Los recortes
  repetidos se reconocen por una firma visual del propio recorte, no por su posición en la
  lámina.
- **Manda el manual del asesor.** Con un PDF cargado, ese es el que se está ejecutando en su
  piso: su valor es el operativo, el conocimiento interno queda como referencia general y,
  si los dos hablan del mismo dato, la diferencia se menciona como nota — nunca como empate
  que deje al asesor eligiendo.
- **El contexto se recorta con números, no con intuición.** Corte relativo al mejor
  fragmento de cada consulta, deduplicado de casi-idénticos dentro de un mismo documento,
  tope por página y nada de fragmentos cortados a la mitad: ~60% menos contexto, medido
  contra 51 preguntas de respuesta conocida en 17 manuales reales de dos plantillas
  distintas, sin perder ninguna. La regla de aceptación es de veto: una configuración que
  pierda un solo fragmento con la respuesta se descarta, ahorre lo que ahorre.
- **Descripción de figuras con IA, opcional y apagada.** Un modelo con visión transcribe los
  rótulos de un plano una sola vez por figura, y el texto queda indexado. Sin key la app
  funciona igual, solo sin esa capa.

### Dependencias y datos — lo que sí sale y lo que sí se guarda

Nada de esto es un problema, pero prefiero decirlo a que se descubra abriendo DevTools:

- **Carga tres librerías desde CDN** (`cdnjs`): [`pdf.js`](https://mozilla.github.io/pdf.js/)
  para leer PDFs de temporada que el usuario arrastre, `marked` para el markdown y
  `DOMPurify` para sanitizar lo que se renderiza. Más las tipografías de Google Fonts.
- **Con API key, la pregunta sale del dispositivo** hacia el proveedor que el usuario
  configuró. Es una llamada directa del navegador a su API, sin intermediarios míos.
- **Guarda en el navegador**: la API key en `sessionStorage` (se borra al cerrar la
  pestaña, nunca en `localStorage`); el historial de chat, la memoria y los accesos rápidos
  en `localStorage`.
- **Guarda los manuales procesados en IndexedDB**, indexados por el hash del archivo, para
  no volver a procesar 28 láminas cada vez que se abre la página desde el celular. Incluye
  los recortes de las figuras. **Vive en el dispositivo y no sale a la red**, y hay un botón
  visible para borrarlo en la pestaña de manuales.
- **Si —y solo si— se pulsa "describir figuras", los recortes salen** hacia el proveedor
  configurado. Es la única vez que una imagen del manual deja el dispositivo, y hace falta
  pedirlo a propósito.
- **Sin telemetría, sin analítica, sin cuentas.** Nada se envía a ningún servidor mío,
  porque no hay servidor mío.

## Límites conocidos

- **El retrieval no lematiza de verdad.** Del lado de la pregunta prueba unas cuantas formas
  —plural en los dos sentidos ("pasillos" → "pasillo" y "maniquí" → "maniquíes") y género
  ("rebajado" → "rebajada")—, lo justo para que la palabra del asesor encuentre la del
  manual, pero no entiende morfología: "exhibir" no alcanza "exhibición" por sí solo, y
  ningún salto de significado ocurre sin el diccionario de sinónimos, que se llena a mano y
  por lo tanto está incompleto. Lo que sí hay es dónde arreglarlo: las variantes se generan
  solo del lado de la pregunta, así que ampliarlas no obliga a reprocesar ningún manual ya
  guardado.
- **Las erratas se corrigen por parecido, no por diccionario.** Cuando ni la palabra escrita
  ni ninguna de sus formas está en el índice, se busca la más parecida por trigramas y entra
  con el mismo descuento que un sinónimo. Alcanza para "entayado", "corvatas" o "maniquis";
  no para una palabra mal partida ni para una que el manual sencillamente no usa.
- **La pregunta de seguimiento se resuelve por forma, no por comprensión.** Solo se amplía
  con la pregunta anterior lo que está literalmente incompleto: empieza por "y…", "entonces…",
  o no llega a dos palabras propias. Lo demás se busca tal cual, y si no encuentra nada se
  reintenta con la anterior pegada **aceptándolo solo si sale sólido**. El umbral anterior
  —menos de cuatro palabras propias— ampliaba casi siempre, porque en español tras quitar
  "como", "se", "los", "en" quedan dos o tres: medido en el piso, "¿cómo se arman las mesas?"
  se buscó junto con la pregunta anterior y el asistente contestó **la anterior, palabra por
  palabra**. Sigue siendo una heurística: un seguimiento redactado entero no se detecta, y
  para eso está el aviso en la tira de fuentes.
- **Que dos manuales sean la misma plantilla es el riesgo de fondo, y no lo arregla la
  búsqueda.** Medido entre 101 MUEBLES y 251 JUVENILES: 22 títulos idénticos y, bajo
  ALINEACIÓN, los dos dicen 80 cm. Pero "¿qué porcentaje es el cliente clásico?" vale 25.6%
  en uno y 0% en el otro. Con la sección equivocada activa la respuesta no sale vacía: sale
  un número creíble y falso, con su página y su lámina. Como el vocabulario de los dos
  manuales es el mismo, ningún ajuste del retrieval puede distinguirlos. Lo que sí distingue
  es **cómo se llama la sección**, y eso el asesor lo escribe: "los perímetros **en
  juveniles**". Así que el nombre de la sección se busca dentro de la pregunta, y si señala a
  otro manual cargado, el asistente no responde con datos — avisa y ofrece cambiar. Un
  término solo cuenta como identificador si de verdad señala a un manual: medido sobre once,
  "juveniles" sí (11 de 11 fragmentos son suyos) y "muebles" no (16 de 85, con dulcería
  pisándole con 15, porque todas las secciones tienen muebles de exhibición).
- **Hay secciones que solo se pueden nombrar por su número.** Cuando el nombre de una sección
  es una palabra que todos los manuales usan, no queda identificador: **101 MUEBLES y 271
  CASUAL solo se alcanzan escribiendo "101" o "271"** —y "casual" es peor que ambiguo, tiene
  26 fragmentos en el manual de zapatos contra 15 en el suyo—. Para las que se quedarían sin
  ninguna palabra se baja el listón a dominancia clara —más del doble que el segundo manual y
  al menos el 40%—, que es lo que recupera "blancos" (10 de 15, con el segundo en 4). Ese
  rescate **no se aplica cuando ya hay una palabra**: "512 MUJER CLÁSICA" se identifica por
  "clásica", y sumarle "mujer" bloquearía preguntas legítimas en vestidos de fiesta.
- **El rótulo de la sección se adivina, y a veces se adivinaba mal.** Sale del código de
  sección en los títulos, del check list, o del nombre del archivo cuando trae el código
  delante. Medido sobre once: el manual de zapatos no tiene ninguna de las dos marcas
  internas y salía llamándose "ENTRADA PEATONAL" —el título de una lámina de la página 2—, y
  el de vinos salía como "388 DIVERSOS" porque así lo rotula su propio check list. El nombre
  del archivo se prefiere solo si no comparte ninguna palabra con el rótulo interno, y la
  comparación es por prefijo porque al descargar se pierde el acento: "391 DULCER A" sigue
  siendo DULCERÍA y conserva su nombre interno. Un manual sin código en ninguna de las tres
  vías sigue cayendo al nombre de archivo limpio.
- **Las palabras que el asesor usa y no son el nombre de nadie** —"sábanas", "sneakers",
  "tequila", "comedor"— no identifican sección, y no hace falta que lo hagan: al no encontrar
  nada en la sección activa entra la vía de evidencia y, medido, las seis dan con su manual
  con cero fragmentos y cero láminas. El límite está en la otra dirección: si la sección
  activa **sí** tiene algo parecido que decir, responde con lo suyo y no avisa.
- **"Todos los manuales" sirve para comparar, no para trabajar.** Sin sección elegida la
  misma pregunta tiene varias respuestas verdaderas: medido, "¿qué porcentaje es el cliente
  práctico?" devuelve 44%, 38.5%, 39.3%, 35.3% y 43.8% — una por sección. Elegir una es
  acertar en una y fallar en cuatro. Ahora el contexto avisa de cuántas secciones lleva y
  pide el dato **por sección**, y **no se enseña ninguna lámina** salvo que la respuesta cite
  la página: una imagen que dice "de aquí sale el dato" cuando hay cinco datos distintos es
  una afirmación falsa. Aun así, en el piso lo correcto es elegir sección.
- **El filtro de fuera de tema se agujerea al crecer, y por eso el vocabulario es el de la
  sección activa.** Para decidir si una pregunta es del dominio se mira si alguna palabra
  está en el manual. Con once cargados esa unión llega a 2.952 palabras y ya casi todo está
  en algún manual: medido, "dame la receta del pastel de chocolate" pasaba a contar como
  pregunta de trabajo por *chocolate*, de dulcería, y "¿cómo va el clima mañana?" por *clima*.
  Con la sección activa el vocabulario vuelve a 972 palabras y las dos se atrapan otra vez.
  Sin sección elegida el agujero sigue abierto, que es una razón más para elegirla.
- **El modo manual puede devolver una coincidencia floja.** Si una lámina contiene por
  casualidad una palabra de la pregunta, la muestra. Probé dos filtros para cortarlo —por
  rareza del término y por puntuación mínima— y **medí los dos sobre los siete manuales
  reales: ninguno funciona**, porque el ruido y las preguntas legítimas se solapan. Lo que
  el modo garantiza no es rechazar lo que no sabe, sino no fingir que lo sabe: entrega el
  fragmento con su página y dice que nadie lo interpretó. Lo que sí se cerró es el ruido por
  coincidencia parcial: el acierto se cuenta por palabra entera, así que «¿cómo **cambio** la
  llanta del coche?» ya no acierta dentro de «cambiar cada 3-4 semanas». Las formas
  legítimas las sigue generando el lado de la pregunta.
- **Un PDF escaneado no se puede leer.** Si la lámina es una imagen sin capa de texto, el
  sistema lo dice y no lo carga, en vez de fingir que lo entendió. Haría falta OCR.
- **La detección de figuras está calibrada sobre manuales tipo presentación.** El corte
  entre "figura" y "panel de texto" salió de medir un manual real: las figuras quedan por
  debajo de 0.11 de cobertura de texto y los paneles por encima de 0.27. Un documento con
  otra maquetación puede caer en el hueco, y entonces sobran o faltan recortes.
- **La verificación de cifras no distingue entre inventar y razonar.** Comprueba que el
  número —con su unidad, porque «80 cm» y «Cruce 80/20» no son el mismo dato aunque
  compartan el 80— esté en el contexto recuperado; si el modelo suma dos cantidades
  correctas, el resultado saldrá marcado aunque esté bien. Prefiero ese falso positivo al
  silencio. Y el aviso va **encima** de la respuesta, no debajo: colgado abajo, el asesor ya
  había leído —y en el piso, ejecutado— el dato que el aviso venía a poner en duda.
- **El listón de "esto sí es una respuesta" depende de la escala, y es un número medido, no
  deducido.** Con las 10 secciones largas del manual interno, acertar una palabra dentro de
  «BÁSICOS DE DISPLAY» apunta de verdad a la regla; con 572 fragmentos de 185 caracteres de
  cinco manuales reales, la misma palabra suelta es casualidad —«tienda» aparece en
  «TIENDA FLAGSHIP» y colaba «¿a qué hora abre la tienda?» con 8412 caracteres de contexto—.
  Por eso la exigencia sube con el tamaño del corpus. Los dos regímenes medidos están lejos
  (10 fragmentos contra 88–572), así que el corte no está afinado al borde; pero es un
  número que habrá que volver a mirar con manuales de otra maquetación.
- **La puntuación general premia `[MANDATORY]` aunque no haya coincidencia de palabras.**
  Sirve cuando el resultado lo va a leer un modelo, que sabe descartar lo que no viene al
  caso; mentiría en el modo manual. Por eso ahí se exige al menos un acierto real de
  término antes de mostrar cualquier sección.
- **La lámina que se muestra puede ser la vecina.** Si en la página citada ninguna figura se
  puede identificar por sección ni por las palabras de la respuesta, se muestra **una** —no
  tres, que se leen como tres pruebas del mismo dato— y el rótulo dice que es de la página
  citada, no que sea la lámina que sostiene el dato. El pie lleva siempre manual, página y
  sección para que se vea de dónde salió.
- **Si el modelo no cita página, la lámina sale igual, con otro rótulo.** Antes eso dejaba al
  asesor sin ninguna imagen, que era la falla más visible: basta con que el modelo se salte
  el formato para perder la evidencia. Ahora se cae al fragmento mejor puntuado de los que
  se consultaron y el rótulo lo dice con esas palabras — no promete una cita que no existe.
  Lo que nunca sale es una lámina bajo una respuesta que admite el hueco.
- **El recorte de contexto se midió sobre 17 manuales de dos plantillas distintas** —51
  preguntas de respuesta conocida, ninguna perdida—, pero el margen del caso más ajustado
  bajó de 51% a 42% al ampliar el diccionario: cada sinónimo nuevo sube la puntuación del
  mejor fragmento y, con ella, el listón del corte relativo. Sigue habiendo holgura sobre
  α=0.25, pero es un número que hay que volver a medir cada vez que se toca el vocabulario,
  no una constante. **El arnés ya vive en el repo** (`index.html?test=1`) precisamente por
  esto: al ampliar variantes y erratas el margen del caso más ajustado se movió del 35% al
  75%, y eso solo se ve midiendo.
- **El nombre de la lámina se deduce de la maquetación.** Se toma la línea corta y sin
  puntuación de la franja superior de la página. Acierta en los 17 manuales, pero es una
  regla geométrica: en una lámina cuyo rótulo esté partido en dos líneas se queda con la
  etiqueta del panel ("Montaje") en vez del título completo ("Mercadeo de Cestos en
  Perímetro"). Es menos preciso, no falso.
- **El conocimiento es sintético**, así que las respuestas son coherentes pero no son el
  estándar de nadie. Sirve para ver la mecánica, no para montar una tienda. Con un PDF real
  cargado deja de entrar: el manual del asesor es la única fuente, y el interno solo se
  consulta si se pide a propósito con el botón de referencia general.

## Lo que encontré al prepararlo para publicar

Defectos que el uso normal no muestra. Los dejo escritos porque enseñar dónde falla un
sistema dice más de él que la lista de lo que hace:

1. **El hash de integridad de DOMPurify estaba mal.** El navegador descargaba el archivo,
   la verificación SRI fallaba y el script no se ejecutaba nunca. El código tenía un
   fallback (`escapeHtml`) que funcionaba tan bien que nadie notó nada: llevaba meses
   renderizando todas las respuestas como texto plano escapado, y la protección que decía
   tener no estaba cargada. Un fallback silencioso convierte un bug en una feature invisible.
2. **El retrieval no sabía decir "no sé".** La función que puntúa las secciones suma puntos
   por ser `[MANDATORY]` o por documentar un conflicto, aunque no coincida ni una palabra de
   la pregunta. Resultado: preguntar por una receta de cocina devolvía la sección de
   entallado, con toda seriedad. Sirve cuando el resultado lo lee un modelo, que descarta lo
   que no viene al caso; en el modo manual era mentir. Ahora se exige al menos un acierto
   real de término.
3. **El bloque de fuentes se desbordaba en celular.** Justo en el único dispositivo donde
   esto se usa.
4. **El asistente nunca había leído un manual cargado.** Este es el grande, y tardé meses en
   verlo porque estaba buscándolo en el sitio equivocado. Cuando la respuesta sobre un PDF
   salía mal, yo culpaba al prompt o al modelo. El problema estaba mucho antes: la
   extracción agrupaba el texto solo por coordenada vertical, y en una lámina con dos reglas
   en paralelo —ALINEACIÓN a la izquierda, LIMPIEZA a la derecha, a la misma altura— las
   fusionaba en la misma línea. El "¿Qué es?" de una quedaba pegado al de la otra. Después,
   el troceado cortaba ese texto ya revuelto cada 700 caracteres. **El modelo nunca recibió
   el manual; recibió el manual licuado**, y ningún prompt arregla eso. Cuando un sistema
   con IA falla, el instinto es tocar el prompt, porque es la pieza que se ve.
5. **Sin API key, el PDF recién cargado se ignoraba por completo.** La búsqueda del modo
   manual solo recorría el conocimiento embebido. El usuario veía su manual en la lista,
   preguntaba, y recibía respuestas que no salían de él.
6. **El filtro de honestidad tiraba justo las respuestas buenas.** Salió probando con siete
   manuales de secciones distintas, y es el reverso del hallazgo 2. Para poder decir "no sé",
   el modo manual exigía que alguna palabra de la pregunta apareciera literalmente en el
   fragmento. Pero el manual de Caballero contesta "¿cuánto dejo de pasillo?" con una lámina
   titulada ALINEACIÓN que dice *"dejando 80 cm"* y **nunca escribe la palabra pasillo**.
   BM25 la encontraba igual, por el diccionario de sinónimos, y la ponía primera — y el
   filtro la descartaba por no tener coincidencias literales. **El puente estaba construido y
   el filtro no dejaba cruzarlo.** Se sumaba que `cm`, en un manual que es medidas de punta a
   punta, no era ni siquiera una palabra buscable: el tokenizador descartaba todo lo de dos
   letras. Las tres formas de preguntarlo fallaban; ahora las tres caen en la lámina correcta.
7. **Dos filtros que parecían buenos y no lo eran.** Para cortar las coincidencias
   incidentales probé filtrar por rareza del término (idf). Falla de raíz: "cambio" aparece
   en un solo fragmento y puntúa 4.17, **por encima de "sensor" (3.66)** — raro no es lo
   mismo que relevante. El segundo intento, una puntuación mínima, parecía perfecto en un
   manual (el ruido en 3.3–4.4, lo legítimo desde 6.5) y se derrumbó al medirlo en los siete:
   "¿a qué hora abre la tienda?" llega a 7.5 porque *tienda* es palabra central del manual.
   No hay corte que separe. Los dos se quedaron fuera. Calibrar un umbral con un solo
   documento es como probar el código con un solo caso: sale bien y no significa nada.
8. **La respuesta no llegaba: se cortaba justo antes del dato.** Durante meses interpreté
   esto como "la IA contesta mal". No contestaba en absoluto. Los modelos con razonamiento
   interno —`gemini-3.5-flash` entre ellos— **descuentan de `maxOutputTokens` lo que piensan
   por dentro**, y con seis etapas de razonamiento visible el presupuesto se agotaba pensando.
   En pantalla quedaba el razonamiento truncado a media frase, y el fallback del parser lo
   presentaba como si fuera la contestación: *parecía* que había respondido. Subir el tope no
   bastó (con 8000 se seguía cortando); el arreglo es apagar el pensamiento interno del
   proveedor, que aquí sobra — este asistente ya razona en seis etapas que se pueden leer, que
   es exactamente lo contrario de un razonamiento que no se puede auditar. Ahora, además, un
   razonamiento sin respuesta final se anuncia como lo que es y no se disfraza de respuesta.
9. **El verificador de cifras marcaba como inventado todo número decimal.** La defensa
   estrella contra la alucinación tenía un bug de dos líneas:
   `n.replace('.','[.,]').replace(',','[.,]')` — el primer `replace` mete una coma dentro de
   la clase de caracteres y el segundo la vuelve a sustituir, produciendo `20[.[.,]]8`, un
   patrón que no coincide con nada. Resultado: **preguntar por el 20.8% de participación
   devolvía el dato correcto con un sello de "no pude verificarlo"**, y estos manuales son
   decimales por todas partes (20.8%, 38.5%, 11.5%). Un aviso que desconfía de lo correcto
   gasta la credibilidad que necesita para cuando de verdad haya una invención.
10. **La imagen decía que el dato salía de ahí, y no salía de ningún lado.** A la pregunta por
    la temperatura de la sección el modelo contestó bien —*"el manual no lo especifica"*— y
    debajo aparecieron dos láminas igual, además idénticas entre sí. La tira de evidencia se
    armaba con **los ~20 fragmentos que entraron al contexto**, no con lo que la respuesta
    acabó citando, y el descarte de plantilla comparaba la **posición** del recorte, no su
    contenido. Un asesor cree la foto antes que el texto: una lámina que no sostiene lo que
    se lee es peor que ninguna. Ahora la tira se arma con las páginas que la respuesta citó
    —desambiguadas contra los fragmentos, porque con dos manuales cargados "pág. 11" es
    ambiguo—, sin cita no se muestra nada, y si de la página se puede identificar *la* lámina
    (su sección es la del fragmento citado) se enseña esa sola en vez de la página entera.
11. **Recortar el contexto sin perder la respuesta: medido, no supuesto.** Se enviaban ~20
    fragmentos por pregunta, y ahí es donde se va la cuota. Se midieron cinco filtros sobre
    24 preguntas de respuesta conocida en los siete manuales —seis de ellas formuladas *sin*
    las palabras de la lámina, que son las únicas que ponen a prueba un corte por
    puntuación—, con una regla de veto: cualquier configuración que pierda un solo fragmento
    con la respuesta queda descartada aunque ahorre mucho. Quedó un corte **relativo** al
    mejor fragmento de cada consulta (el absoluto ya había fallado, hallazgo 7), más
    deduplicado de casi-idénticos, tope por página y prohibición de enviar fragmentos
    truncados: **60% menos contexto sin perder ninguna respuesta**. El α agresivo ahorraba
    72% y también pasaba, pero el caso más difícil quedaba a la mitad de margen; no vale la
    pena por una pregunta que no esté en la muestra.
12. **Un deduplicado sensato borró el dato.** El filtro de casi-duplicados comparaba solo el
    cuerpo del fragmento. Con dos manuales cargados, la lámina «PRÁCTICO **(20.8%)**» de
    Blancos y la «PRÁCTICO» de Caballero tienen **el mismo párrafo debajo** —comparten
    plantilla— y el dato distintivo vive en el título. El filtro tiraba la de Blancos por
    parecida, y la respuesta correcta salía con el sello de "no pude verificar 20.8". Se
    arregló metiendo el título en la firma y **no comparando nunca entre documentos
    distintos**: que dos manuales digan lo mismo no vuelve prescindible al del asesor.
13. **Un número es un dato para buscar y una coincidencia para reconocer.** Al elegir qué
    lámina acompaña a la respuesta, «(pág. 3) … el 20.8%» compartía el «8» y el «3» con una
    lámina titulada «VANGUARDISTA (8.3%)», que no tiene nada que ver, y la ponía como
    evidencia. Las cifras sueltas quedan fuera de ese cotejo — no del buscador, donde un
    "40%" sí es información.

14. **La sección se heredaba de la página anterior.** El título vigente arrancaba con el
    documento, no con la página, así que una lámina sin títulos en mayúsculas se quedaba con
    el de la anterior: la regla del producto descontinuado se citaba como «pág. 9 ·
    ESQUINEROS», que es una sección de la pág. 8. Y como el título también se indexa, no solo
    se citaba mal: se buscaba mal. Solo se vio al probar manuales de otra plantilla, donde
    las láminas llevan su nombre en minúsculas y el detector de títulos no lo reconocía.

15. **Cada lámina ya traía su nombre; nadie lo estaba leyendo.** "Rotación", "Planograma",
    "Perímetros de Básicos" están arriba a la izquierda de cada página, pero en minúsculas, y
    el detector solo aceptaba mayúsculas. Acababan de primera línea del cuerpo. Reconocerlos
    dio sección a 17/17 manuales y dejó en cero las figuras sin sección — el pie de foto pasó
    de "pág. 8" a "pág. 8 · Montaje".

16. **Dos de los cuatro fallos que encontré eran de mis pruebas, no del producto.** Un regex
    pedía "no desarmar el set" y el manual parte la frase en dos líneas; otro daba por hecho
    que Manual Blancos documenta la altura del sensor, y no la documenta. Un arnés que falla
    por su cuenta gasta el tiempo en el sitio equivocado y, peor, esconde los fallos de
    verdad: los dos reales —"espacio de paso" y "lo rebajado"— estaban en la misma lista.

## Relación con Veristack

Es la otra mitad del mismo problema. [Veristack](https://github.com/GERARDOBR01/veristack)
**verifica** con una foto que la exhibición esté bien montada; este asistente ayuda a
montarla bien desde el principio. Los dos parten del mismo insumo —el estándar operativo
escrito— y comparten el mismo principio: cuando no hay evidencia suficiente, el sistema lo
declara en vez de inventarlo.

## Historia

Nació de una generación anterior del proyecto (2026), construida sobre conocimiento
propietario de un cliente. Este repositorio se creó con **historia nueva y limpia,
deliberadamente**: esa historia no debe existir en público. Lo que se publica aquí es la
interfaz y la mecánica, con conocimiento de demostración.

## Licencia

MIT.
