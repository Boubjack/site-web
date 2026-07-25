/* E-Market — Service Worker (PWA : chargement ultra rapide + mode hors ligne).
 *
 * Stratégies :
 *   - navigations : réseau d'abord, repli sur la page hors ligne ;
 *   - statiques même origine (css/js/svg/img) : cache d'abord, MAJ en fond ;
 *   - API (/api/…) : réseau uniquement (jamais mis en cache).
 * Le cache est versionné : changer CACHE purge automatiquement l'ancien.
 */
const CACHE = 'emarket-v1';
const SHELL = [
  '/', '/index.html', '/offline.html',
  '/css/emarket.css', '/js/app.js', '/js/assistant-widget.js',
  '/icon.svg', '/manifest.webmanifest',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;      // pas de tiers
  if (url.pathname.startsWith('/api/')) return;         // API : toujours réseau

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/offline.html')));
    return;
  }

  // Statiques : cache d'abord, rafraîchi en arrière-plan (stale-while-revalidate).
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    }),
  );
});
