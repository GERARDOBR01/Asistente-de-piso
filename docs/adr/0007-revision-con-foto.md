# ADR 0007 · Revisión con foto en el teléfono (el «mini Veristack»)

- **Estado:** propuesta (6-oct-2026). Va antes que el código; la regla de colorización es un
  **supuesto por confirmar** con Gerardo.

## Contexto

En el piso, la revisión visual de un departamento se hace a ojo y la evidencia se manda por
WhatsApp. Dos problemas:

1. **Nadie mide.** «La colorización está bien» o «el anaquel está surtido» depende de quién lo
   vea, y una foto no dice qué se revisó.
2. **La evidencia se puede inventar.** Hoy cualquiera puede mandar como evidencia de montaje una
   foto hecha o retocada con IA, o una foto vieja.

Veristack (el proyecto hermano) ya separaba lo que decide el código de lo que opina un modelo.
Esta pestaña trae esa idea al teléfono, **sin red, sin costo y sin subir fotos a nadie**.

## Principio

- El **código** decide, con números sobre los píxeles y los metadatos.
- Cada resultado dice su evidencia (`fuente: CÓDIGO`) y qué medida lo produjo.
- Cuatro niveles, los de Veristack: **CUMPLE**, **OBSERVACIÓN**, **GRAVE** y **NO_CALIFICA**.
- Si no hay evidencia suficiente (foto oscura, movida, sin tramos, sin puntos), sale
  **NO_CALIFICA**. Nunca se inventa un CUMPLE.
- **Ningún modelo de lenguaje juzga la foto.** Nada de Gemini aquí.

## Decisión

### 1. Origen de la foto: se prueba de dónde salió, no se adivina si es IA

Un detector de «foto hecha con IA» falla con cada generador nuevo, la compresión de WhatsApp lo
engaña, y un falso positivo equivale a acusar a un compañero. Por eso no se usa ninguno.

- **Captura en la app** (`getUserMedia`; `ImageCapture.takePhoto()` cuando exista, si no, un
  cuadro del video): se guardan la hora, el tamaño y la **huella SHA-256** del archivo. Si
  alguien edita la foto después, la huella ya no coincide.
- **Foto de galería** (se permite, pero se marca). Se leen:
  - el EXIF: fecha original, marca, modelo y `Software` (editores);
  - el XMP/IPTC `DigitalSourceType`: `trainedAlgorithmicMedia` y
    `compositeWithTrainedAlgorithmicMedia` los ponen varias herramientas de IA;
  - si hay un manifiesto **C2PA** (caja JUMBF en un segmento APP11). En v1 se detecta y se lee
    su tipo de origen; **la firma no se valida todavía** (queda para c2pa-js) y el reporte lo dice.
- **Veredicto de origen:**

  | Caso | Nivel |
  |---|---|
  | Tomada en la app | CUMPLE |
  | Galería con EXIF de cámara coherente (fecha y modelo, sin editor) | OBSERVACIÓN |
  | Galería con un editor en `Software` | OBSERVACIÓN, con el nombre del editor |
  | Sin metadatos (reenviada por WhatsApp, captura de pantalla) | NO_CALIFICA: «revisar en persona» |
  | Declaración explícita de IA en C2PA o IPTC | GRAVE |

  Nunca sale «es IA» por un detector. GRAVE solo sale cuando la propia foto lo declara.

### 2. Colorización

**Regla parafraseada de la guía interna (supuesto, por confirmar):**
- La mercancía se ordena por una guía de color en tres grupos: **cálidos**, **fríos** y
  **neutros**, en ese orden y de izquierda a derecha.
- Dentro de cada grupo, la guía sigue la rueda de color:
  - cálidos: magenta → rojo → naranja → amarillo;
  - fríos: verde → turquesa → azul → morado;
  - neutros: los tierra (café, beige) y después negro → gris → blanco.
- La colorización es el **último paso** del mercadeo: manda la clasificación del departamento.
- Aplica en todos los departamentos sin importar la temporada. La excepción son los
  **vestidos**, que llevan su propio mercadeo por temporada.

Como Gerardo no la ha confirmado, el **orden de los grupos, la dirección y si se revisa el orden
dentro del grupo** son configurables (`REGLA_COLOR` en `src/revision/color.js`).

**Método:**
1. La persona encuadra la tringla dentro de una guía en pantalla.
2. Se toma una franja horizontal a la altura del cuerpo de las prendas.
3. Cada columna se pasa a CIELAB/LCh (mediana de la franja) y se corta en **tramos** de color
   parecido: una prenda o un bloque de prendas iguales.
4. Cada tramo se clasifica:
   - **neutro** si su croma es bajo; los cafés y beiges (tono naranja, croma medio y claridad
     baja o muy alta) también son neutros, como en la guía;
   - si no, **cálido** (tono entre ~330° y ~95°) o **frío** (el resto; el morado va en fríos).
