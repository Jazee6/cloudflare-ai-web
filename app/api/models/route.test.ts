import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import { GET as getModels } from "@/app/api/models/route";
import type { ModelCatalogResponse } from "@/lib/models";

const ENV_KEYS = [
  "CF_ACCOUNT_ID",
  "CF_WORKERS_AI_TOKEN",
  "CF_AI_GATEWAY_NAME",
  "CF_AI_GATEWAY_TOKEN",
  "CF_AI_GATEWAY_MODELS",
] as const;

const savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
const originalFetch = globalThis.fetch;
const originalCaches = (globalThis as { caches?: unknown }).caches;
const catalogCache = globalThis as typeof globalThis & {
  cloudflareModelCatalogCache?: Map<string, unknown>;
};

beforeEach(() => {
  catalogCache.cloudflareModelCatalogCache?.clear();
  process.env.CF_ACCOUNT_ID = "acc";
  process.env.CF_WORKERS_AI_TOKEN = "cf-token";
  process.env.CF_AI_GATEWAY_NAME = "gw";
  process.env.CF_AI_GATEWAY_TOKEN = "gw-token";
  process.env.CF_AI_GATEWAY_MODELS = "openai/gpt-5?byokAlias=secret-alias";

  globalThis.fetch = mock(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    const task = url.searchParams.get("task") ?? "Text Generation";
    return Response.json({
      success: true,
      result:
        task === "Text Generation"
          ? [
              {
                id: "@cf/zai-org/glm-4.7-flash",
                source: 1,
                name: "@cf/zai-org/glm-4.7-flash",
                description: "Chat",
                task: { id: "tg", name: "Text Generation", description: "" },
                tags: [],
                properties: [],
              },
            ]
          : [],
      result_info: { page: 1, per_page: 100, count: 1, total_count: 1 },
    });
  }) as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  (globalThis as { caches?: unknown }).caches = originalCaches;
  catalogCache.cloudflareModelCatalogCache?.clear();
  for (const key of ENV_KEYS) {
    const original = savedEnv[key];
    if (original === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = original;
    }
  }
});

test("GET /api/models returns public catalog, capabilities, and cache headers without byokAlias", async () => {
  const response = await getModels(new Request("https://example.com/api/models"));

  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe(
    "public, s-maxage=3600, stale-while-revalidate=86400",
  );

  const body = (await response.json()) as ModelCatalogResponse;
  expect(body.capabilities).toEqual({
    documents: true,
    webFetch: true,
    browserRender: false,
    knowledgeBase: false,
  });
  const external = body.models.find((model) => model.id === "openai/gpt-5");
  expect(external).toBeDefined();
  expect(external).not.toHaveProperty("byokAlias");
});

test("GET /api/models reads and writes Workers caches.default when available", async () => {
  const store = new Map<string, Response>();
  const mockCache = {
    match: mock(async (req: Request) => store.get(req.url)?.clone()),
    put: mock(async (req: Request, res: Response) => {
      store.set(req.url, res);
    }),
  };
  (globalThis as { caches?: unknown }).caches = { default: mockCache };

  const first = await getModels(new Request("https://example.com/api/models?ignore=1"));
  expect(first.status).toBe(200);
  await new Promise((resolve) => setTimeout(resolve, 10));
  expect(mockCache.put).toHaveBeenCalledTimes(1);

  const second = await getModels(new Request("https://example.com/api/models?ignore=2"));
  expect(second.status).toBe(200);
  expect(mockCache.match).toHaveBeenCalledTimes(2);
});
