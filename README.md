# Asistente de piso — demo

Asistente conversacional de una sola página para el personal de piso de una tienda:
responde dudas de montaje y estándar de exhibición desde el celular, parado frente al
mueble, **sin instalar nada y sin cuenta**.

> **Demo con conocimiento 100 % sintético.** El cliente (*Mercadep*), las marcas
> (`MarcaDemoA`–`MarcaDemoL`), los mundos, los porcentajes de piso y los números de manual
> son inventados. Ningún manual, marca, medida ni dato operativo de un cliente real vive en
> este repositorio ni en su historial.

**[▶ Abrir el demo](https://gerardobr01.github.io/asistente-de-piso/)**

## Qué resuelve

El manual de montaje de una campaña son decenas de páginas en PDF. Nadie las carga al piso,
así que las dudas se resuelven preguntando —si hay a quién— o adivinando. Este asistente
pone ese conocimiento a un toque de distancia, en el lenguaje con el que realmente se
pregunta: *"¿a qué altura va el sensor?"*, no *"criterios de colocación de dispositivo EAS"*.

## Dos modos, y el de abajo es el interesante

| | **Modo manual** (sin API key) | **Modo razonado** (con API key) |
|---|---|---|
| Qué hace | Busca en el manual y entrega las secciones que coinciden, **tal cual** | Responde interpretando, en 6 etapas: intención → expansión → retrieval → razonamiento → certeza → respuesta |
| Dónde corre | Entero en tu dispositivo | El retrieval en tu dispositivo; la interpretación en el proveedor que elijas |
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
- **Retrieval léxico local**: se extraen las palabras de la pregunta, se expanden con sus
  sinónimos y se puntúan las secciones del manual por coincidencia, con peso extra para las
  reglas `[MANDATORY]` y los conflictos documentados entre manuales.
- **Conflictos documentados como feature.** Cuando dos manuales se contradicen (el entallado
  lleva 4, 5 o 6 piezas según cuál leas), el sistema tiene prohibido responder "el manual no
  especifica": cita el conflicto y la regla general.

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
- **Sin telemetría, sin analítica, sin cuentas.** Nada se envía a ningún servidor mío,
  porque no hay servidor mío.

## Límites conocidos

- **El retrieval no lematiza.** Busca coincidencias de texto normalizado, así que
  "colores" no encuentra "COLORIZACIÓN" por sí solo — depende del diccionario de sinónimos,
  que se llena a mano y por lo tanto está incompleto.
- **La puntuación general premia `[MANDATORY]` aunque no haya coincidencia de palabras.**
  Sirve cuando el resultado lo va a leer un modelo, que sabe descartar lo que no viene al
  caso; mentiría en el modo manual. Por eso ahí se exige al menos un acierto real de
  término antes de mostrar cualquier sección.
- **El conocimiento es sintético**, así que las respuestas son coherentes pero no son el
  estándar de nadie. Sirve para ver la mecánica, no para montar una tienda.

## Lo que encontré al prepararlo para publicar

Tres defectos que el uso normal no muestra. Los dejo escritos porque enseñar dónde falla un
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
