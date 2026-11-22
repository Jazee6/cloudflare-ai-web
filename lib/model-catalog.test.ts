import { afterEach, expect, mock, test } from "bun:test";
import {
  getAppCapabilities,
  getCatalogModel,
  getModelCatalog,
  hasSignal,
} from "@/lib/model-catalog";

const ENV_KEYS = [
  "CF_ACCOUNT_ID",
  "CF_WORKERS_AI_TOKEN",
  "CF_AI_GATEWAY_NAME",
  "CF_AI_GATEWAY_TOKEN",
  "CF_AI_GATEWAY_MODELS",
  "CF_BROWSER_RUN_TOKEN",
  "CF_AI_SEARCH_TOKEN",
  "CF_AI_SEARCH_INSTANCES",
] as const;

const savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of ENV_KEYS) {
    const original = savedEnv[key];
    if (original === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = original;
    }
  }
});

test("rejects ambiguous capability signal substrings", () => {
  const model = {
    id: "test",
    source: 1,
    name: "@cf/test/model",
    description: "Test model",
    task: { id: "text", name: "Text Generation", description: "Test" },
    tags: ["visionary", "pre-beta-candidate"],
    properties: [
      { property_id: "reasoning-mode", value: "true" },
      { property_id: "vision", value: "sometimes" },
    ],
  };

  expect(hasSignal(model, ["vision"])).toBe(false);
  expect(hasSignal(model, ["beta"])).toBe(false);
  expect(hasSignal(model, ["reasoning"])).toBe(false);
});

test("loads catalog models with structured property values", async () => {
  const originalFetch = globalThis.fetch;

  process.env.CF_ACCOUNT_ID = "test-account";
  process.env.CF_WORKERS_AI_TOKEN = "test-token";
  globalThis.fetch = mock(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    const task = url.searchParams.get("task") ?? "Text Generation";
    const name = task === "Text Generation" ? "@cf/test/chat" : "@cf/test/image";

    return Response.json({
      success: true,
      result: [
        {
          id: name,
          source: 1,
          name,
          description: "Test model",
          task: {
            id: task,
            name: task,
            description: "Test task",
          },
          tags: [],
          properties: [
            {
              property_id: "price",
              value: [{ unit: "token", price: 0.01 }],
            },
            { property_id: "reasoning", value: "true" },
            { property_id: "context_window", value: "128000" },
          ],
        },
        ...(task === "Text Generation"
          ? [
              {
                id: "@cf/meta/llama-guard-3-8b",
                source: 1,
                name: "@cf/meta/llama-guard-3-8b",
                description: "Moderation model",
                task: { id: task, name: task, description: "Test task" },
                tags: ["moderation", "safety"],
                properties: [],
              },
            ]
          : [
              {
                id: "@cf/test/sd-inpainting",
                source: 1,
                name: "@cf/test/sd-inpainting",
                description: "Inpainting model",
                task: { id: task, name: task, description: "Test task" },
                tags: [],
                properties: [],
              },
            ]),
      ],
      result_info: {
        page: 1,
        per_page: 100,
        count: 1,
        total_count: 1,
      },
    });
  }) as unknown as typeof fetch;

  try {
    const catalog = await getModelCatalog();
    expect(catalog.find((model) => model.id === "@cf/test/chat")).toMatchObject({
      reasoning: true,
      contextWindow: 128000,
      type: "Text Generation",
    });
    expect(catalog.find((model) => model.id === "@cf/meta/llama-guard-3-8b")).toBeUndefined();
    expect(catalog.find((model) => model.id === "@cf/test/image")).toMatchObject({
      type: "Text to Image",
    });
    expect(catalog.find((model) => model.id === "@cf/test/sd-inpainting")).toBeUndefined();
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("getCatalogModel resolves ai-gateway models including server-only byokAlias", async () => {
  process.env.CF_ACCOUNT_ID = "test-account";
  process.env.CF_AI_GATEWAY_NAME = "gw";
  process.env.CF_AI_GATEWAY_TOKEN = "gw-token";
  process.env.CF_AI_GATEWAY_MODELS = "openai/gpt-5?byokAlias=prod";

  const model = await getCatalogModel("openai/gpt-5", "Text Generation", "ai-gateway");
  expect(model).toMatchObject({
    id: "openai/gpt-5",
    provider: "ai-gateway",
    byokAlias: "prod",
  });
});

test("getAppCapabilities derives feature flags from server configuration", () => {
  process.env.CF_ACCOUNT_ID = "acc";
  process.env.CF_WORKERS_AI_TOKEN = "tok";
  delete process.env.CF_BROWSER_RUN_TOKEN;
  process.env.CF_AI_SEARCH_TOKEN = "search-tok";
  process.env.CF_AI_SEARCH_INSTANCES = " , ";

  expect(getAppCapabilities()).toEqual({
    documents: true,
    webFetch: true,
    browserRender: false,
    knowledgeBase: false,
  });

  process.env.CF_BROWSER_RUN_TOKEN = "br-tok";
  process.env.CF_AI_SEARCH_INSTANCES = "docs:Docs";
  expect(getAppCapabilities()).toEqual({
    documents: true,
    webFetch: true,
    browserRender: true,
    knowledgeBase: true,
  });
});
