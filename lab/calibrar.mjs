// Calibra τ del rescate por significado con lo que mide la APP EN VIVO.
//
// lab/abstencion.mjs simula el rescate en Node para explorar. La calibración
// que se publica sale de aquí: los volcados de la app con la búsqueda por
// significado encendida (lab/volcar.mjs), donde cada pregunta trae su
// candidato a rescate (`rescate.cos`) ya filtrado por TODAS las reglas de la
// app (sección decidida, sin otra sección nombrada, sin palabra de otro manual,
// comprobación de cantidad). Solo falta el umbral. Así lo calibrado es lo que
// corre, con los vectores del navegador y no los de Node.
//
// Uso:
//   node lab/calibrar.mjs --datos <dir> [--etiqueta sig] [--alfa 0.02]
//        [--calibrar bateria-piso-2026-10,cruzadas-pares] [--guardar lab/calibracion.json]
import fs from 'node:fs';
import path from 'node:path';
import { umbralConformal, coberturaPorGrupos } from './conformal.mjs';
import { wilson } from './estadistica.mjs';

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const DATOS = arg('datos', null);
const ETIQUETA = arg('etiqueta', 'sig');
const ALFA = Number(arg('alfa', 0.02));
const CALIBRAR = arg('calibrar', 'bateria-piso-2026-10,cruzadas-pares').split(',');
const GUARDAR = arg('guardar', null);

const leer = n => fs.readFileSync(path.join(DATOS, `${ETIQUETA}__${n}.jsonl`), 'utf8').trim().split('\n').map(l => JSON.parse(l)).filter(f => !f.falta);
const filas = CALIBRAR.flatMap(leer);
if (filas.some(f => f.significado !== 'lista')) { console.error('Hay preguntas medidas sin la búsqueda por significado encendida.'); process.exit(1); }

/* Todas las negativas cuentan. Las que las reglas de código bloquean (otra
   sección, palabra de otro manual, operación de tienda, cantidad…) tienen
   puntaje −∞: el rescate nunca puede actuar ahí. Las reglas son parte del
   sistema, así que la garantía queda sobre la población completa de preguntas
   sin respuesta: P(una «no está» nueva se cuela) ≤ α. */
const neg = filas.filter(f => f.tipo !== 'dato').map(f => ({ s: f.rescate ? f.rescate.cos : -Infinity, grupo: f.secDoc || f.activa || '(todas)' }));
const conCandidato = neg.filter(x => Number.isFinite(x.s)).length;
const tau = umbralConformal(neg.map(x => x.s), ALFA);
const loo = coberturaPorGrupos(neg, ALFA);
const w = wilson(loo.pasan, loo.total);
console.log(`Negativas: ${neg.length} de ${new Set(neg.map(x => x.grupo)).size} grupos · con candidato a rescate (las demás las bloquea el código): ${conCandidato}`);
console.log(`α = ${ALFA} → τ = ${tau.toFixed(4)}`);
console.log(`Validación cruzada por manual: se cuelan ${loo.pasan}/${loo.total} (${(100 * loo.tasa).toFixed(1)} %, Wilson ${(100 * w.bajo).toFixed(1)}–${(100 * w.alto).toFixed(1)} %)`);

if (GUARDAR) {
  const previa = fs.existsSync(GUARDAR) ? JSON.parse(fs.readFileSync(GUARDAR, 'utf8')) : {};
  fs.writeFileSync(GUARDAR, JSON.stringify({
    modelo: previa.modelo || 'Xenova/multilingual-e5-small', variante: previa.variante || 'crudo', w: previa.w ?? 0.6,
    puntaje: 'cos del mejor fragmento de la sección', origen: 'app en vivo (lab/calibrar.mjs)',
    alfa: ALFA, tau, negativas: neg.length, conCandidato, manuales: new Set(neg.map(x => x.grupo)).size,
    coladasPorManual: `${loo.pasan}/${loo.total}`, fecha: new Date().toISOString().slice(0, 10),
  }, null, 2) + '\n');
  console.log('Calibración guardada en ' + GUARDAR);
}
