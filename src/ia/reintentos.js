// Asistente de Piso · Copyright (c) 2026 Gerardo Barrera.
// Licencia PolyForm Noncommercial 1.0.0: uso comercial solo con licencia escrita (LICENCIA-COMERCIAL.md).
//
// Reintentos y respaldo, la parte pura: cuánto esperar, qué error se
// reintenta, qué es saturación, cuál es el modelo de respaldo y cómo se nombra
// cada modelo en pantalla.
//
// Salió de app.js en el paso 7 del ADR 0005, sin cambiar nada de lo que hace.
// El bucle (conReintentos) se queda en app.js: recuerda el respaldo activo y
// avisa en pantalla.
import { PROVIDERS, proveedorValido } from './proveedores.js';

/* ════════════════════════════════════════════════
   REINTENTOS Y RESPALDO
   1s, 2s, 4s. Antes eran seis (1, 2, 4, 8, 16 y 30 s): con Gemini saturado se
   iba casi un minuto y medio antes de ver el error, y en el piso nadie espera
   eso con el cliente enfrente. Ahora, si el modelo elegido sale saturado dos
   veces seguidas, contesta el de respaldo.
════════════════════════════════════════════════ */
export const RETRY_DELAYS = [1000, 2000, 4000];
/* Silencio máximo del proveedor antes de cortar la espera (ver sendMessage). */
export const ESPERA_MAX = 45000;
export const RETRYABLE_HTTP = [408, 425, 429, 500, 502, 503, 504];
/* «temporarily» no casaba con lo que responde GitHub Models cuando está al tope:
   "Spikes in demand are usually temporary". Sin código HTTP en el mensaje, no se
   reintentaba y salía el "Error inesperado" genérico, que en el piso se lee como
   que la app está rota. Falta de dos letras. */
export const RETRYABLE_KEYWORDS = ['rate limit','too many','quota','temporarily','temporary','high demand','overloaded','over capacity','capacity','congestion','try again later','unavailable','fetch failed','network','econnreset','etimedout'];

/* El respaldo es 3.5 Flash-Lite y no 2.5 Flash: Google dejó los 2.5 solo a
   cuentas que ya los usaban, así que con una key nueva el respaldo también
   fallaba. Flash-Lite es estable, es el más rápido y entra en el plan gratis. */
export const GEMINI_RESPALDO = 'gemini-3.5-flash-lite';
export const RESPALDO_TRAS = 2;                  // saturaciones seguidas antes de cambiar
export const RESPALDO_MEMORIA = 10 * 60 * 1000;  // mientras tanto, las siguientes van directo

/** @param {string} provider @param {string | null | undefined} model @returns {string | null} */
export function modeloDeRespaldo(provider, model) {
  if (provider !== 'gemini' || !model || model === GEMINI_RESPALDO) return null;
  return GEMINI_RESPALDO;
}
/* Saturación o cuota, no la red: sin señal cambiar de modelo no arregla nada, y
   dejaría el elegido de lado diez minutos por un túnel. */
/** @param {any} err @returns {boolean} */
export function esSaturacion(err) {
  if (err?.status === 429 || err?.status === 503) return true;
  return /high demand|overloaded|over capacity|capacity|quota|rate limit|too many|resource.?exhausted|unavailable/i.test(err?.message || '');
}

/* «gemini-3.5-flash-lite» → «3.5 Flash-Lite», que es como cabe en la tarjeta. */
/** @param {string | null | undefined} model @returns {string} */
export function nombreCortoDeModelo(model) {
  const m = (model || '').match(/^gemini-([\d.]+)-flash(-lite)?/);
  if (m) return `${m[1]} Flash${m[2] ? '-Lite' : ''}`;
  return (model || '').replace(/^gpt-/, 'GPT-').replace(/-mini$/, ' mini');
}
/* En el selector de Ajustes va para qué sirve cada uno, no solo su nombre: con
   cuatro Flash casi iguales, elegir sin eso es adivinar. */
/** @type {Record<string, string>} */
export const PARA_QUE_MODELO = {
  'gemini-3.5-flash-lite': 'el más rápido, el de las mediciones',
  'gemini-3.5-flash': 'suele salir saturado',
  'gemini-3.8-flash': 'piensa más, ~6 s por respuesta',
};
/** @param {string} model @returns {string} */
export function etiquetaDeModelo(model) {
  const para = PARA_QUE_MODELO[model];
  return nombreCortoDeModelo(model) + (para ? ` · ${para}` : '');
}
/* 3.5 Flash era el de fábrica, y casi todos lo tienen guardado solo porque
   pulsaron «Guardar» al pegar la key. Una sola vez se pasa al de fábrica nuevo;
   quien después elija 3.5 a propósito, se lo queda. */
/** @param {string | null} guardado @param {string | null} yaMigrado @param {string} proveedor @returns {{modelo: string, migrar: boolean}} */
export function modeloAlCargar(guardado, yaMigrado, proveedor) {
  const deFabrica = /** @type {Record<string, {chatModels: string[]}>} */(PROVIDERS)[proveedorValido(proveedor)].chatModels[0];
  if (!guardado) return {modelo: deFabrica, migrar: false};
  if (guardado === 'gemini-3.5-flash' && !yaMigrado) return {modelo: PROVIDERS.gemini.chatModels[0], migrar: true};
  return {modelo: guardado, migrar: false};
}

/** @param {any} err @returns {boolean} */
export function isRetryable(err) {
  if (err?.name === 'AbortError') return false;
  if (RETRYABLE_HTTP.includes(err?.status)) return true;
  const msg = (err?.message || '').toLowerCase();
  const code = msg.match(/(\d{3})/)?.[1];
  if (code && RETRYABLE_HTTP.includes(parseInt(code, 10))) return true;
  return RETRYABLE_KEYWORDS.some(k => msg.includes(k));
}

/** @param {number} ms @param {AbortSignal | null} [signal] @returns {Promise<void>} */
export async function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('Aborted', 'AbortError')); }, {once: true});
  });
}

/* El límite por minuto: cuánto se espera y cuántas veces. */
export const LIMITE_MINUTO_ESPERA_MAX=65000;   // el límite por minuto se reinicia a los 60 s
export const LIMITE_MINUTO_ESPERAS=2;          // dos esperas completas sin éxito: es el día, no el minuto
