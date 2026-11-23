import { expect, test } from "bun:test";
import { createContextAttachmentPart } from "@/lib/context-attachments";
import type { UIMessage } from "ai";
import { createFailedResponse } from "@/lib/failed-response";
import {
  buildModelContext,
  encodeGeneratedImages,
  expandImageTurns,
  GENERATED_IMAGE_PLACEHOLDER,
  MODEL_CONTEXT_MAX_CHARS,
} from "@/lib/model-context";
import type { StoredMessage as Message } from "@/lib/db";

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

test("counts data-context-attachment parts toward the 64,000-character budget", () => {
  const makeAttachmentMessage = (id: string, chars: number): Message => ({
    id,
    role: "user",
    parts: [
      createContextAttachmentPart({
        id: `att-${id}`,
        kind: "document",
        title: "doc.md",
        mediaType: "text/markdown",
        method: "plain-text",
        content: "a".repeat(chars),
        originalChars: chars,
        truncated: false,
      }),
      { type: "text", text: "summarize" },
    ],
    sessionId: "test",
    createdAt: new Date(),
  });

  expect(buildModelContext([makeAttachmentMessage("too-big", MODEL_CONTEXT_MAX_CHARS)])).toBeNull();

  const older = makeAttachmentMessage("older", 40_000);
  const newer = makeAttachmentMessage("newer", 40_000);
  const result = buildModelContext([older, newer]);
  expect(result?.map((message) => message.id)).toEqual(["newer"]);
});

const png = () => new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" });
const imageParams = { metadata: { modelId: "@cf/flux", params: { seed: 1 } } };

const imageConversation = (): UIMessage[] => [
  {
    id: "prompt",
    role: "user",
    parts: [
      { type: "data-reference-images", data: { images: [png()] } },
      { type: "text", text: "draw a cat" },
    ],
    ...imageParams,
  },
  {
    id: "image",
    role: "assistant",
    parts: [{ type: "data-images", data: { images: [png()] } }],
    ...imageParams,
  },
  { id: "question", role: "user", parts: [{ type: "text", text: "describe it" }] },
];

test("generated images ride along with the next user message for image-capable models", async () => {
  const { messages, generatedImages } = expandImageTurns(imageConversation(), true);

  expect(messages[0].parts).toEqual([{ type: "text", text: "draw a cat" }]);
  expect(messages[1].parts).toEqual([{ type: "text", text: GENERATED_IMAGE_PLACEHOLDER }]);
  expect(messages[2].parts.map((part) => part.type)).toEqual(["file", "text"]);

  const encoded = await encodeGeneratedImages(buildModelContext(messages)!, generatedImages);
  expect(encoded[2].parts[0]).toEqual({
    type: "file",
    mediaType: "image/png",
    url: "data:image/png;base64,AQID",
  });
});

test("generated images become placeholder text for text-only models", () => {
  const { messages, generatedImages } = expandImageTurns(imageConversation(), false);

  expect(generatedImages.size).toBe(0);
  expect(messages[1].parts).toEqual([{ type: "text", text: GENERATED_IMAGE_PLACEHOLDER }]);
  expect(messages[2].parts).toEqual([{ type: "text", text: "describe it" }]);
});

test("generated images count toward the most recent image limit", () => {
  const conversation = Array.from({ length: 6 }, (_, index) =>
    imageConversation().map((message) => ({ ...message, id: `${message.id}-${index}` })),
  ).flat();
  const { messages } = expandImageTurns(conversation, true);
  const context = buildModelContext(messages)!;

  const files = context.flatMap((message) => message.parts.filter((part) => part.type === "file"));
  expect(files).toHaveLength(5);
  expect(context.at(-1)?.parts[0].type).toBe("file");
});

test("keeps at most the Context Message Limit of recent messages", () => {
  const messages = ["1", "2", "3", "4", "5"].map((id, index) =>
    makeMessage(id, id, index % 2 === 0 ? "user" : "assistant"),
  );
  const result = buildModelContext(messages, { maxMessages: 3 });
  expect(result!.map((message) => message.id)).toEqual(["3", "4", "5"]);
});

test("never starts a Model Context with an assistant message", () => {
  const messages = ["1", "2", "3", "4", "5"].map((id, index) =>
    makeMessage(id, id, index % 2 === 0 ? "user" : "assistant"),
  );
  const result = buildModelContext(messages, { maxMessages: 2 });
  expect(result!.map((message) => message.id)).toEqual(["5"]);
});

test("leaves Failed Responses out of the Model Context and the limit", () => {
  const failed: Message = {
    ...createFailedResponse({ message: "boom" }),
    sessionId: "test",
    createdAt: new Date(),
  } as Message;
  const messages = [
    makeMessage("1", "a"),
    makeMessage("2", "b", "assistant"),
    makeMessage("3", "c"),
    failed,
    makeMessage("4", "d"),
  ];
  const result = buildModelContext(messages, { maxMessages: 3 });
  // The last three are 2, 3 and 4; the leading assistant message is dropped.
  expect(result!.map((message) => message.id)).toEqual(["3", "4"]);
});
