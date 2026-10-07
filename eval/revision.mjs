// Medición de la revisión con foto (ADR 0007) contra el criterio fijado antes.
//
//   node eval/revision.mjs --sinteticas [--salida informe.md]
//     Batería generada por código (src/revision/demo.js), en Node. Prueba el
//     método; NO cuenta como evidencia del criterio.
//
//   node eval/revision.mjs --fotos C:/Users/gerar/eval-revision [--salida informe.md]
//     Fotos reales con etiquetas.json, medidas en Chrome con el mismo código
//     que corre en el teléfono (window.__revision). Las fotos nunca entran al
//     repo.
//
//   node eval/revision.mjs --plantilla C:/Users/gerar/eval-revision
//     Escribe un etiquetas.json de ejemplo para llenar.
//
// etiquetas.json: [{ "foto": "tringla-01.jpg", "tipo": "tringla|anaquel|focal|origen",
//   "esperado": "CUMPLE|OBSERVACIÓN|GRAVE|NO_CALIFICA", "defecto": "texto libre",
//   "via": "galeria|app", "puntos": [{"x":0.2,"y":0.6}, …],
//   "marco": {"x":0.1,"y":0.4,"w":0.5,"h":0.3}, "origenEsperado": "NO_CALIFICA" }]
// Una foto puede tener varias filas, una por zona (`marco`): la mesa, la
// tringla y el focal de una misma foto de área.
// Los puntos del focal van en fracción del ancho y del alto (lo que tocaría
// la persona). Para «origen», `esperado` es el nivel del origen.
//
// Criterio (ADR 0007): por básico ≥ 8/10 aciertos y 0 CUMPLE falsos en las
// fotos con defecto; origen con 0 GRAVE falsos en fotos reales. Se reporta la
// tasa de NO_CALIFICA (más de 30 % = no sirve en piso).
import fs from 'node:fs';
import path from 'node:path';
import { wilson } from '../lab/estadistica.mjs';
import { revisarColor } from '../src/revision/color.js';
import { revisarSurtido } from '../src/revision/surtido.js';
import { revisarTriangulo, revisarNiveles } from '../src/revision/triangulo.js';
import { tringla, anaquel, focal, azar, PALETA as P } from '../src/revision/demo.js';

const args = process.argv.slice(2);
const opt = (/** @type {string} */ n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };

/** ¿Acertó? Un defecto se detecta si sale GRAVE u OBSERVACIÓN. */
function acierta(esperado, obtenido) {
  if (esperado === 'CUMPLE' || esperado === 'NO_CALIFICA') return obtenido === esperado;
  return obtenido === 'GRAVE' || obtenido === 'OBSERVACIÓN';
}

/** @param {{basico:string, esperado:string, obtenido:string, caso:string, motivo?:string}[]} filas */
export function calificar(filas) {
  const porBasico = {};
  for (const f of filas) (porBasico[f.basico] ||= []).push(f);
  const out = [];
  for (const [b, fs_] of Object.entries(porBasico)) {
    const ok = fs_.filter(f => acierta(f.esperado, f.obtenido)).length;
    const conDefecto = fs_.filter(f => f.esperado === 'GRAVE' || f.esperado === 'OBSERVACIÓN');
    const cumpleFalsos = conDefecto.filter(f => f.obtenido === 'CUMPLE').length;
    const graveFalsos = fs_.filter(f => f.obtenido === 'GRAVE' && f.esperado !== 'GRAVE').length;
    const nc = fs_.filter(f => f.obtenido === 'NO_CALIFICA' && f.esperado !== 'NO_CALIFICA').length;
    const w = wilson(ok, fs_.length);
    const pasa = b === 'origen' ? graveFalsos === 0 : ok / fs_.length >= 0.8 && cumpleFalsos === 0;
    out.push({ basico: b, n: fs_.length, ok, ic: w, cumpleFalsos, graveFalsos, noCalifica: nc, pasa, todas: fs_, fallos: fs_.filter(f => !acierta(f.esperado, f.obtenido)) });
  }
  return out;
}

const pct = (/** @type {number} */ x) => (x * 100).toFixed(0) + ' %';

