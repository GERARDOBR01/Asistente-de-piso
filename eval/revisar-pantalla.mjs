// La pantalla de Revisar de punta a punta, en un Chromium sin ventana, en
// celular (390×844, táctil) y en escritorio. Lo corre el CI: las pruebas de
// lab/ miden las reglas sobre los píxeles; aquí se prueba lo que toca la
// persona (cámara con la guía en vivo, ejemplos, galería, zonas, ajustar,
// vestidos, puntos del focal, compartir, otra foto) y que nada truene en la
// página. Sin fotos reales: la cámara es la falsa de Chromium, las imágenes
// las dibuja demo.js en la propia página, y el focal se toca con «Punto
// exacto», que no necesita bajar ningún modelo.
//
// Uso: node eval/revisar-pantalla.mjs [--capturas <carpeta>]
//   (Playwright como en eval/arnes.mjs: PLAYWRIGHT_CORE, CANAL, CHROMIUM)
import fs from 'node:fs';
import path from 'node:path';
import { servirRepo, cargarPlaywright } from './navegador.mjs';

const args = process.argv.slice(2);
const capturas = args.includes('--capturas') ? args[args.indexOf('--capturas') + 1] : null;
if (capturas) fs.mkdirSync(capturas, { recursive: true });

const pw = await cargarPlaywright();
if (!pw) { console.error('Falta Playwright: npm i --no-save playwright-core, o PLAYWRIGHT_CORE=<ruta a index.mjs>'); process.exit(2); }
const srv = await servirRepo();
const b = await pw.chromium.launch({
  executablePath: process.env.CHROMIUM || undefined, channel: process.env.CANAL || undefined,
  /* Cámara falsa de Chromium y permiso sin preguntar: prueba la guía en vivo y el disparo. */
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});
const url = `http://127.0.0.1:${/** @type {any} */ (srv.address()).port}/index.html`;

/** @type {{vista:string, q:string, ok:boolean, detalle:string}[]} */
const filas = [];

/**
 * Sube como si viniera de la galería una imagen que dibuja demo.js en la página.
 * @param {any} p @param {string} quien `tringla` (revuelta) | `tringla-bien` | `anaquel` | `focal`
 */
async function subirDemo(p, quien) {
  await p.evaluate(async (/** @type {string} */ quien) => {
    const D = await import('/src/revision/demo.js');
    const P = D.PALETA;
    const g = quien === 'tringla' ? D.tringla([P.calido[0], P.calido[1], P.frio[0], P.calido[3], P.frio[1], P.neutro[2], P.neutro[3]], { w: 960, h: 720, semilla: 5 })
      : quien === 'tringla-bien' ? D.tringla([P.calido[0], P.calido[1], P.calido[3], P.frio[0], P.frio[1], P.neutro[2], P.neutro[3]], { w: 960, h: 720, semilla: 5 })
      : quien === 'anaquel' ? D.anaquel({ w: 960, h: 720, semilla: 3, huecos: [[1, 2], [1, 3]] })
      : D.focal([0.45, 0.62, 0.8, 0.6], { w: 960, h: 720, semilla: 2 }).img;
    const c = document.createElement('canvas');
    c.width = g.width; c.height = g.height;
    /** @type {CanvasRenderingContext2D} */ (c.getContext('2d')).putImageData(new ImageData(Uint8ClampedArray.from(g.data), g.width, g.height), 0, 0);
    const blob = /** @type {Blob} */ (await new Promise(r => c.toBlob(r, 'image/jpeg', 0.92)));
    const dt = new DataTransfer();
    dt.items.add(new File([blob], `${quien}.jpg`, { type: 'image/jpeg' }));
    const inp = /** @type {HTMLInputElement} */ (document.getElementById('rv-archivo'));
    inp.files = dt.files;
    inp.dispatchEvent(new Event('change'));
  }, quien);
}

/** Los niveles de las tarjetas de resultado, en orden. @param {any} p @returns {Promise<string[]>} */
const niveles = p => p.evaluate(() => [...document.querySelectorAll('#rv-res .rv-ver .rv-nivel')].map(e => /** @type {HTMLElement} */ (e).innerText.trim()));
/** @param {any} p @param {number} ms */
const espera = (p, ms) => p.waitForTimeout(ms);

