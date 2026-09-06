import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import { POST as postImage } from "@/app/api/image/route";

type CapturedRequest = { url: string; body: unknown };

const catalogCache = globalThis as typeof globalThis & {
  cloudflareModelCatalogCache?: Map<string, unknown>;
};

const installFetchMock = (payload: unknown) => {
  const requests: CapturedRequest[] = [];
  globalThis.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    requests.push({ url: url.toString(), body: init?.body });

    if (url.pathname.endsWith("/ai/models/search")) {
      return Response.json({
        success: true,
        result: ["@cf/black-forest-labs/flux-2-klein-4b", "@cf/black-forest-labs/flux-1-schnell"].map(
          (name) => ({
            id: name,
            source: 1,
            name,
            description: "Test model",
            task: { id: "t2i", name: "Text-to-Image", description: "" },
            tags: [],
            properties: [],
          }),
        ),
        result_info: { page: 1, per_page: 100, count: 2, total_count: 2 },
      });
    }

    return Response.json(payload);
  }) as unknown as typeof fetch;
  return requests;
};

const imageRequest = (model: string) =>
  new Request("https://example.com/api/image", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt: "a red apple", model }),
  });

beforeEach(() => {
  catalogCache.cloudflareModelCatalogCache?.clear();
  process.env.CF_ACCOUNT_ID = "test-account";
  process.env.CF_WORKERS_AI_TOKEN = "test-token";
});

afterEach(() => {
  delete process.env.CF_ACCOUNT_ID;
  delete process.env.CF_WORKERS_AI_TOKEN;
  catalogCache.cloudflareModelCatalogCache?.clear();
});

test("flux-2 models are requested with multipart form data", async () => {
  const requests = installFetchMock({ result: { image: "aGVsbG8=" } });

  const response = await postImage(imageRequest("@cf/black-forest-labs/flux-2-klein-4b"));

  expect(response.status).toBe(200);
  const runRequest = requests.find((request) => request.url.includes("/ai/run/"));
  if (!runRequest) {
    throw new Error("expected a model run request");
  }
  expect(runRequest.body).toBeInstanceOf(FormData);
  expect((runRequest.body as FormData).get("prompt")).toBe("a red apple");
});

test("other image models are requested with a JSON body", async () => {
  const requests = installFetchMock({ result: { image: "aGVsbG8=" } });

  const response = await postImage(imageRequest("@cf/black-forest-labs/flux-1-schnell"));

  expect(response.status).toBe(200);
  const runRequest = requests.find((request) => request.url.includes("/ai/run/"));
  if (!runRequest) {
    throw new Error("expected a model run request");
  }
  expect(runRequest.body).toBe(JSON.stringify({ prompt: "a red apple" }));
});
