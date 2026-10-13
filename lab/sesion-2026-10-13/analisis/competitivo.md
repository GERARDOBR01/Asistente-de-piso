# Los tres asistentes de piso, y en qué se diferencian

Comparación de **YOOBIC**, **Zebra Companion** y **Mylow Companion (Lowe's)** para nuestro caso:
tienda departamental, en **español**, personal de piso resolviendo dudas **parado frente al
mueble**. Fuentes en `fuentes.md`; el detalle técnico de YOOBIC (de su APK) en `yoobic-estatico.md`.

## Tabla

| | **YOOBIC** | **Zebra Companion** | **Mylow Companion (Lowe's)** |
|---|---|---|---|
| Idea central | Asistente con fuentes **+** verificación por foto en **una** plataforma | **4 agentes especializados** sobre el hardware del piso | **Adopción real a escala** en toda la cadena |
| Preguntar (Q&A) | **NEO Assistant**: RAG sobre documentos, **cita fuentes**, dice **"no sé"**, multi-bot | **Knowledge agent**: SOPs y job aids conversacionales | Producto, proyectos e **inventario**; conversacional |
| Verificar por foto | **Sí — VM Copilot**: foto vs. estándar de campaña/marca + Compliance | **Merchandising agent**: visión para detectar fallas de anaquel | **No** (no es su foco) |
| Dónde corre | App instalable (Capacitor; iOS/Android/web) | **Handhelds Android de Zebra** (sin app aparte) | **Handhelds del piso** que ya usan los asociados |
| Voz | **Voz-a-texto** (plugin speech-recognition) + TTS lector | Conversacional (sobre el handheld) | **Voz-a-texto** (dictar, no asistente hablado) |
| Español | **Sí** (`es` y `es-MX`, 42 idiomas) | No confirmado | Inglés (EE. UU.) |
| Acceso | Producto comercial, demo disponible | **Early access**, solo clientes Zebra | **Interno** de Lowe's |
| Base IA | LLM en la nube (pistas: OpenAI/Azure/Anthropic) | IA de Zebra sobre su suite frontline | **OpenAI**, misma base que el Mylow de clientes |
| Madurez probada | En producción; claims de vendor (−30 % tickets de soporte) | Knowledge y Sales ya desplegados en retailers | **~1,700 tiendas** (todas), 25 M+ preguntas (combinado) |

## Lo mejor de cada uno (y qué tomamos)

### YOOBIC — **cubre nuestras dos mitades**
Es el único que junta **preguntar con fuentes** y **verificar por foto** en una plataforma. Y su
asistente comparte **nuestro mismo principio**: muestra **Sources**, tiene **mensaje de "no sé"**
configurable y **avisa que la IA puede equivocarse** ("revisa las respuestas y los archivos
fuente"). Añade ideas aprovechables: **multi-bot con dispatcher** (enrutar la pregunta al bot de
la sección correcta), **biblioteca de documentos** como base de conocimiento, **feedback 👍/👎**
para medir, y **TTS**. → **Tomamos:** la unión *preguntar + verificar* en una sola pantalla; el
contrato de honestidad (fuente + "no sé" + aviso); el feedback como señal de evaluación.

### Zebra Companion — **agentes especializados, cero fricción de instalación**
Su fuerza es la **especialización** (Knowledge / Sales / **Merchandising** / Device) y que **corre
en el handheld que la tienda ya trae**, sin instalar otra app. El **Merchandising agent** por
visión valida el anaquel. → **Tomamos:** la idea de **asistentes por rol/sección** (encaja con el
multi-bot de YOOBIC y con nuestras "secciones") y que el **merchandising/visión** es un agente de
primera clase, no un extra. Para nosotros, "sin instalar nada" ya lo cumple la PWA en el navegador.

### Mylow Companion — **la prueba de adopción a escala**
No aporta una función nueva de montaje (es producto/inventario), pero **demuestra que un asistente
así funciona en 1,700 tiendas** en los **dispositivos que el personal ya usa**, con **voz-a-texto**
y acelerando el **onboarding**. → **Tomamos:** **voz-a-texto** como entrada de primera (manos
ocupadas frente al mueble) y el foco en **onboarding/uso real**, no en el demo.

## Conclusión para el prototipo
El patrón ganador = **una sola pantalla que une *Preguntar* (respuesta aterrizada en la fuente,
con "no sé" y aviso de incertidumbre) y *Verificar por foto* (veredicto por código, niveles de
cumplimiento)**, con **voz-a-texto** para preguntar sin teclear y una noción de **sección/rol**
(como los agentes especializados). Es exactamente lo que *Asistente de Piso* ya tiene separado en
"Preguntar" y "Revisar"; el prototipo de esta sesión los **une** y, a diferencia de los tres,
lo hace **100 % local, sin backend ni cuenta**. Prototipo en `../prototipo/`.
