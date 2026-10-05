// Antes contra después, por batería, con el calificador de siempre.
//
// lab/identico.mjs dice QUÉ cambió entre dos volcados; esto dice si el cambio
// es bueno: cuántas preguntas arregla y cuántas rompe (McNemar exacta), la
// diferencia pareada con su intervalo, y cómo se mueven los estados del
// contrato de decisión (`puerta-1`). Es con lo que se juzga cada candidato de
// la Fase 3: 0 rotas en desarrollo y el «no está» no empeora.
//
// Uso:
//   node lab/comparar.mjs <dir> --antes node6 --despues f3a [--conjuntos a,b] [--detalle]
//
// <dir> es la carpeta de los volcados (`<etiqueta>__<conjunto>.jsonl`) con su
// `corpus.json`. Sale con 1 si alguna pregunta pasa de bien a mal.
import fs from 'node:fs';
import path from 'node:path';
import { calificarManual } from './calificador.mjs';
import { mcnemar, bootstrapPareado } from './estadistica.mjs';

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const dir = process.argv[2];
const A = arg('antes', 'antes'), B = arg('despues', 'despues');
const DETALLE = process.argv.includes('--detalle');
if (!dir || dir.startsWith('--')) {
  console.error('Uso: node lab/comparar.mjs <dir> --antes X --despues Y [--conjuntos a,b] [--detalle]');
  process.exit(2);
}

const leer = f => fs.readFileSync(f, 'utf8').trim().split('\n').map(l => JSON.parse(l));
const corpus = JSON.parse(fs.readFileSync(path.join(dir, 'corpus.json'), 'utf8'));
const porId = new Map(corpus.chunks.map(c => [c.id, c]));
const conjuntos = arg('conjuntos', null)?.split(',')
  || fs.readdirSync(dir).filter(f => f.startsWith(A + '__') && f.endsWith('.jsonl')).map(f => f.slice(A.length + 2, -6))
    .filter(c => fs.existsSync(path.join(dir, `${B}__${c}.jsonl`)));

const nota = f => f.falta ? { ok: false, fallo: 'falta' } : calificarManual(f, { ...f, ctx: f.ctx && f.ctx.map(id => porId.get(id)) });
const clase = f => f.tipo === 'dato' ? 'dato' : f.tipo === 'trampa' ? 'trampa' : 'no está';
const ESTADOS = ['respaldada', 'parcial', 'aclarar', 'sin_evidencia'];
const estadoDe = f => f.decisionManual?.estado || '—';
const tarjeta = c => c ? `p${c.p}«${(c.h || '').slice(0, 30)}»` : '·';

let rotasTotal = 0;
const global = { a: [], b: [] };
for (const c of conjuntos) {
  const fa = leer(path.join(dir, `${A}__${c}.jsonl`)), fb = leer(path.join(dir, `${B}__${c}.jsonl`));
  if (fa.length !== fb.length) { console.log(`✗ ${c}: ${fa.length} preguntas contra ${fb.length}`); rotasTotal++; continue; }
  console.log(`\n## ${c} (${fa.length})`);
  const filas = fa.map((a, i) => {
    const b = fb[i];
    if (a.q !== b.q) throw new Error(`${c}: la pregunta ${i} no es la misma`);
    return { a, b, na: nota(a), nb: nota(b) };
  });
  for (const k of ['dato', 'no está', 'trampa']) {
    const xs = filas.filter(f => clase(f.a) === k);
    if (!xs.length) continue;
    const oa = xs.map(f => f.na.ok ? 1 : 0), ob = xs.map(f => f.nb.ok ? 1 : 0);
    const m = mcnemar(oa, ob), d = bootstrapPareado(oa, ob);
    const suma = v => v.reduce((s, x) => s + x, 0);
    const cuenta = (lado) => ESTADOS.map(e => xs.filter(f => estadoDe(f[lado]) === e).length).join('/');
    console.log(`${k.padEnd(8)} bien ${suma(oa)} → ${suma(ob)} de ${xs.length} · arregla ${m.arregla}, rompe ${m.rompe} (p = ${m.p.toFixed(3)}) · Δ ${(100 * d.media).toFixed(1)} pts [${(100 * d.bajo).toFixed(1)}, ${(100 * d.alto).toFixed(1)}] · estados r/p/a/s ${cuenta('a')} → ${cuenta('b')}`);
    global.a.push(...oa); global.b.push(...ob);
  }
  const rotas = filas.filter(f => f.na.ok && !f.nb.ok), arregladas = filas.filter(f => !f.na.ok && f.nb.ok);
  rotasTotal += rotas.length;
  const linea = f => `  #${f.a.i} [${clase(f.a)}] «${f.a.q}»${f.a.en ? ` en ${f.a.en}` : ''} · ${estadoDe(f.a)} → ${estadoDe(f.b)}`
    + (f.nb.fallo ? ` · ${f.nb.fallo}` : '') + `\n     ${(f.a.tarjetas || []).slice(0, 3).map(tarjeta).join(' ') || '∅'} → ${(f.b.tarjetas || []).slice(0, 3).map(tarjeta).join(' ') || '∅'}`
    + (f.b.ausente ? ` · aviso: ${String(f.b.ausente).slice(0, 80)}` : '');
  if (rotas.length) { console.log('✗ Rotas:'); for (const f of rotas) console.log(linea(f)); }
  if (arregladas.length) { console.log('✓ Arregladas:'); for (const f of arregladas) console.log(linea(f)); }
  if (DETALLE) {
    const movidas = filas.filter(f => f.na.ok === f.nb.ok && estadoDe(f.a) !== estadoDe(f.b));
    if (movidas.length) { console.log('· Cambian de estado sin cambiar de nota:'); for (const f of movidas) console.log(linea(f)); }
  }
}
const m = mcnemar(global.a, global.b);
console.log(`\nTotal: arregla ${m.arregla}, rompe ${m.rompe} (p = ${m.p.toFixed(3)}).`);
process.exit(rotasTotal ? 1 : 0);
