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

## Dónde estamos (5-oct-2026)

| Capa | Estado |
|---|---|
| Lectura del PDF | Buena en texto y tablas simples (incluidos títulos de dos renglones). Débil en planogramas y datos que solo están en imagen: ahí depende de la ficha de IA |
| Búsqueda | Con 14 manuales reales: Hit@1 88 % y Hit@3 95 % en la batería de desarrollo; Hit@1 73 % en una batería nueva. Medido en `lab/` con IC |
| Puerta de evidencia | **El cuello de botella.** Con preguntas nuevas, el modo manual acierta 58–70 %, no el 95 % de la batería con la que se afinó. La mayoría de las fallas tienen la lámina buena arriba y la esconde el filtro de solidez o un aviso falso de palabra ausente |
| Sección | La pregunta la elige; empate resuelto con botones |
| Verificación | Cifras, nombres, páginas, citas y atadura; certeza baja a MEDIA si algo no se comprueba |
| Seguridad | Instrucciones escondidas en un PDF: spotlighting, neutralización, aviso al cargar y enlaces con datos como texto (ADR 0004) |
| Aprende del piso | Hecho. **Sin medir su efecto todavía** |
| Pruebas | Arnés 305, agente simulado, 21 pruebas en Node (laboratorio, frontera del motor y propiedades con fast-check) y `tsc --checkJs`, todo en el CI |
| eval-gate | Corpus público ficticio (4 manuales, 93 preguntas): el CI falla si una pregunta pasa de bien a mal. Línea base 68/78 datos y 14/15 «no está» |
| Código | Módulos ES sin bundler (ADR 0005), pasos 1 a 5 de 8: seguridad, texto, el estado del corpus, el índice (BM25, erratas, layout del PDF, fragmentos), la búsqueda, la ruta de sección, la puerta de evidencia (con su contrato de decisión) y lo que decide cada respuesta fuera de `index.html`, con golden master idéntico sobre 667 preguntas reales en cada paso. El motor contesta en Node igual que en el navegador (`lab/motor-node.mjs`) |

Las decisiones están en `docs/adr/`:
- **0002, búsqueda híbrida:** medida, con una mejora chica que nunca rompe una pregunta.
- **0003, abstención conformal:** la garantía se cumple, pero la mejora no se confirmó. Está en revisión.
- **0004, prompt injection.**
- **0005, módulos sin bundler:** cómo se parte `index.html` y en qué orden.

## Ahora: tres niveles (oct-2026, el modelo local aparcado)

Lo que **se debe** mejorar va antes que lo que **se podría** mejorar. Nada del nivel 3 entra al
motor mientras el nivel 1 no cumpla su criterio de salida.

### Nivel 1 · Debe: los pilares

1. **Un instrumento confiable.**
   - Hecho: eval-gate en el CI y el calificador del modo IA, que ya no acepta el dato negado
     ni la abstención que inventa una medida.
   - Falta: Gerardo revisa la batería de confirmación 2.
2. **El motor separado y medible.**
   - Terminar de partir `app.js` hasta la puerta (ADR 0005, pasos 2 a 5), con el golden master
     idéntico en cada paso.
   - Hecho: `lab/motor-node.mjs`. El motor importado en Node contesta igual que el navegador
     (667/667, y el gate lo comprueba en cada PR) en 7 s en vez de ~5 min.
   - Hecho: medición de aislamiento (`lab/aislamiento.mjs`). El IDF global de BM25 mueve el
     orden de las tarjetas pero casi nunca la decisión (1 de 177 preguntas de dato). Pasar a
     IDF por manual rompe 2 y no arregla ninguna: se queda el global, y se vuelve a medir con
     cada cambio de la Fase 3.
