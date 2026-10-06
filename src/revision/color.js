// Asistente de Piso · Copyright (c) 2026 Gerardo Barrera.
// Licencia PolyForm Noncommercial 1.0.0: uso comercial solo con licencia escrita (LICENCIA-COMERCIAL.md).
//
// Colorización (ADR 0007, punto 2). Sobre una franja horizontal de la tringla:
// cada columna a CIELAB → tramos de color parecido → cálido / frío / neutro →
// la secuencia contra la regla. Todo en código y con números; sin DOM.

import { resultado, noCalifica, redondear } from './veredicto.js';

/** @typedef {import('./veredicto.js').Imagen} Imagen */
/** @typedef {import('./veredicto.js').Resultado} Resultado */
/** @typedef {'calido'|'frio'|'neutro'} Grupo */
/**
 * @typedef {Object} Tramo
 * @property {number} x0 @property {number} x1   columnas, en píxeles de la imagen
 * @property {number} L @property {number} a @property {number} b
 * @property {number} C @property {number} h
 * @property {Grupo} grupo
 * @property {number} rueda     posición dentro del grupo según la guía
 * @property {string} rgb       color medio, para la barra en pantalla
 * @property {boolean} [fueraGrupo]
 * @property {boolean} [fueraRueda]
 */

/* SUPUESTO POR CONFIRMAR con Gerardo (ADR 0007): el orden de los grupos, la
   dirección y si se revisa el orden de la rueda dentro de cada grupo. */
export const REGLA_COLOR = {
  /** @type {Grupo[]} */
  grupos: ['calido', 'frio', 'neutro'],
  /** @type {'izq-der'|'der-izq'} */
  direccion: 'izq-der',
  revisarRueda: true,
  /* Cuánto puede retroceder un tramo en la rueda sin contar como fuera de
     orden: dos rojos casi iguales no deben pelearse por 5°. */
  toleranciaTono: 28,
  toleranciaClaridad: 18,
};

/* Fronteras de tono en LCh (grados), medidas sobre los colores de la guía:
   el magenta de la guía (~350°) abre los cálidos, el amarillo (~96°) los
   cierra; el morado y el violeta (~315-325°) van en fríos. */
export const TONO = { calidoDesde: 335, calidoHasta: 102 };
export const CROMA_NEUTRO = 15;

export const NOMBRE_GRUPO = { calido: 'cálido', frio: 'frío', neutro: 'neutro' };

const LIN = new Float32Array(256);
for (let i = 0; i < 256; i++) { const c = i / 255; LIN[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }
/** @param {number} t */
const f = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);

/** sRGB (0-255) → CIELAB D65. @param {number} r @param {number} g @param {number} b */
export function lab(r, g, b) {
  return labLineal(LIN[r | 0], LIN[g | 0], LIN[b | 0]);
}

/** RGB lineal (0-1) → CIELAB D65. @param {number} R @param {number} G @param {number} B */
export function labLineal(R, G, B) {
  const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047;
  const Y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  const Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  const fy = f(Y);
  return [116 * fy - 16, 500 * (f(X) - fy), 200 * (fy - f(Z))];
}

/** CIELAB → sRGB «#rrggbb», para pintar el color medio de un tramo.
 * @param {number} L @param {number} a @param {number} b */
export function hexDeLab(L, a, b) {
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
  /** @param {number} t */
  const inv = t => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);
  const X = inv(fx) * 0.95047, Y = inv(fy), Z = inv(fz) * 1.08883;
  const rl = 3.2406 * X - 1.5372 * Y - 0.4986 * Z, gl = -0.9689 * X + 1.8758 * Y + 0.0415 * Z, bl = 0.0557 * X - 0.204 * Y + 1.057 * Z;
  /** @param {number} c */
  const g = c => Math.round(255 * Math.min(1, Math.max(0, c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)));
  return '#' + [rl, gl, bl].map(c => g(c).toString(16).padStart(2, '0')).join('');
}

/**
 * Grupo y posición en la rueda de un color, según la guía.
 * @param {number} L @param {number} C @param {number} h
 * @returns {{grupo:Grupo, rueda:number, tierra:boolean}}
 */
export function clasificar(L, C, h) {
  /* Los cafés y beiges son neutros en la guía: tono naranja, pero apagados,
     obscuros y no muy saturados, o claros. El rojo obscuro (~39°) no entra.
     Límite físico: un naranja en sombra fuerte ES café para la cámara; la
     corrección de luz con la pared (pared()) es lo que evita confundirlos. */
  const tierra = h >= 45 && h <= 95 && (C < 32 || (L < 50 && C < 62) || (L >= 60 && C < 48));
  if (C < CROMA_NEUTRO || tierra) {
    /* Neutros en el orden de la guía: tierras (café → beige), luego negro →
       gris → blanco. */
    return { grupo: 'neutro', rueda: (tierra && C >= CROMA_NEUTRO ? 0 : 100) + L, tierra };
  }
  const calido = h >= TONO.calidoDesde || h <= TONO.calidoHasta;
  if (calido) return { grupo: 'calido', rueda: (h - TONO.calidoDesde + 360) % 360, tierra: false };
  return { grupo: 'frio', rueda: h - TONO.calidoHasta, tierra: false };
}

