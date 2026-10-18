// Asistente de Piso · Copyright (c) 2026 Gerardo Barrera.
// Licencia PolyForm Noncommercial 1.0.0: uso comercial solo con licencia escrita (LICENCIA-COMERCIAL.md).
//
// Revisar (ADR 0007): la toma en vivo, antes de tomar la foto. Luz y nitidez
// con los mismos umbrales que `noCalifica`, y qué tan derecho está el teléfono
// según la gravedad. Avisa; no bloquea el disparo. Sin DOM: lo prueba lab/.

import { CALIDAD, calidad, exposicion } from './veredicto.js';

/** @typedef {import('./veredicto.js').Imagen} Imagen */

/**
 * Luz y nitidez de un cuadro del video, reducido igual que la foto (640 px).
 * Las dos a la vez y con su valor: `noCalifica` solo da el primer problema.
 * @param {Imagen} img @param {{x:number,y:number,w:number,h:number}} [r] la guía, en píxeles
 */
export function revisarToma(img, r) {
  const { nitidez } = calidad(img, r);
  const expo = exposicion(img);
  return {
    luz: expo >= CALIDAD.exposicionMinima,
    nitida: nitidez >= CALIDAD.nitidezMinima,
    exposicion: Math.round(expo),
    nitidez: Math.round(nitidez * 10) / 10,
  };
}

/* Qué tan derecho: hasta 2° se ve derecho en la foto; arriba de 6° ya se nota
   (las alturas del focal y las filas del surtido salen chuecas). Mirar hacia
   arriba o abajo más de 20° deforma el mueble (lo de arriba sale más chico). */
export const NIVEL = { derecho: 2, casi: 6, deFrente: 20 };

/** Lleva un ángulo a (-90, 90]: un nivel se lee igual de cabeza. @param {number} a */
const plegar = a => { let b = ((a % 180) + 180) % 180; if (b > 90) b -= 180; return b; };

/**
 * Cuánto está ladeado el teléfono (giro sobre la pantalla, + = a la derecha)
 * y cuánto mira hacia arriba o abajo, desde `accelerationIncludingGravity`.
 * Android e iOS dan la gravedad con signos opuestos: se pliega a ±90°, que es
 * lo que importa para un nivel. `angulo`: screen.orientation.angle.
 * @param {{x:number|null,y:number|null,z:number|null}} g @param {number} [angulo]
 * @returns {null|{ladeo:number, frente:number}} null sin lectura útil (en reposo plano o sin sensor)
 */
export function inclinacion(g, angulo = 0) {
  const x = g.x ?? 0, y = g.y ?? 0, z = g.z ?? 0;
  const plano = Math.hypot(x, y);
  if (g.x == null || g.y == null || plano < 2) return null;
  const ladeo = plegar(Math.atan2(-x, y) * 180 / Math.PI + angulo);
  const frente = Math.abs(Math.atan2(z, plano) * 180 / Math.PI);
  return { ladeo, frente };
}

/**
 * La lectura del sensor tiembla: promedio que olvida (α = 0.25 por lectura).
 * @param {null|{ladeo:number, frente:number}} antes @param {{ladeo:number, frente:number}} ahora
 */
export function suavizar(antes, ahora, a = 0.25) {
  if (!antes) return ahora;
  return { ladeo: antes.ladeo + a * (ahora.ladeo - antes.ladeo), frente: antes.frente + a * (ahora.frente - antes.frente) };
}

/**
 * El aviso del nivel, en palabras del piso.
 * @param {{ladeo:number, frente:number}} n
 * @returns {{ok:boolean, texto:string}}
 */
export function avisoNivel(n) {
  const l = Math.abs(n.ladeo);
  if (l > NIVEL.casi) return { ok: false, texto: `Ladeado ${Math.round(l)}°` };
  if (n.frente > NIVEL.deFrente) return { ok: false, texto: 'Ponlo de frente' };
  if (l > NIVEL.derecho) return { ok: false, texto: `Casi derecho · ${Math.round(l)}°` };
  return { ok: true, texto: 'Derecho' };
}
