# Hoja de ruta

Asistente de piso es también nuestro laboratorio. Esta hoja dice cómo trabajamos, dónde
estamos y qué sigue, en orden.

## Cómo trabajamos

- **Nada mejora sin número.** Cada cambio se mide contra la corrida anterior con el mismo
  examen: la medición de la app («🧪 Medir con un examen») o, sin teléfono, `eval/banco.mjs`, y
  `eval/comparar.mjs` para ver qué se arregló, qué se rompió y en qué capa siguen las fallas.
- **Un instrumento que no se rompe.** Midiendo no se cambia de modelo, la cuota del día para la
  tanda sin ensuciarla, y cada resultado lleva la versión de la app, la de lectura y el modelo
  que contestó.
- **Se aprenden caminos, nunca respuestas.** La app puede aprender que una palabra del piso lleva
  a una página; el dato siempre sale del manual, con su página.
- **Los manuales reales no entran al repo** (ni sus marcas ni sus cifras): los exámenes y los
  resultados con datos reales viven fuera.

## Dónde estamos

| Capa | Estado |
|---|---|
| Lectura del PDF | Buena en texto y tablas simples (incluidos títulos de dos renglones). Débil en planogramas y datos que solo están en imagen: ahí depende de la ficha de IA |
| Búsqueda | El dato llega en 77–83 de 86 preguntas con 5 manuales reales |
| Sección | La pregunta la elige: 83/86 en sesión, con empate resuelto con botones |
| Motores | Manual medido (56/86 con sección, 52/86 sin elegirla). **Clásico y agente sin medir con modelo real** |
| Verificación | Cifras, nombres, páginas, citas y atadura (0/21 falsas alarmas, 60/77 detectadas); certeza baja a MEDIA si algo no se comprueba |
| Aprende del piso | Hecho: atajos pregunta → página, vocabulario por sección con candados, «Sí, eso», reformulación, propuestas de la IA, Tablero y export. **Sin medir su efecto todavía** |
| Pruebas | Arnés 232 + simulado 28 en el CI |

## Ahora: la línea base con modelo real

1. Releer los PDF en la app (lectura nueva) y correr «🩺 Chequeo antes de medir».
2. Medir el clásico completo; después el agente (y, si alcanza la cuota, el agente «como el
   asesor»).
3. Clasificar las fallas por capa y decidir con números si el agente queda de fábrica y qué capa
   se ataca primero.
4. Juntar preguntas reales del Tablero («⬇ Preguntas para examen») para el examen v2.

## Siguiente: medir lo que aprende del piso

Ya está construido (ver el README, «La app aprende del piso»). Lo que falta es probar con
números que suma y no rompe nada:

1. Juntar dos o tres semanas de uso real en el piso y exportar «⬇ Vocabulario del piso».
2. Revisarlo juntos: qué palabras son de verdad del piso y cuáles son ruido.
3. Medir el mismo examen sin y con lo aprendido (`--aprendido` en el banco, o la casilla en la
   app), y comparar con `comparar.mjs`: 0 rotas, y cuántas arregladas.
4. Lo que el banco confirme sube al diccionario base del código para todos los teléfonos.
5. Ajustar los candados con números: cuántas confirmaciones, el bono del atajo y el tope por
   sección.

## Pulido pendiente

- Modo manual: con muchos manuales exige dos palabras y se queda callado en preguntas cortas;
  las conversaciones de seguimiento salen 1/5.
- Quitar de `main` nombres reales que quedaron en comentarios y pruebas antiguas.
- «Paquete del manual»: la ficha revisada una vez y compartida, en vez de una por teléfono.
- Vigencia del manual: detectar temporada y avisar si hay dos versiones de la misma sección.
- Lectura de planogramas y de datos que solo están en imagen.

## Más adelante

- **Backend mínimo**, cuando haya equipo o tienda piloto: compartir fichas, vocabulario y
  tablero entre teléfonos, y guardar la key fuera de ellos. Los manuales del cliente saldrían del
  teléfono: es una decisión del cliente, no técnica.
- **Partir `index.html` en módulos** (sin bundler) cuando entre otra persona al código o cuando
  un cambio empiece a romper cosas lejanas.
