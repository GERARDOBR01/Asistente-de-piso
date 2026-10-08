/* Service worker: que la app abra y conteste sin señal.

   En el piso la señal va y viene, y en la junta la prueba es poner el
   celular en modo avión y seguir preguntando. El modo manual no necesita red
   —el PDF ya se procesó y vive en IndexedDB—, pero la página, pdf.js, su
   worker y las fuentes sí se pedían a internet en cada apertura.

   - La página: primero la red, con tope de 3 s; sin red o con señal floja,
     la copia guardada. Así una versión nueva llega sola, y el modo avión no
     espera a que venza nada.
   - Librerías de cdnjs y fuentes: sus URL llevan versión, así que lo
     guardado no caduca: primero la caché.
   - El código de la app (src/) va igual que la página: si se sirviera primero
     de la caché, un index.html nuevo podría arrancar con un app.js viejo.
   - Las llamadas a las API (OpenAI, Gemini, GitHub) no se tocan nunca. */
const VERSION='ap-v1.14.0';
/* Todo archivo de src/ tiene que estar aquí o no carga sin señal: lo revisa
   eval/arnes.mjs. */
const CODIGO=['src/main.js','src/app.js','src/seguridad/html.js','src/seguridad/inyeccion.js','src/motor/texto.js','src/estado.js','src/motor/indice.js','src/motor/erratas.js','src/motor/layout.js','src/motor/fragmentos.js','src/motor/secciones.js','src/motor/solidez.js','src/motor/aprendido.js','src/motor/busqueda.js','src/motor/puerta.js','src/motor/ruta.js','src/motor/conversacion.js','src/motor/respuesta.js','src/revision/veredicto.js','src/revision/procedencia.js','src/revision/color.js','src/revision/surtido.js','src/revision/triangulo.js','src/revision/demo.js','src/revision/ui.js','src/revision/detector.js','src/revision/c2pa.js','src/revision/silueta.js'];
const PAGINA=['./','index.html','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','docs/manual-demo.pdf','src/revision/c2pa-confianza.pem',...CODIGO];
const CDN=[
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/marked/9.1.6/marked.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.1.6/purify.min.js'
];
/* El detector del focal (src/revision/detector.js) pesa ~14 MB: no se baja al
   instalar, sino la primera vez que alguien lo usa, y vive en su propia caché
   para que una versión nueva de la app no obligue a bajarlo otra vez. */
const DETECTOR='ap-detector-mp-0.10.21';
const esDetector=u=>(u.origin==='https://cdn.jsdelivr.net'&&u.pathname.startsWith('/npm/@mediapipe/tasks-vision@0.10.21/'))||(u.origin==='https://storage.googleapis.com'&&u.pathname.startsWith('/mediapipe-models/'));
/* El lector de credenciales C2PA (src/revision/c2pa.js, ~9 MB) va igual: se
   baja la primera vez que una foto trae credencial y vive en su caché. */
const C2PA='ap-c2pa-web-0.15.3';
const esC2pa=u=>u.origin==='https://cdn.jsdelivr.net'&&(u.pathname.startsWith('/npm/@contentauth/c2pa-web@0.15.3/')||u.pathname.startsWith('/npm/highgain@0.1.0/'));
const FUENTES='https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@500;600&display=swap';

async function guardarFuentes(cache){
  /* La hoja de Google Fonts apunta a los .woff2 de gstatic: hay que bajar
     también esos, o sin red la hoja carga y las letras no. */
  const r=await fetch(FUENTES,{mode:'cors',credentials:'omit'});
  if(!r.ok)return;
  await cache.put(FUENTES,r.clone());
  const css=await r.text();
  const woff=[...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map(m=>m[1]);
  await Promise.all(woff.map(u=>fetch(u,{mode:'cors',credentials:'omit'}).then(x=>x.ok&&cache.put(u,x)).catch(()=>{})));
}

self.addEventListener('install',e=>{
  e.waitUntil((async()=>{
    const cache=await caches.open(VERSION);
    await cache.addAll(PAGINA);
    await Promise.all(CDN.map(u=>fetch(u,{mode:'cors',credentials:'omit'}).then(r=>{if(!r.ok)throw new Error(u);return cache.put(u,r)})));
    /* Sin fuentes la app funciona igual (cae a las del sistema): que no
       tumben la instalación. */
    await guardarFuentes(cache).catch(()=>{});
    await self.skipWaiting();
  })());
});

self.addEventListener('activate',e=>{
  e.waitUntil((async()=>{
    for(const k of await caches.keys())if(k!==VERSION&&k!==DETECTOR&&k!==C2PA)await caches.delete(k);
    await self.clients.claim();
  })());
});

function conTope(promesa,ms){
  return new Promise((ok,ko)=>{
    const t=setTimeout(()=>ko(new Error('tope')),ms);
    promesa.then(r=>{clearTimeout(t);ok(r)},e=>{clearTimeout(t);ko(e)});
  });
}

self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  const propia=url.origin===self.location.origin;
  if(esDetector(url)||esC2pa(url)){
    e.respondWith((async()=>{
      const cache=await caches.open(esC2pa(url)?C2PA:DETECTOR);
      const guardada=await cache.match(req);
      if(guardada)return guardada;
      const r=await fetch(req);
      if(r.ok)cache.put(req,r.clone());
      return r;
    })());
    return;
  }
  const deCdn=url.origin==='https://cdnjs.cloudflare.com'||url.origin==='https://fonts.googleapis.com'||url.origin==='https://fonts.gstatic.com';
  if(!propia&&!deCdn)return;

  const esPagina=req.mode==='navigate'||url.pathname.endsWith('/index.html');
  if(propia&&(esPagina||CODIGO.some(p=>url.pathname.endsWith('/'+p)))){
    e.respondWith((async()=>{
      const cache=await caches.open(VERSION);
      const clave=esPagina?'index.html':req;
      const red=fetch(req).then(r=>{if(r.ok)cache.put(clave,r.clone());return r});
      try{return await conTope(red,3000)}
      catch{
        const guardada=await cache.match(clave);
        if(guardada){red.catch(()=>{});return guardada}
        return red;
      }
    })());
    return;
  }

  e.respondWith((async()=>{
    const cache=await caches.open(VERSION);
    const guardada=await cache.match(req);
    if(guardada)return guardada;
    const r=await fetch(req);
    if(r.ok&&(deCdn||PAGINA.some(p=>url.pathname.endsWith('/'+p))))cache.put(req,r.clone());
    return r;
  })());
});
