import type { LanguageModelV4 } from "@ai-sdk/provider";
import { extractReasoningMiddleware, wrapLanguageModel } from "ai";
import { type AiGatewayOptions, createAiGateway, parseAiGatewayOptions } from "ai-gateway-provider";
import { createGoogleGenerativeAI } from "ai-gateway-provider/providers/google";
import { createUnified } from "ai-gateway-provider/providers/unified";
import { createWorkersAI } from "workers-ai-provider";
import { extractGatewayMetadata, ProviderConfigurationError } from "@/lib/gateway-errors";
import type { Model } from "@/lib/models";
import type { GatewayMetadata } from "@/lib/response-metadata";
import { createWorkersAIFetch } from "@/lib/workers-ai-fetch";

export { ProviderConfigurationError };

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

const buildGatewayOptions = (
  catalogModel: Model,
  options: { skipCache?: boolean; retry?: boolean },
): AiGatewayOptions => ({
  ...(options.skipCache || options.retry ? { skipCache: true } : {}),
  ...(catalogModel.byokAlias ? { byokAlias: catalogModel.byokAlias } : {}),
  metadata: {
    app: "cloudflare-ai-web",
    ...(options.retry ? { retry: true } : {}),
  },
});

const getWorkersAIProvider = (
  gatewayOptions: AiGatewayOptions,
  onGatewayMetadata?: (metadata: GatewayMetadata) => void,
) => {
  const credentials = getCloudflareCredentials();
  const gatewayCredentials = getCloudflareGatewayCredentials();
  if (!gatewayCredentials) {
    return createWorkersAI({ ...credentials, fetch: createWorkersAIFetch() });
  }

  const { gatewayId, gatewayToken } = gatewayCredentials;
  const gatewayHeaders = parseAiGatewayOptions(gatewayOptions);

  return createWorkersAI({
    ...credentials,
    gateway: { id: gatewayId },
    fetch: createWorkersAIFetch(async (input, init) => {
      const headers = new Headers(init?.headers);
      headers.set("cf-aig-authorization", `Bearer ${gatewayToken}`);
      for (const [key, value] of gatewayHeaders.entries()) {
        headers.set(key, value);
      }
      const response = await globalThis.fetch(input, { ...init, headers });
      const gatewayMeta = extractGatewayMetadata(response.headers);
      if (gatewayMeta) {
        onGatewayMetadata?.(gatewayMeta);
      }
      return response;
    }),
  });
};

type GoogleSearchTool = ReturnType<
  ReturnType<typeof createGoogleGenerativeAI>["tools"]["googleSearch"]
>;

export interface ChatModel {
  model: LanguageModelV4;
  tools?: { google_search: GoogleSearchTool };
  /** Set when the provider's own default would cut responses short. */
  maxOutputTokens?: number;
}

export interface CreateChatModelOptions {
  search?: boolean;
  skipCache?: boolean;
  retry?: boolean;
  onGatewayMetadata?: (metadata: GatewayMetadata) => void;
}

/** Workers AI stops at 256 tokens unless asked for more. */
const WORKERS_AI_MAX_OUTPUT_TOKENS = 8192;
const GOOGLE_AI_STUDIO_PREFIX = "google-ai-studio/";

/**
 * Resolves a catalog model to the language model that serves it.
 * Throws ProviderConfigurationError when the provider's environment is incomplete.
 */
export const createChatModel = (
  catalogModel: Model,
  options: CreateChatModelOptions = {},
): ChatModel => {
  const gatewayOptions = buildGatewayOptions(catalogModel, options);

  switch (catalogModel.provider) {
    case "ai-gateway": {
      const accountId = requireEnvironmentVariable("CF_ACCOUNT_ID");
      const gatewayId = requireEnvironmentVariable("CF_AI_GATEWAY_NAME");
      const gatewayToken = requireEnvironmentVariable("CF_AI_GATEWAY_TOKEN");
      const gateway = createAiGateway({
        accountId,
        gateway: gatewayId,
        apiKey: gatewayToken,
        options: gatewayOptions,
      });

      if (
        catalogModel.id.startsWith(GOOGLE_AI_STUDIO_PREFIX) &&
        options.search &&
        catalogModel.input?.includes("search")
      ) {
        const google = createGoogleGenerativeAI();
        const modelName = catalogModel.id.slice(GOOGLE_AI_STUDIO_PREFIX.length);
        return {
          model: gateway([google.chat(modelName)]),
          tools: { google_search: google.tools.googleSearch({}) },
        };
      }

      const unified = createUnified();
      return {
        model: gateway([unified.chatModel(catalogModel.id)]),
      };
    }
    case "workers-ai": {
      const workerModel = getWorkersAIProvider(gatewayOptions, options.onGatewayMetadata).chat(
        catalogModel.id,
      );
      return {
        model: catalogModel.reasoning
          ? wrapLanguageModel({
              model: workerModel,
              middleware: extractReasoningMiddleware({ tagName: "think" }),
            })
          : workerModel,
        // A quarter of the window leaves the rest for the Model Context.
        maxOutputTokens: catalogModel.contextWindow
          ? Math.min(WORKERS_AI_MAX_OUTPUT_TOKENS, Math.floor(catalogModel.contextWindow / 4))
          : WORKERS_AI_MAX_OUTPUT_TOKENS,
      };
    }
  }
};
