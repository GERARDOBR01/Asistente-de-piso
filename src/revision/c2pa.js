// Asistente de Piso · Copyright (c) 2026 Gerardo Barrera.
// Licencia PolyForm Noncommercial 1.0.0: uso comercial solo con licencia escrita (LICENCIA-COMERCIAL.md).
//
// Lee la credencial de contenido (C2PA) con el SDK oficial de la Content
// Authenticity Initiative: c2pa-web (MIT), el mismo motor de c2pa-rs en WASM.
// Valida la firma y entrega el almacén de manifiestos; quien lo interpreta es
// interpretarC2pa (procedencia.js), que sí tiene pruebas en Node.
//
// Se baja solo cuando una foto trae credencial (~9 MB entre WASM y código) y
// el service worker lo guarda aparte: después funciona sin señal. Las fotos
// reenviadas por WhatsApp no traen credencial, así que casi nunca se baja.

export const VERSION_C2PA = '0.15.3';
const BASE = `https://cdn.jsdelivr.net/npm/@contentauth/c2pa-web@${VERSION_C2PA}`;

/** @type {Promise<{mod:any, c2pa:any}>|null} */
let cargando = null;

export function cargarC2pa() {
  cargando ||= (async () => {
    const mod = await import(/* @vite-ignore */ `${BASE}/+esm`);
    const c2pa = await mod.createC2pa({ wasmSrc: `${BASE}/dist/resources/c2pa_bg.wasm` });
    return { mod, c2pa };
  })().catch(e => { cargando = null; throw e; });
  return cargando;
}

const TIPOS = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic' };

/**
 * El almacén de manifiestos de la foto, o null si no trae credencial legible.
 * @param {Blob} blob @param {'jpeg'|'png'|'webp'|'heic'|'desconocido'} formato
 * @returns {Promise<any|null>}
 */
export async function leerCredencial(blob, formato) {
  const { mod, c2pa } = await cargarC2pa();
  const tipo = /** @type {any} */ (TIPOS)[formato] || blob.type || 'image/jpeg';
  const lector = await mod.Reader.fromBlob(c2pa, tipo, blob);
  if (!lector) return null;
  try { return await lector.manifestStore(); }
  finally { await lector.free(); }
}
