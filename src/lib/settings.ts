import * as v from "valibot";

export const SETTINGS_STORAGE_KEY = "cf-ai-settings-v1";
export const MAX_CUSTOM_INSTRUCTIONS_LENGTH = 4_000;
export const MIN_CONTEXT_MESSAGE_LIMIT = 1;
export const MAX_CONTEXT_MESSAGE_LIMIT = 100;

export const ASR_LOCALES = [
  "auto",
  "zh-CN",
  "en-US",
  "ja-JP",
  "ko-KR",
  "fr-FR",
  "de-DE",
  "es-ES",
] as const;

export type AsrLocale = (typeof ASR_LOCALES)[number];
export type WebFetchPolicy = "auto" | "zero-quota";

const asrLocaleSchema = v.picklist(ASR_LOCALES);

const customInstructionsSchema = v.pipe(v.string(), v.maxLength(MAX_CUSTOM_INSTRUCTIONS_LENGTH));
const webFetchPolicySchema = v.picklist(["auto", "zero-quota"]);
const contextMessageLimitSchema = v.pipe(
  v.number(),
  v.integer(),
  v.minValue(MIN_CONTEXT_MESSAGE_LIMIT),
  v.maxValue(MAX_CONTEXT_MESSAGE_LIMIT),
);
const ttsRateSchema = v.pipe(v.number(), v.minValue(0.5), v.maxValue(2));

export const settingsSchema = v.object({
  customInstructions: customInstructionsSchema,
  skipGatewayCache: v.boolean(),
  webFetchPolicy: webFetchPolicySchema,
  /** The Context Message Limit. */
  contextMessageLimit: contextMessageLimitSchema,
  asrLocale: asrLocaleSchema,
  ttsVoiceURI: v.string(),
  ttsRate: ttsRateSchema,
  ttsSkipCodeBlocks: v.boolean(),
});

export type AppSettings = v.InferOutput<typeof settingsSchema>;

export const DEFAULT_SETTINGS: AppSettings = {
  customInstructions: "",
  skipGatewayCache: false,
  webFetchPolicy: "auto",
  contextMessageLimit: MAX_CONTEXT_MESSAGE_LIMIT,
  asrLocale: "auto",
  ttsVoiceURI: "",
  ttsRate: 1,
  ttsSkipCodeBlocks: true,
};

const parseField = <Schema extends v.GenericSchema>(
  schema: Schema,
  value: unknown,
  fallback: v.InferOutput<Schema>,
): v.InferOutput<Schema> => {
  const parsed = v.safeParse(schema, value);
  return parsed.success ? parsed.output : fallback;
};

/** Parses persisted settings with per-field fallback so partial or legacy blobs stay usable. */
export const parseSettings = (input: unknown): AppSettings => {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ...DEFAULT_SETTINGS };
  }

  const record = input as Record<string, unknown>;
  return {
    customInstructions: parseField(
      customInstructionsSchema,
      record.customInstructions,
      DEFAULT_SETTINGS.customInstructions,
    ),
    skipGatewayCache: parseField(
      v.boolean(),
      record.skipGatewayCache,
      DEFAULT_SETTINGS.skipGatewayCache,
    ),
    webFetchPolicy: parseField(
      webFetchPolicySchema,
      record.webFetchPolicy,
      DEFAULT_SETTINGS.webFetchPolicy,
    ),
    contextMessageLimit: parseField(
      contextMessageLimitSchema,
      record.contextMessageLimit,
      DEFAULT_SETTINGS.contextMessageLimit,
    ),
    asrLocale: parseField(asrLocaleSchema, record.asrLocale, DEFAULT_SETTINGS.asrLocale),
    ttsVoiceURI: parseField(v.string(), record.ttsVoiceURI, DEFAULT_SETTINGS.ttsVoiceURI),
    ttsRate: parseField(ttsRateSchema, record.ttsRate, DEFAULT_SETTINGS.ttsRate),
    ttsSkipCodeBlocks: parseField(
      v.boolean(),
      record.ttsSkipCodeBlocks,
      DEFAULT_SETTINGS.ttsSkipCodeBlocks,
    ),
  };
};

export const loadSettings = (): AppSettings => {
  if (typeof window === "undefined") {
    return { ...DEFAULT_SETTINGS };
  }
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_SETTINGS };
    }
    return parseSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
};

export const saveSettings = (settings: AppSettings): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota or private browsing errors.
  }
};
