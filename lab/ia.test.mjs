// La IA sin pantalla (src/ia/) en Node: el parser de la respuesta y sus
// salvaguardas, la clase de cada error y el streaming de los dos proveedores
// contra un fetch simulado. Sin red ni key.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAIResponse, sanitizeFinalAnswer, certezaDe, sinLineaDeCerteza, getStreamingDisplayText,
  debeRepetirPorCorte, promptDelModo, lecturaDe, modoValido, ETAPAS_DESDE, ETAPAS_HASTA,
} from '../src/ia/respuesta.js';
import { claseDeError, errorDeProveedor } from '../src/ia/errores.js';
import { streamGemini, streamOpenAICompatible, parseOpenAIChunk, textoDeGemini } from '../src/ia/sse.js';
import { PROVIDERS, proveedorValido, razonamientoGemini, partesGemini, mensajesOpenAI } from '../src/ia/proveedores.js';
import { laminasParaVer, notaDeLaminas, LAMINAS_MAX } from '../src/ia/laminas.js';

test('ia: el parser separa el razonamiento de la respuesta, con erratas en las marcas', () => {
  const r = parseAIResponse('[PENSAMIENTO NTRNO]\nLECTURA: pág. 37\n\n[RESPUESTA FINAL AL SESOR]\n\nVan los lentes de lectura (pág. 37).');
  assert.equal(r.final, 'Van los lentes de lectura (pág. 37).');
  assert.ok(r.parsed);
  const sin = parseAIResponse('LECTURA: pág. 6 · SENSORES\nVa a 15 cm de la bastilla (pág. 6).\nCERTEZA: ALTA');
  assert.match(sin.thinking, /^LECTURA/);
  assert.match(sin.final, /^Va a 15 cm/);
  assert.deepEqual(parseAIResponse(''), { thinking: null, final: '', parsed: false });
});

test('ia: un razonamiento que no llegó a la respuesta es una respuesta cortada, y se repite una sola vez', () => {
  assert.equal(parseAIResponse('[PENSAMIENTO INTERNO]\nLECTURA: pág. 6 · SENSORES').cortada, true);
  assert.equal(parseAIResponse('Hola, ¿en qué te ayudo?').cortada, false);
  assert.equal(debeRepetirPorCorte('ETAPA 1 — Clasifico la pregunta', false), true);
  assert.equal(debeRepetirPorCorte('ETAPA 1 — Clasifico la pregunta', true), false);
});

test('ia: la respuesta limpia no lleva certeza, plantilla ni el creador sin que lo pregunten', () => {
  const t = '[PENSAMIENTO INTERNO]\nLECTURA: pág. 8 · CHECK LIST\n[RESPTESTA FINAL AL ASESOR]\n\n[Para preparar tu área, revisa que los muebles estén alineados con 80 cm de pasillo (pág. 8).]\nCERTEZA: ALTA';
  assert.equal(sanitizeFinalAnswer(parseAIResponse(t).final, 'reviso'), 'Para preparar tu área, revisa que los muebles estén alineados con 80 cm de pasillo (pág. 8).');
  assert.equal(sanitizeFinalAnswer('El manual no especifica [X].', 'algo'), 'El manual no especifica ese dato.');
  assert.doesNotMatch(sanitizeFinalAnswer('Va al centro. Fui creado por Gerardo Barrera.', '¿dónde va la mesa?'), /Gerardo/);
  assert.match(sanitizeFinalAnswer('Me creó Gerardo Barrera.', '¿quién te creó?'), /Gerardo/);
});

test('ia: la certeza declarada se lee de la última línea', () => {
  assert.equal(certezaDe('Va a 15 cm (pág. 6).\n**CERTEZA: alta**'), 'ALTA');
  assert.equal(certezaDe('El manual no lo especifica.\nCERTEZA: GAP'), 'GAP');
  assert.equal(certezaDe('Sin línea de certeza.'), null);
  assert.equal(sinLineaDeCerteza('Dato (pág. 2).\nCERTEZA: MEDIA'), 'Dato (pág. 2).');
});

