// Diagnóstico de la puerta de evidencia: ¿qué distingue una pregunta que la
// app calla pero tenía la lámina buena arriba, de una «no está» que la app
// calla con razón?
//
// Junta todas las baterías etiquetadas y, para cada pregunta en la que la app
// se abstiene, calcula señales candidatas:
//   - acuerdo: la búsqueda por palabras y la de significado (e5) eligen la
//     misma lámina en 1.er lugar (o la de palabras queda en el top-k denso);
//   - cos: coseno del mejor fragmento;
//   - hits / exigidos: lo que mide hoy el filtro de solidez;
//   - margen léxico: cuánto le gana el 1.º al 2.º.
// y cuenta, por señal, cuántas positivas recuperaría y cuántas negativas
// dejaría pasar.
//
// Uso: node lab/puerta.mjs --datos <dir> [--etiqueta base] [--conjuntos a,b,c]
import fs from 'node:fs';
import path from 'node:path';
import { relevancia } from './calificador.mjs';
import { vectoresDelCorpus, vectoresDePreguntas, coseno } from './embeddings.mjs';

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const DATOS = arg('datos', null);
const ETIQUETA = arg('etiqueta', 'base');
const CONJ = arg('conjuntos', 'bateria-piso-2026-10,bateria-nombrada,bateria-prueba-2026-10,bateria-confirmacion-2026-10,cruzadas-pares').split(',');
const corpus = JSON.parse(fs.readFileSync(path.join(DATOS, 'corpus.json'), 'utf8'));
const porId = new Map(corpus.chunks.map(c => [c.id, c]));
const filas = CONJ.flatMap(n => fs.readFileSync(path.join(DATOS, `${ETIQUETA}__${n}.jsonl`), 'utf8').trim().split('\n').map(l => ({ ...JSON.parse(l), conjunto: n })));
const MODELO = arg('modelo', 'e5'), VARIANTE = arg('variante', 'crudo');
const emb = await vectoresDelCorpus(MODELO, VARIANTE, corpus, DATOS);
const vq = await vectoresDePreguntas(MODELO, filas.map(f => f.consulta || f.q), DATOS);

const abstiene = f => !!f.sinDato || !!f.ausente;
const analizadas = [];
for (const f of filas) {
  if (f.falta || !abstiene(f) || f.otraSeccion || f.operacion || !f.secDoc) continue;
  const alcance = corpus.chunks.filter(c => c.d === f.secDoc);
  const v = vq.get(f.consulta || f.q);
  const den = alcance.map(c => ({ id: c.id, cos: coseno(v, emb.porId.get(c.id)) })).sort((a, b) => b.cos - a.cos);
  const lex = f.ranking || [];
  if (!lex.length || !den.length) continue;
  const top = lex[0][0];
  const rangoDenso = den.findIndex(x => x.id === top);
  const buena = f.tipo === 'dato' && relevancia(f, porId.get(top)) === 2;
  analizadas.push({
    f, buena, neg: f.tipo !== 'dato',
    acuerdo1: den[0].id === top, rangoDenso, cos: den[0].cos, cosTop: den[rangoDenso]?.cos ?? -1,
    hits: lex[0][2], margen: lex.length > 1 ? lex[0][1] / Math.max(1e-9, lex[1][1]) : 9,
    aviso: f.ausente ? (/no dice cu[aá]nt|No encontré en el manual cu[aá]nt|ningún porcentaje/.test(f.ausente) ? 'cantidad' : /sí en /.test(f.ausente) ? 'otra' : 'ninguno') : 'calla',
  });
}
const pos = analizadas.filter(a => a.buena), neg = analizadas.filter(a => a.neg);
console.log(`Abstenciones analizadas: ${analizadas.length} · positivas con la lámina buena en 1.º léxico: ${pos.length} · negativas: ${neg.length}\n`);
/* ¿Separa la señal continua? AUC = P(una positiva puntúa más que una negativa). */
const auc = (xs, ys) => { let g = 0; for (const x of xs) for (const y of ys) g += x > y ? 1 : x === y ? 0.5 : 0; return g / (xs.length * ys.length); };
console.log(`AUC (${MODELO}/${VARIANTE}): cos del mejor ${auc(pos.map(a => a.cos), neg.map(a => a.cos)).toFixed(3)} · cos de la lámina léxica ${auc(pos.map(a => a.cosTop), neg.map(a => a.cosTop)).toFixed(3)} · margen léxico ${auc(pos.map(a => a.margen), neg.map(a => a.margen)).toFixed(3)}
`);
const regla = (nombre, p) => console.log(`${nombre.padEnd(46)} recupera ${pos.filter(p).length}/${pos.length} · deja pasar ${neg.filter(p).length}/${neg.length}`);
regla('acuerdo en el 1.º', a => a.acuerdo1);
regla('léxico 1.º dentro del top-3 denso', a => a.rangoDenso >= 0 && a.rangoDenso < 3);
regla('acuerdo 1.º y aviso no es de cantidad', a => a.acuerdo1 && a.aviso !== 'cantidad');
regla('acuerdo 1.º, sin cantidad, sin «otra sección»', a => a.acuerdo1 && a.aviso !== 'cantidad' && a.aviso !== 'otra');
regla('acuerdo 1.º y margen léxico ≥ 1.5', a => a.acuerdo1 && a.margen >= 1.5);
console.log('\nPor tipo de abstención (positivas / negativas):');
for (const t of ['calla', 'ninguno', 'otra', 'cantidad']) console.log(`  ${t.padEnd(9)} ${pos.filter(a => a.aviso === t).length} / ${neg.filter(a => a.aviso === t).length}`);
/* Curva: con la señal «coseno de la lámina léxica», cuántas positivas se
   recuperan dejando pasar 0, 1, 2… negativas. */
const ordenNeg = neg.map(a => a.cosTop).sort((x, y) => y - x);
console.log('\nUmbral sobre el coseno de la lámina léxica:');
for (let k = 0; k <= 4; k++) { const t = ordenNeg[k] ?? -1; console.log(`  dejando pasar ${k}/${neg.length}: τ > ${t.toFixed(4)} recupera ${pos.filter(a => a.cosTop > t).length}/${pos.length}`); }
if (process.argv.includes('--detalle')) for (const a of analizadas.filter(a => a.acuerdo1)) console.log(`${a.buena ? '+' : a.neg ? '-' : '?'} [${a.aviso}] ${a.f.q} · hits ${a.hits} · margen ${a.margen.toFixed(2)} · ${a.f.conjunto}`);
