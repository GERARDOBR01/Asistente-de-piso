# ADR 0005 · Partir `index.html` en módulos ES, sin bundler

- **Estado:** aceptada (5-oct-2026). Pasos 1 y 2 hechos; los siguientes van en el orden de abajo.

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
| 3 | Índice BM25, erratas y fonética, layout del PDF y chunking | |
| 4 | Búsqueda y router de sección | |
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
