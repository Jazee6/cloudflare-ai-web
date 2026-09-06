---
status: accepted
---

# Use Cloudflare as the authoritative Workers AI model catalog

The application will derive all Cloudflare Models from the account-scoped Cloudflare models API instead of maintaining a local allowlist. The server loads the catalog for the initial render, caches each supported task for one hour, and retains each task's last successful in-process Catalog Snapshot when refreshes fail; this favors immediate discovery of new models over the stricter compatibility guarantees of a verified allowlist.

## Consequences

External Models remain explicitly registered and are presented in a separate group. Experimental Cloudflare Models remain selectable and visibly marked, deprecated models are excluded, ambiguous Capability Signals disable the corresponding interaction, and newly discovered image models use the common prompt request and supported single-image response shapes rather than requiring per-model adapters. A process restart loses the Catalog Snapshot, so a failed first fetch can legitimately produce an empty Cloudflare catalog.
