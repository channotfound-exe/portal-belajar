const CACHE_VERSION = "portal-v4";
const RUNTIME_CACHE = "portal-runtime-v4";

const PRECACHE_URLS = [
  "./",
  "index.html",
  "styles.css",
  "app.js",
  "manifest.json",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "data/courses_index.json",
  "data/courses/alprog.json",
  "data/courses/analitik_big_data.json",
  "data/courses/bahasa_indonesia.json",
  "data/courses/basis_data_nosql.json",
  "data/courses/dasar_infrastruktur_ti.json",
  "data/courses/data_mining.json",
  "data/courses/kalkulus_diferensial.json",
  "data/courses/pancasila.json",
  "data/courses/pengantar_kecerdasan_artifisial.json",
  "data/courses/pengantar_sains_data.json",
  "data/courses/pengantar_sistem_informasi.json",
  "data/courses/pengantar_statistika_matematis.json",
  "data/courses/statistika.json"
];

const CDN_HOSTS = new Set([
  "cdn.jsdelivr.net",
  "fonts.googleapis.com",
  "fonts.gstatic.com"
]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  const allowed = new Set([CACHE_VERSION, RUNTIME_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (!allowed.has(key)) {
              return caches.delete(key);
            }
            return Promise.resolve();
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // 1. Local same-origin assets: Cache-First
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request)
          .then((res) => {
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(CACHE_VERSION).then((c) => c.put(event.request, copy));
            }
            return res;
          })
          .catch(() => {
            if (event.request.mode === "navigate") {
              return caches.match("index.html");
            }
            return new Response("Offline", { status: 503, statusText: "Offline" });
          });
      })
    );
    return;
  }

  // 2. External CDN (Pyodide, KaTeX, Marked.js, Google Fonts): Stale-While-Revalidate
  if (CDN_HOSTS.has(url.hostname)) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then((cache) =>
        cache.match(event.request).then((cached) => {
          const networkFetch = fetch(event.request)
            .then((res) => {
              if (res && (res.ok || res.type === "opaque")) {
                cache.put(event.request, res.clone());
              }
              return res;
            })
            .catch(() => cached);

          if (cached) {
            event.waitUntil(networkFetch);
            return cached;
          }
          return networkFetch;
        })
      )
    );
  }
});
