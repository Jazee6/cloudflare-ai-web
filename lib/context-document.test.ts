import { expect, mock, test } from "bun:test";
import { MAX_CONTEXT_ATTACHMENT_CHARS, MAX_DOCUMENT_BYTES } from "@/lib/context-attachments";
import {
  classifyDocumentFile,
  ContextDocumentError,
  extractDocumentAttachment,
} from "@/lib/context-document";

test("classifyDocumentFile rejects images and unknown binary formats", () => {
  expect(() => classifyDocumentFile("photo.png", "image/png")).toThrow(ContextDocumentError);
  expect(() => classifyDocumentFile("photo.webp", "application/octet-stream")).toThrow(
    ContextDocumentError,
  );
  expect(() => classifyDocumentFile("archive.zip", "application/zip")).toThrow(
    ContextDocumentError,
  );
});

test("extractDocumentAttachment decodes UTF-8 plain text without calling Workers AI", async () => {
  const fetchSpy = mock(async () => new Response("unexpected")) as unknown as typeof fetch;
  const file = new File(["# Hello\r\nWorld"], "notes.md", { type: "text/markdown" });

  const attachment = await extractDocumentAttachment(file, {
    accountId: "acc",
    apiToken: "tok",
    fetchImpl: fetchSpy,
  });

  expect(fetchSpy).not.toHaveBeenCalled();
  expect(attachment).toMatchObject({
    kind: "document",
    title: "notes.md",
    method: "plain-text",
    content: "# Hello\nWorld",
    originalChars: 13,
    truncated: false,
  });
});

test("extractDocumentAttachment rejects NUL bytes in plain-text files", async () => {
  const file = new File([new Uint8Array([0x41, 0x00, 0x42])], "fake.txt", {
    type: "text/plain",
  });

  await expect(extractDocumentAttachment(file)).rejects.toMatchObject({ status: 400 });
});

test("extractDocumentAttachment rejects files exceeding 4 MiB", async () => {
  const oversize = new File([new Uint8Array(MAX_DOCUMENT_BYTES + 1)], "huge.txt", {
    type: "text/plain",
  });
  await expect(extractDocumentAttachment(oversize)).rejects.toMatchObject({ status: 413 });
});

test("extractDocumentAttachment sends rich documents to Workers AI toMarkdown and truncates output", async () => {
  let capturedFormData: FormData | undefined;
  let capturedUrl = "";
  const longMarkdown = "Paragraph content.\n\n".repeat(1_500);

  const fetchMock = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
    capturedUrl = String(input);
    capturedFormData = init?.body as FormData;
    return Response.json({
      success: true,
      result: [{ name: "report.pdf", format: "markdown", data: longMarkdown }],
    });
  }) as unknown as typeof fetch;

  const pdf = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "report.pdf", {
    type: "application/pdf",
  });
  const attachment = await extractDocumentAttachment(pdf, {
    accountId: "acc-123",
    apiToken: "tok-123",
    fetchImpl: fetchMock,
  });

  expect(capturedUrl).toBe("https://api.cloudflare.com/client/v4/accounts/acc-123/ai/tomarkdown");
  expect(capturedFormData?.get("conversionOptions")).toBe(
    JSON.stringify({ pdf: { metadata: false } }),
  );
  expect(attachment.method).toBe("to-markdown");
  expect(attachment.truncated).toBe(true);
  expect(attachment.content.length).toBeLessThanOrEqual(MAX_CONTEXT_ATTACHMENT_CHARS);
});

test("extractDocumentAttachment maps Workers AI conversion errors cleanly", async () => {
  const fetchMock = mock(async () =>
    Response.json({
      success: true,
      result: [{ error: "Corrupted PDF" }],
    }),
  ) as unknown as typeof fetch;

  const pdf = new File([new Uint8Array([1, 2, 3])], "broken.pdf", { type: "application/pdf" });
  await expect(
    extractDocumentAttachment(pdf, {
      accountId: "acc-123",
      apiToken: "tok-123",
      fetchImpl: fetchMock,
    }),
  ).rejects.toMatchObject({ status: 422 });
});
