# Cloudflare AI Web

[中文](./README.md) ｜ English

![readme.png](https://github.com/user-attachments/assets/e1c4e604-568d-4778-8780-29473619744f)

## Deployment

### Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FJazee6%2Fcloudflare-ai-web&demo-title=Cloudflare%20AI%20Web&demo-url=https%3A%2F%2Fai.jaze.top)

Example: https://ai.jaze.top

> It may not respond when the quota is used up, it is recommended to deploy it yourself

### Cloudflare Workers

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Jazee6/cloudflare-ai-web)

Or build and deploy manually:

```bash
bun install
bun run cf:build
bun run cf:deploy
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

## Features

- Quickly build a multimodel AI platform using Cloudflare Workers AI
- Support Cloudflare AI Gateway (BYOK / Unified Billing / Gateway Routes) for External Models
- Stateless deployment across Vercel, Docker, and Cloudflare Workers
- Chat history is stored locally
- Image attachments are resized in the browser (long edge up to 1568px, at most 512 KiB each, up to 5 per request) so requests fit the Vercel Functions body limit
- Access Session protection via deployment password

> **Note:** In public mode anyone can use your inference APIs. Set `APP_PASSWORD` to enable Access Session.

## Deployment Instructions

### Environment Variables

| Name                 | Description                                  | Required                |
| -------------------- | -------------------------------------------- | ----------------------- |
| CF_ACCOUNT_ID        | Cloudflare Account ID                        | ✅                      |
| CF_WORKERS_AI_TOKEN  | Cloudflare Workers AI Token                  | ✅                      |
| CF_AI_GATEWAY_NAME   | Cloudflare AI Gateway Name                   | With gateway / external |
| CF_AI_GATEWAY_TOKEN  | Cloudflare AI Gateway Auth Token             | With gateway / external |
| CF_AI_GATEWAY_MODELS | Declarative External Models & Gateway Routes | With external models    |
| APP_PASSWORD         | Access Password (Access Session)             |                         |

#### CF_WORKERS_AI_TOKEN

- Manage Account - Account API Tokens - Create Token - Create with Workers AI template

#### CF_AI_GATEWAY_MODELS (BYOK / Unified Billing)

v6.0 removes `CF_AI_GATEWAY_PROVIDERS`, `NEXT_PUBLIC_CF_AI_GATEWAY_PROVIDERS`, and `GOOGLE_API_KEY`. Configure upstream provider keys in Cloudflare Dashboard → **AI** → **AI Gateway** → **Provider Keys (BYOK)**, then declare models in `CF_AI_GATEWAY_MODELS`:

```bash
CF_AI_GATEWAY_MODELS="google-ai-studio/gemini-4-hydrogen?name=Gemini+4+Hydrogen&input=image,search&contextWindow=1048576,openai/gpt-5?input=image&reasoning=true&contextWindow=400000,dynamic/smart-chat?name=Smart+Chat"
```

Supported query parameters: `name`, `input` (`image` / `search`), `reasoning` (`true` / `false`), `contextWindow`, `byokAlias`.

## Sponsor

[Click Me](https://jaze.top/sponsor)
