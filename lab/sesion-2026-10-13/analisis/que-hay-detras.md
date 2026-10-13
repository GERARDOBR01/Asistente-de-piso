# Qué hay detrás de los mejores asistentes de piso, y dónde sí sirve REA

Investigación del 13 de octubre de 2026, posterior a la medición con un manual real. La pregunta
era por qué replicar a YOOBIC, Zebra y Lowe's no subió los aciertos, y cómo usar REA para ver lo
que de verdad hace buenos a los mejores del sector. Fuentes al final; *observado* = lo comprobé
desde esta sesión, *publicado* = lo dice la empresa o un tercero.

## 1. Lo que se sabe de cada uno

| Producto | Cerebro | De dónde saca la respuesta | Cómo mejora |
|---|---|---|---|
| **Lowe's · Mylow Companion** (1,700+ tiendas) | GPT-4o (OpenAI), misma infraestructura que el Mylow de clientes | Catálogo, inventario y guías de proyecto propias | Empezó como chatbot de métricas solo para gerentes; voz a texto |
| **Target · Store Companion** (~2,000 tiendas) | Equipo interno; modelo no publicado | **Preguntas frecuentes reales y documentos de proceso** de tiendas de todo el país | Piloto en ~400 tiendas con retroalimentación antes de abrirlo a todas; 6 meses de la prueba al despliegue |
| **Walmart · asistente del Me@Walmart** (3 M consultas/día) | Plataforma **Element** que enruta entre modelos de terceros y los suyos (**Wallaby**) | Guías de proceso convertidas en pasos | Su blog de ingeniería evalúa RAG con RAGAS y TruLens |
| **Home Depot · Magic Apron** | LLM; en 2026, Gemini Enterprise | Catálogo, inventario en tiempo real y **experiencia humana** que alimentan a mano | Aprende de la retroalimentación de clientes y asociados |
| **Zebra Companion** (4 agentes) | Gemini según un tercero, no confirmado | El agente de Conocimiento «siempre se basa en SOPs, ayudas de trabajo y material de capacitación oficiales» | Merchandising: **reconocimiento de imagen en el dispositivo** (AI Data Capture SDK) |
| **YOOBIC · NEO** | Nube (*observado*: la app manda la pregunta a `bot/ask/`) | Carpetas de documentos, URLs y temas declarados | 👍/👎 y descarga de los «pulgar abajo» |
| **Amazon · Rufus** (referencia, de clientes) | LLM entrenado en datos de compra | RAG sobre catálogo, reseñas, preguntas y respuestas, y APIs internas | Me gusta / no me gusta; respuesta en streaming que se «hidrata» con datos reales |

**Lo que tienen en común.** Ninguno publica cómo busca. Todos son un modelo grande en la nube más
documentos de la empresa (RAG), y lo que los separa se reduce a tres cosas:

1. **Datos curados**: preguntas reales del piso y documentos de proceso oficiales, no PDFs sueltos.
2. **Un ciclo de evaluación**: piloto con cientos de tiendas, pulgares, métricas tipo RAGAS.
3. **Integración** con inventario, precios y ubicación, que un asistente de manuales no necesita.

Asistente de Piso ya tiene el punto 1 (manuales oficiales) y una parte del 2 (`lab/`, el gate y
las baterías). Lo que no tiene, y es justo lo que no viaja en sus apps, es la calidad de búsqueda.

## 2. Dónde sí se puede ver lo de adentro

### A. Código que viaja al cliente: aquí sirve REA

REA trae herramientas web que no se usaron en la primera pasada: `analyze-web-bundle`
(con `--fetch-source-maps`), `capture-browser-scenario`, `observe-web-session`,
`inspect-web-network-capture` (HAR) y `recover-javascript-sources`.

| Objetivo | Estado desde esta sesión | Qué se vería |
|---|---|---|
| **Magic Apron** en la web de Home Depot | *Observado*: carga en Chromium sin ventana; su cliente es público (v5.2.1) con módulos `AssistantOrchestrator`, `AssistantDataProvider`, `botResponse`, `conversation`, `live`, `AssociateIcon`; sus mapas de fuente responden 200 | La forma de la respuesta: tarjetas, fuentes, cómo dice «no puedo», paso a un asociado en vivo. La búsqueda sigue en su servidor |
| **Mylow** en la web de Lowe's | *Observado*: «Access Denied» al navegador sin ventana | Nada sin un navegador real |
| **Sparky** en la web de Walmart | *Observado*: la portada carga; el asistente no aparece sin sesión | Por confirmar |
| **Zebra AI Data Capture SDK** (AAR + modelos) | *Observado*: su Maven público pide cuenta (401) | Con cuenta de Zebra: formato de los modelos en el dispositivo y el flujo «índice de productos recortados» para reconocer anaqueles; sirve para *Revisar por foto* |
| **APKs de apps de asociados** (WorkJam, Beekeeper, Axonify, Zipline) | No descargados | Si alguna corre modelos en el teléfono (`.tflite`, `.onnx`) o trae prompts embebidos, REA los encuentra como en YOOBIC |

La descarga de los mapas de fuente de Magic Apron la **bloqueó el control de permisos de la
sesión** por ser código de un tercero. Es una decisión tuya, y además ese código es solo la
interfaz: como en YOOBIC, la búsqueda vive en su servidor.

