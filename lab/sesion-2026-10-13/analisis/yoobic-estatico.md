# YOOBIC ONE — análisis estático con REA

**Insumo:** APK público `YOOBIC ONE (1).apk` (compartido por el usuario).
**Método:** solo **estático** con REA 6.4.0 (JADX 0.7.1, Apktool 2.12.1, Ghidra 12.1.4) +
inventario del paquete. La app **no se ejecutó**; no hubo emulador ni red hacia servidores de
YOOBIC. Cada bloque cita su evidencia. *Observado* = leído del artefacto; *inferido* = deducido;
*desconocido* = no comprobable sin ejecutar.

## Identidad (observado · `rea inspect-android-package`)

- `evidence_id`: `ev_ddcaef1fbdcc86800eae68c94428cd082afcd17122f7435e381845b34ed7a057`
- SHA-256 del APK: `0972172eb1c0d7c80342281c7f773d92228703e7276bbb244a4d1d409f5f0840`
- Paquete: **`com.ipelia.yoobicv3`** · versión **17.0.9** (versionCode 2081700009)
- minSdk 24 · targetSdk 36 · **35,778 clases** · 4,048 recursos · firma: no verificada (análisis estático)
- Motor de la evidencia: `jadx-headless-mcp` 0.7.1 (`artifact_sha256 6e5eacf5…`)

## Arquitectura: app híbrida **Capacitor (Angular/Ionic)** (observado)

- `assets/capacitor.config.json` → `appName: "YOOBIC ONE"`, `webDir: projects/mobile/www`.
- `assets/public/` contiene el **bundle web Angular** (esbuild: `main-*.js` + ~1,900 `chunk-*.js`,
  `ag-grid`, `webawesome`, Lottie en `animated-illustration/*.json`).
- **0 librerías nativas `.so`** en el APK (`unzip -l | grep .so$` → 0). La lógica de producto es
  **JavaScript** dentro del WebView; el DEX (35 k clases) es casi todo Capacitor + AndroidX +
  los plugins. → **Ghidra quedó listo pero sin binario propio que decompilar en este target.**
