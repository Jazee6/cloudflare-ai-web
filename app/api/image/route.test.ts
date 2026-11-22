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
        result: [
          "@cf/black-forest-labs/flux-2-klein-4b",
          "@cf/black-forest-labs/flux-1-schnell",
          "@cf/leonardo/phoenix-1.0",
        ].map((name) => ({
          id: name,
          source: 1,
          name,
          description: "Test model",
          task: { id: "t2i", name: "Text-to-Image", description: "" },
          tags: [],
          properties: [],
        })),
        result_info: { page: 1, per_page: 100, count: 3, total_count: 3 },
      });
    }

    return Response.json(payload);
  }) as unknown as typeof fetch;
  return requests;
};

const imageRequest = (model: string, params?: Record<string, unknown>) =>
  new Request("https://example.com/api/image", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt: "a red apple", model, ...(params ? { params } : {}) }),
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

test("flux-2 models are requested with multipart form data and reference images", async () => {
  const requests = installFetchMock({ result: { image: "aGVsbG8=" } });

  const form = new FormData();
  form.append("prompt", "a red apple");
  form.append("model", "@cf/black-forest-labs/flux-2-klein-4b");
  form.append("params", JSON.stringify({ width: 1024, height: 1024, steps: 99, seed: 42 }));
  form.append(
    "referenceImages",
    new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }),
    "ref.jpg",
  );

  const response = await postImage(
    new Request("https://example.com/api/image", {
      method: "POST",
      body: form,
    }),
  );

  expect(response.status).toBe(200);
  const runRequest = requests.find((request) => request.url.includes("/ai/run/"));
  if (!runRequest) {
    throw new Error("expected a model run request");
  }
  expect(runRequest.body).toBeInstanceOf(FormData);
  const upstreamForm = runRequest.body as FormData;
  expect(upstreamForm.get("prompt")).toBe("a red apple");
  expect(upstreamForm.get("width")).toBe("1024");
  expect(upstreamForm.get("seed")).toBe("42");
  expect(upstreamForm.get("steps")).toBeNull();
  expect(upstreamForm.get("input_image_0")).toBeInstanceOf(Blob);
});

test("reference images are rejected for models that do not support them", async () => {
  installFetchMock({ result: { image: "aGVsbG8=" } });

  const form = new FormData();
  form.append("prompt", "a red apple");
  form.append("model", "@cf/black-forest-labs/flux-1-schnell");
  form.append(
    "referenceImages",
    new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }),
    "ref.jpg",
  );

  const response = await postImage(
    new Request("https://example.com/api/image", {
      method: "POST",
      body: form,
    }),
  );

  expect(response.status).toBe(400);
});

test("other image models are requested with a JSON body and reject out-of-range params", async () => {
  const requests = installFetchMock({ result: { image: "aGVsbG8=" } });

  const response = await postImage(
    imageRequest("@cf/black-forest-labs/flux-1-schnell", { steps: 4, seed: 12 }),
  );

  expect(response.status).toBe(200);
  const runRequest = requests.find((request) => request.url.includes("/ai/run/"));
  if (!runRequest) {
    throw new Error("expected a model run request");
  }
  expect(runRequest.body).toBe(JSON.stringify({ prompt: "a red apple", steps: 4 }));

  const badResponse = await postImage(
    imageRequest("@cf/black-forest-labs/flux-1-schnell", { steps: 30 }),
  );
  expect(badResponse.status).toBe(400);
});
