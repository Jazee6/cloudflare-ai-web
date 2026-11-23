import { afterEach, beforeEach, expect, mock, spyOn, test } from "bun:test";
import { POST as postChat } from "@/server/api/chat";
import { POST as postImage } from "@/server/api/image";
import { POST as postPersonalModels } from "@/server/api/personal-models";

const ENV_KEYS = [
  "CF_ACCOUNT_ID",
  "CF_WORKERS_AI_TOKEN",
  "CF_AI_GATEWAY_NAME",
  "CF_AI_GATEWAY_TOKEN",
  "CF_AI_GATEWAY_MODELS",
] as const;
const savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
const originalFetch = globalThis.fetch;

beforeEach(() => {
  // Zero-configuration deployment: no Workers AI and no deployment gateway.
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = savedEnv[key];
    }
  }
});

const API_KEY = "sk-visitor-secret";
const GATEWAY_TOKEN = "own-gateway-secret";
const OWN_GATEWAY = { accountId: "a".repeat(32), gatewayId: "mine", token: GATEWAY_TOKEN };

type Captured = { url: string; headers: Headers; body: unknown };

const mockUpstream = (respond: (url: string) => Response) => {
  const captured: Captured[] = [];
  globalThis.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    captured.push({ url, headers: new Headers(init?.headers), body: init?.body });
    return respond(url);
  }) as unknown as typeof fetch;
  return captured;
};

const chatRequest = (personal: unknown) =>
  new Request("https://example.com/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: "personal:p1:gpt-5",
      provider: "ai-gateway",
      messages: [{ id: "u1", role: "user", parts: [{ type: "text", text: "hi" }] }],
      personal,
    }),
  });

const sse = (content: string) =>
  new Response(
    `data: ${JSON.stringify({
      id: "1",
      object: "chat.completion.chunk",
      created: 1,
      model: "openai/gpt-5",
      choices: [{ index: 0, delta: { role: "assistant", content }, finish_reason: "stop" }],
    })}\n\ndata: [DONE]\n\n`,
    { headers: { "content-type": "text/event-stream" } },
  );

test("Personal chat through the deployment's gateway requires the visitor's key (D8)", async () => {
  process.env.CF_ACCOUNT_ID = "acc";
  process.env.CF_AI_GATEWAY_NAME = "gw";
  process.env.CF_AI_GATEWAY_TOKEN = "deploy-token";
  const captured = mockUpstream(() => sse("never"));

  const response = await postChat(
    chatRequest({ provider: "openai", declaration: { modelId: "gpt-5", type: "Text Generation" } }),
  );
  expect(response.status).toBe(400);
  expect(captured).toHaveLength(0);
});

test("Personal chat streams through the visitor's own gateway in a zero-config deployment", async () => {
  const captured = mockUpstream(() => sse("Hello"));

  const response = await postChat(
    chatRequest({
      provider: "openai",
      apiKey: API_KEY,
      gateway: OWN_GATEWAY,
      declaration: { modelId: "gpt-5", name: "GPT-5", type: "Text Generation" },
    }),
  );
  expect(response.status).toBe(200);
  const text = await response.text();
  expect(text).toContain("Hello");
  expect(text).toContain('"modelName":"GPT-5"');

  expect(captured).toHaveLength(1);
  const [request] = captured;
  expect(request!.url).toBe(
    `https://gateway.ai.cloudflare.com/v1/${"a".repeat(32)}/mine/compat/chat/completions`,
  );
  expect(request!.headers.get("authorization")).toBe(`Bearer ${API_KEY}`);
  expect(request!.headers.get("cf-aig-authorization")).toBe(`Bearer ${GATEWAY_TOKEN}`);
  expect(JSON.parse(String(request!.body)).model).toBe("openai/gpt-5");
  // Credentials never reach the gateway's request metadata.
  expect(request!.headers.get("cf-aig-metadata") ?? "").not.toContain(API_KEY);
});

test("Personal chat without a key sends no Authorization header to the visitor's gateway", async () => {
  const captured = mockUpstream(() => sse("Hi"));
  const response = await postChat(
    chatRequest({
      provider: "openai",
      gateway: { accountId: "a".repeat(32), gatewayId: "mine" },
      declaration: { modelId: "dynamic/smart", type: "Text Generation" },
    }),
  );
  expect(response.status).toBe(200);
  await response.text();
  expect(captured[0]!.headers.get("authorization")).toBeNull();
  expect(captured[0]!.headers.get("cf-aig-authorization")).toBeNull();
  expect(JSON.parse(String(captured[0]!.body)).model).toBe("dynamic/smart");
});

