import { afterEach, expect, test } from "bun:test";
import {
  CONVERSATION_BACKUP_VERSION,
  exportConversationHistory,
  importConversationHistory,
} from "@/lib/conversation-backup";
import {
  appendConversationMessage,
  clearAllConversations,
  createConversation,
  createUserMessage,
  getStorageStats,
  loadConversationHistory,
} from "@/lib/conversation-store";
import { db } from "@/lib/db";
import { getImageBlobs } from "@/lib/image-turn";

afterEach(async () => {
  await Promise.all([db.session.clear(), db.message.clear(), db.usage.clear()]);
});

test("exportConversationHistory filters attached images when disabled", async () => {
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

test("getStorageStats counts and clearAllConversations removes every conversation", async () => {
  await createConversation(createUserMessage("hello"));

  expect(await getStorageStats()).toEqual({ sessionCount: 1, messageCount: 1 });

  await clearAllConversations();

  expect(await getStorageStats()).toEqual({ sessionCount: 0, messageCount: 0 });
});

const usageRecord = (id: string, cost?: number) => ({
  id,
  sessionId: "gone",
  createdAt: new Date(Date.UTC(2026, 10, 1)),
  modelId: "@cf/test/chat",
  modelName: "chat",
  inputTokens: 1000,
  outputTokens: 500,
  ...(cost === undefined ? {} : { cost }),
});

test("the Usage Ledger outlives cleared conversations and round-trips through a backup", async () => {
  await createConversation(createUserMessage("hello"));
  await db.usage.bulkAdd([usageRecord("r1", 0.002), usageRecord("r2")]);
  await clearAllConversations();
  expect(await db.usage.count()).toBe(2);

  const backup = await exportConversationHistory({ includeImages: false });
  expect(backup.usage?.map((record) => record.id)).toEqual(["r1", "r2"]);

  await db.usage.delete("r2");
  const result = await importConversationHistory(JSON.stringify(backup));
  expect(result.ok).toBe(true);
  const restored = await db.usage.orderBy("id").toArray();
  expect(restored.map((record) => record.id)).toEqual(["r1", "r2"]);
  expect(restored[0].cost).toBe(0.002);
  expect(restored[1].createdAt).toBeInstanceOf(Date);
});

test("backups made before the Usage Ledger still import", async () => {
  const result = await importConversationHistory(
    JSON.stringify({
      version: CONVERSATION_BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      sessions: [],
    }),
  );
  expect(result.ok).toBe(true);
  expect(await db.usage.count()).toBe(0);
});

const png = () => new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" });
const params = { width: 1024, height: 1024, seed: 7 };

const createImageConversation = async () => {
  const sessionId = await createConversation({
    id: "prompt",
    role: "user",
    parts: [
      { type: "data-reference-images", data: { images: [png()] } },
      { type: "text", text: "draw a cat" },
    ],
    metadata: { modelId: "@cf/flux", modelName: "Flux", params },
  });
  await appendConversationMessage(sessionId, {
    id: "response",
    role: "assistant",
    parts: [{ type: "data-images", data: { images: [png()] } }],
    metadata: { modelId: "@cf/flux", modelName: "Flux", params },
  });
  return sessionId;
};

test("image turns round-trip through a backup with images as data URLs", async () => {
  const sessionId = await createImageConversation();
  const backup = await exportConversationHistory({ includeImages: true });
  const [prompt, response] = backup.sessions[0].messages;
  expect(prompt.parts[0]).toEqual({
    type: "data-reference-images",
    data: { images: ["data:image/png;base64,iVBORw=="] },
  });
  expect(response.parts[0]).toEqual({
    type: "data-images",
    data: { images: ["data:image/png;base64,iVBORw=="] },
  });

  await clearAllConversations();
  const imported = await importConversationHistory(JSON.stringify(backup));
  expect(imported.ok).toBe(true);

  const history = await loadConversationHistory(sessionId);
  const [image] = getImageBlobs(history[1], "data-images");
  expect(image).toBeInstanceOf(Blob);
  expect(image.type).toBe("image/png");
  expect(new Uint8Array(await image.arrayBuffer())).toEqual(new Uint8Array([137, 80, 78, 71]));
  expect(getImageBlobs(history[0], "data-reference-images")).toHaveLength(1);
  expect(history[1].metadata).toEqual({ modelId: "@cf/flux", modelName: "Flux", params });
});

test("exporting without images keeps the prompt and drops an image-only response", async () => {
  await createImageConversation();
  const backup = await exportConversationHistory({ includeImages: false });

  expect(backup.sessions[0].messages).toHaveLength(1);
  expect(backup.sessions[0].messages[0].parts).toEqual([{ type: "text", text: "draw a cat" }]);
});

test("importConversationHistory rejects malformed image parts", async () => {
  const result = await importConversationHistory(
    JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      sessions: [
        {
          id: "s",
          name: "s",
          updatedAt: new Date().toISOString(),
          messages: [
            {
              id: "m",
              role: "assistant",
              parts: [{ type: "data-images", data: { images: ["javascript:alert(1)"] } }],
              createdAt: new Date().toISOString(),
            },
          ],
        },
      ],
    }),
  );
  expect(result.ok).toBe(false);
  expect(await db.session.count()).toBe(0);
});

test("importConversationHistory reassigns colliding message IDs instead of overwriting existing messages", async () => {
  const existingMessage = createUserMessage("stay in session 1");
  const session1Id = await createConversation(existingMessage);

  const imported = await importConversationHistory(
    JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      sessions: [
        {
          id: "session-2",
          name: "Imported Session",
          updatedAt: new Date().toISOString(),
          messages: [
            {
              id: existingMessage.id,
              role: "user",
              parts: [{ type: "text", text: "colliding backup message" }],
              createdAt: new Date().toISOString(),
            },
          ],
        },
      ],
    }),
  );

  expect(imported).toEqual({
    ok: true,
    importedSessions: 1,
    skippedSessions: 0,
    importedMessages: 1,
  });

  const session1History = await loadConversationHistory(session1Id);
  expect(session1History).toHaveLength(1);
  expect(session1History[0].parts[0]).toEqual({ type: "text", text: "stay in session 1" });

  const session2History = await loadConversationHistory("session-2");
  expect(session2History).toHaveLength(1);
  expect(session2History[0].id).not.toBe(existingMessage.id);
  expect(session2History[0].parts[0]).toEqual({ type: "text", text: "colliding backup message" });
});
