# Cloudflare AI Web

中文 ｜ [English](./README.en.md)

![readme.png](https://github.com/user-attachments/assets/e1c4e604-568d-4778-8780-29473619744f)

## 部署

### Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FJazee6%2Fcloudflare-ai-web&demo-title=Cloudflare%20AI%20Web&demo-url=https%3A%2F%2Fai.jaze.top)

示例：https://ai.jaze.top

> 额度用完时可能无法响应，建议自行部署

### Cloudflare Workers

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Jazee6/cloudflare-ai-web)

或在本地手动构建部署：

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

## 特性

- 使用 Cloudflare Workers AI 快速搭建多模型 AI 平台
- 支持 Cloudflare AI Gateway（BYOK / Unified Billing / Gateway Route）接入外部模型
- 支持 Vercel、Docker 与 Cloudflare Workers 三端无状态部署
- 支持文档解析（Workers AI `toMarkdown`，0 Neurons）与网页提取（三级降级 + SSRF 防护），全对话模型通用
- 支持 Cloudflare AI Search 只读知识库检索（RAG）与轻量来源引用展示
- 支持文生图参数调节与 FLUX.2 多图参考编辑（最多 4 张参考图）
- 支持本地设置面板（主题、自定义系统提示词、网关缓存偏好、浏览器原生 Web Speech 语音输入与朗读、对话历史 JSON 导出/导入）
- 聊天记录本地存储
- 图片附件在浏览器内自动压缩（长边不超过 1568px，单张不超过 512 KiB，每次请求最多 5 张），请求体积满足 Vercel Functions 限制
- 支持 Access Session（访问密码）保护

> **注意：** 公开模式下任何人都可以使用你的推理 API。建议设置 `APP_PASSWORD` 以启用 Access Session。

## 部署说明

### 环境变量列表

| 名称                       | 描述                                                           | 必填              |
| -------------------------- | -------------------------------------------------------------- | ----------------- |
| CF_ACCOUNT_ID              | Cloudflare 账户 ID                                             | ✅                |
| CF_WORKERS_AI_TOKEN        | Cloudflare Workers AI 令牌（推理与 `toMarkdown` 文档转换）     | ✅                |
| CF_AI_GATEWAY_NAME         | Cloudflare AI 网关名称                                         | 使用网关/外部模型 |
| CF_AI_GATEWAY_TOKEN        | Cloudflare AI 网关授权令牌                                     | 使用网关/外部模型 |
| CF_AI_GATEWAY_MODELS       | 声明式外部模型与 Gateway Route（`dynamic/*`）                  | 使用外部模型时    |
| CF_BROWSER_RUN_TOKEN       | Cloudflare Browser Run `/markdown` 令牌（SPA 动态网页回退）    | 按需              |
| CF_AI_SEARCH_TOKEN         | Cloudflare AI Search 只读检索令牌                              | 启用知识库时      |
| CF_AI_SEARCH_INSTANCES     | 允许挂载的 AI Search 实例白名单（逗号分隔，`id` 或 `id:别名`） | 启用知识库时必填  |
| CF_AI_SEARCH_NAMESPACE     | AI Search 命名空间（默认 `default`）                           |                   |
| CF_AI_SEARCH_REWRITE_QUERY | 是否开启 AI Search `rewrite_query`（默认 `false`）             |                   |
| APP_PASSWORD               | 访问密码（Access Session）                                     |                   |

#### CF_WORKERS_AI_TOKEN

- 管理账户 - 账户 API 令牌 - 创建令牌 - 使用 Workers AI 模板创建

#### CF_AI_GATEWAY_MODELS（BYOK / Unified Billing）

v6.0 移除 `CF_AI_GATEWAY_PROVIDERS`、`NEXT_PUBLIC_CF_AI_GATEWAY_PROVIDERS` 与 `GOOGLE_API_KEY`。第三方提供方密钥请在 Cloudflare Dashboard → **AI** → **AI Gateway** → **Provider Keys (BYOK)** 中配置，再通过 `CF_AI_GATEWAY_MODELS` 声明模型：

```bash
CF_AI_GATEWAY_MODELS="google-ai-studio/gemini-4-hydrogen?name=Gemini+4+Hydrogen&input=image,search&contextWindow=1048576,openai/gpt-5?input=image&reasoning=true&contextWindow=400000,dynamic/smart-chat?name=Smart+Chat"
```

支持的查询参数：`name`、`input`（`image` / `search`）、`reasoning`（`true` / `false`）、`contextWindow`、`byokAlias`。

## 赞助

[Click Me](https://jaze.top/sponsor)

<div align="center">

<img src="https://github.com/user-attachments/assets/c194ff8a-7d86-43bf-912e-f35bb5f9d1a0" alt="赞助位1" width="300">

[Doloffer--站式数字订阅充值平台](https://doloffer.com)

主营 GPT、Claude 等 AI多类数字服务会员正版订阅，9 折优惠码 AI8888，极速发货，售后无忧

</div>
