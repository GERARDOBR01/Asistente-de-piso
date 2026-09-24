// Mide el modo IA (con API key) dentro de la app real: cuánto acierta, si dice
// «no está» cuando no está, si cita algo sin respaldo y cuánto tarda.
//
// Uso:
//   node eval/modo-ia.mjs --modelo gemini-3.5-flash --etiqueta base
//   node eval/modo-ia.mjs --resumen                 (solo compara lo ya medido)
//
// Opciones:
//   --preguntas <json>   por defecto eval/preguntas-demo.json (manual sintético)
//   --salida <dir>       por defecto eval/resultados (fuera de git)
//   --vivo <url>         en vez de abrir su propio navegador con el manual demo,
//                        pregunta a una página ya abierta con otros manuales que
//                        acepte JS por POST (el arnés de manuales reales).
//   --pausa <s>          espera entre preguntas, por el límite por minuto del
//                        plan gratis (por defecto 7)
//
// La key se lee de GEMINI_API_KEY o de ~/.config/asistente/gemini.key. No se
// imprime ni se escribe en ningún archivo. Requiere playwright-core y Chromium:
// PLAYWRIGHT_CORE=<ruta a playwright-core/index.mjs> y CHROMIUM=<binario>.
//
// Cada respuesta se guarda al momento en <salida>/<etiqueta>__<modelo>.jsonl.
// Si el plan gratis corta por el día, se vuelve a correr lo mismo y sigue
// donde se quedó.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const MODELO = arg('modelo', 'gemini-3.5-flash');
const ETIQUETA = arg('etiqueta', 'base');
const PREGUNTAS = arg('preguntas', path.join(RAIZ, 'eval/preguntas-demo.json'));
const SALIDA = arg('salida', path.join(RAIZ, 'eval/resultados'));
const VIVO = arg('vivo', null);
const PAUSA = Number(arg('pausa', 7)) * 1000;

/* ── Calificación ─────────────────────────────────────────────────────────── */
const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/(\d)\s*[x×]\s*(\d)/g, '$1 x $2').replace(/(\d)\s*(cm|m)\b/g, '$1 $2').replace(/\s+/g, ' ');
/* Una alternativa cuenta si aparece tal cual o, si el modelo la dijo con sus
   palabras, si están todos sus números y al menos la mitad de sus palabras
   de cuatro letras o más (por las primeras cinco letras: «paralelas»/«paralelo»). */
function tieneAlternativa(resp, alt) {
  const r = norm(resp), a = norm(alt);
  if (r.includes(a)) return true;
  const nums = a.match(/\d+(?:[.,]\d+)?/g) || [];
  if (!nums.every(n => new RegExp('(?<![\\d.,])' + n.replace(/[.,]/, '[.,]') + '(?![\\d])').test(r))) return false;
  const pal = a.split(/[^a-zñ]+/).filter(w => w.length >= 4);
  if (!pal.length) return nums.length > 0;
  return pal.filter(w => r.includes(w.slice(0, 5))).length >= Math.ceil(pal.length / 2);
}
const SIN_DATO = /no\s+(?:lo\s+)?especifica|no\s+(?:lo\s+)?encontr|no\s+(?:est[áa]|aparece|figura|viene)\s+en\s+(?:el|los|tu|este|esta)\s+(?:manual|secci[óo]n)|no\s+hay\s+(?:regla|dato|informaci[óo]n)|no\s+(?:lo\s+)?(?:dice|menciona|indica)|solo puedo ayudarte/i;
/* «pág. 14, 20» y «págs. 2 y 16» citan las dos páginas, no solo la primera. */
const paginasCitadas = t => [...(t || '').matchAll(/p[áa]g(?:ina)?s?\.?\s*(\d+(?:\s*(?:,|y|-|–)\s*\d+)*)/gi)]
  .flatMap(m => m[1].match(/\d+/g).map(Number));

function calificar(p, r) {
  const texto = r.cuerpo || '';
  const dijoNoEsta = /no está en el manual/i.test(r.etiqueta || '') || SIN_DATO.test(texto);
  const base = { dijoNoEsta, sinRespaldo: !!(r.aviso || '').trim(), error: r.error };
  if (p.tipo !== 'dato') return { ...base, ok: !r.error && dijoNoEsta };
  const hallados = (p.k || []).filter(k => tieneAlternativa(texto, k)).length;
  const dato = hallados >= (p.minK || 1);
  const esperadas = p.p || r.paginas || [];
  const citadas = paginasCitadas(texto);
  const pagina = !esperadas.length || citadas.some(n => esperadas.includes(n));
  return { ...base, dato, pagina, ok: !r.error && dato && pagina && !dijoNoEsta };
}

