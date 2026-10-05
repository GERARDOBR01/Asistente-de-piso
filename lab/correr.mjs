// El laboratorio: mide configuraciones de búsqueda sobre los volcados de la
// app real (lab/volcar.mjs) y las compara con intervalos de confianza.
//
// Uso:
//   node lab/correr.mjs --datos <dir> [--sistemas lexico,denso:e5] [--base lexico]
//                       [--conjuntos bateria-piso-2026-10,cruzadas-pares] [--etiqueta base]
//                       [--informe <archivo.md>]
//
// <dir> tiene corpus.json y <etiqueta>__<conjunto>.jsonl. Todo con datos reales
// se queda fuera del repo; el informe solo lleva agregados.
import fs from 'node:fs';
import path from 'node:path';
import { calificarManual } from './calificador.mjs';
import { relevantes, porPregunta, abstencion, K } from './metricas.mjs';
import { bootstrap, bootstrapPareado, mcnemar, wilson, media } from './estadistica.mjs';
import { cargarSistema } from './sistemas.mjs';

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const DATOS = arg('datos', null);
if (!DATOS) { console.error('Falta --datos <dir>'); process.exit(1); }
const ETIQUETA = arg('etiqueta', 'base');
const CONJUNTOS = arg('conjuntos', 'bateria-piso-2026-10,bateria-nombrada,cruzadas-pares').split(',');
const SISTEMAS = arg('sistemas', 'lexico').split(',');
const BASE = arg('base', SISTEMAS[0]);
const INFORME = arg('informe', null);

const corpus = JSON.parse(fs.readFileSync(path.join(DATOS, 'corpus.json'), 'utf8'));
const porId = new Map(corpus.chunks.map(c => [c.id, c]));
const leer = f => fs.readFileSync(f, 'utf8').trim().split('\n').map(l => JSON.parse(l));

const conjuntos = CONJUNTOS.map(nombre => {
  const f = path.join(DATOS, `${ETIQUETA}__${nombre}.jsonl`);
  if (!fs.existsSync(f)) { console.error('No existe ' + f); process.exit(1); }
  return { nombre, filas: leer(f).filter(x => !x.falta) };
});

const sistemas = [];
for (const s of SISTEMAS) sistemas.push(await cargarSistema(s, { corpus, porId, datos: DATOS }));

/* ── Medir ────────────────────────────────────────────────────────────────── */
const fmt = (x, d = 1) => Number.isFinite(x) ? (100 * x).toFixed(d) : '—';
const ic = b => `${fmt(b.media)} [${fmt(b.bajo)}–${fmt(b.alto)}]`;
const lineas = [];
const out = (...xs) => { const t = xs.join(' '); console.log(t); lineas.push(t); };

const resultados = {};   // sistema → conjunto → filas por pregunta
for (const sis of sistemas) {
  resultados[sis.nombre] = {};
  for (const { nombre, filas } of conjuntos) {
    const filasSis = [];
    for (const f of filas) {
      const r = await sis.buscar(f);           // {ids, abstiene, tarjetas?, ctx?}
      const rel = relevantes(f, corpus.chunks);
      const fila = { i: f.i, tipo: f.tipo, cat: f.cat, abstiene: !!r.abstiene };
      if (f.tipo === 'dato') Object.assign(fila, porPregunta(r.ids, rel));
      /* De punta a punta (lo que enseña la app), si el sistema lo trae. */
      if (r.tarjetas) {
        const c = calificarManual(f, { ...f, tarjetas: r.tarjetas, ctx: r.ctx && r.ctx.map(id => porId.get(id)), sinDato: r.sinDato, ausente: r.ausente, parecidas: r.parecidas });
        Object.assign(fila, { ok: c.ok ? 1 : 0, top1: c.top1 ? 1 : 0, top3: c.top3 ? 1 : 0, ctx: c.enContexto ? 1 : 0 });
      }
      filasSis.push(fila);
    }
    resultados[sis.nombre][nombre] = filasSis;
  }
}

