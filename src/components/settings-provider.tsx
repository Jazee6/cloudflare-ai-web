import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  type AppSettings,
  DEFAULT_SETTINGS,
  loadSettings,
  parseSettings,
  saveSettings,
  SETTINGS_STORAGE_KEY,
} from "@/lib/settings";

interface SettingsContextValue {
  settings: AppSettings;
  ready: boolean;
  updateSettings: (patch: Partial<AppSettings>) => void;
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());
    setReady(true);

    const onStorage = (event: StorageEvent) => {
      if (event.key !== SETTINGS_STORAGE_KEY) {
        return;
      }
      if (!event.newValue) {
        setSettings({ ...DEFAULT_SETTINGS });
        return;
      }
      try {
        setSettings(parseSettings(JSON.parse(event.newValue)));
      } catch {
        setSettings({ ...DEFAULT_SETTINGS });
      }
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((current) => {
      const next = parseSettings({ ...current, ...patch });
      saveSettings(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ settings, ready, updateSettings, settingsOpen, setSettingsOpen }),
    [settings, ready, updateSettings, settingsOpen],
  );

  return <SettingsContext value={value}>{children}</SettingsContext>;
};

export const useSettings = (): SettingsContextValue => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within SettingsProvider");
  }
  return context;
};
