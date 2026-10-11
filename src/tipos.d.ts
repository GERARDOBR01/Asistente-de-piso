// Tipos compartidos del motor, solo para `tsc --checkJs` (npm run tipos). No
// se sirve ni se carga: los .js llevan los tipos en JSDoc y apuntan aquí.

/** Un fragmento del corpus: un trozo de lámina con de dónde salió. */
interface Fragmento {
  id: string;
  source: 'pdf' | 'manual' | string;
  docName: string;
  page?: number;
  heading?: string;
  text: string;
  /** Frecuencia de cada término (lo llena indexChunk). */
  tf?: Record<string, number>;
  len?: number;
  hasDigits?: boolean;
  /** Las láminas que acompañan al fragmento (las llena la detección de figuras). */
  figureIds?: string[];
  /** La ficha que escribió la IA: 'indice' apunta a una página, 'visual' transcribe una imagen. */
  isFicha?: 'indice' | 'visual' | string;
  /** Una figura descrita por IA. */
  isFigure?: boolean;
  /** Fragmento sin una sola frase (lo calcula esRotulo y lo guarda aquí). */
  rotulo?: boolean;
}

/** Un fragmento ya indexado: indexChunk le puso sus términos. */
interface FragmentoIndexado extends Fragmento {
  tf: Record<string, number>;
  len: number;
  hasDigits: boolean;
}

/** Un resultado de retrieve(): el fragmento, su puntaje y cuántas palabras de la pregunta acertó. */
interface Resultado {
  c: Fragmento;
  score: number;
  hits: number;
  /** Aciertos por el diccionario de sinónimos. */
  hitsSyn: number;
  /** Aciertos por una errata corregida. */
  hitsErrata: number;
  /** Cuántas palabras se le exigen para ser sólido (exigenciaDeSolidez). */
  exigidos?: number;
  /** Lo subió un atajo que aprendió el piso. */
  atajo?: boolean;
  /** Entró por coincidencia floja en el modo manual (coincidenciaFloja). */
  flojo?: boolean;
}

/** Un término de la búsqueda: la forma (`t`), su peso (`w`) y la palabra del
    asesor de la que salió (`g`; «~» si es del diccionario, «!» si es errata). */
interface Termino { t: string; w: number; g: string }

interface OpcionesDeBusqueda {
  /** 'pdf' o 'manual'; sin él, los dos. */
  source?: string | null;
  limit?: number;
  /** Solo los fragmentos de este manual. */
  doc?: string | null;
}

/** Una sección que se puede nombrar en una pregunta, y con qué palabras. */
interface Identificador {
  docName: string;
  nombre: string;
  terminos: string[];
  /** La palabra con que la nombró la pregunta (seccionesNombradasEnPregunta). */
  termino?: string;
}

/** Una palabra (o un par) de la pregunta que la sección activa no tiene, y
    qué otras secciones sí (terminosAusentes). */
interface Ausente {
  palabra: string;
  duenos: Array<{ docName: string, n: number }>;
  /** El par de palabras, no una suelta. */
  frase?: boolean;
  /** No está en ningún manual cargado. */
  enNinguno?: boolean;
}

/** Lo que ya se sabe de una pregunta cuando la puerta decide (contratoDeDecision). */
interface HechosDeDecision {
  /** La pregunta escrita. */
  pregunta: string;
  /** La consulta con que se buscó (ampliada o rescatada, si fue el caso). */
  consulta: string;
  seccion?: string | null;
  /** La sección la eligió la pregunta, no el selector. */
  porPregunta?: boolean | string;
  /** 2 sólido · 1 flojo · 0 nada (nivelDeEvidencia). */
  nivel: number;
  /** Lo que entró al contexto del modelo, o las tarjetas del modo manual. */
  evidencia: Fragmento[];
  otraSeccion?: { nombre?: string, docName?: string, motivo: string } | null;
  /** Las secciones que empatan: la respuesta es preguntar en cuál está. */
  empate?: string[];
  ausentes?: Ausente[];
  /** Se preguntó «¿cuántos?» o un porcentaje y ninguna tarjeta trae la cifra. */
  avisoCifra?: boolean;
  /** La tarjeta llegó solo por el diccionario («lo encontré como…»). */
  parecidas?: boolean;
  variasSecciones?: boolean;
  ampliada?: boolean;
  /** Pregunta por la app o por los manuales cargados, no por una regla. */
  deLaApp?: boolean;
  /** Operación de tienda (la luz, la caja, el horario): de ningún manual. */
  operacion?: boolean;
}

