# ADR 0003 · Abstención conformal: rescatar por significado con garantía

- **Estado:** aceptada en el laboratorio (4-oct-2026). Falta integrarla en la app.
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
