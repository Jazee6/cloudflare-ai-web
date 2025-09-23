import { createAiGateway } from "ai-gateway-provider";
import { createWorkersAI } from "workers-ai-provider";

export const aigateway = createAiGateway({
  accountId: process.env.CF_ACCOUNT_ID!,
  gateway: process.env.CF_AI_GATEWAY_NAME!,
});

export const workersai = createWorkersAI({
  accountId: process.env.CF_ACCOUNT_ID!,
  apiKey: process.env.CF_WORKERS_AI_TOKEN!,
});
