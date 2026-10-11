// La verificación contra el contexto (src/motor/verificacion.js) en Node:
// cifras con su unidad, páginas citadas, nombres que el manual no dice y la
// cifra pegada a otra cosa. Corpus mínimo inventado, sin manuales.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conEstado, reiniciarCaches } from '../src/estado.js';
import { indexChunk } from '../src/motor/indice.js';
import {
  verificarContraContexto, verificarAtadura, cifrasCanonicas, nombresSinRespaldo,
  entidadesDelCorpus, paginaComoLamina,
} from '../src/motor/verificacion.js';

const D = '900 CALZADO DEMO.pdf';
const bloque = (pag, tit, txt) => `[${D} · pág. ${pag} · ${tit}]\n${txt}\n\n`;
const conDocs = (fn, docChunks = []) => conEstado({ docs: [{ name: D }], docChunks }, fn, reiniciarCaches);

test('verificación: la unidad es parte del dato', () => conDocs(() => {
  const ctx = bloque(3, 'MEZCLA', 'Cruce 80/20 y Formal 50% del piso.');
  const v = verificarContraContexto('Deja 80 cm de pasillo (pág. 3).', ctx);
  assert.deepEqual(v.cifras, ['80 cm'], 'el 80 está, pero no son centímetros');
  assert.deepEqual(verificarContraContexto('Formal va al 50% (pág. 3).', ctx).cifras, []);
  assert.deepEqual(verificarContraContexto('Formal va al 40%.', ctx).cifras, ['40 %']);
}));

test('verificación: un decimal no se respalda con su parte entera, y el separador da igual', () => conDocs(() => {
  const ctx = bloque(5, 'PARTICIPACIÓN', 'Vestir 20.8% de participación.');
  assert.deepEqual(verificarContraContexto('Vestir lleva 20,8%.', ctx).cifras, []);
  assert.deepEqual(verificarContraContexto('Vestir lleva 20%.', ctx).cifras, ['20 %']);
}));

test('verificación: páginas inventadas y citadas', () => conDocs(() => {
  const ctx = bloque(4, 'MESAS', 'La mesa va al centro.');
  const v = verificarContraContexto('La mesa va al centro (pág. 4) y lo repite la pág. 9.', ctx);
  assert.deepEqual(v.paginas, ['9']);
  assert.deepEqual([...v.citadas], ['4']);
  assert.deepEqual(verificarContraContexto('', ctx).cifras, []);
}));

test('verificación: cifras escritas igual de los dos lados', () => {
  assert.equal(cifrasCanonicas('mayor a $1,200.00'), 'mayor a $1200');
  assert.equal(cifrasCanonicas('20.8 y 1.50'), '20.8 y 1.50');
});

test('verificación: un nombre de otro manual no pasa, y la caché se olvida con el corpus', () => {
  const chunks = [
    indexChunk({ id: 'n1', source: 'pdf', docName: 'MUEBLES.pdf', page: 14, heading: 'MUNDOS Y MARCAS', text: 'Verifica que las marcas se encuentren ubicadas en su espacio. Los estilos son Nórdico e Industrial.' }),
    indexChunk({ id: 'n2', source: 'pdf', docName: 'BLANCOS.pdf', page: 15, heading: 'KIDS', text: 'Ofrece artículos para los más pequeños de la marca Vestra Kids.' }),
  ];
  conEstado({ docs: [{ name: 'MUEBLES.pdf' }, { name: 'BLANCOS.pdf' }], docChunks: chunks }, () => {
    const ctx = '[MUEBLES.pdf · pág. 14 · MUNDOS Y MARCAS]\nLos estilos son Nórdico e Industrial.';
    assert.ok(entidadesDelCorpus().has('vestra'));
    assert.ok(!entidadesDelCorpus().has('verifica'), 'lo que abre renglón no es nombre');
    assert.deepEqual(nombresSinRespaldo('Vestra es la marca de la casa.', ctx), ['Vestra']);
    assert.deepEqual(nombresSinRespaldo('El estilo Nórdico va al frente.', ctx), []);
  }, reiniciarCaches);
  conEstado({ docs: [], docChunks: [] }, () => {
    assert.equal(entidadesDelCorpus().size, 0, 'con otro corpus, la caché se rehace');
  }, reiniciarCaches);
});

test('verificación: la cifra pegada a otra cosa (atadura)', () => conDocs(() => {
  const ctx = bloque(12, 'TENIS CASUAL', '25% de\nparticipación') + bloque(12, 'SNEAKERS', '35% de\nparticipación');
  const a = verificarAtadura('Para **Sneakers** va el 25% de participación (pág. 12).', ctx);
  assert.equal(a.length, 1);
  assert.equal(a[0].rival, '35%');
  assert.match(a[0].pegadaA, /TENIS CASUAL/);
  assert.deepEqual(verificarAtadura('Tenis casual lleva el 25% (pág. 12).', ctx), []);
  assert.equal(verificarContraContexto('Para Sneakers va el 25% (pág. 12).', ctx).atadas.length, 1);
}));

test('verificación: la página entera como lámina, solo si hay imagen', () => {
  const frag = [{ id: 'a', source: 'pdf', docName: D, page: 7, heading: 'FOCAL', text: '' }];
  const paginas = new Map([[D, [{ page: 7, titulo: 'FOCAL', imagen: 'data:image/jpeg;base64,x' }, { page: 8 }]]]);
  assert.equal(paginaComoLamina(frag, 7, paginas)?.dataUrl, 'data:image/jpeg;base64,x');
  assert.equal(paginaComoLamina(frag, '7', paginas)?.page, 7);
  assert.equal(paginaComoLamina(frag, 8, paginas), null, 'sin fragmento de esa página');
  assert.equal(paginaComoLamina(frag, null, paginas), null);
  assert.equal(paginaComoLamina(frag, 7, new Map()), null);
});
