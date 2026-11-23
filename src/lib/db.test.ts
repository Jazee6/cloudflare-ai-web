import { expect, test } from "bun:test";
import { db } from "@/lib/db";

test("Dexie schema version 2 removes unique createdAt constraint", () => {
  // The database instance should be constructed with version(2)
  // We verify the schema is statically correct by checking the stores definition
  const messageSchema = db.table("message").schema;
  expect(messageSchema).toBeDefined();

  // Verify that the schema primKey is &id and indexes include sessionId without unique createdAt
  const indexes = messageSchema.indexes;
  const createdAtIndex = indexes.find((idx) => idx.keyPath === "createdAt");
  // In v2, createdAt should NOT have a unique constraint (no & prefix)
  expect(createdAtIndex).toBeDefined();
  if (createdAtIndex) {
    expect(createdAtIndex.unique).toBe(false);
  }
});

test("Dexie schema has session table with &id primary key", () => {
  const sessionSchema = db.table("session").schema;
  expect(sessionSchema.primKey.keyPath).toBe("id");
  expect(sessionSchema.primKey.unique).toBe(true);
});

test("Dexie schema version 5 indexes messages by session and creation time", () => {
  expect(db.verno).toBe(5);
  const compoundIndex = db
    .table("message")
    .schema.indexes.find((idx) => idx.name === "[sessionId+createdAt]");
  expect(compoundIndex?.keyPath).toEqual(["sessionId", "createdAt"]);
});

test("Dexie schema version 5 keeps the Usage Ledger by response id, session and time", () => {
  const usage = db.table("usage").schema;
  expect(usage.primKey.keyPath).toBe("id");
  expect(usage.indexes.map((idx) => idx.name).sort()).toEqual(["createdAt", "sessionId"]);
});
