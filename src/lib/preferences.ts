import * as v from "valibot";
import type { Model } from "@/lib/models";

export const PREFERENCES_STORAGE_KEY = "cf-ai-preferences-v1";

const preferencesSchema = v.object({
  modelId: v.optional(v.string()),
  imageModelId: v.optional(v.string()),
  searchEnabled: v.optional(v.boolean()),
  knowledgeBase: v.optional(v.string()),
});

export type Preferences = v.InferOutput<typeof preferencesSchema>;
export type PreferenceKey = keyof Preferences;
export type ModelPreferenceKey = "modelId" | "imageModelId";

const LEGACY_PREFERENCE_COOKIES = [
  "CF_AI_MODEL",
  "CF_AI_MODEL_IMAGE",
  "CF_AI_SEARCH_ENABLED",
  "CF_AI_KNOWLEDGE_BASE",
] as const;

export const parseCookieString = (cookie: string): Record<string, string> => {
  const entries: Record<string, string> = {};
  for (const entry of cookie.split(";")) {
    const separator = entry.indexOf("=");
    if (separator <= 0) {
      continue;
    }
    try {
      const name = decodeURIComponent(entry.slice(0, separator).trim());
      entries[name] = decodeURIComponent(entry.slice(separator + 1).trim());
    } catch {
      // Ignore malformed cookie entries.
    }
  }
  return entries;
};

export const legacyCookiesToPreferences = (cookies: Record<string, string>): Preferences => {
  const preferences: Preferences = {};
  if (cookies.CF_AI_MODEL) {
    preferences.modelId = cookies.CF_AI_MODEL;
  }
  if (cookies.CF_AI_MODEL_IMAGE) {
    preferences.imageModelId = cookies.CF_AI_MODEL_IMAGE;
  }
  if (cookies.CF_AI_SEARCH_ENABLED !== undefined) {
    preferences.searchEnabled = cookies.CF_AI_SEARCH_ENABLED === "true";
  }
  if (cookies.CF_AI_KNOWLEDGE_BASE?.trim()) {
    preferences.knowledgeBase = cookies.CF_AI_KNOWLEDGE_BASE.trim();
  }
  return preferences;
};

export const parsePreferences = (raw: string | null): Preferences | null => {
  if (!raw) {
    return null;
  }
  try {
    const parsed = v.safeParse(preferencesSchema, JSON.parse(raw));
    return parsed.success ? parsed.output : null;
  } catch {
    return null;
  }
};

export const deleteCookie = (name: string) => {
  document.cookie = `${encodeURIComponent(name)}=; path=/; max-age=0`;
};

const migrateLegacyCookies = (): Preferences => {
  const cookies = parseCookieString(document.cookie);
  const preferences = legacyCookiesToPreferences(cookies);
  for (const name of LEGACY_PREFERENCE_COOKIES) {
    if (name in cookies) {
      deleteCookie(name);
    }
  }
  return preferences;
};

export const readPreferences = (): Preferences => {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const stored = parsePreferences(window.localStorage.getItem(PREFERENCES_STORAGE_KEY));
    if (stored) {
      return stored;
    }
    const migrated = migrateLegacyCookies();
    writePreferences(migrated);
    return migrated;
  } catch {
    return {};
  }
};

export const writePreferences = (preferences: Preferences) => {
  try {
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Ignore storage quota or private browsing failures.
  }
};

export const getStoredModel = (models: Model[], key: ModelPreferenceKey) => {
  const storedModelId = readPreferences()[key];
  return models.find((model) => model.id === storedModelId) ?? models[0];
};
