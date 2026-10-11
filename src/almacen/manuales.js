// Asistente de Piso · Copyright (c) 2026 Gerardo Barrera.
// Licencia PolyForm Noncommercial 1.0.0: uso comercial solo con licencia escrita (LICENCIA-COMERCIAL.md).
//
// Los manuales guardados en el dispositivo (IndexedDB): abrir, leer, listar,
// borrar y el hash del archivo con que se reconocen.
//
// Procesar 28 láminas cuesta ~20 s. Se guarda el índice ya cocinado —texto,
// fragmentos y figuras— indexado por el hash del archivo. Vive en el
// dispositivo del asesor, nunca sale a la red, y hay un botón visible para
// borrarlo. Las API keys siguen en sessionStorage: aquí no entra ninguna
// credencial.
//
// Salió de app.js en el paso 7 del ADR 0005, sin cambiar nada de lo que hace.
// Qué se guarda de cada manual y cómo se restaura se queda en app.js.

export const DB_NOMBRE='asistente_piso',DB_STORE='manuales',DB_VERSION=1;
export function abrirDB(){
  return new Promise((resolve,reject)=>{
    if(!window.indexedDB)return reject(new Error('sin IndexedDB'));
    const req=indexedDB.open(DB_NOMBRE,DB_VERSION);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains(DB_STORE))db.createObjectStore(DB_STORE,{keyPath:'hash'});
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  })
}
export function txDB(modo,fn){
  return abrirDB().then(db=>new Promise((resolve,reject)=>{
    const tx=db.transaction(DB_STORE,modo);
    const req=fn(tx.objectStore(DB_STORE));
    tx.oncomplete=()=>{db.close();resolve(req&&req.result)};
    tx.onerror=()=>{db.close();reject(tx.error)};
    /* Sin cuota, la transacción se aborta SIN disparar error: la promesa no
       terminaba nunca y la carga del manual se quedaba colgada en la barra de
       progreso, sin procesar los siguientes. */
    tx.onabort=()=>{db.close();reject(tx.error||new Error('transacción abortada'))};
  }))
}
export async function hashArchivo(file){
  const buf=await file.arrayBuffer();
  const digest=await crypto.subtle.digest('SHA-256',buf);
  return[...new Uint8Array(digest)].slice(0,10).map(b=>b.toString(16).padStart(2,'0')).join('')
}
export const leerManual=hash=>txDB('readonly',st=>st.get(hash)).catch(()=>null);
export const listarManuales=()=>txDB('readonly',st=>st.getAll()).catch(()=>[]);
export const borrarManual=hash=>txDB('readwrite',st=>st.delete(hash));