test("rejected Personal credentials never appear in logs or responses", async () => {
  const errorSpy = spyOn(console, "error").mockImplementation(() => {});
  try {
    mockUpstream(
      () =>
        new Response(JSON.stringify({ error: { message: `Incorrect API key: ${API_KEY}` } }), {
          status: 401,
          headers: { "content-type": "application/json" },
        }),
    );
    const response = await postChat(
      chatRequest({
        provider: "openai",
        apiKey: API_KEY,
        gateway: OWN_GATEWAY,
        declaration: { modelId: "gpt-5", type: "Text Generation" },
      }),
    );
    const text = await response.text();
    expect(text).toContain("rejected its credentials");
    expect(text).not.toContain(API_KEY);
    expect(text).not.toContain(GATEWAY_TOKEN);

    const imageResponse = await postImage(
      new Request("https://example.com/api/image", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: "a cat",
          model: "personal:p1:gpt-image-1",
          personal: {
            provider: "openai",
            apiKey: API_KEY,
            gateway: OWN_GATEWAY,
            declaration: {
              modelId: "gpt-image-1",
              type: "Text to Image",
              imageProtocol: "openai-images",
            },
          },
        }),
      }),
    );
    expect(imageResponse.status).toBe(400);
    expect(await imageResponse.text()).not.toContain(API_KEY);

    const logged = errorSpy.mock.calls.map((call) => call.map(String).join(" ")).join("\n");
    expect(logged).not.toContain(API_KEY);
    expect(logged).not.toContain(GATEWAY_TOKEN);
  } finally {
    errorSpy.mockRestore();
  }
});

const PNG_BASE64 = btoa(String.fromCharCode(0x89, 0x50, 0x4e, 0x47));

test("Personal image generation works in a zero-config deployment, with JSON or multipart", async () => {
  const captured = mockUpstream(() => Response.json({ data: [{ b64_json: PNG_BASE64 }] }));
  const personal = {
    provider: "openai",
    apiKey: API_KEY,
    gateway: OWN_GATEWAY,
    declaration: { modelId: "gpt-image-1", type: "Text to Image", imageProtocol: "openai-images" },
  };

  const json = await postImage(
    new Request("https://example.com/api/image", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prompt: "a cat",
        model: "personal:p1:gpt-image-1",
        params: { aspectRatio: "1:1", steps: 20 },
        personal,
      }),
    }),
  );
  expect(json.status).toBe(200);
  expect(json.headers.get("content-type")).toBe("image/png");
  expect(captured[0]!.url).toContain("/mine/openai/images/generations");
  expect(JSON.parse(String(captured[0]!.body))).toMatchObject({ size: "1024x1024" });

  const form = new FormData();
  form.append("prompt", "a cat");
  form.append("model", "personal:p1:gpt-image-1");
  form.append("personal", JSON.stringify(personal));
  form.append(
    "referenceImages",
    new File([new Uint8Array([1, 2, 3])], "ref.png", { type: "image/png" }),
  );
  const multipart = await postImage(
    new Request("https://example.com/api/image", { method: "POST", body: form }),
  );
  expect(multipart.status).toBe(200);
  expect(captured[1]!.url).toContain("/mine/openai/images/edits");

  const invalid = new FormData();
  invalid.append("prompt", "a cat");
  invalid.append("model", "personal:p1:gpt-image-1");
  invalid.append("personal", JSON.stringify({ ...personal, provider: "workers-ai" }));
  const rejected = await postImage(
    new Request("https://example.com/api/image", { method: "POST", body: invalid }),
  );
  expect(rejected.status).toBe(400);
});

test("Personal model listing is never cached and reports unsupported providers", async () => {
  const captured = mockUpstream(() =>
    Response.json({ data: [{ id: "gpt-5" }, { id: "gpt-5-mini" }] }),
  );
  const listRequest = (body: unknown) =>
    new Request("https://example.com/api/personal-models", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  const listed = await postPersonalModels(
    listRequest({ provider: "openai", apiKey: API_KEY, gateway: OWN_GATEWAY }),
  );
  expect(listed.status).toBe(200);
  expect(listed.headers.get("cache-control")).toBe("no-store");
  expect(await listed.json()).toEqual({
    supported: true,
    models: [{ modelId: "gpt-5" }, { modelId: "gpt-5-mini" }],
  });
  expect(captured[0]!.url).toBe(
    `https://gateway.ai.cloudflare.com/v1/${"a".repeat(32)}/mine/openai/models`,
  );

  const unsupported = await postPersonalModels(
    listRequest({ provider: "anthropic", apiKey: API_KEY, gateway: OWN_GATEWAY }),
  );
  expect(await unsupported.json()).toEqual({ supported: false, models: [] });

  // No deployment gateway and no own gateway: nothing to route through.
  const noGateway = await postPersonalModels(listRequest({ provider: "openai", apiKey: API_KEY }));
  expect(noGateway.status).toBe(400);
});
