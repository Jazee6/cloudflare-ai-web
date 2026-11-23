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
  PERSONAL_PROVIDERS_STORAGE_KEY,
  type PersonalProvider,
  parsePersonalProviders,
  readPersonalProviders,
  writePersonalProviders,
} from "@/lib/personal-providers";

interface PersonalProvidersContextValue {
  providers: PersonalProvider[];
  ready: boolean;
  updateProviders: (update: (current: PersonalProvider[]) => PersonalProvider[]) => void;
}

const PersonalProvidersContext = createContext<PersonalProvidersContextValue | null>(null);

/** The visitor's Personal Providers, kept in this browser's localStorage. */
export const PersonalProvidersProvider = ({ children }: { children: ReactNode }) => {
  const [providers, setProviders] = useState<PersonalProvider[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setProviders(readPersonalProviders());
    setReady(true);

    const onStorage = (event: StorageEvent) => {
      if (event.key === PERSONAL_PROVIDERS_STORAGE_KEY) {
        setProviders(parsePersonalProviders(event.newValue));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const updateProviders = useCallback(
    (update: (current: PersonalProvider[]) => PersonalProvider[]) => {
      setProviders((current) => {
        const next = update(current);
        if (next !== current) {
          writePersonalProviders(next);
        }
        return next;
      });
    },
    [],
  );

  const value = useMemo(
    () => ({ providers, ready, updateProviders }),
    [providers, ready, updateProviders],
  );

  return <PersonalProvidersContext value={value}>{children}</PersonalProvidersContext>;
};

export const usePersonalProviders = () => {
  const context = useContext(PersonalProvidersContext);
  if (!context) {
    throw new Error("usePersonalProviders must be used within PersonalProvidersProvider");
  }
  return context;
};
