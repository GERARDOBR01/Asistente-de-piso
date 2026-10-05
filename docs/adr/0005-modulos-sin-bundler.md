# ADR 0005 · Partir `index.html` en módulos ES, sin bundler

- **Estado:** aceptada (5-oct-2026). Pasos 1 a 5 hechos, y el motor ya contesta en Node; los siguientes van en el orden de abajo.

## Contexto

Toda la app vivía en un `index.html` de 12,080 líneas: los estilos, el marcado y un solo
`<script>` clásico con unas 400 funciones. Eso tuvo sentido mientras era un demo (ver el
README, «Por qué todo vive en un solo `index.html`»), pero ya cobra tres precios:

- **El motor no se puede usar fuera del navegador.** El laboratorio mide a través de una
  pestaña abierta y un puente, y no hay forma de servir la búsqueda por MCP ni de probarla con
  pruebas de propiedades en Node.
- **Ninguna frontera.** La búsqueda, la puerta de evidencia, la verificación y la pantalla
  comparten globales mutables. Un cambio en una puede romper otra lejana, y solo el arnés lo
  nota, si lo nota.
- **Sin tipos.** Las estructuras que cruzan el motor (fragmento, resultado, volcado) solo
  están documentadas en comentarios.

## Decisión

Módulos ES nativos que GitHub Pages sirve tal cual. **No hay bundler ni paso de compilación:**
lo que está en el repo es lo que corre.

1. **El corte es gradual y por capas, nunca de golpe.**
   - `src/main.js` (`type="module"`) importa lo que ya es módulo y lo publica en `globalThis`.
   - `src/app.js` es el resto, un script clásico con `defer`, así que sus funciones siguen
     siendo globales.
   - Los módulos y los scripts con `defer` corren en el orden del documento, así que `app.js`
     encuentra las piezas listas.
   - Cada paso mueve una capa de `app.js` a `src/` y quita esos nombres de la capa de
     compatibilidad.
2. **Red de seguridad, golden master.** Antes de mover nada se vuelca lo que hace el motor con
   cada pregunta (`lab/volcar.mjs`), y después de cada paso tiene que salir **idéntico** campo
   por campo (`lab/identico.mjs`): sección, consulta, ranking con puntajes, contexto del
   modelo, tarjetas y avisos.
   - Se corre con el corpus público y con los manuales reales (fuera del repo).
   - Se suman el arnés, el agente simulado y el eval-gate.
3. **Frontera del motor.** `src/motor/**` y la defensa de inyección no usan APIs del navegador.
   Lo revisa `lab/motor.test.mjs`, y por eso se importan desde Node.
4. **Tipos sin compilar.** `tsc --checkJs` en modo estricto (`npm run tipos`, en el CI) con
   JSDoc en los `.js` y los tipos compartidos en `src/tipos.d.ts`. Empieza por el motor y
   crece con cada paso.
5. **Sin señal sigue igual.**
   - El service worker trata `src/` como la página: primero la red, con tope de 3 s, porque
     un `index.html` nuevo con un `app.js` viejo de la caché no puede pasar.
   - Guarda cada archivo para el modo avión.
   - El arnés falla si un archivo de `src/` no está en su lista.

**Orden** (cada paso es un commit con golden master idéntico):

| Paso | Qué sale de `app.js` | Estado |
|---|---|---|
| 1 | Seguridad (`html`, `inyeccion`) y texto (stopwords, sinónimos, tokenización) | hecho |
| 2 | Estado del corpus en un solo objeto (`src/estado.js`); el arnés usa setters en vez de reasignar globales | hecho |
| 3 | Índice BM25, erratas y fonética, layout del PDF y chunking | hecho |
| 4 | Búsqueda y router de sección | hecho |
| 5 | Puerta de evidencia y su contrato de decisión | hecho |
| 5b | Conversación y respuesta (lo que decide el modo manual y el contexto del modelo), con el historial como parámetro: el motor contesta en Node (`lab/motor-node.mjs`) | hecho |
| 6 | Verificación | |
| 7 | IA (proveedores, prompt, agente), UI, almacenamiento | |
| 8 | Arnés a `src/pruebas/`, y se quita la capa de compatibilidad | |

## Medido (paso 1)

- `index.html` pasa de 12,080 a 1,557 líneas. `src/app.js` tiene 10,236 y baja con cada paso.
- **Golden master:** las 667 preguntas de las 5 baterías con los 14 manuales reales salen
  idénticas, y el corpus público también.
