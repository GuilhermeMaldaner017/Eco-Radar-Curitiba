/* EcoRadar Curitiba: cache local de tiles do mapa para navegação instantânea. */
const TILE_CACHE = "ecoradar-tiles-v1";
const TILE_HOST = "server.arcgisonline.com";
const MAX_ENTRIES = 1800;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("ecoradar-tiles-") && k !== TILE_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trim(cache) {
  const keys = await cache.keys();
  if (keys.length <= MAX_ENTRIES) return;
  await Promise.all(keys.slice(0, keys.length - MAX_ENTRIES).map((k) => cache.delete(k)));
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.hostname !== TILE_HOST) return;

  event.respondWith(
    caches.open(TILE_CACHE).then(async (cache) => {
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok && res.type !== "opaque") {
        cache.put(req, res.clone()).then(() => trim(cache)).catch(() => {});
      }
      return res;
    })
  );
});
