export const THEME_COOKIE = "CF_AI_THEME";

export const themeOptions = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const;

export type ThemePreference = (typeof themeOptions)[number]["value"];

export const parseThemePreference = (value: string | undefined): ThemePreference =>
  themeOptions.some((option) => option.value === value) ? (value as ThemePreference) : "system";
