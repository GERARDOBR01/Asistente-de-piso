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

Object.assign(globalThis, html, inyeccion, texto);
