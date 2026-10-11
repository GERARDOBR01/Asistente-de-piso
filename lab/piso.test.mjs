// Lo puro de lo que pasa en el piso, en Node: «Sigue en el manual»
// (src/motor/sigue.js), «Aprende del piso» (src/motor/aprende.js), el tablero
// y la medición (src/piso/). Corpus mínimo inventado, sin manuales.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conEstado, reiniciarCaches } from '../src/estado.js';
import { indexChunk, reconstruirIndice } from '../src/motor/indice.js';
import { siguientesDelManual, sugerenciasDeFicha, tituloDePagina, paginasDelManual } from '../src/motor/sigue.js';
import { limpiarAprendido, palabraAprendible, recortarSeccion, motivoParaNoAprender, palabrasRaras } from '../src/motor/aprende.js';
import { resumirTablero, preguntasRealesParaExamen, temaLegible } from '../src/piso/tablero.js';
import { validarExamen, calificarMedicion, resumenMedicion, tieneAlternativaMed, claveDeExamen } from '../src/piso/medicion.js';

const DOC = '101 MUEBLES DEMO.pdf';
const pag = (page, heading, text) => indexChunk({ id: `${page}`, source: 'pdf', docName: DOC, page, heading, text });
const CHUNKS = [
  pag(2, 'CLASIFICACIÓN', 'La sección se clasifica por estilos de mobiliario:\n● Nórdico\n● Industrial\n● Brutalista'),
  pag(3, 'ESTILO NÓRDICO', 'Madera clara, líneas simples y textiles en tonos neutros para la exhibición.'),
  pag(4, 'ESTILO INDUSTRIAL', 'Metal negro y madera rústica; se exhibe junto a la iluminación colgante.'),
  pag(5, 'CHECK LIST', 'Revisa el pasillo de 80 cm entre muebles.'),
  pag(9, 'LIQUIDACIÓN', 'La liquidación va al fondo de la sección con su señalización roja.'),
];
const conManual = fn => conEstado({ docs: [{ name: DOC }], docChunks: CHUNKS, manualActivo: DOC },
  fn, () => { reiniciarCaches(); reconstruirIndice(); });

test('sigue: después de la clasificación, la lámina que esta enumera; nunca el check list', () => conManual(() => {
  assert.equal(tituloDePagina(DOC, 3), 'Estilo nórdico');
  assert.equal(tituloDePagina(DOC, 5), '', 'el check list no es algo que aprender');
  const s = siguientesDelManual(DOC, [2], '¿cómo se clasifica?');
  assert.equal(s[0].pagina, 3);
  assert.ok(!s.some(x => x.pagina === 5));
  assert.deepEqual(siguientesDelManual(DOC, [], 'x'), [], 'sin páginas de dónde partir, nada');
  let pidio = false;
  siguientesDelManual(null, [2], 'x', { cubiertos: () => { pidio = true; return new Map(); } });
  assert.ok(!pidio, 'la cobertura de básicos solo se pide si hace falta');
}));

test('sigue: intercala el siguiente básico que la sección cubre, y no repite lo preguntado', () => conManual(() => {
  const cubiertos = () => new Map([['liquidacion', 9]]);
  /* Desde la pág. 2 se miran la 3, la 4 y la 5: la 9 solo llega como básico. */
  const s = siguientesDelManual(DOC, [2], '¿cómo se clasifica?', { cubiertos });
  assert.ok(s.some(x => x.pagina === 9 && x.q === '¿Dónde va la liquidación?'), JSON.stringify(s));
  const ya = siguientesDelManual(DOC, [2], '¿cómo se clasifica?', { cubiertos, preguntados: new Set(['liquidacion']) });
  assert.ok(!ya.some(x => x.q === '¿Dónde va la liquidación?'), 'el básico ya preguntado no vuelve');
  assert.ok(siguientesDelManual(DOC, [2], 'x', { cubiertos, max: 1 }).length <= 1);
  const ficha = { paginas: { 3: { temas: [], marcas: [], mundos: [], preguntas: ['¿Qué madera lleva el nórdico?'] } } };
  assert.equal(siguientesDelManual(DOC, [2], 'clasificación', { ficha })[0].q, '¿Qué madera lleva el nórdico?', 'con ficha, su pregunta');
  assert.deepEqual(sugerenciasDeFicha(ficha, [3], '¿qué madera lleva el nórdico?'), [], 'no sugiere la misma pregunta');
  assert.deepEqual(paginasDelManual(DOC, new Map([[DOC, [{ page: 12 }]]])), [2, 3, 4, 5, 9, 12]);
}));

