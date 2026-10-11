// Asistente de Piso · Copyright (c) 2026 Gerardo Barrera.
// Licencia PolyForm Noncommercial 1.0.0: uso comercial solo con licencia escrita (LICENCIA-COMERCIAL.md).
//
// La clase de cada error de un proveedor (cuota del día, límite por minuto,
// saturación, key, red): de ella dependen el reintento, el respaldo y la
// medición.
//
// Salió de app.js en el paso 7 del ADR 0005, sin cambiar nada de lo que hace.
// Sin DOM: se importa igual desde Node.

/* El código HTTP viaja con el error. Gemini contesta «This model is currently
   experiencing high demand» sin número en el texto, y el reintento y el
   respaldo necesitan saber que fue un 503. */
/** @param {number} status @param {any} data @returns {ErrorDeProveedor} */
export function errorDeProveedor(status,data){
  const e=/** @type {ErrorDeProveedor} */(new Error(data?.error?.message||`Error ${status}`));
  e.status=status;
  const c=claseDeError(status,data);
  e.clase=c.clase;e.espera=c.espera;
  return e
}
/* No todo 429 es lo mismo, y tratarlo igual ensuciaba la medición. El límite
   POR MINUTO del plan gratis se pasa esperando lo que el proveedor dice
   (Gemini lo manda en `RetryInfo.retryDelay`); la cuota DEL DÍA no se pasa
   esperando ni cambiando de modelo: hay que parar. Antes los dos eran
   «saturación»: tras dos seguidos se cambiaba a Flash-Lite diez minutos y la
   medición mezclaba modelos sin saberlo, y el día agotado seguía marcando
   error pregunta tras pregunta. */
/** @param {number} status @param {any} data @returns {{clase: string, espera: number | null}} */
export function claseDeError(status,data){
  const err=data&&data.error||{};
  const msg=String(err.message||'')+' '+String(err.code||'')+' '+String(err.status||'');
  const det=Array.isArray(err.details)?err.details:[];
  const ids=det.flatMap((/** @type {any} */d)=>Array.isArray(d.violations)?d.violations.map((/** @type {any} */v)=>String(v.quotaId||'')+' '+String(v.quotaMetric||'')):[]).join(' ');
  const seg=(/** @type {unknown} */t)=>{const m=String(t||'').match(/([\d.]+)\s*s\b/);return m?Math.ceil(parseFloat(m[1])*1000):null};
  const espera=seg(det.map((/** @type {any} */d)=>d.retryDelay).find(Boolean))??seg((String(err.message||'').match(/(?:retry|try again) in ([\d.]+\s*s)/i)||[])[1]);
  if(status===429||/resource.?exhausted|quota|rate.?limit/i.test(msg)){
    if(/per.?day|perday/i.test(ids+' '+msg)||/insufficient_quota|billing/i.test(msg))return{clase:'cuota-dia',espera:null};
    return{clase:'limite-minuto',espera};
  }
  if(status===503||/high demand|overloaded|over capacity|unavailable/i.test(msg))return{clase:'saturado',espera:null};
  if(status===401||status===403||/api.?key not valid|unauthori[sz]ed|permission denied/i.test(msg))return{clase:'key',espera:null};
  return{clase:status?'otro':'red',espera:null};
}
