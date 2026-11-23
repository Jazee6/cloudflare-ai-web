import { expect, test } from "bun:test";
import { EMPTY_MODEL_LAYOUT } from "@/lib/model-layout";
import type { Model } from "@/lib/models";
import {
  legacyCookiesToPreferences,
  parseCookieString,
  parsePreferences,
  pickSelectedModel,
} from "@/lib/preferences";

test("parses cookie strings and decodes values", () => {
  expect(parseCookieString("CF_AI_MODEL=%40cf%2Fmeta%2Fllama; other=1; broken")).toEqual({
    CF_AI_MODEL: "@cf/meta/llama",
    other: "1",
  });
});

test("maps legacy 5.x cookies to preferences", () => {
  expect(
    legacyCookiesToPreferences({
      CF_AI_MODEL: "@cf/a",
      CF_AI_MODEL_IMAGE: "@cf/img",
      CF_AI_SEARCH_ENABLED: "true",
      CF_AI_KNOWLEDGE_BASE: "  kb-1 ",
    }),
  ).toEqual({
    modelId: "@cf/a",
    searchEnabled: true,
    knowledgeBase: "kb-1",
  });
  expect(
    legacyCookiesToPreferences({ CF_AI_SEARCH_ENABLED: "false", CF_AI_KNOWLEDGE_BASE: " " }),
  ).toEqual({ searchEnabled: false });
  expect(legacyCookiesToPreferences({ CF_AI_MODEL_IMAGE: "@cf/img" })).toEqual({
    modelId: "@cf/img",
  });
});

test("rejects malformed stored preferences", () => {
  expect(parsePreferences(null)).toBeNull();
  expect(parsePreferences("{")).toBeNull();
  expect(parsePreferences('{"searchEnabled":"yes"}')).toBeNull();
  expect(parsePreferences('{"modelId":"@cf/a"}')).toEqual({ modelId: "@cf/a" });
});

const model = (id: string, type: Model["type"]): Model =>
  ({ id, name: id, brand: "Test", type, provider: "workers-ai", source: "cloudflare" }) as Model;

test("pickSelectedModel keeps the selection or falls back to the first chat model", () => {
  const models = [model("img", "Text to Image"), model("chat-a", "Text Generation")];
  expect(pickSelectedModel(models, "img")?.id).toBe("img");
  expect(pickSelectedModel(models, "missing")?.id).toBe("chat-a");
  expect(pickSelectedModel(models, undefined)?.id).toBe("chat-a");
  expect(pickSelectedModel([models[0]], undefined)?.id).toBe("img");
  expect(pickSelectedModel([], "img")).toBeUndefined();
});

test("pickSelectedModel skips hidden models and falls back within the same type", () => {
  const models = [
    model("chat-a", "Text Generation"),
    model("img-a", "Text to Image"),
    model("img-b", "Text to Image"),
  ];
  const layout = { ...EMPTY_MODEL_LAYOUT, hidden: ["img-a"] };
  expect(pickSelectedModel(models, "img-a", layout)?.id).toBe("img-b");
  expect(pickSelectedModel(models, "img-a", { ...layout, hidden: ["img-a", "img-b"] })?.id).toBe(
    "chat-a",
  );
  expect(
    pickSelectedModel(models, "chat-a", { ...EMPTY_MODEL_LAYOUT, hidden: ["chat-a"] })?.id,
  ).toBe("img-a");
  expect(
    pickSelectedModel(models, "missing", { ...EMPTY_MODEL_LAYOUT, hidden: ["chat-a"] })?.id,
  ).toBe("img-a");
  expect(
    pickSelectedModel(models, undefined, {
      ...EMPTY_MODEL_LAYOUT,
      hidden: models.map((m) => m.id),
    }),
  ).toBeUndefined();
});
