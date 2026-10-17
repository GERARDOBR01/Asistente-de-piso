# ADR 0008 · Revisión con foto: qué traer de Veristack (pesos, jerarquía y capas)

- **Estado:** propuesta (17-oct-2026). **No hay código.** Sale del lote de confirmación del
  ADR 0007, que no confirmó el criterio. Cada punto dice qué se trae, qué no y qué habría
  cambiado en ese lote. Lo implementado se mide en desarrollo; la confirmación pide un lote nuevo.

## Contexto

La pestaña «Revisar con foto» ya trae de Veristack los cuatro niveles y el principio de que el
código decide. Le faltan tres piezas que Veristack sí tiene:

- **El peso de cada criterio:** `MANDATORY`, `RECOMMENDATION` o `EXCEPTION`, en
  `pipeline/knowledge/*.json`.
- **El orden de la jerarquía** al juntar resultados (`_calcular_veredicto` en
  `pipeline/mandatory_engine.py`).
- **El conocimiento en capas** por lo rápido que caduca (`schema_conocimiento_v1.md`).

En Veristack, **GRAVE** es «impacto económico» y **OBSERVACIÓN** es «calidad sin impacto
directo en dinero». La pestaña no hace esa distinción: cualquier básico puede salir GRAVE.

**Lo que mostró el lote de confirmación (17-oct)**, con 23 fotos que Gerardo da por buenas:
- triangulación 9/16, alturas y niveles 12/16 y colorización 2/4;
- **8 GRAVE** en exhibiciones bien montadas: en colorización y triangulación, que la propia
  capa 1 de demo de Veristack marca como `RECOMMENDATION`, y en alturas y niveles, que sale de
  los mismos puntos del focal;
- surtido 4/4, el único `MANDATORY` que mide la foto, sin GRAVE.

## Propuesta, en orden

### 1. Peso por criterio, con tope de severidad (traer)

Un catálogo `src/revision/criterios.js`, puro y con pruebas, con un registro por básico. Los
campos copian el esquema de Veristack donde aplica:

| Campo | Ejemplo | Para qué |
|---|---|---|
| `id` | `triangulacion` | el `basico` de hoy |
| `peso` | `MANDATORY` \| `RECOMMENDATION` \| `EXCEPTION` | pone el tope de severidad |
| `aplica_a` | `['focal']` | tipo de zona: `tringla`, `anaquel`, `focal` |
| `fuente` | `CÓDIGO` \| `MANUAL` | lo que mide la foto o lo que va en la lista para marcar a mano |
| `estado` | `supuesto` \| `confirmado` | lo que el ADR 0007 hoy dice en prosa |

**Regla:**
- `RECOMMENDATION` llega cuando mucho a **OBSERVACIÓN**: un GRAVE calculado se reporta como
  OBSERVACIÓN, con el motivo intacto y la evidencia `tope: RECOMMENDATION`.
- `MANDATORY` puede llegar a GRAVE.
- Un criterio en `supuesto` también se topa en OBSERVACIÓN, aunque sea `MANDATORY`. Hoy la
  regla de color y la del triángulo son supuestos.
- **Pesos iniciales**, los de la capa 1 de Veristack: surtido `MANDATORY`; colorización,
  triangulación y alturas y niveles `RECOMMENDATION`. Gerardo los confirma.

**En el lote del 17-oct:** los 8 GRAVE falsos bajan a OBSERVACIÓN. **Los aciertos no cambian**
(siguen 2/4, 9/16 y 12/16), porque lo esperado era CUMPLE. Baja el costo del error, no lo
arregla. Arreglarlo es el punto 5.

### 2. La jerarquía de Veristack en el veredicto general (traer)

`peor()` en `veredicto.js` hoy pone CUMPLE por encima de NO_CALIFICA: una foto de área con dos
zonas que cumplen y una que no se pudo calificar sale **CUMPLE** en el resumen. Veristack usa
GRAVE > OBSERVACIÓN > NO_CALIFICA > CUMPLE, y el general solo es CUMPLE si todo cumplió.

- El cambio va con el principio del ADR 0007, «nunca se inventa un CUMPLE».
- El resumen ya cuenta por nivel («2 cumple · 1 no califica»), así que no se pierde nada.
- **En el lote del 17-oct:** no cambia nada, porque ningún básico salió NO_CALIFICA.

### 3. La confianza como eje aparte (traer)

Veristack separa la severidad de la confianza (`ALTO`, `MEDIO`, `BAJO`). Aquí la confianza
saldría del **margen contra el umbral**, sin modelo:

