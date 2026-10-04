// Mide el modo IA (con API key) dentro de la app real: cuánto acierta, si dice
// «no está» cuando no está, si cita algo sin respaldo y cuánto tarda.
//
// Uso:
//   node eval/modo-ia.mjs --modo rapido --etiqueta rapido   (modelo de fábrica: 3.5 Flash-Lite)
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
//   --modo <modo>        razonado (el predeterminado) o rapido: el modo de
//                        respuesta de la app, como lo elige el asesor en Ajustes;
//                        manual mide las tarjetas que enseña sin key (no gasta API)
//   --variante <nombre>  mide una variante del prompt de sistema (ver VARIANTES)
//                        sin tocar la app; va con su propia --etiqueta
//   --clave-en-pagina    con --vivo: la key ya está pegada en Ajustes de esa
//                        página y el script no la lee ni la manda
//   --motor <nombre>     clasico (el de siempre) o agente (el lector con
//                        herramientas). Con agente, antes de preguntar se
//                        prepara la ficha del manual con IA; va con su --etiqueta
//
// La key se lee de GEMINI_API_KEY o de ~/.config/asistente/gemini.key. No se
// imprime ni se escribe en ningún archivo. Requiere playwright-core y Chromium:
// PLAYWRIGHT_CORE=<ruta a playwright-core/index.mjs> y CHROMIUM=<binario>.
// El servidor local es `python3 -m http.server`; en Windows, PYTHON=python.
//
// Cada respuesta se guarda al momento en <salida>/<etiqueta>__<modelo>.jsonl.
// Si el plan gratis corta por el día, se vuelve a correr lo mismo y sigue
// donde se quedó.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const MODELO = arg('modelo', 'gemini-3.5-flash-lite');
const ETIQUETA = arg('etiqueta', 'base');
const PREGUNTAS = arg('preguntas', path.join(RAIZ, 'eval/preguntas-demo.json'));
const SALIDA = arg('salida', path.join(RAIZ, 'eval/resultados'));
const VIVO = arg('vivo', null);
const MOTOR = arg('motor', null);
if (MOTOR && !['clasico', 'agente'].includes(MOTOR)) { console.error('Motor desconocido: ' + MOTOR); process.exit(1); }
const PAUSA = Number(arg('pausa', 7)) * 1000;

/* Variantes del prompt de sistema que se miden antes de tocar la app: dentro
   de la página se cambia el bloque que va de `de` hasta `hasta` (sin incluirlo)
   por `por`, sobre el prompt real que trae el index.html de esta rama. */
const VARIANTES = {
  /* Sucesora del #26: la respuesta directa sin razonamiento sacó 51/60 contra
     55. Aquí queda un solo paso de lectura, que obliga a ubicar el dato antes
     de contestar, en vez de las seis etapas. */
  'lectura-corta': {
    de: 'ALGORITMO OBLIGATORIO',
    hasta: '[RESPUESTA FINAL AL ASESOR]',
    por: `FORMATO OBLIGATORIO — cada respuesta usa este formato:

[PENSAMIENTO INTERNO]
LECTURA: una sola línea con la página y el rótulo del fragmento que trae el dato ("pág. N · RÓTULO"), o "no está" si después de revisar TODO el contexto no aparece. El asesor pregunta como habla en piso: "alarma" es sensor, "espacio para que pase la gente" es pasillo, "entayado" es entallado.

`,
  },
};
/* La primera dio una respuesta que se contradice: «El manual no especifica si
   el sensor puede ir al frente…, ya que… nunca atraviesa la tela del frente
   (pág. 6)». Si la LECTURA encontró una regla que contesta, esa regla es la
   respuesta. Sin medir todavía. */
