import { expect, test } from "bun:test";
import { createWorkersAIFetch, normalizeWorkersAIEvent } from "@/lib/workers-ai-fetch";

test("normalizeWorkersAIEvent drops text repeated in the legacy response field", () => {
  const event = normalizeWorkersAIEvent(
    JSON.stringify({ choices: [{ delta: { content: "pong" } }], response: "pong", tool_calls: [] }),
  );

  expect(JSON.parse(event)).toEqual({ choices: [{ delta: { content: "pong" } }] });
});

test("normalizeWorkersAIEvent drops numeric tokens repeated as JSON numbers", () => {
  const event = normalizeWorkersAIEvent(
    JSON.stringify({ choices: [{ delta: { content: "91" } }], response: 91 }),
  );

  expect(JSON.parse(event)).toEqual({ choices: [{ delta: { content: "91" } }] });
});

test("normalizeWorkersAIEvent drops empty tool_calls so reasoning stays one block", () => {
  const event = normalizeWorkersAIEvent(
    JSON.stringify({
      choices: [{ delta: { reasoning_content: "hm", tool_calls: [] } }],
      tool_calls: [],
    }),
  );

  expect(JSON.parse(event)).toEqual({ choices: [{ delta: { reasoning_content: "hm" } }] });
});

test("normalizeWorkersAIEvent keeps native responses, real tool calls and non-JSON data", () => {
  const native = JSON.stringify({ response: "hello" });
  const toolCall = JSON.stringify({ tool_calls: [{ name: "search" }] });
  const differing = JSON.stringify({ choices: [{ delta: { content: "a" } }], response: "b" });

  expect(normalizeWorkersAIEvent(native)).toBe(native);
  expect(normalizeWorkersAIEvent(toolCall)).toBe(toolCall);
  expect(normalizeWorkersAIEvent(differing)).toBe(differing);
  expect(normalizeWorkersAIEvent("[DONE]")).toBe("[DONE]");
});

test("createWorkersAIFetch rewrites event streams split across chunks", async () => {
  const sse = [
    `data: {"choices":[{"delta":{"content":"po`,
    `ng"}}],"response":"pong","tool_calls":[]}\r\n\r\n`,
    "data: [DONE]\n\n",
  ];
  const workersAIFetch = createWorkersAIFetch(
    async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            sse.forEach((part) => controller.enqueue(new TextEncoder().encode(part)));
            controller.close();
          },
        }),
        { headers: { "content-type": "text/event-stream" } },
      ),
  );

  const body = await (await workersAIFetch("https://example.com")).text();

  expect(body).toBe(`data: {"choices":[{"delta":{"content":"pong"}}]}\r\n\r\ndata: [DONE]\n\n`);
});

test("createWorkersAIFetch passes other responses through unchanged", async () => {
  const original = Response.json({ response: "pong", tool_calls: [] });
  const workersAIFetch = createWorkersAIFetch(async () => original);

  expect(await workersAIFetch("https://example.com")).toBe(original);
});
