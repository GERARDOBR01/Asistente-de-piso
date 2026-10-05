// Escapar y sanear lo que se pinta. safeMarkdown usa marked y DOMPurify, que
// llegan como globales desde el CDN (index.html, <head>).
//
// Movido tal cual desde index.html (Fase 2: módulos sin bundler).
/* ════════════════════════════════════════════════
   SEGURIDAD — DOMPurify + escapeHtml + safeMarkdown
   v7.0
════════════════════════════════════════════════ */
export const PURIFY_CFG = {
  ALLOWED_TAGS: ['p','br','strong','em','b','i','u','code','pre','blockquote',
                 'h1','h2','h3','h4','ul','ol','li','hr','table','thead','tbody',
                 'tr','th','td','span','a','div','mark'],
  ALLOWED_ATTR: ['href','target','rel','class'],
  ALLOW_DATA_ATTR: false,
  FORBID_TAGS: ['script','style','iframe','object','embed','form','input','svg','math'],
  FORBID_ATTR: ['onerror','onload','onclick','onmouseover','onfocus','onblur','style'],
  ADD_ATTR: ['target','rel'],
};

export function escapeHtml(t) {
  return String(t||'')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

export function safeMarkdown(text) {
  if (!text) return '';
  const html = marked.parse(text);
  if (typeof DOMPurify === 'undefined') {
    console.warn('DOMPurify no cargó — fallback a escapeHtml');
    return escapeHtml(text);
  }
  const clean = DOMPurify.sanitize(html, PURIFY_CFG)
    /* Un enlace con parámetros (`?`, `=`) es la forma de sacar datos por la
       URL: un manual con instrucciones escondidas puede pedirle al modelo
       «pon un enlace a https://…?q=<lo que preguntó>». Las imágenes ya no
       pasan (no están en ALLOWED_TAGS); estos enlaces se quedan como texto.
       Los de la app (Google AI Studio, OpenAI) no llevan parámetros. */
    .replace(/<a\s[^>]*href="([^"]*[?=][^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
      (m, href, txt) => `<span class="enlace-quitado" title="Enlace con datos: se muestra como texto por seguridad">${txt}</span>`);
  return clean.replace(/<a\s+([^>]*?)>/gi, (m, attrs) => {
    if (/target=/i.test(attrs) && !/rel=/i.test(attrs)) {
      return `<a ${attrs} rel="noopener noreferrer">`;
    }
    if (!/target=/i.test(attrs)) {
      return `<a ${attrs} target="_blank" rel="noopener noreferrer">`;
    }
    return m;
  });
}

