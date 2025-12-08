import type { UIMessage } from "ai";
import Dexie, { type EntityTable } from "dexie";

export interface Session {
  id: string;
  name: string;
  updatedAt: Date;
}

export type Message = UIMessage & {
  sessionId: string;
  createdAt: Date;
  search?: boolean;
};

export interface ImagesDataPart {
  images: Blob[];
  urls?: string[];
}

export const db = new Dexie("CF_AI_DB") as Dexie & {
  session: EntityTable<Session, "id">;
  message: EntityTable<Message, "id">;
};

db.version(1).stores({
  session: "&id, name, updatedAt",
  message: "&id, sessionId ,role, metadata, parts, &createdAt",
});
