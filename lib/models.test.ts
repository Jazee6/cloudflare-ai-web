import { afterEach, expect, test } from "bun:test";
import { getExternalModels, parseGatewayModels, toPublicModel } from "@/lib/models";

const ENV_KEYS = [
  "CF_AI_GATEWAY_MODELS",
  "CF_ACCOUNT_ID",
  "CF_AI_GATEWAY_NAME",
  "CF_AI_GATEWAY_TOKEN",
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

test("parseGatewayModels parses simple entries and Gateway Routes", () => {
  const models = parseGatewayModels(
    "openai/gpt-5, anthropic/claude-sonnet-4-5 , dynamic/smart-chat",
  );

  expect(models).toEqual([
    {
      id: "openai/gpt-5",
      name: "gpt-5",
      brand: "OpenAI",
      type: "Text Generation",
      provider: "ai-gateway",
      source: "external",
    },
    {
      id: "anthropic/claude-sonnet-4-5",
      name: "claude-sonnet-4-5",
      brand: "Anthropic",
      type: "Text Generation",
      provider: "ai-gateway",
      source: "external",
    },
    {
      id: "dynamic/smart-chat",
      name: "smart-chat",
      brand: "AI Gateway",
      type: "Text Generation",
      provider: "ai-gateway",
      source: "external",
      isGatewayRoute: true,
    },
  ]);
});

test("parseGatewayModels handles commas inside input query parameters", () => {
  const models = parseGatewayModels(
    "google-ai-studio/gemini-4-hydrogen?name=Gemini+4+Hydrogen&input=image,search&contextWindow=1048576,openai/gpt-5?input=image&reasoning=true&contextWindow=400000&byokAlias=team-key,dynamic/free-fallback?name=Smart+Fallback",
  );

  expect(models).toEqual([
    {
      id: "google-ai-studio/gemini-4-hydrogen",
      name: "Gemini 4 Hydrogen",
      brand: "Google",
      type: "Text Generation",
      provider: "ai-gateway",
      source: "external",
      input: ["image", "search"],
      contextWindow: 1_048_576,
    },
    {
      id: "openai/gpt-5",
      name: "gpt-5",
      brand: "OpenAI",
      type: "Text Generation",
      provider: "ai-gateway",
      source: "external",
      input: ["image"],
      reasoning: true,
      contextWindow: 400_000,
      byokAlias: "team-key",
    },
    {
      id: "dynamic/free-fallback",
      name: "Smart Fallback",
      brand: "AI Gateway",
      type: "Text Generation",
      provider: "ai-gateway",
      source: "external",
      isGatewayRoute: true,
    },
  ]);
});

test("parseGatewayModels skips invalid and duplicate entries without failing", () => {
  const models = parseGatewayModels(
    "invalid-without-slash,openai/gpt-5?input=audio,openai/gpt-5?contextWindow=0,openai/valid?reasoning=false,openai/valid?name=Dup",
  );

  expect(models).toEqual([
    {
      id: "openai/valid",
      name: "valid",
      brand: "OpenAI",
      type: "Text Generation",
      provider: "ai-gateway",
      source: "external",
    },
  ]);
});

test("toPublicModel strips server-only byokAlias", () => {
  const [model] = parseGatewayModels("openai/gpt-5?byokAlias=secret-alias");
  expect(model.byokAlias).toBe("secret-alias");
  expect(toPublicModel(model)).not.toHaveProperty("byokAlias");
});

test("getExternalModels requires complete gateway credentials", () => {
  process.env.CF_AI_GATEWAY_MODELS = "openai/gpt-5";
  process.env.CF_ACCOUNT_ID = "acc";
  process.env.CF_AI_GATEWAY_NAME = "gw";
  delete process.env.CF_AI_GATEWAY_TOKEN;

  expect(getExternalModels()).toEqual([]);

  process.env.CF_AI_GATEWAY_TOKEN = "token";
  expect(getExternalModels().map((model) => model.id)).toEqual(["openai/gpt-5"]);
});
