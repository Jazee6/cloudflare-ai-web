---
status: proposed
---

# Inject Context Attachments and Knowledge Base retrieval before inference

For document conversion (Workers AI `toMarkdown`), webpage extraction (three-tier zero-quota-first fallback), and Knowledge Base retrieval (read-only Cloudflare AI Search), v6.0 performs preprocessing and search on the server before calling `streamText` instead of relying on model Tool Calling. Truncated Markdown from documents and webpages persists with the user message as a Context Attachment in Conversation History (excluding raw document binaries), whereas Knowledge Base excerpts are injected only into the current Model Context and persisted solely as lightweight Citations in `ResponseMetadata`.

## Considered Options

- Expose `fetch_url` and `search_knowledge_base` as Tool Calling functions, which excludes Cloudflare Models without tool-calling support and risks exhausting Browser Run's daily 10-minute free quota or daily Neurons through multi-step agent loops.
- Store original PDF/DOCX blobs or full retrieved Knowledge Base chunks in browser IndexedDB, bloating storage and inflating subsequent Model Context payloads.
- Add R2 document upload and index management inside the app, breaking the stateless lightweight boundary.

## Consequences

Every `Text Generation` model—including legacy Cloudflare Models—gains uniform document, web, and Knowledge Base grounding. Server-side webpage fetching requires strict SSRF protections, Knowledge Base access requires an explicit `CF_AI_SEARCH_INSTANCES` allowlist to prevent exposing other private indexes on the account, and Retry must re-run Knowledge Base retrieval and replace prior Citations.
