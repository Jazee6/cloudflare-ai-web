import { afterEach, expect, mock, test } from "bun:test";
import { POST } from "@/app/api/chat/route";
import {
  createContextAttachmentPart,
  MAX_CONTEXT_ATTACHMENT_CHARS,
} from "@/lib/context-attachments";

const ENV_KEYS = [
  "CF_ACCOUNT_ID",
  "CF_WORKERS_AI_TOKEN",
  "CF_AI_GATEWAY_NAME",
  "CF_AI_GATEWAY_TOKEN",
  "CF_AI_GATEWAY_MODELS",
  "CF_AI_SEARCH_TOKEN",
  "CF_AI_SEARCH_INSTANCES",
] as const;
const savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = savedEnv[key];
    }
  }
});

const configureExternalModel = () => {
  process.env.CF_ACCOUNT_ID = "acc";
  process.env.CF_AI_GATEWAY_NAME = "gw";
  process.env.CF_AI_GATEWAY_TOKEN = "gw-tok";
  process.env.CF_AI_GATEWAY_MODELS = "openai/gpt-5";
};

test("POST /api/chat rejects malformed data-context-attachment parts with 400", async () => {
  configureExternalModel();
  const response = await POST(
    new Request("https://example.com/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-5",
        provider: "ai-gateway",
        messages: [
          {
            id: "u1",
            role: "user",
            parts: [
              { type: "data-context-attachment", data: { id: "" } },
              { type: "text", text: "hi" },
            ],
          },
        ],
      }),
    }),
  );

  expect(response.status).toBe(400);
});

test("POST /api/chat rejects latest message + attachments exceeding 64,000 chars with 413", async () => {
  configureExternalModel();
  const part = createContextAttachmentPart({
    id: "att-1",
    kind: "document",
    title: "big.md",
    mediaType: "text/markdown",
    method: "plain-text",
    content: "a".repeat(MAX_CONTEXT_ATTACHMENT_CHARS),
    originalChars: MAX_CONTEXT_ATTACHMENT_CHARS,
    truncated: false,
  });

  const response = await POST(
    new Request("https://example.com/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-5",
        provider: "ai-gateway",
        messages: [
          {
            id: "u1",
            role: "user",
            parts: [part, part, { type: "text", text: "x".repeat(20_000) }],
          },
        ],
      }),
    }),
  );

  expect(response.status).toBe(413);
});

test("POST /api/chat rejects non-allowlisted knowledgeBaseId and propagates AI Search 429", async () => {
  configureExternalModel();
  process.env.CF_AI_SEARCH_TOKEN = "search-tok";
  process.env.CF_AI_SEARCH_INSTANCES = "docs";

  const forbidden = await POST(
    new Request("https://example.com/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-5",
        provider: "ai-gateway",
        knowledgeBaseId: "private-kb",
        messages: [{ id: "u1", role: "user", parts: [{ type: "text", text: "hi" }] }],
      }),
    }),
  );
  expect(forbidden.status).toBe(403);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mock(
    async () => new Response("quota", { status: 429 }),
  ) as unknown as typeof fetch;
  try {
    const rateLimited = await POST(
      new Request("https://example.com/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: "openai/gpt-5",
          provider: "ai-gateway",
          knowledgeBaseId: "docs",
          messages: [{ id: "u1", role: "user", parts: [{ type: "text", text: "hi" }] }],
        }),
      }),
    );
    expect(rateLimited.status).toBe(429);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
