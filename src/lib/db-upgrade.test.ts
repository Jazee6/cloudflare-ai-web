import { beforeEach, expect, test } from "bun:test";
import Dexie from "dexie";
import { loadConversationHistory } from "@/lib/conversation-store";
import { db } from "@/lib/db";
import { getImageBlobs, isImageTurn } from "@/lib/image-turn";

const png = () => new Blob([new Uint8Array([1])], { type: "image/png" });

/** Image History exactly as 5.x wrote it: no metadata and no Session row. */
const legacyImageHistory = [
  {
    id: "prompt",
    role: "user",
    parts: [{ type: "text", text: "a red square" }],
    sessionId: "image",
    createdAt: new Date(Date.UTC(2026, 0, 1)),
  },
  {
    id: "response",
    role: "assistant",
    parts: [{ type: "data-images", data: { images: [png()] } }],
    sessionId: "image",
    createdAt: new Date(Date.UTC(2026, 0, 2)),
  },
];

/** Recreates the database at 5.x's schema (v3) and reopens it, running the v4 upgrade. */
const upgradeFrom5x = async (seed: (legacy: Dexie) => Promise<unknown>) => {
  const legacy = new Dexie("CF_AI_DB");
  legacy.version(3).stores({
    session: "&id, name, updatedAt",
    message: "&id, sessionId, role, metadata, parts, createdAt, [sessionId+createdAt]",
  });
  await seed(legacy);
  legacy.close();
  await db.open();
};

beforeEach(async () => {
  // Test files share one IndexedDB; every upgrade starts from a fresh database.
  db.close();
  await Dexie.delete("CF_AI_DB");
});

test("5.x Image History becomes an ordinary session of image turns", async () => {
  await upgradeFrom5x((legacy) => legacy.table("message").bulkAdd(legacyImageHistory));

  expect(db.verno).toBe(4);
  const session = await db.session.get("image");
  expect(session?.name).toBe("Image History");
  expect(session?.updatedAt).toEqual(legacyImageHistory[1].createdAt);

  const history = await loadConversationHistory("image");
  expect(history.map((message) => message.id)).toEqual(["prompt", "response"]);
  expect(history.every(isImageTurn)).toBe(true);
  expect(getImageBlobs(history[1], "data-images")[0]).toBeInstanceOf(Blob);
});

test("the upgrade adds no session when there is no Image History", async () => {
  await upgradeFrom5x((legacy) =>
    legacy.table("session").add({ id: "chat", name: "chat", updatedAt: new Date() }),
  );

  expect(await db.session.toCollection().primaryKeys()).toEqual(["chat"]);
});

test("the upgrade keeps an existing session named by the image id", async () => {
  const updatedAt = new Date(Date.UTC(2025, 0, 1));
  await upgradeFrom5x(async (legacy) => {
    await legacy.table("session").add({ id: "image", name: "Mine", updatedAt });
    await legacy.table("message").bulkAdd(legacyImageHistory);
  });

  expect(await db.session.get("image")).toEqual({ id: "image", name: "Mine", updatedAt });
});
