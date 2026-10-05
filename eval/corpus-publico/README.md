# Corpus público

Manuales **ficticios** para medir el motor en el CI sin datos reales: el cliente
(Mercadep), las secciones, las marcas, las medidas y los porcentajes son inventados.

| Archivo | Qué es |
|---|---|
| `generar.mjs` | Genera los manuales de HTML a PDF (`npm run corpus-publico`). Los HTML y PDF no se editan a mano. |
| `manuales.json` | Qué PDF se cargan y con qué nombre. El primero es el manual demo de `docs/`. |
| `bateria.json` | 93 preguntas: 68 de dato, 10 de seguimiento, 15 «no está» o trampa. Mismo formato que las baterías privadas (`q, tipo, cat, m\|d, p, k, minK?, turnos?`). |
| `linea-base.json` | Lo que contesta hoy la app, pregunta por pregunta. La escribe `node lab/gate.mjs --actualizar`. |

Las trampas están puestas a propósito, porque son las que encontró el benchmark con
manuales reales:

- títulos de dos renglones
- tablas
- check lists que repiten reglas de otras láminas
- rótulos en mayúsculas sin ninguna frase
- el mismo título en dos secciones con cifras distintas («MESA DE ENTRADA»: 30 cm en
  Casual y 45 cm en Hogar)

Si se cambia la batería, cambia su huella y el gate pide volver a escribir la línea base.
Una batería pública sirve para atrapar regresiones; el acierto real se mide con preguntas
que el motor no vio.
