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

/** El contexto que va al modelo y qué tan sólida es la evidencia (2/1/0). */
interface Contexto { texto: string; nivel: number }

/* El motor no puede usar el DOM (lab/motor.test.mjs lo revisa), así que lib
   no trae "dom". De la plataforma solo usa esto, que existe en el navegador y
   en Node ≥ 19. */
declare const crypto: { getRandomValues<T extends ArrayBufferView>(a: T): T };
