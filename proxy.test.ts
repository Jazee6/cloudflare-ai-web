import { afterEach, expect, test } from "bun:test";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

const originalPassword = process.env.APP_PASSWORD;

afterEach(() => {
  if (originalPassword === undefined) {
    delete process.env.APP_PASSWORD;
  } else {
    process.env.APP_PASSWORD = originalPassword;
  }
});

test("proxy allows anonymous GET /api/models and POST /api/auth when APP_PASSWORD is set", async () => {
  process.env.APP_PASSWORD = "secret";

  const modelsGet = await proxy(
    new NextRequest("https://example.com/api/models", { method: "GET" }),
  );
  expect(modelsGet.status).toBe(200);

  const authPost = await proxy(new NextRequest("https://example.com/api/auth", { method: "POST" }));
  expect(authPost.status).toBe(200);
});

test("proxy blocks unauthenticated non-GET /api/models and POST /api/chat", async () => {
  process.env.APP_PASSWORD = "secret";

  const modelsPost = await proxy(
    new NextRequest("https://example.com/api/models", { method: "POST" }),
  );
  expect(modelsPost.status).toBe(401);

  const chatPost = await proxy(new NextRequest("https://example.com/api/chat", { method: "POST" }));
  expect(chatPost.status).toBe(401);
});
