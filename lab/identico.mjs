// Golden master: dos volcados de la app (lab/volcar.mjs) tienen que ser
// idénticos pregunta por pregunta. Es la red de seguridad para mover código
// sin cambiar lo que hace: partir index.html en módulos no puede mover ni un
// fragmento de lugar.
//
// Uso:
//   node lab/identico.mjs <dir> --antes antes --despues despues [--conjuntos a,b,c]
//   node lab/identico.mjs <a.jsonl> <b.jsonl>
//
// Compara todo lo que decide el motor: sección, consulta, ranking con sus
// puntajes y aciertos, lo que recibiría el modelo, las tarjetas y los avisos.
// No compara la versión ni la fecha. Sale con 1 si algo cambió.
import fs from 'node:fs';
import path from 'node:path';

const CAMPOS = ['falta', 'activa', 'secDoc', 'otraSeccion', 'operacion', 'consulta', 'nivel', 'ranking', 'rel', 'ctx', 'ctxInfo', 'tarjetas', 'sinDato', 'ausente', 'parecidas'];

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const leer = f => fs.readFileSync(f, 'utf8').trim().split('\n').map(l => JSON.parse(l));
const posicionales = process.argv.slice(2).filter((x, i, a) => !x.startsWith('--') && !(a[i - 1] || '').startsWith('--'));

let pares;
if (posicionales.length === 2) pares = [[posicionales[0], posicionales[1]]];
else if (posicionales.length === 1) {
  const dir = posicionales[0], A = arg('antes', 'antes'), B = arg('despues', 'despues');
  const conjuntos = arg('conjuntos', null)?.split(',')
    || fs.readdirSync(dir).filter(f => f.startsWith(A + '__') && f.endsWith('.jsonl')).map(f => f.slice(A.length + 2, -6));
  pares = conjuntos.map(c => [path.join(dir, `${A}__${c}.jsonl`), path.join(dir, `${B}__${c}.jsonl`)]);
} else {
  console.error('Uso: node lab/identico.mjs <dir> --antes X --despues Y  |  node lab/identico.mjs a.jsonl b.jsonl');
  process.exit(2);
}

const igual = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
let total = 0;
for (const [fa, fb] of pares) {
  const a = leer(fa), b = leer(fb);
  const nombre = path.basename(fb);
  if (a.length !== b.length) { console.log(`✗ ${nombre}: ${a.length} preguntas contra ${b.length}`); total++; continue; }
  const porCampo = {};
  const ejemplos = [];
  for (let i = 0; i < a.length; i++) {
    if (a[i].q !== b[i].q) { console.log(`✗ ${nombre}: la pregunta ${i} no es la misma`); total++; break; }
    for (const c of CAMPOS) if (!igual(a[i][c], b[i][c])) {
      porCampo[c] = (porCampo[c] || 0) + 1;
      if (ejemplos.length < 5) ejemplos.push(`  #${a[i].i} «${a[i].q}» · ${c}: ${JSON.stringify(a[i][c] ?? null).slice(0, 120)} → ${JSON.stringify(b[i][c] ?? null).slice(0, 120)}`);
    }
  }
  const n = Object.values(porCampo).reduce((s, x) => s + x, 0);
  total += n;
  if (!n) console.log(`✓ ${nombre}: ${a.length} preguntas idénticas`);
  else {
    console.log(`✗ ${nombre}: ${Object.entries(porCampo).map(([c, k]) => `${c} ${k}`).join(' · ')}`);
    for (const e of ejemplos) console.log(e);
  }
}
process.exit(total ? 1 : 0);