/* ── Lo que corre dentro de la página ─────────────────────────────────────── */
/* Una pregunta en modo IA, igual que la haría el asesor, y lo que vio en
   pantalla. `tPrimer` es cuándo apareció el primer texto de la respuesta:
   con las seis etapas, lo que se escribe antes de [RESPUESTA FINAL] no se ve. */
const MEDIR = async ({ q, h, m, clave, modelo }) => {
  /* El Chromium de Termux se reporta sin señal, y sin señal la app contesta en
     modo manual. */
  if (!navigator.onLine) Object.defineProperty(navigator, 'onLine', { get: () => true, configurable: true });
  sessionStorage.setItem('ap_api_key_gemini', clave);
  appState.provider = 'gemini'; appState.chatModel = modelo;
  /* `m` es el principio del nombre del manual que queda como sección activa;
     "" pregunta en todos a la vez; sin `m`, se queda como está. */
  if (m === '') cambiarSeccion('');
  else if (m) {
    const d = docs.find(d => d.name.normalize('NFC').startsWith(m.normalize('NFC')));
    if (!d) return { falta: true };
    cambiarSeccion(d.name);
  }
  history = []; clearChat();
  const n = t => (t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const paginas = h ? [...new Set(docChunks.filter(c => n(c.heading).includes(n(h))).map(c => c.page))] : null;
  const box = document.getElementById('chat-messages');
  document.getElementById('user-input').value = q;
  const t0 = performance.now(); let tPrimer = null;
  const iv = setInterval(() => {
    const el = [...box.querySelectorAll('.msg.assistant')].pop();
    if (tPrimer === null && el && !el.classList.contains('loading') && (el.querySelector('.msg-body')?.textContent || '').trim())
      tPrimer = performance.now() - t0;
  }, 50);
  try { await sendMessage(); } finally { clearInterval(iv); }
  const tTotal = performance.now() - t0;
  /* Si todo llegó de un golpe, el primer texto salió al final. */
  if (tPrimer === null) tPrimer = tTotal;
  const el = [...box.querySelectorAll('.msg.assistant')].pop();
  return {
    paginas, tPrimer, tTotal,
    cuerpo: el?.querySelector('.msg-body')?.innerText || '',
    etiqueta: el?.querySelector('.msg-label')?.innerText || '',
    aviso: el?.querySelector('.verify-warn')?.innerText || '',
    contesto: el?.querySelector('.msg-modelo')?.textContent || '',
    error: !!el?.querySelector('.err-detail'),
  };
};

/* ── Resumen ──────────────────────────────────────────────────────────────── */
const pct = (xs, q) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const seg = ms => ms == null ? '—' : (ms / 1000).toFixed(1) + ' s';
function resumir(filas) {
  const datos = filas.filter(f => f.tipo === 'dato'), huecos = filas.filter(f => f.tipo !== 'dato');
  const sinError = filas.filter(f => !f.error);
  const primer = sinError.map(f => f.tPrimer).filter(x => x != null), total = sinError.map(f => f.tTotal);
  return {
    preguntas: filas.length,
    aciertos: `${datos.filter(f => f.ok).length}/${datos.length}`,
    datoCorrecto: `${datos.filter(f => f.dato).length}/${datos.length}`,
    paginaCorrecta: `${datos.filter(f => f.pagina).length}/${datos.length}`,
    noEstaBienDicho: `${huecos.filter(f => f.ok).length}/${huecos.length}`,
    avisosSinRespaldo: filas.filter(f => f.sinRespaldo).length,
    errores: filas.filter(f => f.error).length,
    respaldo: filas.filter(f => /respaldo/.test(f.contesto || '')).length,
    primerTextoP50: seg(pct(primer, 0.5)), primerTextoP95: seg(pct(primer, 0.95)),
    totalP50: seg(pct(total, 0.5)), totalP95: seg(pct(total, 0.95)),
  };
}
const leer = f => fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];

