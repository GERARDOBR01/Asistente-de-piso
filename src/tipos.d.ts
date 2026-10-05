// Tipos compartidos del motor, solo para `tsc --checkJs` (npm run tipos). No
// se sirve ni se carga: los .js llevan los tipos en JSDoc y apuntan aquí.

/** Un fragmento del corpus: un trozo de lámina con de dónde salió. */
interface Fragmento {
  id: string;
  source: 'pdf' | 'manual' | string;
  docName?: string;
  page?: number;
  heading?: string;
  text: string;
  /** Frecuencia de cada término (lo llena indexChunk). */
  tf?: Record<string, number>;
  len?: number;
  hasDigits?: boolean;
}

/** Un resultado de retrieve(): el fragmento, su puntaje y cuántas palabras de la pregunta acertó. */
interface Resultado {
  c: Fragmento;
  score: number;
  hits: number;
  hitsSyn?: number;
  hitsErrata?: number;
  exigidos?: number;
}

/* El motor no puede usar el DOM (lab/motor.test.mjs lo revisa), así que lib
   no trae "dom". De la plataforma solo usa esto, que existe en el navegador y
   en Node ≥ 19. */
declare const crypto: { getRandomValues<T extends ArrayBufferView>(a: T): T };
