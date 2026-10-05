// La compuerta de evaluación (eval-gate): ningún cambio entra si rompe una
// pregunta del corpus público que antes contestaba bien.
//
// Corre la app real sobre los manuales ficticios de eval/corpus-publico
// (lab/volcar.mjs --local), califica cada pregunta con el calificador de
// siempre (lab/calificador.mjs) y compara contra la línea base commiteada.
//
//   FALLA si una pregunta pasa de bien a mal (de punta a punta: lo que enseña
//         el modo manual, o el «no está» bien dicho), o si Hit@3 o MRR@10
//         bajan más de TOLERANCIA.
//   AVISA si una pregunta pierde el primer puesto (Hit@1) sin dejar de estar bien.
//
// Uso:
//   node lab/gate.mjs                 (vuelca y compara)
//   node lab/gate.mjs --actualizar    (vuelca y reescribe la línea base: el diff
//                                      del PR enseña qué cambió y por qué)
//   node lab/gate.mjs --datos <dir>   (usa un volcado ya hecho: <dir>/gate__bateria.jsonl)
//
// El corpus es inventado, así que esto protege contra regresiones; no dice
// cuánto acierta la app con manuales de verdad (eso se mide fuera del repo).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { calificarManual } from './calificador.mjs';
import { relevantes, porPregunta } from './metricas.mjs';
import { mcnemar, media } from './estadistica.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUB = path.join(RAIZ, 'eval', 'corpus-publico');
const BATERIA = path.join(PUB, 'bateria.json');
const LINEA_BASE = path.join(PUB, 'linea-base.json');
const TOLERANCIA = 0.02;

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const ACTUALIZAR = process.argv.includes('--actualizar');
let DATOS = arg('datos', null);

const hash = f => crypto.createHash('sha256').update(fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')).digest('hex').slice(0, 16);
const huella = hash(BATERIA);

/* ── Volcar ───────────────────────────────────────────────────────────────── */
if (!DATOS) {
  DATOS = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-'));
  execFileSync(process.execPath, [path.join(RAIZ, 'lab', 'volcar.mjs'),
    '--local', path.join(PUB, 'manuales.json'), '--corpus', DATOS,
    '--preguntas', BATERIA, '--salida', DATOS, '--etiqueta', 'gate'], { stdio: 'inherit' });
}
const leer = f => fs.readFileSync(f, 'utf8').trim().split('\n').map(l => JSON.parse(l));
const corpus = JSON.parse(fs.readFileSync(path.join(DATOS, 'corpus.json'), 'utf8'));
const filas = leer(path.join(DATOS, 'gate__bateria.jsonl'));

/* ── Calificar ────────────────────────────────────────────────────────────── */
const porId = new Map(corpus.chunks.map(c => [c.id, c]));
const preguntas = filas.map(f => {
  if (f.falta) return { i: f.i, q: f.q, tipo: f.tipo, ok: 0, falta: true };
  const c = calificarManual(f, { ...f, ctx: f.ctx && f.ctx.map(id => porId.get(id)) });
  const fila = { i: f.i, q: f.q, tipo: f.tipo, cat: f.cat || '', ok: c.ok ? 1 : 0 };
  if (f.tipo === 'dato') {
    const m = porPregunta((f.ranking || []).map(r => r[0]), relevantes(f, corpus.chunks));
    Object.assign(fila, { top1: c.top1 ? 1 : 0, hit1: m['hit@1'], hit3: m['hit@3'], rr: +m.rr.toFixed(4) });
  }
  if (!c.ok) fila.fallo = c.fallo;
  return fila;
});

const datos = preguntas.filter(p => p.tipo === 'dato');
const negativas = preguntas.filter(p => p.tipo !== 'dato');
const resumen = {
  preguntas: preguntas.length,
  datoBien: datos.filter(p => p.ok).length, dato: datos.length,
  noEstaBien: negativas.filter(p => p.ok).length, noEsta: negativas.length,
  hit1: +media(datos.map(p => p.hit1)).toFixed(4),
  hit3: +media(datos.map(p => p.hit3)).toFixed(4),
  mrr: +media(datos.map(p => p.rr)).toFixed(4),
};
const actual = { bateria: huella, version: filas.find(f => f.version)?.version || '', resumen, preguntas };

/* ── Informe ──────────────────────────────────────────────────────────────── */
const pct = x => (100 * x).toFixed(1);
const lineas = [];
const out = t => { console.log(t); lineas.push(t); };
const escribirResumen = () => {
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lineas.join('\n') + '\n');
};
const tabla = (a, b) => {
  out('| | línea base | este cambio |');
  out('| --- | --- | --- |');
  out(`| datos bien | ${a ? `${a.datoBien}/${a.dato}` : '—'} | ${b.datoBien}/${b.dato} |`);
  out(`| «no está» bien | ${a ? `${a.noEstaBien}/${a.noEsta}` : '—'} | ${b.noEstaBien}/${b.noEsta} |`);
  for (const [k, n] of [['hit1', 'Hit@1'], ['hit3', 'Hit@3'], ['mrr', 'MRR@10']]) out(`| ${n} | ${a ? pct(a[k]) : '—'} | ${pct(b[k])} |`);
};

