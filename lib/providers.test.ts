import { afterEach, expect, mock, test } from "bun:test";
import type { Model } from "@/lib/models";
import { createChatModel, ProviderConfigurationError } from "@/lib/providers";

const ENV_KEYS = [
  "CF_ACCOUNT_ID",
  "CF_WORKERS_AI_TOKEN",
  "CF_AI_GATEWAY_NAME",
  "CF_AI_GATEWAY_TOKEN",
] as const;

const savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const key of ENV_KEYS) {
    const original = savedEnv[key];
    if (original === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = original;
    }
  }
});

test("createChatModel routes ai-gateway unified models and Gateway Routes", () => {
  process.env.CF_ACCOUNT_ID = "acc";
  process.env.CF_AI_GATEWAY_NAME = "gw";
  process.env.CF_AI_GATEWAY_TOKEN = "gw-token";

  const openaiModel: Model = {
    id: "openai/gpt-5",
    name: "gpt-5",
    brand: "OpenAI",
    type: "Text Generation",
    provider: "ai-gateway",
    source: "external",
  };
  const routeModel: Model = {
    id: "dynamic/smart-chat",
    name: "smart-chat",
    brand: "AI Gateway",
    type: "Text Generation",
    provider: "ai-gateway",
    source: "external",
    isGatewayRoute: true,
  };

  expect(createChatModel(openaiModel).model.modelId).toBe("openai/gpt-5");
  expect(createChatModel(routeModel).model.modelId).toBe("dynamic/smart-chat");
});

test("createChatModel strips google-ai-studio/ prefix and attaches google_search when enabled", () => {
  process.env.CF_ACCOUNT_ID = "acc";
  process.env.CF_AI_GATEWAY_NAME = "gw";
  process.env.CF_AI_GATEWAY_TOKEN = "gw-token";

  const googleModel: Model = {
    id: "google-ai-studio/gemini-2.5-pro",
    name: "gemini-2.5-pro",
    brand: "Google",
    type: "Text Generation",
    provider: "ai-gateway",
    source: "external",
    input: ["image", "search"],
  };

  const withSearch = createChatModel(googleModel, { search: true });
  expect(withSearch.model.modelId).toBe("gemini-2.5-pro");
  expect(withSearch.tools?.google_search).toBeDefined();

  const withoutSearch = createChatModel(googleModel, { search: false });
  expect(withoutSearch.model.modelId).toBe("google-ai-studio/gemini-2.5-pro");
  expect(withoutSearch.tools).toBeUndefined();
});

test("createChatModel throws ProviderConfigurationError when gateway config is missing", () => {
  process.env.CF_ACCOUNT_ID = "acc";
  process.env.CF_AI_GATEWAY_NAME = "gw";
  delete process.env.CF_AI_GATEWAY_TOKEN;

  const model: Model = {
    id: "openai/gpt-5",
    name: "gpt-5",
    brand: "OpenAI",
    type: "Text Generation",
    provider: "ai-gateway",
    source: "external",
  };

  expect(() => createChatModel(model)).toThrow(ProviderConfigurationError);
});

test("createChatModel injects gateway skip-cache, metadata, and captures response headers for workers-ai", async () => {
  process.env.CF_ACCOUNT_ID = "acc";
  process.env.CF_WORKERS_AI_TOKEN = "cf-token";
  process.env.CF_AI_GATEWAY_NAME = "gw";
  process.env.CF_AI_GATEWAY_TOKEN = "gw-token";

  let capturedHeaders: Headers | undefined;
  globalThis.fetch = mock(async (_input: RequestInfo | URL, init?: RequestInit) => {
    capturedHeaders = new Headers(init?.headers);
    return new Response(JSON.stringify({ result: { response: "ok" }, success: true }), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "cf-aig-cache-status": "HIT",
      },
    });
  }) as unknown as typeof fetch;

  let capturedGatewayMeta: unknown;
  const workersModel: Model = {
    id: "@cf/zai-org/glm-4.7-flash",
    name: "glm-4.7-flash",
    brand: "ZAI",
    type: "Text Generation",
    provider: "workers-ai",
    source: "cloudflare",
    contextWindow: 131072,
  };

  const chatModel = createChatModel(workersModel, {
    retry: true,
    skipCache: true,
    onGatewayMetadata: (meta) => {
      capturedGatewayMeta = meta;
    },
  });

  await chatModel.model.doGenerate({
    prompt: [{ role: "user", content: [{ type: "text", text: "hi" }] }],
  });

  expect(capturedHeaders?.get("cf-aig-authorization")).toBe("Bearer gw-token");
  expect(capturedHeaders?.get("cf-aig-skip-cache")).toBe("true");
  expect(capturedHeaders?.get("cf-aig-metadata")).toBe(
    JSON.stringify({ app: "cloudflare-ai-web", retry: true }),
  );
  expect(capturedGatewayMeta).toEqual({ cacheStatus: "HIT" });
});
