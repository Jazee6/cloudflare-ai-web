import { afterEach, expect, test } from "bun:test";
import { POST } from "@/app/api/auth/route";

const originalPassword = process.env.APP_PASSWORD;

afterEach(() => {
  process.env.APP_PASSWORD = originalPassword;
});

test("auth rejects oversized bodies before authentication", async () => {
  process.env.APP_PASSWORD = "secret";
  const response = await POST(
    new Request("https://example.com/api/auth", {
      method: "POST",
      headers: { "content-length": "2048", "content-type": "application/json" },
      body: JSON.stringify({ password: "secret" }),
    }),
  );

  expect(response.status).toBe(413);
});

test("auth rejects cross-site requests", async () => {
  process.env.APP_PASSWORD = "secret";
  const response = await POST(
    new Request("https://example.com/api/auth", {
      method: "POST",
      headers: { origin: "https://attacker.example", "content-type": "application/json" },
      body: JSON.stringify({ password: "secret" }),
    }),
  );

  expect(response.status).toBe(403);
});

test("auth issues an HttpOnly session cookie for the configured password", async () => {
  process.env.APP_PASSWORD = "secret";
  const response = await POST(
    new Request("https://example.com/api/auth", {
      method: "POST",
      headers: { origin: "https://example.com", "content-type": "application/json" },
      body: JSON.stringify({ password: "secret" }),
    }),
  );

  expect(response.status).toBe(200);
  expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  expect(response.headers.get("set-cookie")).toContain("SameSite=Strict");
  expect(response.headers.get("set-cookie")).not.toContain("secret");
});
