// Asistente de Piso · Copyright (c) 2026 Gerardo Barrera.
// Licencia PolyForm Noncommercial 1.0.0: uso comercial solo con licencia escrita (LICENCIA-COMERCIAL.md).
//
// Arranque de la app en módulos ES, sin bundler: GitHub Pages sirve los
// archivos tal cual.
//
// Las piezas que ya son módulos se publican en globalThis para el resto de la
// app (src/app.js, script clásico con defer) y para las herramientas que la
// manejan desde fuera (eval/, lab/). Los módulos y los scripts con defer corren
// en el orden del documento, así que app.js los encuentra listos.
//
// Capa de compatibilidad: se va quitando a medida que app.js se parte.
import * as html from './seguridad/html.js';
import * as inyeccion from './seguridad/inyeccion.js';
import * as texto from './motor/texto.js';
import * as indice from './motor/indice.js';
import * as erratas from './motor/erratas.js';
import * as layout from './motor/layout.js';
import * as fragmentos from './motor/fragmentos.js';
import * as secciones from './motor/secciones.js';
import * as solidez from './motor/solidez.js';
import * as aprendido from './motor/aprendido.js';
import * as busqueda from './motor/busqueda.js';
import * as puerta from './motor/puerta.js';
import * as ruta from './motor/ruta.js';
import * as conversacion from './motor/conversacion.js';
import * as respuesta from './motor/respuesta.js';
import * as basicos from './motor/basicos.js';
import * as verificacion from './motor/verificacion.js';
import * as aprende from './motor/aprende.js';
import * as sigue from './motor/sigue.js';
import * as tablero from './piso/tablero.js';
import * as medicion from './piso/medicion.js';
import * as almacen from './almacen/manuales.js';
import * as errores from './ia/errores.js';
import * as sse from './ia/sse.js';
import * as proveedores from './ia/proveedores.js';
import * as iaRespuesta from './ia/respuesta.js';
import * as reintentos from './ia/reintentos.js';
import * as agente from './ia/agente.js';
import * as estadoDelCorpus from './estado.js';
import { estado, CLAVES } from './estado.js';
/* La pestaña «Revisar» (ADR 0007) vive aparte del motor del manual: se arma
   sola y no publica nada en globalThis salvo su gancho de medición. */
import './revision/ui.js';

/* Capa de compatibilidad: lo que app.js (un script clásico), index.html,
   src/revision y las herramientas de eval/ y lab/ todavía usan por su nombre
   global, y nada más: lo demás se importa. eval/arnes.mjs falla si alguno de
   ellos usa un nombre de un módulo que no está aquí. La lista se achica a
   medida que app.js se parte. */