- baja si la medida queda a menos de un margen fijo del umbral (el margen se fija en
  desarrollo, antes de la confirmación);
- en pantalla: «cerca del límite: vuelve a tocar los puntos» o «tómala de frente».

**En el lote del 17-oct:**
- el empate de 3.3 % contra el umbral de 4 % saldría con confianza baja;
- el desnivel de 10 % contra el mínimo de 12 %, con confianza media.

Es lo que se esperaba ver: el resultado depende del pulso de quien toca.

### 4. Capas por sección (traer la 1 y la 3; la 2 después)

Veristack ordena el conocimiento por lo rápido que caduca. Traducido a la pestaña:

| Capa | En Veristack | Aquí | Cuándo |
|---|---|---|---|
| 1 · Básicos permanentes | limpieza, alineación, planchado, colorización, triangulación, surtido | El catálogo del punto 1. La `listaManual()` de `ui.js` deja de estar escrita a mano: son los criterios con `fuente: MANUAL` y su `aplica_a` | Con el punto 1 |
| 2 · Campaña activa | gráfico de etapa, retiro de material anterior, con `vigencia_inicio` y `vigencia_fin` | Solo en la lista manual, y solo mientras está vigente. La foto no lo mide: no hay OCR ni modelo | Cuando Gerardo use campañas en la app |
| 3 · Excepciones por tipo de zona | `EXCEPTION` con `aplica_a` (focal show) | Excepciones que la persona marca y que cambian un básico. Ya hay una en el ADR 0007, los **vestidos** sin colorización. Candidata: «tringla clasificada por estilo», que apaga el orden de color entre estilos | Con el punto 1 |

**En el lote del 17-oct:** la tringla de chamarras que salió GRAVE es el caso de la capa 3, si
Gerardo confirma que se clasificó por estilo antes que por color.

**Material interno:** igual que en Veristack, el repo lleva una capa de **demostración**. Los
textos reales de la guía no entran: los criterios van parafraseados, como hoy en el ADR 0007.

### 5. La regla del triángulo, con Gerardo (decidir, no traer)

Ningún punto de Veristack arregla los aciertos de triangulación y niveles. Las fallas son
reglas que en piso no se aplican así:
- una fila de maniquíes a la misma altura se acepta;
- una pareja simétrica se acepta;
- un infantil con totems iguales se acepta.

Hacen falta respuestas de Gerardo antes de tocar números:
1. ¿Una fila de maniquíes de pie, sin bases, cumple la triangulación?
2. ¿Dos maniquíes iguales a los lados de un mueble central cumplen?
3. ¿Los totems y paneles de la exhibición cuentan como elementos del triángulo?

Si las respuestas son «sí», la triangulación pasa a ser una sugerencia (punto 1, `RECOMMENDATION`
con su texto) más que una regla que se califica. Se mide en desarrollo con las fotos del 7 y
del 17 de octubre.

## Lo que no se trae

- **Foto oscura o movida como GRAVE bloqueante.** En Veristack detiene el pipeline con GRAVE.
  Aquí sigue siendo **NO_CALIFICA**: una mala foto no prueba una mala exhibición.
- **Delegar al modelo** lo `RECOMMENDATION` o lo de confianza baja. El ADR 0007 prohíbe un
  modelo sobre la foto. Lo que en Veristack se delega, aquí se le pregunta a la persona, rotulado
  «revisado a mano», como ya se hace con SynthID.
- **`espacio_vacio` como dato de entrada.** Aquí se mide.

## Cómo se mide

- **Desarrollo:** sintéticas, las 5 fotos del 7-oct y las 23 del 17-oct (ya usadas). Con
  `node eval/revision.mjs --fotos`, más una columna nueva de GRAVE en exhibiciones bien montadas.
- **Confirmación:** un lote nuevo, una sola vez, con ~10 fotos por básico, la mitad con defecto
  puesto a propósito y 3–4 que no califican.
- **Criterio:** el del ADR 0007 sin cambios, más **0 GRAVE en exhibiciones bien montadas** en los
  básicos `RECOMMENDATION`.

## Consecuencias

- Un catálogo en un solo lugar en vez de constantes sueltas (`REGLA_COLOR`, `REGLA_TRIANGULO`,
  `listaManual`).
- La severidad dice lo mismo que en Veristack, y los dos proyectos se pueden comparar.
- Las piezas puras siguen sin DOM; `ui.js` solo pinta lo que el catálogo dice.
