import { type AppError, appError, type ErrorCode, type ErrorParams } from "@/lib/error-codes";
import {
  type ContextAttachmentData,
  MAX_DOCUMENT_BYTES,
  truncateAttachmentContent,
} from "@/lib/context-attachments";
import * as v from "valibot";

const WORKERS_AI_TO_MARKDOWN_TIMEOUT_MS = 30_000;

const BLOCKED_IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".bmp",
  ".svg",
  ".avif",
  ".heic",
  ".heif",
  ".ico",
  ".tif",
  ".tiff",
]);

const PLAIN_TEXT_EXTENSIONS = new Set([
  ".txt",
  ".md",
  ".markdown",
  ".mdx",
  ".json",
  ".jsonl",
  ".yaml",
  ".yml",
  ".toml",
  ".ini",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".go",
  ".rs",
  ".java",
  ".kt",
  ".c",
  ".h",
  ".cpp",
  ".hpp",
  ".cs",
  ".rb",
  ".php",
  ".sh",
  ".bash",
  ".zsh",
  ".sql",
  ".css",
  ".scss",
  ".less",
  ".graphql",
  ".gql",
  ".log",
  ".tsv",
]);

const PLAIN_TEXT_MIME_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/x-markdown",
  "application/json",
  "text/yaml",
  "application/x-yaml",
  "application/yaml",
  "application/toml",
  "text/javascript",
  "application/javascript",
  "text/typescript",
  "text/css",
]);

const RICH_DOCUMENT_EXTENSIONS = new Map<string, string>([
  [".pdf", "application/pdf"],
  [".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  [".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  [".xls", "application/vnd.ms-excel"],
  [".xlsm", "application/vnd.ms-excel.sheet.macroEnabled.12"],
  [".xlsb", "application/vnd.ms-excel.sheet.binary.macroEnabled.12"],
  [".xltx", "application/vnd.openxmlformats-officedocument.spreadsheetml.template"],
  [".ods", "application/vnd.oasis.opendocument.spreadsheet"],
  [".odt", "application/vnd.oasis.opendocument.text"],
  [".csv", "text/csv"],
  [".html", "text/html"],
  [".htm", "text/html"],
  [".xml", "application/xml"],
  [".numbers", "application/x-iwork-numbers-sffnumbers"],
  [".et", "application/vnd.ms-excel"],
]);

const RICH_DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.ms-excel.sheet.macroenabled.12",
  "application/vnd.ms-excel.sheet.binary.macroenabled.12",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.template",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.oasis.opendocument.text",
  "text/csv",
  "text/html",
  "application/xhtml+xml",
  "application/xml",
  "text/xml",
  "application/x-iwork-numbers-sffnumbers",
]);

export const DOCUMENT_FILE_ACCEPT = [
  ...PLAIN_TEXT_EXTENSIONS,
  ...RICH_DOCUMENT_EXTENSIONS.keys(),
].join(",");

export class ContextDocumentError extends Error {
  readonly status: number;
  readonly code?: ErrorCode;
  readonly params?: ErrorParams;

  constructor(error: string | AppError, status: number) {
    const detail = typeof error === "string" ? { message: error } : error;
    super(detail.message);
    this.code = detail.code;
    this.params = detail.params;
    this.name = "ContextDocumentError";
    this.status = status;
  }
}

const toMarkdownResponseSchema = v.object({
  success: v.literal(true),
  result: v.array(
    v.object({
      name: v.optional(v.string()),
      mimeType: v.optional(v.string()),
      format: v.optional(v.string()),
      data: v.optional(v.string()),
      error: v.optional(v.string()),
    }),
  ),
});

const getExtension = (filename: string): string => {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot).toLowerCase();
};

const normalizeMediaType = (mediaType: string): string =>
  mediaType.split(";")[0].trim().toLowerCase();

export type DocumentClassification =
  { kind: "plain-text"; mediaType: string } | { kind: "to-markdown"; mediaType: string };

