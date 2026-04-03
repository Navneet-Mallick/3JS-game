// Neo-Noir City Service Worker for PWA Installation
const CACHE_NAME = 'neo-noir-city-v1.0.0';
const STATIC_CACHE = 'neo-noir-static-v1.0.0';
const DYNAMIC_CACHE = 'neo-noir-dynamic-v1.0.0';

// Files to cache for offline play
const STATIC_FILES = [
  '/',
  '/index.html',
  '/style.css',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-1024.png'
];

// Install event - cache static files
self.addEventListener('install', (event) => {
  console.log('🎮 Neo-Noir City: Installing service worker...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('📦 Caching static files...');
        return cache.addAll(STATIC_FILES);
      })
      .catch((error) => {
        console.log('❌ Cache installation failed:', error);
        // Don't fail the installation if caching fails
        return Promise.resolve();
      })
      .then(() => {
        console.log('✅ Installation complete!');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('🔄 Neo-Noir City: Activating service worker...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('🗑️ Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('✅ Activation complete!');
        return self.clients.claim();
      })
      .catch((error) => {
        console.log('❌ Activation failed:', error);
        return Promise.resolve();
      })
  );
});

// Fetch event - serve from cache, then network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and external requests
  if (request.method !== 'GET' || url.origin !== location.origin) {
    return;
  }

  event.respondWith(
    caches.match(request)
      .then((response) => {
        // Return cached version if available
        if (response) {
          return response;
        }

        // Otherwise, fetch from network
        return fetch(request)
          .then((networkResponse) => {
            // Cache successful responses
            if (networkResponse.ok) {
              return caches.open(DYNAMIC_CACHE)
                .then((cache) => {
                  cache.put(request, networkResponse.clone());
                  return networkResponse;
                });
            }
            return networkResponse;
          })
          .catch(() => {
            // Offline fallback - try to serve from any cache
            console.log('📵 Offline - serving from cache');
            return caches.match('/');
          })
          .catch(() => {
            // Final fallback
            return new Response('Neo-Noir City is offline. Please check your connection.', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
      })
      .catch((error) => {
        console.log('❌ Fetch error:', error);
        return new Response('Neo-Noir City - Error loading resource', {
          status: 500,
          statusText: 'Internal Server Error'
        });
      })
  );
});

// Background sync for save games
self.addEventListener('sync', (event) => {
  if (event.tag === 'save-game') {
    event.waitUntil(
      // Sync save games to server/storage
      console.log('💾 Syncing save games...')
    );
  }
});

// Push notifications for game updates
self.addEventListener('push', (event) => {
  const options = {
    body: 'New update available for Neo-Noir City!',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    data: {
      url: '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification('Neo-Noir City Update', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});

// Periodic background sync for game updates
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'game-updates') {
    event.waitUntil(
      // Check for game updates
      console.log('🔄 Checking for game updates...')
    );
  }
});

// Error handling
self.addEventListener('error', (event) => {
  console.log('❌ Service Worker Error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.log('❌ Unhandled Promise Rejection:', event.reason);
});
