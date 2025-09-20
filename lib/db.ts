import type { TextUIPart, UIDataTypes, UIMessagePart, UITools } from "ai";
import Dexie, { type EntityTable } from "dexie";

export interface Session {
  id: string;
  name: string;
  updatedAt: Date;
}

export interface Message<
  METADATA = unknown,
  DATA_PARTS extends UIDataTypes = UIDataTypes & TextUIPart,
  TOOLS extends UITools = UITools,
> {
  id: string;
  sessionId: string;
  role: "system" | "user" | "assistant";
  metadata?: METADATA;
  parts: Array<UIMessagePart<DATA_PARTS, TOOLS>>;
  createdAt: Date;
}

export const db = new Dexie("CF_AI_DB") as Dexie & {
  session: EntityTable<Session, "id">;
  message: EntityTable<Message, "id">;
};

db.version(1).stores({
  session: "&id, name, updatedAt",
  message: "&id, sessionId ,role, metadata, parts, &createdAt",
});
