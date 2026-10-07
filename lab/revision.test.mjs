// Pruebas de la revisión con foto (ADR 0007), en Node y sin navegador.
//
// Todo con imágenes sintéticas (src/revision/demo.js) y metadatos hechos a
// mano: prueban que el método hace lo que dice, no que acierte con fotos de
// tienda. Eso lo mide eval/revision.mjs con la batería de fotos de casa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import fc from 'fast-check';
import { peor, noCalifica, reducir } from '../src/revision/veredicto.js';
import { leerMetadatos, veredictoOrigen, sha256Puro, huella, fechaExif, dimensiones, jpegCompleto } from '../src/revision/procedencia.js';
import { revisarColor, clasificar, lab, enOrden, REGLA_COLOR, balanceBlancos } from '../src/revision/color.js';
import { revisarSurtido } from '../src/revision/surtido.js';
import { revisarTriangulo, puntosDeCajas } from '../src/revision/triangulo.js';
import { tringla, anaquel, focal, PALETA as P, exifMuestra, xmpMuestra, c2paMuestra, conMetadatos, JPEG_MINIMO, rgb } from '../src/revision/demo.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SUCIA = { ruido: 8, desenfoque: 1, sombra: 0.35 };

/* ── Frontera ──────────────────────────────────────────────────────────── */
const DEL_NAVEGADOR = /\b(?:document|window|localStorage|sessionStorage|navigator|indexedDB|alert|confirm)\b/;
const sinComentarios = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

test('frontera: las piezas de la revisión no usan APIs del navegador (solo ui.js)', () => {
  const dir = path.join(RAIZ, 'src', 'revision');
  const malos = fs.readdirSync(dir).filter(f => f.endsWith('.js') && f !== 'ui.js' && f !== 'detector.js')
    .filter(f => DEL_NAVEGADOR.test(sinComentarios(fs.readFileSync(path.join(dir, f), 'utf8'))));
  assert.deepEqual(malos, []);
});

