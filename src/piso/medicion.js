// Asistente de Piso · Copyright (c) 2026 Gerardo Barrera.
// Licencia PolyForm Noncommercial 1.0.0: uso comercial solo con licencia escrita (LICENCIA-COMERCIAL.md).
//
// La medición del modo IA con los manuales del asesor, la parte pura: qué
// examen se acepta, cómo se califica cada respuesta (la misma regla que
// eval/modo-ia.mjs), en qué capa falló y el resumen por motor.
//
// Salió de app.js en el paso 7 del ADR 0005, sin cambiar nada de lo que hace.
// Sin DOM: se importa igual desde Node. Preguntar, guardar el progreso y
// pintar el panel se queda en app.js.

export const MEDICION_KEY='ap_medicion_v1';
export const MEDICION_TIPOS=new Set(['dato','no-esta','trampa','otra']);
/* El examen viene de fuera: solo se toman los campos conocidos, como texto,
   con tope. Un JSON raro no puede meter nada más. */
/** @typedef {{q: string, tipo: string, seccion: string, cat: string, otra: string, k: string[], minK: number, p: number[], turnos: string[]}} PreguntaDeExamen */
/** @param {any} ex @returns {PreguntaDeExamen[]} */
export function validarExamen(ex){
  /** @type {any[]} */
  const lista=Array.isArray(ex)?ex:ex&&Array.isArray(ex.preguntas)?ex.preguntas:[];
  const txt=(/** @type {unknown} */v,/** @type {number} */n)=>typeof v==='string'?v.replace(/\s+/g,' ').trim().slice(0,n):'';
  /** @type {PreguntaDeExamen[]} */
  const out=[];
  for(const x of lista.slice(0,400)){
    if(!x||typeof x!=='object')continue;
    const q=txt(x.q,300),tipo=MEDICION_TIPOS.has(x.tipo)?x.tipo:null,seccion=txt(x.seccion,120);
    if(!q||!tipo)continue;
    out.push({q,tipo,seccion,cat:txt(x.cat,40),otra:txt(x.otra,120),
      k:Array.isArray(x.k)?x.k.map((/** @type {unknown} */v)=>txt(v,120)).filter(Boolean).slice(0,12):[],
      minK:Math.max(1,Math.min(12,parseInt(x.minK,10)||1)),
      p:Array.isArray(x.p)?x.p.map((/** @type {any} */n)=>parseInt(n,10)).filter(Number.isFinite).slice(0,12):[],
      turnos:Array.isArray(x.turnos)?x.turnos.map((/** @type {unknown} */v)=>txt(v,300)).filter(Boolean).slice(0,4):[]});
  }
  return out
}
/* ── Calificación: la misma regla que eval/modo-ia.mjs ── */
export const normMed=(/** @type {string | null | undefined} */s)=>(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'')
  .replace(/(\d)\s*[x×]\s*(\d)/g,'$1 x $2').replace(/(\d)\s*(cm|m)\b/g,'$1 $2').replace(/\s+/g,' ');
