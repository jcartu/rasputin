// RASPUTIN Service Worker v2
const CACHE_NAME = "rasputin-v2";
const STATIC_ASSETS = [
  "/",
  "/chat",
  "/login",
  "/icon-192.png",
  "/icon-512.png",
  "/favicon.ico",
  "/manifest.json",
];

// Install event - cache static assets
self.addEventListener("install", event => {
  console.log("[SW] Installing service worker...");
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log("[SW] Caching static assets");
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.log("[SW] Cache addAll failed, continuing anyway:", err);
        return Promise.resolve();
      });
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener("activate", event => {
  console.log("[SW] Activating service worker...");
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log("[SW] Deleting old cache:", name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - network first, fallback to cache
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== "GET") return;

  // Skip API requests - always go to network
  if (url.pathname.startsWith("/api/")) return;

  // Skip WebSocket requests
  if (url.pathname.startsWith("/socket.io/")) return;

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith("http")) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Only cache successful responses
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache
        return caches.match(event.request).then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Return offline page for navigation requests
          if (event.request.mode === "navigate") {
            return caches.match("/");
          }
          return new Response("Offline", { status: 503 });
        });
      })
  );
});

// Handle messages from the main thread
self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
