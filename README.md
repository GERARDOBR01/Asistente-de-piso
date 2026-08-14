# Asistente de piso — demo

Asistente conversacional de una sola página para el personal de piso de una tienda:
responde dudas de montaje y estándar de exhibición **sin conexión y sin backend**, desde
el celular, parado frente al mueble.

> [!NOTE]
> **Demo con conocimiento 100 % sintético.** Marcas, campañas, departamentos y sucursales
> son ficticios (cliente *Mercadep*, marcas `MarcaDemoA`–`MarcaDemoD`). Ningún manual,
> nombre ni dato operativo de un cliente real vive en este repositorio ni en su historial.

## Qué resuelve

El manual de montaje de una campaña son decenas de páginas en PDF. Nadie las carga al
piso, así que las dudas se resuelven preguntando —si hay a quién— o adivinando. Este
asistente pone ese conocimiento a un toque de distancia, en el lenguaje con el que
realmente se pregunta: *"¿el gráfico va arriba o al frente?"*.

## Cómo está hecho

- **Un solo archivo `index.html`.** Sin build, sin backend, sin dependencias, sin red
  después de cargar. Se abre desde un link y funciona en un celular con mala señal, que
  es exactamente donde se necesita.
- **Conocimiento embebido y estructurado**, con sinónimos y alias por término — la gente
  no pregunta con el vocabulario del manual.
- **Sin telemetría ni almacenamiento.** Nada de lo que se pregunta sale del teléfono.

## Relación con Veristack

Es la otra mitad del mismo problema. [Veristack](https://github.com/GERARDOBR01/veristack)
**verifica** que la exhibición esté bien montada; este asistente ayuda a montarla bien
desde el principio. Los dos parten del mismo insumo: el estándar operativo escrito.

## Historia

Nació de una generación anterior del proyecto (2026). Este repositorio se creó con
**historia nueva y limpia**, deliberadamente: la versión original se construyó con
conocimiento propietario de un cliente y esa historia no debe existir en público. Lo que
se publica aquí es la interfaz y la mecánica, con conocimiento de demostración.
