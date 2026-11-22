import { afterEach, expect, test } from "bun:test";
import {
  CONVERSATION_BACKUP_VERSION,
  exportConversationHistory,
  importConversationHistory,
} from "@/lib/conversation-backup";
import {
  appendImageHistoryEntry,
  clearAllConversations,
  createConversation,
  createUserMessage,
  getStorageStats,
  loadConversationHistory,
  loadImageHistory,
} from "@/lib/conversation-store";
import { db } from "@/lib/db";

afterEach(async () => {
  await Promise.all([db.session.clear(), db.message.clear()]);
});

test("exportConversationHistory exports conversations only and filters images when disabled", async () => {
  const sessionId = await createConversation(
    createUserMessage(
      "Look at this",
      [
        {
          type: "file",
          filename: "a.png",
          mediaType: "image/png",
          url: "data:image/png;base64,AA==",
        },
      ],
      [],
    ),
  );
  await appendImageHistoryEntry(createUserMessage("image prompt"));

  const withoutImages = await exportConversationHistory({ includeImages: false });
  expect(withoutImages.version).toBe(CONVERSATION_BACKUP_VERSION);
  expect(withoutImages.sessions).toHaveLength(1);
  expect(withoutImages.sessions[0].id).toBe(sessionId);
  expect(withoutImages.sessions[0].messages[0].parts).toEqual([
    { type: "text", text: "Look at this" },
  ]);

  const withImages = await exportConversationHistory({ includeImages: true });
  expect(withImages.sessions[0].messages[0].parts).toHaveLength(2);
});

test("importConversationHistory validates payloads and skips existing session IDs", async () => {
  const existingId = await createConversation(createUserMessage("existing"));

  const badJson = await importConversationHistory("{bad");
  expect(badJson.ok).toBe(false);

  const badSchema = await importConversationHistory(JSON.stringify({ version: 99, sessions: [] }));
  expect(badSchema.ok).toBe(false);

  const valid = await importConversationHistory(
    JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      sessions: [
        {
          id: existingId,
          name: "overwrite attempt",
          updatedAt: new Date().toISOString(),
          messages: [],
        },
        {
          id: "imported-session",
          name: "Imported",
          updatedAt: new Date().toISOString(),
          messages: [
            {
              id: "m1",
              role: "user",
              parts: [{ type: "text", text: "from backup" }],
              createdAt: new Date().toISOString(),
            },
          ],
        },
      ],
    }),
  );

  expect(valid).toEqual({
    ok: true,
    importedSessions: 1,
    skippedSessions: 1,
    importedMessages: 1,
  });

  const existingHistory = await loadConversationHistory(existingId);
  expect(existingHistory[0].parts[0]).toEqual({ type: "text", text: "existing" });
  const importedHistory = await loadConversationHistory("imported-session");
  expect(importedHistory).toHaveLength(1);
});

test("getStorageStats and clearAllConversations preserve Image History", async () => {
  await createConversation(createUserMessage("hello"));
  await appendImageHistoryEntry(createUserMessage("draw cat"));

  expect(await getStorageStats()).toEqual({
    sessionCount: 1,
    messageCount: 1,
    imageEntryCount: 1,
  });

  await clearAllConversations();

  expect(await getStorageStats()).toEqual({
    sessionCount: 0,
    messageCount: 0,
    imageEntryCount: 1,
  });
  expect(await loadImageHistory()).toHaveLength(1);
});
