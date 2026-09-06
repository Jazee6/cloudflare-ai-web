import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAiGateway } from "ai-gateway-provider";
import { createWorkersAI } from "workers-ai-provider";

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

export const getWorkersAIProvider = () => {
  const credentials = getCloudflareCredentials();
  const gatewayCredentials = getCloudflareGatewayCredentials();
  if (!gatewayCredentials) {
    return createWorkersAI(credentials);
  }

  const { gatewayId, gatewayToken } = gatewayCredentials;
  const gatewayFetch: typeof globalThis.fetch = Object.assign(
    (input: Parameters<typeof globalThis.fetch>[0], init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      headers.set("cf-aig-authorization", `Bearer ${gatewayToken}`);
      return globalThis.fetch(input, { ...init, headers });
    },
    { preconnect: globalThis.fetch.preconnect },
  );

  return createWorkersAI({
    ...credentials,
    gateway: { id: gatewayId },
    fetch: gatewayFetch,
  });
};

export const getGoogleGatewayProviders = () => {
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
