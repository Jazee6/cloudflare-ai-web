---
status: accepted
---

# Migrate from Next.js to TanStack Start in SPA mode

v6.0 replaces Next.js 16 and OpenNext with TanStack Start running in SPA mode: every page is a static shell whose data comes from IndexedDB and client-side fetches, while the server only hosts the existing `/api/*` Server Routes behind a global request middleware that replaces `proxy.ts`. Cloudflare Workers builds through `@cloudflare/vite-plugin`, and Vercel and Docker/Node build through Nitro presets, so all three deployment targets survive while the OpenNext adapter and its cookie interop patch script disappear. With asset routing configured so deep links fall back to the SPA shell and only `/api/*` runs the Worker first, static pages are served as assets and Workers Free spends Worker CPU only on API requests, which completes the intent of ADR-0003 rather than working around the framework.

## Considered Options

- Stay on Next.js with OpenNext, keeping the post-build `cookie` patch and the `force-dynamic` pitfalls ADR-0003 had to route around.
- TanStack Start with default SSR, which brings little benefit because all content is local to the browser and every page view would cost Worker CPU.
- Replacing `/api/*` with `createServerFn`, rejected so the HTTP contract, the `useChat` transport, the `/api/models` edge cache, and the existing route tests carry over unchanged.

## Consequences

Two build configurations (Cloudflare Vite plugin vs Nitro) must be kept in sync. `next-themes`, theme cookies, and model preference cookies are replaced by localStorage plus an inline pre-paint script, and source moves under `src/` with `@/` pointing at it.
