import { expect, test } from "bun:test";
import { DEFAULT_SETTINGS, MAX_CUSTOM_INSTRUCTIONS_LENGTH, parseSettings } from "@/lib/settings";

test("parseSettings returns defaults for non-object or malformed inputs", () => {
  expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
  expect(parseSettings("bad")).toEqual(DEFAULT_SETTINGS);
  expect(parseSettings([])).toEqual(DEFAULT_SETTINGS);
});

test("parseSettings merges valid fields and falls back per invalid field", () => {
  expect(
    parseSettings({
      customInstructions: "Be concise.",
      skipGatewayCache: true,
      webFetchPolicy: "zero-quota",
      asrLocale: "zh-CN",
      ttsVoiceURI: "voice-1",
      ttsRate: 1.5,
      ttsSkipCodeBlocks: false,
    }),
  ).toEqual({
    customInstructions: "Be concise.",
    skipGatewayCache: true,
    webFetchPolicy: "zero-quota",
    asrLocale: "zh-CN",
    ttsVoiceURI: "voice-1",
    ttsRate: 1.5,
    ttsSkipCodeBlocks: false,
  });

  expect(
    parseSettings({
      customInstructions: "x".repeat(MAX_CUSTOM_INSTRUCTIONS_LENGTH + 1),
      skipGatewayCache: "yes",
      webFetchPolicy: "unknown",
      asrLocale: "invalid",
      ttsRate: 5,
    }),
  ).toEqual(DEFAULT_SETTINGS);
});
