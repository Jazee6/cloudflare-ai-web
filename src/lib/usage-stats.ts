import type { UsageRecord } from "@/lib/db";

export const USAGE_RANGES = [7, 30, 90] as const;
export type UsageRange = (typeof USAGE_RANGES)[number];

/** Models drawn in their own color; the rest share "Other". */
export const MAX_USAGE_SERIES = 5;
export const OTHER_SERIES = "other";

export interface ModelUsageRow {
  modelId: string;
  /** The name recorded most recently for the model. */
  modelName: string;
  responses: number;
  inputTokens: number;
  outputTokens: number;
  /** Total Estimated Cost, absent when no response of the model had one. */
  cost?: number;
}

export const summarizeByModel = (records: UsageRecord[]): ModelUsageRow[] => {
  const rows = new Map<string, ModelUsageRow & { latest: number }>();
  for (const record of records) {
    const time = new Date(record.createdAt).getTime();
    const row = rows.get(record.modelId) ?? {
      modelId: record.modelId,
      modelName: record.modelName,
      responses: 0,
      inputTokens: 0,
      outputTokens: 0,
      latest: -Infinity,
    };
    row.responses += 1;
    row.inputTokens += record.inputTokens;
    row.outputTokens += record.outputTokens;
    if (record.cost !== undefined) {
      row.cost = (row.cost ?? 0) + record.cost;
    }
    if (time >= row.latest) {
      row.latest = time;
      row.modelName = record.modelName || row.modelName;
    }
    rows.set(record.modelId, row);
  }
  return [...rows.values()]
    .map(({ modelId, modelName, responses, inputTokens, outputTokens, cost }) => ({
      modelId,
      modelName,
      responses,
      inputTokens,
      outputTokens,
      ...(cost === undefined ? {} : { cost }),
    }))
    .sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0) || b.inputTokens - a.inputTokens);
};

/**
 * The series each model is drawn as, by all-time Estimated Cost, so a model keeps its color when
 * the visible range changes. Models past the first few share the "Other" series.
 */
export const assignUsageSeries = (
  records: UsageRecord[],
): Map<string, number | typeof OTHER_SERIES> => {
  const ranked = summarizeByModel(records).filter((row) => (row.cost ?? 0) > 0);
  return new Map(
    ranked.map((row, index) => [row.modelId, index < MAX_USAGE_SERIES ? index : OTHER_SERIES]),
  );
};

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

export interface UsageDay {
  date: Date;
  /** Estimated Cost per series key (a series index or "other"). */
  costs: Map<number | typeof OTHER_SERIES, number>;
  total: number;
}

/** The Estimated Cost of each of the last `days` local days, oldest first, ending today. */
export const bucketCostByDay = (
  records: UsageRecord[],
  series: Map<string, number | typeof OTHER_SERIES>,
  days: number,
  now = new Date(),
): UsageDay[] => {
  const today = startOfDay(now);
  const buckets: UsageDay[] = Array.from({ length: days }, (_, index) => ({
    date: new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1 - index)),
    costs: new Map(),
    total: 0,
  }));
  const first = buckets[0].date.getTime();
  for (const record of records) {
    if (!record.cost) {
      continue;
    }
    const day = startOfDay(new Date(record.createdAt));
    const index = Math.round((day.getTime() - first) / 86_400_000);
    const bucket = buckets[index];
    if (!bucket) {
      continue;
    }
    const key = series.get(record.modelId) ?? OTHER_SERIES;
    bucket.costs.set(key, (bucket.costs.get(key) ?? 0) + record.cost);
    bucket.total += record.cost;
  }
  return buckets;
};

/** The first local midnight of a range of `days` days ending today. */
export const rangeStart = (days: number, now = new Date()) =>
  new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));

/** A clean axis maximum at or above `value`, whose half is also a clean number. */
export const niceCeiling = (value: number) => {
  if (value <= 0) {
    return 0;
  }
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step =
    [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((candidate) => candidate * magnitude >= value) ?? 10;
  return step * magnitude;
};
