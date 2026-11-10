const CACHE_VERSION = "lanbai-cuoti-v1";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/base.css",
  "./css/layout.css",
  "./css/components.css",
  "./js/app.js",
  "./js/store.js",
  "./js/settings.js",
  "./js/ocr.js",
  "./js/remind.js",
  "./js/components/modal.js",
  "./js/components/toast.js",
  "./js/utils/date.js",
  "./js/utils/dom.js",
  "./js/utils/image.js",
  "./js/utils/mistake.js",
  "./js/views/home.js",
  "./js/views/mistakes.js",
  "./js/views/plans.js",
  "./js/views/focus.js",
  "./js/views/settings.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-192.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
];

const CDN_HOSTS = ["cdn.jsdelivr.net", "unpkg.com", "fastly.jsdelivr.net", "gcore.jsdelivr.net"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      await Promise.allSettled(APP_SHELL.map((url) => cache.add(new Request(url, { cache: "reload" }))));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();
});

function isCdn(url) {
  return CDN_HOSTS.some((host) => url.hostname === host);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (request.mode === "navigate" || (request.headers.get("accept") || "").includes("text/html")) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(CACHE_VERSION);
          cache.put("./index.html", fresh.clone());
          return fresh;
        } catch (err) {
          const cache = await caches.open(CACHE_VERSION);
          const cached = (await cache.match("./index.html")) || (await cache.match("./"));
          if (cached) return cached;
          throw err;
        }
      })()
    );
    return;
  }

  if (isCdn(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_VERSION);
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const fresh = await fetch(request);
          if (fresh && fresh.ok && fresh.type !== "opaque") {
            cache.put(request, fresh.clone()).catch(() => {});
          }
          return fresh;
        } catch (err) {
          if (cached) return cached;
          throw err;
        }
      })()
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            cache.put(request, response.clone()).catch(() => {});
          }
          return response;
        })
        .catch(() => null);
      if (cached) {
        network.catch(() => {});
        return cached;
      }
      const fresh = await network;
      if (fresh) return fresh;
      return new Response("离线且无缓存", { status: 503, statusText: "offline-no-cache" });
    })()
  );
});