/** Distancia de color que pesa menos la claridad: una sombra o un pliegue
 * cambian L, no el color de la prenda. */
/** @param {number[]} p @param {number[]} q */
function dist(p, q) {
  return Math.hypot((p[0] - q[0]) * 0.5, p[1] - q[1], p[2] - q[2]);
}

/** @param {number[]} v */
function mediana(v) {
  const s = Float64Array.from(v).sort();
  const n = s.length;
  return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0;
}

/**
 * Color de cada columna de la franja: mediana por canal de CIELAB.
 * @param {Imagen} img @param {{x:number,y:number,w:number,h:number}} r
 * @param {Float32Array|null} [luz] iluminación relativa por columna (1 = la más clara)
 */
export function columnas(img, r, luz = null) {
  const x0 = Math.max(0, Math.round(r.x)), x1 = Math.min(img.width, Math.round(r.x + r.w));
  const y0 = Math.max(0, Math.round(r.y)), y1 = Math.min(img.height, Math.round(r.y + r.h));
  const paso = Math.max(1, Math.floor((y1 - y0) / 40));
  /** @type {number[][]} */
  const cols = [];
  for (let x = x0; x < x1; x++) {
    const Ls = [], as = [], bs = [];
    for (let y = y0; y < y1; y += paso) {
      const k = (y * img.width + x) * 4, g = luz ? 1 / luz[x] : 1;
      const [L, a, b] = labLineal(Math.min(1, LIN[img.data[k]] * g), Math.min(1, LIN[img.data[k + 1]] * g), Math.min(1, LIN[img.data[k + 2]] * g));
      Ls.push(L); as.push(a); bs.push(b);
    }
    cols.push([mediana(Ls), mediana(as), mediana(bs)]);
  }
  return { x0, cols };
}

/** Filtro de mediana por canal a lo largo de las columnas. @param {number[][]} cols @param {number} rad */
function suavizar(cols, rad) {
  return cols.map((_, i) => {
    const v = cols.slice(Math.max(0, i - rad), i + rad + 1);
    return [0, 1, 2].map(c => mediana(v.map(p => p[c])));
  });
}

/**
 * Corta la franja en tramos de color parecido.
 * @param {Imagen} img @param {{x:number,y:number,w:number,h:number}} r
 * @param {number[]|null} [fondo] color Lab del fondo; sus columnas separan tramos
 * @param {Float32Array|null} [luz] iluminación relativa por columna
 */
export function tramos(img, r, fondo = null, luz = null) {
  const { x0, cols: crudas } = columnas(img, r, luz);
  const n = crudas.length;
  const cols = suavizar(crudas, Math.max(2, Math.round(n / 120)));
  const esFondo = cols.map(c => !!fondo && dist(c, fondo) < 9);
  /** @type {{i0:number,i1:number,suma:number[],k:number}[]} */
  const crudos = [];
  /** @type {{i0:number,i1:number,suma:number[],k:number}|null} */
  let cur = null;
  for (let i = 0; i < n; i++) {
    if (esFondo[i]) { cur = null; continue; }
    const c = cols[i];
    if (cur) {
      const k = cur.k;
      if (dist(c, cur.suma.map(s => s / k)) > 13) cur = null;
    }
    if (!cur) { cur = { i0: i, i1: i + 1, suma: [0, 0, 0], k: 0 }; crudos.push(cur); }
    cur.i1 = i + 1; cur.k++;
    for (let j = 0; j < 3; j++) cur.suma[j] += c[j];
  }
  /* Los tramos muy angostos son bordes, ganchos o reflejos: se funden con el
     vecino más parecido o se tiran si están aislados. */
  const minimo = Math.max(4, Math.round(n * 0.022));
  /** @param {{suma:number[],k:number}} t */
  const media = t => t.suma.map(s => s / t.k);
  let lista = crudos.slice();
  for (let cambio = true; cambio;) {
    cambio = false;
    for (let i = 0; i < lista.length; i++) {
      const t = lista[i];
      if (t.i1 - t.i0 >= minimo) continue;
      const izq = lista[i - 1], der = lista[i + 1];
      const pegadoIzq = izq && izq.i1 === t.i0, pegadoDer = der && der.i0 === t.i1;
      const cand = [pegadoIzq ? izq : null, pegadoDer ? der : null].filter(Boolean);
      const mejor = /** @type {typeof t|undefined} */ (cand.sort((p, q) => dist(media(/** @type {any} */ (p)), media(t)) - dist(media(/** @type {any} */ (q)), media(t)))[0]);
      if (mejor) {
        mejor.i0 = Math.min(mejor.i0, t.i0); mejor.i1 = Math.max(mejor.i1, t.i1);
        for (let j = 0; j < 3; j++) mejor.suma[j] += t.suma[j];
        mejor.k += t.k;
      }
      lista.splice(i, 1); cambio = true; break;
    }
  }
  /* Prendas iguales separadas por un hueco de fondo son un solo bloque. */
  /** @type {typeof lista} */
  const unidos = [];
  for (const t of lista) {
    const u = unidos[unidos.length - 1];
    if (u && dist(media(u), media(t)) < 10 && t.i0 - u.i1 < minimo * 2) {
      u.i1 = t.i1; u.k += t.k;
      for (let j = 0; j < 3; j++) u.suma[j] += t.suma[j];
    } else unidos.push(t);
  }
  return {
    fondoPct: esFondo.filter(Boolean).length / Math.max(1, n),
    /** @type {Tramo[]} */
    tramos: unidos.map(t => {
      const [L, a, b] = media(t);
      const C = Math.hypot(a, b), h = (Math.atan2(b, a) * 180 / Math.PI + 360) % 360;
      const { grupo, rueda } = clasificar(L, C, h);
      return { x0: x0 + t.i0, x1: x0 + t.i1, L, a, b, C, h, grupo, rueda, rgb: hexDeLab(L, a, b) };
    }),
  };
}

