const CACHE_NAME = 'sthalpothi-shell-v1';
const CONTENT_CACHE = 'sthalpothi-content-v1';

const OFFLINE_URL = '/offline.html';

// List your core shell files here (update paths to match your repo)
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Install: cache core shell
self.addEventListener('install', (evt) => {
  evt.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_ASSETS).catch(() => {
        // ignore if some assets missing during dev
      });
    })
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (evt) => {
  evt.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((k) => {
          if (![CACHE_NAME, CONTENT_CACHE].includes(k)) return caches.delete(k);
        })
      )
    )
  );
  self.clients.claim();
});

// Fetch: serve shell from cache (cache-first), content network-first then cache
self.addEventListener('fetch', (evt) => {
  const req = evt.request;
  const url = new URL(req.url);

  // For navigation requests (pages) -> try network first, fallback to cached page, then offline page
  if (req.mode === 'navigate' || (req.method === 'GET' && req.headers.get('accept')?.includes('text/html'))) {
    evt.respondWith(
      fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CONTENT_CACHE).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() =>
        caches.match(req).then((r) => r || caches.match(OFFLINE_URL))
      )
    );
    return;
  }

  // For other requests: static assets -> cache-first
  evt.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          // optionally cache fetched asset
          if (req.method === 'GET' && res && res.status === 200 && req.destination !== 'document') {
            const resClone = res.clone();
            caches.open(CONTENT_CACHE).then((c) => c.put(req, resClone));
          }
          return res;
        })
        .catch(() => {
          // last-resort: if request is an image, return a tiny inline fallback or nothing
          if (req.destination === 'image') {
            return new Response('', { status: 404 });
          }
        });
    })
  );
});