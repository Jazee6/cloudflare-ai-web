/**
 * Static, crawler-facing description of the application. The SPA shell is prerendered without UI
 * text, so these strings are what search engines and AI crawlers that do not run JavaScript see.
 */
export const SITE_NAME = "Cloudflare AI Web";
export const SITE_SHORT_NAME = "AI Web";
export const SITE_TITLE = "Cloudflare AI Web · Multi-model AI chat on Cloudflare";
export const SITE_DESCRIPTION =
  "Open-source, self-hostable AI chat built on Cloudflare Workers AI and AI Gateway: many models, image generation, documents, web pages and knowledge base search, with chats kept in your browser. Deploy to Cloudflare Workers, Vercel or Docker.";
export const SOURCE_URL = "https://github.com/Jazee6/cloudflare-ai-web";

export const OG_IMAGE = { path: "/og.jpg", width: 1200, height: 630 } as const;

export const FEATURES_EN = [
  "Chat with Cloudflare Workers AI models and external models routed through Cloudflare AI Gateway (BYOK, Unified Billing, Gateway Routes).",
  "Bring your own provider keys or AI Gateway in the browser to use personal models.",
  "Generate and edit images inside conversations with up to 4 reference images.",
  "Read documents and web pages, and ground answers in Cloudflare AI Search knowledge bases with citations.",
  "Hide, group and reorder models; voice input and read-aloud; token usage and estimated cost.",
  "Conversations stay in the browser (IndexedDB) and can be exported or imported as JSON.",
  "Optional access password; installable as an app and opens offline.",
];

export const FEATURES_ZH = [
  "使用 Cloudflare Workers AI 模型，以及通过 Cloudflare AI Gateway 接入的外部模型（BYOK、Unified Billing、Gateway Route）。",
  "在浏览器里填写自己的 provider Key 或 AI Gateway，使用个人模型。",
  "在会话内生成和编辑图片，最多使用 4 张参考图。",
  "解析文档和网页，并基于 Cloudflare AI Search 知识库回答、展示引用来源。",
  "隐藏、分组和排序模型；语音输入与朗读；Token 用量与费用估算。",
  "聊天记录保存在浏览器本地（IndexedDB），可导出或导入 JSON。",
  "可设置访问密码；可安装为应用，离线也能打开。",
];

/** The deployment's public origin from the build-time `SITE_URL`, without a trailing slash. */
export const SITE_URL: string | undefined = import.meta.env.SITE_URL || undefined;

/** An absolute URL when `SITE_URL` is known, otherwise the root-relative path. */
export const siteUrl = (path: string) => (SITE_URL ? `${SITE_URL}${path}` : path);