/**
 * Subsecuencia no decreciente de mayor peso (ancho): lo que queda fuera es el
 * mínimo de tramos que habría que mover. Así un bloque grande no sale «fuera
 * de lugar» por culpa de una prenda chica.
 * @param {number[]} claves @param {number[]} pesos @param {number} [tol]
 * @returns {boolean[]} true = dentro del orden
 */
export function enOrden(claves, pesos, tol = 0) {
  const n = claves.length, mejor = pesos.slice(), prev = new Array(n).fill(-1);
  for (let i = 0; i < n; i++) for (let j = 0; j < i; j++) {
    if (claves[j] <= claves[i] + tol && mejor[j] + pesos[i] > mejor[i]) { mejor[i] = mejor[j] + pesos[i]; prev[i] = j; }
  }
  const dentro = new Array(n).fill(false);
  let k = n ? mejor.indexOf(Math.max(...mejor)) : -1;
  while (k >= 0) { dentro[k] = true; k = prev[k]; }
  return dentro;
}

/**
 * La pared sobre la tringla: su color y cómo cae la luz de lado a lado.
 * Una sombra lateral oscurece igual la pared y las prendas; dividir entre la
 * luz de la pared en cada columna evita que un naranja en sombra se lea como
 * café. Solo cuenta como pared si su color es parejo (el brillo puede variar);
 * si las prendas llenan el cuadro hasta arriba, no hay referencia y no se
 * corrige nada.
 * @param {Imagen} img @param {{x:number,y:number,w:number,h:number}} r
 * @returns {{fondo:number[], luz:Float32Array}|null}
 */
export function pared(img, r) {
  const h = Math.max(2, Math.round(r.h * 0.06));
  const { x0, cols } = columnas(img, { x: r.x, y: r.y, w: r.w, h });
  const ma = mediana(cols.map(p => p[1])), mb = mediana(cols.map(p => p[2]));
  if (mediana(cols.map(p => Math.hypot(p[1] - ma, p[2] - mb))) > 4) return null;
  /* Luminancia relativa (Y) de la pared, suavizada, contra su parte más clara. */
  const Y = suavizar(cols, Math.max(3, Math.round(cols.length / 40))).map(p => ((p[0] + 16) / 116) ** 3);
  const tope = Float64Array.from(Y).sort()[Math.floor(Y.length * 0.9)] || 1;
  /* Además, una exposición pareja: en tienda las paredes son claras, así que
     una pared gris suele ser foto subexpuesta. Se aclara hasta L≈88, con tope
     (1.35) para no inventar luz si la pared de verdad es gris. */
  const global = Math.min(1.35, Math.max(1, 0.72 / tope));
  const luz = new Float32Array(img.width).fill(1 / global);
  Y.forEach((y, i) => { luz[x0 + i] = Math.min(1, Math.max(0.25, y / tope)) / global; });
  const Lc = mediana(cols.map((p, i) => 116 * Math.cbrt(Math.min(1, ((p[0] + 16) / 116) ** 3 / luz[x0 + i])) - 16));
  /* `luz` puede pasar de 1 en la parte más clara solo si no hubo ganancia global. */
  return { fondo: [Lc, ma, mb], luz };
}

