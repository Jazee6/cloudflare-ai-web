import type { UIMessage } from "ai";
import Dexie, { type EntityTable } from "dexie";

export interface Session {
  id: string;
  name: string;
  updatedAt: Date;
}

/** A message as persisted in IndexedDB, for both Conversation History and Image History. */
export type StoredMessage = UIMessage & {
  sessionId: string;
  createdAt: Date;
};

/** Image History stores generated images as Blobs in a `data-images` part. */
export interface StoredImagesData {
  images: Blob[];
}

/** The display form of a `data-images` part, with Blobs replaced by object URLs. */
export interface ImageUrlsData {
  urls: string[];
}

export const db = new Dexie("CF_AI_DB") as Dexie & {
  session: EntityTable<Session, "id">;
  message: EntityTable<StoredMessage, "id">;
};

// v1: initial schema (has a stray space and unique createdAt constraint)
// v2: removed unique createdAt constraint and fixed the stray space in sessionId index
// v3: added [sessionId+createdAt] so the newest messages of a session load in order
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