/** @param {ReturnType<typeof calificar>} t @param {string} titulo @param {string} nota */
function informe(t, titulo, nota, porNivel = false) {
  const l = [`# ${titulo}`, '', nota, '', '| Básico | Aciertos | IC 95 % (Wilson) | CUMPLE falsos | GRAVE falsos | NO_CALIFICA indebido | Criterio |', '|---|---|---|---|---|---|---|'];
  for (const r of t) l.push(`| ${r.basico} | ${r.ok}/${r.n} | ${pct(r.ic.bajo)}–${pct(r.ic.alto)} | ${r.cumpleFalsos} | ${r.graveFalsos} | ${r.noCalifica} (${pct(r.noCalifica / r.n)}) | ${r.pasa ? '✓' : '✗'} |`);
  if (porNivel) {
    l.push('', '## Por nivel de suciedad', '', '| Básico | ' + Object.keys(SUCIEDAD).join(' | ') + ' |', '|---|' + Object.keys(SUCIEDAD).map(() => '---').join('|') + '|');
    for (const r of t) {
      const celdas = Object.keys(SUCIEDAD).map(n => {
        const fs_ = r.todas.filter(f => f.caso.startsWith(n + ' '));
        return `${fs_.filter(f => acierta(f.esperado, f.obtenido)).length}/${fs_.length}`;
      });
      l.push(`| ${r.basico} | ${celdas.join(' | ')} |`);
    }
  }
  const fallos = t.flatMap(r => r.fallos.map(f => `- ${r.basico} · ${f.caso}: se esperaba ${f.esperado}, salió ${f.obtenido}${f.motivo ? ` — «${f.motivo}»` : ''}`));
  if (fallos.length) l.push('', '## Fallos, uno por uno', '', ...fallos);
  return l.join('\n');
}

/* ── Batería sintética ─────────────────────────────────────────────────── */

const SUCIEDAD = {
  limpia: { ruido: 3 },
  media: { ruido: 8, desenfoque: 1, sombra: 0.35 },
  dura: { ruido: 14, desenfoque: 2, sombra: 0.5, brillo: 0.75 },
};