- Limitación observada de REA en este APK: `search-android-classes` falla con
  `unreadable_output` ("JADX class inventory is duplicated or differs from the loaded class
  count") por el **multidex grande con clases duplicadas**; `inspect-android-package` sí resolvió.
- REA sí **reconstruyó estáticamente el bundle JavaScript completo** (`rea
  analyze-javascript-application` sobre `assets/public/`, **1,919 módulos**, ~258 s, exit ok;
  `evidence_id ev_ca43a1be2466e16b3f90cbfba73cdefe05e4d33c8a4bb4e91d1ec9fe82345d30`). Confirmó
  que **no hay límites Electron** (0 ventanas/IPC): es una web Angular servida en WebView, no Electron.

## Capacidades por los **plugins nativos** (observado · `assets/capacitor.plugins.json`, 27)

Lo que la app puede hacer en el dispositivo se lee directo de sus plugins:

- **Foto / visión:** `@capacitor/camera`, `@capacitor-community/camera-preview`,
  `@capacitor-mlkit/barcode-scanning` (código de barras ML Kit), `@capacitor-community/media`.
- **Voz:** `@capacitor-community/speech-recognition` → **dictado voz-a-texto** (igual idea que Mylow).
- **Piso/hardware:** `@capacitor-community/bluetooth-le` (lectores/periféricos BLE),
  `@capgo/capacitor-printer` (etiquetas), `@capgo/capacitor-stream-call` (videollamada/soporte).
- **Identidad/UX:** `capacitor-native-biometric`, `@capacitor-community/intercom` (soporte/chat),
  `@capacitor/geolocation`, `@capacitor/filesystem`, `@capawesome/capacitor-file-picker`,
  `capacitor-branch-deep-links`.
- Permisos del manifiesto coherentes: `CAMERA`, `RECORD_AUDIO`, `ACCESS_FINE/COARSE_LOCATION`,
  `USE_BIOMETRIC`, `BLUETOOTH_SCAN/CONNECT`, `READ/WRITE_CALENDAR`, FCM (`c2dm`), `POST_NOTIFICATIONS`.

## Funciones de producto (observado · 42 locales i18n en `assets/public/assets/i18n/`)

El archivo `en.json` tiene **18,402 claves**; las de cada función revelan el alcance. Hay
**español (`es.json`) y español de México (`esmx.json`)** — relevante para una tienda en Guadalajara.

### 1) Asistente que responde desde documentos, con **fuentes** y **"no sé"** (clave para nosotros)
Claves `YOOBICBOT.*` y `YOOBICNEOASSISTANT.*` (paráfrasis de su comportamiento, no se copia su copy):
- Marca **NEO Assistant** ("AI Assistant – Powered by YOOBIC AI"); hay **asistentes especializados**
  y un **bot "dispatcher" + "fallback"** que enruta la pregunta (patrón multi-bot).
- **Muestra Sources** (`YOOBICBOT.SOURCES`) y un **mensaje de "no sé" configurable**
  (`YOOBICBOT.SORRY = "I don't know" message`).
- **Aviso de honestidad**: dice que la IA puede equivocarse y pide **revisar las respuestas y los
  archivos fuente** (`WARNINGACCURACYDESCRIPTION`).
- **Base de conocimiento por carpetas de documentos** (`FOLDERS`, `ADDITIONALFILES`, `URLS`, `SYNC`,
  `TOPICS` = lista de temas que el bot conoce) y aviso de visibilidad/ACL de esas carpetas.
- **Lector de texto (TTS)** opcional y **feedback 👍/👎** con descarga de los "pulgar abajo"
  (bucle de evaluación).
- **Inferido** (pistas de strings en los chunks, no verificado en runtime): backend LLM en la nube,
  con menciones a `openai` (3), `azure` (2), `anthropic` (1), `gpt-` (2).

### 2) Verificación por foto — **VM Copilot** (merchandising) + Compliance
- `imageRecognition`/`IMAGERECOGNITIONERROR` (13 archivos) y un árbol **`COMPLIANCE*`** amplio:
  las **misiones/tareas se validan** y se marcan *compliant / not compliant*, con tableros de
  cumplimiento por sitio y en el tiempo.
- Según su web, **VM Copilot** = el equipo manda una **foto** y la IA la compara con el **estándar
  de campaña/marca** (entrenada en 80 M+ fotos), con coaching en la app. Es la mitad "verificar".

### 3) Otras funciones observadas
- **Store Copilot** (`YOOBICSTORECOPILOT.*`): asistente analítico ("My Copilot", oportunidades,
  recomendaciones, plan de acción) — orientado a desempeño del sitio.
- **SmartQuiz** (`YOOBICSMARTQUIZ.*`): quizzes **generados por IA** y personalizados, con puntos.
- **Tareas/Misiones** (To-Do, campañas), **Aprendizaje/Cursos**, **Comunicación/Newsfeed**,
  **Document Library** ("Pick from Document Library"), **escaneo de código de barras**.

## Seguridad / higiene (observado, para no copiar errores)
- En `assets/capacitor.config.json` hay **claves de API de Intercom embebidas** (Android/iOS). No
  se reproducen aquí; se anota como recordatorio de **no hardcodear credenciales** en el cliente.

## Lectura para *Asistente de Piso*
YOOBIC confirma, desde un producto en producción, el **mismo principio** que ya tiene nuestra app:
**responder citando la fuente, decir "no sé", y avisar que la IA puede fallar**, más
**verificación por foto**. La diferencia es el **cómo**: YOOBIC lo hace con **RAG en la nube +
biblioteca de documentos + multi-bot**; nosotros, **100 % local (BM25) + puerta de evidencia**,
sin backend ni cuenta. El patrón a replicar (una sola pantalla *preguntar + verificar*) es
exactamente la unión de "Preguntar" y "Revisar" que ya existe en el repo.
