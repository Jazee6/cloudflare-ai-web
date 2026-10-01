import { afterEach, beforeAll, expect, setSystemTime, test } from "bun:test";
import Dexie from "dexie";
import {
  appendConversationMessage,
  appendImageHistoryEntry,
  clearImageHistory,
  CONVERSATION_HISTORY_LOAD_LIMIT,
  createConversation,
  createUserMessage,
  deleteConversation,
  IMAGE_HISTORY_LOAD_LIMIT,
  listRecentSessions,
  loadConversationHistory,
  loadImageHistory,
  RECENT_SESSIONS_LIMIT,
} from "@/lib/conversation-store";
import { db, type StoredMessage } from "@/lib/db";

const textOf = (message: StoredMessage) => message.parts.find((part) => part.type === "text")?.text;

const storedMessage = (sessionId: string, index: number): StoredMessage => ({
  // Random ids so primary-key order differs from creation order.
  id: crypto.randomUUID(),
  role: "user",
  parts: [{ type: "text", text: `message ${index}` }],
  sessionId,
  createdAt: new Date(Date.UTC(2026, 0, 1) + index * 1000),
});

beforeAll(async () => {
  // Seed a version 2 database so the first store access exercises the v3 upgrade.
  const legacy = new Dexie("CF_AI_DB");
  legacy.version(2).stores({
    session: "&id, name, updatedAt",
    message: "&id, sessionId, role, metadata, parts, createdAt",
  });
  await legacy.table("session").add({ id: "legacy", name: "legacy", updatedAt: new Date() });
  await legacy.table("message").bulkAdd([storedMessage("legacy", 2), storedMessage("legacy", 1)]);
  legacy.close();
});

// Entries written within the same millisecond share a timestamp, so tests that write in a
// row step the clock to keep creation order unambiguous.
let clock = Date.UTC(2026, 0, 1);
const tick = () => setSystemTime((clock += 1000));

afterEach(async () => {
  setSystemTime();
  await Promise.all([db.session.clear(), db.message.clear()]);
});

test("upgrading from v2 keeps Conversation History and orders it by creation time", async () => {
  const history = await loadConversationHistory("legacy");

  expect(db.verno).toBe(3);
  expect(history.map(textOf)).toEqual(["message 1", "message 2"]);
});

test("loadConversationHistory returns the newest messages in chronological order", async () => {
  const total = CONVERSATION_HISTORY_LOAD_LIMIT + 5;
  await db.message.bulkAdd(Array.from({ length: total }, (_, index) => storedMessage("s1", index)));
  await db.message.add(storedMessage("other", total + 1));

  const history = await loadConversationHistory("s1");

  expect(history).toHaveLength(CONVERSATION_HISTORY_LOAD_LIMIT);
  expect(textOf(history[0])).toBe("message 5");
  expect(textOf(history.at(-1)!)).toBe(`message ${total - 1}`);
});

test("createConversation stores the first message and names the session from its text", async () => {
  const first = createUserMessage("Explain IndexedDB compound indexes please");
  const sessionId = await createConversation(first);

  const [session] = await listRecentSessions();
  expect(session).toMatchObject({ id: sessionId, name: "Explain IndexedDB co" });
  expect((await loadConversationHistory(sessionId)).map((message) => message.id)).toEqual([
    first.id,
  ]);
});

test("appendConversationMessage keeps the message id and bumps the session", async () => {
  tick();
  const sessionId = await createConversation(createUserMessage("hello"));
  await db.session.update(sessionId, { updatedAt: new Date(0) });
  tick();

  const reply = { id: "reply-1", role: "assistant" as const, parts: [] };
  await appendConversationMessage(sessionId, reply);

  expect((await loadConversationHistory(sessionId)).at(-1)?.id).toBe("reply-1");
  expect((await db.session.get(sessionId))?.updatedAt.getTime()).toBeGreaterThan(0);
});

test("listRecentSessions returns the most recently updated sessions first", async () => {
  const total = RECENT_SESSIONS_LIMIT + 5;
  await db.session.bulkAdd(
    Array.from({ length: total }, (_, index) => ({
      id: crypto.randomUUID(),
      name: `session ${index}`,
      updatedAt: new Date(index * 1000),
    })),
  );

  const sessions = await listRecentSessions();

  expect(sessions).toHaveLength(RECENT_SESSIONS_LIMIT);
  expect(sessions[0].name).toBe(`session ${total - 1}`);
  expect(sessions.at(-1)?.name).toBe("session 5");
});

test("deleteConversation removes only that session and its messages", async () => {
  const keep = await createConversation(createUserMessage("keep"));
  const remove = await createConversation(createUserMessage("remove"));

  await deleteConversation(remove);

  expect((await listRecentSessions()).map((session) => session.id)).toEqual([keep]);
  expect(await loadConversationHistory(remove)).toEqual([]);
  expect(await loadConversationHistory(keep)).toHaveLength(1);
});

test("Image History is kept apart from conversations and can be cleared", async () => {
  const conversation = await createConversation(createUserMessage("chat"));
  for (let index = 0; index < IMAGE_HISTORY_LOAD_LIMIT + 1; index++) {
    tick();
    await appendImageHistoryEntry(createUserMessage(`prompt ${index}`));
  }

  const imageHistory = await loadImageHistory();
  expect(imageHistory).toHaveLength(IMAGE_HISTORY_LOAD_LIMIT);
  expect(textOf(imageHistory.at(-1)!)).toBe(`prompt ${IMAGE_HISTORY_LOAD_LIMIT}`);
  expect((await listRecentSessions()).map((session) => session.id)).toEqual([conversation]);

  await clearImageHistory();
  expect(await loadImageHistory()).toEqual([]);
  expect(await loadConversationHistory(conversation)).toHaveLength(1);
});
