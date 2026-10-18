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
import { leerMetadatos, veredictoOrigen, sha256Puro, huella, fechaExif, dimensiones, jpegCompleto, interpretarC2pa, admiteSynthid, conSynthid } from '../src/revision/procedencia.js';
import { revisarColor, clasificar, lab, enOrden, REGLA_COLOR, balanceBlancos, BRILLO } from '../src/revision/color.js';
import { revisarSurtido } from '../src/revision/surtido.js';
import { revisarTriangulo, revisarNiveles, puntosDeCajas, cimaDeSilueta } from '../src/revision/triangulo.js';
import { elegirCajas, cimaCreible, fusionarPuntos, recorteDe, iou } from '../src/revision/sugerir.js';
import { ajustarMarco, agarrar, zonaEn, LADO_MINIMO } from '../src/revision/marco.js';
import { revisarToma, inclinacion, suavizar, avisoNivel, NIVEL } from '../src/revision/toma.js';
import { tringla, anaquel, focal, PALETA as P, exifMuestra, xmpMuestra, c2paMuestra, conMetadatos, JPEG_MINIMO, rgb } from '../src/revision/demo.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SUCIA = { ruido: 8, desenfoque: 1, sombra: 0.35 };

/* ── Frontera ──────────────────────────────────────────────────────────── */
const DEL_NAVEGADOR = /\b(?:document|window|localStorage|sessionStorage|navigator|indexedDB|alert|confirm)\b/;
const sinComentarios = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

/* La pantalla (ui.js partida en cinco) y los cargadores de modelos tocan el navegador; el resto no. */
const PANTALLA = ['ui.js', 'comun.js', 'zonas.js', 'dibujo.js', 'reporte.js', 'guia.js'];
const PUERTAS = [...PANTALLA, 'detector.js', 'silueta.js', 'c2pa.js'];

test('frontera: las piezas de la revisión no usan APIs del navegador (solo la pantalla y los cargadores de modelos)', () => {
  const dir = path.join(RAIZ, 'src', 'revision');
  const malos = fs.readdirSync(dir).filter(f => f.endsWith('.js') && !PUERTAS.includes(f))
    .filter(f => DEL_NAVEGADOR.test(sinComentarios(fs.readFileSync(path.join(dir, f), 'utf8'))));
  assert.deepEqual(malos, []);
});

