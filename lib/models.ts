import * as v from "valibot";

export type ModelType = "Text Generation" | "Text to Image";
export type ModelProvider = "workers-ai" | "ai-gateway";
export type ModelSource = "cloudflare" | "external";
export type ModelInput = "image" | "search";

export interface Model {
  id: string;
  name: string;
  brand: string;
  type: ModelType;
  provider: ModelProvider;
  source: ModelSource;
  input?: ModelInput[];
  reasoning?: boolean;
  /** The most tokens one inference request can occupy, when the provider publishes it. */
  contextWindow?: number;
  tag?: string[];
  isGatewayRoute?: boolean;
  /** Server-only BYOK stored-key alias (`cf-aig-byok-alias`), stripped from public responses. */
  byokAlias?: string;
}

export interface AppCapabilities {
  documents: boolean;
  webFetch: boolean;
  browserRender: boolean;
  knowledgeBase: boolean;
}

export interface ModelCatalogResponse {
  models: Model[];
  capabilities: AppCapabilities;
}

const BRAND_NAMES: Record<string, string> = {
  anthropic: "Anthropic",
  "aws-bedrock": "AWS Bedrock",
  "azure-openai": "Azure OpenAI",
  "black-forest-labs": "Black Forest Labs",
  bytedance: "ByteDance",
  cerebras: "Cerebras",
  cohere: "Cohere",
  deepseek: "DeepSeek",
  "deepseek-ai": "DeepSeek",
  dynamic: "AI Gateway",
  fireworks: "Fireworks",
  google: "Google",
  "google-ai-studio": "Google",
  "google-vertex-ai": "Google",
  grok: "xAI",
  groq: "Groq",
  huggingface: "Hugging Face",
  leonardo: "Leonardo",
  lykon: "Lykon",
  meta: "Meta",
  mistral: "Mistral",
  mistralai: "Mistral",
  moonshotai: "Moonshot AI",
  openai: "OpenAI",
  openrouter: "OpenRouter",
  "perplexity-ai": "Perplexity",
  qwen: "Qwen",
  xai: "xAI",
  "zai-org": "ZAI",
};

const formatNamespaceBrand = (namespace: string) =>
  BRAND_NAMES[namespace] ??
  namespace
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export const getModelName = (id: string) => id.split("/").at(-1) ?? id;

export const getModelBrand = (id: string) => {
  const namespace = id.split("/")[1];
  if (!namespace) {
    return "Other";
  }

  return formatNamespaceBrand(namespace);
};

export const getModelGroup = (model: Model) =>
  model.source === "external" ? "External" : model.brand;

export const toPublicModel = (model: Model): Model => {
  const { byokAlias: _, ...publicModel } = model;
  return publicModel;
};

const GATEWAY_ENTRY_START_RE = /^[a-z0-9][a-z0-9._-]*\/[^?&=]+/i;
const GATEWAY_PREFIX_RE = /^[a-z0-9][a-z0-9._-]*$/i;

const gatewayQuerySchema = v.strictObject({
  name: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1))),
  input: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1))),
  reasoning: v.optional(v.picklist(["true", "false"])),
  contextWindow: v.optional(
    v.pipe(
      v.string(),
      v.trim(),
      v.regex(/^[1-9]\d*$/),
      v.transform((value) => Number(value)),
      v.safeInteger(),
      v.minValue(1),
    ),
  ),
  byokAlias: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1))),
});

const modelInputSchema = v.picklist(["image", "search"]);

const splitGatewayEntries = (raw: string): string[] => {
  const entries: string[] = [];

  for (const segment of raw.split(",")) {
    const trimmed = segment.trim();
    const previous = entries.at(-1);

    if (
      trimmed.length > 0 &&
      previous !== undefined &&
      previous.includes("?") &&
      !GATEWAY_ENTRY_START_RE.test(trimmed)
    ) {
      entries[entries.length - 1] = `${previous},${trimmed}`;
      continue;
    }

    if (trimmed.length > 0) {
      entries.push(trimmed);
    }
  }

  return entries;
};

