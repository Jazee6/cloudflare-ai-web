import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  type CountKey,
  translate,
  translateCount,
  translateError,
  translateText,
  type TranslateParams,
} from "@/lib/i18n";
import {
  applyLocale,
  LANGUAGE_CHANGE_EVENT,
  LANGUAGE_STORAGE_KEY,
  type LanguagePreference,
  readLanguagePreference,
  readLocale,
  writeLanguagePreference,
} from "@/lib/locale";
import type { MessageKey } from "@/locales/en";

const subscribe = (onChange: () => void) => {
  const onStorage = (event: StorageEvent) => {
    if (event.key === LANGUAGE_STORAGE_KEY) {
      onChange();
    }
  };
  window.addEventListener(LANGUAGE_CHANGE_EVENT, onChange);
  window.addEventListener("languagechange", onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(LANGUAGE_CHANGE_EVENT, onChange);
    window.removeEventListener("languagechange", onChange);
    window.removeEventListener("storage", onStorage);
  };
};

/**
 * The SPA shell is prerendered without any UI text, so the client value is safe to use for the
 * hydration snapshot too and the first paint is already in the visitor's language.
 */
export const useLocale = () => useSyncExternalStore(subscribe, readLocale, readLocale);

export const useLanguagePreference = () => {
  const preference = useSyncExternalStore(
    subscribe,
    readLanguagePreference,
    readLanguagePreference,
  );
  const setPreference = useCallback((next: LanguagePreference) => {
    writeLanguagePreference(next);
  }, []);
  return { preference, setPreference };
};

/** Keeps `<html lang>` in step with the app language. */
export const useDocumentLanguage = () => {
  const locale = useLocale();
  useEffect(() => {
    applyLocale(locale);
  }, [locale]);
};

export const useI18n = () => {
  const locale = useLocale();
  const t = useCallback(
    (key: MessageKey, params?: TranslateParams) => translate(locale, key, params),
    [locale],
  );
  const tc = useCallback(
    (key: CountKey, count: number, params?: TranslateParams) =>
      translateCount(locale, key, count, params),
    [locale],
  );
  const tError = useCallback(
    (error: Parameters<typeof translateError>[1]) => translateError(locale, error),
    [locale],
  );
  /** Translates a validation message, which schemas give as a message key. */
  const tText = useCallback((text: string) => translateText(locale, text), [locale]);
  return { locale, t, tc, tError, tText };
};

export type Translate = ReturnType<typeof useI18n>["t"];
