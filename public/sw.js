// Poppin PWA Service Worker
const CACHE_NAME = 'poppin-v2';
const OFFLINE_URL = '/offline';

// Only cache truly static assets (not HTML pages)
const STATIC_ASSETS = [
  '/offline',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS.map(url => new Request(url, { cache: 'reload' })));
    }).catch((error) => {
      console.error('[SW] Failed to cache static assets:', error);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - network first for pages, cache first for static assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome extensions and other non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Skip map tile requests (let them go directly to network)
  if (url.hostname.includes('stadiamaps') || url.hostname.includes('tile')) {
    return;
  }

  event.respondWith(
    (async () => {
      try {
        // Always try network first for navigation and API calls
        if (request.mode === 'navigate' || isApiCall(url)) {
          console.log('[SW] Network first:', url.pathname);
          const networkResponse = await fetch(request);
          return networkResponse;
        }

        // For static assets, try cache first
        if (isStaticAsset(url)) {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            console.log('[SW] Serving from cache:', url.pathname);
            return cachedResponse;
          }
        }

        // Fetch from network
        console.log('[SW] Fetching from network:', url.pathname);
        const networkResponse = await fetch(request);

        // Cache successful static asset responses
        if (networkResponse.ok && isStaticAsset(url)) {
          const cache = await caches.open(CACHE_NAME);
          console.log('[SW] Caching response:', url.pathname);
          cache.put(request, networkResponse.clone());
        }

        return networkResponse;
      } catch (error) {
        console.log('[SW] Network failed, trying cache:', url.pathname);

        // Try cache as fallback
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }

        // For navigation requests, return offline page
        if (request.mode === 'navigate') {
          const offlineResponse = await caches.match(OFFLINE_URL);
          if (offlineResponse) {
            return offlineResponse;
          }
        }

        // Return a basic offline response
        return new Response('Offline - Please check your connection', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({
            'Content-Type': 'text/plain',
          }),
        });
      }
    })()
  );
});

// Helper function to check if URL is a static asset
function isStaticAsset(url) {
  const staticExtensions = ['.png', '.jpg', '.jpeg', '.svg', '.gif', '.webp', '.woff', '.woff2', '.ttf', '.ico'];
  const pathname = url.pathname;

  // Only cache actual static files, NOT HTML pages or JS/CSS bundles (they change on deploys)
  return staticExtensions.some(ext => pathname.endsWith(ext)) ||
         pathname === '/manifest.json';
}

// Helper function to check if URL is an API call
function isApiCall(url) {
  return url.pathname.startsWith('/api/');
}

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