VARIANTES['lectura-corta-2'] = {
  ...VARIANTES['lectura-corta'],
  por: VARIANTES['lectura-corta'].por.replace(/\n\n$/, `
Si la LECTURA encontró una regla que contesta la pregunta, aunque sea en negativo ("nunca", "no va"), la respuesta es esa regla con su página. "El manual no especifica" es solo para cuando la LECTURA dice "no está".

`),
};
const VARIANTE = arg('variante', null);
const MODO = arg('modo', 'razonado');
if (VARIANTE && !VARIANTES[VARIANTE]) { console.error('Variante desconocida: ' + VARIANTE); process.exit(1); }

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
const SIN_DATO = /no\s+(?:lo\s+)?especifica|no\s+(?:lo\s+)?encontr|no\s+(?:est[áa]|aparece|figura|viene)\s+en\s+(?:el|los|tu|este|esta)\s+(?:manual|secci[óo]n)|no\s+hay\s+(?:una\s+|ning[úu]n[ao]?\s+)?(?:regla|dato|informaci[óo]n)|no\s+trae\s+(?:ese|esa|este|esta|el|la|ning[úu]n[ao]?|nada)|no\s+tengo\s+(?:esa|ese|la|el|ning[úu]n[ao]?)\s+(?:informaci[óo]n|dato)|no\s+(?:lo\s+)?(?:dice|menciona|indica)|solo puedo ayudarte/i;
/* «pág. 14, 20» y «págs. 2 y 16» citan las dos páginas, no solo la primera. */
const paginasCitadas = t => [...(t || '').matchAll(/p[áa]g(?:ina)?s?\.?\s*(\d+(?:\s*(?:,|y|-|–)\s*\d+)*)/gi)]
  .flatMap(m => m[1].match(/\d+/g).map(Number));

/* Con varios manuales cargados, `m` (o `d` cuando se pregunta en todos a la
   vez) dice de qué manual tiene que salir el dato: la misma cifra en otro
   manual no cuenta. */
const delManual = (p, c) => { const d = p.m || p.d; return !d || (c.d || '').normalize('NFC').startsWith(d.normalize('NFC')); };
const hallados = (p, texto) => (p.k || []).filter(k => tieneAlternativa(texto, k)).length;

/* Modo manual: no hay redacción que calificar, solo qué tarjetas enseñó. El
   dato «sale» en una tarjeta si es del manual correcto, de la página esperada y
   trae las palabras clave. */
function calificarManual(p, r) {
  const tarjetas = r.tarjetas || [];
  const buena = c => delManual(p, c) && (!p.p || p.p.includes(c.p));
  const dijoNoEsta = !!r.sinDato || !!r.ausente;
  const base = { dijoNoEsta, conAviso: !!r.ausente, conNota: !!r.parecidas, sinTarjetas: !tarjetas.length };
  if (p.tipo !== 'dato') return { ...base, ok: dijoNoEsta, fallo: dijoNoEsta ? null : 'enseña tarjeta' };
  const min = p.minK || 1;
  const top1 = !!tarjetas[0] && buena(tarjetas[0]) && hallados(p, tarjetas[0].h + ' ' + tarjetas[0].t) >= min;
  const top3 = hallados(p, tarjetas.filter(buena).map(c => c.h + ' ' + c.t).join(' ')) >= min;
  const ok = top3 && !r.ausente;
  const fallo = ok ? null : !tarjetas.length ? 'sin tarjetas' : top3 ? 'aviso falso' : tarjetas.some(buena) ? 'página sin el dato' : 'otra página';
  /* Lo que habría recibido el modelo con key (medido sin gastar API). */
  const enContexto = r.ctx ? hallados(p, r.ctx.filter(buena).map(c => c.h + ' ' + c.t).join(' ')) >= min : null;
  return { ...base, top1, top3, ok, fallo, enContexto };
}

