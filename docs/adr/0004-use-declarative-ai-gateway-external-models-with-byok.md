---
status: accepted (revised by ADR-0007)
---

# Use declarative AI Gateway External Models with BYOK-only credentials

In v6.0, `CF_AI_GATEWAY_PROVIDERS`, `NEXT_PUBLIC_CF_AI_GATEWAY_PROVIDERS`, and `GOOGLE_API_KEY` are removed without backward compatibility; all External Models and Gateway Routes are declared via `CF_AI_GATEWAY_MODELS`, with upstream provider credentials managed solely in Cloudflare AI Gateway via BYOK (free across plans) or Unified Billing. Requests route through `ai-gateway-provider/providers/unified` (or `ai-gateway-provider/providers/google` without an application key when native Google Search is enabled), requiring zero upstream secrets in application configuration and zero new npm dependencies.

## Considered Options

- Continue maintaining a hardcoded list of External Models and per-provider API key environment variables in the application.
- Allow visitors to enter arbitrary `provider/model` or `dynamic/...` identifiers from the UI, which risks cost abuse on public or shared-password deployments.
- Maintain dual support for legacy 5.x environment variables alongside `CF_AI_GATEWAY_MODELS`.

## Consequences

Because AI Gateway unified endpoints do not publish remote Capability Signals, undeclared capabilities remain strictly disabled for External Models and Gateway Routes. Triggers of Retry must attach `cf-aig-skip-cache: true` so cached responses are not replayed, and v6.0 documentation must provide an explicit 5.x-to-6.0 environment variable migration guide.