test('ia: mientras escribe, se enseña solo lo que va de la respuesta final', () => {
  assert.equal(getStreamingDisplayText('[PENSAMIENTO INTERNO]\nETAPA 1'), null);
  assert.equal(getStreamingDisplayText('[PENSAMIENTO INTERNO]\nx\n[RESPUESTA FINAL AL ASESOR]\nVa a 15'), 'Va a 15');
  assert.equal(lecturaDe('LECTURA: pág. 6 · SEN'), 'pág. 6 · SEN');
  assert.equal(lecturaDe('LECTURA: pág. 6 · SEN', true), null, 'con `completa`, la línea tiene que haber terminado');
});

test('ia: el modo rápido cambia las etapas por la LECTURA, y un rol sin etapas se respeta', () => {
  const rol = `Eres el asistente.\n${ETAPAS_DESDE}\nETAPA 1…\n${ETAPAS_HASTA}\nresto`;
  assert.equal(promptDelModo(rol, 'razonado'), rol);
  const rapido = promptDelModo(rol, 'rapido');
  assert.ok(rapido.includes('LECTURA:') && !rapido.includes('ETAPA 1') && rapido.endsWith(`${ETAPAS_HASTA}\nresto`));
  assert.equal(promptDelModo('Rol a mano', 'rapido'), 'Rol a mano');
  assert.equal(modoValido('lento'), 'razonado');
});

