import { afterEach, expect, mock, test } from "bun:test";
import {
  getModelPrice,
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
  delete process.env.CF_AI_GATEWAY_NAME;
  process.env.CF_AI_GATEWAY_TOKEN = "gw-tok";
  process.env.CF_AI_SEARCH_TOKEN = "search-tok";
  process.env.CF_AI_SEARCH_INSTANCES = " , ";

  expect(getAppCapabilities()).toEqual({
    documents: true,
    webFetch: true,
    browserRender: false,
    knowledgeBase: false,
    personalViaDeploymentGateway: false,
  });

  process.env.CF_BROWSER_RUN_TOKEN = "br-tok";
  process.env.CF_AI_GATEWAY_NAME = "gw";
  process.env.CF_AI_SEARCH_INSTANCES = "docs:Docs";
  expect(getAppCapabilities()).toEqual({
    documents: true,
    webFetch: true,
    browserRender: true,
    knowledgeBase: true,
    personalViaDeploymentGateway: true,
  });
});

test("getModelCatalog returns no Cloudflare models without Workers AI credentials", async () => {
  delete process.env.CF_ACCOUNT_ID;
  delete process.env.CF_WORKERS_AI_TOKEN;
  delete process.env.CF_AI_GATEWAY_MODELS;
  const originalFetch = globalThis.fetch;
  const fetchMock = mock(() => Promise.reject(new Error("unexpected fetch")));
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  try {
    expect(await getModelCatalog()).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getAppCapabilities()).toMatchObject({
      documents: false,
      knowledgeBase: false,
      personalViaDeploymentGateway: false,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("getModelCatalog retains stale Catalog Snapshot when background refresh fails", async () => {
  const originalFetch = globalThis.fetch;
  const catalogGlobal = globalThis as typeof globalThis & {
    cloudflareModelCatalogCache?: Map<string, { models?: unknown[]; refreshedAt: number }>;
  };
  catalogGlobal.cloudflareModelCatalogCache?.clear();

  process.env.CF_ACCOUNT_ID = "test-account";
  process.env.CF_WORKERS_AI_TOKEN = "test-token";

  let shouldFail = false;
  globalThis.fetch = mock(async (input: RequestInfo | URL) => {
    if (shouldFail) {
      return new Response("upstream down", { status: 503 });
    }
    const task = new URL(String(input)).searchParams.get("task") ?? "Text Generation";
    return Response.json({
      success: true,
      result: [
        {
          id: task === "Text Generation" ? "@cf/test/snapshot-chat" : "@cf/test/snapshot-img",
          source: 1,
          name: task === "Text Generation" ? "@cf/test/snapshot-chat" : "@cf/test/snapshot-img",
          description: "Snapshot model",
          task: { id: task, name: task, description: "" },
          tags: [],
          properties: [],
        },
      ],
      result_info: { page: 1, per_page: 100, count: 1, total_count: 1 },
    });
  }) as unknown as typeof fetch;

  try {
    const initial = await getModelCatalog();
    expect(initial.some((model) => model.id === "@cf/test/snapshot-chat")).toBe(true);

    // Expire TTL in-place to simulate stale snapshot triggering background refresh.
    for (const entry of catalogGlobal.cloudflareModelCatalogCache?.values() ?? []) {
      entry.refreshedAt = 0;
    }
    shouldFail = true;

    const fallback = await getModelCatalog();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fallback.some((model) => model.id === "@cf/test/snapshot-chat")).toBe(true);
  } finally {
    globalThis.fetch = originalFetch;
    catalogGlobal.cloudflareModelCatalogCache?.clear();
  }
});

test("reads the Model Price from the catalog's per-million-token USD entries", () => {
  const withPrice = (value: unknown) =>
    getModelPrice({
      id: "m",
      source: 1,
      name: "m",
      description: "",
      task: { id: "t", name: "Text Generation", description: "" },
      tags: [],
      properties: [{ property_id: "price", value }],
    });
  expect(
    withPrice([
      { unit: "per M input tokens", price: 0.35, currency: "USD" },
      { unit: "per M output tokens", price: 0.75, currency: "USD" },
      { unit: "per M cached input tokens", price: 0.1, currency: "USD" },
    ]),
  ).toEqual({ input: 0.35, output: 0.75 });
  expect(withPrice([{ unit: "per M input tokens", price: 0.1, currency: "USD" }])).toEqual({
    input: 0.1,
    output: 0,
  });
  expect(withPrice([{ unit: "token", price: 0.01 }])).toBeUndefined();
  expect(withPrice([{ unit: "per M input tokens", price: 1, currency: "EUR" }])).toBeUndefined();
  expect(withPrice("free")).toBeUndefined();
});
