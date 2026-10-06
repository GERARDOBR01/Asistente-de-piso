// Asistente de Piso · Copyright (c) 2026 Gerardo Barrera.
// Licencia PolyForm Noncommercial 1.0.0: uso comercial solo con licencia escrita (LICENCIA-COMERCIAL.md).
//
// Imágenes sintéticas para las pruebas y para el modo demo (ADR 0007): una
// tringla, un anaquel y un focal dibujados por código, con ruido, sombra y
// desenfoque. No son fotos de tienda ni lo pretenden; sirven para probar que
// el método hace lo que dice y para enseñar la pantalla sin cámara.
//
// Sin DOM: devuelven {width,height,data} como ImageData.

/** @typedef {import('./veredicto.js').Imagen} Imagen */

/** PRNG con semilla (mulberry32): la misma semilla, la misma imagen. @param {number} s */
export function azar(s) {
  return () => {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** @param {string} hex @returns {number[]} */
export function rgb(hex) {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/** @param {number} w @param {number} h @param {number[]} c */
function lienzo(w, h, c) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) { data[i * 4] = c[0]; data[i * 4 + 1] = c[1]; data[i * 4 + 2] = c[2]; data[i * 4 + 3] = 255; }
  return { width: w, height: h, data };
}

/** Pinta un píxel con un color multiplicado por `luz`. @param {Imagen} img @param {number} x @param {number} y @param {number[]} c @param {number} [luz] */
function pix(img, x, y, c, luz = 1) {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
  const k = ((y | 0) * img.width + (x | 0)) * 4;
  img.data[k] = c[0] * luz; img.data[k + 1] = c[1] * luz; img.data[k + 2] = c[2] * luz;
}

/** @param {Imagen} img @param {number} x0 @param {number} y0 @param {number} x1 @param {number} y1 @param {number[]} c @param {(x:number,y:number)=>number} [luz] */
function rect(img, x0, y0, x1, y1, c, luz) {
  for (let y = Math.max(0, Math.round(y0)); y < Math.min(img.height, Math.round(y1)); y++)
    for (let x = Math.max(0, Math.round(x0)); x < Math.min(img.width, Math.round(x1)); x++) pix(img, x, y, c, luz ? luz(x, y) : 1);
}

/** Pared con degradado y suelo: el «cuarto» donde va todo. @param {number} w @param {number} h @param {number[]} pared @param {number} piso */
function cuarto(w, h, pared, piso) {
  const img = lienzo(w, h, pared);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = 1 - 0.10 * Math.hypot((x - w / 2) / w, (y - h * 0.3) / h);
    if (y > h * piso) pix(img, x, y, pared.map(c => c * 0.62), v * (0.9 + 0.1 * (y / h)));
    else pix(img, x, y, pared, v);
  }
  return img;
}

/**
 * Lo que vuelve «foto» al dibujo: sombra de un lado, desenfoque y ruido.
 * @param {Imagen} img @param {{ruido?:number,desenfoque?:number,sombra?:number,brillo?:number,semilla?:number}} op
 */
export function ensuciar(img, op = {}) {
  const r = azar((op.semilla || 1) * 7919);
  const { width: w, height: h, data: d } = img;
  if (op.sombra || op.brillo) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = (y * w + x) * 4;
      const m = (op.brillo ?? 1) * (1 - (op.sombra || 0) * Math.max(0, 1 - x / (w * 0.6)));
      d[k] *= m; d[k + 1] *= m; d[k + 2] *= m;
    }
  }
  for (let pasada = 0; pasada < (op.desenfoque || 0); pasada++) desenfocar(img);
  if (op.ruido) {
    for (let i = 0; i < w * h; i++) {
      const g = op.ruido * (r() + r() + r() - 1.5) * 1.4;
      for (let c = 0; c < 3; c++) d[i * 4 + c] += g + op.ruido * 0.4 * (r() - 0.5);
    }
  }
  return img;
}

/** Caja 3×3, una pasada. @param {Imagen} img */
function desenfocar(img) {
  const { width: w, height: h } = img, s = Uint8ClampedArray.from(img.data);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) for (let c = 0; c < 3; c++) {
    let t = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) t += s[((y + dy) * w + x + dx) * 4 + c];
    img.data[(y * w + x) * 4 + c] = t / 9;
  }
}

