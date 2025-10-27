# cloudflare-ai-web

![readme.png](https://github.com/user-attachments/assets/e1c4e604-568d-4778-8780-29473619744f)

## 部署

### Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FJazee6%2Fcloudflare-ai-web&demo-title=Cloudflare%20AI%20Web&demo-url=https%3A%2F%2Fai.jaze.top)

示例：https://ai.jaze.top

> 额度用完时可能无法响应，建议自行部署

### Docker

```bash
docker run -d --name cloudflare-ai-web \
  -e CF_ACCOUNT_ID=YOUR_CF_ACCOUNT_ID \
  -e CF_WORKERS_AI_TOKEN=YOUR_CF_WORKERS_AI_TOKEN \
  -p 3000:3000 \
  --restart=always \
  jazee6/cloudflare-ai-web
```

## 特性

- 使用 Cloudflare Workers AI 快速搭建多模型AI平台
- 支持 Cloudflare AI Gateway 接入Gemini等模型
- 支持 Serverless 快速部署
- 聊天记录本地存储
- 支持设置访问密码

## 部署说明

### 环境变量列表

| 名称                                  | 描述                      | 必填 |
|-------------------------------------|-------------------------|----|
| CF_ACCOUNT_ID                       | Cloudflare 账户ID         | ✅  |  
| CF_WORKERS_AI_TOKEN                 | Cloudflare Workers AI令牌 | ✅  |
| APP_PASSWORD                        | 访问密码                    |    |
| CF_AI_GATEWAY_NAME                  | Cloudflare AI网关名称       |    |
| CF_AI_GATEWAY_TOKEN                 | Cloudflare AI网关授权令牌     |    |
| NEXT_PUBLIC_CF_AI_GATEWAY_PROVIDERS | Cloudflare AI网关提供者      |    |
| GOOGLE_API_KEY                      | Google AI Studio 令牌     |    |

示例： 查看`.env.example`文件

#### CF_WORKERS_AI_TOKEN

- 管理账户 - 账户API令牌 - 创建令牌 - 使用Workers AI模板创建

#### NEXT_PUBLIC_CF_AI_GATEWAY_PROVIDERS

支持的提供者：

- google

多个提供者使用逗号分隔
