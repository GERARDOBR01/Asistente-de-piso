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
import * as estadoDelCorpus from './estado.js';
import { estado, CLAVES } from './estado.js';

Object.assign(globalThis, html, inyeccion, texto, estadoDelCorpus);

/* El estado del corpus (src/estado.js) sigue llamándose como antes para
   app.js y eval/: `docs`, `corpus`, `docChunks`… son accesores sobre
   `estado`, así que `docChunks=[]` en app.js cambia `estado.docChunks`.
   No configurables a propósito: si en app.js quedara un `let docs`, el
   navegador da error al cargar en vez de tener dos «docs» distintos. */
for (const k of CLAVES) {
  Object.defineProperty(globalThis, k, {
    get: () => estado[k],
    set: k === 'bm25' ? undefined : v => { estado[k] = v; },
    enumerable: true,
    configurable: false,
  });
}
