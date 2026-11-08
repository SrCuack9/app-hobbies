// Service worker de App Hobbies. RED PRIMERO: siempre intenta traer lo último y actualiza la
// caché; solo tira de caché sin conexión. Así la app se actualiza sola al publicar.
// Aun así, al cambiar JS o CSS se sube CACHE_NAME para limpiar la caché vieja.
const CACHE_NAME = 'app-hobbies-v1';
const ASSETS = ['./', './index.html', './logic.js', './seed.js', './cola-ableton.js', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k.startsWith('app-hobbies-') && k !== CACHE_NAME).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return; // enlaces externos (la ruta en claude.ai): sin tocar
  // La app es una sola página: toda navegación se guarda como index.html, venga con la URL que venga
  // (con «?hoy=…» de las pruebas, por ejemplo), para no llenar la caché de copias iguales.
  const clave = e.request.mode === 'navigate' ? './index.html' : e.request;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) {
          const copia = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(clave, copia)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })
        .then(r => r || (e.request.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  );
});
