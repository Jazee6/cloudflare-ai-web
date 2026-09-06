# Cloudflare AI Web

[中文](./README.md) ｜ English

![readme.png](https://github.com/user-attachments/assets/e1c4e604-568d-4778-8780-29473619744f)

## Deployment

### Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FJazee6%2Fcloudflare-ai-web&demo-title=Cloudflare%20AI%20Web&demo-url=https%3A%2F%2Fai.jaze.top)

Example: https://ai.jaze.top

> It may not respond when the quota is used up, it is recommended to deploy it yourself

### Docker

```bash
docker run -d --name cloudflare-ai-web \
  -e CF_ACCOUNT_ID=YOUR_CF_ACCOUNT_ID \
  -e CF_WORKERS_AI_TOKEN=YOUR_CF_WORKERS_AI_TOKEN \
  -p 3000:3000 \
  --restart=always \
  jazee6/cloudflare-ai-web
```

## Requirements

- Node.js >= 22
- Bun 1.4.1 (package manager)

## Features

- Quickly build a multimodel AI platform using Cloudflare Workers AI
- Support Cloudflare AI Gateway to access models such as Gemini
- Support fast deployment with Serverless
- Chat history is stored locally
- Access Session protection via deployment password
- Request body size limits (chat/image 25 MiB, 5 MiB per image, max 5 images)
- Model Context policy bounding the context window (max 64,000 characters, 100 messages)

> **Note:** In public mode anyone can use your inference APIs. Set `APP_PASSWORD` to enable Access Session.

## Deployment Instructions

### Environment Variables

| Name                                | Description                      | Required |
| ----------------------------------- | -------------------------------- | -------- |
| CF_ACCOUNT_ID                       | Cloudflare Account ID            | ✅       |
| CF_WORKERS_AI_TOKEN                 | Cloudflare Workers AI Token      | ✅       |
| APP_PASSWORD                        | Access Password (Access Session) |          |
| CF_AI_GATEWAY_NAME                  | Cloudflare AI Gateway Name       |          |
| CF_AI_GATEWAY_TOKEN                 | Cloudflare AI Gateway Auth Token |          |
| NEXT_PUBLIC_CF_AI_GATEWAY_PROVIDERS | Cloudflare AI Gateway Providers  |          |
| GOOGLE_API_KEY                      | Google AI Studio Token           |          |

#### CF_WORKERS_AI_TOKEN

- Manage Account - Account API Tokens - Create Token - Create with Workers AI template

#### APP_PASSWORD

When configured, enables Access Session:

- Without configuration the app is fully public.
- When configured: submit password via `/api/auth`; on success a 30-day HttpOnly HMAC cookie is issued (no raw password stored).
- Cookies expire after 30 days or immediately when `APP_PASSWORD` changes.
- The client no longer stores the raw password; on 401 the auth dialog appears, retries once after success.

#### Request Limits

- Chat and image API request bodies are limited to 25 MiB.
- Max 5 image attachments per request.
- Max 5 MiB decoded size per image.
- Image generation prompt max 8,000 characters.

#### Model Context

The client uses a Model Context policy instead of simple slicing:

- Fills from the latest message backward, up to 64,000 characters.
- At most 100 messages.
- Rejects (not truncates) if the latest message alone exceeds the limit.
- Keeps only the 5 most recent image file parts.

#### NEXT_PUBLIC_CF_AI_GATEWAY_PROVIDERS

Supported providers:

- google

Multiple providers are separated by commas

## Sponsor

[Click Me](https://jaze.top/sponsor)
