// Asistente de Piso · Copyright (c) 2026 Gerardo Barrera.
// Licencia PolyForm Noncommercial 1.0.0: uso comercial solo con licencia escrita (LICENCIA-COMERCIAL.md).
//
// Revisar (ADR 0007): el reporte de una ronda de departamento, en una página
// de 1080 px que se lee sola en WhatsApp: el índice de exhibición, las fotos
// de la ronda con su nivel y lo pendiente. Lo calcula `ronda` (registro.js).

import { porcentaje, cuando } from './registro.js';
import { COLOR_NIVEL, NOMBRE_TIPO } from './comun.js';
import { renglones, BASICO } from './reporte.js';
import { redondo } from './dibujo.js';

/** @typedef {ReturnType<typeof import('./registro.js').ronda>} Ronda */

const SEMANA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
/** @param {number} ms */
export const fechaLarga = ms => { const d = new Date(ms); return `${SEMANA[d.getDay()]} ${d.getDate()} ${MES[d.getMonth()]} ${d.getFullYear()}`; };
/** @param {number} ms */
const hora = ms => cuando(ms).split(' · ')[1];

/** El color del índice: verde desde 85 %, ámbar desde 60 %, rojo abajo. @param {number|null} i */
export const colorIndice = i => (i === null ? COLOR_NIVEL.NO_CALIFICA : i >= 0.85 ? COLOR_NIVEL.CUMPLE : i >= 0.6 ? COLOR_NIVEL['OBSERVACIÓN'] : COLOR_NIVEL.GRAVE);

/** Qué es una exhibición pendiente, en corto. @param {Ronda['pendientes'][number]} p */
export const nombrePendiente = p => `${hora(p.creada)} · ${NOMBRE_TIPO[/** @type {'focal'} */ (p.tipo)] || p.tipo}${p.zonas > 1 ? ` (zona ${p.zona + 1})` : ''} · ${BASICO[/** @type {'surtido'} */ (p.basico)] || p.basico}`;

/** @param {Ronda} x */
export function cuentaEnPalabras(x) {
  const c = x.cuenta, partes = [];
  if (c.CUMPLE) partes.push(`${c.CUMPLE} ${c.CUMPLE === 1 ? 'cumple' : 'cumplen'}`);
  if (c['OBSERVACIÓN']) partes.push(`${c['OBSERVACIÓN']} en observación`);
  if (c.GRAVE) partes.push(`${c.GRAVE} ${c.GRAVE === 1 ? 'grave' : 'graves'}`);
  if (c.NO_CALIFICA) partes.push(`${c.NO_CALIFICA} sin calificar`);
  if (c.PENDIENTE) partes.push(`${c.PENDIENTE} sin revisar`);
  return partes.join(' · ');
}

/** El texto que acompaña la imagen. @param {Ronda} x */
export function textoDeRonda(x) {
  const l = [`Ronda de exhibición · ${x.area || 'Sin área'} · ${fechaLarga(x.dia)}`];
  l.push(`Índice de exhibición: ${porcentaje(x.indice)} (${x.exhibiciones.length} ${x.exhibiciones.length === 1 ? 'exhibición' : 'exhibiciones'} en ${x.revisiones} ${x.revisiones === 1 ? 'foto' : 'fotos'})`);
  l.push(cuentaEnPalabras(x));
  if (x.corregidas) l.push(`${x.corregidas} ${x.corregidas === 1 ? 'se volvió a revisar' : 'se volvieron a revisar'} en la ronda.`);
  if (x.pendientes.length) {
    l.push('Pendientes:');
    for (const p of x.pendientes) l.push(`- ${nombrePendiente(p)}: ${p.nivel}. ${p.motivo}`);
  } else l.push('Sin pendientes.');
  l.push('Índice: CUMPLE 1 · OBSERVACIÓN ½ · GRAVE 0; lo que no calificó no cuenta. Medido por código en el teléfono; nada se subió.');
  return l.join('\n');
}

/**
 * La página de la ronda.
 * @param {Ronda} x @param {{creada:number, nivel:string|null, zonas:number, mini:ImageBitmap|null}[]} fotos en el orden de la ronda
 */
