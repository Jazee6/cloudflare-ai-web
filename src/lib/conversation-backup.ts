import type { UIMessage } from "ai";
import * as v from "valibot";
import {
  db,
  type Session,
  type StoredImagesData,
  type StoredMessage,
  type UsageRecord,
} from "@/lib/db";
import { blobToDataUrl } from "@/lib/image-compression";
import type { MessageKey } from "@/locales/en";

export const CONVERSATION_BACKUP_VERSION = 1;
/**
 * Backups are read in the browser only; the limit guards memory. It leaves room for generated
 * images, which are exported as data URLs about a third larger than the images themselves.
 */
export const MAX_BACKUP_IMPORT_BYTES = 200 * 1024 * 1024;
export const BACKUP_TOO_LARGE_MESSAGE = "backup.tooLarge" satisfies MessageKey;

export const exceedsBackupImportLimit = (json: string) =>
  new TextEncoder().encode(json).byteLength > MAX_BACKUP_IMPORT_BYTES;
const IMAGE_DATA_URL_PATTERN = /^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/]*={0,2}$/i;
const BLOB_IMAGE_PART_TYPES = new Set(["data-images", "data-reference-images"]);

const exportedMessageSchema = v.object({
  id: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  role: v.picklist(["user", "assistant"]),
  parts: v.array(v.record(v.string(), v.unknown())),
  metadata: v.optional(v.unknown()),
  createdAt: v.pipe(
    v.string(),
    v.check((value) => !Number.isNaN(Date.parse(value))),
  ),
});

const exportedSessionSchema = v.object({
  id: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  updatedAt: v.pipe(
    v.string(),
    v.check((value) => !Number.isNaN(Date.parse(value))),
  ),
  messages: v.array(exportedMessageSchema),
});

const isoDate = v.pipe(
  v.string(),
  v.check((value) => !Number.isNaN(Date.parse(value))),
);
const tokenCount = v.pipe(v.number(), v.integer(), v.minValue(0));

const exportedUsageRecordSchema = v.object({
  id: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  sessionId: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  createdAt: isoDate,
  modelId: v.pipe(v.string(), v.minLength(1), v.maxLength(512)),
  modelName: v.pipe(v.string(), v.maxLength(512)),
  inputTokens: tokenCount,
  outputTokens: tokenCount,
  cost: v.optional(v.pipe(v.number(), v.finite(), v.minValue(0))),
});

export const conversationBackupSchema = v.object({
  version: v.literal(CONVERSATION_BACKUP_VERSION),
  exportedAt: v.pipe(
    v.string(),
    v.check((value) => !Number.isNaN(Date.parse(value))),
  ),
  sessions: v.array(exportedSessionSchema),
  /** The Usage Ledger; absent from backups made before it existed. */
  usage: v.optional(v.array(exportedUsageRecordSchema)),
});

export type ConversationBackup = v.InferOutput<typeof conversationBackupSchema>;

export interface ExportConversationOptions {
  includeImages: boolean;
}

/** A `data-images` or `data-reference-images` part as exported, with Blobs as data URLs. */
const exportedImagesPartSchema = v.object({
  type: v.picklist(["data-images", "data-reference-images"]),
  data: v.object({ images: v.array(v.pipe(v.string(), v.regex(IMAGE_DATA_URL_PATTERN))) }),
});

const isBlobImagePart = (part: { type: string }) => BLOB_IMAGE_PART_TYPES.has(part.type);

const exportParts = async (
  parts: UIMessage["parts"],
  includeImages: boolean,
): Promise<Record<string, unknown>[]> => {
  const exported: Record<string, unknown>[] = [];
  for (const part of parts) {
    if (isBlobImagePart(part)) {
      if (!includeImages) {
        continue;
      }
      const images = (part as { data?: Partial<StoredImagesData> }).data?.images ?? [];
      exported.push({
        type: part.type,
        data: { images: await Promise.all(images.map(blobToDataUrl)) },
      });
      continue;
    }
    if (!includeImages && part.type === "file" && part.mediaType?.startsWith("image/")) {
      continue;
    }
    exported.push({ ...part } as Record<string, unknown>);
  }
  return exported;
};

const dataUrlToBlob = (url: string) => {
  const [header, base64] = url.split(",", 2);
  const mediaType = header.slice("data:".length, header.indexOf(";"));
  const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  return new Blob([bytes], { type: mediaType });
};

/** Restores exported image parts to Blobs; returns null when one is malformed. */
const importParts = (parts: Record<string, unknown>[]): UIMessage["parts"] | null => {
  const imported: UIMessage["parts"] = [];
  for (const part of parts) {
    if (typeof part.type === "string" && BLOB_IMAGE_PART_TYPES.has(part.type)) {
      const parsed = v.safeParse(exportedImagesPartSchema, part);
      if (!parsed.success) {
        return null;
      }
      imported.push({
        type: parsed.output.type,
        data: { images: parsed.output.data.images.map(dataUrlToBlob) } satisfies StoredImagesData,
      });
      continue;
    }
    imported.push(part as UIMessage["parts"][number]);
  }
  return imported;
};

/**
 * Without images, a response that was only generated images has nothing left and is dropped;
 * its prompt stays.
 */
