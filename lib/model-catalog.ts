import { after } from "next/server";
import * as v from "valibot";
import {
  getExternalModels,
  getModelBrand,
  getModelName,
  type Model,
  type ModelInput,
  type ModelType,
} from "@/lib/models";

const CATALOG_TTL_MS = 60 * 60 * 1000;
const CATALOG_TIMEOUT_MS = 5_000;
const MODELS_PER_PAGE = 100;

const cloudflarePropertySchema = v.object({
  property_id: v.string(),
  value: v.unknown(),
});

const cloudflareModelSchema = v.object({
  id: v.string(),
  source: v.number(),
  name: v.string(),
  description: v.string(),
  task: v.object({
    id: v.string(),
    name: v.string(),
    description: v.string(),
  }),
  tags: v.array(v.string()),
  properties: v.array(cloudflarePropertySchema),
});

const cloudflareCatalogResponseSchema = v.object({
  success: v.literal(true),
  result: v.array(cloudflareModelSchema),
  result_info: v.optional(
    v.object({
      page: v.number(),
      per_page: v.number(),
      count: v.number(),
      total_count: v.number(),
    }),
  ),
});

type CloudflareModel = v.InferOutput<typeof cloudflareModelSchema>;
type CloudflareTask = "Text Generation" | "Text-to-Image";

type CatalogCacheEntry = {
  models?: Model[];
  refreshedAt: number;
  refresh?: Promise<Model[]>;
};

const globalCatalog = globalThis as typeof globalThis & {
  cloudflareModelCatalogCache?: Map<CloudflareTask, CatalogCacheEntry>;
};
const taskCache =
  globalCatalog.cloudflareModelCatalogCache ?? new Map<CloudflareTask, CatalogCacheEntry>();
globalCatalog.cloudflareModelCatalogCache = taskCache;

const normalizeSignal = (value: string) => value.trim().toLowerCase();
const normalizeTask = (value: string) =>
  normalizeSignal(value).replaceAll("-", " ").replaceAll(/\s+/g, " ");

export const hasSignal = (
  model: CloudflareModel,
  names: string[],
  acceptedValues = ["true", "1", "yes", "supported"],
) => {
  const normalizedNames = names.map(normalizeSignal);
  const normalizedAcceptedValues = acceptedValues.map(normalizeSignal);

  // Tags must match exactly (after normalization); no substring matching.
  if (model.tags.some((tag) => normalizedNames.includes(normalizeSignal(tag)))) {
    return true;
  }

  return model.properties.some((property) => {
    if (typeof property.value !== "string") {
      return false;
    }

    // Property name must match exactly; value must be one of the accepted values.
    const propertyName = normalizeSignal(property.property_id);
    const propertyValue = normalizeSignal(property.value);
    return (
      normalizedNames.includes(propertyName) && normalizedAcceptedValues.includes(propertyValue)
    );
  });
};

const toModel = (model: CloudflareModel, type: ModelType): Model => {
  const input: ModelInput[] = [];
  if (
    type === "Text Generation" &&
    hasSignal(model, ["vision", "multimodal", "image input", "image-input"])
  ) {
    input.push("image");
  }

  const reasoning =
    type === "Text Generation" && hasSignal(model, ["reasoning", "reasoning model"]);
  const experimental = hasSignal(model, ["experimental", "beta"]);

  return {
    id: model.name,
    name: getModelName(model.name),
    brand: getModelBrand(model.name),
    type,
    provider: "workers-ai",
    source: "cloudflare",
    ...(input.length > 0 ? { input } : {}),
    ...(reasoning ? { reasoning: true } : {}),
    ...(experimental ? { tag: ["experimental"] } : {}),
  };
};