export const parseGatewayModels = (raw: string | undefined): Model[] => {
  if (!raw || !raw.trim()) {
    return [];
  }

  const models: Model[] = [];
  const seenIds = new Set<string>();

  for (const entry of splitGatewayEntries(raw)) {
    const queryIndex = entry.indexOf("?");
    const id = (queryIndex === -1 ? entry : entry.slice(0, queryIndex)).trim();
    const queryString = queryIndex === -1 ? "" : entry.slice(queryIndex + 1);

    const slashIndex = id.indexOf("/");
    const prefix = slashIndex === -1 ? "" : id.slice(0, slashIndex);
    const modelId = slashIndex === -1 ? "" : id.slice(slashIndex + 1);

    if (!prefix || !modelId || !GATEWAY_PREFIX_RE.test(prefix) || /[?&=]/.test(id)) {
      console.warn(`Ignoring invalid CF_AI_GATEWAY_MODELS entry: "${entry}"`);
      continue;
    }

    if (seenIds.has(id)) {
      console.warn(`Ignoring duplicate CF_AI_GATEWAY_MODELS entry: "${id}"`);
      continue;
    }

    const paramsRecord: Record<string, string> = {};
    let hasDuplicateQueryKey = false;
    for (const [key, value] of new URLSearchParams(queryString)) {
      if (key in paramsRecord) {
        hasDuplicateQueryKey = true;
        break;
      }
      paramsRecord[key] = value;
    }
    if (hasDuplicateQueryKey) {
      console.warn(`Ignoring CF_AI_GATEWAY_MODELS entry with duplicate query keys: "${entry}"`);
      continue;
    }

    const parsedParams = v.safeParse(gatewayQuerySchema, paramsRecord);
    if (!parsedParams.success) {
      console.warn(`Ignoring CF_AI_GATEWAY_MODELS entry with invalid parameters: "${entry}"`);
      continue;
    }

    let input: ModelInput[] | undefined;
    if (parsedParams.output.input !== undefined) {
      const rawInputs = parsedParams.output.input.split(",").map((item) => item.trim());
      const validInputs: ModelInput[] = [];
      let invalidInput = rawInputs.length === 0;
      for (const candidate of rawInputs) {
        const parsedInput = v.safeParse(modelInputSchema, candidate);
        if (!parsedInput.success) {
          invalidInput = true;
          break;
        }
        if (!validInputs.includes(parsedInput.output)) {
          validInputs.push(parsedInput.output);
        }
      }
      if (invalidInput) {
        console.warn(`Ignoring CF_AI_GATEWAY_MODELS entry with invalid input list: "${entry}"`);
        continue;
      }
      input = validInputs;
    }

    const normalizedPrefix = prefix.toLowerCase();
    const isGatewayRoute = normalizedPrefix === "dynamic";

    seenIds.add(id);
    models.push({
      id,
      name: parsedParams.output.name ?? getModelName(id),
      brand: formatNamespaceBrand(normalizedPrefix),
      type: "Text Generation",
      provider: "ai-gateway",
      source: "external",
      ...(input && input.length > 0 ? { input } : {}),
      ...(parsedParams.output.reasoning === "true" ? { reasoning: true } : {}),
      ...(parsedParams.output.contextWindow !== undefined
        ? { contextWindow: parsedParams.output.contextWindow }
        : {}),
      ...(isGatewayRoute ? { isGatewayRoute: true } : {}),
      ...(parsedParams.output.byokAlias ? { byokAlias: parsedParams.output.byokAlias } : {}),
    });
  }

  return models;
};

export const getExternalModels = (): Model[] => {
  const models = parseGatewayModels(process.env.CF_AI_GATEWAY_MODELS);
  if (models.length === 0) {
    return [];
  }

  if (
    !process.env.CF_ACCOUNT_ID ||
    !process.env.CF_AI_GATEWAY_NAME ||
    !process.env.CF_AI_GATEWAY_TOKEN
  ) {
    console.warn(
      "CF_AI_GATEWAY_MODELS is configured, but CF_ACCOUNT_ID, CF_AI_GATEWAY_NAME, or CF_AI_GATEWAY_TOKEN is missing. External models are disabled.",
    );
    return [];
  }

  return models;
};