function calificar(p, r) {
  if (r.manual) return calificarManual(p, r);
  const texto = r.cuerpo || '';
  const dijoNoEsta = /no está en el manual/i.test(r.etiqueta || '') || SIN_DATO.test(texto);
  const base = { dijoNoEsta, sinRespaldo: !!(r.aviso || '').trim(), error: r.error };
  if (p.tipo !== 'dato') {
    const ok = !r.error && dijoNoEsta;
    return { ...base, ok, fallo: ok ? null : r.error ? 'error' : 'inventa' };
  }
  const dato = hallados(p, texto) >= (p.minK || 1);
  const esperadas = p.p || r.paginas || [];
  const citadas = paginasCitadas(texto);
  const pagina = !esperadas.length || citadas.some(n => esperadas.includes(n));
  /* ¿Le llegó el dato al modelo? Si no, el fallo es de la búsqueda y ningún
     cambio al prompt lo arregla. `ctx` falta en lo medido antes de esto. */
  const ctx = r.ctx || null;
  const enContexto = ctx ? hallados(p, ctx.filter(c => delManual(p, c) && (!p.p || p.p.includes(c.p))).map(c => c.h + ' ' + c.t).join(' ')) >= (p.minK || 1) : null;
  /* «La Prioridad 2 no especifica un artículo» a media respuesta no es negar
     el dato que ya dio: con el dato, solo cuenta si abre la respuesta. */
  const negoAlAbrir = /no está en el manual/i.test(r.etiqueta || '') || SIN_DATO.test(texto.split(/(?<=[.!?])\s/)[0]);
  const nego = dato ? negoAlAbrir : dijoNoEsta;
  const ok = !r.error && dato && pagina && !nego;
  const fallo = ok ? null : r.error ? 'error' : enContexto === false ? 'búsqueda' : !dato || nego ? 'modelo' : 'página';
  return { ...base, dato, pagina, enContexto, ok, fallo };
}

/* ── Lo que corre dentro de la página ─────────────────────────────────────── */
/* Una pregunta en modo IA, igual que la haría el asesor, y lo que vio en
   pantalla. `tPrimer` es cuándo apareció el primer texto de la respuesta:
   con las seis etapas, lo que se escribe antes de [RESPUESTA FINAL] no se ve. */
