import type { UIMessage } from "ai";
import * as v from "valibot";
import type { Citation } from "@/lib/response-metadata";

export const AI_SEARCH_TIMEOUT_MS = 15_000;
export const AI_SEARCH_MAX_RESULTS = 5;
export const AI_SEARCH_MAX_CONTEXT_CHARS = 12_000;
export const AI_SEARCH_EXCERPT_CHARS = 200;
const AI_SEARCH_MAX_QUERY_MESSAGES = 6;
const AI_SEARCH_MAX_MESSAGE_CHARS = 2_000;

const INSTANCE_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;

export interface KnowledgeBaseInstance {
  id: string;
  name: string;
}

export class KnowledgeBaseError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "KnowledgeBaseError";
    this.status = status;
  }
}

const aiSearchChunkSchema = v.object({
  id: v.optional(v.string()),
  score: v.optional(v.number()),
  text: v.optional(v.string()),
  filename: v.optional(v.string()),
  item: v.optional(
    v.object({
      key: v.optional(v.string()),
    }),
  ),
});

const aiSearchResponseSchema = v.object({
  success: v.literal(true),
  result: v.object({
    chunks: v.optional(v.array(aiSearchChunkSchema)),
  }),
});

/** Parses `id` or `id:Display Name` allowlist entries from `CF_AI_SEARCH_INSTANCES`. */
export const parseAiSearchInstances = (raw?: string): KnowledgeBaseInstance[] => {
  if (!raw) {
    return [];
  }

  const seen = new Set<string>();
  const instances: KnowledgeBaseInstance[] = [];

  for (const entry of raw.split(",")) {
    const trimmed = entry.trim();
    if (!trimmed) {
      continue;
    }

    const colonIndex = trimmed.indexOf(":");
    const id = (colonIndex === -1 ? trimmed : trimmed.slice(0, colonIndex)).trim();
    const rawName = colonIndex === -1 ? id : trimmed.slice(colonIndex + 1).trim();
    if (!INSTANCE_ID_PATTERN.test(id) || seen.has(id)) {
      continue;
    }

    seen.add(id);
    instances.push({ id, name: rawName || id });
  }

  return instances;
};

export interface AiSearchEnv {
  accountId?: string;
  apiToken?: string;
  instancesRaw?: string;
  namespace?: string;
  rewriteQuery?: boolean;
  fetchImpl?: typeof fetch;
}

export const getConfiguredKnowledgeBases = (env?: AiSearchEnv): KnowledgeBaseInstance[] => {
  const accountId = env?.accountId ?? process.env.CF_ACCOUNT_ID;
  const apiToken = env?.apiToken ?? process.env.CF_AI_SEARCH_TOKEN;
  const instancesRaw = env?.instancesRaw ?? process.env.CF_AI_SEARCH_INSTANCES;
  if (!accountId || !apiToken) {
    return [];
  }
  return parseAiSearchInstances(instancesRaw);
};

/** Extracts only recent plain-text user/assistant turns for retrieval, omitting images and attachments. */
export const extractPlainTextSearchMessages = (
  messages: UIMessage[],
  maxMessages = AI_SEARCH_MAX_QUERY_MESSAGES,
): Array<{ role: "user" | "assistant"; content: string }> => {
  const result: Array<{ role: "user" | "assistant"; content: string }> = [];

  for (const message of messages.slice(-maxMessages)) {
    if (message.role !== "user" && message.role !== "assistant") {
      continue;
    }

    const text = message.parts
      .filter((part): part is { type: "text"; text: string } => part.type === "text")
      .map((part) => part.text.trim())
      .filter(Boolean)
      .join("\n")
      .slice(0, AI_SEARCH_MAX_MESSAGE_CHARS);

    if (text) {
      result.push({ role: message.role, content: text });
    }
  }

  return result;
};

const toExcerpt = (text: string): string => {
  const compact = text.replaceAll(/\s+/g, " ").trim();
  if (compact.length <= AI_SEARCH_EXCERPT_CHARS) {
    return compact;
  }
  return `${compact.slice(0, AI_SEARCH_EXCERPT_CHARS - 1).trimEnd()}…`;
};

const formatKnowledgeBaseContext = <
  T extends { id: string; source: string; score?: number; text: string },
