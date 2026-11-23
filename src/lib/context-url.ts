import { type AppError, appError, type ErrorCode, type ErrorParams } from "@/lib/error-codes";
import * as v from "valibot";
import { type ContextAttachmentData, truncateAttachmentContent } from "@/lib/context-attachments";
import { ContextDocumentError, convertToMarkdownWithWorkersAi } from "@/lib/context-document";
import { assertSafePublicUrl, type DnsLookupFn, safeFetchUrl } from "@/lib/ssrf";

const BROWSER_RUN_TIMEOUT_MS = 30_000;
const MIN_STATIC_TEXT_CHARS = 80;

export type WebFetchMode = "auto" | "zero-quota" | "browser";

export class ContextUrlError extends Error {
  readonly status: number;
  readonly code?: ErrorCode;
  readonly params?: ErrorParams;

  constructor(error: string | AppError, status: number) {
    const detail = typeof error === "string" ? { message: error } : error;
    super(detail.message);
    this.code = detail.code;
    this.params = detail.params;
    this.name = "ContextUrlError";
    this.status = status;
  }
}

const browserRunResponseSchema = v.object({
  success: v.literal(true),
  result: v.union([
    v.string(),
    v.object({
      markdown: v.string(),
    }),
  ]),
});

const decodeEntities = (value: string): string =>
  value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll(/\s+/g, " ")
    .trim();

export const extractHtmlTitle = (html: string): string | undefined => {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const title = match ? decodeEntities(match[1]) : "";
  return title ? title.slice(0, 200) : undefined;
};

export const extractMarkdownTitle = (markdown: string): string | undefined => {
  const match = /^#\s+(.+)$/m.exec(markdown);
  const title = match?.[1]?.trim();
  return title ? title.slice(0, 200) : undefined;
};

const stripHtmlVisibleText = (html: string): string =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<template[\s\S]*?<\/template>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();