/* Colores de prenda por grupo, en el orden de la rueda de la guía. */
export const PALETA = {
  calido: ['#B0125F', '#D81B4A', '#E8401C', '#F07A12', '#F2A900'],
  frio: ['#1E9E55', '#0F8F8A', '#1F5FD6', '#4B2A99', '#7A2A9C'],
  neutro: ['#7A4A1E', '#D9B48A', '#1C1C1E', '#8E8E92', '#F2F0EC'],
};

/**
 * Una tringla con prendas colgadas.
 * @param {string[]} colores  de izquierda a derecha
 * @param {{w?:number,h?:number,semilla?:number,ruido?:number,desenfoque?:number,sombra?:number,brillo?:number,pared?:string}} [op]
 */
export function tringla(colores, op = {}) {
  const w = op.w || 640, h = op.h || 480, r = azar(op.semilla || 3);
  const img = cuarto(w, h, rgb(op.pared || '#E9E4DC'), 0.9);
  const rielY = h * 0.13;
  rect(img, w * 0.02, rielY - 3, w * 0.98, rielY + 3, [150, 150, 155]);
  const n = colores.length, ancho = (w * 0.9) / n, x0 = w * 0.05;
  colores.forEach((hex, i) => {
    const c = rgb(hex), cx = x0 + (i + 0.5) * ancho, aw = ancho * (0.92 + 0.12 * r());
    const top = h * (0.21 + 0.02 * r()), fondo = h * (0.78 + 0.06 * r());
    /* El gancho. */
    for (let y = rielY; y < top; y++) pix(img, cx, y, [90, 90, 95]);
    for (let y = Math.round(top); y < fondo; y++) {
      const t = (y - top) / (fondo - top);
      const media = aw / 2 * (t < 0.08 ? 0.55 + 0.45 * (t / 0.08) : 1);
      for (let x = Math.round(cx - media); x < cx + media; x++) {
        const u = (x - (cx - media)) / (2 * media);
        /* Pliegues y la sombra del borde, que separa una prenda de la otra. */
        const luz = (0.86 + 0.1 * Math.sin(u * 9 + i) + 0.04 * Math.sin(t * 7)) * (1 - 0.35 * Math.pow(Math.abs(u - 0.5) * 2, 6));
        pix(img, x, y, c, luz);
      }
    }
  });
  return ensuciar(img, op);
}

/**
 * Un anaquel de 3 entrepaños con pilas de prendas dobladas; `huecos` son las
 * casillas vacías, contadas por renglón: [renglón, columna].
 * @param {{w?:number,h?:number,semilla?:number,ruido?:number,desenfoque?:number,sombra?:number,brillo?:number,huecos?:number[][],columnas?:number}} [op]
 */
export function anaquel(op = {}) {
  const w = op.w || 640, h = op.h || 480, r = azar(op.semilla || 5), cols = op.columnas || 6;
  const img = cuarto(w, h, rgb('#DCD6CC'), 0.93);
  const mx0 = w * 0.06, mx1 = w * 0.94, my0 = h * 0.06, my1 = h * 0.92;
  const fondoMueble = rgb('#F1EEE8');
  rect(img, mx0, my0, mx1, my1, fondoMueble, (x, y) => 0.96 + 0.04 * (y / h));
  const madera = rgb('#8C6A4A');
  rect(img, mx0 - 8, my0 - 8, mx0, my1 + 8, madera);
  rect(img, mx1, my0 - 8, mx1 + 8, my1 + 8, madera);
  const alto = (my1 - my0) / 3;
  const huecos = new Set((op.huecos || []).map(([a, b]) => a + ',' + b));
  const todos = [...PALETA.calido, ...PALETA.frio, ...PALETA.neutro];
  for (let fila = 0; fila < 3; fila++) {
    const base = my0 + (fila + 1) * alto;
    rect(img, mx0 - 8, base - 9, mx1 + 8, base, madera, () => 0.9);
    const anchoC = (mx1 - mx0) / cols;
    for (let col = 0; col < cols; col++) {
      if (huecos.has(fila + ',' + col)) continue;
      const c = rgb(todos[Math.floor(r() * todos.length)]);
      const px0 = mx0 + col * anchoC + anchoC * 0.08, px1 = mx0 + (col + 1) * anchoC - anchoC * 0.08;
      const capas = 4 + Math.floor(r() * 3), altoPila = alto * (0.62 + 0.25 * r()), hc = altoPila / capas;
      for (let k = 0; k < capas; k++) {
        const y1 = base - 9 - k * hc, y0 = y1 - hc + 2;
        rect(img, px0 + r() * 3, y0, px1 - r() * 3, y1, c, (x, y) => 0.78 + 0.22 * ((y1 - y) / hc));
      }
    }
  }
  return ensuciar(img, op);
}

