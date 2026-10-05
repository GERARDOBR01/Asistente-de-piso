// Embeddings para el laboratorio: los mismos modelos ONNX que correrían en el
// navegador (transformers.js), aquí en Node, para que los números se
// transfieran a la app.
//
// Los vectores de los fragmentos se guardan en caché junto a los datos (fuera
// del repo): calcular 995 fragmentos con un transformer tarda; leerlos, no.
import fs from 'node:fs';
import path from 'node:path';

/* Cada modelo con lo que pide su tarjeta: e5 quiere «query:» y «passage:», y
   EmbeddingGemma su propio formato de tarea. Sin esos prefijos rinden menos y
   la comparación sería injusta. */
export const MODELOS = {
  e5: {
    id: 'Xenova/multilingual-e5-small', dtype: 'q8', pooling: 'mean',
    pregunta: t => 'query: ' + t, fragmento: t => 'passage: ' + t,
  },
  'e5-base': {
    id: 'Xenova/multilingual-e5-base', dtype: 'q8', pooling: 'mean',
    pregunta: t => 'query: ' + t, fragmento: t => 'passage: ' + t,
  },
  gemma: {
    id: 'onnx-community/embeddinggemma-300m-ONNX', dtype: 'q8', pooling: null,
    pregunta: t => 'task: search result | query: ' + t, fragmento: t => 'title: none | text: ' + t,
  },
  minilm: {
    id: 'Xenova/paraphrase-multilingual-MiniLM-L12-v2', dtype: 'q8', pooling: 'mean',
    pregunta: t => t, fragmento: t => t,
  },
};

/* El texto que se vectoriza de cada fragmento. «contexto» es la versión
   determinista de Contextual Retrieval: de qué sección, qué lámina y qué
   página es, delante del texto. No cuesta ninguna llamada a un modelo. */
export const VARIANTES = {
  crudo: c => [c.h, c.t].filter(Boolean).join('. '),
  contexto: (c, sec) => `${sec || ''} · ${c.h || 'sin título'} · pág. ${c.p}\n${c.t}`,
};

let transformers = null;
async function cargarTransformers() {
  if (!transformers) {
    transformers = await import('@huggingface/transformers');
    transformers.env.allowLocalModels = false;
  }
  return transformers;
}

const cacheDeModelos = new Map();
export async function modelo(nombre) {
  const m = MODELOS[nombre];
  if (!m) throw new Error('Modelo desconocido: ' + nombre + ' (hay: ' + Object.keys(MODELOS).join(', ') + ')');
  if (!cacheDeModelos.has(nombre)) {
    const { pipeline } = await cargarTransformers();
    cacheDeModelos.set(nombre, pipeline('feature-extraction', m.id, { dtype: m.dtype }));
  }
  const extractor = await cacheDeModelos.get(nombre);
  const vectores = async (textos, lote = 16) => {
    const out = [];
    for (let i = 0; i < textos.length; i += lote) {
      const t = await extractor(textos.slice(i, i + lote), { pooling: m.pooling || 'mean', normalize: true });
      const [n, d] = t.dims;
      for (let j = 0; j < n; j++) out.push(Float32Array.from(t.data.subarray(j * d, (j + 1) * d)));
    }
    return out;
  };
  return {
    nombre, id: m.id,
    preguntas: textos => vectores(textos.map(m.pregunta)),
    fragmentos: textos => vectores(textos.map(m.fragmento)),
  };
}

/* Vectores de todos los fragmentos del corpus, con caché en <datos>/emb/. */
export async function vectoresDelCorpus(nombre, variante, corpus, datos, { avisar = true } = {}) {
  const dir = path.join(datos, 'emb');
  fs.mkdirSync(dir, { recursive: true });
  const base = path.join(dir, `${nombre}__${variante}`);
  const secDe = new Map(corpus.docs.map(d => [d.name, d.sec]));
  const ids = corpus.chunks.map(c => c.id);
  if (fs.existsSync(base + '.json') && fs.existsSync(base + '.f32')) {
    const meta = JSON.parse(fs.readFileSync(base + '.json', 'utf8'));
    if (meta.ids.length === ids.length && meta.ids.every((x, i) => x === ids[i])) {
      const buf = fs.readFileSync(base + '.f32');
      const todo = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
      return { dims: meta.dims, porId: new Map(ids.map((id, i) => [id, todo.subarray(i * meta.dims, (i + 1) * meta.dims)])), segundos: meta.segundos };
    }
  }
  const m = await modelo(nombre);
  const f = VARIANTES[variante];
  if (!f) throw new Error('Variante desconocida: ' + variante);
  const t0 = Date.now();
  if (avisar) process.stderr.write(`vectorizando ${ids.length} fragmentos con ${m.id} (${variante})… `);
  const vs = await m.fragmentos(corpus.chunks.map(c => f(c, secDe.get(c.d))));
  const segundos = (Date.now() - t0) / 1000;
  if (avisar) process.stderr.write(`${segundos.toFixed(0)} s\n`);
  const dims = vs[0].length;
  const todo = new Float32Array(vs.length * dims);
  vs.forEach((v, i) => todo.set(v, i * dims));
  fs.writeFileSync(base + '.f32', Buffer.from(todo.buffer));
  fs.writeFileSync(base + '.json', JSON.stringify({ modelo: m.id, variante, dims, segundos, ids }));
  return { dims, porId: new Map(ids.map((id, i) => [id, todo.subarray(i * dims, (i + 1) * dims)])), segundos };
}

/* Vectores de preguntas, también con caché (la batería no cambia entre corridas). */
export async function vectoresDePreguntas(nombre, textos, datos) {
  const dir = path.join(datos, 'emb');
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, `${nombre}__preguntas.json`);
  const cache = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
  const faltan = [...new Set(textos.filter(t => !cache[t]))];
  if (faltan.length) {
    const m = await modelo(nombre);
    const vs = await m.preguntas(faltan);
    faltan.forEach((t, i) => { cache[t] = Array.from(vs[i]); });
    fs.writeFileSync(f, JSON.stringify(cache));
  }
  return new Map(textos.map(t => [t, Float32Array.from(cache[t])]));
}

export function coseno(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;   // los vectores ya vienen normalizados
}