if (process.argv.includes('--resumen')) {
  const tabla = {};
  for (const f of fs.readdirSync(SALIDA).filter(f => f.endsWith('.jsonl')).sort())
    /* Se vuelve a calificar con lo guardado: si el calificador cambia, los
       números se rehacen sin volver a preguntar. */
    tabla[f.replace('.jsonl', '')] = resumir(leer(path.join(SALIDA, f)).map(x => ({ ...x, ...calificar(x, x) })));
  console.table(tabla);
  process.exit(0);
}

/* ── Corrida ──────────────────────────────────────────────────────────────── */
const archivoClave = path.join(os.homedir(), '.config/asistente/gemini.key');
const CLAVE = (process.env.GEMINI_API_KEY || (fs.existsSync(archivoClave) ? fs.readFileSync(archivoClave, 'utf8') : '')).trim();
if (CLAVE.length < 10) { console.error('Falta la key: GEMINI_API_KEY o ' + archivoClave); process.exit(1); }

const preguntas = JSON.parse(fs.readFileSync(PREGUNTAS, 'utf8'));
fs.mkdirSync(SALIDA, { recursive: true });
const destino = path.join(SALIDA, `${ETIQUETA}__${MODELO}.jsonl`);
/* Lo que cortó la cuota del día no es un resultado: se vuelve a preguntar. */
const CUOTA = /quota|per day|resource.?exhausted/i;
const hechas = leer(destino).filter(f => !(f.error && CUOTA.test(f.cuerpo)));
fs.writeFileSync(destino, hechas.map(f => JSON.stringify(f)).join('\n') + (hechas.length ? '\n' : ''));
const yaHecha = new Set(hechas.map(f => (f.m ?? '') + '|' + f.q));

let preguntar, cerrar = async () => {};
if (VIVO) {
  const post = body => new Promise((ok, mal) => {
    const req = http.request(VIVO, { method: 'POST' }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => ok(d)); });
    req.on('error', mal); req.setTimeout(300000); req.end(body);
  });
  preguntar = async a => {
    const r = await post(`return await (${MEDIR.toString()})(${JSON.stringify(a)})`);
    if (r.startsWith('ERROR')) throw new Error(r);
    return JSON.parse(r);
  };
} else {
  const { chromium } = await import(process.env.PLAYWRIGHT_CORE || 'playwright-core');
  const port = 9500 + Math.floor(Math.random() * 100);
  const srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: RAIZ, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 1000));
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/usr/bin/chromium', args: ['--no-sandbox', '--disable-gpu'] });
  cerrar = async () => { await b.close(); srv.kill(); };
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  p.on('dialog', d => d.accept());
  await p.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.pdfjsLib, null, { timeout: 60000 });
  await p.setInputFiles('#file-input', { name: '140 CASUAL HOMBRE.pdf', mimeType: 'application/pdf', buffer: fs.readFileSync(path.join(RAIZ, 'docs/manual-demo.pdf')) });
  await p.waitForFunction(() => docs.length === 1 && document.getElementById('proc-wrap').style.display === 'none', null, { timeout: 120000 });
  preguntar = a => p.evaluate(MEDIR, a);
}

try {
  const pendientes = preguntas.filter(x => !yaHecha.has((x.m ?? '') + '|' + x.q));
  console.log(`${MODELO} · ${ETIQUETA}: ${pendientes.length} por preguntar (${hechas.length} ya medidas)`);
  for (const [i, x] of pendientes.entries()) {
    const r = await preguntar({ q: x.q, h: x.h || null, m: x.m ?? null, clave: CLAVE, modelo: MODELO });
    if (r.falta) { console.log('  sin manual:', x.m); continue; }
    const fila = { ...x, ...r, ...calificar(x, r), modeloPedido: MODELO, etiqueta: ETIQUETA, fecha: new Date().toISOString() };
    fs.appendFileSync(destino, JSON.stringify(fila) + '\n');
    console.log(`${String(i + 1).padStart(3)} ${fila.ok ? '✓' : '✗'} ${x.q.slice(0, 44).padEnd(44)} ${seg(r.tPrimer).padStart(7)} ${r.contesto || ''}${r.error ? ' ERROR' : ''}`);
    if (r.error && CUOTA.test(r.cuerpo)) { console.log('Se acabó la cuota del día; vuelve a correr lo mismo mañana y sigue desde aquí.'); break; }
    await new Promise(ok => setTimeout(ok, PAUSA));
  }
} finally { await cerrar(); }
console.table({ [`${ETIQUETA}__${MODELO}`]: resumir(leer(destino)) });
