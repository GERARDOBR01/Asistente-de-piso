# ADR 0002 · Búsqueda híbrida: BM25 + embeddings, con fusión convexa

- **Estado:** aceptada para el ranking (4-oct-2026). Falta integrarla en la app y medirla de
  punta a punta.
- **Contexto medido en:** 14 manuales reales de una cadena departamental (995 fragmentos).
  Los manuales, las baterías y los resultados por pregunta viven fuera del repo; aquí solo van
  agregados.

## Contexto

La búsqueda era solo léxica: BM25 más un diccionario de sinónimos, erratas y morfología hecho
a mano. Con la batería con la que se afinó acertaba 105 de 110 en el modo manual. Antes de
decidir nada se escribió una **batería de prueba nueva y congelada**: 64 preguntas, 56 de dato
y 8 «no está» o trampa, con su hash guardado antes de medir ningún embedding. Con ella el modo
manual baja a **39/56**, y el Hit@1 del ranking de 88 % a 73 %. El motor estaba sobreajustado a
sus propias preguntas.

## Opciones medidas

Todas con el mismo alcance que la app: la sección la sigue decidiendo el código, y el
embedding solo ordena dentro de ella. Intervalos al 95 % por bootstrap pareado de preguntas y
McNemar exacta.

| Opción | Set de prueba (nuevo): Hit@1 | Hit@3 | MRR@10 |
|---|---|---|---|
| Léxico (la app de hoy) | 73.2 | 87.5 | 81.3 |
| Solo denso, multilingual-e5-small | 62.5–69.6 | 80.4–89.3 | 73.7–79.4 |
| Solo denso, EmbeddingGemma-300M | 73.2 | 91.1 | 81.6 |
| RRF (k = 60), e5-small | 75.0 | 87.5 | 83.5 |
| **Mezcla convexa, e5-small, w = 0.6** | **78.6** | **91.1** | **85.8** |

- El denso solo **pierde** en el set de desarrollo: e5-small rompe 20 preguntas en Hit@1 y
  arregla 7 (p = 0.02). Reemplazar BM25 habría sido un error.
- El contexto determinista pegado a cada fragmento (sección · lámina · página: *Contextual
  Retrieval* sin modelo) mejora mucho al denso solo (Hit@1 de 62.5 a 69.6), pero **no** a la
  mezcla. En la mezcla esa información ya la aporta BM25.
- paraphrase-multilingual-MiniLM queda muy por debajo, y e5-base por debajo de e5-small.

## Decisión

**Mezcla convexa:** puntaje léxico normalizado al mejor de la pregunta, más 0.6 × coseno
normalizado (min-max dentro del alcance), con `multilingual-e5-small` q8 sobre el texto crudo
del fragmento.

- **El peso y la variante se eligieron solo con los sets de desarrollo**: arregla 7 y rompe 0
  en la batería, arregla 3 y rompe 0 en la de sección nombrada.
- **Se confirmó una sola vez en el set de prueba:** Hit@1 +5.4 (arregla 3, rompe 0), MRR +4.5
  con IC [0.3, 10.0] y Hit@10 de 100 %.
- **Por qué e5-small y no EmbeddingGemma:** con la mezcla rinden casi igual, y e5-small pesa
  113 MB contra 296 MB. Además vectoriza los 995 fragmentos en 41 s contra 270 s en la CPU de
  la PC, y en un teléfono esa diferencia se multiplica.

## Consecuencias

- **El ranking mejora, pero la mayor pérdida está en otra parte.** De las 17 preguntas nuevas
  que falla el modo manual, solo 4 son de orden:
  - 7 tienen la lámina correcta en el puesto 1 o 2 y la esconde el filtro de solidez, que exige
    dos palabras acertadas.
  - 6 traen un aviso falso de «palabra ausente» («revolver», «adelante», «divide»).

  El coseno tiene que entrar también como **señal de evidencia**, calibrada para no abrir la
  puerta a las «no está». Ese es el ADR 0003 (abstención conformal).
- **En la app:**
  - El modelo es una descarga opcional (113 MB), y sin él el comportamiento no cambia.
  - `retrieve` es síncrona: el vector de la pregunta se calcula antes, en los puntos de entrada
    asíncronos, y `retrieve` lo lee de una caché.
  - La CSP necesita `'wasm-unsafe-eval'` y el origen del modelo.
- **El corte relativo `CTX_ALPHA`** opera sobre el puntaje léxico. Con la mezcla hay que volver
  a medir el contexto que llega al modelo.

## Cómo reproducirlo

```sh
node lab/volcar.mjs --corpus <datos> && node lab/volcar.mjs --preguntas <batería> --salida <datos>
node lab/correr.mjs --datos <datos> --conjuntos <batería> --sistemas lexico,mezcla:e5:crudo:0.6
```
