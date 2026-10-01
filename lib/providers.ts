import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModelV4 } from "@ai-sdk/provider";
import { extractReasoningMiddleware, wrapLanguageModel } from "ai";
import { createAiGateway } from "ai-gateway-provider";
import { createWorkersAI } from "workers-ai-provider";
import { createWorkersAIFetch } from "@/lib/workers-ai-fetch";
import type { Model } from "@/lib/models";

export class ProviderConfigurationError extends Error {
  constructor(name: string) {
    super(`Missing required environment variable: ${name}`);
    this.name = "ProviderConfigurationError";
  }
}

const requireEnvironmentVariable = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new ProviderConfigurationError(name);
  }
  return value;
};

export const getCloudflareCredentials = () => ({
  accountId: requireEnvironmentVariable("CF_ACCOUNT_ID"),
  apiKey: requireEnvironmentVariable("CF_WORKERS_AI_TOKEN"),
});

export const getCloudflareGatewayCredentials = () => {
  const gatewayId = process.env.CF_AI_GATEWAY_NAME;
  if (!gatewayId) {
    return undefined;
  }

  return {
    gatewayId,
    gatewayToken: requireEnvironmentVariable("CF_AI_GATEWAY_TOKEN"),
  };
};

export type CloudflareGatewayCredentials = NonNullable<
  ReturnType<typeof getCloudflareGatewayCredentials>
>;

const getWorkersAIProvider = () => {
  const credentials = getCloudflareCredentials();
  const gatewayCredentials = getCloudflareGatewayCredentials();
  if (!gatewayCredentials) {
    return createWorkersAI({ ...credentials, fetch: createWorkersAIFetch() });
  }

  const { gatewayId, gatewayToken } = gatewayCredentials;
  return createWorkersAI({
    ...credentials,
    gateway: { id: gatewayId },
    fetch: createWorkersAIFetch((input, init) => {
      const headers = new Headers(init?.headers);
      headers.set("cf-aig-authorization", `Bearer ${gatewayToken}`);
      return globalThis.fetch(input, { ...init, headers });
    }),
  });
};

const getGoogleGatewayProviders = () => {
  const google = createGoogleGenerativeAI({
    apiKey: requireEnvironmentVariable("GOOGLE_API_KEY"),
  });
  const gateway = createAiGateway({
    accountId: requireEnvironmentVariable("CF_ACCOUNT_ID"),
    gateway: requireEnvironmentVariable("CF_AI_GATEWAY_NAME"),
    apiKey: requireEnvironmentVariable("CF_AI_GATEWAY_TOKEN"),
  });

  return { gateway, google };
};

type GoogleSearchTool = ReturnType<
  ReturnType<typeof createGoogleGenerativeAI>["tools"]["googleSearch"]
>;

export interface ChatModel {
  model: LanguageModelV4;
  tools?: { google_search: GoogleSearchTool };
}

/**
 * Resolves a catalog model to the language model that serves it.
 * Throws ProviderConfigurationError when the provider's environment is incomplete.
 */
export const createChatModel = (catalogModel: Model, options: { search?: boolean }): ChatModel => {
  switch (catalogModel.provider) {
    case "google": {
      const { gateway, google } = getGoogleGatewayProviders();
      return {
        model: gateway([google.chat(catalogModel.id)]),
        tools: options.search ? { google_search: google.tools.googleSearch({}) } : undefined,
      };
    }
    case "workers-ai": {
      const workerModel = getWorkersAIProvider().chat(catalogModel.id);
      return {
        model: catalogModel.reasoning
          ? wrapLanguageModel({
              model: workerModel,
              middleware: extractReasoningMiddleware({ tagName: "think" }),
            })
          : workerModel,
      };
    }
  }
};
