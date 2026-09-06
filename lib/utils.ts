export { cn } from "cn";

import type { Model } from "@/lib/models";

export type StoredModelKey = "CF_AI_MODEL" | "CF_AI_MODEL_IMAGE";
export type StoredPreferenceKey = StoredModelKey | "CF_AI_SEARCH_ENABLED" | "CF_AI_THEME";

export const getCookie = (name: string) => {
  if (typeof document === "undefined") {
    return undefined;
  }

  const cookie = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${encodeURIComponent(name)}=`));

  return cookie ? decodeURIComponent(cookie.slice(cookie.indexOf("=") + 1)) : undefined;
};

export const setCookie = (name: StoredPreferenceKey, value: string) => {
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 365}`;
};

export const deleteCookie = (name: StoredModelKey) => {
  document.cookie = `${encodeURIComponent(name)}=; path=/; max-age=0`;
};

export const getStoredModel = (models: Model[], key: StoredModelKey) => {
  const storedModelId = getCookie(key);
  return models.find((model) => model.id === storedModelId) ?? models[0];
};