type EstadoDeDecision = 'respaldada' | 'parcial' | 'aclarar' | 'sin_evidencia';

/** El contrato de decisión de la puerta: la misma forma en el modo IA y en el manual. */
interface Decision {
  consultaResuelta: string;
  alcance: { seccion: string | null, porPregunta: boolean, alternativas?: string[] };
  estado: EstadoDeDecision;
  /** Los fragmentos que la respaldan, sin repetir. */
  evidencia: Array<{ id: string, doc: string, pagina: number | null }>;
  /** Palabras de tema de la pregunta escritas en la evidencia. */
  cubiertas: string[];
  /** Palabras de la pregunta que la sección no tiene (terminosAusentes). */
  faltan: string[];
  /** Por qué, en códigos estables: 'coincidencia-floja', 'palabra-ausente'… */
  razones: string[];
  versionPolitica: string;
}

/** Una tarjeta del modo manual: el fragmento y el texto que se enseña. */
interface Tarjeta { c: Fragmento; texto: string }

/** El contexto que va al modelo y qué tan sólida es la evidencia (2/1/0). */
interface Contexto { texto: string; nivel: number }

/** Un turno de la conversación, como lo guarda la app. `seccion`: el manual
    con que se respondió (de ahí sigue un «¿y en…?»). */
interface Turno { role: 'user' | 'assistant' | string; content: string; seccion?: string | null; modo?: string }

/** Contra qué sección se responde una pregunta y por qué
    ('elegida', 'nombrada', 'evidencia', 'seguimiento', 'empate', 'ninguna'…). */
interface Ruta { q: string; doc: string | null; motivo: string; alternativas: string[] }

/** La otra sección a la que apunta una pregunta: la nombró, o tiene lo que esta no. */
interface OtraSeccion { nombre?: string; docName?: string; motivo: string }

/** La sección de la pregunta (seccionDeLaPregunta). `porPregunta`: el rótulo de
    por qué la eligió la app, o false si la eligió el asesor. */
interface Seccion { doc: string | null; otraSeccion: OtraSeccion | null; porPregunta: boolean | string }

/** Lo que contesta el modo manual, antes de pintarlo (respuestaSinModelo). */
interface RespuestaSinModelo {
  tipo: 'saludo' | 'estado' | 'empate' | 'tarjetas' | 'nada';
  decision: Decision | null;
  ruta?: Ruta;
  sec?: Seccion;
  activo?: string | null;
  relevantes?: Resultado[];
  tarjetas?: Tarjeta[];
  /** Las tarjetas como texto, con su rótulo: lo que se guarda en el historial. */
  fragmentos?: string;
  nombrada?: OtraSeccion | null;
  enOtra?: string | null;
  ausentes?: Ausente[];
  /** El aviso de palabra ausente o de cifra que falta ('' si no hay). */
  avisoAusente?: string;
  porParecidas?: Array<{ dijo: string, k: string, como: string }>;
  /** «Tu manual no dice X; lo encontré como Y» ('' si no hay). */
  avisoParecidas?: string;
  /** Nota de coincidencia floja ('' si no hay). */
  avisoFlojo?: string;
  seccionDelTurno?: string | null;
}

/** Lo que recibe el modelo (contextoParaModelo). */
interface ContextoDelModelo {
  texto: string;
  sinCoincidencias: boolean;
  flojo: boolean;
  ampliada: boolean;
  nivel: number;
  otraSeccion: OtraSeccion | null;
  variasSecciones: boolean;
  ausentes: Ausente[];
  /** La pregunta era por la app, no por el manual. */
  estado?: boolean;
  seccionUsada: string | null;
  seccionPorPregunta: boolean | string;
  /** La única otra sección que tiene las palabras que faltan. */
  seccionSugerida: { docName: string, nombre: string } | null;
  decision: Decision;
}

/* El motor no puede usar el DOM (lab/motor.test.mjs lo revisa), así que lib
   no trae "dom". De la plataforma solo usa esto, que existe en el navegador y
   en Node ≥ 19. */
