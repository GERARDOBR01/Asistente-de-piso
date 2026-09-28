// Recorre el agente lector de punta a punta dentro de la app real, contra un
// Gemini y un OpenAI simulados: carga el manual demo, prepara la ficha, pregunta
// y revisa lo que sale en pantalla y lo que viaja en cada petición. No usa red
// ni key: las llamadas a los proveedores se contestan aquí con respuestas
// grabadas. Lo que prueba es el protocolo (firmas de pensamiento, tool_calls por
// streaming, imágenes), los topes del guardián y la caída al motor clásico.
//
// Uso:
//   node eval/agente-simulado.mjs
//
// Mismo Playwright que eval/arnes.mjs (PLAYWRIGHT_CORE, CHROMIUM, CANAL).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.pdf': 'application/pdf', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.css': 'text/css', '.woff2': 'font/woff2',
};
const srv = http.createServer((req, res) => {
  const ruta = path.join(RAIZ, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!ruta.startsWith(RAIZ) || !fs.existsSync(ruta) || fs.statSync(ruta).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(ruta)] || 'application/octet-stream' });
  fs.createReadStream(ruta).pipe(res);
});
await new Promise(ok => srv.listen(0, '127.0.0.1', ok));
const intentar = async nombre => { try { return await import(nombre); } catch { return null; } };
const pw = process.env.PLAYWRIGHT_CORE
  ? await import(pathToFileURL(process.env.PLAYWRIGHT_CORE).href)
  : (await intentar('playwright-core')) || (await intentar('playwright'));
if (!pw) { console.error('Falta Playwright: npm i --no-save playwright-core'); srv.close(); process.exit(2); }

let fallos = 0;
const bien = m => console.log('✓ ' + m);
const mal = m => { fallos++; console.log('✗ ' + m); };
const revisa = (cond, m, detalle) => cond ? bien(m) : mal(m + (detalle ? ' — ' + detalle : ''));

