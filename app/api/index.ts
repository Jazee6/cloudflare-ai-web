import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAiGateway } from "ai-gateway-provider";
import { createWorkersAI } from "workers-ai-provider";

const requireEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const CF_ACCOUNT_ID = requireEnv("CF_ACCOUNT_ID");
const CF_AI_GATEWAY_NAME = requireEnv("CF_AI_GATEWAY_NAME");
const CF_WORKERS_AI_TOKEN = requireEnv("CF_WORKERS_AI_TOKEN");

export const aigateway = createAiGateway({
  accountId: process.env.CF_ACCOUNT_ID ?? "",
  gateway: process.env.CF_AI_GATEWAY_NAME ?? "",
  apiKey: process.env.CF_AI_GATEWAY_TOKEN,
});

export const workersai = createWorkersAI({
  accountId: process.env.CF_ACCOUNT_ID ?? "",
  apiKey: process.env.CF_WORKERS_AI_TOKEN ?? "",
});

export const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
});
