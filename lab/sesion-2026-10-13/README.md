# Sesión Labs — 2026-10-13

Trabajo de un día, **aislado** aquí para no tocar la app real. Si sale bien, luego se habla de
llevar algo de esto al código de producción. Nada fuera de esta carpeta se modificó.

## Qué se hizo

1. **REA al 100 %** — se instaló *Reverse Engineer Anything* con todos sus motores
   (JADX 0.7.1, Apktool 2.12.1, **Ghidra 12.1.4**, Chromium) y `rea doctor` quedó verde.
   → `rea/INSTALACION.md`
2. **Análisis con REA** del APK público de **YOOBIC ONE** (estático) + investigación de
   **Zebra Companion** y **Mylow (Lowe's)**.
   → `analisis/yoobic-estatico.md`, `analisis/competitivo.md`, `analisis/fuentes.md`
3. **Prototipo** que replica lo mejor de los tres en **una sola pantalla**: *Preguntar*
   (respuesta con su fuente, y “no sé” cuando no hay evidencia) + *Revisar por foto*
   (veredicto por código). → `prototipo/`

## Hallazgo principal

YOOBIC, en producción, sigue **el mismo principio que nuestra app**: su asistente **cita
fuentes**, tiene **mensaje de “no sé”** y **avisa que la IA puede equivocarse**; y además
**verifica por foto** (VM Copilot). La diferencia es el *cómo*: YOOBIC usa **RAG en la nube +
biblioteca de documentos + multi-bot**; nosotros, **100 % local (BM25) + puerta de evidencia**,
sin backend ni cuenta. Zebra aporta la idea de **asistentes por rol/sección**; Mylow, la de
**voz a texto** y uso real a escala. El prototipo une las dos mitades que la app ya tiene
separadas (“Preguntar” y “Revisar”).

## El prototipo

- Reutiliza, en **solo lectura**, el **motor real** (`src/motor/*`, vía `respuestaSinModelo`) y
  la **puerta de calidad real** de la foto (`src/revision/veredicto.js`, `noCalifica`). No
  reimplementa búsqueda ni veredicto, y **no modifica `src/`**.
- Datos **100 % sintéticos** (`prototipo/datos-demo.mjs`), sin red y sin cuenta.
- Añade **voz a texto** (Web Speech API) y un **selector de sección** (asistente por sección).

### Probarlo
Se sirve desde la **raíz del repo** (los imports apuntan a `../../../src/…`):
```sh
python3 -m http.server 9777
# abrir: http://127.0.0.1:9777/lab/sesion-2026-10-13/prototipo/index.html
```
Vista previa: `prototipo/vista-previa.png`.

### Verificado en esta sesión
- Motor: «¿dónde van las sandalias?» → **RESPALDADA**, cita *Campaña Verano · pág. 3*.
  «¿qué hago si se va la luz?» (trampa) → **NO SÉ**. «¿cómo se acomodan las sábanas?» →
  **NO SÉ**, con “quizá esté en la sección «BLANCOS · Sábanas»”.
- UI en Chromium headless: badge y fuentes correctos, trampa en **NO SÉ**, y
  **0 peticiones de red externas** (todo local).

## Qué NO se tocó
`index.html`, `src/`, `sw.js`, el CI y el resto de `lab/`. El APK, los JARs, Ghidra y los
volcados de REA se quedaron en el scratchpad de la sesión (fuera del repo); sus versiones y
hashes están en `rea/INSTALACION.md`.

## Nota de método (clean-room)
Del APK de YOOBIC se tomaron **conceptos y comportamiento**, no código, recursos, marcas ni
assets. No se reprodujo ninguna credencial ni cadena propietaria. El prototipo es original y
usa datos inventados, igual que la demo pública del repo.
