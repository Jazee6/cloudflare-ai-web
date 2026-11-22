import { expect, test } from "bun:test";
import { POST } from "@/app/api/context/url/route";

test("POST /api/context/url rejects malformed JSON and SSRF URLs", async () => {
  const malformed = await POST(
    new Request("https://example.com/api/context/url", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    }),
  );
  expect(malformed.status).toBe(400);

  const local = await POST(
    new Request("https://example.com/api/context/url", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "http://127.0.0.1/secret" }),
    }),
  );
  expect(local.status).toBe(403);
});
