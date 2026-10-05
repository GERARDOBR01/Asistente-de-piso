// Estadística del laboratorio: intervalos de confianza y pruebas pareadas.
//
// Con 110 preguntas, una diferencia de 3 aciertos puede ser ruido. Cada
// número que sale de aquí lleva su intervalo, y cada comparación entre dos
// configuraciones dice cuántas preguntas arregla, cuántas rompe y qué tan
// probable es ver esa diferencia por azar.
//
// Todo es determinista: el remuestreo usa una semilla fija, así que la misma
// corrida da los mismos intervalos.

/* Generador con semilla (mulberry32): rápido y suficiente para remuestrear. */
export function semilla(s = 20261004) {
  let a = s >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const media = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;

function percentil(ordenados, q) {
  if (!ordenados.length) return NaN;
  const i = (ordenados.length - 1) * q, b = Math.floor(i), f = i - b;
  return b + 1 < ordenados.length ? ordenados[b] * (1 - f) + ordenados[b + 1] * f : ordenados[b];
}

/* Intervalo por bootstrap de percentiles para la media de `xs` (valores por
   pregunta: 0/1 para un acierto, el recíproco del puesto para MRR…). */
export function bootstrap(xs, { n = 10000, nivel = 0.95, rnd = semilla() } = {}) {
  const m = xs.length;
  if (!m) return { media: NaN, bajo: NaN, alto: NaN };
  const medias = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    let s = 0;
    for (let j = 0; j < m; j++) s += xs[Math.floor(rnd() * m)];
    medias[k] = s / m;
  }
  medias.sort();
  const a = (1 - nivel) / 2;
  return { media: media(xs), bajo: percentil(medias, a), alto: percentil(medias, 1 - a) };
}

/* Diferencia pareada B − A: se remuestrean PREGUNTAS, no valores sueltos, así
   que el intervalo respeta que las dos configuraciones contestaron lo mismo. */
export function bootstrapPareado(a, b, opts = {}) {
  if (a.length !== b.length) throw new Error('las dos corridas no tienen las mismas preguntas');
  return bootstrap(a.map((x, i) => b[i] - x), opts);
}

/* Coeficiente binomial en log, para que n grande no desborde. */
const lnFact = (() => { const c = [0]; return k => { for (let i = c.length; i <= k; i++) c[i] = c[i - 1] + Math.log(i); return c[k]; }; })();
const lnComb = (n, k) => lnFact(n) - lnFact(k) - lnFact(n - k);

/* McNemar exacta (binomial) para dos clasificaciones pareadas de 0/1.
   `arregla`: A falla y B acierta. `rompe`: A acierta y B falla. Las preguntas
   en las que coinciden no informan de la diferencia y no entran. */
export function mcnemar(a, b) {
  if (a.length !== b.length) throw new Error('las dos corridas no tienen las mismas preguntas');
  let arregla = 0, rompe = 0;
  for (let i = 0; i < a.length; i++) {
    if (!a[i] && b[i]) arregla++;
    else if (a[i] && !b[i]) rompe++;
  }
  const n = arregla + rompe;
  if (!n) return { arregla, rompe, p: 1 };
  const k = Math.min(arregla, rompe);
  let cola = 0;
  for (let i = 0; i <= k; i++) cola += Math.exp(lnComb(n, i) - n * Math.LN2);
  return { arregla, rompe, p: Math.min(1, 2 * cola) };
}

/* Intervalo de Wilson para una proporción: el de las tablas cuando no hace
   falta remuestrear (y el que se usa para tasas cercanas a 0 o 1, donde el
   bootstrap de percentiles se queda corto). */
export function wilson(aciertos, n, z = 1.959963984540054) {
  if (!n) return { p: NaN, bajo: NaN, alto: NaN };
  const p = aciertos / n, z2 = z * z;
  const centro = (p + z2 / (2 * n)) / (1 + z2 / n);
  const radio = (z / (1 + z2 / n)) * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n));
  /* En los extremos el límite es exacto: 0 de 24 no puede tener cota inferior
     de 1e-17 por redondeo. */
  return { p, bajo: aciertos === 0 ? 0 : Math.max(0, centro - radio), alto: aciertos === n ? 1 : Math.min(1, centro + radio) };
}
