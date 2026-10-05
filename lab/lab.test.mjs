// Pruebas del laboratorio: `node --test lab/`
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootstrap, bootstrapPareado, mcnemar, wilson, semilla } from './estadistica.mjs';
import { porPregunta, relevantes, abstencion } from './metricas.mjs';
import { relevancia, tieneAlternativa, calificarManual } from './calificador.mjs';

test('el remuestreo es determinista con la misma semilla', () => {
  const xs = [1, 0, 1, 1, 0, 1, 1, 1, 0, 1];
  assert.deepEqual(bootstrap(xs, { n: 500 }), bootstrap(xs, { n: 500 }));
  const a = semilla(1), b = semilla(1);
  for (let i = 0; i < 5; i++) assert.equal(a(), b());
});

test('el intervalo contiene la media y se estrecha con más datos', () => {
  const chico = bootstrap(Array.from({ length: 20 }, (_, i) => i % 2), { n: 2000 });
  const grande = bootstrap(Array.from({ length: 2000 }, (_, i) => i % 2), { n: 2000 });
  for (const b of [chico, grande]) assert.ok(b.bajo <= b.media && b.media <= b.alto);
  assert.ok(grande.alto - grande.bajo < chico.alto - chico.bajo);
});

test('dos corridas iguales: diferencia 0 y McNemar p = 1', () => {
  const a = [1, 0, 1, 1, 0];
  const d = bootstrapPareado(a, a, { n: 500 });
  assert.equal(d.media, 0); assert.equal(d.bajo, 0); assert.equal(d.alto, 0);
  assert.deepEqual(mcnemar(a, a), { arregla: 0, rompe: 0, p: 1 });
});

test('McNemar exacta coincide con la binomial a mano', () => {
  // 8 arreglos y 1 rotura: p = 2 · P(X ≤ 1 | n=9, ½) = 2 · 10/512
  const a = [...Array(8).fill(0), 1, 1, 1], b = [...Array(8).fill(1), 0, 1, 1];
  const r = mcnemar(a, b);
  assert.equal(r.arregla, 8); assert.equal(r.rompe, 1);
  assert.ok(Math.abs(r.p - 20 / 512) < 1e-12);
});

test('Wilson no se sale de [0, 1] en los extremos', () => {
  const cero = wilson(0, 24), todo = wilson(24, 24);
  assert.equal(cero.bajo, 0); assert.ok(cero.alto > 0 && cero.alto < 0.2);
  assert.equal(todo.alto, 1); assert.ok(todo.bajo > 0.8);
});

/* Un corpus ficticio de juguete (marcas inventadas). */
const corpus = [
  { id: 'A#1', d: 'Manual Tresvik.pdf', p: 4, h: 'PASILLO', t: 'Deja 90 cm de pasillo entre muebles.' },
  { id: 'A#2', d: 'Manual Tresvik.pdf', p: 4, h: 'PASILLO', t: 'Revisa que nada estorbe.' },
  { id: 'A#3', d: 'Manual Tresvik.pdf', p: 7, h: 'SENSOR', t: 'El sensor va a 10 cm del borde.' },
  { id: 'B#1', d: 'Manual Kalinde.pdf', p: 4, h: 'PASILLO', t: 'Deja 90 cm de pasillo.' },
];
const pregunta = { q: 'cuánto pasillo dejo', tipo: 'dato', m: 'Manual Tresvik', p: [4], k: ['90 cm'] };

test('relevancia graduada: 2 con el dato, 1 la página sin el dato, 0 otro manual', () => {
  assert.equal(relevancia(pregunta, corpus[0]), 2);
  assert.equal(relevancia(pregunta, corpus[1]), 1);
  assert.equal(relevancia(pregunta, corpus[2]), 0);
  assert.equal(relevancia(pregunta, corpus[3]), 0);   // la misma cifra en otro manual no cuenta
});

test('Hit@k, MRR y nDCG de una pregunta', () => {
  const rel = relevantes(pregunta, corpus);
  const primero = porPregunta(['A#1', 'A#2', 'A#3'], rel);
  assert.equal(primero['hit@1'], 1); assert.equal(primero.rr, 1); assert.ok(Math.abs(primero.ndcg - 1) < 1e-12);
  const tercero = porPregunta(['A#3', 'A#2', 'A#1'], rel);
  assert.equal(tercero['hit@1'], 0); assert.equal(tercero['hit@3'], 1);
  assert.ok(Math.abs(tercero.rr - 1 / 3) < 1e-12);
  assert.ok(tercero.ndcg < 1 && tercero.ndcg > 0);
  assert.equal(porPregunta(['B#1'], rel)['hit@10'], 0);
});

test('abstención: «no está» acierta en negativas y cuesta en preguntas de dato', () => {
  const r = abstencion([{ tipo: 'no-esta', abstiene: true }, { tipo: 'trampa', abstiene: false }, { tipo: 'dato', abstiene: true }, { tipo: 'dato', abstiene: false }]);
  assert.deepEqual([r.negativas, r.abstieneBien, r.abstieneMal, r.respondioSinRespaldo], [2, 1, 1, 1]);
});

test('el calificador acepta el dato dicho con otras palabras pero no sin su número', () => {
  assert.ok(tieneAlternativa('Debes dejar 90 cm libres de pasillo', '90 cm de pasillo'));
  assert.ok(!tieneAlternativa('Debes dejar 80 cm libres de pasillo', '90 cm de pasillo'));
  const r = calificarManual(pregunta, { tarjetas: [{ d: 'Manual Kalinde.pdf', p: 4, h: 'PASILLO', t: 'Deja 90 cm de pasillo.' }] });
  assert.equal(r.ok, false);   // la cifra correcta en el manual equivocado
});

import { umbralConformal, coberturaPorGrupos, negativasMinimas } from './conformal.mjs';
import { semilla as sem } from './estadistica.mjs';

test('umbral conformal: el cuantil correcto y +∞ con muy pocas negativas', () => {
  const neg = Array.from({ length: 19 }, (_, i) => i + 1);   // 1..19
  assert.equal(umbralConformal(neg, 0.1), 18);                 // k = ⌈20·0.9⌉ = 18
  assert.equal(umbralConformal([1, 2, 3], 0.1), Infinity);     // k = 4 > 3
  assert.equal(negativasMinimas(0.05), 19);
});

test('la garantía se cumple en datos simulados: P(pasa una negativa) ≤ α', () => {
  // 400 calibraciones independientes de 99 negativas; en cada una se mide
  // cuántas de 1000 negativas nuevas superan el umbral. La media debe quedar
  // ≤ α (con margen de muestreo).
  const rnd = sem(7), alfa = 0.1;
  const normal = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
  let suma = 0;
  for (let r = 0; r < 400; r++) {
    const tau = umbralConformal(Array.from({ length: 99 }, normal), alfa);
    let p = 0;
    for (let j = 0; j < 1000; j++) if (normal() > tau) p++;
    suma += p / 1000;
  }
  const media = suma / 400;
  assert.ok(media <= alfa + 0.01, `tasa media ${media}`);
  assert.ok(media >= alfa - 0.03, `demasiado conservador: ${media}`);
});

test('cobertura por grupos: calibra con unos y cuenta en otros', () => {
  const filas = [];
  for (const g of ['A', 'B', 'C', 'D']) for (let i = 0; i < 30; i++) filas.push({ grupo: g, s: i / 30 });
  const r = coberturaPorGrupos(filas, 0.2);
  assert.equal(r.total, 120);
  assert.ok(r.tasa <= 0.2 + 1e-9);
});
