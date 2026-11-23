import * as v from "valibot";
import type { Model, ModelPrice } from "@/lib/models";

export const MODEL_PRICES_STORAGE_KEY = "cf-ai-model-prices-v1";
/** Dispatched on `window` when this tab changes the declared prices. */
export const MODEL_PRICES_CHANGE_EVENT = "cf-ai-model-prices-change";
export const MAX_MODEL_PRICE = 10_000;

export const modelPriceSchema = v.object({
  input: v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(MAX_MODEL_PRICE)),
  output: v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(MAX_MODEL_PRICE)),
});

/** Model Prices the visitor declared, by model id, for models without a catalog price. */
export type DeclaredModelPrices = Record<string, ModelPrice>;

const declaredPricesSchema = v.record(v.string(), modelPriceSchema);

export const parseDeclaredModelPrices = (raw: string | null): DeclaredModelPrices => {
  if (!raw) {
    return {};
  }
  try {
    const parsed = v.safeParse(declaredPricesSchema, JSON.parse(raw));
    return parsed.success ? parsed.output : {};
  } catch {
    return {};
  }
};

export const readDeclaredModelPrices = (): DeclaredModelPrices => {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    return parseDeclaredModelPrices(window.localStorage.getItem(MODEL_PRICES_STORAGE_KEY));
  } catch {
    return {};
  }
};

/** Declares or, with `undefined`, removes the Model Price of a model. */
export const writeDeclaredModelPrice = (modelId: string, price: ModelPrice | undefined) => {
  const next = { ...readDeclaredModelPrices() };
  if (price) {
    next[modelId] = price;
  } else {
    delete next[modelId];
  }
  try {
    window.localStorage.setItem(MODEL_PRICES_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota or private browsing failures.
  }
  window.dispatchEvent(new Event(MODEL_PRICES_CHANGE_EVENT));
};

/** Whether the visitor may declare a Model Price: chat models without a catalog price. */
export const canDeclareModelPrice = (model: Model) =>
  model.type === "Text Generation" && model.source !== "cloudflare";

/** Cloudflare Models use the catalog price; other chat models use the declared one. */
export const resolveModelPrice = (
  model: Model,
  declared: DeclaredModelPrices,
): ModelPrice | undefined => (model.source === "cloudflare" ? model.price : declared[model.id]);
