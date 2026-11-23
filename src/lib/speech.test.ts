import { expect, test } from "bun:test";
import { mapSpeechRecognitionError, prepareTextForSpeech, splitSpeechChunks } from "@/lib/speech";

test("prepareTextForSpeech strips markdown syntax and skips fenced code blocks by default", () => {
  const input = [
    "# Heading",
    "",
    "See [Cloudflare Docs](https://developers.cloudflare.com) for **details** and `wrangler`.",
    "",
    "```ts",
    "const x = 1;",
    "```",
    "",
    "- First item",
    "- Second item",
  ].join("\n");

  const spoken = prepareTextForSpeech(input);
  expect(spoken).toContain("Heading");
  expect(spoken).toContain("See Cloudflare Docs for details and wrangler.");
  expect(spoken).toContain("Code block omitted.");
  expect(spoken).not.toContain("const x = 1");
  expect(spoken).not.toContain("https://");
  expect(spoken).not.toContain("**");
});

test("prepareTextForSpeech preserves underscores inside snake_case identifiers while stripping emphasis", () => {
  const spoken = prepareTextForSpeech(
    "Set _max_num_results_ and __skip_cache__ around `ai_search_options`.",
  );
  expect(spoken).toBe("Set max_num_results and skip_cache around ai_search_options.");
});

test("prepareTextForSpeech can keep code contents when skipCodeBlocks is false", () => {
  const spoken = prepareTextForSpeech("```js\nhello();\n```", { skipCodeBlocks: false });
  expect(spoken).toBe("hello();");
});

test("splitSpeechChunks splits long text by sentences without exceeding maxChunkLength", () => {
  const text =
    "First sentence is short. Second sentence is also quite short! 第三句话是中文句子，用来测试切分。 " +
    "A".repeat(250);
  const chunks = splitSpeechChunks(text, 100);

  expect(chunks.length).toBeGreaterThan(2);
  for (const chunk of chunks) {
    expect(chunk.length).toBeLessThanOrEqual(100);
    expect(chunk.length).toBeGreaterThan(0);
  }
});

test("mapSpeechRecognitionError returns message keys", () => {
  expect(mapSpeechRecognitionError("not-allowed")).toBe("speech.permissionDenied");
  expect(mapSpeechRecognitionError("audio-capture")).toBe("speech.noMicrophone");
  expect(mapSpeechRecognitionError("network")).toBe("speech.serviceUnavailable");
  expect(mapSpeechRecognitionError("other")).toBe("speech.failed");
});
