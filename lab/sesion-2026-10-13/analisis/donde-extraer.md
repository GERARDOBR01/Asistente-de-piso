# Dónde extraer: proyectos ya terminados que pueden subir el techo

Pregunta de Gerardo después de la investigación del sector: el chat parece tener un techo; ¿de
qué proyectos ya terminados se puede sacar algo para el chat y para Revisar (el «mini
Veristack»)? Aquí, por fuente, qué se puede sacar y qué falla medida ataca.

## El techo del chat, con los números del repo

- **Modo manual (sin modelo):** 84.5 % de datos con su página en el manual de muebles. Con
  preguntas nuevas, 58–70 %. La hoja de ruta ya lo dice: el cuello de botella es la puerta de
  evidencia, no la búsqueda.
- **Modo API:** 92.9 % en el corpus ficticio, y 78/78 cuando el dato llega al contexto. Las
  fallas que quedan son de lectura y de búsqueda, no del modelo.
- **Ya probado y documentado:** búsqueda híbrida (ADR 0002), abstención conformal (ADR 0003) y
  el juez con EmbeddingGemma (aparcado).

El techo del modo manual es de diseño: sin modelo, la app solo puede enseñar tarjetas. Para
subirlo hay tres caminos: leer mejor el PDF, saber de qué temas trata cada manual y retomar el
juez con modelo local.

## Fuente 1 · Veristack (proyecto hermano, ya terminado, MIT)

Veristack tiene un `motor2/` que convierte un manual PDF en criterios validados. Asistente de
Piso todavía no tiene esa parte.

| Pieza de Veristack | Qué hace | Qué ataca en Asistente de Piso |
|---|---|---|
| `motor2/clasificador_layout.py` | Marca por geometría, sin IA, qué páginas son **diagrama o matriz** (planogramas, líneas de tiempo, cuadrículas): ahí el texto plano se lee bonito pero pierde el sentido | La capa «Lectura del PDF: débil en planogramas y datos que solo están en imagen». `src/motor/layout.js` ya separa columnas, pero no sabe qué páginas no se deben leer como texto |
| `motor2/vision_fallback.py` | Solo esas páginas van al modelo de visión, junto con el texto crudo como contexto; las demás no gastan cuota | La ficha de IA (6 páginas por petición y tope diario): el clasificador decide cuáles valen la cuota |
| `motor2/extractor.py`, `validator.py`, `generar_candidatos_ids.py`, `proponer_aplicabilidad.py` | Del manual a **criterios**: `id`, `aliases`, `texto` fiel, `peso` (MANDATORY…), `aplica_a`, `etapa_aplicable`; con autotest antes de tocar datos reales y cada criterio marcado «revisado por Gerardo» | Hoja de ruta, nivel 3: «reglas estructuradas revisadas por una persona» y «paquete del manual con vigencia». Y para el chat: una **lista de temas por manual**, la idea de YOOBIC, que sirve para decir «no está» (4/11 hoy) |
| `pipeline/knowledge/` en 3 capas | Básicos permanentes, campaña con `vigencia_inicio` y `vigencia_fin`, criterios por tipo de foto | La comparación entre campañas del nivel 3 |
| `core/mapa_evidencia.py` | Pinta sobre la foto lo que midió el código: **quemado** (luminancia > 250), **aplastado por sombra** (< 5), vacío y zonas con gráfico o texto | Revisar ya dice NO_CALIFICA por foto oscura o movida, pero no dónde está el problema. Ver dónde está quemada ayuda a repetir la foto |
| `lote/` y `verificar_lote.py` | Una carpeta de fotos → reporte HTML y Excel con conteo por severidad | Revisar es foto por foto. Un gerente con 30 fotos de WhatsApp necesita el lote |

## Fuente 2 · Trabajo terminado y aparcado en este mismo repo

- **Rama `busqueda-hibrida`: el juez de la puerta con EmbeddingGemma q4** (197 MB). Separa las
  buenas de las que no están con AUC 0.987, contra 0.892 de e5-small. Está parado hasta que
  Gerardo lo retome. De todo lo que hay, es el candidato más directo para el «no está» del
  modo manual. Lo que cuesta: bajar 197 MB al teléfono.

## Fuente 3 · Open source, modelos y datos para Revisar

| Recurso | Licencia | Para qué |
|---|---|---|
| **RF-DETR** (Nano a Large) | Apache 2.0; exporta a ONNX y TFLite | Ya está en la hoja de ruta: detector entrenado con ~200 fotos propias etiquetadas |
| **SKU-110K** (11 mil fotos de anaqueles llenos) | Un espejo dice solo uso académico y no comercial; falta leer el LICENSE oficial | Solo laboratorio: medir surtido y huecos contra miles de anaqueles. No sirve para un modelo que se distribuya |
| **Nombres de color aprendidos de fotos reales** (van de Weijer et al., CVPR 2007 / TIP 2009) | Por revisar | La falla medida de colorización: «un naranja en sombra fuerte *es* café para la cámara». Su set de eBay trae vestidos segmentados a mano por color |
| **DINOv2** | Apache 2.0 | Comparar contra una **foto de referencia** del montaje, la idea de VM Copilot (YOOBIC) y del índice de productos de Zebra. Choca con «ningún modelo juzga la foto»: solo podría ser una medida de parecido que a lo más da OBSERVACIÓN |

## Dónde entra REA aquí

En el chat, la búsqueda vive en el servidor de cada empresa y REA no la ve. En visión es
distinto: muchas apps corren el modelo en el teléfono, como el SDK de Zebra con su
reconocedor de productos y anaqueles. Ahí REA (JADX, Apktool e inventario del APK) sí
encuentra el modelo (`.tflite`, `.onnx`), el tamaño de entrada, las etiquetas y los umbrales.
Sirve para aprender la arquitectura y la calibración, no para copiar los pesos. Necesita los
APKs (como el de YOOBIC) o una cuenta de Zebra.

## Orden propuesto

1. **Chat, «no está»:** lista de temas por manual, con los criterios y aliases que genera
   `motor2`. Se mide con la batería del manual real y `lab/comparar.mjs`.
2. **Chat, lectura:** portar el clasificador de páginas diagrama a JS sobre las cajas de
   pdf.js y contar cuántas fallas medidas caen en esas páginas.
3. **Chat, decisión de Gerardo:** retomar EmbeddingGemma.
4. **Revisar:** mapa de quemado y sombra, y modo lote.
5. **Revisar con fotos propias:** nombres de color y RF-DETR, que necesitan fotos etiquetadas.

## Fuentes

- Veristack: https://github.com/GERARDOBR01/veristack (`motor2/`, `core/mapa_evidencia.py`, `schema_conocimiento_v1.md`, `lote/`)
- RF-DETR: https://rfdetr.roboflow.com/latest/ · https://huggingface.co/qualcomm/RF-DETR
- SKU-110K: https://universe.roboflow.com/storeitems/sku110k-toc01-x9b7z · https://hyper.ai/en/datasets/15771
- Nombres de color: https://lear.inrialpes.fr/people/vandeweijer/color_names.html · https://lear.inrialpes.fr/people/vandeweijer/papers/cvpr07.pdf
- Comparación con planograma (patente, solo referencia): https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/12136247