>(
  chunks: T[],
): { contextText: string; includedChunks: T[] } => {
  if (chunks.length === 0) {
    return { contextText: "", includedChunks: [] };
  }

  const lines: string[] = [
    "Knowledge Base excerpts for this turn (cite source keys when relevant; do not invent facts beyond these excerpts or the conversation):",
  ];
  let usedChars = lines[0].length;
  const includedChunks: T[] = [];

  for (const chunk of chunks) {
    const scoreAttr = typeof chunk.score === "number" ? ` score="${chunk.score.toFixed(3)}"` : "";
    const header = `<kb_excerpt source="${chunk.source.replaceAll('"', "&quot;")}"${scoreAttr}>`;
    const footer = "</kb_excerpt>";
    const remaining = AI_SEARCH_MAX_CONTEXT_CHARS - usedChars - header.length - footer.length - 4;
    if (remaining <= 40) {
      break;
    }

    const body = chunk.text.slice(0, remaining).trimEnd();
    const block = `${header}\n${body}\n${footer}`;
    lines.push(block);
    includedChunks.push(chunk);
    usedChars += block.length + 1;
  }

  return {
    contextText: lines.length > 1 ? lines.join("\n") : "",
    includedChunks,
  };
};

export interface KnowledgeBaseSearchResult {
  contextText: string;
  citations: Citation[];
}

export const searchKnowledgeBase = async (
  input: { instanceId: string; messages: UIMessage[] },
  env?: AiSearchEnv,
): Promise<KnowledgeBaseSearchResult> => {
  const allowedInstances = getConfiguredKnowledgeBases(env);
  if (allowedInstances.length === 0) {
    throw new KnowledgeBaseError("Knowledge Base search is not configured on the server.", 503);
  }

  const instance = allowedInstances.find((entry) => entry.id === input.instanceId);
  if (!instance) {
    throw new KnowledgeBaseError(
      "The selected Knowledge Base instance is not permitted on this deployment.",
      403,
    );
  }

  const searchMessages = extractPlainTextSearchMessages(input.messages);
  if (searchMessages.length === 0) {
    return { contextText: "", citations: [] };
  }

  const accountId = env?.accountId ?? process.env.CF_ACCOUNT_ID!;
  const apiToken = env?.apiToken ?? process.env.CF_AI_SEARCH_TOKEN!;
  const namespace = (env?.namespace ?? process.env.CF_AI_SEARCH_NAMESPACE)?.trim() || "default";
  const rewriteQuery =
    env?.rewriteQuery ?? process.env.CF_AI_SEARCH_REWRITE_QUERY?.trim().toLowerCase() === "true";
  const fetchImpl = env?.fetchImpl ?? fetch;

  let response: Response;
  try {
    response = await fetchImpl(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai-search/namespaces/${encodeURIComponent(namespace)}/instances/${encodeURIComponent(instance.id)}/search`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: searchMessages,
          ai_search_options: {
            retrieval: {
              max_num_results: AI_SEARCH_MAX_RESULTS,
              rewrite_query: rewriteQuery,
            },
          },
        }),
        signal: AbortSignal.timeout(AI_SEARCH_TIMEOUT_MS),
      },
    );
  } catch {
    throw new KnowledgeBaseError("Knowledge Base search service is unavailable.", 502);
  }

  if (response.status === 429) {
    throw new KnowledgeBaseError(
      "Knowledge Base monthly query quota or rate limit reached. Disable Knowledge Base or try again later.",
      429,
    );
  }

  if (response.status === 404) {
    throw new KnowledgeBaseError(
      `Knowledge Base instance "${instance.name}" could not be found in Cloudflare AI Search.`,
      502,
    );
  }

  if (!response.ok) {
    throw new KnowledgeBaseError("Knowledge Base search failed. Please try again.", 502);
  }

  const parsed = v.safeParse(aiSearchResponseSchema, await response.json().catch(() => null));
  if (!parsed.success) {
    throw new KnowledgeBaseError("Knowledge Base search returned an invalid response.", 502);
  }

  const chunks = (parsed.output.result.chunks ?? [])
    .map((chunk, index) => ({
      id: chunk.id ?? `${instance.id}-${index}`,
      source: chunk.item?.key?.trim() || chunk.filename?.trim() || `Result ${index + 1}`,
      score: chunk.score,
      text: chunk.text?.trim() ?? "",
    }))
    .filter((chunk) => chunk.text.length > 0);

  const { contextText, includedChunks } = formatKnowledgeBaseContext(chunks);
  const citations: Citation[] = includedChunks.map((chunk) => ({
    id: chunk.id,
    source: chunk.source,
    ...(typeof chunk.score === "number" ? { score: chunk.score } : {}),
    excerpt: toExcerpt(chunk.text),
  }));

  return {
    contextText,
    citations,
  };
};
