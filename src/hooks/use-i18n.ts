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

// The SPA shell (sidebar included) is prerendered without a browser, where `readLocale` is "en".
const PRERENDER_LOCALE = "en" as const;
const readPrerenderLocale = () => PRERENDER_LOCALE;

/**
 * Hydrates with the prerendered locale so the markup matches, then switches to the visitor's
 * language; reading it during hydration made React discard the prerendered tree.
 */
export const useLocale = () => useSyncExternalStore(subscribe, readLocale, readPrerenderLocale);

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
