// Asistente de Piso · Copyright (c) 2026 Gerardo Barrera.
// Licencia PolyForm Noncommercial 1.0.0: uso comercial solo con licencia escrita (LICENCIA-COMERCIAL.md).
//
// Origen de la foto (ADR 0007, punto 1). No se adivina si una foto es IA: se
// prueba de dónde salió.
// - Tomada en la app: hora, tamaño y huella SHA-256 del archivo.
// - De galería: EXIF (fecha, cámara, editor), XMP/IPTC DigitalSourceType y
//   si trae un manifiesto C2PA (JUMBF). La firma C2PA no se valida en v1.
// GRAVE solo cuando la propia foto declara IA. Nunca por un detector.
//
// Sin DOM: recibe los bytes del archivo (Uint8Array).

import { resultado } from './veredicto.js';

/** @typedef {import('./veredicto.js').Resultado} Resultado */
/**
 * @typedef {Object} Exif
 * @property {string|null} marca
 * @property {string|null} modelo
 * @property {string|null} software
 * @property {string|null} fecha          DateTime (última escritura)
 * @property {string|null} fechaOriginal  DateTimeOriginal (cuando se tomó)
 */
/**
 * @typedef {Object} Metadatos
 * @property {'jpeg'|'png'|'webp'|'heic'|'desconocido'} formato
 * @property {Exif|null} exif
 * @property {string|null} xmpFuente   DigitalSourceType del XMP/IPTC, si hay
 * @property {{presente:boolean, fuente:string|null}} c2pa
 */

/* Tipos de origen IPTC (cv.iptc.org/newscodes/digitalsourcetype). Los que
   declaran IA van primero: «compositeWithTrainedAlgorithmicMedia» contiene a
   «TrainedAlgorithmicMedia» y se busca antes. */
export const FUENTES_IA = ['compositeWithTrainedAlgorithmicMedia', 'trainedAlgorithmicMedia', 'compositeSynthetic', 'algorithmicMedia'];
export const FUENTES_CAMARA = ['digitalCapture', 'computationalCapture', 'negativeFilm', 'positiveFilm', 'print'];

/* El campo Software lo llenan también las cámaras de los teléfonos (versión
   del sistema o del firmware). Solo cuenta como edición si nombra un editor. */
export const EDITORES = ['photoshop', 'lightroom', 'gimp', 'snapseed', 'picsart', 'canva', 'pixelmator', 'affinity',
  'photopea', 'facetune', 'meitu', 'vsco', 'paint.net', 'luminar', 'fotor', 'photodirector', 'remini', 'photoroom',
  'capcut', 'lensa', 'polarr', 'airbrush', 'beautyplus', 'inshot', 'firefly', 'midjourney', 'dall', 'stable diffusion'];

const enc = new TextEncoder();
const latin1 = new TextDecoder('latin1');
const utf8 = new TextDecoder('utf-8', { fatal: true });

/** Primera posición de `aguja` en `b` desde `desde`, o -1.
 * @param {Uint8Array} b @param {Uint8Array|string} aguja @param {number} [desde] */
export function buscar(b, aguja, desde = 0) {
  const a = typeof aguja === 'string' ? enc.encode(aguja) : aguja;
  const n = a.length, lim = b.length - n;
  outer: for (let i = desde; i <= lim; i++) {
    if (b[i] !== a[0]) continue;
    for (let j = 1; j < n; j++) if (b[i + j] !== a[j]) continue outer;
    return i;
  }
  return -1;
}

/** El primer tipo de origen de la lista que aparezca en los bytes.
 * @param {Uint8Array} b @returns {string|null} */
function fuenteEn(b) {
  for (const f of [...FUENTES_IA, ...FUENTES_CAMARA]) if (buscar(b, f) >= 0) return f;
  return null;
}

/** @param {Uint8Array} b */
export function formato(b) {
  if (b[0] === 0xFF && b[1] === 0xD8) return 'jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return 'png';
  if (latin1.decode(b.subarray(0, 4)) === 'RIFF' && latin1.decode(b.subarray(8, 12)) === 'WEBP') return 'webp';
  if (latin1.decode(b.subarray(4, 8)) === 'ftyp' && /hei|mif|avi/.test(latin1.decode(b.subarray(8, 12)))) return 'heic';
  return 'desconocido';
}

