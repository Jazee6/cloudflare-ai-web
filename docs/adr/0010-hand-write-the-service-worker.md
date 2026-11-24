---
status: accepted
---

# Hand-write the Service Worker instead of using vite-plugin-pwa

The PWA ships a hand-written Service Worker (`scripts/service-worker.js`) that a small Vite plugin emits as `/sw.js` at the end of the client build, stamped with a build ID, rather than `vite-plugin-pwa`/Workbox. The app builds through two different pipelines (`@cloudflare/vite-plugin` and Nitro presets, ADR-0006) on top of TanStack Start's SPA prerender, and `vite-plugin-pwa` makes no compatibility promise for that combination, while the worker we need is small.

It precaches only the app shell and the assets the shell references, discovered by reading `index.html` at install time, not the whole client output: the build is several megabytes, mostly per-language syntax highlighting chunks that most visitors never load. Other hashed `/assets/*` are cached the first time they are used, and the page hands the worker the assets it loaded before the worker controlled it, so the first visit is enough to open offline. Navigations are network-first with the cached shell as fallback, and `/api/*` is never intercepted. The worker follows the standard lifecycle without `skipWaiting`, so open tabs never lose the lazy chunks they were built against; old caches are cleared only when the new worker activates.

## Considered Options

- `vite-plugin-pwa` (Workbox): declarative and feature-rich, but adds a dependency tree and must be proven on all three deployment targets.
- Precaching the full build manifest: makes every route and language work offline at once, at the cost of a multi-megabyte download on the first visit.
- A manifest with a no-op worker (installable only): rejected because Conversation History is local, so opening the app offline is genuinely useful.

## Consequences

Caching strategy changes are code changes in `scripts/service-worker.js`, and both build paths must be checked to emit it at the site root. A code-highlighting language or route never used online is unavailable offline.
