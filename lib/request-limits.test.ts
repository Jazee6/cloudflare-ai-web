import { expect, test } from "bun:test";
import type { UIMessage } from "ai";
import {
  getImageDataUrlSize,
  MAX_IMAGE_BYTES,
  readRequestBody,
  validateImageParts,
} from "@/lib/request-limits";

test("readRequestBody rejects a declared oversized body before reading", async () => {
  const request = new Request("https://example.com/api", {
    method: "POST",
    headers: { "content-length": "5" },
    body: "test",
  });

  expect(await readRequestBody(request, 4)).toEqual({
    ok: false,
    status: 413,
    message: "Request body too large.",
  });
});

test("readRequestBody enforces observed UTF-8 bytes", async () => {
  const request = new Request("https://example.com/api", {
    method: "POST",
    body: "你好",
  });

  expect(await readRequestBody(request, 5)).toMatchObject({ ok: false, status: 413 });
});

test("getImageDataUrlSize validates media type, base64, and decoded bytes", () => {
  expect(getImageDataUrlSize("data:image/png;base64,AQID", "image/png")).toBe(3);
  expect(getImageDataUrlSize("data:image/jpeg;base64,AQID", "image/png")).toBeNull();
  expect(getImageDataUrlSize("https://example.com/image.png", "image/png")).toBeNull();
  expect(getImageDataUrlSize("data:image/png;base64,%%%", "image/png")).toBeNull();
});

test("validateImageParts rejects oversized and excessive image attachments", () => {
  const fileMessage = (url: string): UIMessage => ({
    id: crypto.randomUUID(),
    role: "user",
    parts: [{ type: "file", mediaType: "image/png", url }],
  });
  const smallImage = "data:image/png;base64,AQID";
  const oversizedImage = `data:image/png;base64,${Buffer.alloc(MAX_IMAGE_BYTES + 1).toString("base64")}`;

  expect(validateImageParts([fileMessage(oversizedImage)])).toMatchObject({
    ok: false,
    status: 413,
  });
  expect(
    validateImageParts(Array.from({ length: 6 }, () => fileMessage(smallImage))),
  ).toMatchObject({
    ok: false,
    status: 400,
  });
});
