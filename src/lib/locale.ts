export const LANGUAGE_STORAGE_KEY = "cf-ai-language";
export const LANGUAGE_CHANGE_EVENT = "cf-ai-language-change";

export const LOCALES = ["en", "zh-CN"] as const;
export type Locale = (typeof LOCALES)[number];
export type LanguagePreference = "system" | Locale;

export const LANGUAGE_PREFERENCES: readonly LanguagePreference[] = ["system", ...LOCALES];

export const parseLanguagePreference = (value: string | null | undefined): LanguagePreference =>
  LANGUAGE_PREFERENCES.includes(value as LanguagePreference)
    ? (value as LanguagePreference)
    : "system";

/** The first browser language the app supports; Chinese variants all use zh-CN. */
export const resolveLocale = (
  preference: LanguagePreference,
  browserLanguages: readonly string[],
): Locale => {
  if (preference !== "system") {
    return preference;
  }
  for (const language of browserLanguages) {
    const lower = language.toLowerCase();
    if (lower.startsWith("zh")) {
      return "zh-CN";
    }
    if (lower.startsWith("en")) {
      return "en";
    }
  }
  return "en";
};

export const readLanguagePreference = (): LanguagePreference => {
  if (typeof window === "undefined") {
    return "system";
  }
  try {
    return parseLanguagePreference(window.localStorage.getItem(LANGUAGE_STORAGE_KEY));
  } catch {
    return "system";
  }
};

const browserLanguages = () =>
  typeof navigator === "undefined"
    ? []
    : navigator.languages?.length
      ? navigator.languages
      : [navigator.language];

export const readLocale = (): Locale => resolveLocale(readLanguagePreference(), browserLanguages());

export const applyLocale = (locale: Locale) => {
  document.documentElement.lang = locale;
};

export const writeLanguagePreference = (preference: LanguagePreference) => {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, preference);
  } catch {
    // Ignore storage quota or private browsing failures.
  }
  applyLocale(readLocale());
  window.dispatchEvent(new Event(LANGUAGE_CHANGE_EVENT));
};

/** Inline pre-paint script that sets `<html lang>` before the bundle loads. */
export const languageScript = `(function(){try{var p=localStorage.getItem(${JSON.stringify(LANGUAGE_STORAGE_KEY)});var l=p==="en"||p==="zh-CN"?p:null;if(!l){var a=navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language];l="en";for(var i=0;i<a.length;i++){var x=String(a[i]).toLowerCase();if(x.indexOf("zh")===0){l="zh-CN";break}if(x.indexOf("en")===0)break}}document.documentElement.lang=l;}catch(e){}})();`;
