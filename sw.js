const CACHE = 'brgx-core-6';
const ASSETS = [
  './',
  './index.html',
  './brgx.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './assets/brgx-tokens.css',
  './assets/brgx-shared.js',
  './assets/brgx-specialist.js',
  './standalone/BRGX Dashboard.html',
  './standalone/BRGX Rotina.html',
  './standalone/BRGX Metas.html',
  './standalone/BRGX Caixa.html',
  './standalone/BRGX Oracle.html',
  './standalone/BRGX Recamier.html',
  './standalone/BRGX Pet.html',
  './standalone/BRGX Estilo.html',
  './standalone/BRGX Reeducacao.html'
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
  }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
));