test('frontera: las piezas puras no importan a la pantalla', () => {
  const dir = path.join(RAIZ, 'src', 'revision');
  const malos = fs.readdirSync(dir).filter(f => f.endsWith('.js') && !PUERTAS.includes(f))
    .filter(f => PANTALLA.some(p => sinComentarios(fs.readFileSync(path.join(dir, f), 'utf8')).includes(`'./${p}'`)));
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
  assert.match(r.motivo, /no prueba cuándo ni dónde/);
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

test('origen: IPTC generada → GRAVE, retocada → OBSERVACIÓN; C2PA sin verificar nunca acusa', async () => {
  for (const [tipo, nivel] of [['trainedAlgorithmicMedia', 'GRAVE'], ['compositeWithTrainedAlgorithmicMedia', 'OBSERVACIÓN']]) {
    const x = await origen(conMetadatos(JPEG_MINIMO, { xmp: xmpMuestra(tipo) }));
    assert.equal(x.nivel, nivel, `XMP ${tipo}`);
    assert.equal(x.evidencia.declara, tipo);
    /* Una credencial que no se pudo verificar con el SDK: se dice, no se acusa. */
    const c = await origen(conMetadatos(JPEG_MINIMO, { c2pa: c2paMuestra(tipo) }));
    assert.equal(c.nivel, 'OBSERVACIÓN', `C2PA ${tipo}`);
    assert.equal(c.evidencia.firma_c2pa, 'sin verificar');
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

/* ── Credencial C2PA leída con el SDK oficial (7-oct) ───────────────────────
   Fixtures: lo que c2pa-node lee de muestras firmadas con el certificado de
   PRUEBA de c2pa-rs (contenido ficticio): lab/fixtures/c2pa/. */
const C2PA = n => JSON.parse(fs.readFileSync(path.join(RAIZ, 'lab', 'fixtures', 'c2pa', n + '.json'), 'utf8'));
const META_VACIA = { formato: 'jpeg', exif: null, xmpFuente: null, c2pa: { presente: true, fuente: null } };
const origenCon = (/** @type {any} */ credencial, meta = META_VACIA) => veredictoOrigen({ via: 'galeria', meta, huella: 'ab'.repeat(32), bytes: 1000, ahora: AHORA, credencial });

test('origen C2PA: generada con IA → GRAVE; retocada con IA → OBSERVACIÓN, no GRAVE', () => {
  const gen = interpretarC2pa(C2PA('b-ia-generada'));
  assert.ok(gen?.generada);
  assert.equal(origenCon(gen).nivel, 'GRAVE');
  const ret = interpretarC2pa(C2PA('c-ia-retocada'));
  assert.ok(ret?.retocada && !ret.generada && ret.captura, 'el padre es de cámara');
  const r = origenCon(ret);
  assert.equal(r.nivel, 'OBSERVACIÓN');
  assert.match(r.motivo, /retocada con IA/);
});

test('origen C2PA: una imagen de IA que solo fue referencia (inputTo) no hace IA a la foto', () => {
  const c = interpretarC2pa(C2PA('d-real-con-referencia-ia'));
  assert.ok(c && !c.generada && !c.retocada && c.captura);
  assert.notEqual(origenCon(c).nivel, 'GRAVE');
  /* La búsqueda vieja por bytes sí encontraba la palabra: sin el SDK, ya no acusa. */
  const r = origenCon(null, { ...META_VACIA, c2pa: { presente: true, fuente: 'trainedAlgorithmicMedia' } });
  assert.equal(r.nivel, 'OBSERVACIÓN');
  assert.match(r.motivo, /no se pudo leer/);
});

test('origen C2PA: imagen alterada después de firmar → no coincide; cámara con firma válida → OBSERVACIÓN; confiable → CUMPLE', () => {
  const alt = interpretarC2pa(C2PA('e-camara-alterada'));
  assert.equal(alt?.firma, 'invalida');
  assert.match(origenCon(alt).motivo, /no coincide con la imagen/);
  const cam = interpretarC2pa(C2PA('a-camara'));
  assert.equal(cam?.firma, 'valida', 'certificado de prueba: firma válida, emisor no confiable');
  assert.equal(origenCon(cam).nivel, 'OBSERVACIÓN');
  assert.equal(origenCon({ ...cam, firma: 'confiable', hora: new Date(AHORA.getTime() - 3600000).toISOString() }).nivel, 'CUMPLE');
});

test('origen C2PA confiable: firmada por la cámara hoy → CUMPLE; vieja o sin hora → OBSERVACIÓN', () => {
  /* Misma muestra validada con la raíz de prueba como ancla: validation_state «Trusted». */
  const st = C2PA('a-camara-confiable');
  assert.equal(st.validation_state, 'Trusted');
  const conHora = (/** @type {string|undefined} */ h) => {
    const copia = JSON.parse(JSON.stringify(st));
    if (h) copia.manifests[copia.active_manifest].signature_info.time = h;
    return interpretarC2pa(copia);
  };
  const hoy = conHora(new Date(AHORA.getTime() - 2 * 3600000).toISOString());
  assert.equal(hoy?.firma, 'confiable');
  const r = origenCon(hoy);
  assert.equal(r.nivel, 'CUMPLE');
  assert.match(r.motivo, /original firmada por la cámara/);
  const vieja = origenCon(conHora(new Date(AHORA.getTime() - 10 * 86400000).toISOString()));
  assert.equal(vieja.nivel, 'OBSERVACIÓN');
  assert.match(vieja.motivo, /hace 10 días/);
  assert.match(origenCon(conHora()).motivo, /no dice cuándo/);
  /* La hora del EXIF sirve si la firma no trae sello de tiempo. */
  const exifHoy = { formato: 'jpeg', xmpFuente: null, c2pa: { presente: true, fuente: null }, exif: { marca: 'M', modelo: 'X', software: null, fecha: null, fechaOriginal: '2026:10:06 13:30:00' } };
  assert.equal(origenCon(conHora(), exifHoy).nivel, 'CUMPLE');
  /* Generada con IA por un emisor confiable sigue siendo GRAVE. */
  const gen = interpretarC2pa(C2PA('b-ia-generada'));
  assert.equal(origenCon(gen && { ...gen, firma: 'confiable' }).nivel, 'GRAVE');
});

test('origen IPTC: retocada con IA → OBSERVACIÓN; generada con IA → GRAVE', () => {
  const m = (/** @type {string} */ x) => ({ formato: 'jpeg', exif: null, xmpFuente: x, c2pa: { presente: false, fuente: null } });
  assert.equal(origenCon(null, m('compositeWithTrainedAlgorithmicMedia')).nivel, 'OBSERVACIÓN');
  assert.equal(origenCon(null, m('trainedAlgorithmicMedia')).nivel, 'GRAVE');
  assert.equal(interpretarC2pa(null), null);
  assert.equal(interpretarC2pa({ manifests: {} }), null);
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

test('colorización: bloques limpios en otro orden → GRAVE (regla de Gerardo); la dirección y el rigor son configurables', () => {
  const img = tringla(BIEN.slice().reverse());
  const r = revisarColor(img);
  assert.equal(r.nivel, 'GRAVE');
  assert.match(r.motivo, /bien formados, pero van neutros → fríos → cálidos; la guía pide cálidos → fríos → neutros/);
  assert.equal(revisarColor(img, { regla: { ...REGLA_COLOR, ordenEstricto: false } }).nivel, 'OBSERVACIÓN');
  assert.equal(revisarColor(img, { regla: { ...REGLA_COLOR, direccion: 'der-izq' } }).nivel, 'CUMPLE');
});

test('colorización: tringla de vestidos → NO_CALIFICA con su motivo, sin medir', () => {
  const r = revisarColor(tringla([P.calido[0], P.frio[2], P.calido[3], P.neutro[2]]), { vestidos: true });
  assert.equal(r.nivel, 'NO_CALIFICA');
  assert.match(r.motivo, /Vestidos/);
  assert.equal(r.evidencia.vestidos, true);
});

test('colorización: un brillo angosto y quemado no parte el bloque (luz recortada, no una prenda)', () => {
  const img = tringla(BIEN);
  const W = img.width, H = img.height, ancho = 0.9 * W / BIEN.length, cx = 0.05 * W + 5.5 * ancho;
  for (let y = Math.round(0.2 * H); y < 0.8 * H; y++) for (let x = Math.round(cx - 0.0125 * W); x < cx + 0.0125 * W; x++) {
    const k = (y * W + x) * 4; img.data[k] = img.data[k + 1] = img.data[k + 2] = 255;
  }
  const r = revisarColor(img);
  assert.equal(r.nivel, 'CUMPLE', r.motivo);
  assert.equal(r.evidencia.brillos, 1);
  /* Sin la regla del brillo, la misma foto salía GRAVE «neutro entre fríos». */
  const antes = BRILLO.claridad;
  try { BRILLO.claridad = 999; assert.equal(revisarColor(img).nivel, 'GRAVE'); } finally { BRILLO.claridad = antes; }
});

test('colorización: si solo un color dudoso rompe el orden → OBSERVACIÓN «revísalo a ojo», ni GRAVE ni CUMPLE', () => {
  /* Un gris azulado pálido entre los fríos: ¿azul cielo o gris? La foto no deja decidir. */
  const r = revisarColor(tringla([P.calido[0], P.calido[1], P.frio[0], P.frio[1], '#D8DEE8', P.frio[2], P.frio[3], P.neutro[2], P.neutro[3]]));
  assert.equal(r.nivel, 'OBSERVACIÓN', r.motivo);
  assert.equal(r.evidencia.dudosos, 1);
  assert.match(r.motivo, /en el filo .* Revísalo a ojo/);
  assert.ok(r.marcas.tramos.some(t => t.dudoso && t.fueraGrupo));
  /* Un color franco en el mismo lugar sigue siendo GRAVE. */
  const g = revisarColor(tringla([P.calido[0], P.calido[1], P.frio[0], P.frio[1], P.calido[1], P.frio[2], P.frio[3], P.neutro[2], P.neutro[3]]));
  assert.equal(g.nivel, 'GRAVE');
});

test('colorización: qué colores quedan en el filo', () => {
  assert.equal(clasificar(85, 8, 250).dudoso, true, 'azul cielo o gris claro');
  assert.equal(clasificar(70, 30, 100).dudoso, true, 'amarillo verdoso: cálido o frío');
  assert.equal(clasificar(50, 60, 20).dudoso, false, 'rojo franco');
  assert.equal(clasificar(15, 2, 0).dudoso, false, 'negro');
  assert.equal(clasificar(30, 5, 260).dudoso, false, 'mezclilla lavada (confirmada por Gerardo)');
  assert.equal(clasificar(21, 8, 262).dudoso, false, 'azul marino');
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

/** Un anaquel lleno en la parte de abajo de una foto de área, con techo liso
 * arriba partido por lámparas (lo que deja el marco de la guía). */
function anaquelConTecho(op = {}) {
  const W = 640, H = 480, techo = 150, a = anaquel({ ...op, w: W, h: H - techo });
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = (y * W + x) * 4;
    if (y >= techo) { const j = ((y - techo) * W + x) * 4; data[k] = a.data[j]; data[k + 1] = a.data[j + 1]; data[k + 2] = a.data[j + 2]; }
    else {
      /* Plafones de lámparas de arriba abajo del techo, con rayas: parten lo liso en pedazos angostos. */
      const lampara = (x % 130) > 55 && (x % 130) < 80 && y < techo - 12;
      const v = lampara ? (y % 6 < 3 ? 255 : 150) : 228 - y * 0.05;
      data[k] = v; data[k + 1] = v - 2; data[k + 2] = v - 6;
    }
    data[k + 3] = 255;
  }
  return { width: W, height: H, data };
}

test('surtido: sin zona, el techo de una foto de área no es hueco aunque las lámparas lo partan', () => {
  const img = anaquelConTecho({ semilla: 3 });
  const conGuia = revisarSurtido(img);
  assert.equal(conGuia.nivel, 'CUMPLE', JSON.stringify(conGuia.evidencia));
  /* El mismo recuadro dibujado a mano dice «esto es el mueble»: ahí lo vacío sí cuenta. */
  const aMano = revisarSurtido(img, { marco: { x: 0.04 * 640, y: 0.04 * 480, w: 0.92 * 640, h: 0.92 * 480 } });
  assert.notEqual(aMano.nivel, 'CUMPLE');
});

test('surtido: con zona, lo que tapa un maniquí no es hueco ni producto', () => {
  const img = anaquel({ huecos: [[1, 2], [1, 3]], ...SUCIA, semilla: 2 });
  const marco = { x: 0.04 * img.width, y: 0.04 * img.height, w: 0.92 * img.width, h: 0.92 * img.height };
  assert.notEqual(revisarSurtido(img, { marco }).nivel, 'CUMPLE', 'sin el maniquí, las casillas se ven vacías');
  /* Un maniquí parado justo enfrente de esas casillas. */
  const maniqui = { x: img.width * 0.33, y: img.height * 0.32, w: img.width * 0.35, h: img.height * 0.34 };
  const r = revisarSurtido(img, { marco, excluir: [maniqui] });
  assert.equal(r.nivel, 'CUMPLE', JSON.stringify(r.evidencia));
  assert.ok(Number(r.evidencia.celdas_maniqui) > 0);
  assert.match(r.motivo, /maniquí/);
});

test('surtido: sin zona y con maniquí → NO_CALIFICA, pide marcar la mesa', () => {
  const img = anaquel({ semilla: 4 });
  const r = revisarSurtido(img, { excluir: [{ x: 10, y: 10, w: 120, h: 400 }] });
  assert.equal(r.nivel, 'NO_CALIFICA');
  assert.match(r.motivo, /Zona/);
});

/* ── Triangulación ─────────────────────────────────────────────────────── */
const TAM = { width: 640, height: 480 };
test('triangulación: una sola cima → CUMPLE (al centro o a un lado); plano → GRAVE; cima empatada → OBSERVACIÓN', () => {
  const pir = [{ x: 100, y: 330 }, { x: 220, y: 230 }, { x: 320, y: 120 }, { x: 420, y: 240 }, { x: 540, y: 340 }];
  assert.equal(revisarTriangulo(pir, TAM).nivel, 'CUMPLE');
  assert.equal(revisarTriangulo(pir, TAM).evidencia.forma, 'simétrico');
  assert.equal(revisarTriangulo([{ x: 100, y: 200 }, { x: 300, y: 205 }, { x: 500, y: 198 }], TAM).nivel, 'GRAVE');
  /* Asimétrico (confirmado por Gerardo, 7-oct): la cima a un lado, bajando. */
  const esc = revisarTriangulo([{ x: 100, y: 120 }, { x: 300, y: 220 }, { x: 500, y: 330 }], TAM);
  assert.equal(esc.nivel, 'CUMPLE');
  assert.equal(esc.evidencia.forma, 'asimétrico');
  assert.equal(revisarTriangulo([{ x: 100, y: 330 }, { x: 160, y: 120 }, { x: 300, y: 240 }, { x: 540, y: 340 }], TAM).nivel, 'CUMPLE');
  /* Alto, bajo, medio (maniquí en tarima, zapato en base, maniquí en piso). */
  assert.equal(revisarTriangulo([{ x: 180, y: 25 }, { x: 300, y: 215 }, { x: 420, y: 95 }], TAM).nivel, 'CUMPLE');
  assert.equal(revisarTriangulo([{ x: 100, y: 330 }, { x: 200, y: 200 }], TAM).nivel, 'NO_CALIFICA');
});

test('niveles: tres alturas o más → CUMPLE; dos → OBSERVACIÓN; plano → GRAVE', () => {
  assert.equal(revisarNiveles([{ x: 100, y: 120 }, { x: 300, y: 220 }, { x: 500, y: 330 }], TAM).nivel, 'CUMPLE');
  const dos = revisarNiveles([{ x: 100, y: 330 }, { x: 300, y: 120 }, { x: 500, y: 335 }], TAM);
  assert.equal(dos.nivel, 'OBSERVACIÓN');
  assert.match(dos.motivo, /nivel medio/);
  assert.equal(revisarNiveles([{ x: 100, y: 200 }, { x: 300, y: 205 }, { x: 500, y: 198 }], TAM).nivel, 'GRAVE');
  assert.equal(revisarNiveles([{ x: 100, y: 200 }], TAM).nivel, 'NO_CALIFICA');
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

/* ── Silueta (Magic Touch): la cima del objeto tocado ─────────────────── */
test('silueta: la cima es el renglón más alto del objeto tocado, sea 0 o 255 en la máscara', () => {
  const W = 100, H = 80;
  for (const [obj, fondo] of [[0, 255], [255, 0], [1, 0]]) {
    const m = new Uint8Array(W * H).fill(fondo);
    /* Un maniquí: cuerpo de x 40-60, y 30-75, y cabeza de x 46-54 desde y 20. */
    for (let y = 30; y < 75; y++) for (let x = 40; x < 60; x++) m[y * W + x] = obj;
    for (let y = 20; y < 30; y++) for (let x = 46; x < 54; x++) m[y * W + x] = obj;
    /* Otro objeto más alto, sin tocarse: no cuenta. */
    for (let y = 5; y < 50; y++) for (let x = 80; x < 90; x++) m[y * W + x] = obj;
    const r = cimaDeSilueta(m, W, H, { x: 0.5, y: 0.6 });
    assert.ok(r, `obj=${obj}`);
    assert.equal(r.cima.y, 20 / H);
    assert.ok(Math.abs(r.cima.x - 0.5) < 0.03);
    assert.deepEqual(r.caja, { x0: 0.4, y0: 0.25, x1: 0.6, y1: 75 / H });
    assert.equal(r.objeto.reduce((a, b) => a + b, 0), 20 * 45 + 8 * 10, 'solo el objeto tocado');
  }
});

test('silueta: si se derrama (muy grande o hasta el borde de arriba) no se le cree', () => {
  const W = 50, H = 50;
  const todo = new Uint8Array(W * H);                          // la «silueta» es la foto entera
  assert.equal(cimaDeSilueta(todo, W, H, { x: 0.5, y: 0.5 }), null);
  const m = new Uint8Array(W * H).fill(255);
  for (let y = 0; y < 30; y++) for (let x = 20; x < 30; x++) m[y * W + x] = 0;   // pega con el techo
  assert.equal(cimaDeSilueta(m, W, H, { x: 0.5, y: 0.3 }), null);
});

test('silueta: con zona, una cima muy por encima de ella no se cree', () => {
  const W = 100, H = 100;
  const m = new Uint8Array(W * H);
  /* Un objeto que sube hasta y=10 (se juntó con algo de arriba). */
  for (let y = 10; y < 80; y++) for (let x = 40; x < 60; x++) m[y * W + x] = 255;
  assert.ok(cimaDeSilueta(m, W, H, { x: 0.5, y: 0.6 }), 'sin zona, vale');
  assert.equal(cimaDeSilueta(m, W, H, { x: 0.5, y: 0.6 }, undefined, { marco: { y: 0.3 } }), null, '20 % arriba de la zona: no');
  assert.ok(cimaDeSilueta(m, W, H, { x: 0.5, y: 0.6 }, undefined, { marco: { y: 0.12 } }), 'a 2 % de la zona: sí');
});

test('silueta: un toque en el hueco del fondo (entre los brazos) agarra el objeto de al lado', () => {
  const W = 100, H = 100;
  const m = new Uint8Array(W * H);
  /* Una «U»: dos brazos y la base; el toque cae entre los brazos, en el fondo. */
  for (let y = 30; y < 80; y++) for (let x = 30; x < 70; x++) m[y * W + x] = 255;
  for (let y = 30; y < 60; y++) for (let x = 48; x < 52; x++) m[y * W + x] = 0;   // el hueco: 4 px de ancho
  const r = cimaDeSilueta(m, W, H, { x: 0.5, y: 0.4 });
  assert.ok(r, 'encuentra el objeto');
  assert.equal(r.cima.y, 0.3);
});

test('sugerir: duplicados solo dentro de la misma categoría; lo que lleva puesto el maniquí no es otro elemento', () => {
  const rec = { w: 1000, h: 1000, cortadoArriba: false };
  const persona = { x: 300, y: 100, w: 200, h: 700, categoria: 'person', score: 0.9 };
  const r = elegirCajas([
    persona,
    { ...persona, x: 310, score: 0.6 },                                         // la misma persona
    { x: 360, y: 400, w: 80, h: 90, categoria: 'handbag', score: 0.5 },         // la bolsa que lleva en la mano
  ], rec);
  /* La bolsa en la mano está donde el maniquí y sumaría una «altura» que no es de la exhibición. */
  assert.deepEqual(r.map(c => c.categoria), ['person']);
  assert.ok(iou(persona, { ...persona, x: 310 }) > 0.5);
});

test('sugerir: solo lo que está en la exhibición (17-oct, puntos fuera que vio Gerardo)', () => {
  const rec = { w: 1000, h: 1000, cortadoArriba: false };
  const m1 = { x: 300, y: 150, w: 140, h: 700, categoria: 'person', score: 0.9 };
  const m2 = { x: 520, y: 120, w: 140, h: 660, categoria: 'person', score: 0.8 };
  /** @type {{categoria:string, motivo:string}[]} */
  const fuera = [];
  const r = elegirCajas([
    m1, m2,
    { x: 560, y: 260, w: 50, h: 120, categoria: 'tie', score: 0.5 },            // la corbata de m2
    { x: 520, y: 700, w: 180, h: 160, categoria: 'suitcase', score: 0.5 },      // la base de m2
    { x: 960, y: 300, w: 40, h: 500, categoria: 'person', score: 0.6 },         // cortado por la orilla
    { x: 0, y: 600, w: 120, h: 250, categoria: 'suitcase', score: 0.6 },        // ropa de otra mesa, en la orilla
    { x: 20, y: 300, w: 80, h: 120, categoria: 'handbag', score: 0.6 },         // muro de bolsas, lejos del grupo
    { x: 880, y: 20, w: 60, h: 90, categoria: 'potted plant', score: 0.6 },     // planta arriba de todo
    { x: 760, y: 640, w: 110, h: 100, categoria: 'handbag', score: 0.5 },       // bolsa en su base, junto al grupo
  ], rec, undefined, fuera);
  assert.deepEqual(r.map(c => `${c.categoria}@${c.x}`).sort(), ['handbag@760', 'person@300', 'person@520']);
  /* Y dice por qué no contó cada cosa, para la barra de ayuda. */
  assert.deepEqual(fuera.map(f => `${f.categoria}:${f.motivo}`).sort(),
    ['handbag:lejos', 'person:orilla', 'potted plant:arriba', 'suitcase:base', 'suitcase:orilla', 'tie:puesto']);
});

test('sugerir: sin maniquíes los objetos se quedan (salvo la decoración de arriba)', () => {
  const rec = { w: 1000, h: 1000, cortadoArriba: false };
  const r = elegirCajas([
    { x: 100, y: 500, w: 120, h: 120, categoria: 'handbag', score: 0.6 },
    { x: 700, y: 520, w: 120, h: 120, categoria: 'handbag', score: 0.6 },
    { x: 400, y: 30, w: 80, h: 100, categoria: 'potted plant', score: 0.6 },
  ], rec);
  assert.deepEqual(r.map(c => c.x).sort((a, b) => a - b), [100, 700]);
});

test('sugerir: fuera lo que es fondo (llena la zona, sigue al techo, persona chica al fondo) y las bases', () => {
  const rec = { w: 1000, h: 1000, cortadoArriba: true };
  const r = elegirCajas([
    { x: 100, y: 200, w: 200, h: 700, categoria: 'person', score: 0.9 },
    { x: 0, y: 0, w: 950, h: 900, categoria: 'person', score: 0.8 },            // llena la zona
    { x: 500, y: 0, w: 100, h: 400, categoria: 'person', score: 0.8 },          // cortada por arriba
    { x: 700, y: 300, w: 40, h: 120, categoria: 'person', score: 0.7 },         // al fondo
    { x: 400, y: 500, w: 120, h: 80, categoria: 'suitcase', score: 0.7 },       // bolsa
    { x: 380, y: 585, w: 180, h: 100, categoria: 'suitcase', score: 0.5 },      // su base
    { x: 600, y: 600, w: 60, h: 60, categoria: 'potted plant', score: 0.3 },    // poca confianza
    { x: 650, y: 200, w: 100, h: 300, categoria: 'chair', score: 0.9 },         // mueble
  ], rec);
  assert.deepEqual(r.map(c => `${c.categoria}@${c.x}`).sort(), ['person@100', 'suitcase@400']);
});

test('sugerir: dos bolsas en bases escalonadas no son base una de la otra', () => {
  const rec = { w: 1000, h: 1000, cortadoArriba: false };
  const r = elegirCajas([
    { x: 630, y: 560, w: 124, h: 77, categoria: 'handbag', score: 0.41 },
    { x: 682, y: 655, w: 133, h: 85, categoria: 'suitcase', score: 0.68 },
  ], rec);
  assert.equal(r.length, 2);
});

test('sugerir: la silueta se cree solo si su cima cae dentro de la caja y cerca de arriba', () => {
  const caja = { x: 100, y: 200, w: 100, h: 400 };
  assert.ok(cimaCreible(caja, { x: 150, y: 210 }, 1000));
  assert.ok(!cimaCreible(caja, { x: 150, y: 120 }, 1000), 'subió hasta otra cosa');
  assert.ok(!cimaCreible(caja, { x: 250, y: 210 }, 1000), 'fuera de la caja');
  assert.ok(!cimaCreible(caja, { x: 150, y: 400 }, 1000), 'agarró solo un pedazo');
  assert.deepEqual(recorteDe({ x: 0.5, y: 0.5, w: 0.2, h: 0.2 }, 1000, 1000), { x: 484, y: 484, w: 232, h: 232 });
});

test('sugerir: se fusiona con lo que tocó la persona, sin pisarlo, y con tope', () => {
  const tocados = [{ x: 100, y: 100, toque: { x: 100, y: 150 } }];
  const f = fusionarPuntos(tocados, [{ x: 105, y: 102 }, { x: 400, y: 300 }], 20);
  assert.equal(f.puntos[0], tocados[0], 'el de la persona, el mismo objeto');
  assert.equal(f.agregados, 1);
  assert.equal(f.puntos.length, 2);
  const lleno = Array.from({ length: 9 }, (_, i) => ({ x: i * 100, y: 0 }));
  assert.equal(fusionarPuntos(lleno, [{ x: 50, y: 500 }], 20).agregados, 0, 'tope de 9');
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

test('triangulación: dos alturas iguales arriba → OBSERVACIÓN (no hay cima que guíe la vista)', () => {
  const r = revisarTriangulo([{ x: 100, y: 120 }, { x: 250, y: 118 }, { x: 400, y: 300 }, { x: 550, y: 320 }], TAM);
  assert.equal(r.nivel, 'OBSERVACIÓN');
  assert.match(r.motivo, /misma altura arriba/);
  /* Con 4 elementos, la cima en el segundo sí es triángulo. */
  assert.equal(revisarTriangulo([{ x: 100, y: 300 }, { x: 250, y: 120 }, { x: 400, y: 220 }, { x: 550, y: 320 }], TAM).nivel, 'CUMPLE');
});

/* ── SynthID revisado a mano (8-oct) ──────────────────────────────────── */
test('SynthID: se ofrece solo cuando la app no pudo probar el origen', async () => {
  assert.equal(admiteSynthid(await origen(JPEG_MINIMO)), true, 'reenviada por WhatsApp: sin datos');
  assert.equal(admiteSynthid(await origen(JPEG_MINIMO, 'app')), false, 'tomada en la app');
  const camara = conMetadatos(JPEG_MINIMO, { exif: exifMuestra({ marca: 'Marca', modelo: 'Modelo', fechaOriginal: '2026:10:08 10:00:00' }) });
  assert.equal(admiteSynthid(await origen(camara)), true, 'de galería con EXIF, sin credencial');
  assert.equal(admiteSynthid(origenCon(interpretarC2pa(C2PA('b-ia-generada')))), false, 'ya es GRAVE por su credencial');
  assert.equal(admiteSynthid(origenCon(interpretarC2pa(C2PA('c-ia-retocada')))), false, 'credencial válida: ya dice qué es');
  assert.equal(admiteSynthid({ basico: 'origen', nivel: 'DEMO', motivo: '', evidencia: {}, fuente: 'CÓDIGO' }), false, 'el ejemplo');
  assert.equal(admiteSynthid(null), false);
});

test('SynthID: hecha con IA → GRAVE; partes con IA → OBSERVACIÓN; sin marca no sube el nivel', async () => {
  const sin = await origen(JPEG_MINIMO);
  const g = conSynthid(sin, 'generada');
  assert.equal(g.nivel, 'GRAVE');
  assert.match(g.motivo, /revisado a mano/);
  assert.equal(g.evidencia.huella, sin.evidencia.huella, 'conserva la huella');
  assert.equal(conSynthid(sin, 'editada').nivel, 'OBSERVACIÓN');
  const n = conSynthid(sin, 'no');
  assert.equal(n.nivel, 'NO_CALIFICA');
  assert.match(n.motivo, /no prueba que sea real/);
  assert.match(String(n.evidencia.synthid), /sin marca/);
  assert.equal(sin.evidencia.synthid, undefined, 'no toca el original');
  /* Donde no se ofrece, anotar no cambia nada. */
  const app = await origen(JPEG_MINIMO, 'app');
  assert.equal(conSynthid(app, 'generada'), app);
});

/* ── Ajustar una zona con el dedo (18-oct) ────────────────────────────── */

const marcoValido = fc.record({ x: fc.double({ min: 0, max: 0.9, noNaN: true }), y: fc.double({ min: 0, max: 0.9, noNaN: true }), w: fc.double({ min: 0.06, max: 1, noNaN: true }), h: fc.double({ min: 0.06, max: 1, noNaN: true }) })
  .map(m => ({ ...m, w: Math.min(m.w, 1 - m.x), h: Math.min(m.h, 1 - m.y) }))
  .filter(m => m.w >= LADO_MINIMO && m.h >= LADO_MINIMO);
const desplazamiento = fc.double({ min: -1.5, max: 1.5, noNaN: true });
const esquina = fc.constantFrom(null, [0, 0], [1, 0], [0, 1], [1, 1]);
const casi = 1e-9;

test('ajustar zona: nunca se sale de la foto ni queda más chica que al dibujarla', () => {
  fc.assert(fc.property(marcoValido, esquina, desplazamiento, desplazamiento, (m0, e, dx, dy) => {
    const m = ajustarMarco(m0, /** @type {any} */ (e), dx, dy);
    return m.x >= -casi && m.y >= -casi && m.x + m.w <= 1 + casi && m.y + m.h <= 1 + casi
      && m.w >= LADO_MINIMO - casi && m.h >= LADO_MINIMO - casi;
  }));
});

test('ajustar zona: moverla no cambia su tamaño; estirar una esquina deja quieta la opuesta', () => {
  fc.assert(fc.property(marcoValido, desplazamiento, desplazamiento, (m0, dx, dy) => {
    const m = ajustarMarco(m0, null, dx, dy);
    return Math.abs(m.w - m0.w) < casi && Math.abs(m.h - m0.h) < casi;
  }));
  fc.assert(fc.property(marcoValido, fc.constantFrom([0, 0], [1, 0], [0, 1], [1, 1]), desplazamiento, desplazamiento, (m0, e, dx, dy) => {
    const [cx, cy] = /** @type {[number, number]} */ (e);
    const m = ajustarMarco(m0, [cx, cy], dx, dy);
    const fijaX = m0.x + (1 - cx) * m0.w, fijaY = m0.y + (1 - cy) * m0.h;
    return Math.abs((cx ? m.x : m.x + m.w) - fijaX) < casi && Math.abs((cy ? m.y : m.y + m.h) - fijaY) < casi;
  }));
  /* Un caso a mano: la esquina de abajo a la derecha se estira 10 % y 5 %. */
  const r = ajustarMarco({ x: 0.2, y: 0.2, w: 0.4, h: 0.4 }, [1, 1], 0.1, 0.05);
  assert.deepEqual(Object.values(r).map(v => +v.toFixed(6)), [0.2, 0.2, 0.5, 0.45]);
  /* Arrastrar la esquina de arriba a la izquierda más allá de la opuesta: se topa en el mínimo, no se voltea. */
  const t = ajustarMarco({ x: 0.2, y: 0.2, w: 0.4, h: 0.4 }, [0, 0], 0.9, 0.9);
  assert.deepEqual(Object.values(t).map(v => +v.toFixed(6)), [0.54, 0.54, 0.06, 0.06]);
});

test('ajustar zona: el dedo agarra la esquina más cercana, la zona o nada; y elige la zona más chica', () => {
  const m = { x: 0.2, y: 0.2, w: 0.4, h: 0.4 };
  assert.deepEqual(agarrar(m, 0.21, 0.59, 0.05, 0.05), { esquina: [0, 1] });
  assert.deepEqual(agarrar(m, 0.4, 0.4, 0.05, 0.05), { esquina: null });
  assert.equal(agarrar(m, 0.9, 0.9, 0.05, 0.05), null);
  /* Una zona angosta: las dos esquinas de arriba quedan al alcance; gana la más cercana. */
  assert.deepEqual(agarrar({ x: 0.5, y: 0.5, w: 0.06, h: 0.3 }, 0.545, 0.5, 0.05, 0.05), { esquina: [1, 0] });
  const area = { x: 0, y: 0, w: 1, h: 1 }, mesa = { x: 0.1, y: 0.5, w: 0.3, h: 0.3 };
  assert.equal(zonaEn([area, mesa], 0.2, 0.6), 1);
  assert.equal(zonaEn([area, mesa], 0.8, 0.2), 0);
  assert.equal(zonaEn([mesa], 0.8, 0.2), -1);
});

/* ── Toma en vivo: luz, nitidez y nivel antes de tomar (18-oct) ────────── */

/** Caja 5×5 tres veces: una foto movida. @param {{width:number,height:number,data:Uint8ClampedArray}} img */
function movida(img) {
  let d = Uint8ClampedArray.from(img.data);
  const W = img.width, H = img.height;
  for (let pasada = 0; pasada < 3; pasada++) {
    const o = new Uint8ClampedArray(d.length);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (let c = 0; c < 4; c++) {
      let s = 0, n = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const xx = Math.min(W - 1, Math.max(0, x + dx)), yy = Math.min(H - 1, Math.max(0, y + dy));
        s += d[(yy * W + xx) * 4 + c]; n++;
      }
      o[(y * W + x) * 4 + c] = s / n;
    }
    d = o;
  }
  return { width: W, height: H, data: d };
}

test('toma en vivo: luz y nitidez dicen lo mismo que noCalifica, las dos a la vez', () => {
  const base = tringla([P.calido[0], P.frio[0], P.neutro[2]], { w: 320, h: 240, semilla: 4 });
  const guia = { x: 0.04 * 320, y: 0.1 * 240, w: 0.92 * 320, h: 0.8 * 240 };
  const borrosa = movida(base);
  fc.assert(fc.property(fc.double({ min: 0.05, max: 1, noNaN: true }), fc.boolean(), (luz, mov) => {
    const src = mov ? borrosa : base;
    const img = { width: src.width, height: src.height, data: src.data.map((v, i) => (i % 4 === 3 ? v : v * luz)) };
    const t = revisarToma(img, guia), nc = noCalifica(img, guia);
    return (nc === null) === (t.luz && t.nitida)
      && (!nc || (/oscura/.test(nc.motivo) ? !t.luz : !t.nitida));
  }), { numRuns: 25 });
  /* Oscura Y movida: noCalifica solo dice «oscura»; la toma avisa de las dos. */
  const ambas = { ...borrosa, data: borrosa.data.map((v, i) => (i % 4 === 3 ? v : v * 0.1)) };
  const t = revisarToma(ambas, guia);
  assert.equal(t.luz, false); assert.equal(t.nitida, false);
});

test('toma en vivo: el nivel sale de la gravedad, igual en Android, iOS y de lado', () => {
  const g = 9.81, rad = (/** @type {number} */ d) => d * Math.PI / 180;
  const cerca = (/** @type {number} */ a, /** @type {number} */ b) => Math.abs(a - b) < 1e-6;
  assert.deepEqual(inclinacion({ x: 0, y: g, z: 0 }), { ladeo: 0, frente: 0 });
  /* Ladeado 10° a la derecha (Android: la gravedad apunta hacia arriba del teléfono). */
  const and = /** @type {{ladeo:number,frente:number}} */ (inclinacion({ x: -g * Math.sin(rad(10)), y: g * Math.cos(rad(10)), z: 0 }));
  assert.ok(cerca(and.ladeo, 10));
  /* iOS da los signos al revés: la misma lectura. */
  const ios = /** @type {{ladeo:number,frente:number}} */ (inclinacion({ x: g * Math.sin(rad(10)), y: -g * Math.cos(rad(10)), z: 0 }));
  assert.ok(cerca(ios.ladeo, 10));
  /* De lado (landscape, la pantalla girada 90°) y derecho: 0. */
  assert.ok(cerca(/** @type {any} */ (inclinacion({ x: g, y: 0, z: 0 }, 90)).ladeo, 0));
  /* Mirando 30° hacia arriba. */
  assert.ok(cerca(/** @type {any} */ (inclinacion({ x: 0, y: g * Math.cos(rad(30)), z: g * Math.sin(rad(30)) })).frente, 30));
  /* Acostado sobre la mesa o sin sensor: sin lectura. */
  assert.equal(inclinacion({ x: 0, y: 0.3, z: g }), null);
  assert.equal(inclinacion({ x: null, y: null, z: null }), null);
  fc.assert(fc.property(fc.double({ min: -1e3, max: 1e3, noNaN: true }), fc.double({ min: -1e3, max: 1e3, noNaN: true }), fc.double({ min: -1e3, max: 1e3, noNaN: true }), fc.constantFrom(0, 90, 180, 270), (x, y, z, a) => {
    const n = inclinacion({ x, y, z }, a);
    return n === null || (n.ladeo > -90 - 1e-9 && n.ladeo <= 90 + 1e-9 && n.frente >= 0 && n.frente <= 90 + 1e-9);
  }));
});

test('toma en vivo: el aviso del nivel y el suavizado', () => {
  assert.deepEqual(avisoNivel({ ladeo: 1, frente: 5 }), { ok: true, texto: 'Derecho' });
  assert.equal(avisoNivel({ ladeo: -4, frente: 5 }).texto, 'Casi derecho · 4°');
  assert.equal(avisoNivel({ ladeo: 9.4, frente: 5 }).texto, 'Ladeado 9°');
  assert.equal(avisoNivel({ ladeo: 0, frente: NIVEL.deFrente + 5 }).texto, 'Ponlo de frente');
  let s = null;
  for (let i = 0; i < 40; i++) s = suavizar(s, { ladeo: 8, frente: 0 });
  assert.ok(Math.abs(/** @type {any} */ (s).ladeo - 8) < 0.01);
  assert.equal(suavizar({ ladeo: 0, frente: 0 }, { ladeo: 8, frente: 0 }).ladeo, 2);
});
