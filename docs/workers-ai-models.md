# Workers AI 模型请求参数与可用性报告

对目录中全部 Workers AI 模型（Text to Image 与 Text Generation）逐一到
[官网模型页](https://developers.cloudflare.com/workers-ai/models/) 核对请求参数，并用真实
REST API（`/client/v4/accounts/{account}/ai/run/{model}`）实测可用性。

- **核查日期**: 2026-09-06
- **测试方法**: 按应用实际发送的请求格式测试（chat 为 OpenAI 风格 `{messages, max_tokens,
  temperature, stream, ...}`，image 为 `{prompt}` 或 multipart form-data）
- **测试账号**: 主账号当日免费神经元配额（10k）耗尽后，改用辅助测试账号（Workers Free
  计划）完成 chat 模型测试；image 模型在配额耗尽前已在主账号测完
- **参数来源**: 官网模型页 Parameters 树（从页面嵌入的 schema 数据解析）

## Chat 模型（Text Generation，共 31 个）

应用通过 `workers-ai-provider` 发送 OpenAI 风格请求。实测全部模型都接受 `messages`
数组（含文档标 `prompt` 为必填的旧版格式模型），流式响应有两种线格式，provider 均能解析：
`response` 字段（旧版 SSE）与 `choices[].delta`（OpenAI 兼容 SSE）。

### 请求格式分组（按官网参数树）

**OpenAI 兼容组**（`messages` 必填；多数支持 `reasoning_effort`、`chat_template_kwargs.clear_thinking`、
`tools`、`response_format`、`web_search_options` 等完整参数面）：

- `@cf/zai-org/glm-5.3` / `glm-5.3-flash` / `glm-5.2` / `glm-4.7-flash`
- `@cf/deepseek-ai/deepseek-v4-flash-0731` / `deepseek-v4-pro-0813`
- `@cf/moonshotai/kimi-k2.6` / `kimi-k2.7-code`
- `@cf/qwen/qwen3.8-27b`（内容数组还支持 `video_url`）
- `@cf/nvidia/nemotron-3-120b-a12b`
- `@cf/google/gemma-4-26b-a4b-it`（另支持 `skip_special_tokens`）

**旧版 prompt 组**（文档标 `prompt` 必填，REST 实测同时接受 `messages`；支持 `max_tokens`
默认 256、`temperature` 默认 0.6、`top_p`、`top_k`、`seed`、`repetition_penalty`、
`frequency_penalty`、`presence_penalty`、`stream`、`response_format`、`lora`）：

- `@cf/meta/llama-3.2-1b-instruct` / `3b-instruct` / `3.1-8b-instruct-fp8` /
  `3.3-70b-instruct-fp8-fast`
- `@cf/meta/llama-3.2-11b-vision-instruct`（vision，另接受 `image` 数组输入）
- `@cf/meta-llama/llama-2-7b-chat-hf-lora`
- `@cf/mistral/mistral-7b-instruct-v0.2-lora`
- `@cf/mistralai/mistral-small-3.1-24b-instruct`
- `@cf/qwen/qwen2.5-coder-32b-instruct` / `qwen3-30b-a3b-fp8` / `qwq-32b`
- `@cf/google/gemma-2b-it-lora` / `gemma-7b-it-lora`
- `@cf/deepseek-ai/deepseek-r1-distill-qwen-32b`（流式输出 `‹think›` 标签，与应用的
  extractReasoningMiddleware(tagName: "think") 匹配）
- `@cf/ibm-granite/granite-4.0-h-micro`
- `@cf/aisingapore/gemma-sea-lion-v4-27b-it`
- `@cf/openai/gpt-oss-20b` / `gpt-oss-120b`（同时支持 `prompt`、`messages`、`functions`；
  provider 对 gpt-oss 的 `/ai/run/` 流式限制有降级重试逻辑）

**特殊**: `@cf/meta/llama-guard-3-8b` — 内容审核分类器（`messages` 必填，输出
safe/unsafe 类别 JSON，非对话模型）。**已从 Model Catalog 过滤**（按
moderation/safety/content-filtering/guardrails 标签）。

### 实测结果

| 结果 | 数量 | 模型 |
|---|---|---|
| ✅ 可用 | 25 | 上表旧版 prompt 组全部 + OpenAI 兼容组的 glm-4.7-flash、gemma-4-26b-a4b-it、qwen3.8-27b、nemotron-3-120b-a12b + llama-guard-3-8b（功能如上，已过滤） |
| ⚠️ 需付费计划 | 7 | `kimi-k2.6`、`kimi-k2.7-code`、`glm-5.2`、`glm-5.3`、`glm-5.3-flash`、`deepseek-v4-flash-0731`、`deepseek-v4-pro-0813`（403/5035: not available on the Workers Free plan；主账号可运行 partner 模型，预期可用，未实测） |
| ⚠️ 需一次性协议 | 1 | `llama-3.2-11b-vision-instruct`（首次 403/5016，POST `{"prompt":"agree"}` 后正常） |

补充验证：

- 流式（`stream: true`）抽测 5 个模型（llama-3.2-1b、glm-4.7-flash、gpt-oss-20b、qwq-32b、
  deepseek-r1-distill）均正常
- vision 图片输入（`image_url` + base64 data URL）实测 llama-4-scout、llama-3.2-11b-vision 均正常
- reasoning 模型（glm-4.7-flash、qwen3-30b、gemma-4 等）把思考放在 `reasoning_content`，
  provider 已原生解析；`max_tokens` 过小时思考会耗尽预算导致 content 为空，属预期行为
- `qwq-32b` 的推理以纯文本输出（无 `reasoning_content`、无 think 标签），前端会显示思考过程

## Image 模型（Text to Image，目录共 10 个）

### 请求格式分组

**FLUX.2 组**（必须 multipart/form-data，`prompt` 为 form 字段；JSON 请求返回
400 `required properties at '/' are 'multipart'`；官网参数树仅显示 `multipart` object，
未文档化其余参数，实测 `seed` 等额外 form 字段不报错）：

- `@cf/black-forest-labs/flux-2-klein-9b`（~4s，JSON `result.image` base64）
- `@cf/black-forest-labs/flux-2-klein-4b`（~4s，同上）
- `@cf/black-forest-labs/flux-2-dev`（~52s，同上）
- 应用已修复：`app/api/image/route.ts` 对 FLUX.2 系列改用 FormData 发送

**JSON 组**（`{prompt}`，可选 `negative_prompt`、`height`、`width`、`num_steps`、
`guidance`、`seed`、img2img 的 `image`/`image_b64`/`mask`/`strength`）：

- `@cf/black-forest-labs/flux-1-schnell`（参数 `prompt`/`steps` 默认 4/`seed`）— JSON base64 响应
- `@cf/leonardo/lucid-origin`（`guidance` 默认 4.5、`height/width` 默认 1120 max 2500、`num_steps` max 40）— JSON base64 响应
- `@cf/leonardo/phoenix-1.0`（`guidance` 默认 2、`height/width` 默认 1024、`num_steps` 默认 25、`negative_prompt`）— **直接返回二进制 JPEG**
- `@cf/bytedance/stable-diffusion-xl-lightning`、`@cf/stabilityai/stable-diffusion-xl-base-1.0`、`@cf/lykon/dreamshaper-8-lcm`（`num_steps` 默认 20、`guidance` 默认 7.5 等）— **二进制 PNG 响应**

**特殊**: `@cf/runwayml/stable-diffusion-v1-5-inpainting` — 目录归为 Text-to-Image 但
强制要求 `mask_image`（400: missing required input mask_image），无法纯文本生图。
**已从 Model Catalog 过滤**（按名称含 `inpainting`）。

### 实测结果

| 模型 | 请求格式 | 响应格式 | 状态 |
|---|---|---|---|
| flux-2-klein-9b | multipart | JSON base64 | ✅ |
| flux-2-klein-4b | multipart | JSON base64 | ✅ |
| flux-2-dev | multipart | JSON base64 | ✅ |
| flux-1-schnell | JSON | JSON base64 | ✅ |
| lucid-origin | JSON（参数实测生效） | JSON base64 | ✅ |
| phoenix-1.0 | JSON（参数实测生效） | 二进制 JPEG | ✅ |
| sd-xl-lightning | JSON | 二进制 PNG | ✅ |
| sd-xl-base-1.0 | JSON | 二进制 PNG | ✅ |
| dreamshaper-8-lcm | JSON | 二进制 PNG | ✅ |
| sd-v1-5-inpainting | — | — | ❌ 已过滤 |

AI Gateway 路径（`gateway.ai.cloudflare.com/v1/{account}/{gateway}/workers-ai/run/{model}`）
对 multipart 请求转发正常（认证通过；当日返回的是配额 429）。

## 运维备注

- FLUX.2 模型计费较高（如 flux-2-dev $0.00021/输入 512² tile/步 + $0.00041/输出 tile/步），
  免费额度（每日 10,000 神经元，UTC 0 点重置）很容易耗尽
- 新账号首次使用 `llama-3.2-11b-vision-instruct` 前需 POST `{"prompt":"agree"}` 接受模型协议