test('ia: cada 429 es lo que es (minuto, día) y lo demás tiene su clase', () => {
  const minuto = claseDeError(429, { error: { message: 'Quota exceeded', details: [{ violations: [{ quotaId: 'GenerateRequestsPerMinutePerProjectPerModel' }] }, { retryDelay: '21s' }] } });
  assert.deepEqual(minuto, { clase: 'limite-minuto', espera: 21000 });
  assert.equal(claseDeError(429, { error: { message: 'Quota exceeded', details: [{ violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel' }] }] } }).clase, 'cuota-dia');
  assert.equal(claseDeError(429, { error: { message: 'You exceeded your current quota, please check your plan and billing details.', code: 'insufficient_quota' } }).clase, 'cuota-dia');
  assert.equal(claseDeError(503, { error: { message: 'This model is currently experiencing high demand.' } }).clase, 'saturado');
  assert.equal(claseDeError(400, { error: { message: 'API key not valid.' } }).clase, 'key');
  assert.equal(claseDeError(0, {}).clase, 'red');
  const e = errorDeProveedor(503, { error: { message: 'overloaded' } });
  assert.equal(e.status, 503);
  assert.equal(e.clase, 'saturado');
});

/* Un fetch que contesta con un cuerpo en trozos, cortados donde caiga. */
function fetchSimulado(trozos, { status = 200, json = {} } = {}) {
  const pedidos = [];
  const fetch = async (url, init) => {
    pedidos.push({ url, init });
    if (status !== 200) return new Response(JSON.stringify(json), { status });
    const enc = new TextEncoder();
    return new Response(new ReadableStream({ start(c) { for (const t of trozos) c.enqueue(enc.encode(t)); c.close(); } }));
  };
  return { fetch, pedidos };
}
async function conFetch(f, fn) {
  const antes = globalThis.fetch;
  globalThis.fetch = f;
  try { return await fn(); } finally { globalThis.fetch = antes; }
}

test('ia: el streaming de Gemini arma el texto aunque un evento llegue partido, y salta el pensamiento', async () => {
  const ev = o => 'data: ' + JSON.stringify(o) + '\n\n';
  const todo = ev({ candidates: [{ content: { parts: [{ text: 'pensando', thought: true }, { text: 'Va a ' }] } }] })
    + ev({ candidates: [{ content: { parts: [{ text: '15 cm.' }] } }], usageMetadata: { totalTokenCount: 42 } });
  const { fetch, pedidos } = fetchSimulado([todo.slice(0, 37), todo.slice(37, 90), todo.slice(90)]);
  let texto = '';
  const r = await conFetch(fetch, () => PROVIDERS.gemini.stream({ key: 'k', messages: [{ role: 'system', content: 'rol' }, { role: 'user', content: 'q' }], model: 'gemini-3.5-flash-lite', maxTokens: 100, onDelta: d => { texto += d; } }));
  assert.equal(texto, 'Va a 15 cm.');
  assert.equal(r.tokens, 42);
  assert.equal(pedidos[0].init.headers['x-goog-api-key'], 'k', 'la key va en el encabezado');
  assert.doesNotMatch(pedidos[0].url, /key=/, 'y nunca en la URL');
  const cuerpo = JSON.parse(pedidos[0].init.body);
  assert.equal(cuerpo.systemInstruction.parts[0].text, 'rol');
  assert.deepEqual(cuerpo.generationConfig.thinkingConfig, { thinkingLevel: 'MINIMAL' });
});

test('ia: el streaming de OpenAI para en [DONE] y un error sale con su clase', async () => {
  const { fetch } = fetchSimulado(['data: {"choices":[{"delta":{"content":"Ho"}}]}\n', 'data: {"choices":[{"delta":{"content":"la"}}],"usage":{"total_tokens":7}}\ndata: [DONE]\n', 'data: {"choices":[{"delta":{"content":"NO"}}]}\n']);
  let texto = '';
  const r = await conFetch(fetch, () => streamOpenAICompatible('https://x', 'k', '{}', d => { texto += d; }, null));
  assert.equal(texto, 'Hola');
  assert.equal(r.tokens, 7);
  const malo = fetchSimulado([], { status: 429, json: { error: { message: 'Rate limit reached. Please try again in 20s.', code: 'rate_limit_exceeded' } } });
  await assert.rejects(conFetch(malo.fetch, () => streamGemini('https://x', {}, {}, () => {}, null)), e => e.status === 429 && e.clase === 'limite-minuto' && e.espera === 20000);
  assert.equal(parseOpenAIChunk('event: ping'), null);
  assert.equal(textoDeGemini({}), '');
});

test('ia: proveedor y perilla de razonamiento por familia', () => {
  assert.equal(proveedorValido('github'), 'gemini', 'GitHub Models ya no existe');
  assert.equal(proveedorValido('openai'), 'openai');
  assert.deepEqual(razonamientoGemini('gemini-2.5-flash'), { thinkingBudget: 0 });
  assert.deepEqual(razonamientoGemini('gemini-3.8-flash'), { thinkingLevel: 'LOW' });
});

test('ia: qué se reintenta, qué es saturación y cuál es el respaldo', async () => {
  const { isRetryable, esSaturacion, modeloDeRespaldo, nombreCortoDeModelo, modeloAlCargar, sleep, GEMINI_RESPALDO } = await import('../src/ia/reintentos.js');
  assert.ok(isRetryable({ status: 503, message: '' }));
  assert.ok(isRetryable(new Error('Spikes in demand are usually temporary')));
  assert.ok(!isRetryable(Object.assign(new Error('x'), { name: 'AbortError', status: 503 })), 'lo que canceló el asesor no se reintenta');
  assert.ok(!isRetryable({ status: 400, message: 'bad request' }));
  assert.ok(esSaturacion(new Error('This model is currently experiencing high demand')));
  assert.ok(!esSaturacion(new Error('Failed to fetch')), 'sin señal no es saturación');
  assert.equal(modeloDeRespaldo('gemini', 'gemini-3.5-flash'), GEMINI_RESPALDO);
  assert.equal(modeloDeRespaldo('gemini', GEMINI_RESPALDO), null, 'el respaldo no tiene respaldo');
  assert.equal(modeloDeRespaldo('openai', 'gpt-4o'), null);
  assert.equal(nombreCortoDeModelo('gemini-3.5-flash-lite'), '3.5 Flash-Lite');
  assert.equal(nombreCortoDeModelo('gpt-4o-mini'), 'GPT-4o mini');
  assert.deepEqual(modeloAlCargar('gemini-3.5-flash', null, 'gemini'), { modelo: 'gemini-3.5-flash-lite', migrar: true });
  assert.deepEqual(modeloAlCargar('gemini-3.5-flash', '1', 'gemini'), { modelo: 'gemini-3.5-flash', migrar: false });
  const ac = new AbortController();
  const espera = sleep(10000, ac.signal);
  ac.abort();
  await assert.rejects(espera, e => e.name === 'AbortError');
});

/* Las láminas que son una imagen viajan como imagen (src/ia/laminas.js). */
const fr = (docName, page, text, extra = {}) => ({ docName, page, text, ...extra });
const IMG = 'data:image/jpeg;base64,QUJD';

test('láminas: va la imagen de la página con poco texto, no la de una que ya se lee', () => {
  const todos = [
    fr('demo.pdf', 17, 'Cambia en temporada de Rebajas'),
    fr('demo.pdf', 5, 'Tallaje correcto: dos chicas, dos medianas, dos grandes. '.repeat(8)),
    fr('demo.pdf', 17, 'Mundo · Tipo de producto · Segmento · Marca (lo que la IA leyó)', { isFicha: 'visual' }),
  ];
  const ctx = [todos[1], todos[0]];
  const r = laminasParaVer(ctx, todos, (d, n) => (n === 17 || n === 5 ? IMG : null));
  assert.deepEqual(r.map(l => l.page), [17]);
  assert.match(notaDeLaminas(r), /pág\. 17/);
  assert.equal(notaDeLaminas([]), '');
});

test('láminas: como mucho LAMINAS_MAX, sin repetir página y solo si hay imagen guardada', () => {
  const todos = [1, 2, 3, 4].map(n => fr('d.pdf', n, 'Corto'));
  const ctx = [todos[0], todos[0], todos[1], todos[2], todos[3]];
  const r = laminasParaVer(ctx, todos, (d, n) => (n === 1 ? null : IMG));
  assert.equal(r.length, LAMINAS_MAX);
  assert.deepEqual(r.map(l => l.page), [2, 3].slice(0, LAMINAS_MAX));
});

test('láminas: a una pregunta de marcas va la lámina de MARCAS aunque traiga texto (los logos no están en él)', () => {
  const largo = 'Tresvik Kalinde Ondera Brunell Vellut Marabú Ferrol Quintal Arenzo Pirca '.repeat(6);
  const todos = [fr('d.pdf', 14, largo, { heading: 'MUNDOS Y MARCAS · BÁSICOS' }), fr('d.pdf', 3, largo, { heading: 'CHECK LIST' })];
  assert.deepEqual(laminasParaVer(todos, todos, () => IMG, { deMarcas: true }).map(l => l.page), [14]);
  assert.deepEqual(laminasParaVer(todos, todos, () => IMG).map(l => l.page), []);
});

test('proveedores: la imagen va detrás del texto, rotulada con su página, en Gemini y en OpenAI', () => {
  const m = { role: 'user', content: 'Contexto', imagenes: [{ page: 17, dataUrl: IMG }] };
  const g = partesGemini(m);
  assert.deepEqual(g[0], { text: 'Contexto' });
  assert.deepEqual(g[1], { text: 'Imagen de la pág. 17:' });
  assert.deepEqual(g[2], { inline_data: { mime_type: 'image/jpeg', data: 'QUJD' } });
  const [o, sin] = mensajesOpenAI([m, { role: 'system', content: 'S' }]);
  assert.equal(o.content[0].text, 'Contexto');
  assert.equal(o.content[2].image_url.url, IMG);
  assert.deepEqual(sin, { role: 'system', content: 'S' });
  assert.deepEqual(partesGemini({ role: 'user', content: 'x' }), [{ text: 'x' }]);
});
