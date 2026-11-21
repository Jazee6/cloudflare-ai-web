---
status: proposed
---

# Decouple Model Catalog loading from RootLayout SSR

To support Cloudflare Workers Free (which enforces a 10ms CPU time limit per request) while maintaining parity across Vercel and Docker, v6.0 revises ADR-0001 by moving Model Catalog loading out of `RootLayout`'s `force-dynamic` SSR path and into a cacheable public read-only endpoint (`GET /api/models`, exempted in `proxy.ts` alongside `/api/auth`). The endpoint exposes only the catalog and non-sensitive boolean feature flags using the existing one-hour TTL and edge/in-process Catalog Snapshot fallback, while all inference, context extraction, and Knowledge Base endpoints remain guarded by Access Session.

## Considered Options

- Keep loading the Model Catalog in `RootLayout` SSR and treat Workers Free 10ms CPU timeouts as best-effort, pushing Free users toward Vercel or paid plans.
- Switch the Workers build target to `vinext`, which introduces a dual build stack alongside Next.js 16 across Vercel and Docker.
- Gate `GET /api/models` behind Access Session, which would block the unauthenticated shell from rendering model choices before login.

## Consequences

Revises the initial-render loading assumption of ADR-0001. The application shell becomes static/lightweight with a `Skeleton` loading state while the client fetches `/api/models`, and Workers deployments can pair `caches.default` with the in-process Catalog Snapshot to minimize cold-start CPU work.
