import { expect, mock, test } from "bun:test";
import type { UIMessage } from "ai";
import {
  AI_SEARCH_MAX_CONTEXT_CHARS,
  extractPlainTextSearchMessages,
  getConfiguredKnowledgeBases,
  parseAiSearchInstances,
  searchKnowledgeBase,
} from "@/lib/ai-search";
import { createContextAttachmentPart } from "@/lib/context-attachments";

test("parseAiSearchInstances parses IDs, aliases, and rejects invalid entries", () => {
  expect(
    parseAiSearchInstances("product-docs:产品文档, team-handbook, bad id!, product-docs:dup"),
  ).toEqual([
    { id: "product-docs", name: "产品文档" },
    { id: "team-handbook", name: "team-handbook" },
  ]);
});

test("getConfiguredKnowledgeBases stays disabled without explicit allowlist", () => {
  expect(
    getConfiguredKnowledgeBases({
      accountId: "acc",
      apiToken: "tok",
      instancesRaw: " , ",
    }),
  ).toEqual([]);
});

test("extractPlainTextSearchMessages strips images and context attachments", () => {
  const messages: UIMessage[] = [
    {
      id: "m1",
      role: "user",
      parts: [
        { type: "file", mediaType: "image/png", url: "data:image/png;base64,AA==" },
        createContextAttachmentPart({
          id: "att-1",
          kind: "document",
          title: "spec.md",
          mediaType: "text/markdown",
          method: "plain-text",
          content: "Large document content that should not go to AI Search query",
          originalChars: 60,
          truncated: false,
        }),
        { type: "text", text: "How does authentication work?" },
      ],
    },
  ];

  expect(extractPlainTextSearchMessages(messages)).toEqual([
    { role: "user", content: "How does authentication work?" },
  ]);
});

test("searchKnowledgeBase enforces allowlist, caps ephemeral context, and extracts lightweight citations", async () => {
  let capturedBody: Record<string, unknown> | undefined;
  const fetchMock = mock(async (_input: RequestInfo | URL, init?: RequestInit) => {
    capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return Response.json({
      success: true,
      result: {
        chunks: [
          {
            id: "chunk-1",
            score: 0.91,
            item: { key: "guides/auth.md" },
            text: "A".repeat(7_000),
          },
          {
            id: "chunk-2",
            score: 0.85,
            item: { key: "guides/gateway.md" },
            text: "B".repeat(7_000),
          },
        ],
      },
    });
  }) as unknown as typeof fetch;

  await expect(
    searchKnowledgeBase(
      {
        instanceId: "secret-internal",
        messages: [{ id: "1", role: "user", parts: [{ type: "text", text: "hello" }] }],
      },
      { accountId: "acc", apiToken: "tok", instancesRaw: "public-docs" },
    ),
  ).rejects.toMatchObject({ status: 403 });

  const result = await searchKnowledgeBase(
    {
      instanceId: "public-docs",
      messages: [{ id: "1", role: "user", parts: [{ type: "text", text: "Explain auth" }] }],
    },
    {
      accountId: "acc",
      apiToken: "tok",
      instancesRaw: "public-docs:Public Docs",
      fetchImpl: fetchMock,
    },
  );

  expect(capturedBody?.ai_search_options).toEqual({
    retrieval: {
      max_num_results: 5,
      rewrite_query: false,
    },
  });
  expect(result.contextText.length).toBeLessThanOrEqual(AI_SEARCH_MAX_CONTEXT_CHARS);
  expect(result.citations).toHaveLength(2);
  expect(result.citations[0]).toMatchObject({
    id: "chunk-1",
    source: "guides/auth.md",
    score: 0.91,
  });
  expect(result.citations[0].excerpt.length).toBeLessThanOrEqual(200);
});

test("searchKnowledgeBase surfaces 429 and 404 failures instead of silently skipping", async () => {
  const rateLimited = mock(
    async () => new Response("limit", { status: 429 }),
  ) as unknown as typeof fetch;
  await expect(
    searchKnowledgeBase(
      {
        instanceId: "docs",
        messages: [{ id: "1", role: "user", parts: [{ type: "text", text: "hi" }] }],
      },
      { accountId: "acc", apiToken: "tok", instancesRaw: "docs", fetchImpl: rateLimited },
    ),
  ).rejects.toMatchObject({ status: 429 });

  const missing = mock(
    async () => new Response("not found", { status: 404 }),
  ) as unknown as typeof fetch;
  await expect(
    searchKnowledgeBase(
      {
        instanceId: "docs",
        messages: [{ id: "1", role: "user", parts: [{ type: "text", text: "hi" }] }],
      },
      { accountId: "acc", apiToken: "tok", instancesRaw: "docs", fetchImpl: missing },
    ),
  ).rejects.toMatchObject({ status: 502 });
});

test("searchKnowledgeBase omits citations for chunks dropped by the 12,000-char context cap", async () => {
  const fetchMock = mock(async () =>
    Response.json({
      success: true,
      result: {
        chunks: [
          {
            id: "chunk-1",
            score: 0.95,
            item: { key: "included-1.md" },
            text: "A".repeat(7_000),
          },
          {
            id: "chunk-2",
            score: 0.9,
            item: { key: "included-2.md" },
            text: "B".repeat(7_000),
          },
          {
            id: "chunk-3",
            score: 0.85,
            item: { key: "dropped-3.md" },
            text: "C".repeat(500),
          },
        ],
      },
    }),
  ) as unknown as typeof fetch;

  const result = await searchKnowledgeBase(
    {
      instanceId: "docs",
      messages: [{ id: "1", role: "user", parts: [{ type: "text", text: "hi" }] }],
    },
    { accountId: "acc", apiToken: "tok", instancesRaw: "docs", fetchImpl: fetchMock },
  );

  expect(result.citations.map((citation) => citation.id)).toEqual(["chunk-1", "chunk-2"]);
  expect(result.contextText).not.toContain("dropped-3.md");
});
