// Mondes & Codes — service worker
// Rôles : installation PWA (icône écran d'accueil), cache léger de l'enveloppe,
// et réception des notifications push du jeu (résolutions de tours).
const CACHE = 'mc-v2';
const ENVELOPPE = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './apple-touch-icon.png', './hero-accueil.jpg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ENVELOPPE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((cles) => Promise.all(cles.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Les appels Supabase (données du jeu) : toujours le réseau, jamais le cache.
  if (url.hostname.endsWith('supabase.co')) return;
  if (e.request.mode === 'navigate' || url.pathname.endsWith('index.html') || url.pathname.endsWith('/')) {
    // Page : réseau d'abord (les nouvelles versions arrivent tout de suite), cache en secours.
    e.respondWith(
      fetch(new Request(e.request.url, { cache: 'no-cache' })).then((res) => {
        const copie = res.clone();
        caches.open(CACHE).then((c) => c.put('./index.html', copie));
        return res;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }
  // Le reste (icônes, image d'accueil, manifeste) : cache d'abord.
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});

// Notifications push : le serveur envoie un JSON {title, body, url}.
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : '' }; }
  const titre = d.title || 'Mondes & Codes';
  e.waitUntil(self.registration.showNotification(titre, {
    body: d.body || 'Un tour a été résolu !',
    icon: './icon-192.png',
    badge: './favicon-64.png',
    data: { url: d.url || './index.html' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const cible = (e.notification.data && e.notification.data.url) || './index.html';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((fenetres) => {
      for (const f of fenetres) { if ('focus' in f) return f.focus(); }
      if (self.clients.openWindow) return self.clients.openWindow(cible);
    })
  );
});