const exportMessages = async (messages: StoredMessage[], includeImages: boolean) => {
  const exported: ConversationBackup["sessions"][number]["messages"] = [];
  for (const message of messages) {
    if (message.role !== "user" && message.role !== "assistant") {
      continue;
    }
    const parts = await exportParts(message.parts, includeImages);
    if (parts.length === 0) {
      continue;
    }
    exported.push({
      id: message.id,
      role: message.role,
      parts,
      ...(message.metadata !== undefined ? { metadata: message.metadata } : {}),
      createdAt: new Date(message.createdAt).toISOString(),
    });
  }
  return exported;
};

export const exportConversationHistory = async (
  options: ExportConversationOptions = { includeImages: false },
): Promise<ConversationBackup> => {
  const sessions = await db.session.orderBy("updatedAt").reverse().toArray();
  const exportedSessions: ConversationBackup["sessions"] = [];

  for (const session of sessions) {
    const messages = await db.message
      .where("[sessionId+createdAt]")
      .between([session.id, new Date(0)], [session.id, new Date(8.64e15)])
      .toArray();

    exportedSessions.push({
      id: session.id,
      name: session.name,
      updatedAt: new Date(session.updatedAt).toISOString(),
      messages: await exportMessages(messages, options.includeImages),
    });
  }

  const usage = await db.usage.orderBy("createdAt").toArray();

  return {
    version: CONVERSATION_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    sessions: exportedSessions,
    usage: usage.map((record) => ({
      ...record,
      createdAt: new Date(record.createdAt).toISOString(),
    })),
  };
};

export const exportConversationHistoryJson = async (
  options: ExportConversationOptions = { includeImages: false },
): Promise<string> => JSON.stringify(await exportConversationHistory(options), null, 2);

export type ImportConversationResult =
  | {
      ok: true;
      importedSessions: number;
      skippedSessions: number;
      importedMessages: number;
    }
  | {
      ok: false;
      /** Message key for why the backup was rejected. */
      error: MessageKey;
    };

/**
 * Validates and imports a Conversation History JSON backup without overwriting existing sessions.
 */
export const importConversationHistory = async (
  rawJson: string,
): Promise<ImportConversationResult> => {
  if (exceedsBackupImportLimit(rawJson)) {
    return { ok: false, error: BACKUP_TOO_LARGE_MESSAGE };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawJson);
  } catch {
    return { ok: false, error: "backup.invalidJson" };
  }

  const validated = v.safeParse(conversationBackupSchema, parsedJson);
  if (!validated.success) {
    return { ok: false, error: "backup.invalidFormat" };
  }

  const importedParts = new Map<object, UIMessage["parts"]>();
  for (const session of validated.output.sessions) {
    for (const message of session.messages) {
      const parts = importParts(message.parts);
      if (!parts) {
        return { ok: false, error: "backup.invalidFormat" };
      }
      importedParts.set(message, parts);
    }
  }

  let importedSessions = 0;
  let skippedSessions = 0;
  let importedMessages = 0;

  await db.transaction("rw", db.session, db.message, db.usage, async () => {
    // Ledger entries already present are kept; the ledger is merged, never overwritten.
    const existingUsageIds = new Set(await db.usage.toCollection().primaryKeys());
    const usageToAdd: UsageRecord[] = (validated.output.usage ?? [])
      .filter((record) => !existingUsageIds.has(record.id))
      .map((record) => ({ ...record, createdAt: new Date(record.createdAt) }));
    const uniqueUsage = [...new Map(usageToAdd.map((record) => [record.id, record])).values()];
    if (uniqueUsage.length > 0) {
      await db.usage.bulkAdd(uniqueUsage);
    }

    const existingIds = new Set(await db.session.toCollection().primaryKeys());
    const existingMessageIds = new Set(await db.message.toCollection().primaryKeys());
    const sessionsToAdd: Session[] = [];
    const messagesToAdd: StoredMessage[] = [];

    for (const session of validated.output.sessions) {
      if (existingIds.has(session.id)) {
        skippedSessions++;
        continue;
      }

      existingIds.add(session.id);
      importedSessions++;
      sessionsToAdd.push({
        id: session.id,
        name: session.name,
        updatedAt: new Date(session.updatedAt),
      });

      for (const message of session.messages) {
        importedMessages++;
        const messageId = existingMessageIds.has(message.id) ? crypto.randomUUID() : message.id;
        existingMessageIds.add(messageId);
        messagesToAdd.push({
          id: messageId,
          role: message.role,
          parts: importedParts.get(message) ?? [],
          ...(message.metadata !== undefined ? { metadata: message.metadata } : {}),
          sessionId: session.id,
          createdAt: new Date(message.createdAt),
        });
      }
    }

    if (sessionsToAdd.length > 0) {
      await db.session.bulkAdd(sessionsToAdd);
    }
    if (messagesToAdd.length > 0) {
      await db.message.bulkAdd(messagesToAdd);
    }
  });

  return {
    ok: true,
    importedSessions,
    skippedSessions,
    importedMessages,
  };
};

export const triggerBackupDownload = async (jsonContent: string, filename: string) => {
  const blob = new Blob([jsonContent], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
};
