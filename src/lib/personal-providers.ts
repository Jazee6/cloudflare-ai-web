import * as v from "valibot";
import { getModelBrand, type Model } from "@/lib/models";

export const PERSONAL_PROVIDERS_STORAGE_KEY = "cf-ai-personal-providers-v1";

/**
 * AI Gateway providers a Personal Provider may use. Only third-party providers billed to the
 * visitor's own key are listed; `workers-ai` and other providers that bill the gateway owner's
 * account are excluded.
 */
export const GATEWAY_PROVIDERS = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  "google-ai-studio": "Google AI Studio",
  grok: "xAI",
  deepseek: "DeepSeek",
  mistral: "Mistral",
  groq: "Groq",
  cerebras: "Cerebras",
  "perplexity-ai": "Perplexity",
  cohere: "Cohere",
} as const;

export type GatewayProviderId = keyof typeof GATEWAY_PROVIDERS;

export const GATEWAY_PROVIDER_IDS = Object.keys(GATEWAY_PROVIDERS) as GatewayProviderId[];

export type ImageProtocol = "openai-images" | "gemini";

/** Image protocols each provider serves; providers not listed cannot declare image models. */
export const IMAGE_PROTOCOLS: Partial<Record<GatewayProviderId, ImageProtocol>> = {
  openai: "openai-images",
  "google-ai-studio": "gemini",
};

/** Model list endpoints, relative to the gateway, for providers that publish one. */
export const MODEL_LIST_PATHS: Partial<Record<GatewayProviderId, string>> = {
  openai: "openai/models",
  deepseek: "deepseek/models",
  groq: "groq/models",
  mistral: "mistral/v1/models",
  grok: "grok/v1/models",
  "google-ai-studio": "google-ai-studio/v1beta/models?pageSize=1000",
};

export const MAX_PERSONAL_PROVIDERS = 20;
export const MAX_PERSONAL_MODELS = 100;
export const MAX_PROVIDER_LABEL_LENGTH = 40;

const DYNAMIC_ROUTE_RE = /^dynamic\//i;

export const isDynamicRoute = (modelId: string) => DYNAMIC_ROUTE_RE.test(modelId);

const trimmedOptional = (max: number) =>
  v.optional(
    v.pipe(
      v.string(),
      v.trim(),
      v.maxLength(max),
      // An empty value means "not provided".
      v.transform((value) => (value.length > 0 ? value : undefined)),
    ),
  );

export const modelIdSchema = v.pipe(
  v.string(),
  v.trim(),
  v.minLength(1, "Enter a model ID."),
  v.maxLength(200, "Use at most 200 characters."),
  v.regex(/^[\w.:@/-]+$/, "Use letters, digits and . _ - : @ / only."),
  // Model IDs reach upstream URL paths, so they must not climb out of the provider's path.
  v.check(
    (id) =>
      !id.startsWith("/") && !id.endsWith("/") && !id.split("/").some((part) => /^\.*$/.test(part)),
    "Model ID segments cannot be empty, . or ..",
  ),
);

export const gatewaySchema = v.object({
  accountId: v.pipe(
    v.string(),
    v.trim(),
    v.regex(/^[a-f0-9]{32}$/i, "Account ID is 32 hexadecimal characters."),
    v.toLowerCase(),
  ),
  gatewayId: v.pipe(
    v.string(),
    v.trim(),
    v.regex(/^[a-z0-9-]{1,64}$/, "Use lowercase letters, digits and hyphens."),
  ),
  token: trimmedOptional(512),
});

export type PersonalGateway = v.InferOutput<typeof gatewaySchema>;

export const personalModelDeclarationSchema = v.pipe(
  v.object({
    modelId: modelIdSchema,
    name: trimmedOptional(100),
    type: v.picklist(["Text Generation", "Text to Image"]),
    imageProtocol: v.optional(v.picklist(["openai-images", "gemini"])),
    input: v.optional(v.array(v.picklist(["image", "search"]))),
    reasoning: v.optional(v.boolean()),
    contextWindow: v.optional(v.pipe(v.number(), v.safeInteger(), v.minValue(1))),
  }),
  v.check(
    (declaration) => (declaration.type === "Text to Image") === Boolean(declaration.imageProtocol),
    "Image models need an image protocol; chat models must not have one.",
  ),
);

export type PersonalModelDeclaration = v.InferOutput<typeof personalModelDeclarationSchema>;

const providerIdSchema = v.picklist(GATEWAY_PROVIDER_IDS);

/** Checks that declarations fit the provider: image protocol and search support. */
const declarationsFitProvider = (provider: GatewayProviderId, models: PersonalModelDeclaration[]) =>
  models.every(
    (model) =>
      (!model.imageProtocol || IMAGE_PROTOCOLS[provider] === model.imageProtocol) &&
      (!model.input?.includes("search") || provider === "google-ai-studio"),
  );

