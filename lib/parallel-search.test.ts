import { afterEach, beforeEach, expect, test } from "bun:test";
import type { UIMessage, UIMessageChunk } from "ai";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { POST } from "@/app/api/chat/route";
import { createConversationTransport } from "@/lib/chat-transport";
import { createConversation, createUserMessage } from "@/lib/conversation-store";
import { db } from "@/lib/db";
import { getModelCatalog } from "@/lib/model-catalog";
import { externalModels, type Model } from "@/lib/models";
import { createChatModel } from "@/lib/providers";

type ObservedRequest = {
  url: string;
  headers: Headers;
  body: Record<string, any>;
};
const observed: ObservedRequest[] = [];
const originalFetch = globalThis.fetch;
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
const environment = { ...process.env };
let cookie = "";
let mode:
  | "success"
  | "http-error"
  | "tool-error"
  | "malformed"
  | "missing"
  | "pending"
  | "invalid-url" = "success";
let pendingStarted: (() => void) | undefined;

const clearCatalog = () =>
  (
    globalThis as typeof globalThis & {
      cloudflareModelCatalogCache?: Map<string, unknown>;
    }
  ).cloudflareModelCatalogCache?.clear();

const models: Model[] = [
  {
    id: "@cf/test/tools",
    name: "tools",
    brand: "Test",
    type: "Text Generation",
    provider: "workers-ai",
    source: "cloudflare",
    input: ["search"],
  },
  {
    id: "@cf/test/plain",
    name: "plain",
    brand: "Test",
    type: "Text Generation",
    provider: "workers-ai",
    source: "cloudflare",
  },
];

const sse = (delta: Record<string, unknown>, finishReason: string) =>
  new Response(
    `data: ${JSON.stringify({ choices: [{ delta, finish_reason: finishReason }] })}\n\ndata: [DONE]\n\n`,
    { headers: { "content-type": "text/event-stream" } },
  );

const fixtureFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = new URL(input instanceof Request ? input.url : String(input), "https://example.com");
  const headers = new Headers(
    init?.headers ?? (input instanceof Request ? input.headers : undefined),
  );
  const body = init?.body
    ? JSON.parse(String(init.body))
    : input instanceof Request
      ? await input.clone().json()
      : {};
  observed.push({ url: url.href, headers, body });

  if (url.pathname === "/api/chat") {
    const request = new NextRequest(url, {
      ...init,
      signal: init?.signal ?? undefined,
      body: JSON.stringify(body),
    });
    const permission = await proxy(request);
    return permission.status === 401 ? permission : POST(request);
  }
  if (url.hostname === "api.cloudflare.com" && url.pathname.endsWith("/models/search")) {
    const task = url.searchParams.get("task");
    return Response.json({
      success: true,
      result:
        task === "Text Generation"
          ? ["tools", "plain", "ambiguous"].map((name) => ({
              id: name,
              source: 1,
              name: `@cf/test/${name}`,
              description: "Fixture model",
              task: { id: "text", name: task, description: "Text" },
              tags: [],
              properties:
                name === "tools"
                  ? [{ property_id: "function_calling", value: "true" }]
                  : name === "ambiguous"
                    ? [{ property_id: "function_calling", value: "sometimes" }]
                    : [],
            }))
          : [],
    });
  }
  if (url.hostname === "api.cloudflare.com" && url.pathname.includes("/ai/run/")) {
    const tools = body.messages.filter((message: any) => message.role === "tool");
    if (!body.tools?.length) {
      return sse({ content: "Search is disabled." }, "stop");
    }
    if (tools.length === 0) {
      return sse(
        {
          tool_calls: [
            {
              id: "searchcall",
              index: 0,
              type: "function",
              function: {
                name: mode === "invalid-url" ? "web_fetch" : "web_search",
                arguments: JSON.stringify(
                  mode === "invalid-url"
                    ? { urls: ["file:///private"] }
                    : {
                        objective: "Find current source",
                        search_queries: ["current source news"],
                      },
                ),
              },
            },
          ],
        },
        "tool_calls",
      );
    }
    if (tools.length === 1 && tools[0].content.includes("Source excerpt")) {
      return sse(
        {
          tool_calls: [
            {
              id: "fetchcall",
              index: 0,
              type: "function",
              function: {
                name: "web_fetch",
                arguments: JSON.stringify({
                  urls: ["https://example.com/source"],
                  search_queries: ["current source news"],
                }),
              },
            },
          ],
        },
        "tool_calls",
      );
    }
    return sse(
      {
        content: tools.some((message: any) => message.content.includes("Fetched page"))
          ? "Answer from fetched source: https://example.com/source"
          : "Search failed; no current source is available.",
      },
      "stop",
    );
  }
  if (url.href !== "https://search.parallel.ai/mcp") {
    throw new Error(`Unexpected URL: ${url.href}`);
  }
  expect(headers.get("user-agent")).toBe("cloudflare-ai-web/5.2.0");
  expect(headers.has("authorization")).toBe(false);
  if (!body.method) return new Response(null, { status: 405 });
  if (body.method === "notifications/initialized") {
    return new Response(null, { status: 202 });
  }
  if (body.method === "initialize") {
    return Response.json({
      jsonrpc: "2.0",
      id: body.id,
      result: {
        protocolVersion: "2025-03-26",
        capabilities: { tools: {} },
        serverInfo: { name: "parallel-fixture", version: "1.0.0" },
      },
    });
  }
  if (body.method === "tools/list") {
    return Response.json({
      jsonrpc: "2.0",
      id: body.id,
      result: {
        tools:
          mode === "missing"
            ? []
            : ["web_search", "web_fetch"].map((name) => ({
                name,
                inputSchema: { type: "object" },
              })),
      },
    });
  }
  if (body.method === "tools/call") {
    if (mode === "pending") {
      pendingStarted?.();
      return new Promise((_resolve, reject) => {
        const signal = init?.signal;
        if (signal?.aborted) {
          reject(signal.reason);
        } else {
          signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
        }
      });
    }
    if (mode === "http-error") return new Response("Unavailable", { status: 503 });
    if (mode === "malformed") return Response.json({ invalid: true });
    return Response.json({
      jsonrpc: "2.0",
      id: body.id,
      result: {
        isError: mode === "tool-error",
        content: [
          {
            type: "text",
            text:
              body.params.name === "web_search"
                ? "Source excerpt: https://example.com/source"
                : "Fetched page: Current source details.",
          },
        ],
      },
    });
  }
  throw new Error(`Unexpected MCP method: ${body.method}`);
};

