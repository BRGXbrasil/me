const CACHE = 'brgx-core-3';
const ASSETS = [
  './',
  './hub.html',
  './brgx.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './standalone/BRGX Dashboard.html',
  './standalone/BRGX Habitos.html',
  './standalone/BRGX Metas.html',
  './standalone/BRGX Caixa.html',
  './standalone/BRGX Oracle.html',
  './standalone/BRGX Recamier.html'
];

// addAll e atomico: um unico asset ausente derrubava o install inteiro e o app
// ficava sem service worker. Cacheia item a item e tolera falhas individuais.
self.addEventListener('install', e => e.waitUntil(
  caches.open(CACHE).then(c => Promise.all(
    ASSETS.map(url => c.add(url).catch(() => {}))
  ))
));

self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(keys => Promise.all(
    keys.filter(k => k !== CACHE).map(k => caches.delete(k))
  ))
));

self.addEventListener('fetch', e => e.respondWith(
  fetch(e.request).then(r => {
    const copy = r.clone();
    caches.open(CACHE).then(c => c.put(e.request, copy));
    return r;
  }).catch(() => caches.match(e.request).then(r => r || caches.match('./hub.html')))
));
