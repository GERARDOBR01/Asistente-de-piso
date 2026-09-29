// Compara dos corridas de medición (del banco o de la app) pregunta por pregunta:
// qué se arregló, qué se rompió, y dónde fallan las que siguen mal. Es la vara
// del laboratorio: un cambio no se da por mejor sin este número contra el anterior.
//
// Uso:
//   node eval/comparar.mjs antes.json despues.json
//
// Solo compara filas medidas igual: mismo motor y mismo modo (con sección o
// «como el asesor»). Si cambió el modelo o la versión de lectura, lo dice arriba.
import fs from 'node:fs';

const [A, B] = process.argv.slice(2);
if (!A || !B) { console.error('Uso: node eval/comparar.mjs antes.json despues.json'); process.exit(2); }
const leer = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const a = leer(A), b = leer(B);
const clave = f => [f.motor, f.libre ? 'libre' : 'fija', f.seccion, f.q].join('|');
const grupo = f => f.motor + (f.libre ? ' · sin sección' : '');
const filasA = new Map((a.resultados || []).map(f => [clave(f), f]));
const filasB = new Map((b.resultados || []).map(f => [clave(f), f]));

const linea = (k, va, vb) => va === vb ? null : `  ${k}: ${va ?? '—'} → ${vb ?? '—'}`;
const cambios = [linea('versión', a.version, b.version), linea('lectura', a.lectura, b.lectura),
  linea('modelo', a.modelo, b.modelo), linea('proveedor', a.proveedor, b.proveedor)].filter(Boolean);
console.log(`Antes:   ${A}\nDespués: ${B}`);
if (cambios.length) console.log('Cambió:\n' + cambios.join('\n'));

const grupos = [...new Set([...filasA.values(), ...filasB.values()].map(grupo))];
let rotas = 0;
for (const g of grupos) {
  const comunes = [...filasB.values()].filter(f => grupo(f) === g && filasA.has(clave(f)));
  if (!comunes.length) { console.log(`\n== ${g}: sin preguntas en común`); continue; }
  const bien = (m, f) => m.get(clave(f))?.ok;
  const okA = comunes.filter(f => bien(filasA, f)).length, okB = comunes.filter(f => f.ok).length;
  const arregladas = comunes.filter(f => f.ok && !bien(filasA, f));
  const rotasG = comunes.filter(f => !f.ok && bien(filasA, f));
  rotas += rotasG.length;
  console.log(`\n== ${g}: ${okA}/${comunes.length} → ${okB}/${comunes.length} (${okB - okA >= 0 ? '+' : ''}${okB - okA})`);
  if (arregladas.length) console.log(`  ✓ arregladas (${arregladas.length}):\n` + arregladas.map(f => `     ${f.seccion} · ${f.q}`).join('\n'));
  if (rotasG.length) console.log(`  ✗ rotas (${rotasG.length}):\n` + rotasG.map(f => `     ${f.seccion} · ${f.q} — ${f.capa || ''}`).join('\n'));
  const capas = {};
  for (const f of comunes.filter(f => !f.ok)) capas[f.capa || 'sin clasificar'] = (capas[f.capa || 'sin clasificar'] || 0) + 1;
  if (Object.keys(capas).length)
    console.log('  siguen mal, por capa: ' + Object.entries(capas).sort((x, y) => y[1] - x[1]).map(([c, n]) => `${c} ${n}`).join(' · '));
  const med = (m, k) => { const v = comunes.map(f => m.get(clave(f))?.[k]).filter(x => typeof x === 'number').sort((x, y) => x - y); return v.length ? v[Math.floor(v.length / 2)] : null; };
  const tA = med(filasA, 'tTotal'), tB = med(filasB, 'tTotal');
  if (tA != null && tB != null) console.log(`  tiempo p50: ${(tA / 1000).toFixed(1)} s → ${(tB / 1000).toFixed(1)} s`);
  const fa = comunes.filter(f => f.atadura && f.ok).length;
  if (fa) console.log(`  avisos de cifra mal atada en respuestas buenas (falsas alarmas): ${fa}`);
}
const soloA = [...filasA.keys()].filter(k => !filasB.has(k)).length, soloB = [...filasB.keys()].filter(k => !filasA.has(k)).length;
if (soloA || soloB) console.log(`\n(${soloA} filas solo en la primera, ${soloB} solo en la segunda: no se comparan)`);
process.exit(rotas ? 1 : 0);
