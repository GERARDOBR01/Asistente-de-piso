// La ruta de los básicos (src/motor/basicos.js): de qué básico es una
// pregunta y cuál sigue. Puro, sin manuales.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BASICOS, basicoDe, siguientesBasicos } from '../src/motor/basicos.js';

test('básicos: la pregunta del piso cae en su básico, con faltas de acentos', () => {
  assert.equal(basicoDe('¿qué marcas hay?'), 'marcas');
  assert.equal(basicoDe('en que mundo va levis'), 'marcas');
  assert.equal(basicoDe('como se clasifica muebles'), 'clasificacion');
  assert.equal(basicoDe('¿qué estilos de mobiliario hay?'), 'clasificacion');
  assert.equal(basicoDe('donde pongo la liquidacion'), 'liquidacion');
  assert.equal(basicoDe('¿a qué altura va el sensor?'), 'etiquetas');
  assert.equal(basicoDe('como hago la triangulacion del focal'), 'display');
  assert.equal(basicoDe('que va en el pos'), 'pos');
  assert.equal(basicoDe('¿qué hago si se va la luz?'), null);
});

test('básicos: «pos» y «caja» son palabra entera, no raíz', () => {
  assert.notEqual(basicoDe('la posición de la mesa'), 'pos');
  assert.notEqual(basicoDe('las cajas decorativas'), 'pos');
});

test('básicos: lo que sigue va en orden, da la vuelta y salta lo preguntado y lo que el manual no trae', () => {
  const todos = new Map(BASICOS.map((b, i) => [b.id, i + 1]));
  assert.deepEqual(siguientesBasicos('marcas', new Set(), todos).map(b => b.id).slice(0, 2), ['clasificacion', 'liquidacion']);
  assert.deepEqual(siguientesBasicos('campanas', new Set(), todos)[0].id, 'marcas');
  const sinLiq = new Map(todos); sinLiq.delete('liquidacion');
  assert.deepEqual(siguientesBasicos('marcas', new Set(['clasificacion']), sinLiq)[0].id, 'etiquetas');
  assert.equal(siguientesBasicos('marcas', new Set(), new Map()).length, 0, 'sin cobertura no se sugiere nada');
  assert.ok(!siguientesBasicos(null, new Set(), todos).some(b => b.id === null));
});