### B. Lo que publican ellos

Blogs de ingeniería (Walmart Global Tech, Amazon Science, Target Tech), comunicados con detalle
técnico (OpenAI con Lowe's, Google Cloud con Home Depot), patentes (Google Patents por titular:
Walmart, Theatro, YOOBIC), ofertas de trabajo que nombran su stack y charlas de NRF y Google
Cloud Next.

### C. Proyectos abiertos que hacen lo mismo y se leen completos

- **RAGFlow (DeepDoc):** OCR, estructura de tablas y layout antes de partir en fragmentos; las
  tablas conservan su encabezado.
- **Docling (IBM, MIT):** layout y tablas de PDF para RAG.

Desde esta sesión PyPI, npm y Hugging Face responden; GitHub fuera del repo da 403.

### D. Investigación que ataca nuestras fallas medidas

| Falla con el manual de muebles | Técnica publicada | Versión sin modelo para la app |
|---|---|---|
| «No está» bien dicho en 4/11 | **Sufficient Context** (Google, ICLR 2025): antes de responder, juzgar si el contexto alcanza; en lo que sí responde, la precisión sube 2–10 % | Una prueba de suficiencia local: ¿los términos clave de la pregunta aparecen juntos en los fragmentos que se van a enseñar? |
| 5 datos con la página correcta en otro fragmento | **Contextual Retrieval** (Anthropic): indexar cada fragmento con el contexto de su documento; −49 % de fallos de búsqueda con BM25 contextual + embeddings, −67 % con reranking | BM25 contextual: indexar cada fragmento con su título, sección y vecinos de la página (el «fragmento hermano» de la hoja de ruta) |
| 2 datos de una tabla que sale en otra página | DeepDoc / Docling | Unir la tabla con su encabezado al partir el PDF |

### E. Caja negra: comportamiento

Hacer la misma batería corta (dato, «no está», trampa) a los asistentes públicos (Magic Apron,
Rufus, Sparky) y registrar si citan, cómo dicen «no sé» y cuándo inventan. No necesita
ingeniería inversa y responde la pregunta de producto.

## 3. Cómo usar REA a nuestro favor

- **Contra la competencia, REA sirve donde el código viaja al cliente:** web públicas, APKs con
  lógica o modelos en el teléfono, SDKs. Ahí ve la forma del producto, no su búsqueda.
- **Para subir aciertos, lo útil está en D**, y se mide con el laboratorio de siempre
  (`lab/comparar.mjs` contra la batería del manual real).

## Fuentes

- Lowe's: https://openai.com/index/lowes · https://www.retail-insight-network.com/news/lowes-ai-staff-training/
- Target: https://corporate.target.com/press/release/2024/06/target-to-roll-out-transformative-genai-technology-to-its-store-team-members-chainwide · https://www.cdomagazine.tech/aiml/learn-how-targets-genai-chatbot-will-drive-productivity-of-in-store-employees
- Walmart: https://corporate.walmart.com/news/2025/06/24/walmart-unveils-new-ai-powered-tools-to-empower-1-5-million-associates/ · https://venturebeat.com/ai/walmart-bets-on-multiple-ai-models-with-new-wallaby-llm · https://medium.com/walmartglobaltech/evaluation-of-rag-metrics-using-raga-0cd9bf001a76 · https://medium.com/walmartglobaltech/deploying-rags-in-production-part-1-b31e566f81b8
- Home Depot: https://www.mytotalretail.com/article/the-home-depot-enhances-its-in-store-ai-assistant/ · https://www.googlecloudpresscorner.com/2026-01-11-The-Home-Depot-and-Google-Cloud-Launch-Agentic-AI-Tools-to-Help-Customers-and-Associates-Bring-Projects-from-How-to-to-Done
- Zebra: https://www.zebra.com/content/dam/zebra_dam/en/flyer/zebra-companion-flyer-en-us.pdf · https://www.businesswire.com/news/home/20250109443733/en/Zebra-Technologies-Introduces-New-AI-Solutions-to-Empower-Retail-Frontline-Operations · https://techdocs.zebra.com/ai-datacapture/latest/setup/ · https://techdocs.zebra.com/ai-datacapture/4-1/model/prod-recognizer/
- WorkJam: https://www.workjam.com/wp-content/uploads/2026/02/workjam_overview_2026.pdf · https://www.businesswire.com/news/home/20250602131067/en
- Amazon Rufus: https://www.amazon.science/blog/the-technology-behind-amazons-genai-powered-shopping-assistant-rufus · https://spectrum.ieee.org/amazon-rufus
- Sufficient Context: https://arxiv.org/abs/2411.06037 · https://research.google/blog/deeper-insights-into-retrieval-augmented-generation-the-role-of-sufficient-context/
- Contextual Retrieval: https://www.anthropic.com/news/contextual-retrieval
- RAGFlow / Docling: https://www.datacamp.com/tutorial/ragflow · https://www.emergentmind.com/topics/docling
- Mercado: https://www.quinyx.com/blog/what-the-2026-gartner-market-guide-for-retail-workforce-management-technology-reveals-about-ai-scheduling-and-the-future-of-the-store
