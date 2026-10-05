# ADR 0003 · Abstención conformal: rescatar por significado con garantía

- **Estado:** **en revisión** (5-oct-2026). Está integrada en la app detrás de la búsqueda por
  significado opcional, y la garantía se cumple, pero **la mejora no se confirmó** con una
  batería nueva. Ver «Confirmación», al final.
- **Depende de:** ADR 0002 (búsqueda híbrida con multilingual-e5-small).

## Contexto

Con una batería de prueba nueva (ver ADR 0002), el modo manual falla 17 de 56 preguntas de
dato. Solo 4 son de orden de la búsqueda. Las otras 13 las pierde **la puerta de evidencia**:
- **7:** la lámina correcta está en el puesto 1 o 2 y el filtro de solidez la esconde, porque
  exige dos palabras acertadas.
- **6:** un aviso falso de palabra ausente: «revolver» no está en el manual, pero «no mezcles»
  sí.

La puerta léxica no puede aflojarse a ciegas. Es la que hace que una pregunta de otra sección o
una trampa reciba «no está» en vez de una lámina creíble y equivocada: en 359 preguntas
cruzadas (pregunta de un manual hecha en otro) la app se abstiene en 341.

## Decisión

Un **rescate por significado** que solo actúa donde la app se abstiene:
- **Cuándo actúa:** la app calla o avisa que una palabra no está, y la evidencia densa de la
  pregunta (el coseno del mejor fragmento de la sección, con e5-small) supera un umbral τ.
- **Qué enseña:** las 3 primeras láminas de la búsqueda híbrida, sin el aviso y con la nota
  «encontrado por significado».

Como solo actúa donde la app calló, **nunca quita una respuesta que la app ya daba**. Lo único
que arriesga es contestar una «no está», y eso lo acota τ.

**τ se calibra con predicción conformal dividida.** Se toma n = 287 preguntas «no está» en las
que la app se abstiene y el rescate podría actuar: las cruzadas más las «no está» y trampas de
la batería. Con τ = s₍ₖ₎ y k = ⌈(n+1)(1−α)⌉, una «no está» nueva intercambiable con esas
supera τ con probabilidad ≤ α. No hace falta suponer ninguna distribución.

**α = 0.02**: a lo más 2 de cada 100 preguntas sin respuesta en la sección se cuelan como
respuesta. Es una decisión de política, no de ajuste. Los sets de desarrollo no tienen
positivas que rescatar (la app ya acierta 180 de 188), así que no hay con qué optimizar α ahí.

## Resultados (e5-small, texto crudo, w = 0.6)

| α | «no está» que se cuelan, por manual (validación cruzada) | Prueba: dato | Prueba: «no está» |
|---|---|---|---|
| 0.01 | 2/287 (0.7 %) | 39 → 43 de 56 | 7 → 7 de 8 |
| **0.02** | **5/287 (1.7 %)** | **39 → 45 de 56** | **7 → 7 de 8** |
| 0.05 | 14/287 (4.9 %) | 39 → 45 de 56 | 7 → 7 de 8 |
| 0.10 | 28/287 (9.8 %) | 39 → 46 de 56 | 7 → 5 de 8 |

- **La garantía se cumple.** En la validación cruzada por manual (calibrar con 13, contar en el
  que queda fuera) la tasa empírica queda en α o por debajo en los cuatro casos.
- **Con α = 0.02**, las preguntas nuevas pasan de **70 % a 80 %** sin que se cuele ninguna
  «no está» del set de prueba.
- **Se probaron tres puntajes:** el coseno del mejor fragmento, su margen sobre el décimo, y la
  suma de los dos. El coseno solo rescata más con la misma garantía.

## Límites

- **La garantía vale para preguntas como las de calibración.** Las cruzadas son preguntas de
  piso reales hechas en la sección equivocada. Una trampa de otro tipo («¿cómo pido mis
  vacaciones?») la sigue atrapando la regla de operación de tienda antes de llegar aquí. Hay
  que vigilar la tasa con preguntas reales del Tablero.
