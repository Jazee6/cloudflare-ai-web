# Cloudflare AI Web

[中文](./README.md) ｜ English

A multi-model AI chat platform on Cloudflare Workers AI and AI Gateway, deployable to Vercel, Cloudflare Workers, and Docker.

Example: https://ai.vuiki.com (quota may run out; deploying your own is recommended)

![readme](./.github/assets/readme.jpg)

## Features

- Workers AI models out of the box; External Models through AI Gateway (BYOK / Unified Billing / Gateway Routes)
- Personal Providers: visitors add models with their own key or AI Gateway
- Image generation in conversations, with params and up to 4 reference images
- Document parsing, webpage extraction, and AI Search Knowledge Base (RAG)
- Voice input and read-aloud, Custom Instructions, model groups and ordering
- Data stays in the browser, with export and import
- Works offline as a PWA; optional access password

## Deployment

> [!WARNING]
> Without `APP_PASSWORD`, anyone can use your inference APIs.

### Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FJazee6%2Fcloudflare-ai-web&demo-title=Cloudflare%20AI%20Web&demo-url=https%3A%2F%2Fai.vuiki.com)

Upgrading from 5.x: set Framework Preset to **Other** under **Settings → Build and Deployment** and clear custom build settings.

### Cloudflare Workers

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Jazee6/cloudflare-ai-web)

Or deploy locally:

```bash
bun install
bun run deploy
```

### Docker

```bash
docker run -d --name cloudflare-ai-web \
  -e CF_ACCOUNT_ID=YOUR_CF_ACCOUNT_ID \
  -e CF_WORKERS_AI_TOKEN=YOUR_CF_WORKERS_AI_TOKEN \
  -p 3000:3000 \
  --restart=always \
  jazee6/cloudflare-ai-web
```

## Environment Variables

All optional. With none set, visitors can still use Personal Providers.

| Name                         | Description                                                     |
| ---------------------------- | --------------------------------------------------------------- |
| `CF_ACCOUNT_ID`              | Cloudflare Account ID                                           |
| `CF_WORKERS_AI_TOKEN`        | Workers AI token                                                |
| `CF_AI_GATEWAY_NAME`         | AI Gateway name                                                 |
| `CF_AI_GATEWAY_TOKEN`        | AI Gateway token                                                |
| `CF_AI_GATEWAY_MODELS`       | External Model declarations, see below                          |
| `CF_AI_SEARCH_TOKEN`         | AI Search token; enables the Knowledge Base                     |
| `CF_AI_SEARCH_INSTANCES`     | Allowed AI Search instances, comma-separated, `id` or `id:Name` |
| `CF_AI_SEARCH_NAMESPACE`     | AI Search namespace, default `default`                          |
| `CF_AI_SEARCH_REWRITE_QUERY` | Enable `rewrite_query`, default `false`                         |
| `CF_BROWSER_RUN_TOKEN`       | Browser Run token for dynamic webpages                          |
| `APP_PASSWORD`               | Access password                                                 |
| `APP_ANNOUNCEMENT`           | Announcement, see below                                         |
| `SITE_URL`                   | Public site URL, read at build time, see below                  |

### CF_WORKERS_AI_TOKEN

Dashboard → **Manage Account → Account API Tokens → Create Token**, using the **Workers AI** template.

### CF_AI_GATEWAY_MODELS

Configure keys in Dashboard → **AI → AI Gateway → Provider Keys (BYOK)**, then declare models separated by commas:

```bash
CF_AI_GATEWAY_MODELS="google-ai-studio/gemini-4-hydrogen?name=Gemini+4+Hydrogen&input=image,search&contextWindow=1048576,openai/gpt-5?input=image&reasoning=true&contextWindow=400000,dynamic/smart-chat?name=Smart+Chat"
```

Parameters: `name`, `input` (`image` / `search`), `reasoning`, `contextWindow`, `byokAlias`.

### APP_ANNOUNCEMENT

A top-right announcement that returns after closing only when its content changes:

```bash
APP_ANNOUNCEMENT='{"title":"New feature","description":{"en":"...","zh-CN":"..."},"url":"https://..."}'
```

### SITE_URL

E.g. `https://ai.example.com`, used for canonical, share cards and sitemap. It is baked in at build time, so changes need a rebuild:

- Vercel / Workers Builds: set it as a build variable
- Docker: `docker build --build-arg SITE_URL=https://ai.example.com .`

### Personal Providers

Visitors add them under **Settings → Providers**. Credentials stay in the browser; the server never stores or logs them.

- **Through this deployment's gateway**: requires the gateway variables; visitors must bring their own key and cannot use `dynamic/*`, so your credits are never used
- **Through the visitor's own gateway**: key optional, `dynamic/*` allowed
