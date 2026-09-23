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
   - Las llamadas a las API (OpenAI, Gemini, GitHub) no se tocan nunca. */
const VERSION='ap-v1.2.0';
const PAGINA=['./','index.html','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','docs/manual-demo.pdf'];
const CDN=[
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/marked/9.1.6/marked.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.1.6/purify.min.js'
];
const FUENTES='https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap';

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
    for(const k of await caches.keys())if(k!==VERSION)await caches.delete(k);
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
  const deCdn=url.origin==='https://cdnjs.cloudflare.com'||url.origin==='https://fonts.googleapis.com'||url.origin==='https://fonts.gstatic.com';
  if(!propia&&!deCdn)return;

  if(propia&&(req.mode==='navigate'||url.pathname.endsWith('/index.html'))){
    e.respondWith((async()=>{
      const cache=await caches.open(VERSION);
      const red=fetch(req).then(r=>{if(r.ok)cache.put('index.html',r.clone());return r});
      try{return await conTope(red,3000)}
      catch{
        const guardada=await cache.match('index.html');
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