/**
 * EXIF a partir del bloque TIFF (lo que sigue a «Exif\0\0»).
 * @param {Uint8Array} t @returns {Exif|null}
 */
export function leerTiff(t) {
  if (t.length < 8) return null;
  const le = t[0] === 0x49 && t[1] === 0x49;
  if (!le && !(t[0] === 0x4D && t[1] === 0x4D)) return null;
  const dv = new DataView(t.buffer, t.byteOffset, t.byteLength);
  const u16 = (/** @type {number} */ o) => dv.getUint16(o, le);
  const u32 = (/** @type {number} */ o) => dv.getUint32(o, le);
  /** @type {Exif} */
  const ex = { marca: null, modelo: null, software: null, fecha: null, fechaOriginal: null };
  /** @param {number} tipo @param {number} n @param {number} o */
  const ascii = (tipo, n, o) => {
    if (tipo !== 2) return null;
    const ini = n <= 4 ? o : u32(o);
    if (ini + n > t.length) return null;
    const b = t.subarray(ini, ini + n);
    /* EXIF dice ASCII, pero muchos teléfonos escriben UTF-8: se intenta
       primero y, si no es UTF-8 válido, latin1. */
    let txt;
    try { txt = utf8.decode(b); } catch { txt = latin1.decode(b); }
    return txt.replace(/\0+$/, '').trim() || null;
  };
  /** @param {number} off @returns {number|null} puntero a la sub-IFD Exif */
  const ifd = (off) => {
    if (off + 2 > t.length) return null;
    const n = u16(off);
    let exifPtr = null;
    for (let k = 0; k < n; k++) {
      const e = off + 2 + k * 12;
      if (e + 12 > t.length) break;
      const tag = u16(e), tipo = u16(e + 2), cnt = u32(e + 4);
      if (tag === 0x010F) ex.marca = ascii(tipo, cnt, e + 8);
      else if (tag === 0x0110) ex.modelo = ascii(tipo, cnt, e + 8);
      else if (tag === 0x0131) ex.software = ascii(tipo, cnt, e + 8);
      else if (tag === 0x0132) ex.fecha = ascii(tipo, cnt, e + 8);
      else if (tag === 0x9003) ex.fechaOriginal = ascii(tipo, cnt, e + 8);
      else if (tag === 0x8769) exifPtr = u32(e + 8);
    }
    return exifPtr;
  };
  try {
    const sub = ifd(u32(4));
    if (sub) ifd(sub);
  } catch { /* EXIF roto: lo leído hasta ahí vale */ }
  return ex;
}

