import { afterEach, expect, test } from "bun:test";
import { GET } from "@/server/api/ai-search-instances";

const ENV_KEYS = ["CF_ACCOUNT_ID", "CF_AI_SEARCH_TOKEN", "CF_AI_SEARCH_INSTANCES"] as const;
const saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = saved[key];
    }
  }
});

test("GET /api/ai-search/instances returns allowlisted instances only when configured", async () => {
  process.env.CF_ACCOUNT_ID = "acc";
  process.env.CF_AI_SEARCH_TOKEN = "tok";
  process.env.CF_AI_SEARCH_INSTANCES = "docs:Product Docs,handbook";

  const response = await GET();
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(await response.json()).toEqual({
    instances: [
      { id: "docs", name: "Product Docs" },
      { id: "handbook", name: "handbook" },
    ],
  });
});
