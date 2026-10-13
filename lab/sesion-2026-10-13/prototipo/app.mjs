// Prototipo "Asistente de Piso NEO" — une PREGUNTAR (con fuentes y "no sé") y
// REVISAR (veredicto por foto) en una sola pantalla. Idea tomada del análisis
// de YOOBIC/Zebra/Mylow (ver ../analisis/). NO toca la app real: reutiliza el
// motor y la revisión existentes por import de SOLO LECTURA.
//
// Reutilizado tal cual del repo:
//   - Motor de búsqueda + puerta de evidencia:  src/estado.js, src/motor/*
//   - Puerta de calidad de la foto (CÓDIGO):    src/revision/veredicto.js
// El prototipo no reimplementa búsqueda ni veredicto; solo los orquesta y pinta.

import { estado, montar } from '../../../src/estado.js';
import { reconstruirIndice } from '../../../src/motor/indice.js';
import { respuestaSinModelo } from '../../../src/motor/respuesta.js';
import { rutaDeLaPregunta } from '../../../src/motor/conversacion.js';
import { noCalifica, reducir, redondear, CALIDAD } from '../../../src/revision/veredicto.js';
import { MANUALES, EJEMPLOS, RUBRICA } from './datos-demo.mjs';

/* ── Montar el corpus sintético en el motor real ──────────────────────────── */
function construirCorpus() {
  /** @type {any[]} */
  const docChunks = [];
  for (const m of MANUALES)
    for (const c of m.chunks)
      docChunks.push({ id: `${m.name}#${c.page}#${c.heading}`, source: 'pdf', docName: m.name, page: c.page, heading: c.heading, text: c.text });
  const docs = MANUALES.map(m => ({ name: m.name }));
  montar({ docChunks, docs, manualActivo: MANUALES[0].name, docFigures: [], ultimosFragmentos: [] }, reconstruirIndice);
}

/* Igual que lab/motor-node.mjs: la ruta de la pregunta se calcula una vez por turno. */
function rutasDe(hist) {
  const vistas = new Map();
  return q => {
    const k = q + '\u0001' + hist.length;
    if (!vistas.has(k)) vistas.set(k, rutaDeLaPregunta(q, hist, null));
    return vistas.get(k);
  };
}

const hist = [];
let seccionActiva = MANUALES[0].name;

/* ── PREGUNTAR ────────────────────────────────────────────────────────────── */
function preguntar(q) {
  estado.manualActivo = seccionActiva;
  const r = respuestaSinModelo(q, hist, rutasDe(hist));
  hist.push({ role: 'user', content: q });
  hist.push({ role: 'assistant', content: r.fragmentos || '', modo: 'manual', seccion: r.seccionDelTurno });
  return r;
}

const estadoTexto = {
  'respaldada': { etq: 'RESPALDADA', clase: 'ok',   nota: 'La respuesta tiene lámina que la respalda.' },
  'parcial':    { etq: 'PARCIAL',    clase: 'warn', nota: 'Hay algo cercano en tu sección; revísalo.' },
  'aclarar':    { etq: 'ACLARAR',    clase: 'warn', nota: '¿En qué sección lo buscas?' },
  'sin_evidencia': { etq: 'NO SÉ', clase: 'bad', nota: 'No hay evidencia en el manual: no se inventa una respuesta.' },
};

function pintarRespuesta(r) {
  const cont = document.getElementById('respuesta');
  cont.innerHTML = '';
  const est = (r.decision && r.decision.estado) || (r.tipo === 'nada' ? 'sin_evidencia' : 'respaldada');
  const meta = estadoTexto[est] || estadoTexto['respaldada'];

  const badge = document.createElement('div');
  badge.className = `badge ${meta.clase}`;
  badge.innerHTML = `<span class="punto"></span> ${meta.etq}`;
  cont.appendChild(badge);

  const nota = document.createElement('p');
  nota.className = 'nota';
  nota.textContent = meta.nota;
  cont.appendChild(nota);

  // Avisos del motor (palabra ausente, coincidencia floja, por sinónimo)
  for (const a of [r.avisoAusente, r.avisoFlojo, r.avisoParecidas]) {
    if (a) { const p = document.createElement('p'); p.className = 'aviso'; p.textContent = a; cont.appendChild(p); }
  }
  if (r.enOtra) { const p = document.createElement('p'); p.className = 'aviso'; p.textContent = `Quizá esté en la sección «${r.enOtra}».`; cont.appendChild(p); }

  // Tarjetas con la FUENTE citada (página + lámina), como YOOBIC muestra "Sources"
  for (const t of (r.tarjetas || [])) {
    const card = document.createElement('div');
    card.className = 'fuente';
    card.innerHTML = `<div class="fuente-h">${t.c.docName} · pág. ${t.c.page ?? '?'} · ${t.c.heading || ''}</div>
                      <div class="fuente-t"></div>`;
    card.querySelector('.fuente-t').textContent = t.texto;
    cont.appendChild(card);
  }
  if (!(r.tarjetas || []).length && est === 'sin-evidencia') {
    const p = document.createElement('p'); p.className = 'vacio'; p.textContent = 'Sin lámina que respalde la respuesta.'; cont.appendChild(p);
  }
}