export const personalProviderSchema = v.pipe(
  v.object({
    id: v.pipe(v.string(), v.minLength(1), v.maxLength(64)),
    label: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(MAX_PROVIDER_LABEL_LENGTH)),
    provider: providerIdSchema,
    apiKey: trimmedOptional(1024),
    gateway: v.optional(gatewaySchema),
    models: v.pipe(v.array(personalModelDeclarationSchema), v.maxLength(MAX_PERSONAL_MODELS)),
  }),
  v.check(
    (provider) => declarationsFitProvider(provider.provider, provider.models),
    "A model declares a capability this provider does not support.",
  ),
);

export type PersonalProvider = v.InferOutput<typeof personalProviderSchema>;

/** The `personal` field of `/api/chat` and `/api/image` requests. */
export const personalRequestSchema = v.pipe(
  v.object({
    provider: providerIdSchema,
    declaration: personalModelDeclarationSchema,
    apiKey: trimmedOptional(1024),
    gateway: v.optional(gatewaySchema),
  }),
  v.check(
    (request) => declarationsFitProvider(request.provider, [request.declaration]),
    "The model declares a capability this provider does not support.",
  ),
);

export type PersonalRequest = v.InferOutput<typeof personalRequestSchema>;

/** The `/api/personal-models` request: credentials only. */
export const personalCredentialsSchema = v.object({
  provider: providerIdSchema,
  apiKey: trimmedOptional(1024),
  gateway: v.optional(gatewaySchema),
});

export type PersonalCredentials = v.InferOutput<typeof personalCredentialsSchema>;

const PERSONAL_ID_PREFIX = "personal:";

/** Model Catalog ID of a Personal Model, namespaced so it never collides with External Models. */
export const getPersonalModelId = (providerId: string, modelId: string) =>
  `${PERSONAL_ID_PREFIX}${providerId}:${modelId}`;

export const isPersonalModelId = (id: string) => id.startsWith(PERSONAL_ID_PREFIX);

/** The AI Gateway model string: `dynamic/<route>` as is, otherwise `<provider>/<model>`. */
export const getGatewayModelName = (provider: GatewayProviderId, modelId: string) =>
  isDynamicRoute(modelId) ? modelId : `${provider}/${modelId}`;

export const toPersonalCatalogModel = (
  provider: PersonalProvider,
  declaration: PersonalModelDeclaration,
): Model => ({
  id: getPersonalModelId(provider.id, declaration.modelId),
  name: declaration.name ?? declaration.modelId.split("/").at(-1) ?? declaration.modelId,
  brand: getModelBrand(`x/${provider.provider}`),
  type: declaration.type,
  provider: "ai-gateway",
  source: "personal",
  personalProviderId: provider.id,
  personalProviderLabel: provider.label,
  ...(declaration.imageProtocol ? { imageProtocol: declaration.imageProtocol } : {}),
  ...(declaration.input && declaration.input.length > 0 ? { input: declaration.input } : {}),
  ...(declaration.reasoning ? { reasoning: true } : {}),
  ...(declaration.contextWindow ? { contextWindow: declaration.contextWindow } : {}),
  ...(isDynamicRoute(declaration.modelId) ? { isGatewayRoute: true } : {}),
});

export const getPersonalCatalogModels = (providers: PersonalProvider[]): Model[] =>
  providers.flatMap((provider) =>
    provider.models.map((declaration) => toPersonalCatalogModel(provider, declaration)),
  );

/** Builds the `personal` request field for a Personal Model, or undefined for other models. */
export const getPersonalRequest = (
  model: Model,
  providers: PersonalProvider[],
): PersonalRequest | undefined => {
  if (model.source !== "personal") {
    return undefined;
  }
  const provider = providers.find((candidate) => candidate.id === model.personalProviderId);
  const declaration = provider?.models.find(
    (candidate) => getPersonalModelId(provider.id, candidate.modelId) === model.id,
  );
  if (!provider || !declaration) {
    return undefined;
  }
  return {
    provider: provider.provider,
    declaration,
    ...(provider.apiKey ? { apiKey: provider.apiKey } : {}),
    ...(provider.gateway ? { gateway: provider.gateway } : {}),
  };
};

export const parsePersonalProviders = (raw: string | null): PersonalProvider[] => {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    // Keep every valid provider even if one entry is damaged.
    return parsed.flatMap((item) => {
      const result = v.safeParse(personalProviderSchema, item);
      return result.success ? [result.output] : [];
    });
  } catch {
    return [];
  }
};

export const readPersonalProviders = (): PersonalProvider[] => {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    return parsePersonalProviders(window.localStorage.getItem(PERSONAL_PROVIDERS_STORAGE_KEY));
  } catch {
    return [];
  }
};

export const writePersonalProviders = (providers: PersonalProvider[]) => {
  try {
    window.localStorage.setItem(PERSONAL_PROVIDERS_STORAGE_KEY, JSON.stringify(providers));
  } catch {
    // Ignore storage quota or private browsing failures.
  }
};
