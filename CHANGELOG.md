# Changelog

## 6.0.0

### Breaking Changes

- **Framework**: migrated from Next.js 16 + OpenNext to TanStack Start in SPA mode (Vite, Nitro). Pages are a static shell; the server only handles `/api/*`. Source moved under `src/`.
- **Deployment**: one codebase builds for Cloudflare Workers (`bun run cf:build` / `cf:deploy`, `@cloudflare/vite-plugin`), Vercel (Nitro `vercel` preset), and Docker / Node (`node .output/server/index.mjs`). Existing Vercel projects whose Framework Preset is Next.js must switch it to Other.
- **Environment variables**: `CF_AI_GATEWAY_PROVIDERS`, `NEXT_PUBLIC_CF_AI_GATEWAY_PROVIDERS`, and `GOOGLE_API_KEY` are removed. External Models are declared in `CF_AI_GATEWAY_MODELS`, with provider keys stored as AI Gateway BYOK. `CF_ACCOUNT_ID` and `CF_WORKERS_AI_TOKEN` are now optional.
- **Image page removed**: `/image` and Image History are gone; images are generated inside conversations.
- **Settings**: the settings dialog is replaced by `/settings` pages (General, Models, Providers, Voice, Data).

### Added

- **Personal Providers** (`/settings/providers`): visitors add their own provider key, through this deployment's AI Gateway or their own, and declare Personal Models by hand or pick them from the provider's model list (`POST /api/personal-models`). Credentials stay in the browser's localStorage, are never logged, and are excluded from backups. Through the deployment's gateway a request must carry the visitor's key and cannot use Dynamic Routes.
- **Personal image models**: OpenAI Images API (size) and Gemini image output (aspect ratio) profiles.
- **Model layout** (`/settings/models`): hide models, create, rename, and delete Model Groups, and reorder groups and models (buttons or drag). Stored locally.
- **Image generation in conversations**: selecting a `Text to Image` model switches the input to image mode with params and up to 4 Reference Images. Any image in a conversation can be used as a reference; generated images enter the Model Context of image-capable chat models.
- **External Models** through AI Gateway: BYOK, Unified Billing, and Gateway Routes (`dynamic/*`) declared in `CF_AI_GATEWAY_MODELS`.
- **Context attachments**: document parsing with Workers AI `toMarkdown` and webpage extraction (Markdown for Agents, Workers AI `toMarkdown`, then Browser Run; SSRF protection) for every chat model.
- **Knowledge Base**: read-only Cloudflare AI Search retrieval (RAG) with Citations (`CF_AI_SEARCH_*`).
- Image params panel and FLUX.2 multi-image reference editing.
- Browser-native Web Speech voice input and read-aloud, Custom Instructions, gateway cache toggle, Conversation History JSON export/import (optionally with images).
- Responses show the model name on hover.

### Changed

- Theme and model preferences move from cookies to localStorage; the chat and image model selections merge into one.
- Dependencies: added `@tanstack/react-start`, `@tanstack/react-router`, `@tanstack/react-form`, `vite`, `@vitejs/plugin-react`, `@tailwindcss/vite`, `@cloudflare/vite-plugin`, `nitro`, `wrangler`; removed `next`, `next-themes`, `react-hook-form`, `@hookform/resolvers`, `@tailwindcss/postcss`, `oxfmt`. React 19.3, Bun 1.4.4.

### Migration from 5.x

- Data migrates on first load: cookie preferences move to localStorage, and Dexie v4 turns Image History into an ordinary "Image History" conversation.
- Replace `CF_AI_GATEWAY_PROVIDERS` / `GOOGLE_API_KEY` with an AI Gateway BYOK key plus `CF_AI_GATEWAY_MODELS`, `CF_AI_GATEWAY_NAME`, and `CF_AI_GATEWAY_TOKEN`.
- Docker: same image, port, and variables.
- Vercel: set Framework Preset to Other and clear custom build/output settings, then redeploy.

## 5.2.0

### Added

- **Context Usage**: the chat input shows how much of the model's context window the latest response used, with input/output tokens and how many messages the next Model Context includes. Workers AI context windows are read from the model catalog.
- **Retry**: the latest response in a conversation, and the latest image in Image History, can be retried; the new response replaces the old one once it succeeds.
- Reasoning shows how long the model thought for.

### Changed

- **AI Elements**: messages, bubbles, scrolling, reasoning and tool calls (Trace), attachments, code blocks and spinners now use shadcn AI Elements. Code blocks are highlighted with Shiki and can be copied.
- Assistant responses have copy and Retry actions.
- The model selector and context indicator use the primary colour; the chat input no longer looks disabled while empty.
- Dependencies: added `@shadcn/react` and `shiki`; removed `@streamdown/code`.

