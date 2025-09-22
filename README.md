# cloudflare-ai-web

![readme.png](https://github.com/user-attachments/assets/e1c4e604-568d-4778-8780-29473619744f)

## 部署

### Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FJazee6%2Fcloudflare-ai-web&demo-title=Cloudflare%20AI%20Web&demo-url=https%3A%2F%2Fai.jaze.top)

示例：https://ai.jaze.top

## 特性

- 使用 Cloudflare Workers AI 快速搭建多模型AI平台
- 支持 Serverless 快速部署
- 聊天记录本地存储

## 部署说明

### 环境变量列表

| 名称                  | 描述                          | 
|---------------------|-----------------------------|
| CF_ACCOUNT_ID       | Cloudflare 账户ID             |  
| CF_WORKERS_AI_TOKEN | Cloudflare Workers AI Token |

示例： 查看`.env.example`文件

#### CF_WORKERS_AI_TOKEN

- 管理账户 - 账户API令牌 - 创建令牌 - 使用Workers AI模板创建