/** @param {string} resp @param {string} alt @returns {boolean} */
export function tieneAlternativaMed(resp,alt){
  const r=normMed(resp),a=normMed(alt);
  if(r.includes(a))return true;
  const nums=a.match(/\d+(?:[.,]\d+)?/g)||[];
  if(!nums.every(n=>new RegExp('(?<![\\d.,])'+n.replace(/[.,]/,'[.,]')+'(?![\\d])').test(r)))return false;
  const pal=a.split(/[^a-zñ]+/).filter(w=>w.length>=4);
  if(!pal.length)return nums.length>0;
  return pal.filter(w=>r.includes(w.slice(0,5))).length>=Math.ceil(pal.length/2)
}
export const SIN_DATO_MED=/nada(?:\s+de\s+esta\s+secci[óo]n|\s+del\s+manual)?\s+coincide|no\s+(?:lo\s+)?especifica|no\s+(?:lo\s+)?encontr|no\s+(?:est[áa]|aparece|figura|viene)\s+en\s+(?:el|los|tu|este|esta)\s+(?:manual|secci[óo]n)|no\s+hay\s+(?:una\s+|ning[úu]n[ao]?\s+)?(?:regla|dato|informaci[óo]n)|no\s+trae\s+(?:ese|esa|este|esta|el|la|ning[úu]n[ao]?|nada)|no\s+tengo\s+(?:esa|ese|la|el|ning[úu]n[ao]?)\s+(?:informaci[óo]n|dato)|no\s+(?:lo\s+)?(?:dice|menciona|indica)|solo puedo ayudarte/i;
export const paginasCitadasMed=(/** @type {string | null | undefined} */t)=>[...(t||'').matchAll(/p[áa]g(?:ina)?s?\.?\s*(\d+(?:\s*(?:,|y|-|–)\s*\d+)*)/gi)].flatMap(m=>/** @type {RegExpMatchArray} */(m[1].match(/\d+/g)).map(Number));
/** @param {PreguntaDeExamen} x @param {any} r @returns {Record<string, any>} */
export function calificarMedicion(x,r){
  const texto=r.cuerpo||'';
  const dijoNoEsta=/no está en el manual/i.test(r.etiqueta||'')||SIN_DATO_MED.test(texto);
  /** @type {Record<string, any>} */
  const base={dijoNoEsta,sinRespaldo:!!(r.avisos||'').trim(),error:!!r.error};
  /* «Como el asesor»: además, ¿eligió bien la sección? En «no está» también
     vale no elegir ninguna. */
  if(r.ruta)base.seccionOk=r.ruta.seccion===r.esperado||((x.tipo==='no-esta'||x.tipo==='trampa')&&!r.ruta.seccion);
  if(x.tipo==='otra'){
    /* Bien si dice dónde está: la sección vecina en el texto o en el botón. */
    const pal=normMed(x.otra).split(/[^a-zñ]+/).filter(w=>w.length>=5);
    const dondeEsta=pal.length>0&&pal.some(w=>normMed(texto+' '+(r.botones||'')).includes(w));
    const ok=!r.error&&dondeEsta;return{...base,ok,capa:ok?null:r.error?'error del proveedor':'no dijo en qué sección está'}
  }
  if(x.tipo!=='dato'){const ok=!r.error&&dijoNoEsta;return{...base,ok,capa:ok?null:r.error?'error del proveedor':'contestó algo que no está'}}
  const dato=x.k.filter(k=>tieneAlternativaMed(texto,k)).length>=x.minK;
  const pagina=!x.p.length||paginasCitadasMed(texto).some(n=>x.p.includes(n));
  const ok=!r.error&&dato&&pagina&&!dijoNoEsta;
  return{...base,dato,pagina,ok,capa:ok?null:capaDeFalla(x,r,{dato,pagina,dijoNoEsta})}
}
/* Dónde falló, para saber dónde trabajar. La lectura del PDF no se distingue
   sola de la búsqueda: si el dato «no llegó», hay que mirar la página a mano. */
