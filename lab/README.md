# Laboratorio de búsqueda

Aquí se mide la búsqueda de la app fuera del navegador, con intervalos de confianza, para
decidir con números qué entra (embeddings, fusión, abstención) y qué no.

Los datos (los manuales y sus volcados) **nunca entran al repo**. Este directorio solo trae
código y pruebas.

## Cómo funciona

1. **`volcar.mjs`**: la app real (una pestaña abierta con los manuales) busca cada pregunta y
   se guarda, por pregunta, el ranking completo de `retrieve()`, lo que recibiría el modelo
   (`buildContext`) y las tarjetas del modo manual. La línea base es el motor de verdad, no una
   copia. Cada pregunta parte de cero: sección, historial y ruta elegida en un empate.
2. **`correr.mjs`**: con esos volcados, mide cada configuración de `sistemas.mjs` con:
   - **Hit@1/3/5/10, MRR@10 y nDCG@10**, con relevancia graduada: 2 = página esperada y
     dato, 1 = página esperada sin el dato.
   - **De punta a punta**: lo que enseña la app (acierto, dato en la 1.ª tarjeta, dato en el
     contexto del modelo), con el mismo calificador que `eval/modo-ia.mjs`.
   - **Abstención**: cuántas «no está» se dijeron bien y cuántas enseñaron tarjetas sin
     respaldo.
3. **`estadistica.mjs`**:
   - IC al 95 % por bootstrap de preguntas (10 000 remuestreos, semilla fija).
   - Wilson para las proporciones.
   - Entre dos configuraciones: la diferencia pareada con su IC y **McNemar exacta**
     («arregla N, rompe M, p = …»).
4. **`calificador.mjs`**: el único calificador, compartido con `eval/modo-ia.mjs`.
5. **`gate.mjs`**: la compuerta del CI. Vuelca la app con el corpus público
   (`eval/corpus-publico/`, manuales ficticios) y falla si una pregunta que estaba bien pasa
   a mal respecto a `eval/corpus-publico/linea-base.json`. Ver el README, «El eval-gate».
   También comprueba que `motor-node.mjs` conteste igual que el navegador.
6. **`motor-node.mjs`**: el mismo motor (`src/motor/`) importado en Node, sin navegador.
   Carga el `corpus.json` que deja `volcar.mjs --corpus` y escribe el mismo volcado que
   `volcar.mjs`, en segundos. Es con lo que se barren las ideas de la puerta; que dé lo mismo
   que la app se comprueba con `identico.mjs`, y el gate lo hace en cada PR.
7. **`aislamiento.mjs`**: cuánto cambia la respuesta de una sección por tener cargadas las
   demás (el IDF de BM25 es de todo el corpus). Compara los catorce con IDF global contra el
   IDF de su manual y contra su manual solo.

## Uso

```sh
# con la app servida en 9601, el driver del navegador y el puente en 9701
node lab/volcar.mjs --corpus ../eval-manuales-reales/lab
# sin puente, con su propio navegador (lo que usa el CI con el corpus público)
node lab/volcar.mjs --local eval/corpus-publico/manuales.json --corpus /tmp/pub --preguntas eval/corpus-publico/bateria.json --salida /tmp/pub
node lab/gate.mjs [--actualizar]
node lab/volcar.mjs --preguntas ../eval-manuales-reales/bateria-piso-2026-10.json --salida ../eval-manuales-reales/lab
node lab/correr.mjs --datos ../eval-manuales-reales/lab --informe ../eval-manuales-reales/lab/informe.md
# sin navegador: el motor en Node sobre el corpus ya extraído, y su paridad con la app
node lab/motor-node.mjs --corpus ../eval-manuales-reales/lab --preguntas <json>[,<json>…] --salida ../eval-manuales-reales/lab --etiqueta node
node lab/identico.mjs ../eval-manuales-reales/lab --antes base --despues node
node lab/aislamiento.mjs --corpus ../eval-manuales-reales/lab --preguntas <json>[,<json>…]
node --test "lab/*.test.mjs"
```

`volcar.mjs` y `motor-node.mjs` se niegan a escribir dentro del repo, salvo con el corpus público.
