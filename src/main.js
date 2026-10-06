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
import * as estadoDelCorpus from './estado.js';
import { estado, CLAVES } from './estado.js';

Object.assign(globalThis, html, inyeccion, texto, estadoDelCorpus, indice, erratas, layout, fragmentos,
  secciones, solidez, aprendido, busqueda, puerta, ruta, conversacion, respuesta);

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
