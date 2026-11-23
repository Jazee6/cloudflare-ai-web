import { appError, type ErrorCode, type ErrorParams } from "@/lib/error-codes";
import type { UIMessage } from "ai";
import * as v from "valibot";

export const CONTEXT_ATTACHMENT_PART_TYPE = "data-context-attachment" as const;
export const MAX_CONTEXT_ATTACHMENT_CHARS = 24_000;
export const MAX_CONTEXT_ATTACHMENTS_PER_MESSAGE = 4;
export const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024;

export const contextAttachmentMethodSchema = v.picklist([
  "plain-text",
  "to-markdown",
  "markdown-for-agents",
  "browser-run",
]);

const isHttpUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

export const contextAttachmentDataSchema = v.object({
  id: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  kind: v.picklist(["document", "webpage"]),
  title: v.pipe(v.string(), v.minLength(1), v.maxLength(512)),
  sourceUrl: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(2048), v.check(isHttpUrl))),
  mediaType: v.pipe(v.string(), v.minLength(1), v.maxLength(256)),
  method: contextAttachmentMethodSchema,
  content: v.string(),
  originalChars: v.pipe(v.number(), v.integer(), v.minValue(0)),
  truncated: v.boolean(),
});

export type ContextAttachmentMethod = v.InferOutput<typeof contextAttachmentMethodSchema>;
export type ContextAttachmentData = v.InferOutput<typeof contextAttachmentDataSchema>;

export interface ContextAttachmentPart {
  type: typeof CONTEXT_ATTACHMENT_PART_TYPE;
  data: ContextAttachmentData;
}

/** Normalizes line endings and truncates attachment text gracefully on paragraph/line boundaries. */
export const truncateAttachmentContent = (
  raw: string,
  maxChars = MAX_CONTEXT_ATTACHMENT_CHARS,
): { content: string; originalChars: number; truncated: boolean } => {
  const normalized = raw.replaceAll("\r\n", "\n").trim();
  const originalChars = normalized.length;
  if (originalChars <= maxChars) {
    return { content: normalized, originalChars, truncated: false };
  }

  const minSplit = Math.floor(maxChars * 0.7);
  const window = normalized.slice(0, maxChars);
  let cutIndex = window.lastIndexOf("\n\n");
  if (cutIndex < minSplit) {
    cutIndex = window.lastIndexOf("\n");
  }
  if (cutIndex < minSplit) {
    cutIndex = window.lastIndexOf(" ");
  }
  if (cutIndex < minSplit) {
    cutIndex = maxChars;
  }

  return {
    content: normalized.slice(0, cutIndex).trimEnd(),
    originalChars,
    truncated: true,
  };
};

export const createContextAttachmentPart = (
  data: ContextAttachmentData,
): ContextAttachmentPart => ({
  type: CONTEXT_ATTACHMENT_PART_TYPE,
  data,
});

export const isContextAttachmentPart = (
  part: UIMessage["parts"][number],
): part is ContextAttachmentPart => {
  if (part.type !== CONTEXT_ATTACHMENT_PART_TYPE || !("data" in part)) {
    return false;
  }
  return v.safeParse(contextAttachmentDataSchema, part.data).success;
};

export type ContextAttachmentValidation =
  | { ok: true }
  | { ok: false; status: 400 | 413; message: string; code?: ErrorCode; params?: ErrorParams };

export const validateContextAttachmentParts = (
  messages: UIMessage[],
): ContextAttachmentValidation => {
  for (const message of messages) {
    let attachmentCount = 0;
    for (const part of message.parts) {
      if (part.type !== CONTEXT_ATTACHMENT_PART_TYPE) {
        continue;
      }

      attachmentCount++;
      if (attachmentCount > MAX_CONTEXT_ATTACHMENTS_PER_MESSAGE) {
        return {
          ok: false,
          status: 400,
          ...appError("tooManyContextAttachments", {
            max: MAX_CONTEXT_ATTACHMENTS_PER_MESSAGE,
          }),
        };
      }

      const parsed = v.safeParse(
        contextAttachmentDataSchema,
        "data" in part ? part.data : undefined,
      );
      if (!parsed.success) {
        return { ok: false, status: 400, ...appError("invalidContextAttachment") };
      }

      if (parsed.output.content.length > MAX_CONTEXT_ATTACHMENT_CHARS) {
        return { ok: false, status: 413, ...appError("contextAttachmentTooLarge") };
      }
    }
  }

  return { ok: true };
};

const escapeAttribute = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll(/[\r\n]+/g, " ");

/** Formats a Context Attachment as a clearly delimited text block for model inference. */
export const formatContextAttachmentForModel = (attachment: ContextAttachmentData): string => {
  const attrs = [
    `kind="${attachment.kind}"`,
    `title="${escapeAttribute(attachment.title)}"`,
    ...(attachment.sourceUrl ? [`source_url="${escapeAttribute(attachment.sourceUrl)}"`] : []),
    ...(attachment.truncated
      ? [`truncated="true"`, `original_chars="${attachment.originalChars}"`]
      : []),
  ];

  return `<context_attachment ${attrs.join(" ")}>\n${attachment.content}\n</context_attachment>`;
};

export const getContextAttachmentCharLength = (attachment: ContextAttachmentData): number =>
  formatContextAttachmentForModel(attachment).length;
