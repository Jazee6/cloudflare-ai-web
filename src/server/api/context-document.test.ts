import { expect, test } from "bun:test";
import { POST } from "@/server/api/context-document";
import { MAX_DOCUMENT_BYTES } from "@/lib/context-attachments";

test("POST /api/context/document validates multipart file and returns extracted attachment", async () => {
  const form = new FormData();
  form.append("file", new File(["hello markdown"], "readme.md", { type: "text/markdown" }));

  const response = await POST(
    new Request("https://example.com/api/context/document", {
      method: "POST",
      body: form,
    }),
  );

  expect(response.status).toBe(200);
  const body = (await response.json()) as { attachment: { title: string; content: string } };
  expect(body.attachment.title).toBe("readme.md");
  expect(body.attachment.content).toBe("hello markdown");
});

test("POST /api/context/document rejects missing files and oversized payloads", async () => {
  const emptyForm = new FormData();
  const missing = await POST(
    new Request("https://example.com/api/context/document", {
      method: "POST",
      body: emptyForm,
    }),
  );
  expect(missing.status).toBe(400);

  const oversized = await POST(
    new Request("https://example.com/api/context/document", {
      method: "POST",
      headers: { "content-length": String(MAX_DOCUMENT_BYTES + 512 * 1024) },
      body: emptyForm,
    }),
  );
  expect(oversized.status).toBe(413);

  const oversizedStream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(MAX_DOCUMENT_BYTES + 512 * 1024));
      controller.close();
    },
  });
  const chunkedOversized = await POST(
    new Request("https://example.com/api/context/document", {
      method: "POST",
      headers: { "content-type": "multipart/form-data; boundary=test" },
      body: oversizedStream,
    }),
  );
  expect(chunkedOversized.status).toBe(413);
});
