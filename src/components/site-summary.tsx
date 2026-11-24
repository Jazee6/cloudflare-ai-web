import { FEATURES_EN, FEATURES_ZH, SITE_DESCRIPTION, SITE_NAME, SOURCE_URL } from "@/lib/site";

/**
 * A plain description inside <noscript> for crawlers and AI agents that do not run JavaScript;
 * the SPA shell has no other text for them. Browsers with JavaScript never render it.
 */
const SiteSummary = () => (
  <noscript>
    <main>
      <h1>{SITE_NAME}</h1>
      <p>{SITE_DESCRIPTION}</p>
      <ul>
        {FEATURES_EN.map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>
      <section lang="zh-CN">
        <h2>中文简介</h2>
        <p>
          开源、可自部署的 AI 对话平台，基于 Cloudflare Workers AI 与 AI Gateway 构建，可部署到
          Cloudflare Workers、Vercel 或 Docker，聊天记录保存在浏览器本地。
        </p>
        <ul>
          {FEATURES_ZH.map((feature) => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>
      </section>
      <p>
        <a href={SOURCE_URL}>GitHub</a> · This app requires JavaScript.
      </p>
    </main>
  </noscript>
);

export default SiteSummary;