/**
 * Un focal: maniquíes y bases de distintas alturas. `alturas` va de 0 a 1
 * (fracción del alto de la imagen que ocupa cada elemento desde el piso).
 * Devuelve también los puntos altos de verdad, para comparar.
 * @param {number[]} alturas de izquierda a derecha
 * @param {{w?:number,h?:number,semilla?:number,ruido?:number,desenfoque?:number,sombra?:number,brillo?:number}} [op]
 */
export function focal(alturas, op = {}) {
  const w = op.w || 640, h = op.h || 480, r = azar(op.semilla || 7);
  const img = cuarto(w, h, rgb('#2A2C33'), 0.84);
  const piso = h * 0.9, n = alturas.length, paso = (w * 0.8) / n;
  const prendas = ['#C8102E', '#F2F0EC', '#1F5FD6', '#E8A33D', '#1C1C1E', '#0F8F8A', '#D9B48A'];
  /** @type {{x:number,y:number}[]} */
  const puntos = [];
  alturas.forEach((a, i) => {
    const cx = w * 0.1 + (i + 0.5) * paso, alto = a * h, top = piso - alto;
    /* Base (si el maniquí va sobre un nivel) y el maniquí. */
    const baseAlto = Math.max(0, alto - h * 0.5);
    if (baseAlto > 0) rect(img, cx - paso * 0.36, piso - baseAlto, cx + paso * 0.36, piso, [236, 233, 228], (x) => 0.85 + 0.15 * ((x - cx) / paso + 0.5));
    const cuerpoTop = top, cuerpoAlto = alto - baseAlto, cabeza = cuerpoAlto * 0.1;
    const piel = [228, 222, 214], ropa = rgb(prendas[(i + Math.floor(r() * 3)) % prendas.length]);
    /* Silueta de maniquí: cabeza redonda, cuello, hombros, cintura y falda o
       pantalón. */
    const rc = Math.min(cabeza * 0.62, paso * 0.11), hombro = Math.min(paso * 0.26, cuerpoAlto * 0.16);
    for (let y = Math.round(cuerpoTop); y < cuerpoTop + cuerpoAlto; y++) {
      const t = (y - cuerpoTop) / cuerpoAlto, dy = y - cuerpoTop;
      let media, c = ropa;
      if (dy < 2 * rc) { media = Math.sqrt(Math.max(0, rc * rc - (dy - rc) ** 2)); c = piel; }
      else if (t < 0.15) { media = rc * 0.42; c = piel; }
      else if (t < 0.2) media = hombro * (0.55 + 0.45 * (t - 0.15) / 0.05);
      else if (t < 0.48) media = hombro * (1 - 0.32 * (t - 0.2) / 0.28);
      else if (t < 0.56) media = hombro * 0.68;
      else media = hombro * (0.68 + 0.3 * (t - 0.56));
      for (let x = Math.round(cx - media); x < cx + media; x++) pix(img, x, y, c, 0.72 + 0.28 * (1 - Math.abs(x - cx) / (media + 1)));
    }
    puntos.push({ x: cx, y: top });
  });
  return { img: ensuciar(img, op), puntos };
}

/* ── Metadatos de muestra (pruebas y demo de origen) ─────────────────────── */

/**
 * Un bloque TIFF/EXIF mínimo con marca, modelo, software y fecha original.
 * @param {{marca?:string,modelo?:string,software?:string,fechaOriginal?:string}} campos
 */