export function reporteDeRonda(x, fotos) {
  const ANCHO = 1080, M = 48, GAP = 18, COL = 3;
  const F = {
    titulo: '700 40px Geist, system-ui, sans-serif', sub: '500 26px Geist, system-ui, sans-serif',
    indice: '700 132px Geist, system-ui, sans-serif', seccion: '700 30px Geist, system-ui, sans-serif',
    texto: '500 27px Geist, system-ui, sans-serif', chica: '500 23px Geist, system-ui, sans-serif',
    mono: '700 22px "Geist Mono", ui-monospace, monospace',
  };
  const anchoFoto = (ANCHO - 2 * M - (COL - 1) * GAP) / COL, altoFoto = Math.round(anchoFoto * 3 / 4), altoCelda = altoFoto + 46;
  const filasFotos = Math.ceil(fotos.length / COL);
  const pend = x.pendientes.map(p => ({ p, mot: renglones(p.motivo, F.chica, ANCHO - 2 * M - 40) }));
  const pie = renglones('Índice de exhibición: CUMPLE 1 · OBSERVACIÓN ½ · GRAVE 0; lo que no calificó no cuenta. Medido por código en el teléfono; nada se subió.', F.chica, ANCHO - 2 * M);
  const alto = 40 + 110 + 220 + (filasFotos ? 56 + filasFotos * (altoCelda + GAP) : 0)
    + 56 + (pend.length ? pend.reduce((s, q) => s + 44 + q.mot.length * 32 + 14, 0) : 40) + 24 + pie.length * 32 + 40;
  const c = document.createElement('canvas');
  c.width = ANCHO; c.height = alto;
  const ctx = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  ctx.fillStyle = '#111217'; ctx.fillRect(0, 0, ANCHO, alto);
  const ci = colorIndice(x.indice);
  ctx.fillStyle = ci; ctx.fillRect(0, 0, ANCHO, 10);
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  let y = 40;
  ctx.font = F.titulo; ctx.fillStyle = '#F4F2F0'; ctx.fillText('Ronda de exhibición', M, y);
  ctx.font = F.sub; ctx.fillStyle = '#9A97A2'; ctx.fillText(`${x.area || 'Sin área'} · ${fechaLarga(x.dia)}`, M, y + 54);
  y += 110;
  /* El índice, grande, con su barra. */
  ctx.font = F.indice; ctx.fillStyle = ci; ctx.fillText(porcentaje(x.indice), M, y);
  ctx.font = F.sub; ctx.fillStyle = '#D8D5DE';
  ctx.fillText(`índice de exhibición · ${x.exhibiciones.length} ${x.exhibiciones.length === 1 ? 'exhibición' : 'exhibiciones'} en ${x.revisiones} ${x.revisiones === 1 ? 'foto' : 'fotos'}`, M, y + 140);
  ctx.fillStyle = '#9A97A2'; ctx.fillText(cuentaEnPalabras(x) + (x.corregidas ? ` · ${x.corregidas} vuelta${x.corregidas === 1 ? '' : 's'} a revisar` : ''), M, y + 178);
  redondo(ctx, ANCHO - M - 300, y + 54, 300, 18, 9); ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fill();
  if (x.indice !== null) { redondo(ctx, ANCHO - M - 300, y + 54, Math.max(18, 300 * x.indice), 18, 9); ctx.fillStyle = ci; ctx.fill(); }
  y += 220;
  /* Las fotos de la ronda. */
  if (fotos.length) {
    ctx.font = F.seccion; ctx.fillStyle = '#F4F2F0'; ctx.fillText('Fotos', M, y); y += 56;
    fotos.forEach((f, i) => {
      const cx = M + (i % COL) * (anchoFoto + GAP), cy = y + Math.floor(i / COL) * (altoCelda + GAP);
      const color = COLOR_NIVEL[/** @type {'CUMPLE'} */ (f.nivel || 'NO_CALIFICA')] || '#fff';
      ctx.save(); redondo(ctx, cx, cy, anchoFoto, altoFoto, 16); ctx.clip();
      ctx.fillStyle = '#07080A'; ctx.fillRect(cx, cy, anchoFoto, altoFoto);
      if (f.mini) {
        const k = Math.max(anchoFoto / f.mini.width, altoFoto / f.mini.height), w = f.mini.width * k, h = f.mini.height * k;
        ctx.drawImage(f.mini, cx + (anchoFoto - w) / 2, cy + (altoFoto - h) / 2, w, h);
      }
      ctx.restore();
      redondo(ctx, cx, cy, anchoFoto, altoFoto, 16); ctx.lineWidth = 5; ctx.strokeStyle = color; ctx.stroke();
      ctx.font = F.mono; ctx.fillStyle = color; ctx.fillText((f.nivel || 'SIN REVISAR').replace('_', ' '), cx, cy + altoFoto + 12);
      ctx.font = F.chica; ctx.fillStyle = '#9A97A2'; ctx.textAlign = 'right';
      ctx.fillText(`${hora(f.creada)}${f.zonas > 1 ? ` · ${f.zonas} zonas` : ''}`, cx + anchoFoto, cy + altoFoto + 12);
      ctx.textAlign = 'left';
    });
    y += filasFotos * (altoCelda + GAP);
  }
  /* Lo pendiente. */
  ctx.font = F.seccion; ctx.fillStyle = '#F4F2F0';
  ctx.fillText(pend.length ? `Pendientes (${pend.length})` : 'Sin pendientes', M, y); y += 56;
  for (const { p, mot } of pend) {
    const color = COLOR_NIVEL[/** @type {'GRAVE'} */ (p.nivel)];
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(M + 9, y + 15, 9, 0, Math.PI * 2); ctx.fill();
    ctx.font = F.texto; ctx.fillStyle = '#F4F2F0'; ctx.fillText(`${nombrePendiente(p)} · ${p.nivel}`, M + 40, y);
    ctx.font = F.chica; ctx.fillStyle = '#B7B3BF';
    mot.forEach((t, k) => ctx.fillText(t, M + 40, y + 44 + k * 32));
    y += 44 + mot.length * 32 + 14;
  }
  y += 24;
  ctx.font = F.chica; ctx.fillStyle = '#8F8C98';
  pie.forEach((t, k) => ctx.fillText(t, M, y + k * 32));
  return c;
}