for (const { nombre } of conjuntos) {
  out(`\n## ${nombre}\n`);
  const cols = ['hit@1', 'hit@3', 'hit@5', 'hit@10', 'rr', 'ndcg', 'pag@3'];
  const tieneApp = sistemas.some(s => resultados[s.nombre][nombre].some(f => 'ok' in f));
  out('| sistema | n dato | ' + cols.map(c => c === 'rr' ? 'MRR@10' : c === 'ndcg' ? 'nDCG@10' : c.replace('hit', 'Hit')).join(' | ')
    + (tieneApp ? ' | app: ok | app: 1.ª | app: ctx' : '') + ' | «no está» bien | sin respaldo |');
  out('|' + ' --- |'.repeat(2 + cols.length + (tieneApp ? 3 : 0) + 2));
  for (const sis of sistemas) {
    const filas = resultados[sis.nombre][nombre];
    const dato = filas.filter(f => f.tipo === 'dato');
    const celdas = dato.length ? cols.map(c => ic(bootstrap(dato.map(f => f[c])))) : cols.map(() => '—');
    const app = tieneApp ? ['ok', 'top1', 'ctx'].map(c => dato.length && c in dato[0] ? `${dato.filter(f => f[c]).length}/${dato.length}` : '—') : [];
    const ab = abstencion(filas);
    const w = wilson(ab.abstieneBien, ab.negativas);
    out(`| ${sis.nombre} | ${dato.length} | ${celdas.join(' | ')}${app.length ? ' | ' + app.join(' | ') : ''} | ${ab.negativas ? `${ab.abstieneBien}/${ab.negativas} [${fmt(w.bajo, 0)}–${fmt(w.alto, 0)}]` : '—'} | ${ab.negativas ? ab.respondioSinRespaldo : '—'} |`);
  }
  /* Comparación pareada contra la base. */
  const base = resultados[BASE][nombre];
  for (const sis of sistemas.filter(s => s.nombre !== BASE)) {
    const otra = resultados[sis.nombre][nombre];
    const dA = base.filter(f => f.tipo === 'dato'), dB = otra.filter(f => f.tipo === 'dato');
    if (dA.length) {
      const partes = ['hit@1', 'hit@3', 'rr'].map(c => {
        const d = bootstrapPareado(dA.map(f => f[c]), dB.map(f => f[c]));
        const mc = c === 'rr' ? null : mcnemar(dA.map(f => f[c]), dB.map(f => f[c]));
        return `${c === 'rr' ? 'MRR' : c}: ${d.media >= 0 ? '+' : ''}${fmt(d.media)} [${fmt(d.bajo)}, ${fmt(d.alto)}]${mc ? ` (arregla ${mc.arregla}, rompe ${mc.rompe}, p=${mc.p.toFixed(3)})` : ''}`;
      });
      out(`\n${sis.nombre} contra ${BASE}: ${partes.join(' · ')}`);
    }
    const nA = base.filter(f => f.tipo !== 'dato'), nB = otra.filter(f => f.tipo !== 'dato');
    if (nA.length) {
      const mc = mcnemar(nA.map(f => f.abstiene ? 1 : 0), nB.map(f => f.abstiene ? 1 : 0));
      out(`«no está» de ${sis.nombre} contra ${BASE}: arregla ${mc.arregla}, rompe ${mc.rompe}, p=${mc.p.toFixed(3)}`);
    }
  }
}

if (INFORME) {
  fs.writeFileSync(INFORME, `# Laboratorio · ${new Date().toISOString().slice(0, 10)}\n\nCorpus: ${corpus.docs.length} manuales, ${corpus.chunks.length} fragmentos (app ${corpus.version}). Intervalos al 95 % (bootstrap de 10 000 remuestreos por pregunta; Wilson para «no está»).\n` + lineas.join('\n') + '\n');
  console.log('\nInforme: ' + INFORME);
}
export { resultados, media };
