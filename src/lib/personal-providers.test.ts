import { expect, test } from "bun:test";
import * as v from "valibot";
import {
  getGatewayModelName,
  getPersonalCatalogModels,
  getPersonalRequest,
  parsePersonalProviders,
  type PersonalProvider,
  personalProviderSchema,
  personalRequestSchema,
} from "@/lib/personal-providers";

const provider: PersonalProvider = {
  id: "p1",
  label: "Work",
  provider: "openai",
  apiKey: "sk-visitor",
  models: [
    { modelId: "gpt-5", type: "Text Generation", input: ["image"], reasoning: true },
    { modelId: "gpt-image-1", type: "Text to Image", imageProtocol: "openai-images" },
  ],
};

test("Personal Models join the catalog under namespaced IDs", () => {
  const models = getPersonalCatalogModels([provider]);
  expect(models.map((model) => model.id)).toEqual(["personal:p1:gpt-5", "personal:p1:gpt-image-1"]);
  expect(models[0]).toMatchObject({
    source: "personal",
    provider: "ai-gateway",
    brand: "OpenAI",
    personalProviderId: "p1",
    personalProviderLabel: "Work",
    input: ["image"],
    reasoning: true,
  });
  expect(models[1]).toMatchObject({ type: "Text to Image", imageProtocol: "openai-images" });
});

test("requests carry the provider's credentials and the model's declaration", () => {
  const [model] = getPersonalCatalogModels([provider]);
  expect(getPersonalRequest(model!, [provider])).toEqual({
    provider: "openai",
    declaration: provider.models[0]!,
    apiKey: "sk-visitor",
  });
  expect(getPersonalRequest(model!, [])).toBeUndefined();
});

test("Dynamic Routes keep their own name at the gateway", () => {
  expect(getGatewayModelName("openai", "gpt-5")).toBe("openai/gpt-5");
  expect(getGatewayModelName("openai", "dynamic/smart")).toBe("dynamic/smart");
});

test("declarations must fit the provider and model IDs cannot climb out of URL paths", () => {
  const request = (modelId: string, extra: object = {}) => ({
    provider: "openai",
    declaration: { modelId, type: "Text Generation", ...extra },
  });
  expect(v.is(personalRequestSchema, request("gpt-5"))).toBe(true);
  for (const modelId of ["../workers-ai/x", "a/../b", "/x", "x/", "a//b", "a b"]) {
    expect(v.is(personalRequestSchema, request(modelId))).toBe(false);
  }
  // Search grounding is only available through Google AI Studio.
  expect(v.is(personalRequestSchema, request("gpt-5", { input: ["search"] }))).toBe(false);
  // Image models need the provider's image protocol.
  expect(
    v.is(personalRequestSchema, {
      provider: "anthropic",
      declaration: { modelId: "x", type: "Text to Image", imageProtocol: "openai-images" },
    }),
  ).toBe(false);
  // Providers that bill the gateway owner are not allowed.
  expect(v.is(personalRequestSchema, { ...request("x"), provider: "workers-ai" })).toBe(false);
});

test("gateway fields are validated strictly and blank keys mean none", () => {
  const parsed = v.safeParse(personalProviderSchema, {
    ...provider,
    apiKey: "  ",
    gateway: { accountId: "A".repeat(32), gatewayId: "mine", token: "" },
  });
  expect(parsed.success).toBe(true);
  expect(parsed.output).toMatchObject({
    apiKey: undefined,
    gateway: { accountId: "a".repeat(32), gatewayId: "mine", token: undefined },
  });
  for (const gateway of [
    { accountId: "abc", gatewayId: "mine" },
    { accountId: "a".repeat(32), gatewayId: "../other" },
    { accountId: "a".repeat(32), gatewayId: "Mine" },
  ]) {
    expect(v.is(personalProviderSchema, { ...provider, gateway })).toBe(false);
  }
});

test("stored providers survive a damaged entry", () => {
  const raw = JSON.stringify([provider, { id: "broken" }]);
  expect(parsePersonalProviders(raw).map((item) => item.id)).toEqual(["p1"]);
  expect(parsePersonalProviders("not json")).toEqual([]);
});