5. Se revisa la secuencia:
   - un tramo de un grupo que aparece después del grupo siguiente **rompe el orden** → GRAVE;
   - un tramo fuera del orden de la rueda dentro de su grupo → OBSERVACIÓN.

**Salida:** la foto con una barra de color por tramo y un recuadro en el que rompe el orden,
por ejemplo «frío entre cálidos: tramo 4 de 9».

**NO_CALIFICA** si hay menos de 3 tramos, si la franja no se distingue del fondo, o si el brillo o
la nitidez quedan bajo el umbral (los de `mandatory_engine.py` de Veristack como punto de partida).

### 3. Surtido y huecos («lo que no se ve no se vende»)

1. La persona encuadra un anaquel o una mesa.
2. La imagen se divide en celdas.
3. Una celda está **vacía** si tiene pocos bordes (gradiente de Sobel) **y** su color se parece
   al del fondo o del entrepaño. El fondo se estima con la mediana de las celdas de menos bordes.
4. Las celdas vacías contiguas forman un **hueco**.

**Salida:** los huecos sombreados y el **% vacío medido**. En Veristack, `espacio_vacio` era un
dato que se le daba al sistema, no una medición.

**Umbral (supuesto, se calibra con las fotos de casa):** CUMPLE con menos de 8 % vacío y sin
hueco grande; OBSERVACIÓN entre 8 y 20 %; GRAVE con 20 % o más, o con un hueco que ocupe 6 % de
la foto. NO_CALIFICA con fotos oscuras o movidas.

### 4. Triangulación del focal (la más arriesgada: va al final y es la primera que se recorta)

- La guía pide composición en **triángulo**: se crean niveles con alturas o elementos, y el ojo
  ve más atractivo el triángulo.
- Puntos: el punto más alto de cada elemento (maniquí, planta, bolsa, base).
  - **Plan A:** un detector de objetos en el teléfono (MediaPipe con EfficientDet-Lite0, Apache
    2.0) da las cajas, y se usa la parte de arriba de cada caja.
  - **Plan B:** la persona toca los 3 a 7 puntos altos y el código hace la geometría. Se presenta
    tal cual, sin esconderlo.
- Geometría:
  - el punto más alto tiene que quedar en el tercio central;
  - las alturas bajan hacia los lados;
  - tiene que haber desnivel: la diferencia de alturas pasa del 12 % del alto de la foto.
- Niveles:
  - **CUMPLE** con la cima al centro, las alturas bajando y desnivel;
  - **OBSERVACIÓN** si hay triángulo pero la cima está corrida o un punto rompe la bajada;
  - **GRAVE** si no hay triángulo: todo a la misma altura, o una escalera con la cima en un extremo;
  - **NO_CALIFICA** con menos de 3 puntos.

### Lo que no se ve en foto

Planchado, limpieza, sensores, entallado, pasillo de 90 cm y doblado van en una **lista para
marcar a mano**. No se pretende medirlos.

## Criterios de éxito (fijados antes de medir)

Con la batería de fotos de casa (`C:\Users\gerar\eval-revision\`, fuera del repo), con unas 10
por básico, bien y con un defecto puesto a propósito:
- **Por básico:** ≥ 8/10 aciertos y **0 CUMPLE falsos** en las fotos con defecto.
- **Origen:** **0 GRAVE falsos** en fotos reales.
- Se reporta además la tasa de NO_CALIFICA. Si pasa de 30 %, la herramienta no sirve en piso
  aunque no se equivoque.

Mientras no existan esas fotos, se mide con imágenes sintéticas generadas por código (con ruido,
sombra y desenfoque, en `lab/revision.test.mjs` y `eval/revision.mjs`). **Esas cifras no cuentan
como evidencia del criterio**: solo prueban que el método hace lo que dice.

## Privacidad y material interno

- Las fotos se procesan en el teléfono y no salen de él. Compartir es una acción de la persona
  (Web Share API).
- Las fotos de tienda nunca entran al repo ni a ninguna API.
- Las reglas de este ADR están parafraseadas. No hay láminas, fotos, nombres de tiendas ni
  ligas de la guía interna.

## Fuera de alcance

- Planchado y arrugas (poco confiable en una foto de celular).
- Dirección de los ganchos.
- Un detector de IA por píxeles.
- Cualquier modelo de lenguaje sobre la foto.
- Validar la firma C2PA (v1 solo la detecta).

## Consecuencias

- Las piezas puras (`src/revision/{procedencia,color,surtido,triangulo,veredicto}.js`) trabajan
  sobre `{width,height,data}` como `ImageData`, así que corren igual en Node y en el navegador, y
  las pruebas no necesitan navegador.
- La pantalla (`src/revision/ui.js`) es la única que toca el DOM y la cámara.
- El motor del manual no se toca: el golden master tiene que salir idéntico.