const PUBLICO = {
  html: ['escapeHtml', 'safeMarkdown'],
  inyeccion: ['REGLA_DATO', 'instruccionesEnManual'],
  texto: ['normalizeText', 'palabrasDeConsulta', 'tokenize', 'variantes'],
  estadoDelCorpus: ['estado', 'montar'],
  indice: ['indexChunk', 'reconstruirIndice'],
  erratas: ['vocabDeDoc'],
  layout: ['HEADING_MAX_DY', 'HEADING_OFFSET_PENALTY', 'pageToBlocks'],
  fragmentos: ['buildChunks'],
  secciones: ['nombreDeSeccion', 'secDe', 'seccionActiva'],
  solidez: ['filtroSolidez', 'nivelDeEvidencia'],
  aprendido: ['usarAprendido'],
  busqueda: ['CHECKLIST', 'esVerbo', 'fragmentosDePagina', 'getPdfContext', 'jaccardTokens',
    'retrieve', 'weightedTerms'],
  puerta: ['esOperacionDeTienda', 'palabraOriginal'],
  conversacion: ['RUTA_ROTULO', 'SEGUIMIENTO', 'assessQuestionScope', 'consultaAmpliada',
    'esPreguntaDeEstado', 'isCreatorQuestion', 'rutaDeLaPregunta', 'seccionDeLaPregunta'],
  respuesta: ['FALLBACK_MAX_SECCIONES', 'PDF_BUDGET', 'PDF_BUDGET_GEMINI', 'avisoVariasSecciones',
    'contextoParaModelo', 'relevantesSinModelo', 'respuestaSinModelo'],
  basicos: ['BASICOS', 'basicoDe'],
  verificacion: ['paginaComoLamina', 'verificarContraContexto'],
  errores: ['errorDeProveedor'],
  sse: ['textoDeGemini'],
  proveedores: ['PROVIDERS', 'PROV_ORDEN', 'proveedorValido', 'razonamientoGemini'],
  iaRespuesta: ['GUARDRAIL_APPEND', 'NOTA_DEL_MODO', 'PROMPT_VERSION', 'certezaDe',
    'debeRepetirPorCorte', 'getStreamingDisplayText', 'jsonDeTexto', 'lecturaDe', 'modoValido',
    'parseAIResponse', 'promptDelModo', 'sanitizeFinalAnswer'],
  reintentos: ['ESPERA_MAX', 'GEMINI_RESPALDO', 'LIMITE_MINUTO_ESPERAS',
    'LIMITE_MINUTO_ESPERA_MAX', 'RESPALDO_MEMORIA', 'RESPALDO_TRAS', 'RETRY_DELAYS',
    'esSaturacion', 'etiquetaDeModelo', 'isRetryable', 'modeloAlCargar', 'modeloDeRespaldo',
    'nombreCortoDeModelo', 'sleep'],
  agente: ['AGENTE_MAX_RONDAS', 'camposDelAgente', 'cicloAgente', 'extracto', 'glosarioDeSeccion',
    'historialParaModelo', 'prepararAgente', 'verificarCitas'],
  aprende: ['APRENDE_CONFIRMACIONES', 'APRENDE_JACCARD', 'APRENDE_MAX_ATAJOS',
    'APRENDE_MAX_PALABRAS', 'APRENDE_VENTANA_REFORMULA', 'aprendidoVacio', 'idAprende',
    'limpiarAprendido', 'motivoParaNoAprender', 'palabraActiva', 'palabraAprendible',
    'palabrasDeAtajo', 'palabrasRaras', 'recortarSeccion', 'terminosDeAtajo'],
  sigue: ['paginasDelManual', 'siguientesDelManual', 'sugerenciasDeFicha'],
  tablero: ['preguntasRealesParaExamen', 'resumirTablero', 'temaLegible'],
  medicion: ['calificarMedicion', 'claveDeExamen', 'paginasCitadasMed', 'resumenMedicion',
    'validarExamen'],
  almacen: ['borrarManual', 'hashArchivo', 'leerManual', 'listarManuales', 'txDB'],
};
const MODULOS = { html, inyeccion, texto, estadoDelCorpus, indice, erratas, layout, fragmentos, secciones, solidez, aprendido, busqueda, puerta, ruta, conversacion, respuesta, basicos, verificacion, errores, sse, proveedores, iaRespuesta, reintentos, agente, aprende, sigue, tablero, medicion, almacen };
for (const [ns, nombres] of Object.entries(PUBLICO)) for (const n of nombres) globalThis[n] = MODULOS[ns][n];

/* El estado del corpus (src/estado.js) sigue llamándose como antes para
   app.js y eval/: `docs`, `corpus`, `docChunks`… son accesores sobre
   `estado`, así que `docChunks=[]` en app.js cambia `estado.docChunks`.
   No configurables a propósito: si en app.js quedara un `let docs`, el
   navegador da error al cargar en vez de tener dos «docs» distintos. */
/* La sección activa no: `seccionActiva()` ya es una función (la de
   src/motor/secciones.js), y la app la nombra appState.manualActivo. */
for (const k of CLAVES.filter(k => k !== 'manualActivo')) {
  Object.defineProperty(globalThis, k, {
    get: () => estado[k],
    set: k === 'bm25' ? undefined : v => { estado[k] = v; },
    enumerable: true,
    configurable: false,
  });
}
