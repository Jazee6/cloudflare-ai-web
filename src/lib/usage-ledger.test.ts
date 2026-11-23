import { expect, test } from "bun:test";
import { estimateCost, sumUsage } from "@/lib/usage-ledger";

test("estimates cost per million tokens and charges nothing for cache hits", () => {
  const usage = { inputTokens: 2_000_000, outputTokens: 500_000 };
  expect(estimateCost(usage, { input: 0.35, output: 0.75 })).toBeCloseTo(1.075);
  expect(estimateCost(usage, { input: 0.35, output: 0.75 }, { cacheHit: true })).toBe(0);
});

test("sums tokens for every record and cost only for priced ones", () => {
  const base = { sessionId: "s", createdAt: new Date(), modelId: "m", modelName: "m" };
  const totals = sumUsage([
    { ...base, id: "1", inputTokens: 10, outputTokens: 5, cost: 0.5 },
    { ...base, id: "2", inputTokens: 1, outputTokens: 1 },
  ]);
  expect(totals).toEqual({ inputTokens: 11, outputTokens: 6, cost: 0.5, priced: true });
  expect(sumUsage([]).priced).toBe(false);
});
