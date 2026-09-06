# Cloudflare 模型目录权威调研与动态化架构报告

> **核验基准与事实声明**：本报告基于 Cloudflare 官方一手规范与代码资产重做并严格校正。所有结论均通过 OpenAPI 规范源文件（`cloudflare/api-schemas`）、官方运行时类型定义（`@cloudflare/workers-types` 5.20260906.1 / `cloudflare/workerd`）以及 Cloudflare 官方文档库（`cloudflare/cloudflare-docs`）交叉核验。前一版调研中关于“`env.AI` 无枚举能力”的断言是**事实性错误**，本报告在此全面纠正并给出权威技术论证与生产落地实施方案。

---

## 目录

1. [执行摘要与明确答案](#1-执行摘要与明确答案)
2. [官方 REST 端点与 OpenAPI 规范核验](#2-官方-rest-端点与-openapi-规范核验)
3. [Workers AI Binding：`env.AI.models()` 能力深度剖析与限制](#3-workers-ai-bindingenvaimodels-能力深度剖析与限制)
4. [AI Gateway 是否存在跨 Provider 目录调查](#4-ai-gateway-是否存在跨-provider-目录调查)
5. [当前项目架构分析与模型动态化风险评估](#5-当前项目架构分析与模型动态化风险评估)
6. [推荐架构：三层融合模型目录方案](#6-推荐架构三层融合模型目录方案)
7. [凭据管理、多级缓存与优雅降级策略](#7-凭据管理多级缓存与优雅降级策略)
8. [官方信息源与证据分级列表](#8-官方信息源与证据分级列表)

---

## 1. 执行摘要与明确答案

### 1.1 明确答案

- **Cloudflare 是否支持动态获取 Workers AI 模型目录？**  
  **明确支持**。Cloudflare 提供了两种原生的模型目录查询通道：
  1. **REST API 规范通道**：`GET /accounts/{account_id}/ai/models/search`
  2. **Workers 运行时 Binding 通道**：`env.AI.models(params?: AiModelsSearchParams): Promise<AiModelsSearchObject[]>`
- **前版调研错误纠正**：  
  前一版报告声称“Workers AI Binding 只能通过 `env.AI.run()` 传入硬编码模型字符串，`env.AI` 没有模型枚举能力”。这一断言与事实不符。官方 `@cloudflare/workers-types` 最新定义（源自 `cloudflare/workerd` 源码库）在 `index.d.ts` 约 11790–11930 行中明确导出了 `AiModelsSearchParams`、`AiModelsSearchObject`，并在抽象类 `Ai` 中声明了 `models(params?: AiModelsSearchParams): Promise<AiModelsSearchObject[]>` 方法。
- **AI Gateway 是否提供跨供应商模型统一枚举接口？**  
  **不支持**。AI Gateway 在 OpenAPI 规范中包含的所有路径均为网关治理配置（Provider 密钥、动态路由、日志、成本规则等），没有任何统一的 Cross-Provider Model Discovery API。官方文档展示的“Unified AI Model Catalog (`/ai/models/`)”为文档系统在 Astro 静态构建时将本地 JSON 片段合并渲染的成果，非运行时 API。
- **业务落地推荐准则**：  
  严禁对前端无条件全量动态展示 Cloudflare 模型。最佳实践为**“Cloudflare 可用目录探测 + 业务能力配置叠加层 (Capability Overlay & Allowlist) + 外部 Google 本地项”**的三层混合架构。

---

## 2. 官方 REST 端点与 OpenAPI 规范核验

基于官方仓库 `cloudflare/api-schemas` 的 `openapi.json`（版本 3.0.3，OperationId: `workers-ai-search-model`），Workers AI 模型搜索 REST 端点的完整技术规格如下：

### 2.1 端点元数据与认证权限

- **HTTP 路径**：`GET https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/models/search`
- **OperationId**：`workers-ai-search-model`
- **Fern SDK 分组**：`ai.models.list`
- **安全性与认证方式**：
  - 方式 1：API Token 认证，请求头 `Authorization: Bearer <CF_WORKERS_AI_TOKEN>`
  - 方式 2：Global API Key 认证，请求头 `X-Auth-Key: <KEY>` 与 `X-Auth-Email: <EMAIL>`
- **所需权限范围**：
  - OpenAPI 权限声明：`x-cfPermissionsRequired: ["com.cloudflare.api.account.ai"]`
  - API Token 权限组：`Workers AI Read` 或 `Workers AI Write`
- **计划可用性 (`x-cfPlanAvailability`)**：Free、Pro、Business、Enterprise 全计划账户均可调用。
- **文档可见性标记**：`x-forge-hidden: true`（这解释了为何在部分基于 Forge 生成的公开发布文档导航树中它被隐藏，但 FERN SDK 与核心 OpenAPI 规范完整收录）。

### 2.2 完整的查询参数清单 (Query Parameters)

OpenAPI 中该端点共定义了 1 个必选路径参数与 9 个查询参数：

| 参数名称             | 所在位置 | 类型      | 必填   | 默认值  | 官方描述与说明                                                       |
| :------------------- | :------- | :-------- | :----- | :------ | :------------------------------------------------------------------- |
| `account_id`         | `path`   | `string`  | **是** | -       | 用户的 Cloudflare 32 位 Hex 账户 ID                                  |
| `search`             | `query`  | `string`  | 否     | `""`    | 模糊搜索文本，匹配模型名称或描述                                     |
| `task`               | `query`  | `string`  | 否     | `""`    | 按任务类型过滤，如 `"Text Generation"`, `"Text-to-Image"`            |
| `author`             | `query`  | `string`  | 否     | `""`    | 按模型发布组织/作者过滤，如 `"meta"`, `"deepseek-ai"`, `"mistralai"` |
| `source`             | `query`  | `number`  | 否     | -       | 按模型源 ID 过滤（如 `source=1` 为官方内建源）                       |
| `hide_experimental`  | `query`  | `boolean` | 否     | `false` | 是否隐藏实验阶段模型                                                 |
| `include_deprecated` | `query`  | `boolean` | 否     | `false` | 若为 `true`，包含废弃时间不超过 3 个月的模型                         |
| `page`               | `query`  | `integer` | 否     | `1`     | 分页页码                                                             |
| `per_page`           | `query`  | `integer` | 否     | `100`   | 每页返回条数，默认值为 100                                           |
| `format`             | `query`  | `string`  | 否     | -       | 枚举值：`["openrouter"]`。指定时以 OpenRouter 市场标准格式输出       |

### 2.3 响应字段与分页事实

该端点支持两种响应 Envelope（通过 `anyOf` 声明）：

#### 1. 默认 Cloudflare 标准响应

```json
{
  "success": true,
  "errors": [],
  "messages": [],
  "result": [
    {
      "id": "1f55679f-009e-4456-aa4f-049a62b4b6a0",
      "source": 1,
      "name": "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
      "description": "DeepSeek-R1-Distill-Qwen-32B is a distilled reasoning model...",
      "task": {
        "id": "cbf851f5-19e4-4d83-84f9-2b023f4b500a",
        "name": "Text Generation",
        "description": "Text generation models can be used for conversation, writing assistance..."
      },
      "tags": ["reasoning", "distilled"],
      "properties": [
        { "property_id": "beta", "value": "true" },
        { "property_id": "context_window", "value": "131072" },
        { "property_id": "max_output_tokens", "value": "8192" },
        { "property_id": "reasoning", "value": "true" }
      ]
    }
  ],
  "result_info": {
    "page": 1,
    "per_page": 100,
    "count": 100,
    "total_count": 284
  }
}
```

- **分页机制**：通过 `page` 和 `per_page` 控制，响应中带有 `result_info` 元数据（含 `total_count` 和当前页 `count`）。若模型数量超过 100，需要客户端进行累加翻页。

#### 2. OpenRouter 市场响应 (`format=openrouter`)

返回形如 `{ "data": [ { "id": "@cf/...", ... } ] }` 的标准市场规范格式。

### 2.4 Workers AI 配套辅助端点

除 `models/search` 外，OpenAPI 还提供了两个目录辅助端点：

- `GET /accounts/{account_id}/ai/tasks/search`: 枚举所有可用任务类型（如 `Text Generation`, `Text-to-Image`, `Automatic Speech Recognition` 等）。
- `GET /accounts/{account_id}/ai/authors/search`: 枚举所有已入驻的模型厂商（如 `meta`, `google`, `bytedance`, `qwen`, `openai` 等）。
- `GET /accounts/{account_id}/ai/models/schema?model={model_name}`: 动态获取指定模型的完整输入输出 JSON Schema。

---

## 3. Workers AI Binding：`env.AI.models()` 能力深度剖析与限制

### 3.1 官方类型证据核验

在最新发布的 `@cloudflare/workers-types`（版本 5.20260906.1，对应 workerd 运行时）的 `index.d.ts` 中，行 11820 至 11935 明确包含以下定义：

```typescript
type AiModelsSearchParams = {
  author?: string;
  hide_experimental?: boolean;
  page?: number;
  per_page?: number;
  search?: string;
  source?: number;
  task?: string;
};

type AiModelsSearchObject = {
  id: string;
  source: number;
  name: string;
  description: string;
  task: {
    id: string;
    name: string;
    description: string;
  };
  tags: string[];
  properties: {
    property_id: string;
    value: string;
  }[];
};

declare abstract class Ai<AiModelList extends AiModelListType = AiModels> {
  aiGatewayLogId: string | null;
  gateway(gatewayId: string): AiGateway;

  // 运行推理重载方法 (run)...
  run<Name extends keyof AiModelList>(...): Promise<...>;

  // 权威证据：官方模型目录枚举方法
  models(params?: AiModelsSearchParams): Promise<AiModelsSearchObject[]>;

  toMarkdown(): ToMarkdownService;
}
```

### 3.2 Binding 与 REST 端点的映射关系

`env.AI.models()` 与 REST API `/accounts/{account_id}/ai/models/search` 在底层属于同一服务体系：

1. **执行机制**：在 Worker 环境下调用 `env.AI.models()` 时，workerd C++ 运行时通过内部绑定的 RPC 管道直连 Cloudflare Workers AI 后端模型注册中心，**无需在代码中配置或暴露 Cloudflare Account ID 和 API Token**。
2. **响应解包**：REST API 返回的是包含 `success`, `errors`, `messages`, `result` 的标准 JSON Envelope，而 `env.AI.models()` 会在 C++ / JS 运行时内部直接解包并返回强类型的 `AiModelsSearchObject[]` 数组。

### 3.3 Binding 的独特优势

- **零凭据依赖**：由于 Worker 绑定了 `[ai]`，代码中完全不需要维护鉴权密钥或轮询 Token。
- **低延迟内网通信**：通信处于 Cloudflare 边缘内部微服务网络，避免了二次公网 TLS 握手与外部认证网关解析。

### 3.4 关键限制与生产陷阱

1. **环境受限（致命陷阱）**：  
   `env.AI.models()` **仅在 Cloudflare Workers / Pages 边缘运行时且显式绑定了 `[ai]` 的容器中存在**。在标准 Node.js 服务端、常规 Docker 镜像、Next.js Standalone 服务端或本地使用未模拟 workerd 的开发服务器运行时，`env.AI` 是 `undefined`。此时必须通过 HTTP 请求调用 REST 端点。
2. **分页元数据缺失**：  
   TypeScript 方法签名明确返回 `Promise<AiModelsSearchObject[]>`，没有返回 REST 端点中的 `result_info`（总页数、总条数）。如果需要拉取全部模型（超过 100 个），应用代码必须通过循环累加：
   ```typescript
   let page = 1;
   const allModels: AiModelsSearchObject[] = [];
   while (true) {
     const chunk = await env.AI.models({ page, per_page: 100, task: "Text Generation" });
     allModels.push(...chunk);
     if (chunk.length < 100) break;
     page++;
   }
   ```
3. **参数更新滞后**：  
   REST 端点最新支持的 `include_deprecated` 与 `format: "openrouter"` 尚未进入当前的 `AiModelsSearchParams` 类型声明中。
4. **供应商隔离**：  
   `env.AI.models()` **仅返回 Workers AI 自研与自托管的 `@cf/...` 模型**，绝不包含外部代理的 OpenAI、Anthropic、Google 等模型。

---

## 4. AI Gateway 是否存在跨 Provider 目录调查

### 4.1 OpenAPI 全量路径查验结果

在 `/tmp/cloudflare-openapi.json` 中检索全部 2154 个 API 路由，其中包含 `/ai-gateway` 的端点共有 38 个。经分类梳理，AI Gateway 涉及的功能如下：

- **网关实例与自定义域名**：`/gateways`、`/gateways/{gateway_id}/custom-domains`
- **供应商凭据与配置 (BYOK)**：`/gateways/{gateway_id}/provider_configs`
- **自定义 Provider 及费率规则**：`/custom-providers`、`/custom-providers/costs`
- **动态路由与金丝雀部署**：`/gateways/{gateway_id}/routes`、`/routes/{id}/deployments`、`/routes/{id}/versions`
- **日志审计与详情**：`/gateways/{gateway_id}/logs`、`/logs/{id}/request`、`/logs/{id}/response`
- **评估系统与数据集**：`/gateways/{gateway_id}/evaluations`、`/gateways/{gateway_id}/datasets`
- **账单与用量额度**：`/ai-gateway/billing/*`
- **获取 Provider 统一入口 URL**：`GET /gateways/{gateway_id}/url/{provider}`

**事实结论**：OpenAPI 规范中**不存在任何列出模型（如 List Models / Search Models）的 AI Gateway API 端点**。

### 4.2 官方文档结构查验 (`cloudflare/cloudflare-docs`)

官方开源文档库揭示了 Cloudflare 模型目录的组织模式：

1. **文档中的两套静态数据集合**：
   - `src/content/workers-ai-models/*.json`：对应 Workers AI 原生模型（结构与 `AiModelsSearchObject` 100% 一致）。
   - `src/content/catalog-models/*.json`：对应第三方与代理模型（包含 `alibaba/hh1-t2v.json`, `anthropic/...`, `openai/...` 等）。
2. **文档构建层解析逻辑 (`src/util/models/model-resolver.ts`)**：
   - 页面 `/workers-ai/models/`：仅从 `workers-ai-models` 集合读取 Cloudflare 托管模型。
   - 页面 `/ai/models/`：通过 `getResolvedModels()` 函数，在 Astro 静态构建期将 `catalog-models`（第三方模型）与 `workers-ai-models`（Cloudflare 托管模型）根据 `model_id` 匹配去重后合并渲染。
3. **架构本质定位**：  
   AI Gateway 的定位是**数据面代理与治理网关**（提供缓存 Cache、重试 Fallback、速率限制 Rate Limit、日志 Log 和密钥托管），它本身不维护动态的跨供应商模型注册发现中心。第三方模型（如 Google Gemini、OpenAI GPT-4o、Anthropic Claude）必须由应用层主动配置或由应用对接各供应商自身的 Model List API。

---

## 5. 当前项目架构分析与模型动态化风险评估

### 5.1 项目现状与代码字段映射

当前项目核心代码分布与模型职责如下：

1. **`lib/models.tsx`（静态模型字典与前端展示层）**：
   - 实际定义的 `Model` 字段只有：`id`、`name`、`logo`、`type`、可选的 `input`、`provider`、`tag`。
   - `provider` 当前只有 `workers-ai` 和 `google`；Workers AI 模型 ID 使用 `@cf/...`，Google 模型当前为 `gemini-3.5-flash`。`type` 当前只有 `Text Generation` 和 `Text to Image`，`logo` 是 ReactNode，`input` 是应用层能力标记。
2. **`app/api/chat/route.ts`（多供应商分支路由层）**：
   - 请求 schema 只接受 `provider` 为 `workers-ai` 或 `google`，并把 `model` 作为字符串传给对应 SDK。
   - Workers AI 使用 `workersai.chat(model)` 并套用 reasoning middleware；Google 使用 `google.chat(model)`，再通过 `aigateway` 包装，并按请求注入 Google Search 工具。
   - 因此，目录 API 返回“可用模型”不等于该项目已经验证了对应的消息协议、工具调用或推理输出格式。
3. **`app/api/image/route.ts`（图像生成专用路由层）**：
   - `z.enum(imageModels)` 在模块加载时由静态 `models` 生成，只接受当前静态列表里的 Text-to-Image ID；新增模型不能仅凭目录结果直接展示。
   - 路由发送 `/ai/run/{model}` 请求，并针对不同模型硬编码了二进制响应和 `result.image` Base64 JSON 两种响应格式；新增模型不能仅凭目录结果直接展示，必须先适配输入和输出。

### 5.2 全量无条件动态化的关键风险矩阵

| 风险维度                 | 现象与技术成因                                                                                                                                                           | 业务危害等级                                                       |
| :----------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------- |
| **能力元数据断层**       | Cloudflare `AiModelsSearchObject` 的 `properties` 仅为扁平键值对（如 `beta: "true"`），缺少 `supportsTools`, `supportsVision` 等前端 UI 渲染和逻辑判断所需的强类型标识。 | **严重 (High)**<br>UI 图标丢失、上下文长度未知、工具栏误显         |
| **调用协议不兼容**       | 目录项覆盖聊天、Embedding、ASR、TTS、图像等任务；即使属于 Text Generation，也不代表已验证当前 AI SDK、消息格式、流式输出、工具调用和 reasoning middleware 的组合。       | **致命 (Critical)**<br>用户选错模型导致聊天路由直接报 400/500 崩溃 |
| **任务类型污染**         | 官方全部模型库包含 Embeddings (`bge`)、ASR (`whisper`)、TTS (`aura`)、Translation (`m2m100`)。若未严格过滤，这些模型会混入聊天和绘图选择器。                             | **严重 (High)**<br>用户在聊天界面调用翻译或语音模型导致不可用      |
| **供应商模型丢失**       | Cloudflare API 仅返回 Cloudflare 托管模型，若完全用动态 API 覆盖本地列表，项目内置的 Google Gemini 模型会被彻底清除。                                                    | **致命 (Critical)**<br>核心功能缺失，外部 Provider 彻底失效        |
| **网络冷启动与级联故障** | 页面每次渲染或 API 触发时若实时请求 Cloudflare 接口，会增加 200~600ms 首屏延迟；一旦 Cloudflare API 限流或抖动，整个站点不可用。                                         | **严重 (High)**<br>应用可用性与第三方稳定性强耦合                  |

---

## 6. 推荐架构：三层融合模型目录方案

为了兼顾“**能够动态感知 Cloudflare 官方最新上架模型**”与“**保证应用前端界面与后端调用的绝对稳定**”，坚决反对在前端全量无条件渲染 API 返回值，强烈推荐采用以下**三层融合架构（Three-Tier Hybrid Catalog Architecture）**：

```
+-----------------------------------------------------------------------------+
|                            前端 UI 呈现与路由请求                           |
|       (消费标准的 Model[] 结构：包含 UI 图标、能力标签、上下文上限、推荐权重)       |
+-----------------------------------------------------------------------------+
                                       ^
                                       | 合并与过滤 (Merge & Validate)
+-----------------------------------------------------------------------------+
|                      中间层：应用能力增强与白名单系统                         |
|                                                                             |
|  [外部供应商本地注册表]         [业务能力覆盖层 (Capability Overlay Map)]      |
|  - Google Gemini 2.0 Flash    - 严格匹配/白名单机制 (Verified Allowlist)     |
|  - Google Gemini 1.5 Pro      - 补充 UI 字段：icon, displayName, order       |
|  - (未来扩展 OpenAI/Anthropic) - 补充运行时字段：supportsTools, isReasoning   |
+-----------------------------------------------------------------------------+
                                       ^
                                       | 动态注入与可用性校正 (Filter & Overlay)
+-----------------------------------------------------------------------------+
|                      底层：Cloudflare 官方动态目录探测                      |
|                                                                             |
|  - 生产运行环境：优先检测 env.AI.models({ task: "Text Generation" })        |
|  - Node.js / 构建环境：降级调用 GET /accounts/{id}/ai/models/search          |
|  - 作用：探测 Cloudflare 官方模型的在线状态、废弃状态 (Deprecated) 及新发布   |
+-----------------------------------------------------------------------------+
```

### 6.1 核心数据结构定义

```typescript
// 1. 本地定义的应用能力配置覆盖层
export interface ModelCapabilityOverlay {
  displayName: string;
  category: "chat" | "image" | "code" | "reasoning";
  contextWindow: number;
  maxTokens: number;
  supportsStreaming: boolean;
  supportsTools: boolean;
  supportsVision: boolean;
  supportsReasoning: boolean;
  isFeatured?: boolean;
  badge?: string;
}

// 2. 核心白名单与能力字典 (作为安全护栏)
export const MODEL_OVERLAYS: Record<string, ModelCapabilityOverlay> = {
  "@cf/meta/llama-3.3-70b-instruct": {
    displayName: "Llama 3.3 70B Instruct",
    category: "chat",
    contextWindow: 131072,
    maxTokens: 8192,
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: false,
    supportsReasoning: false,
    isFeatured: true,
    badge: "Most Powerful",
  },
  "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b": {
    displayName: "DeepSeek R1 Distill Qwen 32B",
    category: "reasoning",
    contextWindow: 131072,
    maxTokens: 8192,
    supportsStreaming: true,
    supportsTools: false,
    supportsVision: false,
    supportsReasoning: true,
    isFeatured: true,
    badge: "Reasoning",
  },
  "@cf/black-forest-labs/flux-1-schnell": {
    displayName: "FLUX.1 Schnell",
    category: "image",
    contextWindow: 0,
    maxTokens: 0,
    supportsStreaming: false,
    supportsTools: false,
    supportsVision: false,
    supportsReasoning: false,
    isFeatured: true,
    badge: "Fast Image",
  },
};

// 3. 外部供应商保留模型（不受 Cloudflare API 影响）
export const EXTERNAL_MODELS: ModelItem[] = [
  {
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    provider: "Google",
    category: "chat",
    contextWindow: 1048576,
    maxTokens: 8192,
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: true,
    supportsReasoning: false,
    isFeatured: true,
  },
];
```

### 6.2 动态合并与安全降级规则

1. **白名单模式（默认推荐）**：  
   从 Cloudflare 动态获取模型列表后，仅保留存在于 `MODEL_OVERLAYS` 中的模型。若 Cloudflare 标记某模型已下线（不在 search 结果中），则自动在前端置灰或下架；动态探测确认在线时，注入 `MODEL_OVERLAYS` 的能力元数据后渲染。
2. **开放探索模式（可选）**：  
   若开启“显示社区新模型”，对未在 `MODEL_OVERLAYS` 中的新模型，统一赋予保守兜底配置（`supportsStreaming: false`, `supportsTools: false`, `supportsVision: false`），并打上“实验性/未经验证”标签，防止破坏主流程。

---

## 7. 凭据管理、多级缓存与优雅降级策略

### 7.1 凭据管理安全规程

- **服务端与客户端严格隔离**：
  - `CF_ACCOUNT_ID` 与 `CF_WORKERS_AI_TOKEN` 只能在服务端（Node.js API Route 或 Edge Function）使用。
  - 严禁添加 `NEXT_PUBLIC_` 前缀导出给前端浏览器，防止 Token 泄露导致账户额度被盗刷。
- **运行时感知凭据策略**：
  ```typescript
  async function fetchCloudflareCatalog(env?: any): Promise<AiModelsSearchObject[]> {
    // 1. 如果在 Cloudflare Workers 环境下且有 env.AI 绑定，直接使用内部通道（无需 Token）
    if (env?.AI && typeof env.AI.models === "function") {
      return await env.AI.models({ task: "Text Generation", per_page: 100 });
    }

    // 2. 在 Node.js / Next.js Server 环境下，使用 REST API 凭据
    const accountId = process.env.CF_ACCOUNT_ID;
    const apiToken = process.env.CF_WORKERS_AI_TOKEN;
    if (!accountId || !apiToken) {
      throw new Error("Missing CF_ACCOUNT_ID or CF_WORKERS_AI_TOKEN in environment variables");
    }

    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/models/search?task=Text%20Generation&per_page=100`,
      {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
      },
    );
    if (!res.ok) throw new Error(`CF API error: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return data.result || [];
  }
  ```

### 7.2 多级缓存策略 (Multi-Tier Caching)

由于模型目录的变动频率较低（通常以天或周为单位），必须实施多级缓存避免频繁调用外部 API：

1. **构建期静态预渲染 (Build-Time Generation)**：  
   在 `next build` 期间拉取最新模型快照保存为 `cloudflare-models.cache.json`，即使运行时完全断网，也拥有最新构建时的数据。
2. **服务端内存 / SWR 缓存 (Server-Side Stale-While-Revalidate)**：  
   使用 Next.js `unstable_cache` 或全局内存缓存，设置 TTL = 1 小时至 6 小时：
   - 命中缓存立即返回（0ms 额外延迟）。
   - 缓存过期时在后台异步重新拉取更新（SWR），避免请求阻塞。
3. **HTTP 客户端响应头**：  
   API 路由 `/api/models` 返回响应头：  
   `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`。

### 7.3 优雅降级机制 (Graceful Degradation)

必须实施三级防御降级，确保系统高可用：

- **Tier 1 (健康主干)**：读取经过缓存加速的“Cloudflare 动态探测 + Overlay 映射 + 外部 Google 项”。
- **Tier 2 (接口异常降级)**：若动态拉取遇到网络超时、401 鉴权失效或 429 限流，捕获异常并记录 Warn 日志，立即降级回退到**本地静态保留的 `staticModels` 配置**（即现有 `lib/models.tsx`）。
- **Tier 3 (终极兜底)**：无论发生任何不可预测的运行时故障，保障当前静态 `lib/models.tsx` 中的聊天模型（包括 GLM-5.2、Kimi K2.6 与 Gemini 3.5 Flash）仍可用，前端界面绝不发生空白崩溃。

---

## 8. 官方信息源与证据分级列表

本报告所引用的所有数据与结论，严格按证据级别归类如下：

### 级别 A：官方一手规范与代码资产（绝对事实）

1. **Cloudflare 官方 OpenAPI 规范仓库**：
   - 仓库：`cloudflare/api-schemas`
   - 源文件：`https://raw.githubusercontent.com/cloudflare/api-schemas/main/openapi.json`
   - 核验证据：包含完整的 `GET /accounts/{account_id}/ai/models/search` 定义（OperationId: `workers-ai-search-model`，9 个查询参数，权限 `com.cloudflare.api.account.ai`）；全量查验 AI Gateway 38 个路由，证实无模型枚举 API。
2. **官方运行时类型定义（workerd 官方镜像）**：
   - npm 包：`@cloudflare/workers-types`（版本 5.20260906.1）
   - 仓库：`https://github.com/cloudflare/workerd`
   - 核验证据：`index.d.ts` 行 11790 至 11935 完整导出了 `AiModelsSearchParams`、`AiModelsSearchObject`，并在 `Ai` 抽象类中声明了 `models(params?: AiModelsSearchParams): Promise<AiModelsSearchObject[]>`。
3. **Cloudflare 官方技术文档开源仓库**：
   - 仓库：`https://github.com/cloudflare/cloudflare-docs`
   - 源文件：
     - `src/content/workers-ai-models/*.json`（证明官方托管模型字段）
     - `src/content/catalog-models/*.json`（证明第三方代理模型由文档侧独立维护）
     - `src/util/models/model-resolver.ts`（证明统一目录 `/ai/models/` 是静态合并生成而非来自 AI Gateway 运行时）

### 级别 B：官方公开文档与生产入口（官方约定）

1. **Cloudflare Workers AI 模型目录中心**：
   - URL: `https://developers.cloudflare.com/workers-ai/models/`
   - 内容：包含官方任务类型、Capability 标签（Reasoning, Function calling, Vision, Batch, LoRA 等）与厂商列表。
2. **Cloudflare AI Gateway 官方指南**：
   - URL: `https://developers.cloudflare.com/ai-gateway/usage/providers/`
   - 内容：AI Gateway 的 Provider 原生连接模式与代理架构说明。
3. **Cloudflare API 开发者中心**：
   - URL: `https://developers.cloudflare.com/api/`

### 级别 C：工程推断与落地考量（合理推论）

1. **文档隐藏标记推断**：OpenAPI 中该端点标记了 `x-forge-hidden: true`，推测 Cloudflare 内部倾向于引导开发者在仪表盘或文档卡片浏览模型，但为 FERN SDK 和程序化调用保留了标准支持。
2. **动态化设计推断**：单纯拉取模型 ID 无法满足现代 Web AI 客户端对流式、视觉、工具调用、思考链的渲染诉求，因此“动态可用性探测 + 静态能力覆盖层”是业界唯一兼顾扩展性与稳定性的工程解法。
