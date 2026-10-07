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

/* Lista de confianza oficial de C2PA (Conformance Program, CC-BY-4.0):
   c2pa-org/conformance-public, trust-list/C2PA-TRUST-LIST.pem, commit
   70ec46e del 13-ago-2026. Copia empaquetada para que valide sin señal; se
   actualiza a mano (trae Google/Pixel, Xiaomi, vivo, Huawei, Adobe…). */
export const CONFIANZA = { archivo: 'src/revision/c2pa-confianza.pem', fecha: '2026-08-13', commit: '70ec46e' };

/** @type {Promise<string>|null} */
let anclas = null;
const anclasOficiales = () => (anclas ||= fetch(new URL('./c2pa-confianza.pem', import.meta.url)).then(r => { if (!r.ok) throw new Error('lista de confianza'); return r.text(); }).catch(e => { anclas = null; throw e; }));

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
 * Verifica la firma contra la lista de confianza de C2PA: un emisor de la
 * lista da `validation_state: 'Trusted'`.
 * @param {Blob} blob @param {'jpeg'|'png'|'webp'|'heic'|'desconocido'} formato
 * @param {{anclas?:string}} [op]  otras anclas PEM (solo para pruebas)
 * @returns {Promise<any|null>}
 */
export async function leerCredencial(blob, formato, op = {}) {
  const { mod, c2pa } = await cargarC2pa();
  const tipo = /** @type {any} */ (TIPOS)[formato] || blob.type || 'image/jpeg';
  /* Sin la lista, se lee igual: la firma se valida y el emisor queda «sin verificar». */
  let contexto;
  try { contexto = new mod.Context({ verify: { verifyTrust: true }, trust: { trustAnchors: op.anclas || await anclasOficiales() } }); }
  catch { contexto = undefined; }
  const lector = await mod.Reader.fromBlob(c2pa, tipo, blob, contexto);
  if (!lector) return null;
  try { return await lector.manifestStore(); }
  finally { await lector.free(); }
}