### Fixed

- Workers AI responses were cut off at 256 tokens; requests now ask for up to 8,192 output tokens (at most a quarter of the context window).
- The selected model and search toggle no longer revert after navigating between pages.

## 5.1.1

### Fixed

- Gateway providers are now read from `CF_AI_GATEWAY_PROVIDERS` at runtime, so External Models such as Gemini can be enabled on the prebuilt Docker image. `NEXT_PUBLIC_CF_AI_GATEWAY_PROVIDERS` was inlined at build time and ignored by `docker run -e`; it remains a build-time fallback.

## 5.1.0

### Changed

- **Request Limits**: chat/image APIs now accept a 4 MiB body and 512 KiB per decoded image (5 image parts) so requests fit the Vercel Functions body limit.
- **Image attachments**: resized in the browser to JPEG (long edge 1568px, reduced down to 512px when needed, GIFs keep their first frame). Oversized images in older Conversation History are downscaled when building the Model Context.
- **History loading**: Dexie schema v3 adds a `[sessionId+createdAt]` index; conversations load their newest 100 messages and Image History its newest 50 entries in order. The sidebar lists the 100 most recently updated sessions.
- Clearing Image History from the sidebar keeps the image page open and refreshes it immediately.

### Fixed

- Image generation through AI Gateway failed with 502 because the unwrapped `{ image }` payload was rejected; JPEG/WebP payloads are no longer labelled as PNG.
- Upstream 401/403 from Workers AI image generation is reported as 502 instead of 400.
- User messages keep their line breaks.
- Stopping a response before any output no longer stores an empty assistant message.
- A stopped reasoning response no longer shows a spinner forever.
- Workers AI responses no longer repeat every token, and reasoning models show one Reasoning block instead of one per token (workaround for workers-ai-provider 4.0.0 reading redundant stream fields).

## 5.0.0

### Breaking Changes

- **Version bump**: package version 5.0.0.
- **Runtime**: Node.js >= 22 required. Package manager fixed to Bun 1.4.1.
- **Dependency baseline**: upgraded every direct dependency to its latest compatible stable release, including Next.js 16.3.4, React 19.2.8, AI SDK 7, the v4 AI providers, and Motion 13. AI SDK migrations include `instructions`, `isStepCount`, async `convertToModelMessages`, and stateless UI stream helpers.

### Removed

- `ai-sdk-tool-code-execution` and `executeCode`/`VERCEL_OIDC_TOKEN` code path.
- `@vercel/sandbox`, `ms`, `@types/ms`.
- Dead-code files: `components/copy-button.tsx`, `components/ui/drawer.tsx`, `components/ui/popover.tsx`, `hooks/use-media-query.ts`.
- Stale `biome.json`.

### Added

- **Access Session**: stateless HMAC-signed cookie auth via `POST /api/auth`. Constant-time password comparison, 30-day expiry, no server-side storage. Client removes `localStorage`/`Authorization` password handling.
- **Model Context**: testable pure strategy bounding context to 64,000 characters, 100 messages, 5 recent image parts. Client and server both enforce.
- **Request Limits**: chat/image APIs enforce a 25 MiB body, 5 image parts, 5 MiB per decoded image, and AI SDK message validation.
- **Strict Capability Signal**: bidirectional substring matching removed; only exact standardized equality signals accepted.
- **New dependencies**: `@ai-sdk/provider`, `@ai-sdk/openai-compatible`, `zod`, `@types/bun`.

### Fixed

- Dexie schema upgraded to v2 (removed unique `createdAt` constraint and stray space in index).
- `modalKey` → `modelKey` naming fix.
- `next/dist` private imports replaced with public API (`next/link` `useLinkStatus`, local debounce).
- `?new` empty message crash and duplicate first-send risk.
- Image regenerate finds the most recent prompt and releases generated object URLs.
- Provider configuration errors now fail at the selected API boundary instead of constructing invalid clients eagerly.
- Upstream image-provider failures no longer expose provider error details to clients.
- TypeScript upgraded to 7.0.2 after validating both standalone type checking and the Next.js 16.3.4 production build.

### Quality

- Added `test`, `typecheck`, `check` package scripts.
- Added GitHub Actions quality gate (lint, fmt, typecheck, test, build).
- Tests cover Model Context, Access Session, Dexie schema, Capability Signal, request limits.
- Removed `@ts-nocheck` from `model-catalog.test.ts`.