- Arnés 305/305, agente simulado y eval-gate en verde.
- 9 pruebas nuevas en Node: la frontera y propiedades con fast-check (normalización
  idempotente, tokenización estable, neutralización idempotente, ninguna regla sin forma de
  orden se toca, toda orden conocida se quita, el sello no se cierra desde el manual).
- Probado en modo avión en Chrome: la app abre desde la caché con los módulos.

## Medido (paso 2)

- **`src/estado.js`:** un objeto `estado` con `manualSections`, `docChunks`, `docFigures`, `corpus`, `docs` y `bm25`.
  - `alReiniciar`/`reiniciarCaches`: cada caché que depende del corpus se registra junto a su código, en vez de una lista a mano dentro de `rebuildCorpus`.
  - `conEstado`/`montar`: el arnés monta un corpus de prueba y vuelve siempre al de antes, aunque la prueba truene. Antes guardaba y devolvía seis globales a mano, y en la mitad de los casos sin `finally`.
- **Capa de compatibilidad:** en `src/main.js`, los nombres de siempre son accesores de `globalThis` sobre `estado`, así que `app.js` y `eval/` no cambian. No son configurables, así que un `let docs` olvidado en `app.js` da error al cargar en vez de crear un segundo `docs`.
- **Trampa encontrada:** `rebuildCorpus` calcula el vocabulario de la sección activa, así que al salir de una prueba la sección se devuelve antes de rehacer el índice (`conCorpusYSeccion`).
- **Golden master:** 667 preguntas idénticas con los 14 manuales reales.
- Arnés 305/305, agente simulado y eval-gate en verde.
- 27 pruebas en Node: la frontera ya incluye `estado.js`, y hay 4 pruebas nuevas para `conEstado`, la versión asíncrona, las claves ajenas y el orden de las cachés.
- `tsc` estricto con `estado.js` incluido.
- Probado sin señal; ap-v1.7.1.

## Medido (paso 3)

- **Cuatro módulos en `src/motor/`**, sin DOM y con `tsc` estricto:

  | Módulo | Contenido |
  |---|---|
  | `indice.js` | `indexChunk`, `bm25Score`, `reconstruirIndice` |
  | `erratas.js` | trigramas, fonética, la lectura en inglés, `masParecida` y el vocabulario de cada manual |
  | `layout.js` | de los trozos de pdf.js a líneas, bloques y títulos |
  | `fragmentos.js` | `buildChunks` |

  `app.js` baja de 10,230 a 9,630 líneas. `rebuildCorpus` queda en dos líneas: el índice y el vocabulario de la sección activa, que depende de la pantalla.
- **Las cachés de las erratas son privadas del módulo** y se registran con `alReiniciar`. Nadie de fuera las leía; se revisó antes de mover nada.
- **La sección activa pasa a `estado.manualActivo`**: es el alcance de la consulta y el motor la lee de ahí. `appState.manualActivo` queda como accesor, así que sus 79 usos no cambian.
  - No se publica como global suelta, porque `app.js` ya tiene una función `seccionActiva()`.
  - `conCorpusYSeccion` queda en una línea: `montar` devuelve la sección junto con el corpus y antes de rehacer el índice.
- **`layout.js` usaba `pdfjsLib.Util.transform`**, una global del navegador que el análisis de dependencias no veía y que `tsc` encontró. Ahora usa `multiplicar`, con la misma fórmula y el mismo orden de operaciones. Comparada en el navegador contra pdf.js 3.11.174 con 10,000 matrices al azar: **0 diferencias bit a bit**. El layout ya corre en Node sin pdf.js.
- **Golden master:** las 667 preguntas idénticas con los 14 manuales reales. Esto incluye la lectura de los PDF: cada volcado vuelve a leerlos con el layout nuevo.
- Arnés 305/305, agente simulado, eval-gate idéntico y modo avión. ap-v1.7.2.
- **32 pruebas en Node.** Las nuevas arman el índice sin navegador:
  - BM25 ordena;
  - las erratas se corrigen hacia la sección activa y su caché se olvida al cambiar el corpus;
  - ningún fragmento pasa de `CHUNK_MAX` ni cruza de página (fast-check);
  - dos columnas no se funden;
  - `multiplicar` es la composición afín.

## Medido (paso 4)

