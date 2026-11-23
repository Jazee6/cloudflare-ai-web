import { afterEach, expect, test } from "bun:test";
import {
  createPersonalImageRequest,
  extractPersonalImage,
  getPersonalGatewayHeaders,
  mapPersonalFailure,
  resolvePersonalGateway,
} from "@/lib/personal-gateway";
import type { PersonalRequest } from "@/lib/personal-providers";

const ENV_KEYS = ["CF_ACCOUNT_ID", "CF_AI_GATEWAY_NAME", "CF_AI_GATEWAY_TOKEN"] as const;
const savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = savedEnv[key];
    }
  }
});

const configureDeploymentGateway = () => {
  process.env.CF_ACCOUNT_ID = "acc";
  process.env.CF_AI_GATEWAY_NAME = "gw";
  process.env.CF_AI_GATEWAY_TOKEN = "deploy-token";
};

const OWN_GATEWAY = { accountId: "a".repeat(32), gatewayId: "mine" };

test("the deployment's gateway requires the visitor's own provider key (D8)", () => {
  configureDeploymentGateway();
  const missing = resolvePersonalGateway({ provider: "openai" }, "gpt-5");
  expect(missing).toMatchObject({ ok: false, status: 400 });

  const resolved = resolvePersonalGateway({ provider: "openai", apiKey: "sk-visitor" }, "gpt-5");
  expect(resolved).toEqual({
    ok: true,
    gateway: {
      baseUrl: "https://gateway.ai.cloudflare.com/v1/acc/gw",
      gatewayToken: "deploy-token",
      apiKey: "sk-visitor",
      own: false,
    },
  });
});

test("the deployment's gateway refuses Dynamic Routes, which could reach its BYOK keys", () => {
  configureDeploymentGateway();
  for (const modelId of ["dynamic/smart", "DYNAMIC/smart"]) {
    expect(
      resolvePersonalGateway({ provider: "openai", apiKey: "sk-visitor" }, modelId),
    ).toMatchObject({ ok: false, status: 400 });
  }
});

test("without a deployment gateway, only the visitor's own gateway works", () => {
  delete process.env.CF_ACCOUNT_ID;
  process.env.CF_AI_GATEWAY_NAME = "gw";
  process.env.CF_AI_GATEWAY_TOKEN = "deploy-token";
  expect(resolvePersonalGateway({ provider: "openai", apiKey: "sk-visitor" })).toMatchObject({
    ok: false,
    status: 400,
  });

  const own = resolvePersonalGateway({ provider: "openai", gateway: OWN_GATEWAY }, "dynamic/smart");
  expect(own).toEqual({
    ok: true,
    gateway: { baseUrl: `https://gateway.ai.cloudflare.com/v1/${"a".repeat(32)}/mine`, own: true },
  });
});

test("gateway headers carry auth only when a token exists and never the provider key", () => {
  const withoutToken = getPersonalGatewayHeaders({
    baseUrl: "https://example.com",
    apiKey: "sk-visitor",
    own: true,
  });
  expect(withoutToken["cf-aig-authorization"]).toBeUndefined();
  expect(JSON.stringify(withoutToken)).not.toContain("sk-visitor");

  const withToken = getPersonalGatewayHeaders(
    { baseUrl: "https://example.com", gatewayToken: "tok", own: false },
    { retry: true },
  );
  expect(withToken["cf-aig-authorization"]).toBe("Bearer tok");
  expect(withToken["cf-aig-skip-cache"]).toBe("true");
});

const imageRequest = (imageProtocol: "openai-images" | "gemini"): PersonalRequest => ({
  provider: imageProtocol === "gemini" ? "google-ai-studio" : "openai",
  declaration: {
    modelId: imageProtocol === "gemini" ? "gemini-2.5-flash-image" : "gpt-image-1",
    type: "Text to Image",
    imageProtocol,
  },
});

test("OpenAI image requests use generations, or edits with Reference Images", async () => {
  const gateway = { baseUrl: "https://gw", apiKey: "sk-visitor", own: true };
  const generation = await createPersonalImageRequest({
    gateway,
    request: imageRequest("openai-images"),
    prompt: "a cat",
    params: { aspectRatio: "3:2" },
    referenceImages: [],
    skipCache: false,
  });
  expect(generation.url).toBe("https://gw/openai/images/generations");
  expect(JSON.parse(String(generation.init.body))).toEqual({
    model: "gpt-image-1",
    prompt: "a cat",
    n: 1,
    size: "1536x1024",
  });
  expect((generation.init.headers as Record<string, string>).Authorization).toBe(
    "Bearer sk-visitor",
  );

  const edit = await createPersonalImageRequest({
    gateway,
    request: imageRequest("openai-images"),
    prompt: "a cat",
    params: {},
    referenceImages: [{ blob: new Blob([new Uint8Array([1])], { type: "image/png" }) }],
    skipCache: false,
  });
  expect(edit.url).toBe("https://gw/openai/images/edits");
  expect((edit.init.body as FormData).getAll("image[]")).toHaveLength(1);
});

test("Gemini image requests send inline Reference Images and the aspect ratio", async () => {
  const request = await createPersonalImageRequest({
    gateway: { baseUrl: "https://gw", own: true },
    request: imageRequest("gemini"),
    prompt: "a cat",
    params: { aspectRatio: "16:9" },
    referenceImages: [{ blob: new Blob([new Uint8Array([1, 2])], { type: "image/png" }) }],
    skipCache: false,
  });
  expect(request.url).toBe(
    "https://gw/google-ai-studio/v1beta/models/gemini-2.5-flash-image:generateContent",
  );
  const headers = request.init.headers as Record<string, string>;
  expect(headers["x-goog-api-key"]).toBeUndefined();
  const body = JSON.parse(String(request.init.body));
  expect(body.contents[0].parts).toEqual([
    { inline_data: { mime_type: "image/png", data: "AQI=" } },
    { text: "a cat" },
  ]);
  expect(body.generationConfig.imageConfig).toEqual({ aspectRatio: "16:9" });
});

test("image responses are read from b64_json or inline data, never from URLs", () => {
  expect(extractPersonalImage("openai-images", { data: [{ b64_json: "AQI=" }] })).toEqual({
    base64: "AQI=",
  });
  expect(extractPersonalImage("openai-images", { data: [{ url: "https://x/y.png" }] })).toBeNull();
  expect(
    extractPersonalImage("gemini", {
      candidates: [
        {
          content: {
            parts: [{ text: "here" }, { inlineData: { mimeType: "image/png", data: "AQI=" } }],
          },
        },
      ],
    }),
  ).toEqual({ base64: "AQI=", mediaType: "image/png" });
});

test("credential rejections are client errors without upstream details", () => {
  expect(mapPersonalFailure({ own: false }, 401, "Incorrect API key sk-visitor")).toEqual({
    status: 400,
    code: "personalCredentialsRejected",
    message:
      "The Personal Provider rejected its credentials. Check the API key and gateway settings.",
  });
  expect(mapPersonalFailure({ own: true }, 400, '{"error":[{"code":2001}]}').status).toBe(400);
  // A DLP block on the visitor's own gateway is a policy block, not a credential problem.
  expect(
    mapPersonalFailure({ own: true }, 403, "", new Headers({ "cf-aig-dlp": '{"action":"block"}' }))
      .status,
  ).toBe(422);
  expect(mapPersonalFailure({ own: true }, 400, '{"error":[{"code":2016}]}').status).toBe(422);
  expect(mapPersonalFailure({ own: false }, 400, '{"error":[{"code":2001}]}').status).toBe(502);
});
