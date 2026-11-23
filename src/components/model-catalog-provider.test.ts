import { expect, test } from "bun:test";
import * as v from "valibot";
import { catalogResponseSchema } from "@/components/model-catalog-provider";

test("the client catalog keeps each model's price", () => {
  const model = {
    id: "@cf/zai-org/glm-4.7-flash",
    name: "glm-4.7-flash",
    brand: "zai-org",
    type: "Text Generation",
    provider: "workers-ai",
    source: "cloudflare",
    contextWindow: 131072,
    price: { input: 0.0605, output: 0.4 },
  } as const;
  const parsed = v.parse(catalogResponseSchema, {
    models: [model],
    capabilities: { documents: true, webFetch: true, browserRender: false, knowledgeBase: false },
  });
  expect(parsed.models[0]).toEqual(model);
});