- **Cuatro módulos más en `src/motor/`**, sin DOM y con `tsc` estricto:

  | Módulo | Contenido |
  |---|---|
  | `secciones.js` | de qué sección es cada manual (`nombreDeSeccion`) y qué sección nombra la pregunta |
  | `busqueda.js` | `weightedTerms`, `retrieve`, `packChunks`, `mezclarPorPartes`, `getPdfContext` |
  | `puerta.js` | `exigenciaDeSolidez`, `filtroSolidez`, `nivelDeEvidencia` (en el paso 5 pasó a llamarse `solidez.js`) |
  | `ruta.js` | evidencia por sección, `otraSeccionNombrada`, `rutaPorEvidencia` |

  `variantes` e `infinitivos` (morfología) pasan a `texto.js`. `app.js` baja de 9,620 a 8,540 líneas. No hay ciclos entre módulos: texto → secciones → puerta → búsqueda → ruta.
- **La ruta se separa de la conversación.** `decidirSeccion` y `enrutarSeccion` se quedan en `app.js` con lo que depende de la pantalla y del historial: la sección forzada por un botón, los saludos, la caché por turno. La decisión con evidencia pasa a `ruta.js`, y lo que necesita de la conversación (la consulta ampliada, la sección del turno anterior, si es elipsis) llega como argumento. La consulta ampliada se pide solo si hace falta, igual que antes, porque `consultaDeBusqueda` marca si amplió.
- **«Aprende del piso» entra por inyección.** La búsqueda usaba directamente las palabras y los atajos aprendidos, que viven en el almacenamiento del teléfono. Ahora `app.js` se los pasa con `usarAprendido`; en Node no hay nada aprendido y la búsqueda es la del manual.
- **`ultimosFragmentos` pasa a `estado`**: lo escribe `packChunks` y lo leen la verificación, las láminas y `lab/volcar.mjs`, que lo siguen viendo con su nombre.
- **`tsc` encontró una caché sin declarar** (`secPorDoc`, que estaba en un `var` de la parte de aprendizaje). En un módulo, que es estricto, habría tronado la primera vez que «Aprende del piso» buscara la sección de un manual (`secDe`).
- **El script de extracción se niega a escribir** si un nombre exportado sigue declarado en `app.js` (un `function` clásico pisaría en silencio al del módulo) o si dos módulos exportan el mismo nombre.
- **Golden master:** las 667 preguntas idénticas con los 14 manuales reales.
- Arnés 305/305, agente simulado, eval-gate idéntico (arregla 0, rompe 0) y modo avión. ap-v1.7.3.
- **38 pruebas en Node.** Las 6 nuevas buscan y enrutan sin navegador, sobre dos secciones ficticias con la misma plantilla:
  - con `doc`, `retrieve` nunca devuelve fragmentos de otro manual (fast-check);
  - `packChunks` no pasa del presupuesto (fast-check);
  - la pregunta que nombra la sección va a esa, y sin nombrarla va a la que tiene evidencia;
  - con una sección activa, solo otra sección nombrada la cambia;
  - un seguimiento se queda en la sección de la conversación;
  - un atajo aprendido reordena, pero no cambia el nivel de evidencia.

  Se comprobó que cazan: con el filtro por manual quitado, o con la sección nombrada ignorada, falla su prueba.

## Medido (paso 5)

- **La puerta en dos capas, sin ciclos.** La búsqueda necesita la solidez para contar lo que exige, y la puerta necesita la búsqueda (`esVerbo`, `weightedTerms`). Así que el `puerta.js` del paso 4 pasa a llamarse `solidez.js`, abajo, y el nuevo `puerta.js` va arriba de la búsqueda:

  | Módulo | Contenido |
  |---|---|
  | `solidez.js` | `exigenciaDeSolidez`, `filtroSolidez`, `nivelDeEvidencia` |
  | `aprendido.js` | `usarAprendido` y cómo preguntar lo que enseñó el piso; lo usan la búsqueda y la puerta |
  | `puerta.js` | `terminosAusentes` (la palabra o el par que la sección no tiene, y de quién es), `avisoDeCuenta` (el «¿cuántos?» sin cifra), `esOperacionDeTienda`, los avisos del modo manual y el contrato de decisión |

  Orden: texto → secciones → solidez → aprendido → búsqueda → puerta → ruta. `app.js` baja de 8,540 a 8,250 líneas.
