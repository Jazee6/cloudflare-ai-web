import { afterEach, expect, test } from "bun:test";
import { checkApiAccess } from "@/server/api-access";

const statusOf = async (request: Request) => (await checkApiAccess(request))?.status ?? 200;

const originalPassword = process.env.APP_PASSWORD;

afterEach(() => {
  if (originalPassword === undefined) {
    delete process.env.APP_PASSWORD;
  } else {
    process.env.APP_PASSWORD = originalPassword;
  }
});

test("api access gate allows anonymous GET /api/models and POST /api/auth when APP_PASSWORD is set", async () => {
  process.env.APP_PASSWORD = "secret";

  const modelsGet = await statusOf(
    new Request("https://example.com/api/models", { method: "GET" }),
  );
  expect(modelsGet).toBe(200);

  const authPost = await statusOf(new Request("https://example.com/api/auth", { method: "POST" }));
  expect(authPost).toBe(200);
});

test("api access gate blocks unauthenticated non-GET /api/models and POST /api/chat", async () => {
  process.env.APP_PASSWORD = "secret";

  const modelsPost = await statusOf(
    new Request("https://example.com/api/models", { method: "POST" }),
  );
  expect(modelsPost).toBe(401);

  const chatPost = await statusOf(new Request("https://example.com/api/chat", { method: "POST" }));
  expect(chatPost).toBe(401);

  const docPost = await statusOf(
    new Request("https://example.com/api/context/document", { method: "POST" }),
  );
  expect(docPost).toBe(401);

  const urlPost = await statusOf(
    new Request("https://example.com/api/context/url", { method: "POST" }),
  );
  expect(urlPost).toBe(401);

  const instancesGet = await statusOf(
    new Request("https://example.com/api/ai-search/instances", { method: "GET" }),
  );
  expect(instancesGet).toBe(401);
});

test("api access gate ignores non-API paths and passes everything without APP_PASSWORD", async () => {
  process.env.APP_PASSWORD = "secret";
  expect(await statusOf(new Request("https://example.com/c/abc"))).toBe(200);
  expect(await statusOf(new Request("https://example.com/apix"))).toBe(200);

  delete process.env.APP_PASSWORD;
  expect(await statusOf(new Request("https://example.com/api/chat", { method: "POST" }))).toBe(200);
});
