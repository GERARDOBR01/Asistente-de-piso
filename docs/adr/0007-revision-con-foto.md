# ADR 0007 · Revisión con foto en el teléfono (el «mini Veristack»)

- **Estado:** en `main` (#51, 6-oct-2026). El 7-oct se calibró con fotos reales de piso (rama
  `revision-tienda`): ver «Fotos reales de tienda (7-oct)». El orden entre grupos de color sigue
  siendo un **supuesto por confirmar**. El criterio de éxito se ha medido solo con fotos de
  **desarrollo**: falta el lote de confirmación. Lo que cambió al construirlo está en «Ajustes
  durante la construcción», al final.

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
  | Sin metadatos (reenviada por WhatsApp, captura de pantalla) | NO_CALIFICA, que en pantalla se lee «SIN DATOS» |
  | Generada con IA, según la credencial C2PA **verificada** o el IPTC | GRAVE |
  | Retocada con IA (borrador mágico, inpainting), según C2PA o IPTC | OBSERVACIÓN (7-oct; antes GRAVE) |
  | Credencial que no coincide con la imagen (alterada después de firmar) | OBSERVACIÓN |
  | Credencial que menciona IA pero no se pudo verificar (sin señal la primera vez) | OBSERVACIÓN: «ábrela con señal antes de concluir» |
  | Original firmada por una cámara de la lista de confianza de C2PA, de las últimas 24 h | CUMPLE (7-oct) |
  | Original firmada por cámara confiable, pero vieja o sin hora | OBSERVACIÓN: «original, pero de hace N días» |
  | Credencial de cámara con emisor fuera de la lista | OBSERVACIÓN, con el nombre del emisor |

  Nunca sale «es IA» por un detector. GRAVE solo sale cuando la propia foto declara que **se generó**
  con IA. Ver «Origen: falsos positivos de IA (7-oct)».

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

- Una celda vacía solo cuenta si forma una corrida vertical de al menos 15 % del alto. El aire
  arriba de las pilas es parte del mueble, no un hueco.
- **Umbral (supuesto, se calibra con las fotos de casa)**, en % del área encuadrada (una casilla
  vacía de un anaquel de 3×6 mide ~2–3 %):
  - CUMPLE con menos de 2 % vacío;
  - OBSERVACIÓN entre 2 y 6 %;
  - GRAVE con 6 % o más, o con un hueco que ocupe 6 % por sí solo.
- NO_CALIFICA con fotos oscuras o movidas.

### 4. Triangulación del focal (la más arriesgada: va al final y es la primera que se recorta)

- La guía pide composición en **triángulo**: se crean niveles con alturas o elementos, y el ojo
  ve más atractivo el triángulo.
- Puntos: el punto más alto de cada elemento (maniquí, planta, bolsa, base).
  - **Plan A:** un detector de objetos en el teléfono (MediaPipe con EfficientDet-Lite0, Apache
    2.0) da las cajas, y se usa la parte de arriba de cada caja.
  - **Plan B:** la persona toca los 3 a 7 puntos altos y el código hace la geometría. Se presenta
    tal cual, sin esconderlo.
- Geometría:
  - el punto más alto tiene que quedar en la mitad central del ancho (con 4 elementos, la cima
    cae en el segundo o el tercero);
  - las alturas bajan hacia los lados, y **los dos lados bajan**: cada uno al menos 40 % de lo
    que baja el otro;
  - tiene que haber desnivel: la diferencia de alturas pasa del 12 % del alto de la foto.
- Niveles:
  - **CUMPLE** con la cima al centro, los dos lados bajando parejo y desnivel;
  - **OBSERVACIÓN** si hay triángulo pero la cima está corrida, un lado baja mucho menos o un
    punto rompe la bajada;
  - **GRAVE** si no hay triángulo: todo a la misma altura, la cima en un extremo, o un lado que no
    baja (una escalera);
  - **NO_CALIFICA** con menos de 3 puntos.
- **Plan A, decidido tras el spike:** el detector solo **sugiere**. La persona confirma, quita
  (tocando el punto) o agrega puntos antes de revisar, y la evidencia dice
  `origen_puntos: detector | detector+manual | manual`.

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

## Medido hasta ahora (6-oct-2026)

**Batería sintética** (`node eval/revision.mjs --sinteticas`, 160 imágenes en tres niveles de
suciedad). Prueba el método; **no es evidencia del criterio**:

| Básico | Aciertos | IC 95 % | CUMPLE falsos | limpia | media | dura |
|---|---|---|---|---|---|---|
| Colorización | 52/56 | 83–97 % | 1 | 16/16 | 16/16 | 12/16 |
| Surtido | 53/56 | 85–98 % | 2 | 15/16 | 16/16 | 14/16 |
| Triangulación | 48/48 | 93–100 % | 0 | 16/16 | 16/16 | 16/16 |

- Los fallos de colorización están todos en el nivel «duro» (sombra fuerte + subexposición +
  ruido). Ahí un naranja *es* café para la cámara: es una ambigüedad física, no un error de
  código. La corrección de luz con la pared la reduce, pero no la elimina.