beforeEach(() => {
  observed.length = 0;
  mode = "success";
  pendingStarted = undefined;
  cookie = "CF_AI_SEARCH_ENABLED=true; CF_AI_MODEL=%40cf%2Ftest%2Ftools";
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      get cookie() {
        return cookie;
      },
    },
  });
  for (const key of [
    "CF_AI_GATEWAY_NAME",
    "CF_AI_GATEWAY_TOKEN",
    "PARALLEL_API_KEY",
    "GOOGLE_API_KEY",
    "APP_PASSWORD",
  ]) {
    delete process.env[key];
  }
  process.env.CF_ACCOUNT_ID = "fixture-account";
  process.env.CF_WORKERS_AI_TOKEN = "fixture-inference-only";
  globalThis.fetch = Object.assign(fixtureFetch, { preconnect: originalFetch.preconnect });
  clearCatalog();
});

afterEach(async () => {
  globalThis.fetch = originalFetch;
  process.env = { ...environment };
  if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
  else Reflect.deleteProperty(globalThis, "document");
  clearCatalog();
  await db.session.clear();
  await db.message.clear();
});

const send = async (
  conversationId: string,
  messages: UIMessage[],
  trigger: "submit-message" | "regenerate-message" = "submit-message",
  abortSignal?: AbortSignal,
) => {
  const transport = createConversationTransport(conversationId, models);
  const stream = await transport.sendMessages({
    trigger,
    chatId: conversationId,
    messageId: undefined,
    messages,
    abortSignal,
  });
  const parts: UIMessageChunk[] = [];
  for await (const part of stream) parts.push(part);
  return parts;
};

const calls = () => observed.filter((request) => request.body.method === "tools/call");

test("normal browser transport and Workers AI loop discover, search, fetch and consume results", async () => {
  const first = createUserMessage("Find current source");
  const id = await createConversation(first);
  const chunks = await send(id, [first]);
  expect(chunks).toContainEqual(
    expect.objectContaining({
      type: "text-delta",
      delta: "Answer from fetched source: https://example.com/source",
    }),
  );
  expect(calls().map((request) => request.body.params.name)).toEqual(["web_search", "web_fetch"]);
  expect(calls().every((request) => request.body.params.arguments.session_id === id)).toBe(true);
  expect(
    calls().every((request) => request.body.params.arguments.model_name === models[0].id),
  ).toBe(true);
  expect(observed.filter((request) => request.body.method === "tools/list")).toHaveLength(2);
  const modelRequests = observed.filter((request) => request.url.includes("/ai/run/"));
  expect(modelRequests).toHaveLength(3);
  expect(JSON.stringify(modelRequests[2].body.messages)).toContain("Fetched page");
  expect(modelRequests[0].body.tools.map((entry: any) => entry.function.name)).toEqual([
    "web_search",
    "web_fetch",
  ]);
  if (process.env.PARALLEL_CALLER_EVIDENCE) {
    const requests = observed
      .filter((request) => request.url === "https://search.parallel.ai/mcp")
      .map((request) => ({
        url: request.url,
        userAgent: request.headers.get("user-agent"),
        method: request.body.method ?? "transport-stream",
        params: request.body.params,
      }));
    await Bun.write(
      process.env.PARALLEL_CALLER_EVIDENCE,
      JSON.stringify(
        {
          userAgent: requests[0].userAgent,
          callerPath: "lib/parallel-search.ts",
          requestObserved: requests.length > 0,
          resultConsumed: JSON.stringify(modelRequests[2].body.messages).includes("Fetched page"),
          requests,
        },
        null,
        2,
      ),
    );
  }
});

