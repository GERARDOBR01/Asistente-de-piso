// Genera los manuales FICTICIOS del corpus público (HTML → PDF).
//
// Todo es inventado: el cliente (Mercadep), las secciones, las marcas, las
// medidas y los porcentajes. Imitan cómo vienen los manuales de verdad
// —presentaciones, dos columnas por lámina— y traen a propósito las trampas
// que el benchmark encontró en ellos:
//   · títulos de dos renglones
//   · tablas
//   · check lists que repiten las reglas de otras láminas
//   · láminas que solo son rótulo (una lista de marcas)
//   · el dato en un fragmento hermano, sin las palabras de la pregunta
//   · el mismo vocabulario en secciones distintas, con cifras distintas
//
// Uso:
//   node eval/corpus-publico/generar.mjs           (HTML y PDF)
//   node eval/corpus-publico/generar.mjs --html    (solo HTML)
//
// El PDF lo imprime Chromium vía Playwright (mismas variables que el arnés:
// PLAYWRIGHT_CORE, CANAL, CHROMIUM). El cuarto manual del corpus es el demo
// de siempre (docs/manual-demo.pdf); ver manuales.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const CSS = `
@page{size:1280px 720px;margin:0}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:"DejaVu Sans",Arial,sans-serif;color:#1d1d1f}
.lam{width:1280px;height:720px;position:relative;page-break-after:always;overflow:hidden;background:#fff}
.lam:last-child{page-break-after:auto}
.franja{position:absolute;top:0;left:0;right:0;height:64px;background:#e6ecef}
.nombre{position:absolute;top:22px;left:48px;font-size:20px;color:#2f4b5c}
.col{position:absolute;top:110px;width:520px}
.c1{left:48px}.c2{left:660px}
.ancha{width:1100px}
h2{font-size:24px;letter-spacing:1px;margin-bottom:12px}
p{font-size:17px;line-height:1.5;margin-bottom:10px}
table{border-collapse:collapse;font-size:17px;margin-top:6px}
th,td{border:2px solid #2f4b5c;padding:10px 18px;text-align:left}
th{background:#e6ecef}
.check li{font-size:19px;line-height:1.5;margin:0 0 14px 28px}
.rotulo{position:absolute;font-size:22px;letter-spacing:2px;font-weight:bold;color:#2f4b5c}
.suelto{position:absolute;font-size:17px;line-height:1.5}
.portada{background:#1f2a30;color:#e6ecef}
.portada .marca{position:absolute;top:120px;left:96px;font-size:30px;letter-spacing:6px;color:#7fb2c9}
.portada h1{position:absolute;top:220px;left:96px;font-size:72px;letter-spacing:2px}
.portada .sub{position:absolute;top:330px;left:96px;font-size:26px;color:#b9c7cf}
.portada .aviso{position:absolute;bottom:80px;left:96px;font-size:16px;color:#8fa0a8;width:900px;line-height:1.5}
`;

/* Un bloque de columna: título (con <br> si va en dos renglones) y párrafos,
   tabla o lista. */
function bloque(b) {
  let h = b.h ? `<h2>${b.h.split('\n').map(esc).join('<br>')}</h2>` : '';
  for (const p of b.p || []) h += `<p>${esc(p)}</p>`;
  if (b.tabla) {
    const [cab, ...filas] = b.tabla;
    h += '<table><tr>' + cab.map(c => `<th>${esc(c)}</th>`).join('') + '</tr>'
      + filas.map(f => '<tr>' + f.map(c => `<td>${esc(c)}</td>`).join('') + '</tr>').join('') + '</table>';
  }
  if (b.lista) h += '<ul class="check">' + b.lista.map(x => `<li>${esc(x)}</li>`).join('') + '</ul>';
  return h;
}

function lamina(l) {
  let h = `<section class="lam"><div class="franja"></div><div class="nombre">${esc(l.nombre)}</div>`;
  if (l.ancha) h += `<div class="col c1 ancha">${bloque(l.ancha)}</div>`;
  if (l.c1) h += `<div class="col c1">${bloque(l.c1)}</div>`;
  if (l.c2) h += `<div class="col c2">${bloque(l.c2)}</div>`;
  /* Texto suelto en otra zona de la lámina: rótulos de planograma o el dato
     que queda lejos de su título. */
  for (const s of l.sueltos || []) h += `<div class="${s.rotulo ? 'rotulo' : 'suelto'}" style="left:${s.x}px;top:${s.y}px;width:${s.w || 520}px">${esc(s.t)}</div>`;
  return h + '</section>';
}

function manual(m) {
  return `<!DOCTYPE html>
<!-- Manual de campaña FICTICIO del corpus público (eval/corpus-publico).
     Generado por generar.mjs: no se edita a mano. Todo es inventado. -->
<html lang="es"><head><meta charset="utf-8"><title>${esc(m.titulo)} — manual ficticio</title>
<style>${CSS}</style></head><body>
<section class="lam portada">
  <div class="marca">MERCADEP</div>
  <h1>${esc(m.titulo)}</h1>
  <div class="sub">${esc(m.sub)}</div>
  <div class="aviso">Documento ficticio para pruebas públicas. El cliente, la sección, las marcas, las medidas y los porcentajes son inventados y no corresponden a ningún comercio real.</div>
</section>
${m.laminas.map(lamina).join('\n')}
</body></html>
`;
}

/* ── Los manuales ─────────────────────────────────────────────────────────── */
/* La página 1 es la portada: la primera lámina de cada lista es la página 2. */
const MANUALES = [
  {
    archivo: '210-boutique-dama', titulo: '210 BOUTIQUE DAMA', sub: 'Manual de montaje · Campaña Otoño',
    laminas: [
      { nombre: 'Recorrido de la boutique',
        c1: { h: 'ACCESO', p: ['La entrada de la boutique queda libre: 1.20 m sin ningún exhibidor.', 'El tapete de la marca se coloca solo en temporada de lluvias.'] },
        c2: { h: 'ILUMINACIÓN', p: ['Los spots apuntan a la prenda, nunca al pasillo.', 'Los focos fundidos se reportan cada lunes a mantenimiento.'] } },
      { nombre: 'Mundos de la boutique',
        c1: { h: 'MUNDOS', p: ['La boutique se divide en tres mundos: Esencial, Ocasión y Lounge.', 'Esencial ocupa el 50 % del piso, Ocasión el 35 % y Lounge el 15 %.'] },
        sueltos: [
          { rotulo: true, x: 660, y: 130, t: 'ESENCIAL · LIRAE · MORAVIA' },
          { rotulo: true, x: 660, y: 260, t: 'OCASIÓN · SELVANE · ODILE RAU' },
          { rotulo: true, x: 660, y: 390, t: 'LOUNGE · KUMO' },
        ] },
      { nombre: 'Entallado en boutique',
        c1: { h: 'ENTALLADO DE\nVESTIDOS', p: ['3 piezas por talla, de chica a grande: CH, M y G.', 'En vestidos de noche van 2 piezas por talla.'] },
        c2: { h: 'DOBLADO DE PUNTO', p: ['Los suéteres de punto se doblan a 28 x 32 cm y nunca se cuelgan, para que no se deformen.'] } },
      { nombre: 'Maniquíes de boutique',
        c1: { h: 'MANIQUÍES', p: ['Cada maniquí viste un look completo de un solo mundo; no se mezclan mundos en el mismo maniquí.', 'El look se cambia cada 14 días.'] },
        c2: { h: 'PELUCAS Y ARETES', p: ['Las pelucas se peinan hacia atrás.', 'Los aretes van solo en los maniquíes de Ocasión.'] } },
      { nombre: 'Etiquetado por mundo',
        ancha: { h: 'ETIQUETAS POR MUNDO', tabla: [['Mundo', 'Color de etiqueta', 'Dónde va'], ['Esencial', 'blanca', 'manga izquierda'], ['Ocasión', 'negra', 'interior del cuello'], ['Lounge', 'kraft', 'cintura']] } },
      { nombre: 'Apertura',
        ancha: { h: 'CHECK LIST DE APERTURA', lista: ['Spots encendidos y dirigidos a la prenda.', 'Probadores sin ganchos ni prendas olvidadas.', 'Espejos limpios.', 'Música de la boutique en volumen 3.'] } },
      /* El dato (las fechas) queda lejos de su título y sin ninguna palabra de
         la pregunta: es el fragmento hermano. */
      { nombre: 'Shots promocionales',
        c1: { h: 'SHOTS PROMOCIONALES', p: ['Los shots de la campaña se cambian tres veces durante la temporada, siempre antes de abrir.'] },
        sueltos: [{ x: 660, y: 520, w: 560, t: '15 de septiembre · 6 de octubre · 27 de octubre' }] },
      { nombre: 'Probadores',
        c1: { h: 'PROBADORES', p: ['Máximo 4 prendas por clienta en el probador.', 'La asesora entrega una ficha con el número de prendas que lleva.'] },
        c2: { h: 'EMPAQUE', p: ['La compra de Ocasión se entrega en funda de tela.', 'Esencial y Lounge se entregan en bolsa de papel.'] } },
      { nombre: 'Rebajas',
        c1: { h: 'REBAJAS EN BOUTIQUE', p: ['En rebajas, la boutique conserva un solo perchero de descuento, al fondo y nunca al frente.', 'El letrero de descuento va en atril dorado.'] } },
    ],
  },
  {
    archivo: '412-cava-y-destilados', titulo: '412 CAVA Y DESTILADOS', sub: 'Manual de exhibición · Temporada de fiestas',
    laminas: [
      { nombre: 'Acomodo de la cava',
        c1: { h: 'ACOMODO POR PAÍS', p: ['Los vinos se acomodan por país y, dentro de cada país, por uva.', 'Las botellas de vino van acostadas; los destilados, de pie.'] },
        c2: { h: 'TEMPERATURA', p: ['La cava se mantiene entre 14 y 16 °C.', 'El termómetro se revisa al abrir y al cerrar la tienda.'] } },
      { nombre: 'Góndola de destilados',
        ancha: { h: 'ENTREPAÑOS DE DESTILADOS', tabla: [['Entrepaño', 'Qué va'], ['Superior', 'añejos y ediciones premium'], ['Medio', 'tequila blanco y mezcal'], ['Inferior', 'packs y presentaciones de 1.75 L']] } },
      { nombre: 'Precio y etiquetado',
        c1: { h: 'CENEFAS', p: ['La cenefa lleva precio, cosecha y país.', 'Va centrada bajo la botella, nunca de lado.'] },
        c2: { h: 'BOTELLAS ABIERTAS', p: ['Ninguna botella abierta se exhibe; las de degustación se guardan en bodega.'] } },
      { nombre: 'Degustaciones',
        c1: { h: 'DEGUSTACIÓN\nGUIADA', p: ['Las degustaciones son viernes y sábado de 17:00 a 20:00.', 'Se sirven 30 ml por copa y máximo 3 copas por cliente.'] },
        c2: { h: 'CRISTALERÍA', p: ['Copas de cristal, lavadas y secas antes de cada degustación.'] } },
      { nombre: 'Regalos de temporada',
        c1: { h: 'CANASTAS', p: ['Las canastas se arman con 1 vino, 1 destilado y 2 complementos.', 'Se exhiben en la isla de entrada, en tres niveles.'] },
        c2: { h: 'MOÑOS', p: ['Moño rojo para las canastas de vino.', 'Moño dorado para las de destilados.'] } },
      { nombre: 'Cierre',
        ancha: { h: 'CHECK LIST DE CIERRE', lista: ['Temperatura anotada en la bitácora.', 'Vitrina premium cerrada con llave.', 'Entrepaños sin huecos.', 'Luz de la cava apagada.'] } },
      { nombre: 'Marca invitada',
        c1: { h: 'MARCA INVITADA', p: ['Cada mes una casa productora ocupa la cabecera de la cava.'] },
        sueltos: [{ rotulo: true, x: 660, y: 160, t: 'BODEGAS ALTIVA · CASA NERELLO · DESTILERÍA PUMARA' }] },
      { nombre: 'Venta responsable',
        c1: { h: 'IDENTIFICACIÓN', p: ['Se pide identificación a quien aparente menos de 25 años.'] },
        c2: { h: 'SUSPENSIÓN DE VENTA', p: ['La venta de destilados se suspende cuando lo indique el aviso de gerencia.'] } },
    ],
  },
  {
    archivo: '530-hogar-temporada', titulo: '530 HOGAR TEMPORADA', sub: 'Manual de montaje · Fin de año',
    laminas: [
      /* Mismo título que en Casual (MESA DE ENTRADA), con otra altura: la
         pregunta tiene que contestarse desde la sección que toca. */
      { nombre: 'Mesa de entrada de hogar',
        c1: { h: 'MESA DE ENTRADA', p: ['En hogar, la mesa de entrada muestra una mesa puesta completa para 4 personas.', 'Altura máxima de pila: 45 cm.'] },
        c2: { h: 'PROPS', p: ['Velas sin encender; nunca flores naturales.'] } },
      { nombre: 'Blancos',
        c1: { h: 'TOALLAS', p: ['Las toallas se doblan en tercios y se apilan de 6 piezas, con el doblez al frente.'] },
        c2: { h: 'SÁBANAS', p: ['Los juegos de sábanas se exhiben con la caja abierta y una muestra de tela por fuera.'] } },
      { nombre: 'Colorización',
        c1: { h: 'COLORIZACIÓN\nDE BLANCOS', p: ['De claro a oscuro y de izquierda a derecha: blanco, crudo, gris y azul marino.'] },
        c2: { h: 'COLCHAS', p: ['La colcha de la cama de exhibición se cambia cada 21 días.'] } },
      { nombre: 'Medidas de mobiliario',
        ancha: { h: 'MEDIDAS DE MOBILIARIO', tabla: [['Mueble', 'Altura', 'Distancia al siguiente'], ['Isla', '90 cm', '1.10 m'], ['Góndola', '1.60 m', '1.40 m'], ['Mesa nido', '75 cm', '95 cm']] } },
      { nombre: 'Navidad',
        c1: { h: 'ÁRBOL DE NAVIDAD', p: ['El árbol de muestra se arma a partir del 1 de noviembre, con 120 esferas de un solo color.'] },
        c2: { h: 'NACIMIENTOS', p: ['Los nacimientos se exhiben en vitrina, fuera del alcance de los niños.'] } },
      { nombre: 'Revisión semanal',
        ancha: { h: 'CHECK LIST SEMANAL', lista: ['Cama de exhibición tendida.', 'Precios visibles en cada pila.', 'Pilas de toallas de 6 piezas.', 'Sin cajas en el pasillo.'] } },
      { nombre: 'Cocina',
        c1: { h: 'UTENSILIOS', p: ['Los utensilios se cuelgan en la ganchera por familia: madera, acero y silicón.'] },
        c2: { h: 'VAJILLAS', p: ['Una vajilla de 16 piezas se exhibe completa; las demás, con un solo plato de muestra.'] } },
      { nombre: 'Cristalería',
        sueltos: [
          { rotulo: true, x: 48, y: 140, w: 1100, t: 'COPAS · VASOS · JARRAS · DECANTERS' },
          { x: 48, y: 420, w: 1100, t: 'Arriba van las copas, al centro los vasos y abajo las jarras; los decanters, solo en la vitrina.' },
        ] },
    ],
  },
];

/* ── Principal ────────────────────────────────────────────────────────────── */
const soloHtml = process.argv.includes('--html');
for (const m of MANUALES) fs.writeFileSync(path.join(AQUI, m.archivo + '.html'), manual(m));
console.log(`${MANUALES.length} manuales en HTML`);

if (!soloHtml) {
  const intentar = async n => { try { return await import(n); } catch { return null; } };
  const pw = process.env.PLAYWRIGHT_CORE
    ? await import(pathToFileURL(process.env.PLAYWRIGHT_CORE).href)
    : (await intentar('playwright-core')) || (await intentar('playwright'));
  if (!pw) { console.error('Falta Playwright (ver eval/arnes.mjs)'); process.exit(2); }
  const b = await pw.chromium.launch({ executablePath: process.env.CHROMIUM || undefined, channel: process.env.CANAL || undefined });
  const p = await b.newPage();
  for (const m of MANUALES) {
    await p.goto(pathToFileURL(path.join(AQUI, m.archivo + '.html')).href);
    await p.pdf({ path: path.join(AQUI, m.archivo + '.pdf'), width: '1280px', height: '720px', printBackground: true, preferCSSPageSize: true });
    console.log('  ' + m.archivo + '.pdf');
  }
  await b.close();
}
