import { expect, test } from "bun:test";
import { POST as postChat } from "@/app/api/chat/route";
import { POST as postImage } from "@/app/api/image/route";

const malformedRequest = (path: string) =>
  new Request(`https://example.com${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{",
  });

test("chat rejects malformed JSON", async () => {
  expect((await postChat(malformedRequest("/api/chat"))).status).toBe(400);
});

test("image generation rejects malformed JSON", async () => {
  expect((await postImage(malformedRequest("/api/image"))).status).toBe(400);
});
