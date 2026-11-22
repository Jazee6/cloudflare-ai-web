import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  applyTheme,
  readThemePreference,
  THEME_CHANGE_EVENT,
  THEME_STORAGE_KEY,
  type ThemePreference,
  writeThemePreference,
} from "@/lib/theme";

const subscribe = (onChange: () => void) => {
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY) {
      applyTheme(readThemePreference());
      onChange();
    }
  };
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
};

const getServerSnapshot = (): ThemePreference => "system";

export const useTheme = () => {
  const theme = useSyncExternalStore(subscribe, readThemePreference, getServerSnapshot);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== "system") {
      return;
    }
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((preference: ThemePreference) => {
    writeThemePreference(preference);
  }, []);

  return { theme, setTheme };
};