test("persisted conversations isolate interleaved calls, follow-ups, retries and new chats", async () => {
  const first = createUserMessage("First chat");
  const second = createUserMessage("Second chat");
  const firstId = await createConversation(first);
  const secondId = await createConversation(second);
  expect(firstId).not.toBe(secondId);
  await Promise.all([send(firstId, [first]), send(secondId, [second])]);
  await send(firstId, [first, createUserMessage("Follow-up")]);
  await send(firstId, [first], "regenerate-message");
  const newId = await createConversation(createUserMessage("New chat"));
  await send(newId, [createUserMessage("New chat")]);
  const ids = calls().map((request) => request.body.params.arguments.session_id);
  expect(ids.filter((id) => id === firstId)).toHaveLength(6);
  expect(ids.filter((id) => id === secondId)).toHaveLength(2);
  expect(ids.filter((id) => id === newId)).toHaveLength(2);
  expect(new Set(ids).size).toBe(3);
});

test("capability signals enable only supported Workers AI models", async () => {
  const catalog = await getModelCatalog();
  expect(catalog.find((model) => model.id === models[0].id)?.input).toContain("search");
  expect(catalog.find((model) => model.id === models[1].id)?.input).toBeUndefined();
  expect(catalog.find((model) => model.id === "@cf/test/ambiguous")?.input).toBeUndefined();
  expect(createChatModel(models[1], { search: true }).tools).toBeUndefined();
  expect(createChatModel(models[0], {}).tools).toBeUndefined();
  expect(createChatModel(models[0], { search: false }).tools).toBeUndefined();
  expect(observed.some((request) => request.url.includes("search.parallel.ai"))).toBe(false);
});

test("saved disabled search and model selections are preserved through the browser caller", async () => {
  const id = await createConversation(createUserMessage("Saved choice"));
  cookie = "CF_AI_SEARCH_ENABLED=false; CF_AI_MODEL=%40cf%2Ftest%2Ftools";
  await send(id, [createUserMessage("Search off")]);
  cookie = "CF_AI_SEARCH_ENABLED=true; CF_AI_MODEL=%40cf%2Ftest%2Fplain";
  await send(id, [createUserMessage("Plain model")]);
  cookie = "";
  await send(id, [createUserMessage("Fresh preferences")]);
  expect(calls()).toHaveLength(0);
  expect(observed.filter((request) => request.url.includes("/ai/run/"))[1].url).toContain("/plain");
});

test("Google retains native grounding", () => {
  process.env.GOOGLE_API_KEY = "fixture-google";
  process.env.CF_AI_GATEWAY_NAME = "fixture-gateway";
  process.env.CF_AI_GATEWAY_TOKEN = "fixture-gateway-token";
  expect(Object.keys(createChatModel(externalModels[0], { search: true }).tools ?? {})).toEqual([
    "google_search",
  ]);
  expect(createChatModel(externalModels[0], { search: false }).tools).toBeUndefined();
  expect(observed).toHaveLength(0);
});

for (const failure of ["http-error", "tool-error", "malformed", "missing"] as const) {
  test(`chat surfaces ${failure} without changing search provider`, async () => {
    mode = failure;
    const chunks = await send(crypto.randomUUID(), [createUserMessage("Find current source")]);
    expect(chunks.some((chunk) => chunk.type === "tool-output-error")).toBe(true);
    expect(chunks).toContainEqual(
      expect.objectContaining({
        type: "text-delta",
        delta: "Search failed; no current source is available.",
      }),
    );
    expect(
      observed
        .filter((request) => request.url.includes("search.parallel.ai"))
        .every((request) => request.url === "https://search.parallel.ai/mcp"),
    ).toBe(true);
  });
}

test("canceling a chat aborts an in-flight MCP call", async () => {
  mode = "pending";
  const controller = new AbortController();
  const started = new Promise<void>((resolve) => {
    pendingStarted = resolve;
  });
  const result = send(
    crypto.randomUUID(),
    [createUserMessage("Find current source")],
    "submit-message",
    controller.signal,
  );
  await started;
  controller.abort(new DOMException("Chat canceled", "AbortError"));
  await result.catch(() => {});
  expect(calls()).toHaveLength(1);
});

test("MCP timeout reaches the chat as a tool error", async () => {
  mode = "pending";
  const chunks = await send(crypto.randomUUID(), [createUserMessage("Find current source")]);
  expect(chunks.some((chunk) => chunk.type === "tool-output-error")).toBe(true);
  expect(calls()).toHaveLength(1);
}, 15_000);

test("invalid URL protocols are rejected by the normal tool dispatcher", async () => {
  mode = "invalid-url";
  const chunks = await send(crypto.randomUUID(), [createUserMessage("Read a URL")]);
  expect(chunks.some((chunk) => chunk.type === "tool-input-error")).toBe(true);
  expect(calls()).toHaveLength(0);
});

test("Access Session protection rejects chat before any MCP request", async () => {
  process.env.APP_PASSWORD = "private-deployment";
  await expect(
    send(crypto.randomUUID(), [createUserMessage("Find current source")]),
  ).rejects.toThrow("Unauthorized");
  expect(observed.filter((request) => request.url.includes("search.parallel.ai"))).toHaveLength(0);
});