- **Dos bloques en línea del modo manual pasan a funciones puras:** el texto del aviso de palabras ausentes (`avisoDeAusentes`) y «lo encontré como…» (`palabrasPorParecidas`).
- **El contrato de decisión** (`contratoDeDecision`, `versionPolitica: 'puerta-1'`): `{consultaResuelta, alcance, estado, evidencia[], cubiertas[], faltan[], razones[], versionPolitica}`, con `estado` en `respaldada | parcial | aclarar | sin_evidencia`.
  - Es la misma forma con API key (`buildContext` lo devuelve en `decision`) y sin ella (`ultimaDecision`). Hasta ahora la decisión vivía en banderas sueltas y cada consumidor la reconstruía a su manera.
  - **No cambia ninguna respuesta:** describe la que ya se daba. `lab/volcar.mjs` lo guarda en cada pregunta (`decision`, `decisionManual`), fuera de los campos del golden master.
  - **Cuadra con lo de antes:** en las 651 preguntas que se hacen (16 de las cruzadas son de un manual que no está cargado), sin tarjetas ⇔ `sin_evidencia` o `aclarar`, todo aviso de palabra ausente o de «lo encontré como» ⇔ `parcial`, la evidencia es exactamente lo que entró al contexto. Cero discrepancias.
  - **Lo que dice hoy, en modo manual** (es la línea base de la Fase 3, en sus propios términos):

    | | respaldada | parcial | aclarar | sin_evidencia |
    |---|---|---|---|---|
    | dato (268) | 242 | 15 | 1 | 10 |
    | «no está» (366) | 3 | 72 | 71 | 220 |
    | trampa (17) | 1 | 1 | 0 | 15 |

    Las 3 «no está» respaldadas son las que la puerta deja pasar sin ningún aviso; las 26 de dato que no salen respaldadas son las que la Fase 3 tiene que recuperar sin mover las otras.
- **Golden master:** las 667 preguntas idénticas con los 14 manuales reales, tanto con la extracción sola como con el contrato conectado.
- Arnés 305/305, agente simulado, eval-gate idéntico (arregla 0, rompe 0) y modo avión con los 17 archivos. ap-v1.7.4.
- **43 pruebas en Node.** Las 5 nuevas arman la decisión sin navegador: respaldada con lo que cubre, parcial por una palabra que no es de ningún manual y por una que es de otra sección (con su dueño), aclarar y sin evidencia, y una propiedad con fast-check (respaldada nunca lleva palabras que falten ni evidencia vacía; lo demás siempre dice por qué). Comprobadas con mutaciones; una de ellas no la cazaba ninguna prueba y por eso se agregó la de la palabra de otra sección.

## Medido (motor en Node)

Para que `lab/motor-node.mjs` contestara igual que el teléfono faltaba lo que todavía leía el historial global de `app.js`: el seguimiento, la ruta de sección y lo que deciden el modo manual y el contexto del modelo. Salió a dos módulos encima de `ruta.js`:

| Módulo | Contenido |
|---|---|
| `conversacion.js` | si la pregunta es del tema (`assessQuestionScope`, saludo, quién hizo la app, preguntas sobre la app), el vocabulario de la sección, el seguimiento (`consultaAmpliada`) y la ruta (`rutaDeLaPregunta`, `seccionDeLaPregunta`). El historial entra como parámetro |
| `respuesta.js` | qué tarjetas enseña el modo manual y con qué aviso (`respuestaSinModelo`), qué recibe el modelo (`contextoParaModelo`, con sus presupuestos y avisos) y el contrato de decisión de cada uno |

- `app.js` se queda con envoltorios que le pasan `history`, el proveedor y el contexto del asesor, y con lo que pinta. Baja de 8,250 a 7,720 líneas.
- **El vocabulario de la sección ya no se rehace a mano.** Antes había nueve llamadas a `refrescarVocabularioManual` repartidas por la app (al cargar, al cambiar de sección, en la medición, en el arnés), y una que faltara dejaba el vocabulario de otra sección. Ahora se calcula cuando hace falta y se olvida con el corpus o al cambiar de sección.
- **`lab/motor-node.mjs`** carga el corpus que deja `volcar.mjs --corpus` (ahora con los fragmentos completos y el manual interno, que también cuenta para BM25) y contesta cada pregunta con los mismos módulos y los mismos campos que el volcado del navegador.
  - **Paridad:** 667/667 preguntas idénticas contra el navegador con los 14 manuales reales, contratos de decisión incluidos. Salió idéntica antes de tocar `app.js`, con los módulos nuevos contra la app vieja, y otra vez después.
  - **Tarda 7 s** en lugar de los ~5 min del navegador (casi todo ese tiempo era leer los PDF).
  - **En el CI:** el eval-gate corre `motor-node` sobre el mismo corpus público y falla si no da lo mismo que el navegador. Si los barridos de la Fase 3 midieran otra cosa que la app, no valdrían.
