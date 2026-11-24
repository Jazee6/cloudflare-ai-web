// Service Worker template; the build replaces __BUILD_ID__ and the precache list (see
// scripts/vite-plugin-site-files.ts and docs/adr/0010). The shell, entry and route chunks are
// precached; other hashed assets are cached the first time they are used. /api/* is never
// intercepted.
const CACHE_PREFIX = "cf-ai-web-";
const CACHE = `${CACHE_PREFIX}__BUILD_ID__`;
const SHELL = "/index.html";
const STATIC_FILES = ["/icon.svg", "/manifest.webmanifest"];
const PRECACHE = self.__PRECACHE__ ?? [];

const isAsset = (url) => url.origin === self.location.origin && url.pathname.startsWith("/assets/");

const isHtml = (response) =>
  response.ok && (response.headers.get("content-type") ?? "").includes("text/html");

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const response = await fetch("/", { cache: "reload" });
      if (!isHtml(response)) {
        throw new Error(`Failed to fetch the app shell (${response.status})`);
      }
      const html = await response.clone().text();
      const assets = new Set(PRECACHE);
      for (const match of html.matchAll(/(?:href|src)="(\/assets\/[^"]+)"/g)) {
        assets.add(match[1]);
      }
      await cache.put(SHELL, response);
      await cache.addAll([...assets, ...STATIC_FILES]);
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith(CACHE_PREFIX) && key !== CACHE) {
          await caches.delete(key);
        }
      }
    })(),
  );
});

// The first visit loads its assets before this worker controls the page; the page reports them.
self.addEventListener("message", (event) => {
  if (event.data?.type !== "cache-assets" || !Array.isArray(event.data.urls)) {
    return;
  }
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      for (const href of event.data.urls) {
        const url = new URL(href, self.location.origin);
        if (isAsset(url) && !(await cache.match(url))) {
          await cache.add(url).catch(() => {});
        }
      }
    })(),
  );
});

const navigate = async (request) => {
  try {
    const response = await fetch(request);
    // A redirected response cannot answer a later navigation, so only a direct one is kept.
    if (isHtml(response) && !response.redirected) {
      const cache = await caches.open(CACHE);
      await cache.put(SHELL, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(SHELL, { cacheName: CACHE });
    if (cached) {
      return cached;
    }
    throw error;
  }
};

const cacheFirst = async (request) => {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  }
  return response;
};

const networkFirst = async (request) => {
  try {
    return await fetch(request);
  } catch (error) {
    const cached = await caches.match(request, { cacheName: CACHE });
    if (cached) {
      return cached;
    }
    throw error;
  }
};

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }
  if (url.pathname.startsWith("/api/")) {
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(navigate(request));
  } else if (isAsset(url)) {
    event.respondWith(cacheFirst(request));
  } else if (STATIC_FILES.includes(url.pathname)) {
    event.respondWith(networkFirst(request));
  }
});
