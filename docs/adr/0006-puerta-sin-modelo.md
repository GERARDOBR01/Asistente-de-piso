# ADR 0006 · Puerta de evidencia sin modelo: el criterio de salida de la Fase 3

- **Estado:** propuesta (10-oct-2026). El criterio queda fijado **antes** de la corrida de
  confirmación, que todavía no se hace. Cuando se haga, el número va aquí tal cual, salga como
  salga.

## Contexto

Con preguntas nuevas, el modo manual acierta 58–70 %, no el 95 % de la batería con la que se
afinó (ver la hoja de ruta, «Dónde estamos»). La mayoría de las fallas tienen la lámina buena
arriba, y la esconde la puerta de evidencia: el filtro de solidez o un aviso falso de palabra
ausente. La Fase 3 cambia la puerta **sin modelo**, solo con reglas medidas.

El riesgo es el de siempre: afinar contra la misma batería hasta que el número sube y no dice
nada. Por eso el criterio se escribe antes y la confirmación se corre una sola vez.

## Decisión

**Tres juegos de preguntas, cada uno con su papel:**

| Juego | Para qué | Cuántas veces |
|---|---|---|
| Desarrollo (las tres baterías de antes, con los 14 manuales reales) | iterar las reglas, con `lab/comparar.mjs` | las que haga falta |
| eval-gate (corpus público ficticio, 99 preguntas) | que nada que estaba bien pase a mal, en cada PR | en cada PR |
| Confirmación (57 preguntas nuevas sobre páginas que nadie había usado, revisadas por Gerardo) | decir si la Fase 3 sirve | **una sola vez** |

**Criterio de salida**, todo a la vez:

1. 0 preguntas rotas en desarrollo y en el gate.
2. Los «no está» no empeoran.
3. En la confirmación, mejora pareada (misma pregunta, antes contra después) con el **IC 95 %
   de la diferencia por encima de cero**, y McNemar exacta como prueba.
4. El número tal cual en este ADR.

Si no se cumple, se itera en **desarrollo**, nunca en confirmación. Una confirmación que ya se
vio deja de serlo: la siguiente necesita preguntas nuevas.

## Lo que va hecho (desarrollo)

- **Coincidencia floja** del modo manual (`coincidenciaFloja`): con sección, cubriendo las
  palabras que el manual sí tiene y sin palabras ajenas a todos los manuales. Sale como
  `parcial`, con nota.
- **Avisos de palabra ausente más finos:** la raíz cuenta para las formas de la propia palabra
  (con su conjugación y diptongo), no para sus sinónimos.
- Medido con `lab/comparar.mjs`: arregla 10 (4 de dato y 6 «no está» de las cruzadas) y rompe
  0. El gate pasa de 68 a 74 de 78.

- **Seguimiento por sustitución** (`sustituirObjeto`, `src/motor/conversacion.js`): «¿y las
  sábanas?» cambia el objeto de la pregunta anterior en vez de pegarla. Solo con conector y sin
  verbo ni interrogativo; si no, se pega como antes. Gate de 80 a 81 de 84 (con 6 conversaciones
  nuevas en la batería pública), Hit@1 de 91.7 a 92.9; desarrollo, arregla 0 y rompe 0.
- **Ordinales:** «primera etapa» contra «1° ETAPA» ya no daba aviso (`formasDePar`); queda una
  prueba que cae si se quita la traducción.
- **Sinónimos:** «entallado» ya no se expande a «piezas». Quita tarjetas de relleno en 3
  preguntas y no cambia ninguna calificación.

Con el sinónimo más estrecho, el `margenMinimo` del arnés (cuánto margen deja la búsqueda en las
preguntas del manual interno, informativo) baja de 84 a 72 %; el recall sigue 15/15.

Falta: la corrida única de la confirmación 2, cuando Gerardo revise la batería.

## Consecuencias

- La batería de confirmación no se usa para nada más mientras la Fase 3 esté abierta.
- Lo que no pase el criterio no se presenta como mejora, aunque el gate suba.