out('## eval-gate · corpus público\n');
out(`Batería \`${huella}\` · ${preguntas.length} preguntas · app ${actual.version}\n`);

/* ── Paridad: el motor en Node contesta lo mismo que la app ───────────────────
   lab/motor-node.mjs es con lo que se barren las ideas de la puerta en
   segundos. Si deja de dar lo mismo que el navegador, esos barridos miden
   otra cosa: no pasa. */
let paridad = null;
if (corpus.motor) {
  execFileSync(process.execPath, [path.join(RAIZ, 'lab', 'motor-node.mjs'), '--corpus', DATOS,
    '--preguntas', BATERIA, '--salida', DATOS, '--etiqueta', 'node'], { stdio: 'ignore' });
  try {
    execFileSync(process.execPath, [path.join(RAIZ, 'lab', 'identico.mjs'),
      path.join(DATOS, 'gate__bateria.jsonl'), path.join(DATOS, 'node__bateria.jsonl')], { encoding: 'utf8' });
    paridad = true;
    out('Motor en Node: contesta igual que el navegador en las ' + preguntas.length + ' preguntas.\n');
  } catch (e) {
    paridad = false;
    out('✗ **Motor en Node: no contesta igual que el navegador.**\n\n```\n' + String(e.stdout || e.message).trim() + '\n```\n');
  }
}

if (ACTUALIZAR || !fs.existsSync(LINEA_BASE)) {
  fs.writeFileSync(LINEA_BASE, JSON.stringify(actual, null, 1) + '\n');
  tabla(null, resumen);
  out(`\nLínea base escrita en \`${path.relative(RAIZ, LINEA_BASE)}\`.`);
  escribirResumen();
  process.exit(paridad === false ? 1 : 0);
}

const base = JSON.parse(fs.readFileSync(LINEA_BASE, 'utf8'));
if (base.bateria !== huella) {
  out(`✗ La batería cambió (${base.bateria} → ${huella}). Si fue a propósito: \`node lab/gate.mjs --actualizar\` y commitear la línea base.`);
  escribirResumen();
  process.exit(1);
}

tabla(base.resumen, resumen);
const antes = new Map(base.preguntas.map(p => [p.i, p]));
const rotas = preguntas.filter(p => antes.get(p.i)?.ok && !p.ok);
const arregladas = preguntas.filter(p => antes.has(p.i) && !antes.get(p.i).ok && p.ok);
const sinPrimero = preguntas.filter(p => p.ok && antes.get(p.i)?.hit1 && p.hit1 === 0);
const m = mcnemar(base.preguntas.map(p => p.ok), preguntas.map(p => p.ok));
out(`\nArregla ${m.arregla}, rompe ${m.rompe} (McNemar exacta, p = ${m.p.toFixed(3)}).`);

const lista = (titulo, xs, extra = () => '') => {
  if (!xs.length) return;
  out(`\n**${titulo}**\n`);
  for (const p of xs) out(`- #${p.i} «${p.q}» (${p.cat || p.tipo})${extra(p)}`);
};
lista('Rotas: antes bien, ahora mal', rotas, p => ` → ${p.fallo}`);
lista('Arregladas', arregladas);
lista('Siguen bien pero perdieron el primer puesto', sinPrimero);

const fallas = [];
if (paridad === false) fallas.push('el motor en Node no da lo mismo que el navegador');
if (rotas.length) fallas.push(`${rotas.length} pregunta(s) rotas`);
for (const [k, n] of [['hit3', 'Hit@3'], ['mrr', 'MRR@10']])
  if (resumen[k] < base.resumen[k] - TOLERANCIA) fallas.push(`${n} baja de ${pct(base.resumen[k])} a ${pct(resumen[k])}`);

if (fallas.length) out(`\n✗ **No pasa:** ${fallas.join('; ')}.`);
else out(`\n✓ **Pasa.**${arregladas.length ? ' Hay preguntas arregladas: `node lab/gate.mjs --actualizar` para subir la línea base.' : ''}`);
escribirResumen();
process.exit(fallas.length ? 1 : 0);
