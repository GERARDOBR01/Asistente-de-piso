// El agente lector (src/ia/agente.js) en Node, sin navegador ni red: la
// preparación (mapa, lectura anticipada, historial), el ciclo con un proveedor
// falso y sus topes, y la verificación de citas. Corpus mínimo inventado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conEstado, reiniciarCaches } from '../src/estado.js';
import { indexChunk, reconstruirIndice } from '../src/motor/indice.js';
import {
  prepararAgente, cicloAgente, nuevoEstadoAgente, ejecutarHerramienta, leerPaginaAgente,
  camposDelAgente, verificarCitas, convAGemini, historialParaModelo,
  AGENTE_MAX_RONDAS, AGENTE_MAX_PAGINAS, AGENTE_MAX_TOKENS, AGENTE_MAX_TOKENS_CORTE,
} from '../src/ia/agente.js';
import { paginasDelManual } from '../src/motor/sigue.js';

const DOC = '950 VAJILLA DEMO.pdf';
const pag = (page, heading, text) => indexChunk({ id: `${page}`, source: 'pdf', docName: DOC, page, heading, text });
const CHUNKS = [
  pag(3, 'CLASIFICACIÓN', 'La sección se divide en dos mundos: CLÁSICO y CONTEMPO.'),
  pag(4, 'CONTEMPO', 'Mundo Contempo: vajilla y cristal de diseño actual, en mesa al frente.'),
  pag(6, 'TRESVIK', 'Tresvik se exhibe en bloque junto a Kalinde, una caja por modelo.'),
];
const conManual = fn => conEstado({ docs: [{ name: DOC }], docChunks: CHUNKS, manualActivo: DOC },
  fn, () => { reiniciarCaches(); reconstruirIndice(); });
/* Sin reintentos de verdad: una llamada, y el modelo que contestó. */
const reintentos = async (_p, model, intento) => ({ ...(await intento(model)), model });
const vuelta = (o = {}) => ({ texto: '', llamadas: [], crudo: null, tokens: 10, fin: 'ok', ...o });
const FINAL = '[PENSAMIENTO INTERNO]\nEVIDENCIA: pág. 6 · TRESVIK · «se exhibe en bloque junto a Kalinde»\n[RESPUESTA FINAL]\nEn bloque junto a Kalinde (pág. 6).\nCERTEZA: ALTA';

test('agente: la preparación trae el mapa, la lectura anticipada y el historial', () => conManual(() => {
  const historial = [{ role: 'user', content: 'hola' }, { role: 'assistant', content: 'x'.repeat(500), modo: 'manual' }];
  const { estado, conv, herramientas, anticipadas } = prepararAgente({
    q: '¿cómo se exhibe tresvik?', doc: DOC, consulta: '¿cómo se exhibe tresvik?', historial, fichas: new Map(), paginas: new Map(),
  });
  assert.deepEqual(anticipadas, [6]);
  assert.ok(estado.leidas.has(6), 'lo anticipado cuenta como leído');
  assert.match(conv[0].content, /MAPA DEL MANUAL/);
  assert.match(conv[0].content, /pág\. 4 · CONTEMPO/);
  assert.equal(conv.length, 4, 'sistema, dos del historial y la pregunta');
  assert.ok(conv[2].content.length < 120, 'lo del modo manual no vuelve como fragmentos');
  assert.match(conv[3].content, /LECTURA ANTICIPADA · pág\. 6/);
  assert.ok(!herramientas.some(h => h.name === 'buscar_en_otras_secciones'), 'con un solo manual no hay otras secciones');
}));

test('agente: el ciclo lee lo que pide y contesta, con un proveedor falso', async () => conManual(async () => {
  const { estado, conv, herramientas } = prepararAgente({ q: 'contempo', doc: DOC, consulta: 'zzz', historial: [], fichas: new Map(), paginas: new Map() });
  const pedidos = [];
  const provider = { agente: async p => {
    pedidos.push(p);
    return pedidos.length === 1
      ? vuelta({ llamadas: [{ id: 'g0', name: 'leer_paginas', args: { paginas: [6] } }] })
      : vuelta({ texto: FINAL });
  } };
  const estados = [];
  const r = await cicloAgente({ estado, conv, herramientas, provider, key: 'k', model: 'm', temperature: 0.2, onEstado: t => estados.push(t), reintentos });
  assert.equal(r.texto, FINAL);
  assert.equal(r.model, 'm');
  assert.deepEqual([...r.estado.leidas.keys()], [6]);
  assert.deepEqual(r.estado.llamadas, ['leer_paginas']);
  assert.equal(r.estado.rondas, 2);
  assert.equal(r.estado.tokens, 20);
  assert.deepEqual(estados, ['Leyendo el manual · pág. 6']);
  assert.equal(pedidos[1].conv.at(-1).role, 'tool', 'la segunda vuelta lleva el resultado de la herramienta');
  assert.equal(verificarCitas(camposDelAgente(FINAL).evidencia, r.estado).malas.length, 0, 'la cita está en lo que leyó');
}));

