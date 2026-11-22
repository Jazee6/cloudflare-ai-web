---
status: accepted
---

# Allow visitor-configured Personal Providers routed through AI Gateway

v6.0 reopens the option ADR-0004 rejected: a visitor may configure Personal Providers in their own browser, made up of an AI Gateway–supported provider, their own upstream key, and optionally their own AI Gateway (account ID, gateway name, token). Credentials live in plaintext localStorage, are sent with each request, and are never stored by the server or included in backups. Requests always go through an AI Gateway and never through an arbitrary base URL, so there is no new SSRF surface. Cost abuse, which was the reason for the original rejection, is avoided because a request through the deployment's gateway must carry the visitor's own provider key. The deployment's BYOK and Unified Billing therefore only ever serve External Models declared in `CF_AI_GATEWAY_MODELS`, and the provider key is optional only when the visitor brings their own gateway. Access Session still guards every inference API.

## Considered Options

- Keep ADR-0004 as is (deployment-declared External Models only).
- Accept arbitrary OpenAI-compatible base URLs, rejected because it turns the server into a general proxy that needs SSRF hardening for every request.
- Call upstream providers directly from the browser, rejected because of CORS and because Workers AI and AI Gateway features would be unavailable.
- Let Personal Provider requests bypass Access Session, rejected because the server still spends the deployment's gateway token, document conversion, and Knowledge Base quota on them.

## Consequences

`CF_ACCOUNT_ID` and `CF_WORKERS_AI_TOKEN` become optional; without them the deployment offers only Personal Models, and the features that depend on them switch off through the existing capability flags. A catalog loaded with visitor credentials must never enter the public `/api/models` edge cache. Personal Model capabilities follow the same "undeclared means unavailable" rule as External Models. In v6.0, Personal image generation supports the OpenAI Images API shape and Gemini image output.