function sinteticas(semillas = 8) {
  /** @type {{basico:string, esperado:string, obtenido:string, caso:string}[]} */
  const filas = [];
  const grupos = [P.calido, P.frio, P.neutro];
  for (const [nivel, sucio] of Object.entries(SUCIEDAD)) {
    for (let s = 1; s <= semillas; s++) {
      const r = azar(s * 101 + nivel.length);
      const toma = (/** @type {string[]} */ g, /** @type {number} */ n) => g.slice().sort(() => r() - 0.5).slice(0, n).sort((a, b) => g.indexOf(a) - g.indexOf(b));
      const filasColor = grupos.map(g => toma(g, 2 + Math.floor(r() * 3)));
      const op = { ...sucio, semilla: s };
      /* Tringla bien y con un intruso de otro grupo. */
      const bien = filasColor.flat();
      filas.push({ basico: 'colorizacion', esperado: 'CUMPLE', obtenido: revisarColor(tringla(bien, op)).nivel, caso: `${nivel} s${s} bien` });
      const de = s % 3, a = (s + 1 + (s % 2)) % 3;
      const mala = filasColor.map(f => f.slice());
      mala[a].splice(1, 0, grupos[de][Math.floor(r() * grupos[de].length)]);
      filas.push({ basico: 'colorizacion', esperado: 'GRAVE', obtenido: revisarColor(tringla(mala.flat(), op)).nivel, caso: `${nivel} s${s} intruso` });
      /* Anaquel lleno y con 1-3 casillas vacías. */
      filas.push({ basico: 'surtido', esperado: 'CUMPLE', obtenido: revisarSurtido(anaquel(op)).nivel, caso: `${nivel} s${s} lleno` });
      const huecos = Array.from({ length: 1 + (s % 3) }, (_, i) => [(s + i) % 3, (s * 2 + i) % 6]);
      filas.push({ basico: 'surtido', esperado: 'GRAVE', obtenido: revisarSurtido(anaquel({ ...op, huecos })).nivel, caso: `${nivel} s${s} ${huecos.length} vacías` });
      /* Focal: pirámide y escalera o fila, con el pulso de quien toca (±2 %). */
      const n = 3 + (s % 3);
      /* Una sola cima: con un número par de elementos, la de en medio a la
         derecha (o a la izquierda, según la semilla). */
      const pico = n % 2 ? (n - 1) / 2 : n / 2 - (s % 2);
      const pir = Array.from({ length: n }, (_, i) => 0.8 - 0.4 * Math.abs(i - pico) / Math.max(pico, n - 1 - pico));
      /* El asimétrico vale (Gerardo, 7-oct): la escalera es CUMPLE. Los
         defectos son la fila (todo a la misma altura) y la meseta (dos
         elementos empatan arriba). El pulso de quien toca es ±1 %. */
      const esc = pir.slice().sort((x, y) => y - x);
      const defecto = s % 2 ? pir.map(() => 0.55 + 0.03 * r()) : pir.map((a, i) => (i === pico || i === (pico + 1) % n ? 0.82 : 0.4 + 0.1 * r()));
      for (const [alturas, esperado, nombre] of [[pir, 'CUMPLE', 'pirámide'], [esc, 'CUMPLE', 'escalera'], [defecto, s % 2 ? 'GRAVE' : 'OBSERVACIÓN', s % 2 ? 'fila' : 'meseta']]) {
        const f = focal(/** @type {number[]} */ (alturas), op);
        const toques = f.puntos.map(q => ({ x: q.x + (r() - 0.5) * 0.02 * f.img.width, y: q.y + (r() - 0.5) * 0.02 * f.img.height }));
        filas.push({ basico: 'triangulacion', esperado: /** @type {string} */ (esperado), obtenido: revisarTriangulo(toques, f.img).nivel, caso: `${nivel} s${s} ${nombre}` });
        /* Lo esperado sale de las alturas construidas: una escalera de 3 hecha
           de una pirámide simétrica (0.8, 0.4, 0.4) solo tiene 2 alturas. */
        const distintas = new Set(/** @type {number[]} */ (alturas).map(a => a.toFixed(2))).size;
        if (nombre === 'escalera' || nombre === 'fila')
          filas.push({ basico: 'niveles', esperado: nombre === 'fila' ? 'GRAVE' : distintas >= 3 ? 'CUMPLE' : 'OBSERVACIÓN', obtenido: revisarNiveles(toques, f.img).nivel, caso: `${nivel} s${s} ${nombre} (${distintas} alturas)` });
      }
    }
  }
  /* Fotos que no dan para calificar. */
  for (let s = 1; s <= 4; s++) {
    const op = { semilla: s };
    filas.push({ basico: 'colorizacion', esperado: 'NO_CALIFICA', obtenido: revisarColor(tringla(P.calido.concat(P.frio), { ...op, brillo: 0.14 })).nivel, caso: `oscura s${s}` });
    filas.push({ basico: 'colorizacion', esperado: 'NO_CALIFICA', obtenido: revisarColor(tringla(P.calido.concat(P.frio), { ...op, desenfoque: 10 })).nivel, caso: `movida s${s}` });
    filas.push({ basico: 'surtido', esperado: 'NO_CALIFICA', obtenido: revisarSurtido(anaquel({ ...op, brillo: 0.12 })).nivel, caso: `oscura s${s}` });
    filas.push({ basico: 'surtido', esperado: 'NO_CALIFICA', obtenido: revisarSurtido(anaquel({ ...op, desenfoque: 10 })).nivel, caso: `movida s${s}` });
  }
  return filas;
}

/* ── Fotos reales, en Chrome ───────────────────────────────────────────── */