export const classifyDocumentFile = (
  filename: string,
  rawMediaType: string,
): DocumentClassification => {
  const ext = getExtension(filename);
  const mediaType = normalizeMediaType(rawMediaType);

  if (mediaType.startsWith("image/") || BLOCKED_IMAGE_EXTENSIONS.has(ext)) {
    throw new ContextDocumentError(
      "Images must be attached through the image upload control, not document conversion.",
      400,
    );
  }

  if (PLAIN_TEXT_EXTENSIONS.has(ext)) {
    return {
      kind: "plain-text",
      mediaType: mediaType && mediaType !== "application/octet-stream" ? mediaType : "text/plain",
    };
  }

  const richMimeFromExt = RICH_DOCUMENT_EXTENSIONS.get(ext);
  if (richMimeFromExt) {
    return {
      kind: "to-markdown",
      mediaType: RICH_DOCUMENT_MIME_TYPES.has(mediaType) ? mediaType : richMimeFromExt,
    };
  }

  if (PLAIN_TEXT_MIME_TYPES.has(mediaType)) {
    return { kind: "plain-text", mediaType };
  }

  if (RICH_DOCUMENT_MIME_TYPES.has(mediaType)) {
    return { kind: "to-markdown", mediaType };
  }

  throw new ContextDocumentError(appError("unsupportedDocument"), 415);
};

export const decodeUtf8Text = (bytes: Uint8Array): string => {
  if (bytes.includes(0)) {
    throw new ContextDocumentError(appError("binaryDocument"), 400);
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new ContextDocumentError(appError("invalidUtf8"), 400);
  }
};

export interface WorkersAiDocumentDeps {
  accountId?: string;
  apiToken?: string;
  fetchImpl?: typeof fetch;
}

/** Converts a document or HTML file into Markdown via Cloudflare Workers AI `toMarkdown` (0 Neurons). */
export const convertToMarkdownWithWorkersAi = async (
  input: { bytes: Uint8Array; filename: string; mediaType: string },
  deps?: WorkersAiDocumentDeps,
): Promise<string> => {
  const accountId = deps?.accountId ?? process.env.CF_ACCOUNT_ID;
  const apiToken = deps?.apiToken ?? process.env.CF_WORKERS_AI_TOKEN;
  if (!accountId || !apiToken) {
    throw new ContextDocumentError(appError("documentConversionNotConfigured"), 503);
  }

  const fetchImpl = deps?.fetchImpl ?? fetch;
  const formData = new FormData();
  const safeBytes = new Uint8Array(input.bytes);
  const blob = new Blob([safeBytes], { type: input.mediaType });
  formData.append("files", blob, input.filename);
  formData.append("conversionOptions", JSON.stringify({ pdf: { metadata: false } }));

  let response: Response;
  try {
    response = await fetchImpl(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/tomarkdown`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
        },
        body: formData,
        signal: AbortSignal.timeout(WORKERS_AI_TO_MARKDOWN_TIMEOUT_MS),
      },
    );
  } catch {
    throw new ContextDocumentError(appError("documentConversionUnavailable"), 502);
  }

  if (response.status === 429) {
    throw new ContextDocumentError(
      "Document conversion rate limit reached. Please try again later.",
      429,
    );
  }

  if (!response.ok) {
    throw new ContextDocumentError(appError("documentConversionFailed"), 502);
  }

  const parsed = v.safeParse(toMarkdownResponseSchema, await response.json().catch(() => null));
  if (!parsed.success || parsed.output.result.length === 0) {
    throw new ContextDocumentError(appError("documentConversionInvalid"), 502);
  }

  const first = parsed.output.result[0];
  if (first.error || typeof first.data !== "string") {
    throw new ContextDocumentError(
      first.error || "Unable to extract Markdown from this document.",
      422,
    );
  }

  return first.data;
};

/** Validates, extracts, and truncates an uploaded document into a ContextAttachmentData payload. */
export const extractDocumentAttachment = async (
  file: File,
  deps?: WorkersAiDocumentDeps,
): Promise<ContextAttachmentData> => {
  if (file.size <= 0) {
    throw new ContextDocumentError(appError("emptyDocument"), 400);
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    throw new ContextDocumentError(appError("documentTooLarge"), 413);
  }

  const filename = file.name || "document";
  const classification = classifyDocumentFile(filename, file.type);
  const bytes = new Uint8Array(await file.arrayBuffer());

  let markdown: string;
  let method: ContextAttachmentData["method"];

  if (classification.kind === "plain-text") {
    markdown = decodeUtf8Text(bytes);
    method = "plain-text";
  } else {
    markdown = await convertToMarkdownWithWorkersAi(
      { bytes, filename, mediaType: classification.mediaType },
      deps,
    );
    method = "to-markdown";
  }

  const truncated = truncateAttachmentContent(markdown);
  if (!truncated.content) {
    throw new ContextDocumentError(appError("noReadableDocumentText"), 422);
  }

  return {
    id: crypto.randomUUID(),
    kind: "document",
    title: filename,
    mediaType: classification.mediaType,
    method,
    content: truncated.content,
    originalChars: truncated.originalChars,
    truncated: truncated.truncated,
  };
};
