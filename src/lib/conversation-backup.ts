import type { UIMessage } from "ai";
import * as v from "valibot";
import { db, type Session, type StoredMessage } from "@/lib/db";

export const CONVERSATION_BACKUP_VERSION = 1;
export const MAX_BACKUP_IMPORT_BYTES = 20 * 1024 * 1024;
const IMAGE_HISTORY_SESSION_ID = "image";

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
  id: v.pipe(
    v.string(),
    v.minLength(1),
    v.maxLength(128),
    v.check((value) => value !== IMAGE_HISTORY_SESSION_ID),
  ),
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  updatedAt: v.pipe(
    v.string(),
    v.check((value) => !Number.isNaN(Date.parse(value))),
  ),
  messages: v.array(exportedMessageSchema),
});

export const conversationBackupSchema = v.object({
  version: v.literal(CONVERSATION_BACKUP_VERSION),
  exportedAt: v.pipe(
    v.string(),
    v.check((value) => !Number.isNaN(Date.parse(value))),
  ),
  sessions: v.array(exportedSessionSchema),
});

export type ConversationBackup = v.InferOutput<typeof conversationBackupSchema>;

export interface ExportConversationOptions {
  includeImages: boolean;
}

const filterPartsForExport = (
  parts: UIMessage["parts"],
  includeImages: boolean,
): Record<string, unknown>[] =>
  parts
    .filter((part) => {
      if (!includeImages && part.type === "file" && part.mediaType?.startsWith("image/")) {
        return false;
      }
      return true;
    })
    .map((part) => ({ ...part }) as Record<string, unknown>);

export const exportConversationHistory = async (
  options: ExportConversationOptions = { includeImages: false },
): Promise<ConversationBackup> => {
  const sessions = await db.session.orderBy("updatedAt").reverse().toArray();
  const exportedSessions: ConversationBackup["sessions"] = [];

  for (const session of sessions) {
    if (session.id === IMAGE_HISTORY_SESSION_ID) {
      continue;
    }
    const messages = await db.message
      .where("[sessionId+createdAt]")
      .between([session.id, new Date(0)], [session.id, new Date(8.64e15)])
      .toArray();

    exportedSessions.push({
      id: session.id,
      name: session.name,
      updatedAt: new Date(session.updatedAt).toISOString(),
      messages: messages
        .filter(
          (msg): msg is StoredMessage & { role: "user" | "assistant" } =>
            msg.role === "user" || msg.role === "assistant",
        )
        .map((msg) => ({
          id: msg.id,
          role: msg.role,
          parts: filterPartsForExport(msg.parts, options.includeImages),
          ...(msg.metadata !== undefined ? { metadata: msg.metadata } : {}),
          createdAt: new Date(msg.createdAt).toISOString(),
        })),
    });
  }

  return {
    version: CONVERSATION_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    sessions: exportedSessions,
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
      error: string;
    };

/**
 * Validates and imports a Conversation History JSON backup without overwriting existing sessions.
 */
export const importConversationHistory = async (
  rawJson: string,
): Promise<ImportConversationResult> => {
  if (new TextEncoder().encode(rawJson).byteLength > MAX_BACKUP_IMPORT_BYTES) {
    return { ok: false, error: "Backup file exceeds the 20 MiB import limit." };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawJson);
  } catch {
    return { ok: false, error: "Invalid JSON backup file." };
  }

  const validated = v.safeParse(conversationBackupSchema, parsedJson);
  if (!validated.success) {
    return { ok: false, error: "Backup file format is invalid or unsupported." };
  }

  let importedSessions = 0;
  let skippedSessions = 0;
  let importedMessages = 0;

  await db.transaction("rw", db.session, db.message, async () => {
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
          parts: message.parts as UIMessage["parts"],
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