const MEDIR = async ({ q, turnos, h, m, clave, modelo, variante, modo, motor }) => {
  /* El Chromium de Termux se reporta sin señal, y sin señal la app contesta en
     modo manual. */
  if (!navigator.onLine) Object.defineProperty(navigator, 'onLine', { get: () => true, configurable: true });
  /* Como la medición de la app: ni tablero ni aprendizaje. Sin esto cada
     corrida le enseñaba palabras a la siguiente y el número dejaba de ser de
     la app. La pestaña queda en modo medición. */
  if (typeof midiendo !== 'undefined') midiendo = true;
  const manual = modo === 'manual';
  if (!manual) {
    if (clave) sessionStorage.setItem('ap_api_key_gemini', clave);
    appState.provider = 'gemini'; appState.chatModel = modelo;
    if (motor) appState.motor = motor;
    appState.modoRespuesta = modo || 'razonado';
    /* Cada pregunta parte del prompt de la app: en la misma página, una
       variante medida antes se quedaba puesta para la siguiente corrida. */
    appState.system = document.getElementById('system-prompt').value;
    if (variante) {
      const s = appState.system;
      const i = s.indexOf(variante.de), j = s.indexOf(variante.hasta);
      if (i < 0 || j < i) throw new Error('la variante no encuentra su bloque en el prompt');
      appState.system = s.slice(0, i) + variante.por + s.slice(j);
    }
  }
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
  const input = document.getElementById('user-input');
  /* Una conversación: los turnos previos (`turnos`) se preguntan igual que el
     último (`q`), pero solo se califica el último. «¿y en el clásico?» no
     significa nada sin la pregunta de antes. En modo manual van por
     responderSinModelo: con una key en la pestaña, sendMessage gastaría API. */
  const lista = [...(turnos || []), q];
  const preguntar = async t => {
    if (manual) { responderSinModelo(t); return; }
    input.value = t; await sendMessage();
  };
  for (const t of lista.slice(0, -1)) await preguntar(t);
  const ultima = lista[lista.length - 1];
  const ultimoMsg = () => [...box.querySelectorAll('.msg.assistant')].pop();
  if (manual) {
    /* De paso, lo que recibiría el modelo con key: buildContext no llama a la
       API, así que la columna «dato en el contexto» del modo IA también se mide
       gratis. Va antes de contestar, que mete la pregunta en el historial. */
    const prov = appState.provider; appState.provider = 'gemini';
    let ctx = null;
    try { buildContext(ultima); ctx = ultimosFragmentos.map(c => ({ d: c.docName, p: c.page, h: c.heading || '', t: c.text || '' })); }
    finally { appState.provider = prov; }
    /* Lo mismo que calcula responderSinModelo antes de pintar. */
    const t0 = performance.now();
    const rel = seccionesPorRelevancia(ultima).slice(0, FALLBACK_MAX_SECCIONES);
    if (typeof ultimasTarjetas !== 'undefined') ultimasTarjetas = [];
    responderSinModelo(ultima);
    const tTotal = performance.now() - t0;
    const el = ultimoMsg();
    const fa = el?.querySelector('.frag-ausente');
    /* Las tarjetas tal como se enseñaron (recortadas y unidas por lámina); con
       una app anterior a `ultimasTarjetas`, lo que puntuó la búsqueda. */
    const vistas = typeof ultimasTarjetas !== 'undefined' && ultimasTarjetas.length
      ? ultimasTarjetas.map(t => ({ d: t.c.docName, p: t.c.page, h: t.c.heading || '', t: t.texto || '' }))
      : rel.map(r => ({ d: r.c.docName, p: r.c.page, h: r.c.heading || '', t: r.c.text || '' }));
    return {
      manual: true, paginas, tTotal, tPrimer: tTotal, ctx,
      tarjetas: vistas,
      sinDato: !!el?.classList.contains('sin-dato'),
      ausente: fa && !fa.classList.contains('frag-parecidas') ? fa.innerText : '',
      parecidas: fa && fa.classList.contains('frag-parecidas') ? fa.innerText : '',
      cuerpo: (el?.querySelector('.msg-body')?.innerText || '').slice(0, 600),
    };
  }
  input.value = ultima;
  const t0 = performance.now(); let tPrimer = null;
  const iv = setInterval(() => {
    const el = ultimoMsg();
    if (tPrimer === null && el && !el.classList.contains('loading') && (el.querySelector('.msg-body')?.textContent || '').trim())
      tPrimer = performance.now() - t0;
  }, 50);
  try { await sendMessage(); } finally { clearInterval(iv); }
  const tTotal = performance.now() - t0;
  /* Si todo llegó de un golpe, el primer texto salió al final. */
  if (tPrimer === null) tPrimer = tTotal;
  const el = ultimoMsg();
  return {
    paginas, tPrimer, tTotal,
    cuerpo: el?.querySelector('.msg-body')?.innerText || '',
    etiqueta: el?.querySelector('.msg-label')?.innerText || '',
    aviso: el?.querySelector('.verify-warn')?.innerText || '',
    contesto: el?.querySelector('.msg-modelo')?.textContent || '',
    error: !!el?.querySelector('.err-detail'),
    /* Lo que hizo el agente en la última pregunta (null con el motor clásico). */
    agente: typeof ultimaTrazaAgente !== 'undefined' ? ultimaTrazaAgente : null,
    /* Lo que de verdad recibió el modelo, para separar fallos de búsqueda de
       fallos del modelo. */
    ctx: (ultimosFragmentos || []).map(c => ({ d: c.docName, p: c.page, h: c.heading || '', t: c.text || '' })),
  };
};
/* Con el motor agente, la ficha del manual se prepara una vez antes de
   preguntar: es lo que el asesor tendría después de cargar su PDF con key. */
const PREPARAR = async ({ clave }) => {
  if (!navigator.onLine) Object.defineProperty(navigator, 'onLine', { get: () => true, configurable: true });
  if (clave) sessionStorage.setItem('ap_api_key_gemini', clave);
  appState.provider = 'gemini'; appState.apiKey = sessionStorage.getItem('ap_api_key_gemini') || '';
  const r = [];
  for (const d of docs) r.push({ doc: d.name, ...(await prepararFicha(d.name, { silencioso: true })) });
  return r;
};

