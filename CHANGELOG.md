# Changelog

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