/** DigitalSourceType dentro de un paquete XMP (texto). @param {string} xmp */
function fuenteXmp(xmp) {
  const m = xmp.match(/DigitalSourceType\s*(?:=\s*["']|>)\s*([^"'<\s]+)/i);
  if (!m) return null;
  const v = m[1];
  return [...FUENTES_IA, ...FUENTES_CAMARA].find(f => v.endsWith('/' + f) || v === f) || v;
}

/**
 * Lee lo que dice la foto de sí misma.
 * @param {Uint8Array} b bytes del archivo @returns {Metadatos}
 */
export function leerMetadatos(b) {
  const fmt = formato(b);
  /** @type {Metadatos} */
  const m = { formato: fmt, exif: null, xmpFuente: null, c2pa: { presente: false, fuente: null } };
  /** @type {Uint8Array[]} */
  const jumbf = [];
  if (fmt === 'jpeg') {
    let p = 2;
    while (p + 4 <= b.length && b[p] === 0xFF) {
      const mk = b[p + 1];
      if (mk === 0xD9 || mk === 0xDA) break;           // fin o inicio de la imagen
      if (mk === 0x01 || (mk >= 0xD0 && mk <= 0xD7)) { p += 2; continue; }
      const len = (b[p + 2] << 8) | b[p + 3];
      const seg = b.subarray(p + 4, p + 2 + len);
      if (mk === 0xE1) {
        if (latin1.decode(seg.subarray(0, 6)) === 'Exif\0\0') m.exif = leerTiff(seg.subarray(6));
        else if (latin1.decode(seg.subarray(0, 28)) === 'http://ns.adobe.com/xap/1.0/') m.xmpFuente = m.xmpFuente || fuenteXmp(new TextDecoder().decode(seg));
      } else if (mk === 0xEB && seg[0] === 0x4A && seg[1] === 0x50) {
        jumbf.push(seg.subarray(8));                   // «JP», instancia (2) y secuencia (4)
      }
      p += 2 + len;
    }
  } else if (fmt === 'png') {
    let p = 8;
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    while (p + 8 <= b.length) {
      const len = dv.getUint32(p), tipo = latin1.decode(b.subarray(p + 4, p + 8));
      const dat = b.subarray(p + 8, p + 8 + len);
      if (tipo === 'eXIf') m.exif = leerTiff(dat);
      else if (tipo === 'iTXt' && latin1.decode(dat.subarray(0, 17)) === 'XML:com.adobe.xmp') m.xmpFuente = fuenteXmp(new TextDecoder().decode(dat));
      else if (tipo === 'caBX') jumbf.push(dat);
      else if (tipo === 'IEND') break;
      p += 12 + len;
    }
  } else {
    /* WebP, HEIC y otros: sin parser propio en v1. Se buscan las marcas en
       los bytes; los nombres son tan específicos que no se confunden. */
    const xi = buscar(b, 'DigitalSourceType');
    if (xi >= 0) m.xmpFuente = fuenteXmp(latin1.decode(b.subarray(xi, xi + 300)));
    if (buscar(b, 'c2pa') >= 0 && buscar(b, 'jumb') >= 0) jumbf.push(b);
    const ei = buscar(b, 'Exif\0\0');
    if (ei >= 0) m.exif = leerTiff(b.subarray(ei + 6));
  }
  if (jumbf.length) {
    const todo = jumbf.length === 1 ? jumbf[0] : concatenar(jumbf);
    if (buscar(todo, 'jumb') >= 0 && buscar(todo, 'c2pa') >= 0) m.c2pa = { presente: true, fuente: fuenteEn(todo) };
  }
  return m;
}

/** @param {Uint8Array[]} partes */
function concatenar(partes) {
  const out = new Uint8Array(partes.reduce((s, x) => s + x.length, 0));
  let o = 0;
  for (const x of partes) { out.set(x, o); o += x.length; }
  return out;
}

/* ── Huella ───────────────────────────────────────────────────────────── */

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);

/** SHA-256 en JS puro: para Node viejo o un contexto sin crypto.subtle (http).
 * @param {Uint8Array} msg @returns {string} hex */
export function sha256Puro(msg) {
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const l = msg.length, total = Math.ceil((l + 9) / 64) * 64;
  const p = new Uint8Array(total);
  p.set(msg); p[l] = 0x80;
  const dv = new DataView(p.buffer);
  dv.setUint32(total - 8, Math.floor(l / 0x20000000)); dv.setUint32(total - 4, (l << 3) >>> 0);
  const w = new Uint32Array(64);
  for (let o = 0; o < total; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15], b = w[i - 2];
      const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
      const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [A, B, C, D, E, F, G, H] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = ((E >>> 6) | (E << 26)) ^ ((E >>> 11) | (E << 21)) ^ ((E >>> 25) | (E << 7));
      const t1 = (H + S1 + ((E & F) ^ (~E & G)) + K[i] + w[i]) >>> 0;
      const S0 = ((A >>> 2) | (A << 30)) ^ ((A >>> 13) | (A << 19)) ^ ((A >>> 22) | (A << 10));
      const t2 = (S0 + ((A & B) ^ (A & C) ^ (B & C))) >>> 0;
      H = G; G = F; F = E; E = (D + t1) >>> 0; D = C; C = B; B = A; A = (t1 + t2) >>> 0;
    }
    h[0] += A; h[1] += B; h[2] += C; h[3] += D; h[4] += E; h[5] += F; h[6] += G; h[7] += H;
  }
  return [...h].map(x => x.toString(16).padStart(8, '0')).join('');
}

