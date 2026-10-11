// Asistente de Piso · Copyright (c) 2026 Gerardo Barrera.
// Licencia PolyForm Noncommercial 1.0.0: uso comercial solo con licencia escrita (LICENCIA-COMERCIAL.md).
//
// Los proveedores de modelo (Gemini, OpenAI): cómo se llama a cada uno, con y
// sin streaming, y con qué perilla de razonamiento.
//
// Salió de app.js en el paso 7 del ADR 0005, sin cambiar nada de lo que hace.
// Sin DOM: se importa igual desde Node.
import { errorDeProveedor } from './errores.js';
import { textoDeGemini, buildOpenAIStreamBody, streamOpenAICompatible, streamGemini } from './sse.js';

/* ════════════════════════════════════════════════
   PROVEEDORES — Gemini, OpenAI
   GitHub Models se quitó: su dirección (models.inference.ai.azure.com) dejó de
   existir en octubre de 2025 y GitHub retiró el servicio entero en julio de
   2026. Era el proveedor por defecto, así que quien ponía un token de GitHub
   recibía un error en cada pregunta.
════════════════════════════════════════════════ */
/* Orden de las pestañas de Ajustes: loadSaved, saveConfig y switchExpert las
   ubican por posición, y antes cada uno llevaba su propia copia de la lista. */
export const PROV_ORDEN=['gemini','openai'];
/* Quien tenía GitHub guardado pasa a Gemini: GitHub Models ya no existe y, si
   no, la app seguiría eligiendo un proveedor que no está en la lista. */