/** Detects empty client-rendered SPA shells and JS challenge pages so only those use Browser Run. */
export const isLikelySpaShell = (html: string): boolean => {
  const visibleText = stripHtmlVisibleText(html);
  if (visibleText.length < MIN_STATIC_TEXT_CHARS) {
    return true;
  }

  if (visibleText.length < 200) {
    const hasSpaRoot = /<div\s+id=["'](?:root|app|__next|__nuxt)["'][^>]*>\s*<\/div>/i.test(html);
    const hasJsRequiredHint =
      /enable javascript|javascript is required|you need to enable javascript|just a moment/i.test(
        visibleText,
      );
    return hasSpaRoot || hasJsRequiredHint;
  }

  return false;
};

export interface WebpageExtractDeps {
  accountId?: string;
  workersAiToken?: string;
  browserRunToken?: string;
  fetchImpl?: typeof fetch;
  lookup?: DnsLookupFn;
}

const fetchMarkdownWithBrowserRun = async (
  targetUrl: string,
  deps?: WebpageExtractDeps,
): Promise<string> => {
  const accountId = deps?.accountId ?? process.env.CF_ACCOUNT_ID;
  const browserRunToken = deps?.browserRunToken ?? process.env.CF_BROWSER_RUN_TOKEN;
  if (!accountId || !browserRunToken) {
    throw new ContextUrlError(appError("browserRunNotConfigured"), 503);
  }

  const fetchImpl = deps?.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/browser-run/markdown`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${browserRunToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: targetUrl }),
        signal: AbortSignal.timeout(BROWSER_RUN_TIMEOUT_MS),
      },
    );
  } catch {
    throw new ContextUrlError(appError("browserRunUnavailable"), 502);
  }

  // Never retry on 429 to protect the Free plan 10 min/day and 1 req/10s budget.
  if (response.status === 429) {
    throw new ContextUrlError(appError("browserRunRateLimited"), 429);
  }

  if (!response.ok) {
    throw new ContextUrlError(appError("browserRunRenderFailed"), 502);
  }

  const parsed = v.safeParse(browserRunResponseSchema, await response.json().catch(() => null));
  if (!parsed.success) {
    throw new ContextUrlError(appError("browserRunInvalid"), 502);
  }

  return typeof parsed.output.result === "string"
    ? parsed.output.result
    : parsed.output.result.markdown;
};

const buildWebpageAttachment = (input: {
  title: string;
  sourceUrl: string;
  mediaType: string;
  method: ContextAttachmentData["method"];
  markdown: string;
}): ContextAttachmentData => {
  const truncated = truncateAttachmentContent(input.markdown);
  if (!truncated.content) {
    throw new ContextUrlError(appError("noReadableWebpage"), 422);
  }

  return {
    id: crypto.randomUUID(),
    kind: "webpage",
    title: input.title,
    sourceUrl: input.sourceUrl,
    mediaType: input.mediaType,
    method: input.method,
    content: truncated.content,
    originalChars: truncated.originalChars,
    truncated: truncated.truncated,
  };
};

/**
 * Extracts webpage content using a three-tier zero-quota-first fallback:
 * Tier 1: Markdown for Agents (`Accept: text/markdown`)
 * Tier 2: Workers AI `toMarkdown` on static HTML (0 Neurons)
 * Tier 3: Cloudflare Browser Run `/markdown` (only when needed and permitted)
 */
export const extractWebpageAttachment = async (
  input: { url: string; mode?: WebFetchMode },
  deps?: WebpageExtractDeps,
): Promise<ContextAttachmentData> => {
  const mode = input.mode ?? "auto";
  const safeUrl = (await assertSafePublicUrl(input.url, { lookup: deps?.lookup })).toString();
  const hasBrowserRun = Boolean(
    (deps?.accountId ?? process.env.CF_ACCOUNT_ID) &&
    (deps?.browserRunToken ?? process.env.CF_BROWSER_RUN_TOKEN),
  );

  if (mode === "browser") {
    const markdown = await fetchMarkdownWithBrowserRun(safeUrl, deps);
    return buildWebpageAttachment({
      title: extractMarkdownTitle(markdown) ?? new URL(safeUrl).hostname,
      sourceUrl: safeUrl,
      mediaType: "text/markdown",
      method: "browser-run",
      markdown,
    });
  }

  const direct = await safeFetchUrl(safeUrl, {
    headers: {
      Accept: "text/markdown, text/html;q=0.9, text/plain;q=0.8",
    },
    fetchImpl: deps?.fetchImpl,
    lookup: deps?.lookup,
  });

  if (direct.status >= 400) {
    if ((direct.status === 403 || direct.status === 503) && mode === "auto" && hasBrowserRun) {
      const markdown = await fetchMarkdownWithBrowserRun(direct.finalUrl, deps);
      return buildWebpageAttachment({
        title: extractMarkdownTitle(markdown) ?? new URL(direct.finalUrl).hostname,
        sourceUrl: direct.finalUrl,
        mediaType: "text/markdown",
        method: "browser-run",
        markdown,
      });
    }
    throw new ContextUrlError(appError("webpageHttpStatus", { status: direct.status }), 502);
  }

  if (direct.contentType === "text/markdown") {
    const markdown = new TextDecoder().decode(direct.bytes);
    return buildWebpageAttachment({
      title: extractMarkdownTitle(markdown) ?? new URL(direct.finalUrl).hostname,
      sourceUrl: direct.finalUrl,
      mediaType: "text/markdown",
      method: "markdown-for-agents",
      markdown,
    });
  }

  if (direct.contentType === "text/plain") {
    const text = new TextDecoder().decode(direct.bytes);
    return buildWebpageAttachment({
      title: new URL(direct.finalUrl).hostname,
      sourceUrl: direct.finalUrl,
      mediaType: "text/plain",
      method: "plain-text",
      markdown: text,
    });
  }

  if (
    direct.contentType !== "text/html" &&
    direct.contentType !== "application/xhtml+xml" &&
    direct.contentType !== ""
  ) {
    throw new ContextUrlError(
      appError("unsupportedWebpageType", { type: direct.contentType }),
      415,
    );
  }

  const html = new TextDecoder().decode(direct.bytes);
  const title = extractHtmlTitle(html) ?? new URL(direct.finalUrl).hostname;
  const spaShell = isLikelySpaShell(html);

  let toMarkdownError: unknown;
  if (!spaShell) {
    try {
      const markdown = await convertToMarkdownWithWorkersAi(
        { bytes: direct.bytes, filename: "page.html", mediaType: "text/html" },
        {
          accountId: deps?.accountId,
          apiToken: deps?.workersAiToken,
          fetchImpl: deps?.fetchImpl,
        },
      );
      if (
        markdown.trim().length >= MIN_STATIC_TEXT_CHARS ||
        mode === "zero-quota" ||
        !hasBrowserRun
      ) {
        return buildWebpageAttachment({
          title,
          sourceUrl: direct.finalUrl,
          mediaType: "text/html",
          method: "to-markdown",
          markdown,
        });
      }
    } catch (error) {
      if (error instanceof ContextDocumentError && error.status === 429) {
        throw new ContextUrlError(error, 429);
      }
      toMarkdownError = error;
    }
  }

  if (mode === "auto" && hasBrowserRun) {
    const markdown = await fetchMarkdownWithBrowserRun(direct.finalUrl, deps);
    return buildWebpageAttachment({
      title: extractMarkdownTitle(markdown) ?? title,
      sourceUrl: direct.finalUrl,
      mediaType: "text/markdown",
      method: "browser-run",
      markdown,
    });
  }

  const fallbackText = stripHtmlVisibleText(html);
  if (!spaShell && fallbackText.length >= MIN_STATIC_TEXT_CHARS) {
    return buildWebpageAttachment({
      title,
      sourceUrl: direct.finalUrl,
      mediaType: "text/html",
      method: "plain-text",
      markdown: fallbackText,
    });
  }

  if (toMarkdownError instanceof ContextDocumentError) {
    throw new ContextUrlError(toMarkdownError, toMarkdownError.status);
  }
  if (toMarkdownError instanceof Error && toMarkdownError.name !== "ContextDocumentError") {
    throw toMarkdownError;
  }

  throw new ContextUrlError(
    mode === "zero-quota"
      ? appError("dynamicRenderingZeroQuota")
      : appError("dynamicRenderingUnavailable"),
    422,
  );
};