/** SHA-256 del archivo, en hex. @param {Uint8Array} bytes @returns {Promise<string>} */
export async function huella(bytes) {
  const sutil = /** @type {any} */ (globalThis).crypto?.subtle;
  if (sutil) {
    try {
      const d = new Uint8Array(await sutil.digest('SHA-256', bytes));
      return [...d].map(x => x.toString(16).padStart(2, '0')).join('');
    } catch { /* sin contexto seguro: cae al puro */ }
  }
  return sha256Puro(bytes);
}

/* ── Veredicto ────────────────────────────────────────────────────────── */

/** «2026:10:06 14:03:11» → Date local, o null. @param {string|null} s */
export function fechaExif(s) {
  const m = s && s.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  return isNaN(+d) ? null : d;
}

/** @param {string|null} s */
export function editorEn(s) {
  if (!s) return null;
  const v = s.toLowerCase();
  return EDITORES.find(e => v.includes(e)) ? s : null;
}

/**
 * @param {Object} p
 * @param {'app'|'galeria'} p.via
 * @param {Metadatos} p.meta
 * @param {string} p.huella      SHA-256 hex del archivo
 * @param {number} p.bytes       tamaño del archivo
 * @param {Date} [p.ahora]
 * @param {Date} [p.tomada]      hora de la captura en la app
 * @returns {Resultado}
 */
export function veredictoOrigen({ via, meta, huella: h, bytes, ahora = new Date(), tomada }) {
  const corta = h.slice(0, 16);
  /** @type {Record<string, string|number|boolean|null>} */
  const ev = { via, formato: meta.formato, huella: corta, bytes };
  const ia = [meta.c2pa.fuente, meta.xmpFuente].find(f => f && FUENTES_IA.includes(f));
  if (meta.c2pa.presente) { ev.c2pa = meta.c2pa.fuente || 'presente'; ev.firma_c2pa = 'sin validar (v1)'; }
  if (meta.xmpFuente) ev.iptc = meta.xmpFuente;
  if (ia) {
    ev.declara = ia;
    const que = ia === 'trainedAlgorithmicMedia' ? 'generada con IA' : ia === 'algorithmicMedia' ? 'generada por computadora' : 'compuesta o editada con IA';
    const donde = meta.c2pa.presente && FUENTES_IA.includes(meta.c2pa.fuente || '') ? 'su credencial de contenido (C2PA)' : 'sus metadatos (IPTC)';
    return resultado('origen', 'GRAVE', `La propia imagen declara en ${donde} que fue ${que}. No sirve como evidencia de montaje.`, ev);
  }
  if (via === 'app') {
    const t = tomada || ahora;
    ev.tomada = t.toISOString();
    return resultado('origen', 'CUMPLE', `Tomada en la app a las ${hora(t)}. La huella prueba que no se editó después.`, ev);
  }
  const ex = meta.exif;
  const editor = editorEn(ex?.software || null);
  if (ex) {
    ev.camara = [ex.marca, ex.modelo].filter(Boolean).join(' ') || null;
    ev.software = ex.software;
    ev.fecha_original = ex.fechaOriginal;
  }
  if (editor) return resultado('origen', 'OBSERVACIÓN', `De galería y pasó por un editor (${editor}).`, ev);
  const camara = !!(ex && ex.marca && ex.modelo);
  const t = fechaExif(ex?.fechaOriginal || null);
  const camaraC2pa = meta.c2pa.presente && meta.c2pa.fuente && FUENTES_CAMARA.includes(meta.c2pa.fuente);
  if ((camara && t) || camaraC2pa) {
    let motivo = camara ? `De galería: ${ev.camara}` : 'De galería, con manifiesto C2PA de cámara';
    if (t) {
      const horas = (ahora.getTime() - t.getTime()) / 3600000;
      ev.edad_horas = Math.round(horas * 10) / 10;
      motivo += horas > 24 ? `, tomada hace ${Math.round(horas / 24)} días.` : horas < -1 ? ', con fecha en el futuro.' : `, tomada a las ${hora(t)}.`;
    } else motivo += '.';
    return resultado('origen', 'OBSERVACIÓN', motivo + ' Para evidencia, mejor tomarla en la app.', ev);
  }
  return resultado('origen', 'NO_CALIFICA', 'Sin datos de cámara (reenviada por WhatsApp o captura de pantalla): revisar en persona.', ev);
}

/** @param {Date} d */
function hora(d) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