3. **Puerta de evidencia sin modelo**, con reglas medidas:
   - solidez adaptativa: una palabra rara o en el título basta. Medido, ni la rareza, ni el
     despegue, ni el título separan las buenas de las que no están. **Hecho** en su lugar: la
     coincidencia floja del modo manual (`coincidenciaFloja`), con sección, cubriendo las
     palabras que el manual sí tiene y sin palabras ajenas a todos los manuales; sale como
     `parcial` con nota
   - avisos de palabra ausente más finos. **Hecho** en parte: la raíz cuenta para las formas de
     la propia palabra (con su conjugación y diptongo), no para sus sinónimos
   - Medido con `lab/comparar.mjs` en desarrollo: arregla 10 (4 de dato y 6 «no está» de las
     cruzadas), rompe 0; el gate pasa de 68 a 74 de 78
   - una sola decisión con estado: respaldada, parcial, aclarar o sin evidencia
   - seguimiento que sustituye el objeto («¿y las sandalias?»), en vez de pegar las dos preguntas
   - fragmento hermano: el patrón de ventana o fusión padre-hijo, acotado a la misma página y región
   - rótulos en mayúsculas que hoy se pierden al leer el PDF

   Desarrollo con las tres baterías de antes. Confirmación con una batería nueva de 57
   preguntas sobre páginas que nadie había usado, revisada por Gerardo y corrida una sola vez.

**Criterio de salida**, fijado antes de esa corrida:
- 0 preguntas rotas en desarrollo y en el gate;
- los «no está» no empeoran;
- mejora pareada en la confirmación con el IC 95 % por encima de cero;
- el número tal cual en el ADR 0006.

Si no se cumple, se itera en desarrollo, no en confirmación.

### Nivel 2 · Debería: la vitrina

- **Trazas con el estándar OpenTelemetry GenAI** y un «¿por qué esta respuesta?» en la app.
- **Servidor MCP del motor.**
- Terminar los pasos 6 a 8 de módulos.
- Medir «Aprende del piso» (ver abajo).

### Nivel 3 · Podría: exploración

Cada idea entra como experimento del laboratorio, con su hipótesis y su criterio escritos antes,
y con manuales ficticios. No toca el motor hasta que gane.
1. Otro lector de PDF (Docling) contra el actual, en tablas, rótulos y columnas.
2. El paquete del manual con vigencia y comparación entre campañas: qué reglas entran, cuáles
   salen y cuáles cambian.
3. Reglas estructuradas revisadas por una persona (objeto, medida, condición y fuente).
4. Con key: reordenar con Gemini, citas en JSON y red-team con promptfoo.
5. Buscar láminas por imagen (ColPali) y el modelo local aparcado.
6. Tareas en piso y revisión con foto.

## Aparcado: la puerta con modelo local

1. **Retomar el juez de la puerta con EmbeddingGemma q4** (197 MB).
   - Juez: el coseno entre la pregunta y la lámina que eligió la búsqueda por palabras.
   - En el laboratorio separa con AUC 0.987, contra 0.892 de e5-small.
   - El trabajo está en la rama `busqueda-hibrida`, **aparcada**: el modelo local está parado hasta que Gerardo lo retome.
2. **Calibrar τ con la app en vivo** (`lab/calibrar.mjs`) y confirmar con una batería nueva, corrida una sola vez. Las tres baterías actuales ya se vieron y cuentan como desarrollo.
3. **Medir el tiempo de vectorizar en el teléfono**, con WebGPU y con WASM.
4. **Probar la defensa del ADR 0004 con un modelo real**, usando un PDF ficticio malicioso. Necesita key, así que se hace con manuales ficticios.

## Después

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

- «Paquete del manual» y vigencia: ahora en el nivel 3 de «Ahora».
- Lectura de planogramas y de datos que solo están en imagen.

## Más adelante

- **Backend mínimo**, cuando haya equipo o tienda piloto: compartir fichas, vocabulario y
  tablero entre teléfonos, y guardar la key fuera de ellos. Los manuales del cliente saldrían del
  teléfono: es una decisión del cliente, no técnica.