test('agente: la última vuelta ya no puede pedir herramientas, y un tope de tokens se repite una vez', async () => conManual(async () => {
  const base = () => prepararAgente({ q: 'x', doc: DOC, consulta: 'zzz', historial: [], fichas: new Map(), paginas: new Map() });
  const forzadas = [];
  const terco = { agente: async p => {
    forzadas.push(p.forzarRespuesta);
    return p.forzarRespuesta ? vuelta({ texto: FINAL }) : vuelta({ llamadas: [{ id: 'a', name: 'leer_paginas', args: { paginas: [3] } }] });
  } };
  await cicloAgente({ ...base(), provider: terco, key: 'k', model: 'm', reintentos });
  assert.equal(forzadas.length, AGENTE_MAX_RONDAS);
  assert.deepEqual(forzadas.map(Boolean), [false, false, false, true]);

  const margenes = [];
  const corto = { agente: async p => {
    margenes.push(p.maxTokens);
    return margenes.length === 1 ? vuelta({ texto: '[PENSAMIENTO INTERNO]\nENTENDÍ: …', fin: 'corte' }) : vuelta({ texto: FINAL });
  } };
  const r = await cicloAgente({ ...base(), provider: corto, key: 'k', model: 'm', reintentos });
  assert.deepEqual(margenes, [AGENTE_MAX_TOKENS, AGENTE_MAX_TOKENS_CORTE]);
  assert.equal(r.estado.cortes, 1);

  const bloqueado = { agente: async () => vuelta({ texto: 'x', fin: 'bloqueo' }) };
  await assert.rejects(cicloAgente({ ...base(), provider: bloqueado, key: 'k', model: 'm', reintentos }), /bloqueó/);
  const mudo = { agente: async () => vuelta({ texto: '  ' }) };
  await assert.rejects(cicloAgente({ ...base(), provider: mudo, key: 'k', model: 'm', reintentos }), /sin respuesta/);
}));

test('agente: si el proveedor rechaza la imagen, la vuelta se repite sin ella', async () => {
  const paginas = new Map([[DOC, [{ page: 4, imagen: 'data:image/jpeg;base64,AAAA' }]]]);
  await conManual(async () => {
    const p = prepararAgente({ q: 'x', doc: DOC, consulta: 'zzz', historial: [], fichas: new Map(), paginas });
    let n = 0;
    const provider = { agente: async ({ conv }) => {
      n++;
      if (n === 1) return vuelta({ llamadas: [{ id: 'v', name: 'ver_lamina', args: { pagina: 4 } }] });
      if (conv.some(m => (m.imagenes || []).length)) throw Object.assign(new Error('image not supported'), { status: 400 });
      return vuelta({ texto: FINAL });
    } };
    const r = await cicloAgente({ ...p, provider, key: 'k', model: 'm', reintentos });
    assert.equal(r.texto, FINAL);
    assert.equal(n, 3);
    assert.match(p.conv.at(-1).resultados.at(-1).content, /no se pudo mandar/);
  });
});

test('agente: las herramientas validan todo y nunca truenan', () => conManual(() => {
  const est = nuevoEstadoAgente(DOC);
  assert.match(ejecutarHerramienta({ name: 'leer_paginas', args: { paginas: [99] } }, est).texto, /99 no existe/);
  assert.match(ejecutarHerramienta({ name: 'borrar_todo', args: {} }, est).texto, /no existe/);
  assert.match(ejecutarHerramienta({ name: 'buscar', args: { texto: 42 } }, est).texto, /Error/);
  assert.match(ejecutarHerramienta(null, est).texto, /no existe/);
  assert.match(ejecutarHerramienta({ name: 'ver_lamina', args: { pagina: 6 } }, est).texto, /No tengo la imagen/);
  const tope = nuevoEstadoAgente(DOC);
  for (let i = 0; i < 5; i++) ejecutarHerramienta({ name: 'leer_paginas', args: { paginas: [3, 4, 6] } }, tope);
  assert.ok(tope.leidas.size <= AGENTE_MAX_PAGINAS);
  assert.deepEqual(paginasDelManual(DOC, new Map([[DOC, [{ page: 9 }]]])), [3, 4, 6, 9], 'las páginas con solo imagen cuentan');
}));

test('agente: una cita inventada o de otra página se señala', () => conManual(() => {
  const e = nuevoEstadoAgente(DOC);
  leerPaginaAgente(e, 4); leerPaginaAgente(e, 6);
  const malas = (cita, page) => verificarCitas([{ page, cita }], e).malas;
  assert.equal(malas('vajilla y cristal de diseño actual', 4).length, 0);
  assert.equal(malas('Tresvik, Nordika y Soltera van juntos', 4).length, 1);
  assert.match(malas('se exhibe en bloque junto a Kalinde', 4)[0].motivo, /pág\. 6/);
  assert.match(malas('se divide en dos mundos', 3)[0].motivo, /no la leyó/);
}));

test('agente: la firma de pensamiento de Gemini vuelve intacta y el historial solo lleva role y content', () => {
  const g = convAGemini([{ role: 'system', content: 's' }, { role: 'user', content: 'q' },
    { role: 'assistant', content: '', llamadas: [], crudo: { gemini: [{ functionCall: { name: 'ver_lamina', args: {} }, thoughtSignature: 'FIRMA' }] } }]);
  assert.equal(g.contents[1].parts[0].thoughtSignature, 'FIRMA');
  const h = historialParaModelo([{ role: 'assistant', content: 'Tresvik (pág. 6).', entendi: '¿Cómo va Tresvik?' }]);
  assert.match(h[0].content, /Entendí: ¿Cómo va Tresvik/);
  assert.deepEqual(Object.keys(h[0]).sort(), ['content', 'role']);
});
