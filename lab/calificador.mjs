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
export function tieneAlternativa(resp, alt, { polaridad = false } = {}) {
  const r = norm(resp), a = norm(alt);
  const vale = i => !polaridad || NEGACION.test(a) || !negadoEn(r, i);
  if ([...r.matchAll(new RegExp(escapar(a), 'g'))].some(m => vale(m.index))) return true;
  const nums = a.match(/\d+(?:[.,]\d+)?/g) || [];
  if (!nums.every(n => [...r.matchAll(new RegExp('(?<![\\d.,])' + n.replace(/[.,]/, '[.,]') + '(?![\\d])', 'g'))].some(m => vale(m.index)))) return false;
  const pal = a.split(/[^a-zñ]+/).filter(w => w.length >= 4);
  if (!pal.length) return nums.length > 0;
  return pal.filter(w => r.includes(w.slice(0, 5))).length >= Math.ceil(pal.length / 2);
}

/* Lo que redacta el modelo sí puede negar el dato: «No colocar el sensor a
   15 cm» trae las palabras y la cifra de «colocar el sensor a 15 cm» y dice lo
   contrario. Con `polaridad`, una aparición no cuenta si en su misma cláusula,
   entre las tres palabras de antes, hay un «no / nunca / jamás / ni» que la
   alternativa no trae.
   - La cláusula corta en puntuación, «pero» y «sino»: «no va a 30, va a 15 cm»
     sí da el 15.
   - «no debe exceder 1.20 m» es un máximo, no una negación del dato.
   - Si la alternativa ya es negativa («no mezclar tallas»), no se mira.
   Solo se usa con texto del modelo: las tarjetas del modo manual son el manual
   tal cual, y ahí la negación es la regla. Es una red para el caso común, no un
   analizador de negación: «no olvides colocarlo a 15 cm» la engaña. */
const NEGACION = /\b(?:no|nunca|jamas|ni)\b/;
const LIMITE = /^(?:exceder|excede|exceda|superar|supera|supere|pasar|pasa|pase|rebasar|rebasa|sobrepasar|mas|menos)$/;
const DE_PASO = new Set(['a', 'al', 'en', 'de', 'del', 'el', 'la', 'los', 'las', 'lo', 'un', 'una', 'se', 'va', 'van', 'debe', 'deben', 'hay', 'que', 'es', 'son']);
const CORTE = /[,.;:](?=\s|$)|[!?¡¿\n()]|\bpero\b|\bsino\b/g;
const escapar = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function negadoEn(r, i) {
  const clausula = r.slice(0, i).split(CORTE).pop();
  const pal = clausula.split(/[^a-zñ0-9]+/).filter(w => w && !DE_PASO.has(w)).slice(-3);
  return pal.some((w, j) => NEGACION.test(w) && !LIMITE.test(pal[j + 1] || ''));
}

/* Cifras con unidad que no salen de la pregunta ni de lo que recibió el modelo:
   «El manual no especifica el dato. Coloca el sensor a 99 cm.» se abstiene y
   aun así da una medida. Sin `ctx` (corridas viejas), cualquier cifra nueva
   cuenta. */
const CIFRA = /(\d+(?:[.,]\d+)?)\s*(?:cm|m|mts?|metros?|centimetros?|%|piezas?|pzas?|prendas?|niveles?|ganchos?|charolas?|entrepanos?)(?![a-z0-9])/g;
export function cifrasSinRespaldo(texto, q, ctx) {
  const fuente = norm(q) + ' ' + (ctx || []).map(c => norm((c.h || '') + ' ' + (c.t || ''))).join(' ');
  const enFuente = n => new RegExp('(?<![\\d.,])' + n.replace(/[.,]/, '[.,]') + '(?![\\d])').test(fuente);
  return [...norm(texto).matchAll(CIFRA)].map(m => m[0]).filter(c => !enFuente(c.match(/\d+(?:[.,]\d+)?/)[0]));
}

export const SIN_DATO = /no\s+(?:lo\s+)?especifica|no\s+(?:lo\s+)?encontr|no\s+(?:est[áa]|aparece|figura|viene)\s+en\s+(?:el|los|tu|este|esta)\s+(?:manual|secci[óo]n)|no\s+hay\s+(?:una\s+|ning[úu]n[ao]?\s+)?(?:regla|dato|informaci[óo]n)|no\s+trae\s+(?:ese|esa|este|esta|el|la|ning[úu]n[ao]?|nada)|no\s+tengo\s+(?:esa|ese|la|el|ning[úu]n[ao]?)\s+(?:informaci[óo]n|dato)|no\s+(?:lo\s+)?(?:dice|menciona|indica)|solo puedo ayudarte/i;

/* «pág. 14, 20» y «págs. 2 y 16» citan las dos páginas, no solo la primera. */
export const paginasCitadas = t => [...(t || '').matchAll(/p[áa]g(?:ina)?s?\.?\s*(\d+(?:\s*(?:,|y|-|–)\s*\d+)*)/gi)]
  .flatMap(m => m[1].match(/\d+/g).map(Number));

/* Con varios manuales cargados, `m` (o `d` cuando se pregunta en todos a la
   vez) dice de qué manual tiene que salir el dato: la misma cifra en otro
   manual no cuenta. */
export const delManual = (p, c) => { const d = p.m || p.d; return !d || (c.d || '').normalize('NFC').startsWith(d.normalize('NFC')); };
export const hallados = (p, texto, opciones) => (p.k || []).filter(k => tieneAlternativa(texto, k, opciones)).length;

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
    /* Abstenerse no basta si, de paso, da una medida que nadie le pasó. */
    const sinFuente = dijoNoEsta ? cifrasSinRespaldo(texto, p.q, r.ctx) : [];
    const ok = !r.error && dijoNoEsta && !sinFuente.length;
    return { ...base, cifrasSinRespaldo: sinFuente, ok, fallo: ok ? null : r.error ? 'error' : sinFuente.length ? 'abstiene e inventa' : 'inventa' };
  }
  const dato = hallados(p, texto, { polaridad: true }) >= (p.minK || 1);
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