async function fotos(dir) {
  const { abrirApp } = await import('./navegador.mjs');
  const etiquetas = JSON.parse(fs.readFileSync(path.join(dir, 'etiquetas.json'), 'utf8'));
  const { p, cerrar } = await abrirApp([], { log: () => {} });
  /** @type {{basico:string, esperado:string, obtenido:string, caso:string}[]} */
  const filas = [];
  const vistas = new Set();
  try {
    await p.waitForFunction(() => /** @type {any} */ (window).__revision, null, { timeout: 30000 });
    for (const e of etiquetas) {
      const b64 = fs.readFileSync(path.join(dir, e.foto)).toString('base64');
      const tipo = e.tipo === 'origen' ? 'tringla' : e.tipo;
      const r = await p.evaluate(async ({ b64, tipo, via, puntos, marco }) => {
        const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
        const a = await /** @type {any} */ (window).__revision.analizarArchivo(new Blob([bytes]), tipo, { via, puntos, marco });
        return { origen: a.origen.nivel, nivel: a.resultado ? a.resultado.nivel : null, motivo: a.resultado?.motivo };
      }, { b64, tipo, via: e.via || 'galeria', puntos: e.puntos || null, marco: e.marco || undefined });
      const basico = { tringla: 'colorizacion', anaquel: 'surtido', focal: 'triangulacion', origen: 'origen' }[e.tipo];
      filas.push({ basico, esperado: e.esperado, obtenido: e.tipo === 'origen' ? r.origen : r.nivel || 'NO_CALIFICA', caso: `${e.foto}${e.marco ? ' [zona]' : ''}${e.defecto ? ' (' + e.defecto + ')' : ''}`, motivo: r.motivo });
      /* Ninguna foto real puede salir GRAVE de origen sin declararlo. Una
         vez por foto, aunque tenga varias zonas. */
      if (e.tipo !== 'origen' && !vistas.has(e.foto)) filas.push({ basico: 'origen', esperado: e.origenEsperado || 'OBSERVACIÓN', obtenido: r.origen, caso: e.foto });
      vistas.add(e.foto);
    }
  } finally { await cerrar(); }
  return filas;
}

/* ── Main ──────────────────────────────────────────────────────────────── */

if (opt('--plantilla')) {
  const dir = /** @type {string} */ (opt('--plantilla'));
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, 'etiquetas.json');
  if (fs.existsSync(f)) { console.error(`Ya existe ${f}: no lo piso.`); process.exit(1); }
  fs.writeFileSync(f, JSON.stringify([
    { foto: 'tringla-01.jpg', tipo: 'tringla', esperado: 'CUMPLE', defecto: '' },
    { foto: 'tringla-02.jpg', tipo: 'tringla', esperado: 'GRAVE', defecto: 'una prenda fría entre las cálidas' },
    { foto: 'anaquel-01.jpg', tipo: 'anaquel', esperado: 'GRAVE', defecto: 'hueco en la repisa de en medio' },
    { foto: 'focal-01.jpg', tipo: 'focal', esperado: 'CUMPLE', defecto: '', puntos: [{ x: 0.2, y: 0.6 }, { x: 0.5, y: 0.25 }, { x: 0.8, y: 0.62 }] },
    { foto: 'whatsapp-01.jpg', tipo: 'origen', esperado: 'NO_CALIFICA', defecto: 'reenviada por WhatsApp' },
  ], null, 2));
  console.log(`Plantilla en ${f}`);
  process.exit(0);
}

let texto;
if (args.includes('--sinteticas')) {
  const t = calificar(sinteticas());
  texto = informe(t, 'Revisión con foto · batería sintética',
    `Generada por código con ruido, sombra y desenfoque en tres niveles (limpia, media, dura). Prueba el método; **no es evidencia del criterio del ADR 0007**, que se mide con fotos reales. Fecha: ${new Date().toISOString().slice(0, 10)}.`, true);
} else if (opt('--fotos')) {
  const t = calificar(await fotos(/** @type {string} */ (opt('--fotos'))));
  texto = informe(t, 'Revisión con foto · fotos reales', `Fotos de \`${opt('--fotos')}\` (fuera del repo), medidas en Chrome con el código del teléfono. Criterio del ADR 0007. Fecha: ${new Date().toISOString().slice(0, 10)}.`);
} else {
  console.error('Uso: node eval/revision.mjs --sinteticas | --fotos <dir> | --plantilla <dir>  [--salida informe.md]');
  process.exit(2);
}
console.log(texto);
if (opt('--salida')) fs.writeFileSync(/** @type {string} */ (opt('--salida')), texto + '\n');
