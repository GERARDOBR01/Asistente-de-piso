// Asistente de Piso · Copyright (c) 2026 Gerardo Barrera.
// Licencia PolyForm Noncommercial 1.0.0: uso comercial solo con licencia escrita (LICENCIA-COMERCIAL.md).
//
// Revisar (ADR 0007): lo que se dibuja sobre la foto. Las zonas, los tramos de
// color, las celdas del surtido, los puntos del focal, la lupa y la búsqueda de
// «Sugerir». Solo lee el estado: no mide ni decide nada.

import { peor } from './veredicto.js';
import { NOMBRE_GRUPO } from './color.js';
import { REGLA_TRIANGULO } from './triangulo.js';
import { NOMBRE_TIPO, COLOR_NIVEL, $, st, ease } from './comun.js';

/** @typedef {import('./veredicto.js').Resultado} Resultado */
/** @typedef {import('./comun.js').PuntoFocal} PuntoFocal */
/** @typedef {import('./zonas.js').Zona} Zona */

/* Mientras haya algo en curso (la búsqueda o una silueta pendiente) se
   redibuja: la línea que barre y el anillo que gira. */
export function girar() {
  if (st.girando) return;
  st.girando = true;
  const paso = () => {
    const pendiente = st.buscando || st.zonas.some(z => /** @type {PuntoFocal[]} */ (z.puntos).some(p => p.pendiente));
    if (!pendiente || !st.foto) { st.girando = false; dibujar(1); return; }
    dibujar(1);
    requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

/* ── Dibujo sobre la foto ───────────────────────────────────────────────── */

/** @param {number} ms */
export function animar(ms) {
  const t0 = performance.now(), id = ++st.anim;
  const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const paso = (/** @type {number} */ t) => {
    if (id !== st.anim) return;
    const p = reducido ? 1 : Math.min(1, (t - t0) / ms);
    dibujar(p);
    if (p < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

/** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} w @param {number} h @param {number} r */
export function redondo(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
}

/** Etiqueta tipo píldora. @param {CanvasRenderingContext2D} ctx @param {string} txt @param {number} x @param {number} y @param {string} fondo @param {number} u @param {string} [color] */
function pildora(ctx, txt, x, y, fondo, u, color = '#fff') {
  ctx.font = `600 ${Math.round(12.5 * u)}px Geist, system-ui, sans-serif`;
  const w = ctx.measureText(txt).width + 16 * u, h = 22 * u;
  const px = Math.max(4 * u, Math.min(ctx.canvas.width - w - 4 * u, x - w / 2));
  redondo(ctx, px, y - h / 2, w, h, h / 2);
  ctx.fillStyle = fondo; ctx.fill();
  ctx.fillStyle = color; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.fillText(txt, px + 8 * u, y + 0.5 * u);
}

/** @param {number} p progreso de la animación, 0 a 1 */
export function dibujar(p) {
  const f = st.foto;
  if (!f) return;
  const lz = $('rv-lienzo'), ctx = /** @type {CanvasRenderingContext2D} */ (lz.getContext('2d'));
  ctx.clearRect(0, 0, lz.width, lz.height);
  ctx.drawImage(f.base, 0, 0);
  /* u: tamaño de las marcas. Se ven en un teléfono a ~400 px de ancho, así
     que se escalan contra eso y no contra la resolución de la foto. */
  const k = lz.width / f.img.width, u = lz.width / 400, e = ease(p);
  const varias = st.zonas.length > 1 || st.zonas.some(z => !z.guia) || st.modo === 'ajustar';
  const za = st.modo === 'ajustar' && st.activa >= 0 ? st.zonas[st.activa] : null;
  if (za) sombraFuera(ctx, za.marco);
  st.zonas.forEach((z, i) => {
    /* Solo la zona activa se anima; las demás ya están dibujadas. */
    const ez = i === st.activa ? e : 1, pz = i === st.activa ? p : 1;
    if (z.tipo === 'focal') dibujarFocal(ctx, k, u, ez, z);
    if (st.buscando && i === st.activa) dibujarBusqueda(ctx, z, u);
    for (const r of z.res || []) {
      if (!r.marcas) continue;
      if (r.basico === 'colorizacion') dibujarColor(ctx, r, k, u, ez, pz);
      else if (r.basico === 'surtido') dibujarSurtido(ctx, r, k, u, ez);
    }
    if (varias) dibujarMarcoZona(ctx, z, i, u);
  });
  if (za) dibujarAsas(ctx, za.marco, u);
  if (st.trazo) {
    const t = st.trazo;
    ctx.setLineDash([8 * u, 6 * u]); ctx.lineWidth = 2.4 * u; ctx.strokeStyle = '#fff';
    ctx.fillStyle = 'rgba(255,255,255,.12)';
    const x = Math.min(t.x0, t.x1) * k, y = Math.min(t.y0, t.y1) * k, w = Math.abs(t.x1 - t.x0) * k, h = Math.abs(t.y1 - t.y0) * k;
    ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h); ctx.setLineDash([]);
    pildora(ctx, NOMBRE_TIPO[st.tipo], x + w / 2, Math.max(14 * u, y - 14 * u), '#16171B', u);
  }
  if (st.lupa) dibujarLupa(ctx, f, k, u, st.lupa);
}

/**
 * La lupa: un círculo arriba del dedo con la foto ampliada 2.5 veces y una
 * cruz en el punto. El dedo tapa justo lo que hay que ver; la lupa no.
 * @param {CanvasRenderingContext2D} ctx @param {NonNullable<typeof st.foto>} f @param {number} k @param {number} u @param {{x:number,y:number}} q
 */
function dibujarLupa(ctx, f, k, u, q) {
  const W = ctx.canvas.width, R = 56 * u, zoom = 2.5;
  const px = q.x * k, py = q.y * k;
  const cx = Math.min(W - R - 4 * u, Math.max(R + 4 * u, px)), cy = py - R - 46 * u > R ? py - R - 46 * u : py + R + 46 * u;
  const lado = (2 * R) / zoom;
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.closePath();
  ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 14 * u; ctx.fillStyle = '#000'; ctx.fill();
  ctx.shadowBlur = 0; ctx.clip();
  ctx.drawImage(f.base, px - lado / 2, py - lado / 2, lado, lado, cx - R, cy - R, 2 * R, 2 * R);
  ctx.strokeStyle = 'rgba(255,92,99,.95)'; ctx.lineWidth = 1.6 * u;
  ctx.beginPath(); ctx.moveTo(cx - 12 * u, cy); ctx.lineTo(cx + 12 * u, cy); ctx.moveTo(cx, cy - 12 * u); ctx.lineTo(cx, cy + 12 * u); ctx.stroke();
  ctx.restore();
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.lineWidth = 2.4 * u; ctx.strokeStyle = '#fff'; ctx.stroke();
}

/**
 * Mientras «Sugerir» busca: la zona se oscurece un poco y una línea la barre
 * de arriba abajo. Con menos movimiento pedido, la línea se queda quieta.
 * @param {CanvasRenderingContext2D} ctx @param {Zona} z @param {number} u
 */
function dibujarBusqueda(ctx, z, u) {
  const W = ctx.canvas.width, H = ctx.canvas.height, m = z.marco;
  const x = m.x * W, y = m.y * H, w = m.w * W, h = m.h * H;
  ctx.fillStyle = 'rgba(10,12,16,.28)'; ctx.fillRect(x, y, w, h);
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const t = quieto ? 0.5 : (performance.now() % 1600) / 1600;
  const ly = y + t * h;
  const g = ctx.createLinearGradient(0, ly - 40 * u, 0, ly);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,.35)');
  ctx.fillStyle = g; ctx.fillRect(x, Math.max(y, ly - 40 * u), w, Math.min(40 * u, ly - y));
  ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.fillRect(x, ly - 1 * u, w, 2 * u);
  /* Lo que va encontrando, uno por uno: caja suave, nombre y confianza. */
  const k = W / /** @type {NonNullable<typeof st.foto>} */ (st.foto).img.width;
  for (const c of st.cajasVistas) {
    ctx.lineWidth = 2 * u; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.fillStyle = 'rgba(255,255,255,.08)';
    redondo(ctx, c.x * k, c.y * k, c.w * k, c.h * k, 10 * u); ctx.fill(); ctx.stroke();
    pildora(ctx, `${NOMBRE_DETECTADO[c.categoria] || c.categoria} · ${Math.round(c.score * 100)} %`, c.x * k + c.w * k / 2, c.y * k + 14 * u, 'rgba(22,23,27,.85)', u);
  }
  pildora(ctx, st.cajasVistas.length ? `Encontrando… ${st.cajasVistas.length}` : 'Buscando elementos…', x + w / 2, Math.max(16 * u, y + 18 * u), '#16171B', u);
}

/** Cómo se dice en el piso lo que ve el detector (COCO). */
const NOMBRE_DETECTADO = /** @type {Record<string, string>} */ ({ person: 'maniquí', handbag: 'bolsa', suitcase: 'bolsa', backpack: 'mochila', 'potted plant': 'planta', vase: 'jarrón', bottle: 'botella', tie: 'corbata', umbrella: 'paraguas', 'teddy bear': 'peluche' });

/** El recuadro de una zona con su número, básico y nivel. @param {CanvasRenderingContext2D} ctx @param {Zona} z @param {number} i @param {number} u */
function dibujarMarcoZona(ctx, z, i, u) {
  const W = ctx.canvas.width, H = ctx.canvas.height, m = z.marco;
  const n = z.res && z.res.length ? peor(z.res.map(r => r.nivel)) : null;
  const color = n ? COLOR_NIVEL[/** @type {'CUMPLE'} */ (n)] : '#FFFFFF';
  ctx.lineWidth = (i === st.activa ? 2.6 : 1.8) * u; ctx.strokeStyle = color;
  redondo(ctx, m.x * W, m.y * H, m.w * W, m.h * H, 8 * u); ctx.stroke();
  const txt = `${i + 1} · ${NOMBRE_TIPO[z.tipo]}${n ? ' · ' + n : ''}`;
  ctx.font = `600 ${Math.round(12.5 * u)}px Geist, system-ui, sans-serif`;
  const ancho = ctx.measureText(txt).width + 16 * u;
  const y = m.y * H > 26 * u ? m.y * H - 14 * u : m.y * H + 14 * u;
  pildora(ctx, txt, m.x * W + ancho / 2, y, n ? color : '#16171B', u, n === 'OBSERVACIÓN' || n === 'CUMPLE' || n === 'NO_CALIFICA' ? '#16171B' : '#fff');
}

/**
 * Al ajustar, lo de afuera de la zona se oscurece un poco para ver qué entra.
 * Va antes de las marcas y las etiquetas, que se siguen leyendo.
 * @param {CanvasRenderingContext2D} ctx @param {{x:number,y:number,w:number,h:number}} m
 */
function sombraFuera(ctx, m) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.fillStyle = 'rgba(0,0,0,.32)';
  ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.rect(m.x * W, m.y * H, m.w * W, m.h * H); ctx.fill('evenodd');
}

/**
 * La zona que se ajusta: borde punteado y una esquina redonda en cada vértice,
 * del tamaño de un dedo.
 * @param {CanvasRenderingContext2D} ctx @param {{x:number,y:number,w:number,h:number}} m @param {number} u
 */
function dibujarAsas(ctx, m, u) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const x = m.x * W, y = m.y * H, w = m.w * W, h = m.h * H;
  ctx.setLineDash([7 * u, 5 * u]); ctx.lineWidth = 2 * u; ctx.strokeStyle = '#fff';
  ctx.strokeRect(x, y, w, h); ctx.setLineDash([]);
  for (const [cx, cy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    ctx.beginPath(); ctx.arc(x + cx * w, y + cy * h, 7.5 * u, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.lineWidth = 2.2 * u; ctx.strokeStyle = '#16171B'; ctx.stroke();
  }
}

/** @param {CanvasRenderingContext2D} ctx @param {Resultado} r @param {number} k @param {number} u @param {number} e @param {number} p */
function dibujarColor(ctx, r, k, u, e, p) {
  const { franja, tramos, marco } = r.marcas;
  if (!franja) return;
  const y0 = franja.y * k, y1 = (franja.y + franja.h) * k;
  /* Lo que no se mide, apagado, dentro de la zona. */
  const zx = (marco ? marco.x : franja.x) * k, zw = (marco ? marco.w : franja.w) * k;
  const zy0 = marco ? marco.y * k : 0, zy1 = marco ? (marco.y + marco.h) * k : ctx.canvas.height;
  ctx.fillStyle = `rgba(0,0,0,${0.42 * e})`;
  ctx.fillRect(zx, zy0, zw, Math.max(0, y0 - zy0)); ctx.fillRect(zx, y1, zw, Math.max(0, zy1 - y1));
  ctx.setLineDash([7 * u, 6 * u]); ctx.lineWidth = 1.6 * u; ctx.strokeStyle = 'rgba(255,255,255,.85)';
  ctx.strokeRect(franja.x * k, y0, franja.w * k, y1 - y0);
  ctx.setLineDash([]);
  if (!tramos) return;
  const n = tramos.length, visibles = Math.ceil(e * n);
  const by = y1 + 8 * u, bh = 16 * u;
  tramos.slice(0, visibles).forEach((/** @type {any} */ t, /** @type {number} */ i) => {
    const x0 = t.x0 * k + 1.5 * u, x1 = t.x1 * k - 1.5 * u;
    redondo(ctx, x0, by, Math.max(2, x1 - x0), bh, 5 * u);
    ctx.fillStyle = t.rgb; ctx.fill();
    ctx.lineWidth = 1.5 * u; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.95)';
    ctx.font = `700 ${Math.round(10 * u)}px Geist Mono, ui-monospace, monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    /* Un color dudoso lleva «?»: el código no lo da por seguro. */
    if (x1 - x0 > 14 * u) ctx.fillText(NOMBRE_GRUPO[/** @type {'calido'} */ (t.grupo)][0].toUpperCase() + (t.dudoso ? '?' : ''), (x0 + x1) / 2, by + bh + 4 * u);
    if (t.fueraGrupo || t.fueraRueda) {
      const grave = t.fueraGrupo && !t.dudoso, pulso = p < 1 ? 1 + 0.6 * Math.sin(p * Math.PI * 4) ** 2 : 1;
      ctx.lineWidth = (grave ? 3.2 : 2.4) * u * pulso;
      ctx.strokeStyle = grave ? COLOR_NIVEL.GRAVE : COLOR_NIVEL['OBSERVACIÓN'];
      if (!grave) ctx.setLineDash([6 * u, 4 * u]);
      redondo(ctx, x0 - 3 * u, y0 - 6 * u, x1 - x0 + 6 * u, by + bh - y0 + 10 * u, 8 * u);
      ctx.stroke(); ctx.setLineDash([]);
      pildora(ctx, `tramo ${i + 1} · ${t.dudoso ? `¿${NOMBRE_GRUPO[/** @type {'calido'} */ (t.grupo)]}?` : NOMBRE_GRUPO[/** @type {'calido'} */ (t.grupo)]}`, (x0 + x1) / 2, y0 - 20 * u, grave ? COLOR_NIVEL.GRAVE : COLOR_NIVEL['OBSERVACIÓN'], u, grave ? '#fff' : '#2A1A00');
    }
  });
}

/** @param {CanvasRenderingContext2D} ctx @param {Resultado} r @param {number} k @param {number} u @param {number} e */
function dibujarSurtido(ctx, r, k, u, e) {
  const { marco, huecos } = r.marcas;
  ctx.setLineDash([7 * u, 6 * u]); ctx.lineWidth = 1.4 * u; ctx.strokeStyle = 'rgba(255,255,255,.7)';
  ctx.strokeRect(marco.x * k, marco.y * k, marco.w * k, marco.h * k);
  ctx.setLineDash([]);
  if (!huecos) return;
  for (const h of huecos) {
    const llave = new Set(h.map((/** @type {any} */ c) => `${c.x},${c.y}`));
    for (const c of h) {
      const x = c.x * k, y = c.y * k, w = c.w * k, hh = c.h * k;
      ctx.fillStyle = `rgba(255,77,94,${0.34 * e})`;
      ctx.fillRect(x, y, w, hh);
      /* Rayado, para que se lea aunque el mueble sea rojo. */
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, hh); ctx.clip();
      ctx.strokeStyle = `rgba(255,255,255,${0.35 * e})`; ctx.lineWidth = 1.2 * u;
      for (let d = -hh; d < w; d += 9 * u) { ctx.beginPath(); ctx.moveTo(x + d, y + hh); ctx.lineTo(x + d + hh, y); ctx.stroke(); }
      ctx.restore();
      /* El contorno del hueco: solo los bordes que no comparte con otra celda. */
      ctx.strokeStyle = COLOR_NIVEL.GRAVE; ctx.lineWidth = 2.6 * u;
      const lado = (/** @type {number} */ x0, /** @type {number} */ y0, /** @type {number} */ x1, /** @type {number} */ y1) => { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + (x1 - x0) * e, y0 + (y1 - y0) * e); ctx.stroke(); };
      const hay = (/** @type {number} */ dx, /** @type {number} */ dy) => [...llave].some(s => { const [a, b] = s.split(',').map(Number); return Math.abs(a - (c.x + dx * c.w)) <= 2 && Math.abs(b - (c.y + dy * c.h)) <= 2; });
      if (!hay(0, -1)) lado(x, y, x + w, y);
      if (!hay(0, 1)) lado(x, y + hh, x + w, y + hh);
      if (!hay(-1, 0)) lado(x, y, x, y + hh);
      if (!hay(1, 0)) lado(x + w, y, x + w, y + hh);
    }
  }
  if (huecos.length && e > 0.6) {
    const h = huecos[0], cx = h.reduce((/** @type {number} */ s, /** @type {any} */ c) => s + c.x + c.w / 2, 0) / h.length * k;
    const cy = Math.min(...h.map((/** @type {any} */ c) => c.y)) * k;
    pildora(ctx, `hueco · ${r.evidencia.hueco_mayor_pct} %`, cx, Math.max(14 * u, cy - 14 * u), COLOR_NIVEL.GRAVE, u);
  }
}

/** @param {CanvasRenderingContext2D} ctx @param {number} k @param {number} u @param {number} e @param {Zona} z */
function dibujarFocal(ctx, k, u, e, z) {
  const r = z.res ? z.res.find(x => x.basico === 'triangulacion') : null;
  const tri = r?.marcas?.triangulo;
  if (tri) {
    /** @type {{x: number, y: number}[]} */
    const pts = tri.map((/** @type {any} */ q) => ({ x: q.x * k, y: q.y * k }));
    const largo = pts.reduce((s, q, i) => s + Math.hypot(q.x - pts[(i + 1) % 3].x, q.y - pts[(i + 1) % 3].y), 0);
    ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.closePath();
    ctx.fillStyle = `rgba(229,51,58,${0.16 * e})`; ctx.fill();
    ctx.setLineDash([largo * e, largo]); ctx.lineWidth = 3 * u;
    ctx.strokeStyle = COLOR_NIVEL[/** @type {'CUMPLE'} */ (r.nivel)] || '#fff'; ctx.stroke();
    ctx.setLineDash([]);
  } else if (r?.marcas?.puntos && r.nivel !== 'NO_CALIFICA') {
    /* Sin triángulo: la línea de las alturas, para que se vea por qué. */
    const ps = r.marcas.puntos;
    ctx.beginPath(); ps.forEach((/** @type {any} */ q, /** @type {number} */ i) => (i ? ctx.lineTo(q.x * k, q.y * k) : ctx.moveTo(q.x * k, q.y * k)));
    ctx.setLineDash([8 * u, 6 * u]); ctx.lineWidth = 2.6 * u; ctx.strokeStyle = COLOR_NIVEL[/** @type {'GRAVE'} */ (r.nivel)]; ctx.globalAlpha = e; ctx.stroke(); ctx.globalAlpha = 1; ctx.setLineDash([]);
  }
  /* Las alturas que se midieron (Alturas y niveles): una banda por nivel, de
     lado a lado de la zona, con su nombre. Se calculaban y no se veían. */
  const rn = z.res ? z.res.find(x => x.basico === 'niveles') : null;
  if (rn?.marcas?.niveles?.length && rn.nivel !== 'NO_CALIFICA' && e > 0.2) {
    const W = ctx.canvas.width, m = z.marco;
    const ys = rn.marcas.niveles.slice().sort((/** @type {number} */ a, /** @type {number} */ b) => a - b);
    const nombre = (/** @type {number} */ i) => ys.length === 1 ? 'una altura' : i === 0 ? 'alto' : i === ys.length - 1 ? 'bajo' : 'medio';
    ctx.save(); ctx.globalAlpha = Math.min(1, e * 1.2);
    ys.forEach((/** @type {number} */ y, /** @type {number} */ i) => {
      const yy = y * k, x0 = m.x * W, x1 = (m.x + m.w) * W;
      ctx.setLineDash([10 * u, 7 * u]); ctx.lineWidth = 1.6 * u; ctx.strokeStyle = 'rgba(255,255,255,.75)';
      ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x1, yy); ctx.stroke(); ctx.setLineDash([]);
      pildora(ctx, nombre(i), x1 - 34 * u, yy, 'rgba(22,23,27,.82)', u);
    });
    ctx.restore();
  }
  /* Empate arriba: una flecha señala cuál subir (el del centro del empate). */
  if (r?.nivel === 'OBSERVACIÓN' && r.marcas?.cima && Number(r.evidencia?.empatan_arriba) > 0 && e > 0.6) {
    const tol = REGLA_TRIANGULO.tolerancia * /** @type {NonNullable<typeof st.foto>} */ (st.foto).img.height;
    const arriba = r.marcas.puntos.filter((/** @type {any} */ q) => q.y - r.marcas.cima.y < tol);
    const centro = arriba.reduce((/** @type {number} */ s, /** @type {any} */ q) => s + q.x, 0) / arriba.length;
    const q = arriba.reduce((/** @type {any} */ a, /** @type {any} */ b) => Math.abs(b.x - centro) < Math.abs(a.x - centro) ? b : a);
    const x = q.x * k, y = q.y * k - 16 * u;
    ctx.strokeStyle = COLOR_NIVEL['OBSERVACIÓN']; ctx.fillStyle = COLOR_NIVEL['OBSERVACIÓN']; ctx.lineWidth = 3 * u;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 34 * u); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 8 * u, y - 30 * u); ctx.lineTo(x, y - 42 * u); ctx.lineTo(x + 8 * u, y - 30 * u); ctx.closePath(); ctx.fill();
    pildora(ctx, 'sube este', x, Math.max(14 * u, y - 56 * u), '#16171B', u);
  }
  /* El número de cada punto es su orden de toque y no cambia al revisar: el
     aviso «se juntó con el 2» tiene que señalar el mismo punto que se ve. */
  const ps = z.puntos.length ? z.puntos : (r?.marcas?.puntos || []);
  /* Mientras se tocan: la silueta de cada elemento (su caja) y de dónde se tocó a su cima. */
  if (st.modo === 'tocar') for (const q of /** @type {PuntoFocal[]} */ (z.puntos)) {
    if (!q.caja || !q.toque) continue;
    const W = ctx.canvas.width, H = ctx.canvas.height;
    /* La silueta con un brillo en su contorno: se ve qué agarró el toque. */
    if (q.capa) { ctx.save(); ctx.shadowColor = 'rgba(255,196,61,.9)'; ctx.shadowBlur = 12 * u; ctx.drawImage(q.capa, 0, 0, W, H); ctx.restore(); }
    ctx.setLineDash([5 * u, 4 * u]); ctx.lineWidth = 1.4 * u; ctx.strokeStyle = 'rgba(255,255,255,.6)';
    ctx.beginPath(); ctx.moveTo(q.toque.x * k, q.toque.y * k); ctx.lineTo(q.x * k, q.y * k); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(q.toque.x * k, q.toque.y * k, 3 * u, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fill();
  }
  ps.forEach((/** @type {any} */ q, /** @type {number} */ i) => {
    const s = Math.min(1, e * ps.length - i * 0.6);
    if (s <= 0) return;
    const x = q.x * k, y = q.y * k, rad = 8 * u * (0.6 + 0.4 * s);
    ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill();
    /* Sugerido: borde punteado hasta que la persona lo revise. */
    if (q.sugerido && st.modo === 'tocar') ctx.setLineDash([3 * u, 2.5 * u]);
    ctx.lineWidth = 2.4 * u; ctx.strokeStyle = "#FF5C63"; ctx.stroke();
    ctx.setLineDash([]);
    /* Silueta en camino: un anillo que gira alrededor del punto. */
    if (q.pendiente) {
      const a0 = (performance.now() / 160) % (Math.PI * 2);
      ctx.beginPath(); ctx.arc(x, y, rad + 5 * u, a0, a0 + Math.PI * 1.3);
      ctx.lineWidth = 2.2 * u; ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.stroke();
    }
    ctx.fillStyle = '#16171B'; ctx.font = `700 ${Math.round(9 * u)}px Geist Mono, ui-monospace, monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(i + 1), x, y + 0.5 * u);
  });
  if (r?.marcas?.cima && r.nivel === 'CUMPLE' && e > 0.7) {
    const cy = r.marcas.cima.y * k;
    pildora(ctx, `cima · ${r.evidencia.forma}`, r.marcas.cima.x * k, cy - 26 * u > 14 * u ? cy - 26 * u : cy + 26 * u, '#16171B', u);
  }
}