test('aprende: solo palabras sueltas, y lo de fuera se limpia', () => {
  assert.equal(palabraAprendible('Burro'), 'burro');
  assert.equal(palabraAprendible('30%'), '');
  assert.equal(palabraAprendible('de'), '', 'una stopword no se aprende');
  const l = limpiarAprendido({ palabras: [{ piso: 'burro', manual: 'perchero', sec: '101 MUEBLES', conf: 500, origen: '<script>', extra: 1 },
    { piso: 'igual', manual: 'igual', sec: 'x' }], atajos: [{ sec: 'x', pagina: 99999, terminos: ['a'] }] });
  assert.equal(l.palabras.length, 1);
  assert.equal(l.palabras[0].conf, 99, 'con tope');
  assert.equal(l.palabras[0].origen, 'importada');
  assert.ok(!('extra' in l.palabras[0]));
  assert.equal(l.atajos.length, 0, 'página imposible');
  assert.deepEqual(limpiarAprendido(null), { v: 1, palabras: [], atajos: [] });
});

test('aprende: por qué un par no se aprende, y el recorte deja lo activo', () => conManual(() => {
  assert.equal(motivoParaNoAprender(DOC, 'burro', 'burros'), 'es la misma palabra');
  assert.equal(motivoParaNoAprender(DOC, 'burro', 'zapato'), 'el manual no la usa');
  assert.equal(motivoParaNoAprender(DOC, 'madera', 'metal'), 'el manual ya la usa');
  assert.equal(motivoParaNoAprender(DOC, 'burro', 'madera'), '');
  assert.deepEqual(palabrasRaras('¿dónde va el burro de madera?', DOC), ['burro']);
  const lista = [{ id: 'a', sec: 's', t: 1, ok: false }, { id: 'b', sec: 's', t: 2, ok: true }, { id: 'c', sec: 's', t: 3, ok: false }, { id: 'd', sec: 'otra', t: 0, ok: false }];
  assert.deepEqual(recortarSeccion(lista, 's', 2, x => x.ok).map(x => x.id), ['b', 'c', 'd'], 'se va la vieja sin confirmar');
}));

test('tablero: la misma duda dos veces es un solo hueco, y el porcentaje cuenta lo que sirvió', () => {
  const t = 1_700_000_000_000;
  const r = resumirTablero([
    { q: '¿Dónde va la liquidación?', ok: true, h: 'LIQUIDACIÓN', sec: 'MUEBLES', p: 9, t },
    { q: '¿dónde va la liquidación', ok: true, h: 'LIQUIDACIÓN', sec: 'MUEBLES', p: 9, t: t + 1, voto: 'mal' },
    { q: '¿Qué hago si se va la luz?', ok: false, sec: 'MUEBLES', t: t + 2 },
    { q: '¿que hago si se va la luz', ok: false, sec: 'MUEBLES', t: t + 3 },
  ]);
  assert.equal(r.total, 4);
  assert.equal(r.pct, 25);
  assert.equal(r.gaps.length, 1);
  assert.equal(r.gaps[0].n, 2);
  assert.equal(r.temas[0].h, 'Liquidación');
  assert.equal(temaLegible('Estilo nórdico'), 'Estilo nórdico');
  const ex = preguntasRealesParaExamen([{ q: 'burro', t, p: 3 }, { q: 'Burro', t, pl: 4, voto: 'mal' }]);
  assert.equal(ex.length, 1);
  assert.deepEqual(ex[0].p, [4], 'la página que tocó el piso vale más');
  assert.ok(ex[0].visto.noSirvio);
});

test('medición: el examen se limpia y se califica como eval/modo-ia.mjs', () => {
  const ex = validarExamen({ preguntas: [{ q: '¿Cuánto pasillo?', tipo: 'dato', k: ['80 cm'], p: ['8'], x: 1 }, { q: 'sin tipo' }, { q: '¿Luz?', tipo: 'no-esta' }] });
  assert.equal(ex.length, 2);
  assert.deepEqual(ex[0].p, [8]);
  assert.equal(ex[0].minK, 1);
  assert.ok(tieneAlternativaMed('Deja 80cm de pasillo', '80 cm'));
  const bien = calificarMedicion(ex[0], { cuerpo: 'Deja 80 cm entre muebles (pág. 8).' });
  assert.ok(bien.ok);
  const otraPag = calificarMedicion(ex[0], { cuerpo: 'Deja 80 cm (pág. 3).', paginasVistas: [3] });
  assert.ok(!otraPag.ok);
  assert.equal(otraPag.capa, 'búsqueda (el dato no llegó)');
  assert.ok(calificarMedicion(ex[1], { cuerpo: 'El manual no especifica eso.' }).ok);
  assert.equal(calificarMedicion(ex[1], { cuerpo: 'Apaga la luz.' }).capa, 'contestó algo que no está');
  const res = resumenMedicion([{ motor: 'manual', tipo: 'dato', ok: true, dato: true, pagina: true, tTotal: 1000 }, { motor: 'manual', tipo: 'no-esta', ok: false, tTotal: 3000 }]);
  assert.equal(res.manual.aciertos, '1/1');
  assert.equal(res.manual.noEstaBienDicho, '0/1');
  assert.equal(claveDeExamen({ examen: 'a' }, ex), claveDeExamen({ examen: 'a' }, ex));
  assert.notEqual(claveDeExamen({ examen: 'a' }, ex), claveDeExamen({ examen: 'b' }, ex));
});
