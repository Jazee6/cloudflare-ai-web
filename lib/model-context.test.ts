import { expect, test } from "bun:test";
import { buildModelContext } from "@/lib/model-context";
import type { Message } from "@/lib/db";

const makeMessage = (id: string, text: string, role: "user" | "assistant" = "user"): Message => ({
  id,
  role,
  parts: [{ type: "text", text }],
  sessionId: "test",
  createdAt: new Date(),
});

test("returns messages within the character limit", () => {
  const messages = [makeMessage("1", "hello"), makeMessage("2", "world")];
  const result = buildModelContext(messages);
  expect(result).toHaveLength(2);
});

test("rejects when the latest message exceeds the character limit", () => {
  const messages = [makeMessage("1", "x".repeat(64_001))];
  const result = buildModelContext(messages);
  expect(result).toBeNull();
});

test("trims older messages to stay under the limit", () => {
  const messages = [
    makeMessage("1", "a".repeat(32_000)),
    makeMessage("2", "b".repeat(32_000)),
    makeMessage("3", "c".repeat(1_000)),
  ];
  const result = buildModelContext(messages);
  expect(result).not.toBeNull();
  // The third message (1000 chars) fits, second (32000) fits with total 33000,
  // first (32000) would push to 65000 > 64000, so excluded
  expect(result!.length).toBeLessThanOrEqual(2);
});

test("keeps at most 5 most recent image file parts", () => {
  const messages: Message[] = [];
  for (let i = 0; i < 7; i++) {
    messages.push({
      id: `img-${i}`,
      role: "user",
      parts: [
        { type: "file", mediaType: "image/png", url: `data:image/png;base64,${i}` },
        { type: "text", text: `image ${i}` },
      ],
      sessionId: "test",
      createdAt: new Date(),
    });
  }

  const result = buildModelContext(messages);
  expect(result).not.toBeNull();
  const messagesWithFiles = result!.filter((message) =>
    message.parts.some((part) => part.type === "file"),
  );
  expect(messagesWithFiles.map((message) => message.id)).toEqual([
    "img-2",
    "img-3",
    "img-4",
    "img-5",
    "img-6",
  ]);
});

test("caps at 100 messages", () => {
  const messages: Message[] = [];
  for (let i = 0; i < 150; i++) {
    messages.push(makeMessage(`${i}`, `${i}`));
  }
  const result = buildModelContext(messages);
  expect(result).not.toBeNull();
  expect(result!.length).toBeLessThanOrEqual(100);
});

test("returns empty array for empty input", () => {
  const result = buildModelContext([]);
  expect(result).toEqual([]);
});