declare const crypto: { getRandomValues<T extends ArrayBufferView>(a: T): T };

/* Revisión con foto (src/revision/): lo mínimo de las APIs comunes a Node y al
   navegador que usan las piezas puras. */
declare class TextEncoder { encode(s?: string): Uint8Array }
declare class TextDecoder { constructor(etiqueta?: string, opciones?: { fatal?: boolean }); decode(b?: ArrayBufferView, opciones?: { stream?: boolean }): string }

/* La IA (src/ia/): fetch y su respuesta por streaming, como las tienen el
   navegador y Node â‰¥ 18. Solo lo que se usa. */
interface AbortSignal { readonly aborted: boolean; addEventListener(tipo: 'abort', fn: () => void, opciones?: { once?: boolean }): void }
declare class DOMException extends Error { constructor(mensaje?: string, nombre?: string) }
declare function setTimeout(fn: () => void, ms?: number): number;
declare function clearTimeout(id?: number): void;
interface RespuestaHttp {
  ok: boolean;
  status: number;
  json(): Promise<any>;
  body: { getReader(): { read(): Promise<{ value?: Uint8Array, done: boolean }> } };
}
declare function fetch(url: string, init?: { method?: string, headers?: Record<string, string>, body?: string, signal?: AbortSignal | null }): Promise<RespuestaHttp>;

/** Un mensaje para el modelo, con el formato de OpenAI. */
interface MensajeIA { role: string; content: any }
/** El error de un proveedor, con su cÃ³digo HTTP y su clase (claseDeError). */
interface ErrorDeProveedor extends Error { status?: number; clase?: string; espera?: number | null }
/** La imagen guardada de una pÃ¡gina al cargar el PDF. */
interface PaginaGuardada { page: number; titulo?: string; imagen?: string }
/** Lo que la IA escribiÃ³ de cada pÃ¡gina al leer el manual (la ficha). */
interface FichaPagina { titulo?: string; resumen?: string; temas: string[]; marcas: string[]; mundos: string[]; alias?: string[]; texto_visual?: string; [k: string]: unknown }
interface FichaManual { version?: number; modelo?: string; fecha?: number; paginas: Record<string, FichaPagina> }
/** Una herramienta que pidiÃ³ el modelo. */
interface LlamadaAgente { id: string; idReal?: boolean; name: string; args: any }
/** Lo que lleva el agente de una pregunta: quÃ© leyÃ³, quÃ© vio, cuÃ¡nto gastÃ³. */
interface EstadoAgente {
  doc: string;
  paginas: Map<string, PaginaGuardada[]>;
  leidas: Map<number, string>;
  vistas: Set<number>;
  chunks: Fragmento[];
  otras: Array<{ docName: string, nombre: string | null, paginas: Array<number | undefined> }>;
  rondas: number;
  tokens: number;
  imagenes: number;
  llamadas: string[];
  cortes?: number;
}
/** Un mensaje de la conversaciÃ³n interna del agente, neutral entre proveedores. */
interface MensajeAgente {
  role: string;
  content?: any;
  llamadas?: LlamadaAgente[];
  crudo?: { gemini?: any[] } | null;
  resultados?: Array<{ id: string, idReal?: boolean, name: string, content: string }>;
  imagenes?: Array<{ page: number, dataUrl: string }>;
}
/** Lo que devuelve una vuelta del agente con cualquier proveedor. */
interface VueltaAgente { texto: string; llamadas: LlamadaAgente[]; crudo: { gemini?: any[] } | null; tokens: number; fin: string; model?: string }
/** Lo que recibe el adaptador de cada proveedor en cada vuelta. */
interface ParamsAgente {
  key: string;
  model: string;
  conv: MensajeAgente[];
  herramientas?: Array<{ name: string, description: string, parameters: object }>;
  forzarRespuesta?: boolean;
  maxTokens: number;
  temperature?: number | null;
  onDelta?: (t: string) => void;
  signal?: AbortSignal | null;
}
/** Lo que recibe el streaming de cada proveedor. */
interface ParamsStream {
  key: string;
  messages: MensajeIA[];
  model: string;
  maxTokens: number;
  temperature?: number | null;
  onDelta: (t: string) => void;
  signal?: AbortSignal | null;
}
declare function atob(s: string): string;
