import { db, type UsageRecord } from "@/lib/db";
import type { ModelPrice } from "@/lib/models";

const TOKENS_PER_PRICE_UNIT = 1_000_000;

/** The Estimated Cost in USD of the tokens a response consumed. Cache hits cost nothing. */
export const estimateCost = (
  usage: { inputTokens: number; outputTokens: number },
  price: ModelPrice,
  { cacheHit = false }: { cacheHit?: boolean } = {},
) =>
  cacheHit
    ? 0
    : (usage.inputTokens * price.input + usage.outputTokens * price.output) / TOKENS_PER_PRICE_UNIT;

export const recordUsage = (record: UsageRecord) => db.usage.put(record);

export const listUsageSince = (since: Date) =>
  db.usage.where("createdAt").aboveOrEqual(since).sortBy("createdAt");

export const listConversationUsage = (sessionId: string) =>
  db.usage.where("sessionId").equals(sessionId).toArray();

export const listAllUsage = () => db.usage.orderBy("createdAt").toArray();

export const countUsageRecords = () => db.usage.count();

/** Empties the Usage Ledger; Conversation History is untouched. */
export const clearUsageLedger = () => db.usage.clear();

export interface UsageTotals {
  inputTokens: number;
  outputTokens: number;
  /** Total Estimated Cost of the records that have one. */
  cost: number;
  /** Whether any record has an Estimated Cost. */
  priced: boolean;
}

export const sumUsage = (records: UsageRecord[]): UsageTotals =>
  records.reduce<UsageTotals>(
    (totals, record) => ({
      inputTokens: totals.inputTokens + record.inputTokens,
      outputTokens: totals.outputTokens + record.outputTokens,
      cost: totals.cost + (record.cost ?? 0),
      priced: totals.priced || record.cost !== undefined,
    }),
    { inputTokens: 0, outputTokens: 0, cost: 0, priced: false },
  );

/** Formats an Estimated Cost in USD, keeping small amounts readable. */
export const formatCost = (cost: number, locale?: string) =>
  new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: cost > 0 && cost < 1 ? 4 : 2,
  }).format(cost);