const fetchTaskModels = async (task: CloudflareTask): Promise<Model[]> => {
  const accountId = process.env.CF_ACCOUNT_ID;
  const apiToken = process.env.CF_WORKERS_AI_TOKEN;
  if (!accountId || !apiToken) {
    throw new Error("Missing CF_ACCOUNT_ID or CF_WORKERS_AI_TOKEN");
  }

  const signal = AbortSignal.timeout(CATALOG_TIMEOUT_MS);
  const models: CloudflareModel[] = [];
  let page = 1;

  while (true) {
    const url = new URL(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/models/search`,
    );
    url.searchParams.set("task", task);
    url.searchParams.set("hide_experimental", "false");
    url.searchParams.set("include_deprecated", "false");
    url.searchParams.set("page", String(page));
    url.searchParams.set("per_page", String(MODELS_PER_PAGE));

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
      signal,
    });

    if (!response.ok) {
      throw new Error(`Cloudflare models API returned ${response.status}`);
    }

    const parsed = v.safeParse(cloudflareCatalogResponseSchema, await response.json());
    if (!parsed.success) {
      throw new Error("Cloudflare models API returned an invalid response");
    }

    models.push(...parsed.output.result);
    const { result, result_info: resultInfo } = parsed.output;
    const hasMore = resultInfo
      ? result.length > 0 && models.length < resultInfo.total_count
      : result.length === MODELS_PER_PAGE;

    if (!hasMore) {
      break;
    }
    page += 1;
  }

  const type: ModelType = task === "Text Generation" ? "Text Generation" : "Text to Image";
  const expectedTask = normalizeTask(task);
  // Inpainting models are listed under Text-to-Image but require a mask input,
  // so they cannot serve plain text-to-image requests. Moderation models are
  // safety classifiers, not conversational chat models.
  const isChatModel = (model: CloudflareModel) =>
    !hasSignal(model, ["moderation", "safety", "content-filtering", "guardrails"]);
  const supportsPromptOnly = (model: CloudflareModel) => !model.name.includes("inpainting");
  const uniqueModels = new Map(
    models
      .filter(
        (model) =>
          normalizeTask(model.task.name) === expectedTask &&
          (type === "Text to Image" ? supportsPromptOnly(model) : isChatModel(model)),
      )
      .map((model) => [model.name, model]),
  );

  return Array.from(uniqueModels.values(), (model) => toModel(model, type));
};

const refreshTask = (task: CloudflareTask, entry: CatalogCacheEntry) => {
  if (!entry.refresh) {
    entry.refresh = fetchTaskModels(task)
      .then((models) => {
        entry.models = models;
        entry.refreshedAt = Date.now();
        return models;
      })
      .finally(() => {
        entry.refresh = undefined;
      });
  }

  return entry.refresh;
};

const getTaskModels = async (task: CloudflareTask): Promise<Model[]> => {
  const entry = taskCache.get(task) ?? { refreshedAt: 0 };
  taskCache.set(task, entry);

  if (entry.models && Date.now() - entry.refreshedAt < CATALOG_TTL_MS) {
    return entry.models;
  }

  const refresh = refreshTask(task, entry);
  if (entry.models) {
    after(async () => {
      try {
        await refresh;
      } catch (error) {
        console.warn(`Failed to refresh ${task} model catalog`, error);
      }
    });
    return entry.models;
  }

  try {
    return await refresh;
  } catch (error) {
    console.warn(`Failed to load ${task} model catalog`, error);
    return [];
  }
};

export const getModelCatalog = async (): Promise<Model[]> => {
  const [chatModels, imageModels] = await Promise.all([
    getTaskModels("Text Generation"),
    getTaskModels("Text-to-Image"),
  ]);

  return [...chatModels, ...imageModels, ...getExternalModels()];
};

export const getCatalogModel = async (id: string, type: ModelType, provider: Model["provider"]) => {
  if (provider === "google") {
    return getExternalModels().find((model) => model.id === id && model.type === type);
  }

  const task: CloudflareTask = type === "Text Generation" ? "Text Generation" : "Text-to-Image";
  const models = await getTaskModels(task);
  return models.find((model) => model.id === id);
};
