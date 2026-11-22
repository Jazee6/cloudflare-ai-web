export const THEME_STORAGE_KEY = "cf-ai-theme";
/** next-themes stored the 5.x preference in localStorage and a cookie under this name. */
export const LEGACY_THEME_KEY = "CF_AI_THEME";
export const THEME_CHANGE_EVENT = "cf-ai-theme-change";

export const themeOptions = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const;

export type ThemePreference = (typeof themeOptions)[number]["value"];
export type ResolvedTheme = Exclude<ThemePreference, "system">;

export const parseThemePreference = (value: string | null | undefined): ThemePreference =>
  themeOptions.some((option) => option.value === value) ? (value as ThemePreference) : "system";

export const resolveTheme = (preference: ThemePreference, prefersDark: boolean): ResolvedTheme =>
  preference === "system" ? (prefersDark ? "dark" : "light") : preference;

const readLegacyThemeCookie = () => {
  const match = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${LEGACY_THEME_KEY}=`));
  return match?.slice(LEGACY_THEME_KEY.length + 1);
};

export const readThemePreference = (): ThemePreference => {
  if (typeof window === "undefined") {
    return "system";
  }
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored !== null) {
      return parseThemePreference(stored);
    }
    const legacy = parseThemePreference(
      window.localStorage.getItem(LEGACY_THEME_KEY) ?? readLegacyThemeCookie(),
    );
    window.localStorage.setItem(THEME_STORAGE_KEY, legacy);
    window.localStorage.removeItem(LEGACY_THEME_KEY);
    document.cookie = `${LEGACY_THEME_KEY}=; path=/; max-age=0`;
    return legacy;
  } catch {
    return "system";
  }
};

export const applyTheme = (preference: ThemePreference) => {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolved = resolveTheme(preference, prefersDark);
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
};

export const writeThemePreference = (preference: ThemePreference) => {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Ignore storage quota or private browsing failures.
  }
  applyTheme(preference);
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
};

/**
 * Inline pre-paint script for the SPA shell. Keep it dependency-free: it runs before the bundle.
 * The legacy next-themes key is read as a fallback until the app migrates it.
 */
export const themeScript = `(function(){try{var s=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})||localStorage.getItem(${JSON.stringify(LEGACY_THEME_KEY)});var t=s==="light"||s==="dark"?s:(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");var r=document.documentElement;if(t==="dark")r.classList.add("dark");r.style.colorScheme=t;}catch(e){}})();`;