/** @param {PreguntaDeExamen} x @param {any} r @param {{dato: boolean, pagina: boolean, dijoNoEsta: boolean}} c @returns {string} */
export function capaDeFalla(x,r,c){
  if(r.error)return'error del proveedor';
  if(r.ruta&&r.ruta.seccion!==r.esperado)return'sección';
  const vistas=r.paginasVistas;
  const llego=Array.isArray(vistas)&&x.p.length?x.p.some(n=>vistas.includes(n)):null;
  if(llego===false)return'búsqueda (el dato no llegó)';
  /* Sin modelo no hay a quién culpar de «contestar mal»: la tarjeta de la
     página correcta no traía el dato (fragmento corto o cortado). */
  const sinModelo=r.motor==='manual';
  if(c.dijoNoEsta)return llego?(sinModelo?'tarjeta correcta con aviso de «no está»':'modelo (dijo «no está» teniéndolo)'):'«no está» sin saber si llegó';
  if(!c.dato)return llego?(sinModelo?'tarjeta de la página correcta, sin el dato':'modelo (contestó otro dato)'):'dato distinto';
  return'página citada';
}
/** @param {any[]} filas @returns {Record<string, any>} */
export function resumenMedicion(filas){
  const pct=(/** @type {number[]} */xs,/** @type {number} */q)=>{if(!xs.length)return null;const s=[...xs].sort((a,b)=>a-b);return s[Math.min(s.length-1,Math.floor(q*s.length))]};
  const seg=(/** @type {number | null} */ms)=>ms==null?'—':(ms/1000).toFixed(1)+' s';
  /** @type {Record<string, any>} */
  const out={};
  const grupo=(/** @type {any} */f)=>f.motor+(f.libre?' · sin sección':'')+(f.aprendido&&f.aprendido!=='apagado'?' · con lo aprendido':'');
  for(const motor of[...new Set(filas.map(grupo))]){
    const fm=filas.filter(f=>grupo(f)===motor);
    const conRuta=fm.filter(f=>f.ruta);
    const datos=fm.filter(f=>f.tipo==='dato'),huecos=fm.filter(f=>f.tipo==='no-esta'||f.tipo==='trampa'),otras=fm.filter(f=>f.tipo==='otra');
    const sinError=fm.filter(f=>!f.error);
    const ag=fm.map(f=>f.agente).filter(a=>a&&a.motor==='agente');
    /** @type {Record<string, [number, number]>} */
    const porCat={};
    for(const f of datos){const c=f.cat||'—';porCat[c]=porCat[c]||[0,0];porCat[c][1]++;if(f.ok)porCat[c][0]++}
    out[motor]={
      aciertos:`${datos.filter(f=>f.ok).length}/${datos.length}`,
      datoCorrecto:`${datos.filter(f=>f.dato).length}/${datos.length}`,
      paginaCorrecta:`${datos.filter(f=>f.pagina).length}/${datos.length}`,
      noEstaBienDicho:`${huecos.filter(f=>f.ok).length}/${huecos.length}`,
      otraSeccion:`${otras.filter(f=>f.ok).length}/${otras.length}`,
      avisosSinRespaldo:fm.filter(f=>f.sinRespaldo).length,
      errores:fm.filter(f=>f.error).length,
      primerTextoP50:seg(pct(sinError.map(f=>f.tPrimer),0.5)),totalP50:seg(pct(sinError.map(f=>f.tTotal),0.5)),
      ...(motor.startsWith('agente')?{contestoElAgente:`${ag.length}/${fm.length}`,
        tokensPorPregunta:ag.length?Math.round(ag.reduce((s,a)=>s+(a.tokens||0),0)/ag.length):0}:{}),
      ...(conRuta.length?{seccionElegidaBien:`${conRuta.filter(f=>f.seccionOk).length}/${conRuta.length}`,
        toquesDeEmpate:fm.filter(f=>f.toque).length}:{}),
      /* Cuántas veces avisó de una cifra mal atada, y cuántas de esas en una
         respuesta que estaba bien: esa segunda cifra es la de falsas alarmas. */
      fallasPorCapa:fm.filter(f=>!f.ok&&f.capa).reduce((o,f)=>(o[f.capa]=(o[f.capa]||0)+1,o),{}),
      avisosDeAtadura:fm.filter(f=>f.atadura).length,
      atadurasEnRespuestasBien:fm.filter(f=>f.atadura&&f.ok).length,
      certezaBajada:fm.filter(f=>f.certezaBajada).length,
      porCategoria:Object.fromEntries(Object.entries(porCat).map(([c,[a,b]])=>[c,`${a}/${b}`]))
    };
  }
  return out
}
/* La clave con que se guarda el progreso de un examen. */
/** @param {any} ex @param {PreguntaDeExamen[]} preguntas @returns {string} */
export function claveDeExamen(ex,preguntas){
  let h=0;for(const ch of(ex&&ex.examen||'')+preguntas.map(x=>x.seccion+x.q).join('|'))h=(h*31+ch.charCodeAt(0))|0;
  return MEDICION_KEY+':'+(h>>>0).toString(36)
}
