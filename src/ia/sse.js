// Asistente de Piso · Copyright (c) 2026 Gerardo Barrera.
// Licencia PolyForm Noncommercial 1.0.0: uso comercial solo con licencia escrita (LICENCIA-COMERCIAL.md).
//
// Las respuestas por streaming (SSE) de OpenAI y Gemini, trozo a trozo.
//
// Salió de app.js en el paso 7 del ADR 0005, sin cambiar nada de lo que hace.
// Usa fetch y TextDecoder, que también tiene Node: no toca el DOM.
import { errorDeProveedor } from './errores.js';

/* Una respuesta de Gemini puede venir en varias partes, y con razonamiento
   visible algunas son pensamiento (`thought:true`), que no es la respuesta. */
/** @param {any} obj @returns {string} */
export function textoDeGemini(obj){
  return(obj?.candidates?.[0]?.content?.parts||[]).filter((/** @type {any} */p)=>!p.thought).map((/** @type {any} */p)=>p.text||'').join('')
}

/** @param {MensajeIA[]} messages @param {string} model @param {number} maxTokens @param {number | null | undefined} temperature */
export function buildOpenAIStreamBody(messages, model, maxTokens, temperature) {
  return JSON.stringify({model, messages, max_tokens: maxTokens, temperature: temperature ?? 0.2, stream: true});
}

/** @param {string} line @returns {{done: true} | {delta: string, usage: number, done: false} | null} */
export function parseOpenAIChunk(line) {
  if (!line.startsWith('data:')) return null;
  const payload = line.slice(5).trim();
  if (payload === '[DONE]') return {done: true};
  try {
    const obj = JSON.parse(payload);
    const delta = obj.choices?.[0]?.delta?.content || '';
    const usage = obj.usage?.total_tokens || 0;
    return {delta, usage, done: false};
  } catch { return null; }
}

/**
 * @param {string} url @param {string} key @param {string} body
 * @param {(t: string) => void} onDelta @param {AbortSignal | null | undefined} signal
 * @returns {Promise<{tokens: number}>}
 */
export async function streamOpenAICompatible(url, key, body, onDelta, signal) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${key}`},
    body, signal
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw errorDeProveedor(res.status, data);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '', totalUsage = 0;
  while (true) {
    const {value, done} = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, {stream: true});
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      const parsed = parseOpenAIChunk(line.trim());
      if (!parsed) continue;
      if (parsed.done) return {tokens: totalUsage};
      if (parsed.usage) totalUsage = parsed.usage;
      if (parsed.delta) onDelta(parsed.delta);
    }
  }
  return {tokens: totalUsage};
}

/**
 * @param {string} url @param {Record<string, string>} headers @param {object} body
 * @param {(t: string) => void} onDelta @param {AbortSignal | null | undefined} signal
 * @returns {Promise<{tokens: number}>}
 */
export async function streamGemini(url, headers, body, onDelta, signal) {
  const res = await fetch(url, {
    method: 'POST', headers,
    body: JSON.stringify(body), signal
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw errorDeProveedor(res.status, data);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '', usage = 0;
  while (true) {
    const {value, done} = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, {stream: true});
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('{') && !trimmed.startsWith('data:')) continue;
      const jsonStr = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed;
      try {
        const obj = JSON.parse(jsonStr);
        const text = textoDeGemini(obj);
        if (text) { onDelta(text); }
        const m = obj.usageMetadata?.totalTokenCount;
        if (m) usage = m;
      } catch {}
    }
  }
  return {tokens: usage};
}
