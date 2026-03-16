// Service Worker — Workbox-style caching strategies + push notification support
/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;
export type {}; // make this a module

// ─── Cache Names ────────────────────────────────────────────────────────────
const CACHE_VERSION = 'v2';
const CACHES = {
  shell: `aegilume-shell-${CACHE_VERSION}`,
  assets: `aegilume-assets-${CACHE_VERSION}`,
  api: `aegilume-api-${CACHE_VERSION}`,
} as const;

// App shell URLs to precache on install
const SHELL_URLS = ['/', '/index.html', '/manifest.json'];

// ─── Install — precache app shell ───────────────────────────────────────────
self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches
      .open(CACHES.shell)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

// ─── Activate — purge old caches ────────────────────────────────────────────
self.addEventListener('activate', (event: ExtendableEvent) => {
  const validCaches = new Set<string>(Object.values(CACHES));
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !validCaches.has(k)).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// ─── Fetch — routing strategies ─────────────────────────────────────────────
self.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and WebSocket requests
  if (request.method !== 'GET') return;
  if (url.protocol === 'ws:' || url.protocol === 'wss:') return;
  // Skip chrome-extension and other non-http schemes
  if (!url.protocol.startsWith('http')) return;

  // API calls — network-first, fall back to cache (short TTL)
  if (url.pathname.startsWith('/api/') || url.hostname !== self.location.hostname) {
    event.respondWith(networkFirst(request, CACHES.api));
    return;
  }

  // Static assets (JS, CSS, images, fonts) — cache-first
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request, CACHES.assets));
    return;
  }

  // HTML navigation — stale-while-revalidate (app shell pattern)
  event.respondWith(staleWhileRevalidate(request, CACHES.shell));
});

// ─── Strategy: Cache-First ───────────────────────────────────────────────────
async function cacheFirst(request: Request, cacheName: string): Promise<Response> {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return offlineFallback(request);
  }
}

// ─── Strategy: Network-First ─────────────────────────────────────────────────
async function networkFirst(request: Request, cacheName: string): Promise<Response> {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached ?? offlineFallback(request);
  }
}

// ─── Strategy: Stale-While-Revalidate ───────────────────────────────────────
async function staleWhileRevalidate(request: Request, cacheName: string): Promise<Response> {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached ?? offlineFallback(request));

  return cached ?? fetchPromise;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function isStaticAsset(pathname: string): boolean {
  return /\.(js|css|png|jpg|jpeg|webp|svg|gif|woff2?|ttf|eot|ico)(\?.*)?$/.test(pathname);
}

function offlineFallback(request: Request): Response {
  const isNavigation = request.mode === 'navigate';
  if (isNavigation) {
    return new Response(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Aegilume — Offline</title>
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <style>body{background:#0a0a0e;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column;gap:12px}
      h1{color:#e85d3a;font-size:1.5rem;margin:0}p{opacity:.6;font-size:.9rem;margin:0}</style>
      </head><body><h1>Aegilume</h1><p>You're offline. Reconnect to continue.</p></body></html>`,
      { status: 503, headers: { 'Content-Type': 'text/html' } }
    );
  }
  return new Response(JSON.stringify({ error: 'offline' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ─── Background Sync — queue offline actions ─────────────────────────────────
// SyncEvent is part of the Background Sync API (not yet in default TS lib)
interface SyncEvent extends ExtendableEvent {
  readonly tag: string;
  readonly lastChance: boolean;
}

self.addEventListener('sync' as any, (event: SyncEvent) => {
  if (event.tag === 'aegilume-action-queue') {
    event.waitUntil(flushActionQueue());
  }
});

async function flushActionQueue(): Promise<void> {
  // Notify all clients to flush their queued actions now that we're online
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach((client) => client.postMessage({ type: 'FLUSH_ACTION_QUEUE' }));
}

// ─── Push Notifications ──────────────────────────────────────────────────────
self.addEventListener('push', (event: PushEvent) => {
  let payload: { title?: string; body?: string; tag?: string; url?: string } = {};
  try {
    payload = event.data?.json() ?? {};
  } catch {
    payload = { title: 'Aegilume', body: event.data?.text() ?? 'New notification' };
  }

  const title = payload.title ?? 'Aegilume';
  const options: NotificationOptions = {
    body: payload.body ?? '',
    icon: '/icon-192.svg',
    badge: '/icon-192.svg',
    tag: payload.tag ?? 'openclaw-default',
    data: { url: payload.url ?? '/' },
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const targetUrl: string = event.notification.data?.url ?? '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        const existing = clients.find((c) => c.url === targetUrl);
        if (existing) return existing.focus();
        return self.clients.openWindow(targetUrl);
      })
  );
});

// ─── Message handling (from app) ─────────────────────────────────────────────
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