- Los CUMPLE falsos del surtido son una casilla vacía en el lado más oscuro de la foto «dura»:
  mide 1.6 %, debajo del umbral de 2 %.

**Fotos reales públicas** (6 fotos de escaparates de Wikimedia Commons con licencia libre,
usadas solo para probar y fuera del repo):
- **Origen:** una foto con `Software = Adobe Photoshop CS` sale OBSERVACIÓN «pasó por un editor».
  Una de cámara Panasonic sale OBSERVACIÓN «tomada hace 2319 días». Ninguna sale GRAVE.
- **Detector (spike del plan A):** carga en ~1 s y tarda 60–150 ms por foto en una PC.
  - Ve los maniquíes de cuerpo entero: 5 de 6 en un escaparate en fila (que sale GRAVE, «todo a
    la misma altura», lo correcto).
  - Ve a medias los bustos, y a veces junta dos en una caja.
  - **No ve bases, mesas ni la mayoría de los accesorios.** Por eso solo sugiere.
- **Sin red:** después del primer uso, la sugerencia tarda 0.2 s desde la caché del service
  worker.

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

## Ajustes durante la construcción

Los encontró el propio evaluador o la revisión de las capturas. Se dejan escritos porque cambian
lo que el ADR decía antes de medir:

1. **Colorización, corrección de luz:** una sombra lateral hacía que un naranja saliera café.
   Ahora se divide entre la luz de la pared en cada columna, solo si la pared es pareja en color,
   y con una ganancia global acotada (×1.35, porque en tienda las paredes suelen ser claras).
2. **Colorización, fondo:** una prenda blanca contra una pared clara desaparecía como si fuera
   pared. Ahora el umbral es estricto y la pared tiene que ser lisa (sin pliegues).
3. **Surtido:** el aire de arriba de las pilas contaba como hueco. Ahora un hueco tiene que ser
   una corrida vertical de 15 % del alto. Los umbrales se recalibraron con las sintéticas
   **antes** de medir con fotos reales: una casilla vacía de un anaquel de 3×6 mide ~2–3 %.
   - Se probó y se descartó un umbral de bordes adaptado al ruido de la foto: subía los
     huecos falsos de 1 a 14.
4. **Triangulación:** una escalera con dos alturas iguales arriba salía CUMPLE. Ahora los dos
   lados tienen que bajar, y la cima va en la mitad central (no el tercio), porque con 4
   elementos el tercio central deja fuera las dos posiciones naturales.
5. **CSP:** para el detector se abrieron solo `cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/`,
   `storage.googleapis.com/mediapipe-models/` y `'wasm-unsafe-eval'`. El detector vive en una
   caché aparte del service worker (`ap-detector-mp-0.10.21`) que sobrevive a las versiones de
   la app.

## Cómo medir con las fotos de casa

1. `node eval/revision.mjs --plantilla C:/Users/gerar/eval-revision` escribe un `etiquetas.json`
   de ejemplo.
2. Se toman ~10 fotos por básico, bien y con un defecto puesto a propósito: una prenda fría
   entre las cálidas, un hueco en la repisa, la cima a un lado. Se agregan 3–4 que no califican
   (oscura, movida, reenviada por WhatsApp).
3. Para el focal se anotan en `puntos` los puntos altos, en fracción del ancho y del alto.
4. `PLAYWRIGHT_CORE=… CANAL=chrome node eval/revision.mjs --fotos C:/Users/gerar/eval-revision`
   mide en Chrome con el mismo código del teléfono y marca ✓ o ✗ contra el criterio de arriba.

## Fotos reales de tienda (7-oct)

Gerardo trajo 5 fotos de piso (reenviadas por WhatsApp, fuera del repo, en
`eval-revision/tienda/`), todas de exhibiciones **bien montadas**: una tringla de chamarras,
una mesa de doblado, una foto de área (mesa + tringla + focal) y dos focales. Con zonas son 7
zonas y 15 básicos. Confirmó tres reglas: la **mezclilla es fría**, el **triángulo asimétrico
vale**, y en un focal se califican **todos los básicos que se puedan medir**.

| Zona | Antes (código del 6-oct) | Ahora | Por qué fallaba |
|---|---|---|---|
| Tringla (vino → mezclilla → café → negro) | NO_CALIFICA «muy oscura» | CUMPLE (cálidos → fríos → neutros) | El brillo se medía en la franja: los abrigos negros la oscurecen aunque la foto esté bien expuesta. Y la mezclilla salía neutra (croma ≈ 3) |
| Mesa de doblado, llena | GRAVE 8 % vacío | CUMPLE 0 % | Unos jeans negros en sombra (L ≈ 0) contaban como hueco |
| Mesa nido | OBSERVACIÓN 2 % | CUMPLE | Pantalones cafés lisos sobre una mesa beige: la claridad pesaba poco |
| Tringla de un solo tono | CUMPLE | CUMPLE | — |
| Focal con la cima a un lado | OBSERVACIÓN | CUMPLE (asimétrico) | La regla pedía la cima al centro |
| Focal alto · bajo · medio | GRAVE «escalera» | CUMPLE | La regla pedía que los dos lados bajaran |
| Focal de área | CUMPLE | CUMPLE | — |

