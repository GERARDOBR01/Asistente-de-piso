# ADR 0005 · Partir `index.html` en módulos ES, sin bundler

- **Estado:** aceptada (5-oct-2026). Pasos 1 a 4 hechos; los siguientes van en el orden de abajo.

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
| 5 | Puerta de evidencia | |
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
  | `puerta.js` | `exigenciaDeSolidez`, `filtroSolidez`, `nivelDeEvidencia`: la semilla del paso 5 |
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

## Consecuencias

- **A favor:**
  - El motor se puede importar en Node. Lo que viene detrás:
    - `lab/motor-node.mjs`, que mide en segundos sin navegador
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