- **Golden master** idéntico (667), arnés 305/305, agente simulado, eval-gate idéntico (arregla 0, rompe 0) y modo avión con los 19 archivos. ap-v1.7.5.
- **47 pruebas en Node.** Las 4 nuevas:
  - el seguimiento amplía la consulta y una pregunta completa no;
  - el vocabulario sigue a la sección activa sin rehacerlo;
  - una conversación de dos turnos en Node sigue en su sección;
  - una propiedad con fast-check: con tarjetas, la decisión es `respaldada` o `parcial`; sin ellas, `sin_evidencia` o `aclarar`; y ni las tarjetas ni el contexto traen otra sección que la activa.

  Comprobadas con mutaciones: el vocabulario que no sigue a la sección, la sección nombrada que no quita las tarjetas, el seguimiento que no amplía y el contexto que ignora la sección. Las cuatro las caza alguna prueba. Y si la app se aparta del motor (una tarjeta de menos en el navegador), el gate no pasa.
- **Lo que la prueba de dos turnos deja escrito:** «¿y las copas?» después de una pregunta de la cava sigue en la cava, pero la consulta es las dos preguntas pegadas y la primera tarjeta sigue siendo la de las botellas. Sustituir el objeto es de la Fase 3.

### Aislamiento: ¿cargar otras secciones cambia la tuya?

Con la sección elegida, la búsqueda solo mira ese manual, pero BM25 pesa cada palabra con el IDF de todo lo cargado. `lab/aislamiento.mjs` lo mide con `motor-node` sobre las 550 preguntas con sección de las baterías de desarrollo:

| Contra los 14 con IDF global | | cambian tarjetas | cambia la 1.ª | cambia la decisión | bien → mal | mal → bien |
|---|---|---|---|---|---|---|
| IDF de su manual (los 14 cargados) | dato (177) | 41 (23 %) | 7 (4 %) | 1 (0.6 %) | 2 | 0 |
| | «no está» (373) | 22 (6 %) | 6 (2 %) | 0 | 0 | 0 |
| Solo su manual cargado | dato (177) | 49 (28 %) | 11 (6 %) | 6 (3 %) | 2 | 2 |
| | «no está» (373) | 41 (11 %) | 25 (7 %) | 74 (20 %) | 16 | 0 |

- **El IDF global mueve el orden, casi nunca la decisión.** Cambia qué tarjetas salen en una de cada cuatro preguntas de dato, la primera en 4 % y la decisión en una sola.
- **Pasar a IDF por manual no se justifica:** rompe 2 preguntas y no arregla ninguna. Se queda el global.
- **Los manuales ajenos ayudan a decir «no está»:** con su manual solo, 16 «no está» que hoy salen bien dejan de salir. Sin los otros manuales ya no se puede avisar «eso es de otra sección», y la decisión cambia en una de cada cinco. Eso es lo que debe cambiar, no una fuga.
- Así que la invariante no es «idéntico»: es que la decisión casi no se mueva. Se vuelve a medir con cada cambio de la Fase 3, para que la puerta no se vuelva más sensible a lo que haya cargado.

## Consecuencias

- **A favor:**
  - El motor se puede importar en Node. Lo que viene detrás:
    - `lab/motor-node.mjs`, que mide en segundos sin navegador (hecho: ver «Motor en Node»)
    - el servidor MCP
    - las pruebas de propiedades sobre la búsqueda y la puerta
  - Cada capa que sale gana tipos y pruebas propias.
- **En contra:**
  - Mientras dure la migración hay dos formas de declarar (módulo y global) y una capa de
    compatibilidad que hay que acordarse de quitar.
  - `git blame` de `src/app.js` empieza aquí; para ver de dónde viene una línea, usar
    `git blame -C -C`.
- **Riesgo con `python -m http.server`:** en algunos Windows sirve los `.js` como
  `text/plain`, y entonces el navegador no carga el módulo. En esta PC da `text/javascript`.
  Los servidores de `eval/` ya fijan el tipo.