- **Solo hay 8 «no está» en el set de prueba.** 0 coladas de 8 tiene un IC de Wilson de hasta
  32 %. La evidencia fuerte de la garantía es la validación cruzada sobre 287.
- **Se calibra por modelo.** Si cambia el modelo de embeddings, τ se vuelve a calibrar.

## Cómo reproducirlo

```sh
node lab/abstencion.mjs --datos <datos> --puntaje cos
node --test "lab/*.test.mjs"     # incluye la garantía en datos simulados
```

## Confirmación (5-oct-2026): la garantía se sostiene, la mejora no

Al llevar el rescate a la app y medirlo en vivo, en el navegador, aparecieron casos que la
simulación no veía. Se agregaron reglas de código:
- **No tapar un aviso de cantidad** («no dice cuántos», «ningún porcentaje»).
- **No rescatar sin una sección decidida.** El mejor coseno entre 995 fragmentos es más alto
  que entre ~70.
- **No rescatar si una palabra ausente es de otro manual.** «¿Qué porcentaje tiene formal?» en
  Ropa interior enseñaba los porcentajes de otros mundos.
- **Exigir al menos una palabra de la pregunta en la lámina.**

Con esas reglas, τ se calibró con **la app en vivo** (`lab/calibrar.mjs`) sobre 383 «no está».
Las reglas bloquean 355 de ellas antes de que el significado opine, y con α = 0.01 queda
τ = 0.859. En validación cruzada por manual se cuelan 3 de 383 (0.8 %).

**Pero esas reglas se ajustaron mirando el set de prueba**, que dejó de ser independiente. Por
eso se escribió una **batería de confirmación nueva** (24 de dato y 8 «no está» o trampa, hash
congelado) y se corrió una sola vez:

| | Sin significado | Con rescate |
|---|---|---|
| Dato correcto | 14/24 | 14/24 |
| «No está» bien dicho | 6/8 | 5/8 |

- **El coseno de e5-small no separa** lo rescatable de lo que no está: los positivos que no se
  rescataron quedan en 0.843, y la «no está» que se coló en 0.866.
- **La regla «palabra de otro manual» bloquea rescates buenos** por palabras comunes («entra»,
  «arriba», «divide»).
- **El hallazgo más importante es el de la línea base.** Con preguntas realmente nuevas el modo
  manual acierta 58 %, no el 95 % de la batería con la que se afinó.

**Decisión pendiente** (con Gerardo):
- dejar solo el ranking híbrido (ADR 0002), que en los cuatro conjuntos nunca rompe una
  pregunta;
- o buscar una señal de evidencia más discriminante (un reranker cruzado o un modelo de
  embeddings más grande) antes de volver a encender el rescate.

## Aparcado (4-oct-2026, noche): dónde se quedó

Por orden de Gerardo, el modelo local queda parado. Lo que se encontró antes de pararlo
(`lab/puerta.mjs`, todas las baterías ya vistas, que por eso son de desarrollo):
- **El problema está en la puerta.** En las abstenciones en las que la lámina correcta era la
  primera de la búsqueda por palabras hay 12 positivas y 162 negativas.
- **Juez:** el coseno entre la pregunta y esa lámina léxica.
- **Separación (AUC):** e5-small 0.892, e5-base 0.944, **EmbeddingGemma-300M 0.991** (q8, 309 MB)
  y 0.987 (q4, 197 MB).
- **Recuperadas dejando pasar 2 de las 162 negativas:** e5-small 4/12, Gemma q8 9/12, Gemma q4
  7/12.

**Siguiente paso, cuando se retome:**
1. Gemma q4 como juez de la puerta, con la lámina léxica.
2. τ conformal con la app en vivo.
3. Una batería de confirmación nueva, corrida una sola vez.
4. Medir en el teléfono cuánto tarda vectorizar.

Mientras tanto, la búsqueda por significado de la app sigue siendo opcional y viene apagada.
