/* Búsqueda por significado: el modelo de embeddings corre aquí, fuera del hilo
   de la pantalla, para que vectorizar un manual no congele la app.

   - Se descarga una sola vez (transformers.js lo guarda en Cache Storage, y el
     service worker guarda la librería y el motor WASM). Después funciona sin
     señal.
   - Nada sale del teléfono: el texto del manual y la pregunta se convierten en
     vectores aquí mismo. La única red es la descarga del modelo.
   - Los prefijos «query: » / «passage: » los pone la página, que es la que
     sabe con qué se calibró (lab/calibracion.json). */
const LIBRERIA = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.0/dist/transformers.min.js';

let extractor = null;
let cargando = null;

async function cargar(modelo, dtype) {
  if (extractor) return;
  if (!cargando) {
    cargando = (async () => {
      const t = await import(LIBRERIA);
      t.env.allowLocalModels = false;
      t.env.useBrowserCache = true;
      const progreso = p => {
        if (p && p.status === 'progress' && p.total) postMessage({ tipo: 'progreso', archivo: p.file, cargado: p.loaded, total: p.total });
      };
      /* WebGPU si el teléfono lo tiene; si no (o si falla al compilar), WASM. */
      try {
        if (self.navigator && navigator.gpu) {
          extractor = await t.pipeline('feature-extraction', modelo, { dtype, device: 'webgpu', progress_callback: progreso });
          return;
        }
      } catch (e) { postMessage({ tipo: 'aviso', texto: 'WebGPU no disponible: ' + (e && e.message) }); }
      extractor = await t.pipeline('feature-extraction', modelo, { dtype, progress_callback: progreso });
    })();
  }
  try { await cargando; } catch (e) { cargando = null; throw e; }
}

async function vectores(textos, lote = 8) {
  const out = [];
  for (let i = 0; i < textos.length; i += lote) {
    const t = await extractor(textos.slice(i, i + lote), { pooling: 'mean', normalize: true });
    const [n, d] = t.dims;
    const datos = t.data instanceof Float32Array ? t.data : Float32Array.from(t.data);
    for (let j = 0; j < n; j++) out.push(datos.slice(j * d, (j + 1) * d));
    if (textos.length > lote) postMessage({ tipo: 'avance', hechos: Math.min(i + lote, textos.length), total: textos.length });
  }
  return out;
}

self.onmessage = async e => {
  const { id, tipo, modelo, dtype, textos } = e.data || {};
  try {
    if (tipo === 'cargar') {
      await cargar(modelo, dtype);
      postMessage({ id, ok: true });
    } else if (tipo === 'vectores') {
      if (!extractor) throw new Error('modelo sin cargar');
      const vs = await vectores(textos);
      const dims = vs.length ? vs[0].length : 0;
      const plano = new Float32Array(vs.length * dims);
      vs.forEach((v, i) => plano.set(v, i * dims));
      postMessage({ id, ok: true, dims, datos: plano }, [plano.buffer]);
    }
  } catch (err) {
    postMessage({ id, ok: false, error: String(err && err.message || err) });
  }
};
