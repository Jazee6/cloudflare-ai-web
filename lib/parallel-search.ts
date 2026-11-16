import { createMCPClient } from "@ai-sdk/mcp";
import { tool } from "ai";
import { z } from "zod";

const SEARCH_URL = "https://search.parallel.ai/mcp";
const REQUEST_TIMEOUT_MS = 10_000;

const httpUrl = z.url().refine((value) => ["http:", "https:"].includes(new URL(value).protocol), {
  message: "Use an HTTP or HTTPS URL",
});

/** The conversation owns this ID; a transport connection never creates or changes it. */
export const createParallelSearchTools = (conversationId: string, modelId: string) => {
  const call = async (
    name: "web_search" | "web_fetch",
    args: Record<string, unknown>,
    abortSignal?: AbortSignal,
  ) => {
    const signal = AbortSignal.any([
      AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      ...(abortSignal ? [abortSignal] : []),
    ]);
    // Keep connections local to a tool invocation so streaming errors and cancellation
    // cannot leave a shared client holding another conversation's context.
    const client = await createMCPClient({
      clientName: "cloudflare-ai-web",
      version: "5.2.0",
      protocolVersionDiscovery: false,
      initializationOptions: { signal, timeout: REQUEST_TIMEOUT_MS },
      transport: {
        type: "http",
        url: SEARCH_URL,
        headers: { "User-Agent": "cloudflare-ai-web/5.2.0" },
        fetch: ((input, init) => {
          const headers = new Headers(init?.headers);
          headers.set("User-Agent", "cloudflare-ai-web/5.2.0");
          return fetch(input, {
            ...init,
            headers,
            signal: AbortSignal.any([signal, ...(init?.signal ? [init.signal] : [])]),
          });
        }) as typeof fetch,
      },
    });

    try {
      const options = { signal, timeout: REQUEST_TIMEOUT_MS };
      const discovered = await client.listTools({ options });
      if (!discovered.tools.some((candidate) => candidate.name === name)) {
        throw new Error(`Parallel Search MCP does not expose ${name}.`);
      }
      const result = await client.callTool({
        name,
        arguments: {
          ...args,
          session_id: conversationId,
          ...(modelId.length <= 100 ? { model_name: modelId } : {}),
        },
        options,
      });
      if (result.isError) {
        throw new Error("Parallel Search MCP could not complete the request.");
      }
      return result;
    } finally {
      await client.close().catch(() => {});
    }
  };

  return {
    web_search: tool({
      description:
        "Search the web for current information. Use focused objectives and related keyword queries, then cite source URLs in your answer.",
      inputSchema: z.object({
        objective: z.string().min(1),
        search_queries: z.array(z.string().min(1)).min(1),
      }),
      execute: (args, { abortSignal }) => call("web_search", args, abortSignal),
    }),
    web_fetch: tool({
      description:
        "Read HTTP or HTTPS pages for relevant source excerpts. When following search results, reuse the search queries.",
      inputSchema: z.object({
        urls: z.array(httpUrl).min(1).max(20),
        objective: z.string().max(200).optional(),
        search_queries: z.array(z.string().min(1)).optional(),
        full_content: z.boolean().optional(),
      }),
      execute: (args, { abortSignal }) => call("web_fetch", args, abortSignal),
    }),
  };
};