/** @param {string | null | undefined} p @returns {string} */
export function proveedorValido(p){return p&&PROV_ORDEN.includes(p)?p:PROV_ORDEN[0]}
export const PROVIDERS={
  openai:{
    id:'openai',
    name:'OpenAI',
    placeholder:'sk-••••••••••••••••••••••••••••••',
    hint:'API key de OpenAI. <a href="https://platform.openai.com/api-keys" target="_blank">platform.openai.com/api-keys</a>',
    chatModels:['gpt-4o-mini','gpt-4o'],
    /** @param {string} key @param {MensajeIA[]} messages @param {string} model @param {number} maxTokens @param {number | null} [temperature] @returns {Promise<{text: string, tokens: number}>} */
    async call(key,messages,model,maxTokens,temperature){
      const res=await fetch('https://api.openai.com/v1/chat/completions',{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`},
        body:JSON.stringify({model,messages:mensajesOpenAI(messages),max_tokens:maxTokens,temperature:temperature??0.2})
      });
      const data=await res.json();
      if(!res.ok)throw errorDeProveedor(res.status,data);
      return{text:data.choices[0].message.content,tokens:data.usage?.total_tokens||0};
    },
    /** @param {ParamsStream} p */
    async stream({key, messages, model, maxTokens, temperature, onDelta, signal}) {
      return streamOpenAICompatible(
        'https://api.openai.com/v1/chat/completions',
        key,
        buildOpenAIStreamBody(mensajesOpenAI(messages), model, maxTokens, temperature),
        onDelta, signal
      );
    }
  },
  gemini:{
    id:'gemini',
    name:'Google Gemini',
    placeholder:'AIza••••••••••••••••••••••••••••••',
    hint:'API key de Google AI Studio. <a href="https://aistudio.google.com/app/apikey" target="_blank">aistudio.google.com/app/apikey</a>',
    /* Solo modelos estables que cualquier key nueva puede usar. Los 2.5 quedaron
       limitados a cuentas que ya los usaban, 3-flash-preview lo reemplaza
       3.6-flash y 3.1-flash-lite se apaga en mayo de 2027.
       El primero es el de fábrica. Es 3.5 Flash-Lite porque es el que contestó
       todas las mediciones —3.5 Flash salía saturado y respondía su respaldo, que
       es este—: 55/60 con los 30 manuales reales y 24/24 con el demo, en 1-2 s.
       3.8 Flash no baja de pensamiento LOW: en el demo tardó ~6 s de mediana,
       sacó 23/24, dos de sus respuestas llegaron cortadas y se saturó a media
       prueba. Queda en la lista para quien lo quiera. */
    chatModels:['gemini-3.5-flash-lite','gemini-3.5-flash','gemini-3.6-flash','gemini-3.8-flash'],
    /** @param {MensajeIA[]} messages @returns {{systemInstruction?: {parts: {text: any}[]}, contents: {role: string, parts: object[]}[]}} */
    _toGeminiMessages(messages){
      const sys=messages.find(m=>m.role==='system');
      const rest=messages.filter(m=>m.role!=='system');
      return{
        systemInstruction:sys?{parts:[{text:sys.content}]}:undefined,
        contents:rest.map(m=>({role:m.role==='assistant'?'model':'user',parts:partesGemini(m)}))
      };
    },
    /* Los Gemini con razonamiento descuentan de `maxOutputTokens` lo que
       piensan por dentro. Con las seis etapas de este prompt se gastaban el
       presupuesto pensando y la respuesta salía cortada a media frase, justo
       antes del dato: el asesor veía el razonamiento y ninguna contestación.
       Subir el tope no bastó —con 8000 seguía cortándose—, así que se apaga el
       pensamiento interno. No se pierde nada: este asistente ya razona en seis
       etapas visibles y auditables, que es precisamente lo contrario de un
       razonamiento que no se puede leer.
       La perilla no es la misma en todas las familias: los 2.x usan
       `thinkingBudget` y rechazan `thinkingLevel`; los 3.x usan `thinkingLevel`,
       y 3.7 y 3.8 no bajan de LOW. */
    /** @param {number} maxTokens @param {number | null | undefined} temperature @param {string} model */
    _genConfig(maxTokens,temperature,model){
      return{maxOutputTokens:maxTokens,temperature:temperature??0.2,thinkingConfig:razonamientoGemini(model)};
    },
    /** @param {string} key @returns {Record<string, string>} */
    _headers(key){return{'Content-Type':'application/json','x-goog-api-key':key}},
    /** @param {string} key @param {MensajeIA[]} messages @param {string} model @param {number} maxTokens @param {number | null} [temperature] @returns {Promise<{text: string, tokens: number}>} */
    async call(key,messages,model,maxTokens,temperature){
      const{systemInstruction,contents}=this._toGeminiMessages(messages);
      /** @type {Record<string, unknown>} */
      const body={contents,generationConfig:this._genConfig(maxTokens,temperature,model)};
      if(systemInstruction)body.systemInstruction=systemInstruction;
      /* La key va en el encabezado y no en la URL (`?key=`): una URL acaba en
         historiales, registros y capturas de pantalla. */
      const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{
        method:'POST',headers:this._headers(key),body:JSON.stringify(body)
      });
      const data=await res.json().catch(()=>({}));
      if(!res.ok)throw errorDeProveedor(res.status,data);
      const text=textoDeGemini(data)||'Sin respuesta.';
      const tokens=data.usageMetadata?.totalTokenCount||0;
      return{text,tokens};
    },
    /** @param {ParamsStream} p */
    async stream({key, messages, model, maxTokens, temperature, onDelta, signal}) {
      const {systemInstruction, contents} = this._toGeminiMessages(messages);
      /** @type {Record<string, unknown>} */
      const body = {contents, generationConfig: this._genConfig(maxTokens, temperature, model)};
      if (systemInstruction) body.systemInstruction = systemInstruction;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`;
      return streamGemini(url, this._headers(key), body, onDelta, signal);
    }
  }
};

/* Un mensaje puede llevar láminas (`imagenes`, src/ia/laminas.js): cada una va
   detrás del texto, rotulada con su página, en el formato de cada proveedor. */
/** @param {MensajeIA} m @returns {object[]} */
export function partesGemini(m){
  /** @type {object[]} */
  const parts=[{text:m.content}];
  for(const im of m.imagenes||[])parts.push({text:`Imagen de la pág. ${im.page}:`},{inline_data:{mime_type:'image/jpeg',data:im.dataUrl.split(',')[1]}});
  return parts
}
/** @param {MensajeIA[]} messages @returns {MensajeIA[]} */
export function mensajesOpenAI(messages){
  return messages.map(m=>m.imagenes&&m.imagenes.length
    ?{role:m.role,content:[{type:'text',text:m.content},...m.imagenes.flatMap(im=>[{type:'text',text:`Imagen de la pág. ${im.page}:`},{type:'image_url',image_url:{url:im.dataUrl}}])]}
    :{role:m.role,content:m.content})
}

/** @param {string | null | undefined} model @returns {{thinkingBudget: number} | {thinkingLevel: string}} */
export function razonamientoGemini(model){
  if(/^gemini-[12]\./.test(model||''))return{thinkingBudget:0};
  if(/^gemini-3\.[78]-/.test(model||''))return{thinkingLevel:'LOW'};
  return{thinkingLevel:'MINIMAL'};
}