/* ── REVISAR (veredicto por foto, puerta de calidad real) ─────────────────── */
function imagenDe(fileOrVideo) {
  const canvas = document.createElement('canvas');
  const w = fileOrVideo.videoWidth || fileOrVideo.naturalWidth || fileOrVideo.width;
  const h = fileOrVideo.videoHeight || fileOrVideo.naturalHeight || fileOrVideo.height;
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(fileOrVideo, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

function revisarImagen(img) {
  const chica = reducir(img, 640);            // mismo preprocesado que la app
  const falla = noCalifica(chica);            // CÓDIGO real de src/revision/veredicto.js
  const cont = document.getElementById('veredicto');
  cont.innerHTML = '';
  let nivel, motivo, ev;
  if (falla) { nivel = 'NO_CALIFICA'; motivo = falla.motivo; ev = falla.evidencia; }
  else { nivel = 'CUMPLE'; motivo = 'La foto tiene luz y foco suficientes para calificar la evidencia.';
         ev = { lado: Math.min(chica.width, chica.height) }; }
  const clase = nivel === 'CUMPLE' ? 'ok' : nivel === 'NO_CALIFICA' ? 'bad' : 'warn';
  cont.innerHTML = `<div class="badge ${clase}"><span class="punto"></span> ${nivel}</div>
    <p class="nota">${motivo}</p>
    <p class="aviso">fuente: CÓDIGO · ${Object.entries(ev).map(([k,v]) => `${k}=${typeof v==='number'?redondear(v):v}`).join(' · ')}</p>`;
}

/* ── Voz a texto (idea de Mylow): Web Speech API, si el navegador la trae ──── */
function montarVoz(btn, input) {
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Rec) { btn.disabled = true; btn.title = 'Este navegador no trae dictado'; return; }
  const rec = new Rec(); rec.lang = 'es-MX'; rec.interimResults = false;
  btn.addEventListener('click', () => { try { rec.start(); btn.classList.add('grabando'); } catch {} });
  rec.addEventListener('result', e => { input.value = e.results[0][0].transcript; btn.classList.remove('grabando'); });
  rec.addEventListener('end', () => btn.classList.remove('grabando'));
  rec.addEventListener('error', () => btn.classList.remove('grabando'));
}

/* ── Arranque de la UI ─────────────────────────────────────────────────────── */
export function iniciar() {
  construirCorpus();

  // Selector de sección (asistente por sección = idea de los agentes especializados)
  const sel = document.getElementById('seccion');
  for (const m of MANUALES) { const o = document.createElement('option'); o.value = m.name; o.textContent = m.name; sel.appendChild(o); }
  sel.value = seccionActiva;
  sel.addEventListener('change', () => { seccionActiva = sel.value; hist.length = 0; });

  const input = document.getElementById('q');
  const enviar = () => { const q = input.value.trim(); if (q) pintarRespuesta(preguntar(q)); };
  document.getElementById('preguntar').addEventListener('click', enviar);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') enviar(); });
  montarVoz(document.getElementById('voz'), input);

  const chips = document.getElementById('ejemplos');
  for (const q of EJEMPLOS) { const b = document.createElement('button'); b.className = 'chip'; b.textContent = q; b.addEventListener('click', () => { input.value = q; enviar(); }); chips.appendChild(b); }

  // Revisar: subir una foto (y cámara en vivo si hay)
  document.getElementById('foto').addEventListener('change', e => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const im = new Image(); im.onload = () => revisarImagen(imagenDe(im)); im.src = URL.createObjectURL(f);
  });
  const rub = document.getElementById('rubrica');
  for (const r of RUBRICA) { const li = document.createElement('li'); li.innerHTML = `<b>${r.nivel}</b> — ${r.texto}`; rub.appendChild(li); }

  // Umbrales reales a la vista (de src/revision/veredicto.js)
  document.getElementById('umbrales').textContent =
    `Puerta de calidad (CÓDIGO): exposición ≥ ${CALIDAD.exposicionMinima} · nitidez ≥ ${CALIDAD.nitidezMinima} · lado ≥ ${CALIDAD.ladoMinimo} px`;
}