export function exifMuestra(campos) {
  const enc = new TextEncoder();
  /** @type {[number, string][]} */
  const ifd0 = [];
  if (campos.marca) ifd0.push([0x010F, campos.marca]);
  if (campos.modelo) ifd0.push([0x0110, campos.modelo]);
  if (campos.software) ifd0.push([0x0131, campos.software]);
  const conExif = !!campos.fechaOriginal;
  const n0 = ifd0.length + (conExif ? 1 : 0);
  const tam0 = 2 + n0 * 12 + 4;
  const tamSub = conExif ? 2 + 12 + 4 : 0;
  let datos = 8 + tam0 + tamSub;
  /** @type {[number, Uint8Array][]} */
  const partes = [];
  const buf = new Uint8Array(4096), dv = new DataView(buf.buffer);
  buf.set([0x49, 0x49, 0x2A, 0x00]); dv.setUint32(4, 8, true);
  dv.setUint16(8, n0, true);
  let e = 10;
  /** @param {number} tag @param {string} s */
  const ascii = (tag, s) => {
    const b = enc.encode(s + '\0');
    dv.setUint16(e, tag, true); dv.setUint16(e + 2, 2, true); dv.setUint32(e + 4, b.length, true);
    if (b.length <= 4) buf.set(b, e + 8); else { dv.setUint32(e + 8, datos, true); partes.push([datos, b]); datos += b.length; }
    e += 12;
  };
  for (const [t, s] of ifd0) ascii(t, s);
  if (conExif) {
    dv.setUint16(e, 0x8769, true); dv.setUint16(e + 2, 4, true); dv.setUint32(e + 4, 1, true); dv.setUint32(e + 8, 8 + tam0, true); e += 12;
  }
  dv.setUint32(e, 0, true);
  if (conExif) {
    e = 8 + tam0;
    dv.setUint16(e, 1, true); e += 2;
    ascii(0x9003, /** @type {string} */ (campos.fechaOriginal));
    dv.setUint32(e, 0, true);
  }
  for (const [o, b] of partes) buf.set(b, o);
  return buf.slice(0, datos);
}

/** Un paquete XMP con DigitalSourceType (IPTC). @param {string} tipo */
export function xmpMuestra(tipo) {
  return `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:Iptc4xmpExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/" Iptc4xmpExt:DigitalSourceType="http://cv.iptc.org/newscodes/digitalsourcetype/${tipo}"/></rdf:RDF></x:xmpmeta><?xpacket end="w"?>`;
}

/** Una caja JUMBF mínima con la etiqueta c2pa y un tipo de origen adentro. @param {string} tipo */
export function c2paMuestra(tipo) {
  const enc = new TextEncoder();
  const jumd = new Uint8Array([...enc.encode('jumd'), ...new Array(16).fill(0x63), 0x03, ...enc.encode('c2pa\0')]);
  const cbor = enc.encode(`¡digitalSourceTypex@http://cv.iptc.org/newscodes/digitalsourcetype/${tipo}`);
  const cuerpo = new Uint8Array([...lbox(jumd.length + 4), ...jumd, ...lbox(cbor.length + 8), ...enc.encode('cbor'), ...cbor]);
  return new Uint8Array([...lbox(cuerpo.length + 8), ...enc.encode('jumb'), ...cuerpo]);
}

/** @param {number} n */
function lbox(n) { return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]; }

/**
 * Mete segmentos de metadatos en un JPEG justo después de SOI.
 * @param {Uint8Array} jpeg
 * @param {{exif?:Uint8Array, xmp?:string, c2pa?:Uint8Array}} m
 */
export function conMetadatos(jpeg, m) {
  const enc = new TextEncoder();
  /** @type {Uint8Array[]} */
  const segs = [];
  /** @param {number} mk @param {Uint8Array} payload */
  const seg = (mk, payload) => {
    const n = payload.length + 2;
    segs.push(new Uint8Array([0xFF, mk, n >> 8, n & 255, ...payload]));
  };
  if (m.exif) seg(0xE1, new Uint8Array([...enc.encode('Exif\0\0'), ...m.exif]));
  if (m.xmp) seg(0xE1, new Uint8Array([...enc.encode('http://ns.adobe.com/xap/1.0/\0'), ...enc.encode(m.xmp)]));
  if (m.c2pa) seg(0xEB, new Uint8Array([0x4A, 0x50, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, ...m.c2pa]));
  const total = segs.reduce((s, x) => s + x.length, 0);
  const out = new Uint8Array(jpeg.length + total);
  out.set(jpeg.subarray(0, 2));
  let o = 2;
  for (const s of segs) { out.set(s, o); o += s.length; }
  out.set(jpeg.subarray(2), o);
  return out;
}

/** El JPEG válido más chico que se puede armar a mano (1×1, gris), para
 * probar los metadatos sin codificador. */
export const JPEG_MINIMO = Uint8Array.from(atob('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA='), c => c.charCodeAt(0));
