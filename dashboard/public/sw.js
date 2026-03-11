const CACHE_NAME = "openclaw-dashboard-shell-v3";
const SHELL_CACHE_KEY = "/__dashboard_shell__";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);

        try {
          const response = await fetch(request);
          if (response.ok) {
            cache.put(SHELL_CACHE_KEY, response.clone());
          }
          return response;
        } catch (error) {
          const cachedShell = await cache.match(SHELL_CACHE_KEY);
          if (cachedShell) {
            return cachedShell;
          }
          throw error;
        }
      })(),
    );
    return;
  }

  const isStaticAsset =
    url.pathname.startsWith("/_next/") ||
    /\.(?:css|js|woff2?|png|jpg|jpeg|svg|webp|gif|ico)$/.test(url.pathname);

  if (!isStaticAsset) {
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request, { cache: "no-store" });
        if (response.ok) {
          cache.put(request, response.clone());
        }
        return response;
      } catch (error) {
        const cached = await cache.match(request);
        if (cached) {
          return cached;
        }
        throw error;
      }
    })(),
  );
});
