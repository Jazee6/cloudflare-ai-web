# cloudflare-ai-web

> 开发中...

## AI 启动！

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FJazee6%2Fcloudflare-ai-web&env=CF_TOKEN,CF_GATEWAY&envDescription=%E7%8E%AF%E5%A2%83%E5%8F%98%E9%87%8F%E4%BF%A1%E6%81%AF%E8%AF%B7%E6%9F%A5%E7%9C%8B&envLink=https%3A%2F%2Fgithub.com%2FJazee6%2Fcloudflare-ai-web)

利用免费、免翻墙的 Cloudflare Workers AI 快速搭建文本生成、AI翻译、AI绘画平台

环境变量：

- `CF_TOKEN` - Cloudflare Workers AI Token
- `CF_GATEWAY` - Cloudflare AI Gateway URL
- `OPENAI_API_KEY` - OpenAI API Key (可选)
- `PASSWORD` - 访问密码 (可选)

## 部署说明

### CF_TOKEN

https://dash.cloudflare.com/profile/api-tokens

- 单击创建令牌
- 使用Workers AI (Beta)模板
- 单击继续以显示摘要
- 单击创建令牌
- 复制您的令牌，在vercel中设置环境变量

### CF_GATEWAY

https://dash.cloudflare.com/

- Cloudflare 侧栏 AI - AI Gateway
- 添加新 AI Gateway
- 填写名称和URL slug创建
- 单击右上角API Endpoints
- 复制您的Universal Endpoint，在vercel中设置环境变量

> 请不要启用AI Gateway的缓存，否则可能会导致重复的回复

## Tips

由于Workers AI 目前为开放 Beta 版，不建议用于生产数据和流量，限制 + 访问可能会发生变化

## TODO

- [ ] 对话历史

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Jazee6/cloudflare-ai-web&type=Date)](https://star-history.com/#Jazee6/cloudflare-ai-web&Date)
