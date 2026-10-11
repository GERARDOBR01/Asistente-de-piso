// Asistente de Piso · Copyright (c) 2026 Gerardo Barrera.
// Licencia PolyForm Noncommercial 1.0.0: uso comercial solo con licencia escrita (LICENCIA-COMERCIAL.md).
//
// El tablero, la parte pura: el resumen de lo que pregunta el equipo (qué
// encontró, qué sirvió, qué falta en el manual) y las preguntas reales del
// piso con el formato del examen.
//
// Salió de app.js en el paso 7 del ADR 0005, sin cambiar nada de lo que hace.
// Sin DOM: se importa igual desde Node. Guardar y pintar se queda en app.js.
import { normalizeText } from '../motor/texto.js';

/** @param {string | null | undefined} h @returns {string} */
export function temaLegible(h){
  if(!h)return'';
  return /[a-záéíóúñ]/.test(h)?h:h.charAt(0)+h.slice(1).toLowerCase()
}
/** @param {any[]} regs */
export function resumirTablero(regs){
  const total=regs.length;
  const cubiertas=regs.filter(r=>r.ok);
  const sirvieron=cubiertas.filter(r=>r.voto!=='mal');
  const noSirvieron=regs.filter(r=>r.voto==='mal');
  const temas=new Map();
  for(const r of cubiertas){
    if(!r.h)continue;
    const k=(r.sec||'')+'|'+normalizeText(r.h).trim();
    const t=temas.get(k)||{h:temaLegible(r.h),sec:r.sec,paginas:new Set(),n:0};
    t.n++;if(r.p)t.paginas.add(r.p);temas.set(k,t);
  }
  /* La misma duda escrita dos veces es una sola cosa que falta en el manual. */
  const gaps=new Map();
  for(const r of regs.filter(x=>!x.ok)){
    const k=normalizeText(r.q).replace(/[^\p{L}\p{N} ]/gu,'').replace(/\s+/g,' ').trim();
    const g=gaps.get(k)||{q:r.q,sec:r.sec,n:0,t:0};
    g.n++;if(r.t>g.t){g.t=r.t;g.q=r.q}gaps.set(k,g);
  }
  const secciones=new Map();
  for(const r of regs){const k=r.sec||'Manual interno';secciones.set(k,(secciones.get(k)||0)+1)}
  const orden=(/** @type {any} */a,/** @type {any} */b)=>b.n-a.n||b.t-a.t;
  return{total,cubiertas:cubiertas.length,sirvieron:sirvieron.length,noSirvieron,
    pct:total?Math.round(sirvieron.length*100/total):0,
    temas:[...temas.values()].sort(orden),
    gaps:[...gaps.values()].sort(orden),
    secciones:[...secciones.entries()].map(([sec,n])=>({sec,n})).sort((a,b)=>b.n-a.n),
    desde:total?Math.min(...regs.map(r=>r.t)):null,hasta:total?Math.max(...regs.map(r=>r.t)):null}
}
/* Las preguntas de verdad —como las escribe el piso, con sus faltas— son el
   mejor examen: las que se escriben leyendo el manual usan sus palabras y
   salen más fáciles. Se exportan con el formato del examen, sin respuesta:
   la página y el dato esperados se anotan después, contra el manual. Lo que
   la app vio (su página, si sirvió, la nota del 👎) va aparte, como pista. */
/** @param {any[]} regs @returns {any[]} */
export function preguntasRealesParaExamen(regs){
  const vistas=new Map();
  for(const r of regs){
    const k=normalizeText(r.q).replace(/\s+/g,' ').trim();
    if(!k)continue;
    const v=vistas.get(k);
    if(v){v.visto.veces++;if(r.nota&&!v.visto.nota)v.visto.nota=r.nota;if(r.voto==='mal')v.visto.noSirvio=true;if(r.pl&&!v.visto.paginaDelPiso){v.visto.paginaDelPiso=r.pl;v.p=[r.pl]}continue}
    /* Si el piso tocó la página que contestaba, ESA es la esperada: vale más
       que la que eligió la app. */
    const pag=r.pl||r.p||null;
    vistas.set(k,{q:r.q,seccion:r.dl||r.sec||'',tipo:'dato',cat:'piso-real',k:[],p:pag?[pag]:[],
      visto:{veces:1,encontro:!!r.ok,pagina:r.p||null,titulo:r.h||null,modo:r.modo||null,
        noSirvio:r.voto==='mal',nota:r.nota||null,fecha:new Date(r.t).toISOString().slice(0,10),
        ...(r.pl?{paginaDelPiso:r.pl}:{}),...(r.hueco?{noEstaSegunElPiso:true}:{})}});
  }
  return[...vistas.values()]
}