/**
 * Revisa la colorización de una tringla.
 * @param {Imagen} img  foto ya reducida
 * @param {Object} [op]
 * @param {{x:number,y:number,w:number,h:number}} [op.marco]  lo que encuadró la guía
 * @param {typeof REGLA_COLOR} [op.regla]
 * @returns {Resultado}
 */
export function revisarColor(img, op = {}) {
  const regla = op.regla || REGLA_COLOR;
  const marco = op.marco || { x: img.width * 0.04, y: img.height * 0.1, w: img.width * 0.92, h: img.height * 0.8 };
  /* La franja va a la altura del cuerpo de las prendas: abajo de los ganchos
     y los hombros, arriba del borde de abajo. */
  const franja = { x: marco.x, y: marco.y + marco.h * 0.32, w: marco.w, h: marco.h * 0.26 };
  const malo = noCalifica(img, franja);
  if (malo) return resultado('colorizacion', 'NO_CALIFICA', malo.motivo, malo.evidencia, { franja });
  const p = pared(img, marco);
  const { tramos: ts, fondoPct } = tramos(img, franja, p && p.fondo, p && p.luz);
  /** @type {Record<string, string|number|boolean|null>} */
  const ev = { tramos: ts.length, fondo_pct: redondear(fondoPct * 100), luz_corregida: !!p, direccion: regla.direccion, orden: regla.grupos.map(g => NOMBRE_GRUPO[g]).join(' → ') };
  if (fondoPct > 0.5) return resultado('colorizacion', 'NO_CALIFICA', 'La franja casi no tiene prendas: no se distinguen del fondo.', ev, { franja, tramos: ts });
  if (ts.length < 3) return resultado('colorizacion', 'NO_CALIFICA', `Solo se ven ${ts.length} ${ts.length === 1 ? 'bloque' : 'bloques'} de color: hacen falta 3 para revisar el orden.`, ev, { franja, tramos: ts });

  const sec = regla.direccion === 'der-izq' ? ts.slice().reverse() : ts;
  const pesos = sec.map(t => t.x1 - t.x0);
  const idx = sec.map(t => regla.grupos.indexOf(t.grupo));
  const dentroGrupo = enOrden(idx, pesos);
  sec.forEach((t, i) => { t.fueraGrupo = !dentroGrupo[i]; });
  for (const g of regla.grupos) {
    if (!regla.revisarRueda) break;
    const miembros = sec.filter(t => t.grupo === g && !t.fueraGrupo);
    const tol = g === 'neutro' ? regla.toleranciaClaridad : regla.toleranciaTono;
    const ok = enOrden(miembros.map(t => t.rueda), miembros.map(t => t.x1 - t.x0), tol);
    miembros.forEach((t, i) => { t.fueraRueda = !ok[i]; });
  }
  const malos = ts.filter(t => t.fueraGrupo), rueda = ts.filter(t => t.fueraRueda);
  ev.fuera_de_grupo = malos.length;
  ev.fuera_de_rueda = rueda.length;
  ev.grupos = ts.map(t => NOMBRE_GRUPO[t.grupo][0].toUpperCase()).join('');
  const marcas = { franja, tramos: ts };
  if (malos.length) {
    const t = malos[0], i = ts.indexOf(t);
    const vecino = (ts[i - 1] && !ts[i - 1].fueraGrupo ? ts[i - 1] : ts[i + 1]) || ts[0];
    const donde = vecino.grupo !== t.grupo ? `${NOMBRE_GRUPO[t.grupo]} entre ${plural(vecino.grupo)}` : `${NOMBRE_GRUPO[t.grupo]} fuera de su grupo`;
    const extra = malos.length > 1 ? ` (y ${malos.length - 1} más)` : '';
    return resultado('colorizacion', 'GRAVE', `Rompe el orden de color: ${donde}, tramo ${i + 1} de ${ts.length}${extra}.`, ev, marcas);
  }
  if (rueda.length) {
    const t = rueda[0], i = ts.indexOf(t);
    return resultado('colorizacion', 'OBSERVACIÓN', `Los grupos van bien, pero dentro de los ${plural(t.grupo)} el tramo ${i + 1} de ${ts.length} no sigue la rueda de color.`, ev, marcas);
  }
  return resultado('colorizacion', 'CUMPLE', `${ts.length} tramos en orden: ${regla.grupos.filter(g => ts.some(t => t.grupo === g)).map(plural).join(' → ')}.`, ev, marcas);
}

/** @param {Grupo} g */
function plural(g) {
  return { calido: 'cálidos', frio: 'fríos', neutro: 'neutros' }[g];
}
