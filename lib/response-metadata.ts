import type { UIMessage } from "ai";
import * as v from "valibot";

const responseMetadataSchema = v.object({
  /** Seconds each reasoning segment took, in the order the segments appear. */
  reasoningSeconds: v.optional(v.array(v.nullable(v.number()))),
  /** Tokens occupied by the final inference step, as reported by the model. */
  usage: v.optional(v.object({ inputTokens: v.number(), outputTokens: v.number() })),
  /** The context window of the model that produced the response. */
  contextWindow: v.optional(v.number()),
});

/** Metadata the chat route attaches to each response; stored with the message. */
export type ResponseMetadata = v.InferOutput<typeof responseMetadataSchema>;

/** Reads response metadata, ignoring anything older or malformed in stored history. */
export const getResponseMetadata = (message: UIMessage): ResponseMetadata | undefined => {
  const parsed = v.safeParse(responseMetadataSchema, message.metadata);
  return parsed.success ? parsed.output : undefined;
};