/* ── Huella ────────────────────────────────────────────────────────────── */
test('huella: SHA-256 puro igual al de node:crypto', () => {
  assert.equal(sha256Puro(new Uint8Array()), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  fc.assert(fc.property(fc.uint8Array({ maxLength: 300 }), b => sha256Puro(b) === crypto.createHash('sha256').update(b).digest('hex')));
});

test('huella: la asíncrona (crypto.subtle) da lo mismo que la pura', async () => {
  const b = conMetadatos(JPEG_MINIMO, { exif: exifMuestra({ marca: 'Marca', modelo: 'Modelo X' }) });
  assert.equal(await huella(b), sha256Puro(b));
});

/* ── Origen ────────────────────────────────────────────────────────────── */
const AHORA = new Date(2026, 9, 6, 15, 0, 0);
async function origen(bytes, via = 'galeria') {
  return veredictoOrigen({ via, meta: leerMetadatos(bytes), huella: await huella(bytes), bytes: bytes.length, ahora: AHORA });
}

test('origen: tomada en la app → CUMPLE, con huella y hora', async () => {
  const r = await origen(JPEG_MINIMO, 'app');
  assert.equal(r.nivel, 'CUMPLE');
  assert.equal(r.evidencia.huella.length, 16);
  assert.equal(r.fuente, 'CÓDIGO');
});

test('origen: galería sin metadatos (WhatsApp, captura) → NO_CALIFICA, nunca GRAVE', async () => {
  const r = await origen(JPEG_MINIMO);
  assert.equal(r.nivel, 'NO_CALIFICA');
  assert.match(r.motivo, /revisar en persona/);
});

test('origen: galería con EXIF de cámara coherente → OBSERVACIÓN, con la cámara y la edad', async () => {
  const b = conMetadatos(JPEG_MINIMO, { exif: exifMuestra({ marca: 'Marca', modelo: 'Modelo X', software: 'HDR+ 1.0.6', fechaOriginal: '2026:10:06 13:30:00' }) });
  const m = leerMetadatos(b);
  assert.deepEqual([m.exif?.marca, m.exif?.modelo, m.exif?.software, m.exif?.fechaOriginal], ['Marca', 'Modelo X', 'HDR+ 1.0.6', '2026:10:06 13:30:00']);
  const r = await origen(b);
  assert.equal(r.nivel, 'OBSERVACIÓN');
  assert.equal(r.evidencia.camara, 'Marca Modelo X');
  assert.equal(r.evidencia.edad_horas, 1.5);
});

test('origen: foto vieja → lo dice («hace N días»)', async () => {
  const b = conMetadatos(JPEG_MINIMO, { exif: exifMuestra({ marca: 'Marca', modelo: 'Modelo X', fechaOriginal: '2026:09:30 10:00:00' }) });
  const r = await origen(b);
  assert.equal(r.nivel, 'OBSERVACIÓN');
  assert.match(r.motivo, /hace 6 días/);
});

test('origen: pasó por un editor → OBSERVACIÓN con su nombre', async () => {
  const b = conMetadatos(JPEG_MINIMO, { exif: exifMuestra({ marca: 'Marca', modelo: 'Modelo X', software: 'Adobe Photoshop 26.0', fechaOriginal: '2026:10:06 13:30:00' }) });
  const r = await origen(b);
  assert.equal(r.nivel, 'OBSERVACIÓN');
  assert.match(r.motivo, /Photoshop/);
});

test('origen: declaración de IA en XMP/IPTC o en C2PA → GRAVE', async () => {
  for (const tipo of ['trainedAlgorithmicMedia', 'compositeWithTrainedAlgorithmicMedia']) {
    const x = await origen(conMetadatos(JPEG_MINIMO, { xmp: xmpMuestra(tipo) }));
    assert.equal(x.nivel, 'GRAVE', `XMP ${tipo}`);
    assert.equal(x.evidencia.declara, tipo);
    const c = await origen(conMetadatos(JPEG_MINIMO, { c2pa: c2paMuestra(tipo) }));
    assert.equal(c.nivel, 'GRAVE', `C2PA ${tipo}`);
    assert.equal(c.evidencia.firma_c2pa, 'sin validar (v1)');
  }
  /* Aunque traiga EXIF de cámara: la declaración manda. */
  const ambos = conMetadatos(JPEG_MINIMO, { exif: exifMuestra({ marca: 'Marca', modelo: 'Modelo X', fechaOriginal: '2026:10:06 13:30:00' }), xmp: xmpMuestra('trainedAlgorithmicMedia') });
  assert.equal((await origen(ambos)).nivel, 'GRAVE');
});

test('origen: un manifiesto C2PA de cámara no es IA', async () => {
  const r = await origen(conMetadatos(JPEG_MINIMO, { c2pa: c2paMuestra('digitalCapture') }));
  assert.equal(r.nivel, 'OBSERVACIÓN');
  assert.equal(r.evidencia.c2pa, 'digitalCapture');
});

test('origen: bytes al azar con cabecera JPEG nunca truenan ni salen GRAVE', () => {
  fc.assert(fc.property(fc.uint8Array({ minLength: 0, maxLength: 400 }), cola => {
    const b = new Uint8Array([0xFF, 0xD8, ...cola]);
    const r = veredictoOrigen({ via: 'galeria', meta: leerMetadatos(b), huella: sha256Puro(b), bytes: b.length, ahora: AHORA });
    return r.nivel !== 'GRAVE' && r.nivel !== 'CUMPLE';
  }));
});

/* ── Carga de la foto (el «No se pudo leer» del teléfono) ───────────────── */
const FIN = new Uint8Array([0xFF, 0xD9]);
const unir = (/** @type {Uint8Array[]} */ ...xs) => { const o = new Uint8Array(xs.reduce((s, x) => s + x.length, 0)); let i = 0; for (const x of xs) { o.set(x, i); i += x.length; } return o; };
/** TIFF mínimo con la orientación EXIF (0x0112). @param {number} o */
const tiffOrientacion = o => new Uint8Array([0x49, 0x49, 42, 0, 8, 0, 0, 0, 1, 0, 0x12, 0x01, 3, 0, 1, 0, 0, 0, o, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

test('carga: tamaño de la cabecera, girado cuando el EXIF dice 5-8', () => {
  const jpeg = unir(JPEG_MINIMO, FIN);
  assert.deepEqual(dimensiones(jpeg), { width: 1, height: 1 });
  assert.equal(dimensiones(new Uint8Array([1, 2, 3])), null);
  /* Un SOF de 3000×4000 con orientación 6 se ve de 4000×3000. */
  const sof = new Uint8Array([0xFF, 0xC0, 0, 11, 8, 0x0B, 0xB8, 0x0F, 0xA0, 1, 1, 0x11, 0]);
  const base = unir(new Uint8Array([0xFF, 0xD8]), sof, new Uint8Array([0xFF, 0xDA, 0, 2]), FIN);
  assert.deepEqual(dimensiones(base), { width: 4000, height: 3000 });
  assert.deepEqual(dimensiones(conMetadatos(base, { exif: tiffOrientacion(6) })), { width: 3000, height: 4000 });
  assert.deepEqual(dimensiones(conMetadatos(base, { exif: tiffOrientacion(3) })), { width: 4000, height: 3000 });
});

test('carga: JPEG cortada → incompleta; con video pegado al final (foto en movimiento) → completa', () => {
  const jpeg = unir(JPEG_MINIMO, FIN);
  assert.equal(jpegCompleto(jpeg), true);
  assert.equal(jpegCompleto(JPEG_MINIMO), false);
  assert.equal(jpegCompleto(unir(jpeg, new TextEncoder().encode('....ftypmp42'), new Uint8Array(500).fill(7))), true);
  assert.equal(jpegCompleto(new Uint8Array([0x89, 0x50, 0x4E, 0x47])), true, 'no es JPEG: no se juzga aquí');
});

test('carga: los metadatos rotos nunca truenan', () => {
  fc.assert(fc.property(fc.uint8Array({ maxLength: 200 }), cola => {
    const b = conMetadatos(unir(JPEG_MINIMO, FIN), { exif: cola });
    const m = leerMetadatos(b);
    dimensiones(b); jpegCompleto(b);
    return m.formato === 'jpeg';
  }));
});

test('origen: fecha EXIF', () => {
  assert.equal(fechaExif('2026:10:06 14:03:11')?.getHours(), 14);
  assert.equal(fechaExif('basura'), null);
});

/* ── Colorización ──────────────────────────────────────────────────────── */
test('colorización: los colores de la guía caen en su grupo', () => {
  const grupo = hex => { const [L, a, b] = lab(...rgb(hex)); return clasificar(L, Math.hypot(a, b), (Math.atan2(b, a) * 180 / Math.PI + 360) % 360).grupo; };
  for (const g of /** @type {const} */ (['calido', 'frio', 'neutro'])) for (const hex of P[g]) assert.equal(grupo(hex), g, hex);
  assert.equal(grupo('#8B0000'), 'calido', 'rojo obscuro no es café');
  assert.equal(grupo('#1A2A55'), 'frio', 'marino');
  assert.equal(grupo('#C3B091'), 'neutro', 'caqui');
});

test('colorización: la subsecuencia en orden deja fuera el mínimo, pesado por ancho', () => {
  assert.deepEqual(enOrden([0, 0, 2, 0, 0, 1, 2], [1, 1, 1, 1, 1, 1, 1]), [true, true, false, true, true, true, true]);
  /* Un bloque ancho no sale «fuera» por una prenda angosta. */
  assert.deepEqual(enOrden([1, 0, 0], [5, 1, 1]), [true, false, false]);
});

const BIEN = [...P.calido.slice(0, 4), ...P.frio.slice(0, 4), ...P.neutro.slice(0, 3)];
test('colorización: en orden → CUMPLE, limpia y con sombra y ruido', () => {
  for (const op of [{}, { ...SUCIA, semilla: 2 }, { ...SUCIA, semilla: 5 }]) {
    const r = revisarColor(tringla(BIEN, op));
    assert.equal(r.nivel, 'CUMPLE', JSON.stringify(op) + ' ' + r.motivo);
    assert.equal(r.evidencia.grupos, 'CCCCFFFFNNN');
  }
});

test('colorización: mezclilla apagada → fría; marino, gris frío y café → neutros (fotos de tienda, 7-oct)', () => {
  assert.equal(clasificar(30, 5, 260).grupo, 'frio', 'mezclilla lavada en luz de tienda');
  assert.equal(clasificar(45, 11, 250).grupo, 'frio', 'mezclilla clara');
  assert.equal(clasificar(21, 8, 262).grupo, 'neutro', 'azul marino');
  assert.equal(clasificar(59, 4.6, 280).grupo, 'neutro', 'gris frío');
  assert.equal(clasificar(21, 5.5, 45).grupo, 'neutro', 'café');
  assert.equal(clasificar(6, 1, 270).grupo, 'neutro', 'negro');
});

test('colorización: rojo → mezclilla → café → negro bajo luz cálida → CUMPLE', () => {
  const VINO = '#7A2328', MEZCLILLA = '#5E6E84', CAFE = '#4A3427', NEGRO = '#1C1C1E';
  const img = tringla([VINO, VINO, MEZCLILLA, MEZCLILLA, MEZCLILLA, CAFE, CAFE, NEGRO, NEGRO], { ...SUCIA, semilla: 7, pared: '#EFE2CF' });
  const r = revisarColor(img);
  assert.equal(r.nivel, 'CUMPLE', r.motivo);
  assert.match(String(r.evidencia.grupos), /^C+F+N+$/);
});

test('colorización: el balance de blancos no inventa color si no hay blanco de referencia', () => {
  const gris = { width: 40, height: 30, data: new Uint8ClampedArray(40 * 30 * 4).fill(90) };
  assert.equal(balanceBlancos(gris), null);
});

test('colorización: un frío entre cálidos → GRAVE y señala el tramo', () => {
  const c = [P.calido[0], P.calido[1], P.frio[2], P.calido[3], P.calido[4], P.frio[0], P.frio[3], P.neutro[2]];
  const r = revisarColor(tringla(c, { ...SUCIA, semilla: 3 }));
  assert.equal(r.nivel, 'GRAVE');
  assert.match(r.motivo, /Colores revueltos: frío entre cálidos, tramo 3/);
  assert.equal(r.marcas.tramos.filter(t => t.fueraGrupo).length, 1);
});

test('colorización: fuera de la rueda dentro de su grupo → OBSERVACIÓN solo si se pide (apagado por defecto)', () => {
  const img = tringla([P.calido[3], P.calido[0], P.calido[1], P.frio[0], P.frio[2], P.neutro[2]], { ...SUCIA, semilla: 4 });
  assert.equal(revisarColor(img).nivel, 'CUMPLE');
  assert.equal(revisarColor(img, { regla: { ...REGLA_COLOR, revisarRueda: true } }).nivel, 'OBSERVACIÓN');
});

test('colorización: bloques limpios en otro orden → OBSERVACIÓN; la dirección y el rigor son configurables', () => {
  const img = tringla(BIEN.slice().reverse());
  const r = revisarColor(img);
  assert.equal(r.nivel, 'OBSERVACIÓN');
  assert.match(r.motivo, /bien formados, pero van neutros → fríos → cálidos/);
  assert.equal(revisarColor(img, { regla: { ...REGLA_COLOR, ordenEstricto: true } }).nivel, 'GRAVE');
  assert.equal(revisarColor(img, { regla: { ...REGLA_COLOR, direccion: 'der-izq' } }).nivel, 'CUMPLE');
});

test('colorización: menos de 3 bloques, oscura o movida → NO_CALIFICA', () => {
  assert.equal(revisarColor(tringla([P.calido[1], P.calido[1], P.frio[2], P.frio[2]])).nivel, 'NO_CALIFICA');
  assert.equal(revisarColor(tringla(BIEN, { brillo: 0.15 })).nivel, 'NO_CALIFICA');
  assert.equal(revisarColor(tringla(BIEN, { desenfoque: 12 })).nivel, 'NO_CALIFICA');
});

test('colorización: 0 CUMPLE falsos con un defecto puesto, en 12 semillas', () => {
  const bases = [P.calido.slice(0, 4), P.frio.slice(0, 4), P.neutro.slice(1, 4)];
  for (let s = 1; s <= 12; s++) {
    /* Una prenda de otro grupo metida en un lugar al azar de otro grupo. */
    const intruso = s % 3, destino = (s + 1) % 3;
    const filas = bases.map(b => b.slice());
    filas[destino].splice(1 + (s % 2), 0, bases[intruso][s % bases[intruso].length]);
    const r = revisarColor(tringla(filas.flat(), { ...SUCIA, semilla: s }));
    assert.notEqual(r.nivel, 'CUMPLE', `semilla ${s}: ${r.evidencia.grupos}`);
  }
});

/* ── Surtido ───────────────────────────────────────────────────────────── */
test('surtido: lleno → CUMPLE con 0 % vacío', () => {
  for (const op of [{}, { ...SUCIA, semilla: 2 }]) {
    const r = revisarSurtido(anaquel(op));
    assert.equal(r.nivel, 'CUMPLE', r.motivo);
    assert.equal(r.evidencia.vacio_pct, 0);
  }
});

test('surtido: una casilla vacía → OBSERVACIÓN; dos juntas → GRAVE', () => {
  const uno = revisarSurtido(anaquel({ huecos: [[1, 2]], ...SUCIA, semilla: 2 }));
  assert.equal(uno.nivel, 'OBSERVACIÓN', JSON.stringify(uno.evidencia));
  assert.equal(uno.marcas.huecos.length, 1);
  const dos = revisarSurtido(anaquel({ huecos: [[0, 1], [0, 2]], ...SUCIA, semilla: 2 }));
  assert.equal(dos.nivel, 'GRAVE');
});

test('surtido: 0 CUMPLE falsos con al menos una casilla vacía, en 12 semillas', () => {
  for (let s = 1; s <= 12; s++) {
    const r = revisarSurtido(anaquel({ huecos: [[s % 3, s % 6]], ...SUCIA, semilla: s }));
    assert.notEqual(r.nivel, 'CUMPLE', `semilla ${s}: ${JSON.stringify(r.evidencia)}`);
  }
});

test('surtido: oscura → NO_CALIFICA', () => {
  assert.equal(revisarSurtido(anaquel({ brillo: 0.12 })).nivel, 'NO_CALIFICA');
});

/* ── Triangulación ─────────────────────────────────────────────────────── */
const TAM = { width: 640, height: 480 };
test('triangulación: pirámide → CUMPLE; plano o escalera → GRAVE; corrida → OBSERVACIÓN', () => {
  const pir = [{ x: 100, y: 330 }, { x: 220, y: 230 }, { x: 320, y: 120 }, { x: 420, y: 240 }, { x: 540, y: 340 }];
  assert.equal(revisarTriangulo(pir, TAM).nivel, 'CUMPLE');
  assert.equal(revisarTriangulo([{ x: 100, y: 200 }, { x: 300, y: 205 }, { x: 500, y: 198 }], TAM).nivel, 'GRAVE');
  assert.equal(revisarTriangulo([{ x: 100, y: 120 }, { x: 300, y: 220 }, { x: 500, y: 330 }], TAM).nivel, 'GRAVE');
  assert.equal(revisarTriangulo([{ x: 100, y: 330 }, { x: 160, y: 120 }, { x: 300, y: 240 }, { x: 540, y: 340 }], TAM).nivel, 'OBSERVACIÓN');
  assert.equal(revisarTriangulo([{ x: 100, y: 330 }, { x: 200, y: 200 }], TAM).nivel, 'NO_CALIFICA');
});

test('triangulación: el focal sintético en pirámide y en fila', () => {
  const pir = focal([0.45, 0.62, 0.8, 0.6, 0.42]);
  assert.equal(revisarTriangulo(pir.puntos, pir.img).nivel, 'CUMPLE');
  const fila = focal([0.55, 0.56, 0.55, 0.57]);
  assert.equal(revisarTriangulo(fila.puntos, fila.img).nivel, 'GRAVE');
});

test('triangulación: cajas del detector → puntos altos, sin repetidos ni basura', () => {
  const cajas = [
    { x: 100, y: 50, w: 80, h: 300, categoria: 'person', score: 0.9 },
    { x: 105, y: 55, w: 78, h: 290, categoria: 'person', score: 0.6 },   // la misma, repetida
    { x: 300, y: 150, w: 60, h: 100, categoria: 'potted plant', score: 0.5 },
    { x: 400, y: 10, w: 60, h: 60, categoria: 'tv', score: 0.9 },         // no va en un focal
    { x: 500, y: 200, w: 60, h: 60, categoria: 'person', score: 0.1 },    // poca confianza
  ];
  assert.deepEqual(puntosDeCajas(cajas), [{ x: 140, y: 50 }, { x: 330, y: 150 }]);
});

test('triangulación: sin muebles ni personas del fondo entre las sugerencias', () => {
  const cajas = [
    { x: 100, y: 50, w: 80, h: 300, categoria: 'person', score: 0.9 },
    { x: 400, y: 200, w: 30, h: 90, categoria: 'person', score: 0.6 },    // al fondo: 30 % de alto
    { x: 50, y: 300, w: 500, h: 120, categoria: 'dining table', score: 0.7 },
    { x: 300, y: 260, w: 120, h: 60, categoria: 'bench', score: 0.6 },
  ];
  assert.deepEqual(puntosDeCajas(cajas), [{ x: 140, y: 50 }]);
});

test('surtido: lo casi negro (sombra o producto negro) no cuenta como hueco', () => {
  const img = anaquel({ semilla: 5, ruido: 3, huecos: [[1, 2]] });
  const antes = revisarSurtido(img);
  assert.notEqual(antes.nivel, 'CUMPLE', 'la casilla vacía se ve');
  /* La misma casilla, pintada de negro liso: ya no se puede afirmar que esté vacía. */
  const d = Uint8ClampedArray.from(img.data);
  for (const c of antes.marcas.huecos.flat()) for (let y = c.y; y < c.y + c.h; y++) for (let x = c.x; x < c.x + c.w; x++) {
    const k = (y * img.width + x) * 4; d[k] = d[k + 1] = d[k + 2] = 4;
  }
  assert.equal(revisarSurtido({ width: img.width, height: img.height, data: d }).nivel, 'CUMPLE');
});

/* ── Veredicto ─────────────────────────────────────────────────────────── */
test('veredicto: el peor manda; NO_CALIFICA solo si nada calificó', () => {
  assert.equal(peor(['CUMPLE', 'OBSERVACIÓN', 'NO_CALIFICA']), 'OBSERVACIÓN');
  assert.equal(peor(['CUMPLE', 'GRAVE']), 'GRAVE');
  assert.equal(peor(['NO_CALIFICA', 'NO_CALIFICA']), 'NO_CALIFICA');
});

test('veredicto: reducir conserva la calidad para decidir', () => {
  const grande = tringla(BIEN, { w: 1600, h: 1200 });
  const chica = reducir(grande, 640);
  assert.equal(chica.width, 640);
  assert.equal(noCalifica(chica), null);
  assert.equal(revisarColor(chica).nivel, 'CUMPLE');
});

/* ── Regresiones que encontró eval/revision.mjs --sinteticas ──────────── */
test('colorización: una prenda blanca contra pared clara no desaparece como fondo', () => {
  const c = [P.calido[0], P.neutro[4], P.calido[2], P.frio[0], P.frio[1], P.frio[3], P.neutro[0], P.neutro[2]];
  const r = revisarColor(tringla(c, { ...SUCIA, semilla: 8 }));
  assert.equal(r.nivel, 'GRAVE', r.evidencia.grupos);
});

test('triangulación: escalera con dos alturas iguales arriba → GRAVE (un lado no baja)', () => {
  const r = revisarTriangulo([{ x: 100, y: 120 }, { x: 250, y: 118 }, { x: 400, y: 300 }, { x: 550, y: 320 }], TAM);
  assert.equal(r.nivel, 'GRAVE');
  assert.match(r.motivo, /no baja/);
  /* Con 4 elementos, la cima en el segundo sí es triángulo. */
  assert.equal(revisarTriangulo([{ x: 100, y: 300 }, { x: 250, y: 120 }, { x: 400, y: 220 }, { x: 550, y: 320 }], TAM).nivel, 'CUMPLE');
});
