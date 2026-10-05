// El calificador de las respuestas, en un solo lugar.
//
// Lo usan eval/modo-ia.mjs (con y sin modelo), el laboratorio (lab/) y los
// diagnósticos que viven fuera del repo. Antes los diagnósticos lo recortaban
// del texto de modo-ia.mjs con `new Function`: dos calificadores que podían
// dejar de ser el mismo sin que nadie se diera cuenta.

export const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/(\d)\s*[x×]\s*(\d)/g, '$1 x $2').replace(/(\d)\s*(cm|m)\b/g, '$1 $2').replace(/\s+/g, ' ');

/* Una alternativa cuenta si aparece tal cual o, si el modelo la dijo con sus
   palabras, si están todos sus números y al menos la mitad de sus palabras
   de cuatro letras o más (por las primeras cinco letras: «paralelas»/«paralelo»). */
export function tieneAlternativa(resp, alt) {
  const r = norm(resp), a = norm(alt);
  if (r.includes(a)) return true;
  const nums = a.match(/\d+(?:[.,]\d+)?/g) || [];
  if (!nums.every(n => new RegExp('(?<![\\d.,])' + n.replace(/[.,]/, '[.,]') + '(?![\\d])').test(r))) return false;
  const pal = a.split(/[^a-zñ]+/).filter(w => w.length >= 4);
  if (!pal.length) return nums.length > 0;
  return pal.filter(w => r.includes(w.slice(0, 5))).length >= Math.ceil(pal.length / 2);
}

export const SIN_DATO = /no\s+(?:lo\s+)?especifica|no\s+(?:lo\s+)?encontr|no\s+(?:est[áa]|aparece|figura|viene)\s+en\s+(?:el|los|tu|este|esta)\s+(?:manual|secci[óo]n)|no\s+hay\s+(?:una\s+|ning[úu]n[ao]?\s+)?(?:regla|dato|informaci[óo]n)|no\s+trae\s+(?:ese|esa|este|esta|el|la|ning[úu]n[ao]?|nada)|no\s+tengo\s+(?:esa|ese|la|el|ning[úu]n[ao]?)\s+(?:informaci[óo]n|dato)|no\s+(?:lo\s+)?(?:dice|menciona|indica)|solo puedo ayudarte/i;

/* «pág. 14, 20» y «págs. 2 y 16» citan las dos páginas, no solo la primera. */
export const paginasCitadas = t => [...(t || '').matchAll(/p[áa]g(?:ina)?s?\.?\s*(\d+(?:\s*(?:,|y|-|–)\s*\d+)*)/gi)]
  .flatMap(m => m[1].match(/\d+/g).map(Number));

/* Con varios manuales cargados, `m` (o `d` cuando se pregunta en todos a la
   vez) dice de qué manual tiene que salir el dato: la misma cifra en otro
   manual no cuenta. */
export const delManual = (p, c) => { const d = p.m || p.d; return !d || (c.d || '').normalize('NFC').startsWith(d.normalize('NFC')); };
export const hallados = (p, texto) => (p.k || []).filter(k => tieneAlternativa(texto, k)).length;

/* Un fragmento «es la respuesta» si es del manual correcto, de la página
   esperada y trae el dato. Es la relevancia graduada del laboratorio:
   2 = página y dato, 1 = solo la página (la lámina correcta, con el dato en el
   fragmento hermano), 0 = otra cosa. */
export function relevancia(p, c) {
  if (p.tipo !== 'dato' || !delManual(p, c)) return 0;
  if (p.p && !p.p.includes(c.p)) return 0;
  return hallados(p, (c.h || '') + ' ' + (c.t || '')) >= (p.minK || 1) ? 2 : (p.p ? 1 : 0);
}

/* Modo manual: no hay redacción que calificar, solo qué tarjetas enseñó. El
   dato «sale» en una tarjeta si es del manual correcto, de la página esperada y
   trae las palabras clave. */
export function calificarManual(p, r) {
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

export function calificar(p, r) {
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
