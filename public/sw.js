// Poppin PWA Service Worker
const CACHE_NAME = 'poppin-v1';
const OFFLINE_URL = '/offline';

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/map',
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

// Fetch event - serve from cache, fallback to network
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

  event.respondWith(
    (async () => {
      try {
        // Try cache first for static assets
        if (isStaticAsset(url)) {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            console.log('[SW] Serving from cache:', url.pathname);
            return cachedResponse;
          }
        }

        // Try network first for API calls and dynamic content
        console.log('[SW] Fetching from network:', url.pathname);
        const networkResponse = await fetch(request);

        // Cache successful responses
        if (networkResponse.ok) {
          const cache = await caches.open(CACHE_NAME);

          // Cache static assets and API responses
          if (isStaticAsset(url) || isApiCall(url)) {
            console.log('[SW] Caching response:', url.pathname);
            cache.put(request, networkResponse.clone());
          }
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
  const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.svg', '.gif', '.webp', '.woff', '.woff2', '.ttf', '.ico'];
  const pathname = url.pathname;

  return staticExtensions.some(ext => pathname.endsWith(ext)) ||
         pathname.startsWith('/_next/static/') ||
         pathname === '/' ||
         pathname === '/map' ||
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