/**
 * Un punto del lienzo, en fracción de la foto, a coordenadas de la página.
 * @param {any} p @param {number} fx @param {number} fy
 */
async function enLienzo(p, fx, fy) {
  return p.evaluate(({ fx, fy }) => {
    const lz = /** @type {HTMLCanvasElement} */ (document.getElementById('rv-lienzo'));
    const r = lz.getBoundingClientRect();
    const k = Math.min(r.width / lz.width, r.height / lz.height), w = lz.width * k, h = lz.height * k;
    return { x: r.left + (r.width - w) / 2 + fx * w, y: r.top + (r.height - h) / 2 + fy * h };
  }, { fx, fy });
}

for (const vista of [{ nombre: 'celular', width: 390, height: 844, tactil: true }, { nombre: 'escritorio', width: 1280, height: 900, tactil: false }]) {
  const ctx = await b.newContext({ viewport: { width: vista.width, height: vista.height }, hasTouch: vista.tactil, deviceScaleFactor: vista.tactil ? 2 : 1 });
  const p = await ctx.newPage();
  /** @type {string[]} */
  const errores = [];
  p.on('pageerror', (/** @type {Error} */ e) => errores.push(e.message));
  const fila = (/** @type {string} */ q, /** @type {any} */ ok, detalle = '') => filas.push({ vista: vista.nombre, q, ok: !!ok, detalle: String(detalle) });
  const foto = async (/** @type {string} */ n, completa = false) => { if (capturas) await p.screenshot({ path: path.join(capturas, `${vista.nombre}-${n}.png`), fullPage: completa }); };
  try {
    await p.goto(url, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => /** @type {any} */ (window).__revision && /** @type {any} */ (window).tocarPestana, null, { timeout: 60000 });
    await p.evaluate(() => /** @type {any} */ (window).tocarPestana('revisar'));
    await espera(p, 400);
    const tipo = (/** @type {string} */ t) => p.evaluate((/** @type {string} */ t) => /** @type {HTMLElement} */ (document.querySelector(`[data-tipo="${t}"]`)).click(), t);
    const ejemplo = async () => { await p.evaluate(() => /** @type {HTMLElement} */ (document.getElementById('rv-demo')).click()); await espera(p, 1300); };

    /* 0. Cámara: la guía en vivo mide luz y nitidez, el nivel sigue al acelerómetro y la foto se toma. */
    const disparo = () => p.evaluate(() => /** @type {HTMLElement} */ (document.getElementById('rv-disparo')).click());
    await disparo();
    await p.waitForFunction(() => {
      const t = /** @type {HTMLElement} */ (document.getElementById('rv-toma'));
      return !t.hidden && /** @type {HTMLElement} */ (t.querySelector('[data-toma="luz"]')).textContent !== 'Luz';
    }, null, { timeout: 20000 });
    const toma = await p.evaluate(() => [...document.querySelectorAll('#rv-toma span:not([hidden])')].map(e => e.textContent));
    fila('cámara: la guía en vivo dice luz y nitidez antes de tomar', toma.length === 2 && /Luz bien|Falta luz/.test(toma[0]) && /Nítida|movida/.test(toma[1]), toma.join(' · '));
    /** Gravedad como la da Android con el teléfono ladeado `grados` a la derecha. @param {number} grados */
    const ladear = grados => p.evaluate((/** @type {number} */ g) => {
      const r = g * Math.PI / 180;
      for (let i = 0; i < 40; i++) dispatchEvent(new DeviceMotionEvent('devicemotion', { accelerationIncludingGravity: { x: -9.81 * Math.sin(r), y: 9.81 * Math.cos(r), z: 0 } }));
    }, grados);
    const leerNivel = () => p.evaluate(() => ({
      txt: /** @type {HTMLElement} */ (document.getElementById('rv-toma-nivel')).textContent,
      giro: /** @type {HTMLElement} */ (document.getElementById('rv-horizonte')).style.getPropertyValue('--ladeo'),
      ok: document.getElementById('rv-horizonte')?.classList.contains('ok'),
    }));
    await ladear(8); await espera(p, 200);
    const chueco = await leerNivel();
    await ladear(0); await espera(p, 200);
    const derecho = await leerNivel();
    fila('cámara: el nivel sigue al acelerómetro (ladeado 8°, luego derecho)', chueco.txt === 'Ladeado 8°' && chueco.giro === '-8.0deg' && !chueco.ok && derecho.txt === 'Derecho' && derecho.ok,
      `${chueco.txt} ${chueco.giro} → ${derecho.txt} ${derecho.giro}`);
    await foto('camara');
    await disparo();
    await p.waitForFunction(() => document.querySelectorAll('#rv-res .rv-ver').length > 0, null, { timeout: 30000 });
    const apagada = await p.evaluate(() => /** @type {HTMLElement} */ (document.getElementById('rv-toma')).hidden && !document.getElementById('rv-disparo')?.classList.contains('lista'));
    fila('cámara: la foto se toma, se revisa y la guía en vivo se apaga', apagada);
    await p.evaluate(() => /** @type {HTMLElement} */ (document.getElementById('rv-nueva-foto')).click());
    await espera(p, 300);

    /* 1. Ejemplos: los tres de tringla, los dos de anaquel y los dos de focal. */
    await tipo('tringla');
    const vistos = [];
    for (let i = 0; i < 3; i++) { await ejemplo(); vistos.push((await niveles(p))[0]); }
    fila('tringla: los ejemplos dan GRAVE, CUMPLE y OBSERVACIÓN (color dudoso)', vistos.join() === 'GRAVE,CUMPLE,OBSERVACIÓN', vistos.join());
    await foto('tringla-ejemplo');
    /* 2. Vestidos: el primer ejemplo (GRAVE) se vuelve NO_CALIFICA y regresa. */
    await ejemplo();   // los ejemplos dan la vuelta: de nuevo el primero (GRAVE)
    const antesV = (await niveles(p))[0];
    await p.evaluate(() => /** @type {HTMLElement} */ (document.querySelector('[data-vestidos]')).click());
    await espera(p, 900);
    const conV = await p.evaluate(() => /** @type {HTMLElement} */ (document.querySelector('#rv-res .rv-ver')).innerText);
    await p.evaluate(() => /** @type {HTMLElement} */ (document.querySelector('[data-vestidos]')).click());
    await espera(p, 900);
    const sinV = (await niveles(p))[0];
    fila('vestidos: la tarjeta pasa a NO_CALIFICA «sin regla de color» y regresa', antesV === 'GRAVE' && /NO_CALIFICA/.test(conV) && /vestidos/i.test(conV) && sinV === 'GRAVE', `${antesV} → ${conV.slice(0, 60).replace(/\s+/g, ' ')} → ${sinV}`);
    await tipo('anaquel');
    const an = [];
    for (let i = 0; i < 2; i++) { await ejemplo(); an.push((await niveles(p))[0]); }
    fila('anaquel: los ejemplos dan GRAVE (huecos) y CUMPLE', an.join() === 'GRAVE,CUMPLE', an.join());
    await foto('anaquel-ejemplo');
    await tipo('focal');
    await ejemplo();
    const fo = await niveles(p);
    fila('focal: el ejemplo trae triangulación y alturas', fo.length === 2, fo.join());
    await foto('focal-ejemplo');

    /* 3. Galería: una tringla sin metadatos → resultado + evidencia «SIN DATOS». */
    await tipo('tringla');
    await subirDemo(p, 'tringla');
    await p.waitForFunction(() => document.querySelectorAll('#rv-res .rv-ver').length > 0, null, { timeout: 30000 });
    const origen = await p.evaluate(() => /** @type {HTMLElement|null} */ (document.querySelector('#rv-res .rv-origen'))?.innerText || '');
    fila('galería: la foto se revisa y la evidencia dice SIN DATOS', /SIN DATOS/.test(origen), origen.slice(0, 50).replace(/\s+/g, ' '));

    /* 4. Zonas: «＋ Zona» y arrastrar dos recuadros. El primero reemplaza al de la guía. */
    const arrastrar = async (/** @type {number[]} */ [x0, y0, x1, y1]) => {
      const a = await enLienzo(p, x0, y0), z = await enLienzo(p, x1, y1);
      await p.mouse.move(a.x, a.y); await p.mouse.down();
      await p.mouse.move((a.x + z.x) / 2, (a.y + z.y) / 2, { steps: 4 }); await p.mouse.move(z.x, z.y, { steps: 4 });
      await p.mouse.up();
      /* La cifra sube a la vista a los ~950 ms: se espera a que la página se quede quieta. */
      await espera(p, 1600);
    };
    /* «＋ Zona» regresa la foto a la vista (la página había bajado a las tarjetas). */
    const masZona = async () => { await p.evaluate(() => /** @type {HTMLElement} */ (document.getElementById('rv-zona-nueva')).click()); await espera(p, 800); };
    await masZona();
    await arrastrar([0.05, 0.15, 0.6, 0.85]);
    await masZona();
    await arrastrar([0.55, 0.15, 0.95, 0.85]);
    const zonas = await p.evaluate(() => document.querySelectorAll('#rv-zonas-lista .rv-zona').length);
    const general = await p.evaluate(() => /** @type {HTMLElement|null} */ (document.querySelector('#rv-res .rv-general'))?.innerText || '');
    fila('zonas: dos recuadros dibujados dan dos zonas y un resumen general', zonas === 2 && /2 zonas/i.test(general), `${zonas} zonas · ${general.slice(0, 40).replace(/\s+/g, ' ')}`);
    await foto('zonas');
    await p.evaluate(() => /** @type {HTMLElement} */ (document.querySelector('#rv-zonas-lista [data-quitar="1"]')).click());
    await espera(p, 400);
    fila('zonas: la × quita una zona', await p.evaluate(() => document.querySelectorAll('#rv-zonas-lista .rv-zona').length) === 1);

    /* 4b. Ajustar la zona que quedó: esquina, moverla entera y cambiarle el tipo. */
    const zona0 = () => p.evaluate(() => { const z = /** @type {any} */ (window).__revision.st.zonas[0]; return { ...z.marco, tipo: z.tipo, basico: z.res?.[0]?.basico, guia: z.guia }; });
    await p.evaluate(() => /** @type {HTMLElement} */ (document.getElementById('rv-zona-ajustar')).click());
    await espera(p, 800);
    const enAjuste = await p.evaluate(() => /** @type {HTMLElement} */ (document.getElementById('rv-zona-ajustar')).innerText.trim() === 'Listo' && document.getElementById('rv-lienzo')?.classList.contains('ajustando'));
    const z0 = await zona0();
    await arrastrar([z0.x + z0.w, z0.y + z0.h, 0.5, 0.7]);
    const z1 = await zona0();
    fila('ajustar: la esquina de abajo a la derecha cambia el tamaño y la de arriba se queda', enAjuste && Math.abs(z1.x - z0.x) < 0.01 && Math.abs(z1.y - z0.y) < 0.01 && Math.abs(z1.x + z1.w - 0.5) < 0.02 && Math.abs(z1.y + z1.h - 0.7) < 0.02,
      `${enAjuste} · ${[z1.x, z1.y, z1.w, z1.h].map(v => v.toFixed(2)).join(',')}`);
    await arrastrar([z1.x + z1.w / 2, z1.y + z1.h / 2, z1.x + z1.w / 2 + 0.2, z1.y + z1.h / 2]);
    const z2 = await zona0();
    fila('ajustar: arrastrar adentro la mueve sin cambiar su tamaño y se vuelve a medir', Math.abs(z2.x - z1.x - 0.2) < 0.02 && Math.abs(z2.w - z1.w) < 0.005 && z2.basico === 'colorizacion',
      `${[z2.x, z2.w].map(v => v.toFixed(2)).join(',')} · ${z2.basico}`);
    await foto('ajustar');
    await tipo('anaquel');
    await espera(p, 900);
    const z3 = await zona0();
    const chip = await p.evaluate(() => /** @type {HTMLElement} */ (document.querySelector('#rv-zonas-lista .rv-zona')).innerText);
    fila('ajustar: el botón de arriba cambia qué es la zona (tringla → mesa, se mide el surtido)', z3.tipo === 'anaquel' && z3.basico === 'surtido' && /Mesa/.test(chip) && Math.abs(z3.x - z2.x) < 0.005, `${z3.tipo} · ${z3.basico} · ${chip.replace(/\s+/g, ' ')}`);
    await p.evaluate(() => /** @type {HTMLElement} */ (document.getElementById('rv-zona-ajustar')).click());
    await espera(p, 400);
    fila('ajustar: «Listo» sale del ajuste', await p.evaluate(() => /** @type {any} */ (window).__revision.st.modo === 'ver' && !document.getElementById('rv-lienzo')?.classList.contains('ajustando')));

    /* 5. Focal a mano con «Punto exacto»: tres toques y Revisar. */
    await p.evaluate(() => /** @type {HTMLElement} */ (document.getElementById('rv-nueva-foto')).click());
    await tipo('focal');
    await subirDemo(p, 'focal');
    await p.waitForFunction(() => !(/** @type {HTMLElement} */ (document.getElementById('rv-ayuda'))).hidden, null, { timeout: 30000 });
    await p.evaluate(() => /** @type {HTMLElement} */ (document.getElementById('rv-exacto')).click());
    for (const [fx, fy] of [[0.25, 0.45], [0.5, 0.2], [0.75, 0.42]]) {
      const q = await enLienzo(p, fx, fy);
      await p.mouse.click(q.x, q.y);
      await espera(p, 500);
    }
    const listo = await p.evaluate(() => !(/** @type {HTMLButtonElement} */ (document.getElementById('rv-listo'))).disabled);
    await p.evaluate(() => /** @type {HTMLElement} */ (document.getElementById('rv-listo')).click());
    await espera(p, 1300);
    const tri = await niveles(p);
    fila('focal: tres puntos exactos habilitan Revisar y dan triangulación y alturas', listo && tri.length === 2 && tri[0] === 'CUMPLE', `${listo} · ${tri.join()}`);
    await foto('focal-puntos');

    /* 6. Compartir: la imagen del reporte (sin abrir la hoja del sistema). */
    const rep = await p.evaluate(() => { const c = /** @type {any} */ (window).__revision.reporteParaCompartir(); return { w: c.width, h: c.height }; });
    fila('compartir: el reporte mide 1080 de ancho y trae foto y tarjetas', rep.w === 1080 && rep.h > 1200, `${rep.w}×${rep.h}`);

    /* 7. Otra foto: la pantalla vuelve a empezar. */
    await p.evaluate(() => /** @type {HTMLElement} */ (document.getElementById('rv-nueva-foto')).click());
    await espera(p, 300);
    const vacia = await p.evaluate(() => !(/** @type {HTMLElement} */ (document.getElementById('rv-vacia'))).hidden && !document.querySelector('#rv-res .rv-ver'));
    fila('«Nueva foto» deja la pantalla vacía', vacia);

    /* 9. Historial: lo real se guarda solo y los ejemplos no; sobrevive a recargar, se reabre igual y se borra. */
    const cuantas = () => p.evaluate(() => document.querySelectorAll('#rv-hist-lista .rv-hist-item').length);
    await espera(p, 1500);
    const n0 = await cuantas();
    await tipo('tringla');
    await ejemplo();
    await espera(p, 1600);
    const n1 = await cuantas();
    await subirDemo(p, 'tringla');
    await p.waitForFunction(() => !(/** @type {HTMLElement} */ (document.getElementById('rv-area-caja'))).hidden, null, { timeout: 30000 });
    await p.fill('#rv-area', 'Caballeros · mesa 1');
    await espera(p, 2000);
    const n2 = await cuantas();
    const antes = await niveles(p);
    fila('historial: las fotos reales se guardan solas (cámara, galería, focal) y los ejemplos no', n0 === 3 && n1 === n0 && n2 === n0 + 1, `${n0} → ${n1} → ${n2}`);
    await foto('historial', true);
    await p.reload({ waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => /** @type {any} */ (window).__revision && /** @type {any} */ (window).tocarPestana, null, { timeout: 60000 });
    await p.evaluate(() => /** @type {any} */ (window).tocarPestana('revisar'));
    await p.waitForFunction(() => document.querySelectorAll('#rv-hist-lista .rv-hist-item').length > 0, null, { timeout: 15000 });
    const primera = await p.evaluate(() => /** @type {HTMLElement} */ (document.querySelector('#rv-hist-lista .rv-hist-item b')).textContent);
    await p.evaluate(() => /** @type {HTMLElement} */ (document.querySelector('#rv-hist-lista [data-abrir]')).click());
    await espera(p, 1500);
    const reab = await niveles(p), area = await p.inputValue('#rv-area');
    const sello = await p.evaluate(() => /** @type {HTMLElement} */ (document.getElementById('rv-guardada')).textContent);
    fila('historial: tras recargar, la revisión se reabre con sus resultados y su área', primera === 'Caballeros · mesa 1' && reab.join() === antes.join() && area === 'Caballeros · mesa 1' && /^Guardada · Hoy/.test(sello || ''),
      `${primera} · ${reab.join()} (antes ${antes.join()}) · ${area} · ${sello}`);
    await espera(p, 1800);
    fila('historial: reabrir no la duplica', await cuantas() === n2, String(await cuantas()));
    await p.evaluate(() => /** @type {HTMLElement} */ (document.querySelector('#rv-hist-lista [data-borrar]')).click());
    const tras1 = await cuantas();
    await p.evaluate(() => /** @type {HTMLElement} */ (document.querySelector('#rv-hist-lista [data-borrar]')).click());
    await espera(p, 600);
    fila('historial: borrar una pide un segundo toque', tras1 === n2 && await cuantas() === n2 - 1, `${tras1} → ${await cuantas()}`);
    await p.evaluate(() => /** @type {HTMLElement} */ (document.getElementById('rv-hist-borrar')).click());
    await p.evaluate(() => /** @type {HTMLElement} */ (document.getElementById('rv-hist-borrar')).click());
    await espera(p, 600);
    fila('historial: «Borrar todo» (dos toques) lo deja vacío', await p.evaluate(() => /** @type {HTMLElement} */ (document.getElementById('rv-historial')).hidden));

    /* 10. Antes y después: la tringla revuelta se vuelve a revisar ya corregida, con la misma zona. */
    await subirDemo(p, 'tringla');
    await p.waitForFunction(() => document.querySelectorAll('#rv-res .rv-ver').length > 0, null, { timeout: 30000 });
    await espera(p, 2000);
    const marcoAntes = await p.evaluate(() => JSON.stringify(/** @type {any} */ (window).__revision.st.zonas.map((/** @type {any} */ z) => z.marco)));
    await p.evaluate(() => /** @type {HTMLElement} */ (document.getElementById('rv-repetir')).click());
    await p.waitForFunction(() => !(/** @type {HTMLElement} */ (document.getElementById('rv-fantasma'))).hidden, null, { timeout: 20000 });
    const camaraRep = await p.evaluate(() => ({
      fantasma: /** @type {HTMLImageElement} */ (document.getElementById('rv-fantasma')).src.startsWith('blob:'),
      guia: /** @type {HTMLElement} */ (document.getElementById('rv-guia')).hidden,
      aviso: /** @type {HTMLElement} */ (document.getElementById('rv-repetir-t')).textContent,
    }));
    fila('antes y después: «Volver a revisar» abre la cámara con la foto de antes en fantasma', camaraRep.fantasma && camaraRep.guia && /Volviendo a revisar «Caballeros · mesa 1» de hoy, \d/.test(camaraRep.aviso || ''), JSON.stringify(camaraRep));
    await foto('repetir-camara');
    await subirDemo(p, 'tringla-bien');
    await p.waitForFunction(() => !!document.querySelector('#rv-res .rv-cambios'), null, { timeout: 30000 });
    await espera(p, 2200);
    const cmp = await p.evaluate(() => ({
      texto: /** @type {HTMLElement} */ (document.querySelector('.rv-cambios-cab b')).textContent,
      filas: [...document.querySelectorAll('.rv-cambios li')].map(li => /** @type {HTMLElement} */ (li).dataset.cambio),
      ahora: /** @type {HTMLImageElement} */ (document.getElementById('rv-cambios-ahora')).src.startsWith('blob:'),
      marcos: JSON.stringify(/** @type {any} */ (window).__revision.st.zonas.map((/** @type {any} */ z) => z.marco)),
      area: /** @type {HTMLInputElement} */ (document.getElementById('rv-area')).value,
    }));
    fila('antes y después: misma zona y área, y la tarjeta dice «1 de 1 corregido» (GRAVE → CUMPLE)', cmp.texto === '1 de 1 corregido' && cmp.filas.join() === 'corregido' && cmp.ahora && cmp.marcos === marcoAntes && cmp.area === 'Caballeros · mesa 1', JSON.stringify(cmp));
    await foto('antes-despues', true);
    const vuelta = await p.evaluate(() => [...document.querySelectorAll('#rv-hist-lista .rv-hist-item')].map(e => /** @type {HTMLElement} */ (e.querySelector('.rv-hist-vuelta'))?.textContent || ''));
    fila('antes y después: el historial guarda las dos y la nueva dice «↻ 1 de 1 corregido»', vuelta.length === 2 && vuelta[0] === '↻ 1 de 1 corregido' && vuelta[1] === '', vuelta.join(' | '));
    await p.evaluate(() => /** @type {HTMLElement} */ (document.querySelectorAll('#rv-hist-lista [data-abrir]')[1]).click());
    await espera(p, 1200);
    const sinCmp = await p.evaluate(() => !document.querySelector('.rv-cambios'));
    await p.evaluate(() => /** @type {HTMLElement} */ (document.querySelectorAll('#rv-hist-lista [data-abrir]')[0]).click());
    await espera(p, 1200);
    const conCmp = await p.evaluate(() => /** @type {HTMLElement|null} */ (document.querySelector('.rv-cambios-cab b'))?.textContent);
    fila('antes y después: al reabrir, la de antes va sola y la de después trae su comparación', sinCmp && conCmp === '1 de 1 corregido', `${sinCmp} · ${conCmp}`);

    /* 10b. Un focal: los puntos de la vez pasada llegan como sugerencia y hay que confirmarlos con «Revisar». */
    await p.evaluate(() => /** @type {HTMLElement} */ (document.getElementById('rv-nueva-foto')).click());
    await tipo('focal');
    await subirDemo(p, 'focal');
    await p.waitForFunction(() => !(/** @type {HTMLElement} */ (document.getElementById('rv-ayuda'))).hidden, null, { timeout: 30000 });
    if (!await p.evaluate(() => /** @type {any} */ (window).__revision.st.exacto)) await p.evaluate(() => /** @type {HTMLElement} */ (document.getElementById('rv-exacto')).click());
    for (const [fx, fy] of [[0.25, 0.45], [0.5, 0.2], [0.75, 0.42]]) { const q = await enLienzo(p, fx, fy); await p.mouse.click(q.x, q.y); await espera(p, 400); }
    await p.evaluate(() => /** @type {HTMLElement} */ (document.getElementById('rv-listo')).click());
    await espera(p, 2400);
    await p.evaluate(() => /** @type {HTMLElement} */ (document.getElementById('rv-repetir')).click());
    await p.waitForFunction(() => !(/** @type {HTMLElement} */ (document.getElementById('rv-fantasma'))).hidden, null, { timeout: 20000 });
    await subirDemo(p, 'focal');
    await p.waitForFunction(() => !(/** @type {HTMLElement} */ (document.getElementById('rv-ayuda'))).hidden, null, { timeout: 30000 });
    const pide = await p.evaluate(() => {
      const z = /** @type {any} */ (window).__revision.st.zonas[0];
      return { n: z.puntos.length, sugeridos: z.puntos.every((/** @type {any} */ q) => q.sugerido), res: z.res, nota: /** @type {HTMLElement} */ (document.getElementById('rv-ayuda-t')).textContent, listo: !(/** @type {HTMLButtonElement} */ (document.getElementById('rv-listo'))).disabled, cmp: !!document.querySelector('.rv-cambios') };
    });
    await p.evaluate(() => /** @type {HTMLElement} */ (document.getElementById('rv-listo')).click());
    await espera(p, 1500);
    const tras = await p.evaluate(() => [...document.querySelectorAll('.rv-cambios li')].map(li => /** @type {HTMLElement} */ (li).dataset.cambio).join());
    fila('antes y después: en el focal los puntos llegan sugeridos, se confirman con Revisar y se comparan', pide.n === 3 && pide.sugeridos && pide.res === null && /vez pasada/.test(pide.nota || '') && pide.listo && !pide.cmp && tras === 'igual,igual',
      `${JSON.stringify(pide)} → ${tras}`);

    /* 11. Ronda: las revisiones de hoy del área. Las dos que se volvieron a revisar dejan de contar. */
    await espera(p, 1800);
    const rd = await p.evaluate(() => {
      const r = /** @type {any} */ (window).__revision.rondaElegida().x;
      return {
        revisiones: r.revisiones, exhibiciones: r.exhibiciones.length, corregidas: r.corregidas, indice: r.indice, pendientes: r.pendientes.length,
        tarjeta: /** @type {HTMLElement} */ (document.querySelector('#rv-ronda .rv-ronda-indice b')).textContent,
        visible: !(/** @type {HTMLElement} */ (document.getElementById('rv-ronda'))).hidden,
        linea: /** @type {HTMLElement} */ (document.getElementById('rv-ronda-linea')).textContent,
      };
    });
    const pct = rd.indice === null ? '—' : `${Math.round(rd.indice * 100)} %`;
    fila('ronda: 4 revisiones del área, 2 vigentes (las otras se volvieron a revisar), con su índice', rd.visible && rd.revisiones === 2 && rd.exhibiciones === 2 && rd.corregidas === 2 && rd.tarjeta === pct && rd.linea.startsWith('Ronda de hoy en Caballeros · mesa 1: 2 exhibiciones · índice ' + pct),
      JSON.stringify(rd));
    const img = await p.evaluate(async () => { const r = await /** @type {any} */ (window).__revision.imagenDeRonda(); return r && { w: r.c.width, h: r.c.height }; });
    fila('ronda: el reporte de una página mide 1080 de ancho', img && img.w === 1080 && img.h > 900, JSON.stringify(img));
    if (capturas) {
      const png = await p.evaluate(async () => (await /** @type {any} */ (window).__revision.imagenDeRonda()).c.toDataURL('image/png'));
      fs.writeFileSync(path.join(capturas, `${vista.nombre}-ronda-reporte.png`), Buffer.from(png.split(',')[1], 'base64'));
    }
    await p.evaluate(() => /** @type {HTMLElement} */ (document.querySelector('[data-compartir-ronda]')).click());
    await espera(p, 800);
    await foto('ronda', true);

    /* 8. En el celular nada se sale de lado. */
    if (vista.tactil) {
      const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
      fila('celular: sin desplazamiento de lado (390 px)', ancho <= vista.width, `${ancho} px`);
    }
  } catch (e) {
    fila('el recorrido termina sin tronar', false, /** @type {any} */ (e)?.message || e);
  } finally {
    fila('sin errores de la página', !errores.length, errores.join(' | '));
    await ctx.close();
  }
}
await b.close(); srv.close();
const malas = filas.filter(f => !f.ok);
for (const f of filas) console.log(`${f.ok ? '✓' : '✗'} [${f.vista}] ${f.q}${f.ok ? '' : ` — ${f.detalle}`}`);
console.log(`${filas.length - malas.length}/${filas.length} en verde`);
process.exit(malas.length ? 1 : 0);
