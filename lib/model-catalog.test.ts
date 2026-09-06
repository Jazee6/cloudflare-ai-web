// @ts-nocheck
import { expect, mock, test } from "bun:test";
import { getModelCatalog } from "@/lib/model-catalog";

test("loads catalog models with structured property values", async () => {
  const originalFetch = globalThis.fetch;
  const originalAccountId = process.env.CF_ACCOUNT_ID;
  const originalToken = process.env.CF_WORKERS_AI_TOKEN;

  process.env.CF_ACCOUNT_ID = "test-account";
  process.env.CF_WORKERS_AI_TOKEN = "test-token";
  globalThis.fetch = mock(async (input) => {
    const url = new URL(String(input));
    const task = url.searchParams.get("task") ?? "Text Generation";
    const name =
      task === "Text Generation" ? "@cf/test/chat" : "@cf/test/image";

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
          ],
        },
      ],
      result_info: {
        page: 1,
        per_page: 100,
        count: 1,
        total_count: 1,
      },
    });
  }) as typeof fetch;

  try {
    const catalog = await getModelCatalog();
    expect(catalog.find((model) => model.id === "@cf/test/chat")).toMatchObject(
      {
        reasoning: true,
        type: "Text Generation",
      },
    );
    expect(
      catalog.find((model) => model.id === "@cf/test/image"),
    ).toMatchObject({ type: "Text to Image" });
  } finally {
    globalThis.fetch = originalFetch;
    process.env.CF_ACCOUNT_ID = originalAccountId;
    process.env.CF_WORKERS_AI_TOKEN = originalToken;
  }
});