**Cambios:**

1. **Zonas.** `analizarArchivo(…, { marco })` y la pantalla con «＋ Zona»: una foto de área se
   revisa por partes. El veredicto general es el peor de las zonas; el origen va aparte.
2. **Exposición de la foto completa** (percentil 90 de la luma ≥ 80) en lugar del brillo de la
   zona. Fotos reales: p90 ≥ 138; sintéticas oscuras: ≈ 30.
3. **Balance de blancos** por parche blanco (von Kries, ganancias 0.7–1.4) antes de leer
   colores. La luz de tienda es cálida.
4. **Mezclilla fría.** Un azul apagado (tono 200–300°, croma ≥ 3) es frío si L ≥ 26 y C/L ≥ 0.12.
   - El **azul marino** (más oscuro) se queda en neutros: en una foto del manual, marino →
     caqui → marino está bien montada.
   - El **gris frío** (menos saturado) también se queda en neutros.
   - **Márgenes angostos:** mezclilla L ≈ 30 contra marino L 19–23; C/L 0.17 contra 0.08 del
     gris frío. Hay que confirmarlos con más fotos.
5. **Surtido:** una celda casi negra (L < 15) no es hueco, y la claridad pesa 0.5 (antes 0.25)
   al compararla con el fondo. Barrido de 0.25 a 0.6: de 0.4 a 0.6 aciertan las 2 mesas de
   tienda y las 12 fotos de referencia.
6. **Triangulación:** una sola cima con desnivel es CUMPLE, al centro o a un lado (se reporta
   simétrico o asimétrico). Dos elementos empatados arriba (a menos de 4 % del alto) es
   OBSERVACIÓN, y todo plano es GRAVE.
   - El empate a 4 % es frágil: con los puntos del detector sin corregir, un focal real sale
     OBSERVACIÓN por 0.4 puntos.
7. **Alturas y niveles** (básico nuevo, **supuesto por confirmar**): 3 alturas o más → CUMPLE,
   2 → OBSERVACIÓN, plano → GRAVE.
   - Equilibrio, composición y simetría se quedan en la lista manual: con puntos no se mide
     peso visual sin inventarlo.
8. **Carga de la foto** (el «No se pudo leer» que vio Gerardo en el teléfono, no reproducido en
   la PC):
   - decodifica ya reducida, con la orientación del EXIF;
   - usa un `<img>` de respaldo (CSP `img-src blob:`);
   - rechaza la JPEG cortada y avisa claro con HEIC;
   - el lector de metadatos nunca truena;
   - separa «no se abrió» de «falló el análisis».

**Medido con estas reglas** (todo es desarrollo: estas fotos se usaron para calibrar):

| Batería | Resultado |
|---|---|
| Tienda | 15/15: colorización 2/2, surtido 2/2, triangulación 3/3, niveles 3/3, origen 5/5 |
| Fotos de referencia del manual | 40/40: colorización 8/8, surtido 12/12 (antes 5/8 y 5/12), origen 20/20 |
| Sintéticas | colorización 52/56, surtido 54/56, triangulación 72/72, niveles 36/36 |

En todas: 0 CUMPLE falsos y 0 GRAVE falsos de origen.

- **Detector** sobre los focales reales: ve los maniquíes en ~0.1 s, pero no ve la base con el
  zapato ni las pampas, y suma un maniquí del fondo. Sigue siendo solo sugerencia.
- **Siguiente:** un lote de confirmación (fotos nuevas, con defectos puestos a propósito),
  corrido una sola vez sin tocar el código antes.

## Origen: falsos positivos de IA (7-oct)

Gerardo reportó que la detección de IA marca IA cuando no la hay. Se reprodujo con 7 muestras
controladas (en `eval-revision/origen/`):
- firmadas con el certificado de **prueba** de c2pa-rs;
- lo que el SDK lee de ellas está en `lab/fixtures/c2pa/`.

| Muestra | Antes | Ahora |
|---|---|---|
| Foto real con una imagen de IA solo como referencia (`inputTo`) | **GRAVE «generada con IA»** | OBSERVACIÓN (cámara) |
| Foto real retocada con IA, C2PA | GRAVE | OBSERVACIÓN «retocada con IA» |
| Foto real retocada con IA, IPTC (como el borrador mágico de Google Fotos) | GRAVE | OBSERVACIÓN |
| Foto alterada después de firmar | OBSERVACIÓN como de cámara | OBSERVACIÓN «no coincide con su firma» |
| Generada con IA (C2PA o IPTC) | GRAVE | GRAVE |

**Causas:**
1. La búsqueda **por bytes** en todo el manifiesto encontraba «trainedAlgorithmicMedia» en la
   historia de un ingrediente, no en la foto. La guía técnica de C2PA lo advierte: hay que leer
   el manifiesto **activo** y la cadena `parentOf`.
2. «Retocada con IA» (`compositeWithTrainedAlgorithmicMedia`) se trataba igual que «generada».
   Galaxy AI y Google Fotos marcan así las fotos reales en las que se borró algo.

