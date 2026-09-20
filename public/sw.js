const CACHE = "investment-os-shell-v5";
// Private API data, HTML and auth redirects never enter persistent storage.
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("investment-os-shell-") && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin || !/^\/assets\/.+\.(?:js|css|woff2?|png|svg|webp)$/.test(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(event.request);
    if (hit) return hit;
    const response = await fetch(event.request);
    if (response.ok && !response.redirected && !response.headers.get("content-type")?.includes("text/html")) {
      try { await cache.put(event.request, response.clone()); } catch { /* Cache quota must not block the request. */ }
    }
    return response;
  })());
});
