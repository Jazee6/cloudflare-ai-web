import type { UIMessage } from "ai";
import * as v from "valibot";

export const citationSchema = v.object({
  id: v.string(),
  source: v.string(),
  score: v.optional(v.number()),
  excerpt: v.string(),
});

const responseMetadataSchema = v.object({
  /** The display name of the model that produced the response. */
  modelName: v.optional(v.string()),
  /** Seconds each reasoning segment took, in the order the segments appear. */
  reasoningSeconds: v.optional(v.array(v.nullable(v.number()))),
  /** Tokens occupied by the final inference step, as reported by the model. */
  usage: v.optional(v.object({ inputTokens: v.number(), outputTokens: v.number() })),
  /** The context window of the model that produced the response. */
  contextWindow: v.optional(v.number()),
  /** Cloudflare AI Gateway response metadata (cache status, DLP action). */
  gateway: v.optional(
    v.object({
      cacheStatus: v.optional(v.picklist(["HIT", "MISS"])),
      dlpAction: v.optional(v.string()),
    }),
  ),
  /** Lightweight Knowledge Base citations persisted with the assistant response. */
  citations: v.optional(v.array(citationSchema)),
});

/** Metadata the chat route attaches to each response; stored with the message. */
export type Citation = v.InferOutput<typeof citationSchema>;
export type ResponseMetadata = v.InferOutput<typeof responseMetadataSchema>;
export type GatewayMetadata = NonNullable<ResponseMetadata["gateway"]>;

/** Reads response metadata, ignoring anything older or malformed in stored history. */
export const getResponseMetadata = (message: UIMessage): ResponseMetadata | undefined => {
  const parsed = v.safeParse(responseMetadataSchema, message.metadata);
  return parsed.success ? parsed.output : undefined;
};
