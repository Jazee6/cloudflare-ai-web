import { type FileUIPart, generateId, type UIMessage } from "ai";
import Dexie from "dexie";
import { db, type Session, type StoredMessage } from "@/lib/db";

export const CONVERSATION_HISTORY_LOAD_LIMIT = 100;
export const RECENT_SESSIONS_LIMIT = 100;
export const IMAGE_HISTORY_LOAD_LIMIT = 50;

/** Image History shares the message table under a reserved session id that never has a Session row. */
const IMAGE_HISTORY_SESSION_ID = "image";
const SESSION_NAME_LENGTH = 20;

const loadNewestMessages = async (sessionId: string, limit: number): Promise<StoredMessage[]> => {
  const newestFirst = await db.message
    .where("[sessionId+createdAt]")
    .between([sessionId, Dexie.minKey], [sessionId, Dexie.maxKey])
    .reverse()
    .limit(limit)
    .toArray();
  return newestFirst.reverse();
};

const getSessionName = (message: UIMessage) =>
  message.parts.find((part) => part.type === "text")?.text.slice(0, SESSION_NAME_LENGTH) ??
  "New chat";

export const createUserMessage = (text: string, files: FileUIPart[] = []): UIMessage => ({
  id: generateId(),
  role: "user",
  parts: [...files, { type: "text", text }],
});

/** Starts a Conversation History with its first user message and returns the session id. */
export const createConversation = async (firstMessage: UIMessage): Promise<string> => {
  const sessionId = crypto.randomUUID();
  const now = new Date();
  await db.transaction("rw", db.session, db.message, async () => {
    await db.session.add({ id: sessionId, name: getSessionName(firstMessage), updatedAt: now });
    await db.message.add({ ...firstMessage, sessionId, createdAt: now });
  });
  return sessionId;
};

export const appendConversationMessage = async (sessionId: string, message: UIMessage) => {
  const now = new Date();
  await db.transaction("rw", db.session, db.message, async () => {
    await db.message.add({ ...message, sessionId, createdAt: now });
    await db.session.update(sessionId, { updatedAt: now });
  });
};

export const loadConversationHistory = (sessionId: string) =>
  loadNewestMessages(sessionId, CONVERSATION_HISTORY_LOAD_LIMIT);

export const listRecentSessions = (): Promise<Session[]> =>
  db.session.orderBy("updatedAt").reverse().limit(RECENT_SESSIONS_LIMIT).toArray();

export const deleteConversation = async (sessionId: string) => {
  await db.transaction("rw", db.session, db.message, async () => {
    await db.session.delete(sessionId);
    await db.message.where("sessionId").equals(sessionId).delete();
  });
};

export const appendImageHistoryEntry = async (entry: UIMessage) => {
  await db.message.add({ ...entry, sessionId: IMAGE_HISTORY_SESSION_ID, createdAt: new Date() });
};

export const loadImageHistory = () =>
  loadNewestMessages(IMAGE_HISTORY_SESSION_ID, IMAGE_HISTORY_LOAD_LIMIT);

export const clearImageHistory = async () => {
  await db.message.where("sessionId").equals(IMAGE_HISTORY_SESSION_ID).delete();
};
