# Hoja de ruta

Asistente de piso es también nuestro laboratorio. Esta hoja dice cómo trabajamos, dónde
estamos y qué sigue, en orden.

## Cómo trabajamos

- **Nada mejora sin número.** Cada cambio se mide contra la corrida anterior con el mismo
  examen: la medición de la app («🧪 Medir con un examen») o, sin teléfono, `eval/banco.mjs`, y
  `eval/comparar.mjs` para ver qué se arregló, qué se rompió y en qué capa siguen las fallas.
- **Un instrumento que no se rompe.** Midiendo no se cambia de modelo, la cuota del día para la
  tanda sin ensuciarla, y cada resultado lleva la versión de la app, la de lectura y el modelo
  que contestó.
- **Se aprenden caminos, nunca respuestas.** La app puede aprender que una palabra del piso lleva
  a una página; el dato siempre sale del manual, con su página.
- **Los manuales reales no entran al repo** (ni sus marcas ni sus cifras): los exámenes y los
  resultados con datos reales viven fuera.

## Dónde estamos (4-oct-2026)

| Capa | Estado |
|---|---|
| Lectura del PDF | Buena en texto y tablas simples (incluidos títulos de dos renglones). Débil en planogramas y datos que solo están en imagen: ahí depende de la ficha de IA |
| Búsqueda | Con 14 manuales reales: Hit@1 88 % y Hit@3 95 % en la batería de desarrollo; Hit@1 73 % en una batería nueva. Medido en `lab/` con IC |
| Puerta de evidencia | **El cuello de botella.** Con preguntas nuevas, el modo manual acierta 58–70 %, no el 95 % de la batería con la que se afinó. La mayoría de las fallas tienen la lámina buena arriba y la esconde el filtro de solidez o un aviso falso de palabra ausente |
| Sección | La pregunta la elige; empate resuelto con botones |
| Verificación | Cifras, nombres, páginas, citas y atadura; certeza baja a MEDIA si algo no se comprueba |
| Seguridad | Instrucciones escondidas en un PDF: spotlighting, neutralización, aviso al cargar y enlaces con datos como texto (ADR 0004) |
| Aprende del piso | Hecho. **Sin medir su efecto todavía** |
| Pruebas | Arnés 305, agente simulado y laboratorio 12, todos en el CI |

Las decisiones están en `docs/adr/`:
- **0002, búsqueda híbrida:** medida, con una mejora chica que nunca rompe una pregunta.
- **0003, abstención conformal:** la garantía se cumple, pero la mejora no se confirmó. Está en revisión.
- **0004, prompt injection.**

## Ahora: la puerta de evidencia

1. **Retomar el juez de la puerta con EmbeddingGemma q4** (197 MB).
   - Juez: el coseno entre la pregunta y la lámina que eligió la búsqueda por palabras.
   - En el laboratorio separa con AUC 0.987, contra 0.892 de e5-small.
   - El trabajo está en la rama `busqueda-hibrida`, **aparcada**: el modelo local está parado hasta que Gerardo lo retome.
2. **Calibrar τ con la app en vivo** (`lab/calibrar.mjs`) y confirmar con una batería nueva, corrida una sola vez. Las tres baterías actuales ya se vieron y cuentan como desarrollo.
3. **Medir el tiempo de vectorizar en el teléfono**, con WebGPU y con WASM.
4. **Probar la defensa del ADR 0004 con un modelo real**, usando un PDF ficticio malicioso. Necesita key, así que se hace con manuales ficticios.

## Después

- **Corpus público:** 2 o 3 manuales ficticios y una batería pública, para que el CI mida la búsqueda (`eval-gate`) sin datos reales.
- **Partir `index.html` en módulos sin bundler:**
  - con golden master (los volcados de `lab/volcar.mjs`)
  - el estado mutable en un solo objeto
  - tipos JSDoc con `tsc --checkJs`
  - pruebas de propiedades
- **La línea base con modelo real**, pendiente de antes:
  - medir el clásico y el agente
  - juntar preguntas reales del Tablero para el examen v2

## Siguiente: medir lo que aprende del piso

Ya está construido (ver el README, «La app aprende del piso»). Lo que falta es probar con
números que suma y no rompe nada:

1. Juntar dos o tres semanas de uso real en el piso y exportar «⬇ Vocabulario del piso».
2. Revisarlo juntos: qué palabras son de verdad del piso y cuáles son ruido.
3. Medir el mismo examen sin y con lo aprendido (`--aprendido` en el banco, o la casilla en la
   app), y comparar con `comparar.mjs`: 0 rotas, y cuántas arregladas.
4. Lo que el banco confirme sube al diccionario base del código para todos los teléfonos.
5. Ajustar los candados con números: cuántas confirmaciones, el bono del atajo y el tope por
   sección.

## Pulido pendiente

- Modo manual: con muchos manuales exige dos palabras y se queda callado en preguntas cortas;
  las conversaciones de seguimiento salen 1/5.
- Quitar de `main` nombres reales que quedaron en comentarios y pruebas antiguas.
- «Paquete del manual»: la ficha revisada una vez y compartida, en vez de una por teléfono.
- Vigencia del manual: detectar temporada y avisar si hay dos versiones de la misma sección.
- Lectura de planogramas y de datos que solo están en imagen.

## Más adelante

- **Backend mínimo**, cuando haya equipo o tienda piloto: compartir fichas, vocabulario y
  tablero entre teléfonos, y guardar la key fuera de ellos. Los manuales del cliente saldrían del
  teléfono: es una decisión del cliente, no técnica.
- **Partir `index.html` en módulos** (sin bundler) cuando entre otra persona al código o cuando
  un cambio empiece a romper cosas lejanas.
