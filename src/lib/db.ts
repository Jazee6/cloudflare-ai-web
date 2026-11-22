import type { UIMessage } from "ai";
import Dexie, { type EntityTable } from "dexie";

export interface Session {
  id: string;
  name: string;
  updatedAt: Date;
}

/** A message as persisted in IndexedDB as part of a Conversation History. */
export type StoredMessage = UIMessage & {
  sessionId: string;
  createdAt: Date;
};

/**
 * Images of an image-generation turn, kept as Blobs: generated images in a `data-images`
 * part of the response, Reference Images in a `data-reference-images` part of the prompt.
 */
export interface StoredImagesData {
  images: Blob[];
}

/** The session id 5.x used for Image History, which v4 turns into an ordinary session. */
export const LEGACY_IMAGE_HISTORY_SESSION_ID = "image";

export const db = new Dexie("CF_AI_DB") as Dexie & {
  session: EntityTable<Session, "id">;
  message: EntityTable<StoredMessage, "id">;
};

// v1: initial schema (has a stray space and unique createdAt constraint)
// v2: removed unique createdAt constraint and fixed the stray space in sessionId index
// v3: added [sessionId+createdAt] so the newest messages of a session load in order
// v4: 5.x Image History messages become an ordinary session named "Image History"
db.version(1).stores({
  session: "&id, name, updatedAt",
  message: "&id, sessionId ,role, metadata, parts, &createdAt",
});

db.version(2).stores({
  session: "&id, name, updatedAt",
  message: "&id, sessionId, role, metadata, parts, createdAt",
});

db.version(3).stores({
  session: "&id, name, updatedAt",
  message: "&id, sessionId, role, metadata, parts, createdAt, [sessionId+createdAt]",
});

db.version(4)
  .stores({
    session: "&id, name, updatedAt",
    message: "&id, sessionId, role, metadata, parts, createdAt, [sessionId+createdAt]",
  })
  .upgrade(async (tx) => {
    const messages = tx
      .table<StoredMessage, string>("message")
      .where("sessionId")
      .equals(LEGACY_IMAGE_HISTORY_SESSION_ID);
    // 5.x stored Image History without metadata; image parameters mark a turn as image
    // generation, so Retry regenerates the image instead of asking a chat model.
    await messages.modify((message) => {
      const metadata = message.metadata as { params?: unknown } | undefined;
      if (metadata?.params === undefined) {
        message.metadata = { ...metadata, params: {} };
      }
    });

    const sessions = tx.table<Session, string>("session");
    if (await sessions.get(LEGACY_IMAGE_HISTORY_SESSION_ID)) {
      return;
    }
    const newest = await tx
      .table<StoredMessage, string>("message")
      .where("[sessionId+createdAt]")
      .between(
        [LEGACY_IMAGE_HISTORY_SESSION_ID, Dexie.minKey],
        [LEGACY_IMAGE_HISTORY_SESSION_ID, Dexie.maxKey],
      )
      .last();
    if (newest) {
      await sessions.add({
        id: LEGACY_IMAGE_HISTORY_SESSION_ID,
        name: "Image History",
        updatedAt: newest.createdAt,
      });
    }
  });
