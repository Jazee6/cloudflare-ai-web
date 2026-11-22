import { expect, mock, test } from "bun:test";
import { extractWebpageAttachment, isLikelySpaShell } from "@/lib/context-url";

const publicLookup = async () => [{ address: "93.184.216.34", family: 4 }];

test("isLikelySpaShell distinguishes static content from empty JS app shells", () => {
  expect(
    isLikelySpaShell(
      `<html><body><div id="root"></div><script src="/app.js"></script></body></html>`,
    ),
  ).toBe(true);

  expect(
    isLikelySpaShell(
      `<html><body><main><h1>Guide</h1><p>${"Documentation paragraph ".repeat(10)}</p></main></body></html>`,
    ),
  ).toBe(false);
});

test("Tier 1 uses Markdown for Agents directly with zero extra calls", async () => {
  let callCount = 0;
  const fetchMock = mock(async () => {
    callCount++;
    return new Response("# Cloudflare Docs\n\nDirect markdown payload.", {
      status: 200,
      headers: { "content-type": "text/markdown; charset=utf-8" },
    });
  }) as unknown as typeof fetch;

  const attachment = await extractWebpageAttachment(
    { url: "https://example.com/docs" },
    { fetchImpl: fetchMock, lookup: publicLookup },
  );

  expect(callCount).toBe(1);
  expect(attachment).toMatchObject({
    kind: "webpage",
    title: "Cloudflare Docs",
    method: "markdown-for-agents",
    content: "# Cloudflare Docs\n\nDirect markdown payload.",
  });
});

test("Tier 2 converts static HTML using Workers AI toMarkdown", async () => {
  const html = `<html><head><title>Static Page</title></head><body><article>${"Readable content sentence. ".repeat(10)}</article></body></html>`;
  const calls: string[] = [];

  const convertedMarkdown = `# Static Page\n\n${"Converted markdown content sentence. ".repeat(4).trim()}`;

  const fetchMock = mock(async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    if (url.includes("/ai/tomarkdown")) {
      return Response.json({
        success: true,
        result: [{ data: convertedMarkdown }],
      });
    }
    return new Response(html, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }) as unknown as typeof fetch;

  const attachment = await extractWebpageAttachment(
    { url: "https://example.com/article" },
    {
      accountId: "acc",
      workersAiToken: "ai-tok",
      browserRunToken: "br-tok",
      fetchImpl: fetchMock,
      lookup: publicLookup,
    },
  );

  expect(calls).toEqual([
    "https://example.com/article",
    "https://api.cloudflare.com/client/v4/accounts/acc/ai/tomarkdown",
  ]);
  expect(attachment).toMatchObject({
    title: "Static Page",
    method: "to-markdown",
    content: convertedMarkdown,
  });
});

test("Tier 3 falls back to Browser Run for SPA shells and enforces zero-quota mode", async () => {
  const spaHtml = `<html><head><title>SPA</title></head><body><div id="root"></div><noscript>Please enable JavaScript</noscript></body></html>`;
  const fetchMock = mock(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/browser-run/markdown")) {
      return Response.json({
        success: true,
        result: "# Rendered App\n\nDynamic content.",
      });
    }
    return new Response(spaHtml, {
      status: 200,
      headers: { "content-type": "text/html" },
    });
  }) as unknown as typeof fetch;

  await expect(
    extractWebpageAttachment(
      { url: "https://example.com/app", mode: "zero-quota" },
      {
        accountId: "acc",
        workersAiToken: "ai-tok",
        browserRunToken: "br-tok",
        fetchImpl: fetchMock,
        lookup: publicLookup,
      },
    ),
  ).rejects.toMatchObject({ status: 422 });

  const rendered = await extractWebpageAttachment(
    { url: "https://example.com/app", mode: "auto" },
    {
      accountId: "acc",
      workersAiToken: "ai-tok",
      browserRunToken: "br-tok",
      fetchImpl: fetchMock,
      lookup: publicLookup,
    },
  );
  expect(rendered).toMatchObject({
    title: "Rendered App",
    method: "browser-run",
    content: "# Rendered App\n\nDynamic content.",
  });
});

test("Browser Run 429 is never retried and returns 429", async () => {
  let browserCalls = 0;
  const fetchMock = mock(async (input: RequestInfo | URL) => {
    if (String(input).includes("/browser-run/markdown")) {
      browserCalls++;
      return new Response("Too many requests", { status: 429 });
    }
    return new Response(`<html><body><div id="root"></div></body></html>`, {
      status: 200,
      headers: { "content-type": "text/html" },
    });
  }) as unknown as typeof fetch;

  await expect(
    extractWebpageAttachment(
      { url: "https://example.com/spa" },
      {
        accountId: "acc",
        browserRunToken: "br-tok",
        fetchImpl: fetchMock,
        lookup: publicLookup,
      },
    ),
  ).rejects.toMatchObject({ status: 429 });
  expect(browserCalls).toBe(1);
});

test("extractWebpageAttachment rejects private URLs before calling Browser Run", async () => {
  const fetchSpy = mock(async () => new Response("unexpected")) as unknown as typeof fetch;

  await expect(
    extractWebpageAttachment(
      { url: "http://169.254.169.254/latest/meta-data/", mode: "browser" },
      { accountId: "acc", browserRunToken: "br-tok", fetchImpl: fetchSpy },
    ),
  ).rejects.toMatchObject({ status: 403 });
  expect(fetchSpy).not.toHaveBeenCalled();
});
