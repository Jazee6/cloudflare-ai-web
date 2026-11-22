import { expect, test } from "bun:test";
import { legacyCookiesToPreferences, parseCookieString, parsePreferences } from "@/lib/preferences";

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
    imageModelId: "@cf/img",
    searchEnabled: true,
    knowledgeBase: "kb-1",
  });
  expect(
    legacyCookiesToPreferences({ CF_AI_SEARCH_ENABLED: "false", CF_AI_KNOWLEDGE_BASE: " " }),
  ).toEqual({ searchEnabled: false });
});

test("rejects malformed stored preferences", () => {
  expect(parsePreferences(null)).toBeNull();
  expect(parsePreferences("{")).toBeNull();
  expect(parsePreferences('{"searchEnabled":"yes"}')).toBeNull();
  expect(parsePreferences('{"modelId":"@cf/a"}')).toEqual({ modelId: "@cf/a" });
});