const b = await pw.chromium.launch({ executablePath: process.env.CHROMIUM || undefined, channel: process.env.CANAL || undefined });
try {
  const p = await b.newPage();
  p.on('dialog', d => d.accept());
  await p.goto(`http://127.0.0.1:${srv.address().port}/index.html`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.pdfjsLib, null, { timeout: 60000 });

  /* ── Gemini simulado ── */
  let guion = null, vistas = [];
  const sse = objs => objs.map(o => 'data: ' + JSON.stringify(o) + '\n\n').join('');
  const parte = t => ({ candidates: [{ content: { parts: [{ text: t }] } }] });
  await p.route('https://generativelanguage.googleapis.com/**', r => {
    const url = r.request().url(), body = JSON.parse(r.request().postData() || '{}');
    if (url.includes(':generateContent')) {
      const n = Number((body.contents[0].parts[0].text.match(/PÁGINA (\d+)\./) || [])[1]);
      const ficha = n === 8
        ? { titulo: 'MUNDOS Y MARCAS', resumen: 'Reparte las marcas por mundo.', temas: ['marcas por mundo'], marcas: ['Brastow', 'Ondera', 'Velmira', 'Kalinde', 'Tresvik'],
            mundos: ['Clásico', 'Contempo'], texto_visual: 'CLÁSICO: Brastow, Ondera · CONTEMPO: Velmira, Kalinde, Tresvik', alias: ['Contempo = contemporáneo'], preguntas: ['¿Qué marcas van en Contempo?'] }
        : { titulo: 'LÁMINA ' + n, resumen: 'Reglas de la lámina ' + n, temas: [], marcas: [], mundos: [], texto_visual: '', alias: [], preguntas: ['¿Qué pide la lámina ' + n + '?'] };
      /* Envuelta en ```json, como a veces la manda el modelo. */
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(parte('```json\n' + JSON.stringify(ficha) + '\n```')) });
    }
    vistas.push(body);
    const res = guion(body, vistas.length);
    if (res.status) return r.fulfill({ status: res.status, contentType: 'application/json', body: JSON.stringify({ error: { message: res.msg } }) });
    return r.fulfill({ status: 200, contentType: 'text/event-stream', body: sse(res) });
  });

  await p.setInputFiles('#file-input', { name: '140 CASUAL HOMBRE.pdf', mimeType: 'application/pdf', buffer: fs.readFileSync(path.join(RAIZ, 'docs/manual-demo.pdf')) });
  await p.waitForFunction(() => docs.length === 1 && document.getElementById('proc-wrap').style.display === 'none', null, { timeout: 120000 });
  await p.evaluate(() => {
    sessionStorage.setItem('ap_api_key_gemini', 'AIza-simulada-no-es-real-000');
    appState.apiKey = 'AIza-simulada-no-es-real-000'; appState.provider = 'gemini'; appState.chatModel = 'gemini-3.5-flash'; appState.motor = 'agente';
  });
  const preguntar = q => p.evaluate(q => { document.getElementById('user-input').value = q; return sendMessage(); }, q);
  const ultimo = () => p.evaluate(() => {
    const el = [...document.querySelectorAll('.msg.assistant')].pop();
    return { cuerpo: el.querySelector('.msg-body').innerText, etiqueta: el.querySelector('.msg-label').innerText,
      entendi: el.querySelector('.entendi')?.innerText || '', traza: el.querySelector('.msg-traza')?.innerText || '',
      avisos: [...el.querySelectorAll('.verify-warn')].map(w => w.innerText), laminas: el.querySelectorAll('.evidencia-fig').length, agente: ultimaTrazaAgente };
  });

  /* 1 · Ficha */
  const f = await p.evaluate(async () => ({ r: await prepararFicha(docs[0].name), imagenes: (docPaginas.get(docs[0].name) || []).length,
    llega: retrieve('¿qué marcas van en el mundo contemporáneo?', { source: 'pdf', limit: 4, doc: docs[0].name }).map(x => x.c.page + ':' + (x.c.isFicha || 'manual')) }));
  revisa(f.r.hechas === 9 && f.imagenes === 9, 'la ficha lee las 9 láminas, cada una con su imagen', JSON.stringify(f.r));
  revisa(f.llega[0]?.startsWith('8') && !f.llega.some(x => x.includes('indice')), '«contemporáneo» llega a la pág. 8 y la ficha índice no sale como resultado', f.llega.join(' '));

  /* 2 · Pide leer, mira la lámina y contesta */
  const FIRMA = 'firma-simulada';
  guion = (body, n) => n === 1 ? [{ candidates: [{ content: { parts: [{ functionCall: { name: 'leer_paginas', args: { paginas: [8, 99] } }, thoughtSignature: FIRMA }] } }] }]
    : n === 2 ? [{ candidates: [{ content: { parts: [{ functionCall: { name: 'ver_lamina', args: { pagina: 8 } } }] } }] }]
    : [parte('[PENSAMIENTO INTERNO]\nENTENDÍ: ¿Qué marcas van en Contempo?\nCORRECCIONES: contemporáneo → Contempo\nEVIDENCIA: pág. 8 · MARCAS POR MUNDO · «CONTEMPO: Velmira, Kalinde, Tresvik»\nOPCIONES: ninguna\n'),
       { ...parte('[RESPUESTA FINAL]\nEn **Contempo** van **Velmira**, **Kalinde** y **Tresvik** (pág. 8).\nCERTEZA: ALTA'), usageMetadata: { totalTokenCount: 4000 } }];
  vistas = [];
  await p.evaluate(() => { history = []; });
  await preguntar('¿qué marcas van en el mundo contemporáneo?');
  let u = await ultimo();
  revisa(/Velmira/.test(u.cuerpo) && /certeza alta/i.test(u.etiqueta), 'contesta con las marcas de la imagen y certeza alta', u.cuerpo);
  revisa(/Contempo/.test(u.entendi) && /contemporáneo/.test(u.entendi), 'enseña lo que entendió', u.entendi);
  revisa(/pág\. 8/.test(u.traza) && /lámina/.test(u.traza) && u.laminas >= 1, 'dice qué leyó y enseña la lámina', u.traza);
  revisa(vistas[1]?.contents.find(c => c.role === 'model')?.parts[0].thoughtSignature === FIRMA, 'la firma de pensamiento vuelve intacta');
  const resp = vistas[1]?.contents.at(-1).parts[0].functionResponse?.response?.resultado || '';
  revisa(/99 no existe/.test(resp), 'una página que no existe vuelve al modelo como error', resp.slice(0, 120));
  revisa(vistas[2]?.contents.at(-1).parts.some(x => x.inline_data), 'ver_lamina manda la imagen de la página');

  /* 3 · Cita inventada */
  guion = () => [parte('[PENSAMIENTO INTERNO]\nENTENDÍ: x\nEVIDENCIA: pág. 8 · MARCAS · «CONTEMPO: Velmira, Nordika, Soltera»\n[RESPUESTA FINAL]\nVan Velmira, Nordika y Soltera (pág. 8).\nCERTEZA: ALTA')];
  await preguntar('¿qué marcas van en el mundo contemporáneo?');
  u = await ultimo();
  revisa(/certeza media/i.test(u.etiqueta) && u.avisos.some(a => /citas/.test(a)), 'una cita que no está en lo leído baja a certeza media y se avisa', u.etiqueta);

  /* 4 · La imagen rechazada: la vuelta se repite sin ella */
  let rechazos = 0;
  guion = (body, n) => {
    if (n === 1) return [{ candidates: [{ content: { parts: [{ functionCall: { name: 'ver_lamina', args: { pagina: 3 } } }] } }] }];
    if (body.contents.some(c => c.role === 'user' && c.parts.some(x => x.inline_data))) { rechazos++; return { status: 400, msg: 'Invalid part' }; }
    return [parte('[PENSAMIENTO INTERNO]\nEVIDENCIA: pág. 3 · MESA DE ENTRADA · «Altura máxima de pila: 30 cm»\n[RESPUESTA FINAL]\nLa pila va a máximo **30 cm** (pág. 3).\nCERTEZA: ALTA')];
  };
  vistas = [];
  await preguntar('¿qué tan alta la pila?');
  u = await ultimo();
  revisa(rechazos === 1 && /30 cm/.test(u.cuerpo) && u.agente?.motor === 'agente', 'si el proveedor rechaza la imagen, sigue sin ella');

  /* 5 · Nunca deja de pedir: cuatro vueltas y la última sin herramientas */
  guion = body => body.toolConfig?.functionCallingConfig?.mode === 'NONE'
    ? [parte('[PENSAMIENTO INTERNO]\nENTENDÍ: x\n[RESPUESTA FINAL]\nEl manual no especifica eso.\nCERTEZA: GAP')]
    : [{ candidates: [{ content: { parts: [{ functionCall: { name: 'leer_paginas', args: { paginas: [1, 2, 3, 4, 5, 6, 7, 9] } } }, { functionCall: { name: 'inventada', args: {} } }] } }] }];
  vistas = [];
  await preguntar('¿de qué color va el techo?');
  u = await ultimo();
  const modos = vistas.map(v => v.toolConfig?.functionCallingConfig?.mode);
  revisa(modos.length === 4 && modos[3] === 'NONE' && u.agente.paginas <= 8 && /no está en el manual/i.test(u.etiqueta),
    'cuatro vueltas como tope, la última sin herramientas, y cierra en GAP', modos.join(','));

  /* 6 · Agente roto: contesta el clásico */
  guion = body => body.tools ? { status: 400, msg: 'boom' }
    : [parte('[PENSAMIENTO INTERNO]\nETAPA 1\n[RESPUESTA FINAL]\nEl sensor va a 15 cm de la bastilla (pág. 6).\nCERTEZA: ALTA')];
  await preguntar('¿a qué altura va el sensor?');
  u = await ultimo();
  revisa(/15 cm/.test(u.cuerpo) && u.agente?.motor === 'clasico', 'si el agente falla, contesta el motor clásico en la misma pregunta');

  /* ── OpenAI simulado: tool_calls que llegan en trozos ── */
  const vistasOpenAI = [];
  await p.route('https://api.openai.com/**', r => {
    const body = JSON.parse(r.request().postData() || '{}'); vistasOpenAI.push(body);
    const ch = o => 'data: ' + JSON.stringify(o) + '\n\n';
    let s = '';
    if (vistasOpenAI.length === 1) {
      s += ch({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_a', type: 'function', function: { name: 'leer_', arguments: '' } }] } }] });
      s += ch({ choices: [{ delta: { tool_calls: [{ index: 0, function: { name: 'paginas', arguments: '{"pagi' } }] } }] });
      s += ch({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: 'nas":[6]}' } }] } }] });
      s += ch({ choices: [{ delta: { tool_calls: [{ index: 1, id: 'call_b', type: 'function', function: { name: 'ver_lamina', arguments: '{"pagina":6}' } }] } }] });
    } else {
      const t = '[PENSAMIENTO INTERNO]\nENTENDÍ: ¿A qué altura va el sensor del pantalón?\nCORRECCIONES: alarma → sensor\nEVIDENCIA: pág. 6 · SENSORES · «el sensor va oculto a 15 cm de la bastilla»\n[RESPUESTA FINAL]\nVa oculto a **15 cm** de la bastilla (pág. 6).\nCERTEZA: ALTA';
      for (const trozo of t.match(/[\s\S]{1,25}/g)) s += ch({ choices: [{ delta: { content: trozo } }] });
      s += ch({ choices: [], usage: { total_tokens: 3100 } });
    }
    r.fulfill({ status: 200, contentType: 'text/event-stream', body: s + 'data: [DONE]\n\n' });
  });
  await p.evaluate(() => { sessionStorage.setItem('ap_api_key_openai', 'sk-simulada-no-es-real-0000'); appState.provider = 'openai'; appState.chatModel = 'gpt-4o-mini'; history = []; });
  await preguntar('¿dónde le pongo la alarma al pantalón?');
  u = await ultimo();
  const v2 = vistasOpenAI[1] || { messages: [] };
  const asis = v2.messages.find(m => m.role === 'assistant' && m.tool_calls);
  const tools = v2.messages.filter(m => m.role === 'tool');
  revisa(/15 cm/.test(u.cuerpo) && /certeza alta/i.test(u.etiqueta), 'OpenAI: contesta con su cita', u.cuerpo);
  revisa(asis?.tool_calls.length === 2 && JSON.parse(asis.tool_calls[0].function.arguments).paginas[0] === 6 && asis.tool_calls[0].function.name === 'leer_paginas',
    'OpenAI: los tool_calls se arman con los trozos del streaming');
  revisa(tools.length === 2 && tools[0].tool_call_id === 'call_a' && v2.messages.at(-1).content.some?.(x => x.type === 'image_url'),
    'OpenAI: cada llamada con su respuesta y la imagen en un mensaje aparte');
} finally {
  await b.close();
  srv.close();
}
console.log(fallos ? `${fallos} en rojo` : 'todo en verde');
process.exit(fallos ? 1 : 0);
