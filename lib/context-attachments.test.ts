import { expect, test } from "bun:test";
import type { UIMessage } from "ai";
import {
  type ContextAttachmentData,
  createContextAttachmentPart,
  formatContextAttachmentForModel,
  isContextAttachmentPart,
  MAX_CONTEXT_ATTACHMENT_CHARS,
  truncateAttachmentContent,
  validateContextAttachmentParts,
} from "@/lib/context-attachments";

const makeAttachment = (overrides: Partial<ContextAttachmentData> = {}): ContextAttachmentData => ({
  id: "att-1",
  kind: "document",
  title: "spec.md",
  mediaType: "text/markdown",
  method: "plain-text",
  content: "# Spec\nHello",
  originalChars: 12,
  truncated: false,
  ...overrides,
});

test("truncateAttachmentContent normalizes CRLF and cuts at paragraph boundary", () => {
  const paragraph1 = "A".repeat(75);
  const paragraph2 = "B".repeat(40);
  const result = truncateAttachmentContent(`${paragraph1}\r\n\r\n${paragraph2}`, 100);

  expect(result.truncated).toBe(true);
  expect(result.originalChars).toBe(117);
  expect(result.content).toBe(paragraph1);
});

test("truncateAttachmentContent returns untruncated content within limit", () => {
  const result = truncateAttachmentContent("  hello\r\nworld  ", 100);
  expect(result).toEqual({
    content: "hello\nworld",
    originalChars: 11,
    truncated: false,
  });
});

test("isContextAttachmentPart validates shape and rejects malformed parts", () => {
  const validPart = createContextAttachmentPart(makeAttachment());
  expect(isContextAttachmentPart(validPart)).toBe(true);
  expect(
    isContextAttachmentPart({
      type: "data-context-attachment",
      data: { kind: "document" },
    } as UIMessage["parts"][number]),
  ).toBe(false);
  expect(
    isContextAttachmentPart(
      createContextAttachmentPart(makeAttachment({ sourceUrl: "javascript:alert(1)" })),
    ),
  ).toBe(false);
  expect(isContextAttachmentPart({ type: "text", text: "hi" })).toBe(false);
});

test("validateContextAttachmentParts enforces schema, per-message cap, and content size", () => {
  const okMessage: UIMessage = {
    id: "m1",
    role: "user",
    parts: [createContextAttachmentPart(makeAttachment()), { type: "text", text: "read this" }],
  };
  expect(validateContextAttachmentParts([okMessage])).toEqual({ ok: true });

  const malformed: UIMessage = {
    id: "m2",
    role: "user",
    parts: [{ type: "data-context-attachment", data: { id: "" } } as UIMessage["parts"][number]],
  };
  expect(validateContextAttachmentParts([malformed])).toMatchObject({ ok: false, status: 400 });

  const tooMany: UIMessage = {
    id: "m3",
    role: "user",
    parts: Array.from({ length: 5 }, (_, index) =>
      createContextAttachmentPart(makeAttachment({ id: `att-${index}` })),
    ),
  };
  expect(validateContextAttachmentParts([tooMany])).toMatchObject({ ok: false, status: 400 });

  const tooLarge: UIMessage = {
    id: "m4",
    role: "user",
    parts: [
      createContextAttachmentPart(
        makeAttachment({ content: "x".repeat(MAX_CONTEXT_ATTACHMENT_CHARS + 1) }),
      ),
    ],
  };
  expect(validateContextAttachmentParts([tooLarge])).toMatchObject({ ok: false, status: 413 });
});

test("formatContextAttachmentForModel escapes quotes and includes truncation metadata", () => {
  const formatted = formatContextAttachmentForModel(
    makeAttachment({
      kind: "webpage",
      title: 'Docs "v6"',
      sourceUrl: "https://example.com/docs",
      truncated: true,
      originalChars: 50_000,
    }),
  );

  expect(formatted).toContain(
    '<context_attachment kind="webpage" title="Docs &quot;v6&quot;" source_url="https://example.com/docs" truncated="true" original_chars="50000">',
  );
  expect(formatted).toContain("# Spec\nHello");
  expect(formatted).toContain("</context_attachment>");
});
