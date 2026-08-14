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
  la misma columna—, no por orden de lectura. Citar mal la sección es peor que no citarla.
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
  tope por página y nada de fragmentos cortados a la mitad: 60% menos contexto, medido
  contra 24 preguntas de respuesta conocida en siete manuales reales sin perder ninguna.
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
  ("pasillos" → "pasillo"), lo justo para que el plural del asesor encuentre el singular del
  manual, pero no entiende morfología: "colores" no encuentra "COLORIZACIÓN" por sí solo —
  depende del diccionario de sinónimos, que se llena a mano y por lo tanto está incompleto.
- **El modo manual puede devolver una coincidencia floja.** Si una lámina contiene por
  casualidad una palabra de la pregunta, la muestra. Probé dos filtros para cortarlo —por
  rareza del término y por puntuación mínima— y **medí los dos sobre los siete manuales
  reales: ninguno funciona**, porque el ruido y las preguntas legítimas se solapan. Lo que
  el modo garantiza no es rechazar lo que no sabe, sino no fingir que lo sabe: entrega el
  fragmento con su página y dice que nadie lo interpretó.
- **Un PDF escaneado no se puede leer.** Si la lámina es una imagen sin capa de texto, el
  sistema lo dice y no lo carga, en vez de fingir que lo entendió. Haría falta OCR.
- **La detección de figuras está calibrada sobre manuales tipo presentación.** El corte
  entre "figura" y "panel de texto" salió de medir un manual real: las figuras quedan por
  debajo de 0.11 de cobertura de texto y los paneles por encima de 0.27. Un documento con
  otra maquetación puede caer en el hueco, y entonces sobran o faltan recortes.
- **La verificación de cifras no distingue entre inventar y razonar.** Comprueba que el
  número esté en el contexto recuperado; si el modelo suma dos cantidades correctas, el
  resultado saldrá marcado aunque esté bien. Prefiero ese falso positivo al silencio.
- **La puntuación general premia `[MANDATORY]` aunque no haya coincidencia de palabras.**
  Sirve cuando el resultado lo va a leer un modelo, que sabe descartar lo que no viene al
  caso; mentiría en el modo manual. Por eso ahí se exige al menos un acierto real de
  término antes de mostrar cualquier sección.
- **La lámina que se muestra puede ser la vecina.** Si en la página citada ninguna figura se
  puede identificar por sección ni por las palabras de la respuesta, se muestran las de esa
  página: son la página correcta, pero no necesariamente *la* imagen que sostiene el dato.
  El pie dice siempre manual, página y sección para que se vea de dónde salió.
- **El recorte de contexto se calibró sobre siete manuales de la misma plantilla.** El corte
  relativo aguantó las 24 preguntas medidas con el doble de margen en el caso más ajustado,
  pero un manual con otra estructura podría necesitar otro número. El día que eso pase, se
  vuelve a medir; el arnés de medición no vive en el repo pero se reconstruye en una tarde.
- **El conocimiento es sintético**, así que las respuestas son coherentes pero no son el
  estándar de nadie. Sirve para ver la mecánica, no para montar una tienda. Con un PDF real
  cargado deja de competir: pasa a referencia secundaria y manda el manual del asesor.

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
