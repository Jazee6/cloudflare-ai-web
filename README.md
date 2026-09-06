# Cloudflare AI Web

中文 ｜ [English](./README.en.md)

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

## 要求

- Node.js >= 22
- Bun 1.4.1（包管理器）

## 特性

- 使用 Cloudflare Workers AI 快速搭建多模型AI平台
- 支持 Cloudflare AI Gateway 接入Gemini等模型
- 支持 Serverless 快速部署
- 聊天记录本地存储
- 支持 Access Session（访问密码）保护
- 请求体大小限制（聊天/图片 25 MiB，每图 5 MiB，最多 5 张图片）
- Model Context 策略限制上下文窗口（最多 64,000 字符、100 条消息）

> **注意：** 公开模式下任何人都可以使用你的推理 API。建议设置 `APP_PASSWORD` 以启用 Access Session。

## 部署说明

### 环境变量列表

| 名称                                | 描述                       | 必填 |
| ----------------------------------- | -------------------------- | ---- |
| CF_ACCOUNT_ID                       | Cloudflare 账户ID          | ✅   |
| CF_WORKERS_AI_TOKEN                 | Cloudflare Workers AI令牌  | ✅   |
| APP_PASSWORD                        | 访问密码（Access Session） |      |
| CF_AI_GATEWAY_NAME                  | Cloudflare AI网关名称      |      |
| CF_AI_GATEWAY_TOKEN                 | Cloudflare AI网关授权令牌  |      |
| NEXT_PUBLIC_CF_AI_GATEWAY_PROVIDERS | Cloudflare AI网关提供者    |      |
| GOOGLE_API_KEY                      | Google AI Studio 令牌      |      |

#### CF_WORKERS_AI_TOKEN

- 管理账户 - 账户API令牌 - 创建令牌 - 使用Workers AI模板创建

#### APP_PASSWORD

配置后启用 Access Session：

- 未配置时应用完全公开，任何人可使用推理 API。
- 配置后：访问 `/api/auth` 提交密码，成功后签发 30 天有效的 HttpOnly HMAC cookie（不含原始密码）。
- cookie 过期或 `APP_PASSWORD` 变更后自动失效。
- 客户端不再保存原始密码，聊天或图片请求遇到 401 后自动弹出认证对话框，成功后重试一次。

#### 请求限制

- 聊天和图片 API 请求体最大 25 MiB。
- 每次请求最多 5 个图片附件。
- 每张图片最大 5 MiB 解码体积。
- 图片生成 prompt 最大 8,000 字符。

#### Model Context

客户端使用 Model Context 策略替代简单截取：

- 由最新消息向前连续装填，最多 64,000 字符。
- 最多 100 条消息。
- 最新消息自身超限则拒绝。
- 仅保留最近 5 个图片 file part。

#### NEXT_PUBLIC_CF_AI_GATEWAY_PROVIDERS

支持的提供者：

- google

多个提供者使用逗号分隔

## 赞助

[Click Me](https://jaze.top/sponsor)

<div align="center">

<img src="https://github.com/user-attachments/assets/c194ff8a-7d86-43bf-912e-f35bb5f9d1a0" alt="赞助位1" width="300">

[Doloffer--站式数字订阅充值平台](https://doloffer.com)

主营 GPT、Claude 等 AI多类数字服务会员正版订阅，9 折优惠码 AI8888，极速发货，售后无忧

</div>
