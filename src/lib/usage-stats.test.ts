import { expect, test } from "bun:test";
import type { UsageRecord } from "@/lib/db";
import {
  assignUsageSeries,
  bucketCostByDay,
  niceCeiling,
  OTHER_SERIES,
  summarizeByModel,
} from "@/lib/usage-stats";

const now = new Date(2026, 10, 23, 15);
const record = (id: string, modelId: string, daysAgo: number, cost?: number): UsageRecord => ({
  id,
  sessionId: "s",
  createdAt: new Date(2026, 10, 23 - daysAgo, 10),
  modelId,
  modelName: modelId.toUpperCase(),
  inputTokens: 100,
  outputTokens: 10,
  ...(cost === undefined ? {} : { cost }),
});

test("summarizes per model and keeps unpriced models without a cost", () => {
  const rows = summarizeByModel([
    record("1", "a", 0, 1),
    record("2", "a", 1, 2),
    record("3", "b", 0),
  ]);
  expect(rows).toEqual([
    { modelId: "a", modelName: "A", responses: 2, inputTokens: 200, outputTokens: 20, cost: 3 },
    { modelId: "b", modelName: "B", responses: 1, inputTokens: 100, outputTokens: 10 },
  ]);
});

test("gives the costliest models their own series and folds the rest into Other", () => {
  const records = ["a", "b", "c", "d", "e", "f"].map((id, index) => record(id, id, 0, 10 - index));
  const series = assignUsageSeries(records);
  expect(series.get("a")).toBe(0);
  expect(series.get("e")).toBe(4);
  expect(series.get("f")).toBe(OTHER_SERIES);
});

test("buckets cost by local day, oldest first, ending today", () => {
  const records = [record("1", "a", 0, 1), record("2", "a", 2, 2), record("3", "a", 9, 5)];
  const days = bucketCostByDay(records, assignUsageSeries(records), 7, now);
  expect(days).toHaveLength(7);
  expect(days.at(-1)?.total).toBe(1);
  expect(days.at(-3)?.total).toBe(2);
  expect(days.reduce((sum, day) => sum + day.total, 0)).toBe(3);
});

test("rounds axis maxima to clean numbers", () => {
  expect(niceCeiling(0)).toBe(0);
  expect(niceCeiling(0.0031)).toBeCloseTo(0.004);
  expect(niceCeiling(1.2)).toBe(1.5);
  expect(niceCeiling(2.2)).toBe(2.5);
  expect(niceCeiling(7)).toBe(8);
  expect(niceCeiling(0.26)).toBeCloseTo(0.3);
});
