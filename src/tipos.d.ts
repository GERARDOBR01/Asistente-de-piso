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

/* El motor no puede usar el DOM (lab/motor.test.mjs lo revisa), así que lib
   no trae "dom". De la plataforma solo usa esto, que existe en el navegador y
   en Node ≥ 19. */
declare const crypto: { getRandomValues<T extends ArrayBufferView>(a: T): T };
