# Cloudflare AI Web

中文 ｜ [English](./README.en.md)

![readme](./.github/assets/readme.jpg)

## 部署

### Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FJazee6%2Fcloudflare-ai-web&demo-title=Cloudflare%20AI%20Web&demo-url=https%3A%2F%2Fai.vuiki.com)

示例：https://ai.vuiki.com

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

- 基于 TanStack Start（SPA 模式）构建，一份代码可部署到 Vercel、Docker、Cloudflare Workers 三端，服务端无状态
- 使用 Cloudflare Workers AI 快速搭建多模型 AI 平台
- 通过 Cloudflare AI Gateway 接入外部模型（BYOK / Unified Billing / Gateway Route）
- Personal Provider：访客可在浏览器里填写自己的 provider Key 或自己的 AI Gateway，添加 Personal Model（支持文本与生图）。可以从 provider 自动拉取模型列表，也可以手动声明
- 会话内生图：选中 `Text to Image` 模型后直接在会话里生成图片，可调整参数，最多使用 4 张 Reference Image（支持 FLUX.2、OpenAI Images、Gemini 图片输出）
- 模型布局：可隐藏模型、自建分组并排序（只保存在浏览器本地）
- 支持文档解析（Workers AI `toMarkdown`，0 Neurons）与网页提取（三级降级 + SSRF 防护），全对话模型通用
- 支持 Cloudflare AI Search 只读知识库检索（RAG），并以轻量方式展示引用来源
- `/settings` 设置页：主题、自定义系统提示词、网关缓存、网页抓取策略、浏览器原生 Web Speech 语音输入与朗读、对话历史 JSON 导出/导入
- 聊天记录保存在浏览器本地（IndexedDB）
- 图片附件在浏览器内自动压缩（长边不超过 1568px，单张不超过 512 KiB，每次请求最多 5 张），请求体积满足 Vercel Functions 的限制
- 支持 Access Session（访问密码）保护

> **注意：** 公开模式下，任何人都可以调用你的推理 API。建议设置 `APP_PASSWORD` 以启用 Access Session。

## 部署说明

### 环境变量列表

所有环境变量都是可选的。一个变量都不配置时，访客仍然可以通过 Personal Provider 搭配自己的 AI Gateway 使用。

| 名称                       | 描述                                                           | 何时需要                      |
| -------------------------- | -------------------------------------------------------------- | ----------------------------- |
| CF_ACCOUNT_ID              | Cloudflare 账户 ID                                             | 使用 Workers AI / 网关        |
| CF_WORKERS_AI_TOKEN        | Cloudflare Workers AI 令牌（推理与 `toMarkdown` 文档转换）     | 使用 Workers AI 模型/文档解析 |
| CF_AI_GATEWAY_NAME         | Cloudflare AI 网关名称                                         | 使用网关/外部模型             |
| CF_AI_GATEWAY_TOKEN        | Cloudflare AI 网关授权令牌                                     | 使用网关/外部模型             |
| CF_AI_GATEWAY_MODELS       | 声明式外部模型与 Gateway Route（`dynamic/*`）                  | 使用外部模型                  |
| CF_BROWSER_RUN_TOKEN       | Cloudflare Browser Run `/markdown` 令牌（SPA 动态网页回退）    | 按需                          |
| CF_AI_SEARCH_TOKEN         | Cloudflare AI Search 只读检索令牌                              | 启用知识库                    |
| CF_AI_SEARCH_INSTANCES     | 允许挂载的 AI Search 实例白名单（逗号分隔，`id` 或 `id:别名`） | 启用知识库                    |
| CF_AI_SEARCH_NAMESPACE     | AI Search 命名空间（默认 `default`）                           |                               |
| CF_AI_SEARCH_REWRITE_QUERY | 是否开启 AI Search `rewrite_query`（默认 `false`）             |                               |
| APP_PASSWORD               | 访问密码（Access Session）                                     | 建议设置                      |

#### CF_WORKERS_AI_TOKEN

- 管理账户 - 账户 API 令牌 - 创建令牌 - 使用 Workers AI 模板创建

#### CF_AI_GATEWAY_MODELS（BYOK / Unified Billing）

第三方 provider 的密钥请在 Cloudflare Dashboard → **AI** → **AI Gateway** → **Provider Keys (BYOK)** 中配置，然后通过 `CF_AI_GATEWAY_MODELS` 声明模型：

```bash
CF_AI_GATEWAY_MODELS="google-ai-studio/gemini-4-hydrogen?name=Gemini+4+Hydrogen&input=image,search&contextWindow=1048576,openai/gpt-5?input=image&reasoning=true&contextWindow=400000,dynamic/smart-chat?name=Smart+Chat"
```

支持的查询参数：`name`、`input`（`image` / `search`）、`reasoning`（`true` / `false`）、`contextWindow`、`byokAlias`。

#### Personal Provider

访客在 **设置 → Providers** 中添加 Personal Provider。凭据以明文保存在浏览器 localStorage 中，每次请求时随附，由服务端经 AI Gateway 转发。服务端不保存凭据，也不写入日志或对话备份。

- **经本部署的网关**：要求部署者已配置 `CF_ACCOUNT_ID`、`CF_AI_GATEWAY_NAME`、`CF_AI_GATEWAY_TOKEN`。访客**必须**填写自己的 provider Key，并且不能使用 `dynamic/*` 路由，因此不会消耗部署者的 BYOK 或额度。
- **经访客自己的网关**：填写 Account ID、Gateway 名称和可选的 Token。provider Key 可以不填，此时使用访客网关上配置的 BYOK / Unified Billing；也可以使用 `dynamic/*` 路由。

## 赞助

[Click Me](https://jaze.top/sponsor)

<div align="center">

<img src="https://github.com/user-attachments/assets/c194ff8a-7d86-43bf-912e-f35bb5f9d1a0" alt="赞助位1" width="300">

[Doloffer--站式数字订阅充值平台](https://doloffer.com)

主营 GPT、Claude 等 AI多类数字服务会员正版订阅，9 折优惠码 AI8888，极速发货，售后无忧

</div>