**Decisión:**
- La credencial se lee y se valida con el **SDK oficial** `@contentauth/c2pa-web` 0.15.3 (MIT;
  c2pa-rs en WASM, 9 MB).
- Se baja solo cuando la foto trae credencial (`src/revision/c2pa.js`). Vive en su caché del
  service worker (`ap-c2pa-web-0.15.3`), y el CSP abre solo esa ruta y `highgain@0.1.0`.
- La interpretación es pura y tiene pruebas: `interpretarC2pa` en `procedencia.js`.
- Sin el SDK, una palabra en los bytes ya no acusa a nadie.

**Detectores de píxeles, descartados otra vez con datos:**
- un estudio con un millón de fotos de celular midió hasta 98 % de falsos positivos en fotos
  reales;
- una auditoría de NewsGuard (mayo de 2026) encontró que llamaron IA a fotos auténticas 13 % de
  las veces;
- SynthID (Google) no tiene detector abierto ni API pública: solo el portal y la app Gemini (se
  revisa a mano desde el 8-oct, ver abajo).

**Lista de confianza (después del #54):** se empaqueta la lista oficial del Conformance Program de
C2PA.
- **Fuente y licencia:** `c2pa-org/conformance-public`, `trust-list/C2PA-TRUST-LIST.pem`, commit
  70ec46e del 13-ago-2026, CC-BY-4.0. Va en `src/revision/c2pa-confianza.pem`, se guarda en el
  service worker y se pasa al SDK como anclas.
- **Quién está:** 30 certificados de Google (Pixel: «Mobile A/B»), Xiaomi, vivo, Huawei, Adobe,
  DigiCert y otros. Samsung no aparece por nombre.
- **Regla:** una foto original firmada por una cámara de la lista sale CUMPLE solo si la firma (o
  el EXIF) es de las últimas 24 h, porque una original vieja no prueba el montaje de hoy. Lo
  generado con IA sigue saliendo GRAVE aunque el emisor sea confiable.
- **Verificado con la raíz de prueba de c2pa-rs como ancla:**
  - la muestra de cámara pasa a «emisor confiable»;
  - la generada sigue en GRAVE;
  - la alterada sigue en «no coincide».
- **Con la lista oficial,** el certificado de prueba sigue «sin verificar», como debe.
- **Mantenimiento:** la lista se actualiza a mano. Falta probarla con una foto real de Pixel 10.

## Focal: toque inteligente con Magic Touch (7-oct)

Primera de las herramientas que se integran una por una (nota del vault
«Asistente-de-piso-Revision-foto-Herramientas»). Con el toque de antes había que atinarle a lo más
alto de cada elemento. Ahora la persona **toca el elemento en cualquier parte** y el segmentador
interactivo de MediaPipe da su silueta. La cima sale de `cimaDeSilueta` (`triangulo.js`), que es pura
y tiene pruebas.

- **Modelo:** MagicTouch 512×512 float32, 6.2 MB. La ficha oficial dice **Apache 2.0**.
- **Carga:** misma librería, CSP y caché del service worker que el detector
  (`src/revision/silueta.js`).
- **Silueta derramada:** si toca el borde de arriba o pasa del 35 % de la foto, no se le cree y
  queda el punto tocado.
- **Sin modelo** (sin señal la primera vez): queda el punto tocado y la app lo avisa.
- **En pantalla:** la silueta se pinta encima de la foto y hay una línea del toque a la cima, para
  notar si se juntó con algo de atrás.
  - «Punto exacto» vuelve al toque de antes.
  - Tocar el punto, o donde se tocó para crearlo, lo quita.
  - Si la cima cae sobre otro elemento ya marcado, no se repite.
- **Evidencia:** `origen_puntos: silueta | detector+silueta`.

**Medido** con `node eval/revision.mjs --siluetas eval-revision/tienda` (5 focales reales, 17
elementos, `toques.json`):

| | Resultado |
|---|---|
| Cimas a ≤ 3 % del alto de la real | **12/17** (error mediano 1.4 %) |
| Siluetas descartadas | 0 |
| Tiempo | ~0.3 s por toque; 1.7 s la primera vez |
| Uniones con lo de atrás (errores reales) | 2: bolsa con su base de mármol; pampas con un letrero rosa |
| Ambiguos | 3: el tubo de la tringla, las plantas detrás de una base y el arco del mueble de doblado. Son la parte más alta del mueble, no del producto |
| Veredicto con los puntos del toque | focal-1 y focal-2 iguales que a mano; en la foto de área, «niveles» sale OBSERVACIÓN porque dos uniones emparejan alturas |

**Conclusión:** en focales despejados acierta. En fotos de área cargadas, la silueta se junta con
lo de atrás, y por eso se ve en pantalla y existe «Punto exacto». Hay que probarlo en el teléfono
antes de darlo por bueno.

## Detector de IA: SynthID revisado a mano (8-oct)

Gerardo reportó que el origen «sigue teniendo fallos» con la IA. Antes de integrar nada se midió:

| Medición | Resultado |
|---|---|
| 3 detectores abiertos de píxeles, 91 imágenes de IA modernas y 120 de Reddit (7-oct) | Community Forensics detecta 10/91. SigLIP2 marca 57/130 reales. SwinV2-L (haywoodsloan, Apache) detecta 75 % de la IA con 8 % de falsos positivos en fotos reales «bonitas» |
| SwinV2-L con fotos reales de tienda reenviadas por WhatsApp (29 el 7-oct y 30 nuevas el 8-oct) | **0/59 falsos positivos**, ~0.9 s por foto en CPU |
| El origen de la app con esas 30 fotos nuevas | 30/30 «sin datos», ninguna GRAVE |

**Decisión:**
- **Ningún detector de píxeles entra a la app.** El mejor pesa 780 MB, falla con ediciones
  locales (borrar un hueco del mueble, que es el fraude más probable) y caduca con cada generador
  nuevo. Lo que se reportaba como fallos venía de los originales del teléfono, probablemente
  retocados con Galaxy AI, que ya salen OBSERVACIÓN desde el #53.
- **Tampoco se le pregunta a un modelo de visión «¿esto es IA?».** Sería adivinar, y la foto
  saldría a un tercero.
- **SynthID, revisado a mano.** Es la marca de agua que Google mete en los píxeles de lo que hace
  su IA, y resiste JPEG y el reenvío. No tiene API pública, solo el portal y la app de Gemini.
  - **Cuándo aparece el botón:** con SIN DATOS o con OBSERVACIÓN sin credencial C2PA válida
    (`admiteSynthid`).
  - **Qué hace:** en el teléfono comparte la foto **original** (Gemini sale en el menú de
    compartir). En la computadora abre `synthid.com`. La foto sale del teléfono solo si la persona
    toca el botón, y el botón lo dice.
  - **La persona anota lo que vio** (`conSynthid`):
    - «Hecha con IA» → GRAVE;
    - «Partes con IA» → OBSERVACIÓN, igual que lo retocado en C2PA;
    - «Sin marca» → el nivel no sube, y el motivo aclara que no prueba que sea real, porque otras
      IA no ponen esa marca.
  - Todo sale rotulado «revisado a mano», también en el resumen compartido.
  - **Probado en el teléfono (8-oct):** compartir no llevaba a SynthID (Gemini no aparecía en la lista). Ahora el botón principal abre `synthid.com` (portal de Google, pide iniciar sesión) y compartir a Gemini queda como opción chica.
- **La defensa de fondo sigue siendo el proceso:** foto tomada en la app (CUMPLE, con huella) u
  original firmada por la cámara. Detectar es una carrera que se pierde.

## Focal: «Sugerir» sobre el recorte de la zona (11-oct)

Visto en el teléfono: «Sugerir» ponía puntos en el fondo y le faltaban o le sobraban
elementos. Tenía tres causas: detectaba sobre la foto entera y no sobre la zona, ponía el
punto en lo alto de cada caja sin ver la silueta, y reemplazaba los puntos que la persona ya
había tocado.

**Medición nueva:** `node eval/revision.mjs --sugerir <dir>`, en Chrome. Usa las 17 cimas
etiquetadas de 5 focales de tienda (`toques.json`) y el marco de cada zona
(`etiquetas.json`). Una sugerencia acierta si cae a ≤ 3 % del alto y ≤ 6 % del ancho de una
cima, y cada cima cuenta una vez.

| Método | Recall (cimas encontradas) | Precisión (sugerencias en una cima) | Error medio Δy |
|---|---|---|---|
| Antes: foto entera, lo alto de la caja | 8/17 (47 %) | 8/11 (73 %) | 1.0 % |
| Ahora | **11/17 (65 %)** | **11/12 (92 %)** | 1.0 % |

**La regla nueva** (`src/revision/sugerir.js`, puro y con pruebas; la orquestación está en
`detector.js`):

1. **Detecta sobre el recorte del marco**, con 8 % de margen. En el recorte, un maniquí sube
   de 0.57 a 0.75 de confianza y aparece la bolsa que en la foto entera no salía.
2. **Umbrales:** 0.25 para personas, porque un maniquí sobre pared clara sale con 0.26, y
   0.35 para objetos, porque por debajo eran fondo en todas las fotos medidas.
3. **Descarta el fondo:**
   - una caja que ocupa más de 60 % del recorte;
   - una caja cortada por el borde de arriba del recorte, porque sigue hacia el techo;
   - una persona de menos de 45 % del alto de la más alta.
4. **Quita las bases:** un objeto que empieza justo donde termina otro, al menos igual de
   ancho y con el de arriba casi entero encima, es su pedestal. El detector llama
   «suitcase» a la base de una bolsa. La primera versión de esta regla se comía una bolsa
   en una base escalonada, y la medición lo mostró.
5. **Duplicados por IoU real y solo en la misma categoría:** la bolsa que lleva un maniquí ya
   no se pierde por caer dentro de su caja.
6. **Cada caja se afina con la silueta**, desde un toque virtual arriba de la caja (y, si cae
   en un hueco como el asa de una bolsa, otro más abajo). Solo se le cree si su cima queda
   dentro de la caja y cerca de su parte de arriba. Sin silueta queda en 10/15; con el
   segundo toque, en 11/12.
7. **Se fusiona con lo que ya tocó la persona**, sin pisarlo, con un tope de 9 elementos y
   con el aviso «Encontré N elementos. ¿Falta alguno? Tócalo».

**Lo que no ve:** zapatos sobre base, pampas, tringlas, un maniquí blanco sobre pared blanca
y prendas dobladas. EfficientDet-Lite0 está entrenado con COCO, donde esas categorías no
existen. Para eso está el toque inteligente.

**Silueta:**
- **`cimaDeSilueta` recibe la zona:** rechaza una cima más de 3 % por encima de ella.
- **Hueco del fondo:** si el toque cae en un hueco (entre los brazos), busca el objeto más
  cercano.
- **Silueta sobre la imagen chica:** con la de ≤ 640 px y no la base, salen las mismas
  12/17 cimas en ~140 ms en vez de ~180.
- **Apertura morfológica, medida y descartada:** no cambió ninguna cima, porque las
  siluetas que «suben» se juntan con lo de atrás por contacto ancho, no por puentes finos.
  Con radio grande bajaba a 6/17, porque borraba las cabezas.
- **El caso «doblado» (−43.6 %) sigue sin resolverse.** Se cubre en la pantalla: la silueta
  se pinta encima de la foto y, si la cima cae sobre otro punto, el aviso dice «se juntó
  con el 2» en vez de borrar el toque.

**Lo que cambia en la pantalla:**
- **Mientras busca:** el lienzo no acepta toques y una línea barre la zona.
- **Puntos:** el sugerido lleva borde punteado y el pendiente, un anillo que gira.
- **«Revisar»** espera a que lleguen todas las siluetas.
- **Silueta tardía:** si llega después del tope de 8 s, el punto sube a su cima en vez de
  perderse.
- **Numeración y tope:** la numeración sigue el orden de toque y el tope de 9 se avisa.
- **Precarga:** los modelos se bajan al elegir «Focal».

Todo esto se midió en **desarrollo**, con 5 fotos. Falta el lote de confirmación.

## Surtido: solo la mesa o el mueble (17-oct)

Gerardo: «una foto de una mesa y un maniquí a un lado sale GRAVE porque a la izquierda del
maniquí no hay nada; pero solo se evalúa la mesa». Sin una zona dibujada, el surtido medía el
92 % de la foto. Al pintar dónde caían los «huecos» en 23 fotos con mesa del banco de escena
(`eval-revision/escena`, fuera del repo), casi siempre eran **el techo**, y en dos, **la base o
la columna junto al maniquí**.

- **Techo.** Con el marco de la guía, lo vacío que toca el borde de arriba es techo o pared si,
  sumando todos sus pedazos (las lámparas lo parten), cubre al menos la mitad del ancho. Una
  casilla vacía del entrepaño de arriba de un mueble que llena el cuadro no llega a tanto: las
  12 semillas sintéticas con hueco siguen sin CUMPLE. Con una zona dibujada no cambia nada.
- **Maniquíes.** El detector de «Sugerir» (EfficientDet-Lite0) busca `person` ≥ 0.4 una vez
  por foto. En el banco de escena esas cajas acertaron 93–100 % de las veces.
  - **Sin zona y con maniquí → NO_CALIFICA**, y se pide marcar la mesa con «＋ Zona». No se
    adivina qué parte de una foto de área es la mesa.
  - **Con zona:** las celdas que tapa el maniquí no cuentan ni como hueco ni como producto.
  - Sin señal y sin el modelo guardado, todo queda como antes.

| | Antes | Ahora |
|---|---|---|
| Fotos del manual | 12/12 | 12/12 |
| Tienda | 2/2 | 2/2 |
| Lote de confirmación (zonas a mano) | 5/5 | 5/5 |
| 23 fotos con mesa, sin zona | 6 GRAVE + 4 OBSERVACIÓN falsos | 1 GRAVE (pared con letras) + 1 OBSERVACIÓN; 16 piden zona |

## Colorización con la regla de Gerardo (17-oct)

**La regla, confirmada por Gerardo:** siempre de cálidos a fríos a neutros, de izquierda a
derecha, sea cual sea la mercancía. **GRAVE = un grupo partido en bloques o un mal seguimiento
del orden.** La excepción son los **vestidos** (presentación de básicos), que llevan su propio
mercadeo por temporada.

- `REGLA_COLOR.ordenEstricto: true`: unos bloques limpios en otro orden ya no son observación.
  - Ojo: una foto de ejemplo del propio manual (tallas grandes) va fríos → cálidos → neutros y
    ahora sale GRAVE. Gerardo lo tiene que ver.
- **Vestidos:** en la tarjeta de una tringla hay «¿Es de vestidos?». Al tocarlo, NO_CALIFICA
  con su motivo («la regla de color no se aplica; revisa a mano que siga la campaña»).
- Fuera el «supuesto por confirmar» de la pantalla y del motivo.

**Qué tan bien distingue una buena de una mala colorización.** Banco fuera del repo
(`eval-revision/color`), revisado a ojo tramo por tramo:
- **Tringlas reales:** 19 zonas. Son 16 calificables: 10 de desarrollo, 2 de prueba y 4 del
  lote de confirmación.
- **Defectos hechos con ellas:** a 8 tringlas bien montadas se les pegó en medio de un bloque
  una prenda real de otro grupo, recortada de otra foto y con la luz de la foto destino
  (32 «intrusos»). Además hay 4 ediciones con los bloques intercambiados y 8 controles (una
  prenda del mismo grupo, que no debe cambiar nada).
- El código encontró dos causas de error que no eran de la regla:
  1. **Brillos.** Un tramo angosto (< 4 % de la franja) y quemado (L ≥ 98) es luz recortada
     por la cámara, no una prenda. En las camisas azules del lote de confirmación, dos brillos
     partían el bloque azul y salía GRAVE.
  2. **Colores en el filo.** Un color es dudoso si un error de medición chico lo cambia de
     grupo (4 de claridad, 20 % de croma, 8° de tono), o si es un pálido (L ≥ 80 y C de 3 a 15:
     azul cielo, rosa pastel, crema).
     - Se lee dos veces, con todos los tramos y solo con los firmes. Si sin los dudosos la
       tringla está en orden, sale **OBSERVACIÓN «revísalo a ojo»**, nunca GRAVE.
     - Tampoco se vuelve CUMPLE, así que no tapa un defecto.
     - La mezclilla lavada (L 30, C 5) y el marino (L 21) siguen firmes.

| Banco | Antes (orden estricto) | Ahora (+ brillos y dudosos) |
|---|---|---|
| Tringlas reales, desarrollo | 9/10 | 9/10 |
| Tringlas reales, prueba | 2/2 | 2/2 |
| Lote de confirmación | 3/4 (GRAVE falso: camisas azules) | **4/4** |
| Intrusos atrapados | 31/32 | 31/32 (24 GRAVE, 7 OBSERVACIÓN) |
| Orden equivocado atrapado | 4/4 | 4/4 |
| Controles con GRAVE falso | 3/8 | 1/8 (+2 OBSERVACIÓN) |
| Sintéticas | 52/56 | 52/56 |
| Fotos del manual / tienda | 8/8 · 2/2 | 8/8 · 2/2 |

- **Los 7 intrusos que bajan a OBSERVACIÓN:**
  - cuatro blusas lila: el lila está en el filo entre morado (frío) y rosa (cálido);
  - tres prendas en una tringla de luz muy cálida y tenue, donde un amarillo casi se lee beige.
- **Límites que quedan:**
  - un suéter vino en sombra fuerte se lee negro: en la foto los píxeles están en 13–32 de 255;
  - una mezclilla deslavada bajo cierta luz se lee gris;
  - un marino un poco más claro que su bloque, junto a una prenda muy distinta, se lee azul.
- **Para Gerardo:**
  - una foto del manual va mezclilla clara | caqui | mezclilla oscura. ¿Es clasificación por
    producto, que manda sobre el color, o un ejemplo de colorización? Hoy sale CUMPLE porque
    las dos mezclillas se leen marino.
  - ¿Una tringla de blusas rojas y negras alternadas por colección es GRAVE?

## Focal: «Sugerir» solo dentro de la exhibición (17-oct)

Gerardo: «la triangulación es donde más funciona, pero a veces agrega la sugerencia en puntos
fuera de la exhibición». En 27 focales reales, sin zona dibujada, los puntos de más eran:
- la corbata, la mochila puesta o la bolsa en la mano de un maniquí;
- la base de un maniquí, que el detector llama «suitcase»;
- un maniquí o un cliente cortado por la orilla de la foto;
- un póster con una persona;
- bolsas o ropa doblada de otro mueble.

`enLaExhibicion` (`sugerir.js`, pura y con pruebas) quita, después de elegir las cajas:
- **Maniquíes:** el guía es el más alto de los que no tocan la orilla. Se quitan los cortados
  por la orilla y más chicos que él, y los que «flotan» (pies a más de 35 % de su alto por
  arriba de los suyos).
- **Objetos:**
  - lo que un maniquí lleva puesto (70 % dentro de su caja, arriba de los pies);
  - su base (empieza en el último 20 % del maniquí, debajo de él);
  - lo cortado por la orilla;
  - lo que queda a más de 1.6 anchos de maniquí del grupo. Lo de la exhibición quedó a
    0.2–1.5 y el muro de bolsas de al lado, a 1.9;
  - lo que queda en el 20 % de arriba (decoración del muro).
- Sin maniquíes no hay grupo contra el cual medir y los objetos se quedan.
- **Con zona dibujada,** un punto que cae fuera del recuadro (en el margen con que mira el
  detector) ya no se sugiere.
- **La barra de ayuda dice qué no contó y por qué:** «No conté 2: la base de un maniquí, lo
  que lleva puesto un maniquí».
- Cambia una decisión del 11-oct: la bolsa que lleva un maniquí ya no es otro elemento. Está
  donde el maniquí y sumaría una «altura» de más a alturas y niveles.

**Medido** (cimas marcadas: 5 de tienda, 10 del lote de confirmación —con una cima corrida
corregida— y 12 focales nuevos con su zona y sus maniquíes; fuera del repo,
`eval-revision/sugerir`):

| | Antes | Ahora |
|---|---|---|
| Desarrollo, sin zona: recall | 27/50 | 27/50 |
| Desarrollo, sin zona: precisión | 27/38 (71 %) | **27/32 (84 %)** |
| Desarrollo, con zona: precisión | 27/36 | 27/33 |
| Nuevos, sin zona: maniquíes encontrados | 24/27 | 24/27 |
| Nuevos: puntos fuera de la exhibición | 4 | 2 |
| Nuevos: puntos sobre el cuerpo de un maniquí | 1 | 0 |
| `--sugerir` de tienda (con zona) | 11/17 · 11/12 | 11/17 · 11/12 |

Quedan dos: un póster de una persona del mismo tamaño que los maniquíes, y una foto donde el
detector no vio al maniquí (sin maniquíes no hay grupo y los objetos se quedan).

## Zonas: ajustar sin volver a dibujar (18-oct)

Antes, un recuadro mal puesto se quitaba con la × y se dibujaba otra vez, y una zona marcada
con el tipo equivocado también. Ahora «✎ Ajustar», junto a «＋ Zona», entra a un modo:
- arrastrar dentro de la zona activa la mueve; arrastrar una esquina cambia su tamaño, con la
  esquina opuesta quieta. Nunca se sale de la foto ni baja de 6 % por lado (lo mismo que al
  dibujarla), ni se voltea;
- al soltar se vuelve a medir. Deja de ser la zona de la guía y los maniquíes del surtido se
  buscan otra vez dentro del recuadro nuevo;
- los botones de arriba (Tringla, Anaquel o mesa, Focal) cambian qué es la zona, igual que
  al dibujar eligen qué se dibuja. Un focal sin puntos los pide al terminar;
- tocar otra zona la elige (la más chica que contiene el toque);
- «Listo» sale. Es un modo, y no un gesto siempre activo, porque la zona suele cubrir casi
  toda la foto: deslizar sobre la foto para bajar la página la movería sin querer.

La geometría vive en `marco.js` (pura, con pruebas de propiedades). `eval/revisar-pantalla.mjs`
la prueba en la pantalla: esquina, mover, cambiar de tringla a mesa y salir.

## Captura guiada en vivo (18-oct)

Una foto oscura o movida se descubría después de tomarla, con un NO_CALIFICA. Ahora, con la
cámara abierta, `guia.js` mide un cuadro del video cada ~450 ms y lo dice sobre el video:
- **Luz y nitidez** con los umbrales de `noCalifica` (`CALIDAD`), por el mismo camino que la
  foto (lienzo de ≤ 1600 px y luego 640 px), dentro de la guía del tipo elegido. `noCalifica`
  da solo el primer problema; `revisarToma` (`toma.js`, pura) da los dos a la vez. Una prueba
  de propiedades pide que digan lo mismo.
- **Nivel** con la gravedad del acelerómetro (`devicemotion`): «Derecho» hasta 2°, «Casi
  derecho» hasta 6°, «Ladeado N°» arriba de eso, y «Ponlo de frente» si mira más de 20°
  hacia arriba o abajo (deforma el mueble). Una línea del horizonte gira en la guía y se
  alinea con las marcas de la orilla cuando el teléfono está derecho. Android e iOS dan la
  gravedad con signos opuestos: el ángulo se pliega a ±90°. iOS pide permiso al abrir la
  cámara; sin sensor o sin permiso, no hay nivel y lo demás sigue.
- El disparo se pinta de verde cuando todo está bien. **Avisa, no bloquea:** se puede tomar
  la foto igual, y la revisión sigue diciendo NO_CALIFICA si no da.

La prueba de pantalla abre la cámara falsa de Chromium y simula el sensor (8° → «Ladeado 8°»,
0° → «Derecho»). Lo que falta medir en el A54: que «Nítida» en el video y la nitidez de la
foto tomada coincidan (la foto viene de `takePhoto` a resolución completa) y el signo del
nivel con el teléfono de lado.

## Consecuencias

- Las piezas puras (`src/revision/{procedencia,color,surtido,triangulo,veredicto,demo}.js`) trabajan
  sobre `{width,height,data}` como `ImageData`, así que corren igual en Node y en el navegador, y
  las pruebas no necesitan navegador.
- La pantalla (`src/revision/{ui,comun,zonas,dibujo,reporte}.js`) es la única que toca el DOM y
  la cámara, junto con `detector.js`, que solo carga MediaPipe cuando alguien lo pide.
  `ui.js` (1,500 líneas) se partió el 18-oct sin cambiar comportamiento: la escena y el focal
  en `ui.js`, el estado en `comun.js`, las zonas, el dibujo sobre la foto y el reporte aparte.
  `eval/revisar-pantalla.mjs` recorre la pantalla en el CI.
- El motor del manual no se toca: el golden master tiene que salir idéntico.