/* ── Resumen ──────────────────────────────────────────────────────────────── */
const pct = (xs, q) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const seg = ms => ms == null ? '—' : (ms / 1000).toFixed(1) + ' s';
const cuenta = (xs, f) => `${xs.filter(f).length}/${xs.length}`;
function resumir(filas) {
  const datos = filas.filter(f => f.tipo === 'dato'), huecos = filas.filter(f => f.tipo !== 'dato');
  const sinError = filas.filter(f => !f.error);
  const primer = sinError.map(f => f.tPrimer).filter(x => x != null), total = sinError.map(f => f.tTotal);
  const fallos = {};
  for (const f of filas) if (f.fallo) fallos[f.fallo] = (fallos[f.fallo] || 0) + 1;
  const tipos = Object.entries(fallos).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ');
  if (filas[0]?.manual) return {
    preguntas: filas.length,
    aciertos: cuenta(datos, f => f.ok),
    top1: cuenta(datos, f => f.top1),
    top3: cuenta(datos, f => f.top3),
    datoEnContexto: datos.some(f => f.enContexto != null) ? cuenta(datos, f => f.enContexto) : '—',
    noEstaBienDicho: cuenta(huecos, f => f.ok),
    avisosEnBuenas: datos.filter(f => f.conAviso).length,
    notasEnBuenas: datos.filter(f => f.conNota).length,
    fallos: tipos,
    totalP50: seg(pct(total, 0.5)),
  };
  return {
    preguntas: filas.length,
    aciertos: cuenta(datos, f => f.ok),
    datoCorrecto: cuenta(datos, f => f.dato),
    paginaCorrecta: cuenta(datos, f => f.pagina),
    datoEnContexto: datos.some(f => f.enContexto != null) ? cuenta(datos, f => f.enContexto) : '—',
    noEstaBienDicho: cuenta(huecos, f => f.ok),
    avisosSinRespaldo: filas.filter(f => f.sinRespaldo).length,
    errores: filas.filter(f => f.error).length,
    respaldo: filas.filter(f => /respaldo/.test(f.contesto || '')).length,
    fallos: tipos,
    primerTextoP50: seg(pct(primer, 0.5)), primerTextoP95: seg(pct(primer, 0.95)),
    ...(() => {
      const ag = sinError.map(f => f.agente).filter(Boolean);
      if (!ag.length) return {};
      const prom = k => (ag.reduce((s, a) => s + (a[k] || 0), 0) / ag.length).toFixed(1);
      return { agente: `${ag.filter(a => a.motor === 'agente').length}/${sinError.length}`,
        rondas: prom('rondas'), paginasLeidas: prom('paginas'), imagenes: prom('imagenes'),
        tokensPorPregunta: Math.round(ag.reduce((s, a) => s + (a.tokens || 0), 0) / ag.length) };
    })(),
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
  /* --por-categoria: aciertos por `cat` de la batería en cada corrida. */
  if (process.argv.includes('--por-categoria')) {
    const cats = {};
    for (const f of fs.readdirSync(SALIDA).filter(f => f.endsWith('.jsonl')).sort()) {
      const filas = leer(path.join(SALIDA, f)).map(x => ({ ...x, ...calificar(x, x) }));
      for (const x of filas) {
        const c = x.cat || x.tipo;
        cats[c] = cats[c] || {};
        const k = f.replace('.jsonl', '');
        const [a, b] = (cats[c][k] || '0/0').split('/').map(Number);
        cats[c][k] = `${a + (x.ok ? 1 : 0)}/${b + 1}`;
      }
    }
    console.table(cats);
  }
  process.exit(0);
}

/* ── Corrida ──────────────────────────────────────────────────────────────── */
const archivoClave = path.join(os.homedir(), '.config/asistente/gemini.key');
/* Con --clave-en-pagina la key ya la pegó el asesor en Ajustes de la página
   que se mide (con --vivo) y no sale de ahí: aquí no se lee ni se manda. */
const EN_PAGINA = process.argv.includes('--clave-en-pagina') || MODO === 'manual';
const CLAVE = EN_PAGINA ? null : (process.env.GEMINI_API_KEY || (fs.existsSync(archivoClave) ? fs.readFileSync(archivoClave, 'utf8') : '')).trim();
if (!EN_PAGINA && CLAVE.length < 10) { console.error('Falta la key: GEMINI_API_KEY o ' + archivoClave); process.exit(1); }

const preguntas = JSON.parse(fs.readFileSync(PREGUNTAS, 'utf8'));
fs.mkdirSync(SALIDA, { recursive: true });
const destino = path.join(SALIDA, `${ETIQUETA}__${MODO === 'manual' ? 'manual' : MODELO}.jsonl`);
/* Lo que cortó la cuota del día no es un resultado: se vuelve a preguntar. */
/* Ni el 429 por minuto ni un corte de red son respuestas del modelo: medido
   con 14 manuales, 50 de 134 salieron así a media corrida y se guardaban como
   fallos. */
const CUOTA = /quota|per day|resource.?exhausted|error 429|demasiadas consultas|failed to fetch|error de conexi/i;
const hechas = leer(destino).filter(f => !(f.error && CUOTA.test(f.cuerpo)));
fs.writeFileSync(destino, hechas.map(f => JSON.stringify(f)).join('\n') + (hechas.length ? '\n' : ''));
const llave = x => (x.m ?? '') + '|' + [...(x.turnos || []), x.q].join(' → ');
const yaHecha = new Set(hechas.map(llave));

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
  if (MOTOR === 'agente') {
    const r = await post(`return await (${PREPARAR.toString()})(${JSON.stringify({ clave: CLAVE })})`);
    if (r.startsWith('ERROR')) throw new Error(r);
    console.log('ficha:', r);
  }
} else {
  const { chromium } = await import(process.env.PLAYWRIGHT_CORE ? pathToFileURL(process.env.PLAYWRIGHT_CORE).href : 'playwright-core');
  const port = 9500 + Math.floor(Math.random() * 100);
  const srv = spawn(process.env.PYTHON || 'python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: RAIZ, stdio: 'ignore' });
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
  if (MOTOR === 'agente') console.log('ficha:', JSON.stringify(await p.evaluate(PREPARAR, { clave: CLAVE })));
}

try {
  const pendientes = preguntas.filter(x => !yaHecha.has(llave(x)));
  console.log(`${MODO === 'manual' ? 'modo manual' : MODELO} · ${ETIQUETA}: ${pendientes.length} por preguntar (${hechas.length} ya medidas)`);
  for (const [i, x] of pendientes.entries()) {
    const r = await preguntar({ q: x.q, turnos: x.turnos || null, h: x.h || null, m: x.m ?? null, clave: CLAVE, modelo: MODELO, variante: VARIANTES[VARIANTE] || null, modo: MODO, motor: MOTOR });
    if (r.falta) { console.log('  sin manual:', x.m); continue; }
    const fila = { ...x, ...r, ...calificar(x, r), modeloPedido: MODELO, modo: MODO, etiqueta: ETIQUETA, fecha: new Date().toISOString() };
    fs.appendFileSync(destino, JSON.stringify(fila) + '\n');
    console.log(`${String(i + 1).padStart(3)} ${fila.ok ? '✓' : '✗'} ${x.q.slice(0, 44).padEnd(44)} ${seg(r.tPrimer).padStart(7)} ${r.contesto || ''}${r.error ? ' ERROR' : ''}${fila.fallo ? ' · ' + fila.fallo : ''}`);
    if (r.error && CUOTA.test(r.cuerpo)) { console.log('Se acabó la cuota del día; vuelve a correr lo mismo mañana y sigue desde aquí.'); break; }
    if (MODO !== 'manual') await new Promise(ok => setTimeout(ok, PAUSA));
  }
} finally { await cerrar(); }
console.table({ [path.basename(destino, '.jsonl')]: resumir(leer(destino).map(x => ({ ...x, ...calificar(x, x) }))) });
