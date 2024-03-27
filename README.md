# cloudflare-ai-web

## AI 启动！

### 一键部署（推荐）

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FJazee6%2Fcloudflare-ai-web&env=CF_TOKEN,CF_GATEWAY&envDescription=%E7%8E%AF%E5%A2%83%E5%8F%98%E9%87%8F%E4%BF%A1%E6%81%AF%E8%AF%B7%E6%9F%A5%E7%9C%8B&envLink=https%3A%2F%2Fgithub.com%2FJazee6%2Fcloudflare-ai-web)

示例：https://ai.jaze.top

### Docker

```bash
docker run -d --name cloudflare-ai-web \
  -e CF_TOKEN=YOUR_CF_TOKEN \
  -e CF_GATEWAY=YOUR_CF_GATEWAY \
  -p 3000:3000 \
  --restart=always \
  jazee6/cloudflare-ai-web
```

## 特性

- 利用 Cloudflare Workers AI 快速搭建AI聊天、AI翻译、AI绘画平台
- Vercel Edge Functions 部署，全球边缘网络加速，500000次免费额度，无限制响应时间
- 支持 ChatGPT GeminiPro(Vision)，支持开启访问密码，支持自定义域名

### 模型支持

- 视觉 `GeminiPro Vision`
- 文生图 `stable-diffusion-xl-base-1.0` `dreamshaper-8-lcm`
- 聊天 `GeminiPro` `gpt-3.5-turbo` `qwen1.5-14b-chat-awq`
- 翻译 `m2m100-1.2b`

## 部署说明

### 环境变量列表

| 名称             | 描述                                 | 
|----------------|------------------------------------|
| CF_TOKEN       | Cloudflare Workers AI Token        |  
| CF_GATEWAY     | Cloudflare AI Gateway URL          |    
| OPENAI_API_KEY | OpenAI API Key (需要ChatGPT时填写)      |     
| G_API_KEY      | Google AI API Key (需要GeminiPro时填写) |   
| G_API_URL      | Google AI 反代 (非美国ip填写，或参考以下配置)     |    
| PASSWORD       | 访问密码 (可选)                          |   

#### CF_TOKEN

https://dash.cloudflare.com/profile/api-tokens

- 单击创建令牌
- 使用Workers AI (Beta)模板
- 单击继续以显示摘要
- 单击创建令牌
- 复制您的令牌，在vercel中设置环境变量

#### CF_GATEWAY

https://dash.cloudflare.com/

- Cloudflare 侧栏 AI - AI Gateway
- 添加新 AI Gateway
- 填写名称和URL slug创建
- 单击右上角API Endpoints
- 复制您的Universal Endpoint，在vercel中设置环境变量

#### G_API_KEY

https://ai.google.dev/tutorials/rest_quickstart#set_up_your_api_key

#### G_API_URL

参考 https://github.com/Jazee6/gemini-proxy 搭建反代

或者在`nuxt.config.ts`中添加以下配置

```
nitro: {
    vercel: {
        regions: ["cle1", "iad1", "pdx1", "sfo1", "sin1", "syd1", "hnd1", "kix1"]
    }
}
```

## Tips

- 由于Workers AI 目前为开放 Beta 版，不建议用于生产数据和流量，限制 + 访问可能会发生变化
- 请不要启用AI Gateway的缓存，否则可能会导致重复的回复
- 请保持与Main分支同步，以便获取最新的功能和修复

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Jazee6/cloudflare-ai-web&type=Date)](https://star-history.com/#Jazee6/cloudflare-ai-web&Date)
