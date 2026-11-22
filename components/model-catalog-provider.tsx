"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as v from "valibot";
import { toast } from "@/components/ui/toast";
import type { AppCapabilities, Model, ModelType } from "@/lib/models";
import { deleteCookie, getCookie, setCookie, type StoredPreferenceKey } from "@/lib/utils";

const CATALOG_STORAGE_KEY = "cf-ai-model-catalog-v1";

const DEFAULT_CAPABILITIES: AppCapabilities = {
  documents: false,
  webFetch: true,
  browserRender: false,
  knowledgeBase: false,
};

const modelSchema = v.object({
  id: v.string(),
  name: v.string(),
  brand: v.string(),
  type: v.picklist(["Text Generation", "Text to Image"]),
  provider: v.picklist(["workers-ai", "ai-gateway"]),
  source: v.picklist(["cloudflare", "external"]),
  input: v.optional(v.array(v.picklist(["image", "search"]))),
  reasoning: v.optional(v.boolean()),
  contextWindow: v.optional(v.number()),
  tag: v.optional(v.array(v.string())),
  isGatewayRoute: v.optional(v.boolean()),
});

const catalogResponseSchema = v.object({
  models: v.array(modelSchema),
  capabilities: v.object({
    documents: v.boolean(),
    webFetch: v.boolean(),
    browserRender: v.boolean(),
    knowledgeBase: v.boolean(),
  }),
});

type ModelCatalogContextValue = {
  models: Model[];
  capabilities: AppCapabilities;
  loading: boolean;
  error: string | null;
  reload: () => void;
};

const ModelCatalogContext = createContext<ModelCatalogContextValue | null>(null);

type ModelPreferenceKey = Exclude<StoredPreferenceKey, "CF_AI_THEME">;
type ModelPreferences = Partial<Record<ModelPreferenceKey, string>>;

const ModelPreferencesContext = createContext<{
  preferences: ModelPreferences;
  ready: boolean;
  setPreference: (key: ModelPreferenceKey, value: string | undefined) => void;
} | null>(null);

export const ModelPreferencesProvider = ({
  children,
  preferences: initialPreferences,
}: {
  children: ReactNode;
  preferences?: ModelPreferences;
}) => {
  const [preferences, setPreferences] = useState<ModelPreferences>(initialPreferences ?? {});
  const [ready, setReady] = useState(initialPreferences !== undefined);

  useEffect(() => {
    if (initialPreferences !== undefined) {
      return;
    }
    const stored: ModelPreferences = {};
    for (const key of ["CF_AI_MODEL", "CF_AI_MODEL_IMAGE", "CF_AI_SEARCH_ENABLED"] as const) {
      const value = getCookie(key);
      if (value !== undefined) {
        stored[key] = value;
      }
    }
    setPreferences(stored);
    setReady(true);
  }, [initialPreferences]);

  const setPreference = useCallback((key: ModelPreferenceKey, value: string | undefined) => {
    if (value === undefined) {
      deleteCookie(key);
    } else {
      setCookie(key, value);
    }
    setPreferences((current) => (current[key] === value ? current : { ...current, [key]: value }));
  }, []);

  const value = useMemo(
    () => ({ preferences, ready, setPreference }),
    [preferences, ready, setPreference],
  );

  return <ModelPreferencesContext value={value}>{children}</ModelPreferencesContext>;
};

const readCachedCatalog = () => {
  try {
    const raw = sessionStorage.getItem(CATALOG_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = v.safeParse(catalogResponseSchema, JSON.parse(raw));
    if (!parsed.success || parsed.output.models.length === 0) {
      return null;
    }
    return parsed.output;
  } catch {
    return null;
  }
};

const writeCachedCatalog = (payload: v.InferOutput<typeof catalogResponseSchema>) => {
  try {
    if (payload.models.length > 0) {
      sessionStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(payload));
    }
  } catch {
    // Ignore storage quota or private browsing failures.
  }
};

export const ModelCatalogProvider = ({
  children,
  models: initialModels,
  capabilities: initialCapabilities,
}: {
  children: ReactNode;
  models?: Model[];
  capabilities?: AppCapabilities;
}) => {
  const [models, setModels] = useState<Model[]>(initialModels ?? []);
  const [capabilities, setCapabilities] = useState<AppCapabilities>(
    initialCapabilities ?? DEFAULT_CAPABILITIES,
  );
  const [loading, setLoading] = useState(initialModels === undefined);
  const [error, setError] = useState<string | null>(null);
  const hasModelsRef = useRef((initialModels?.length ?? 0) > 0);
  const requestIdRef = useRef(0);

  const loadCatalog = useCallback(async (signal?: AbortSignal) => {
    const requestId = ++requestIdRef.current;
    if (!hasModelsRef.current) {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await fetch("/api/models", { signal });
      if (!response.ok) {
        throw new Error(`Failed to fetch models (${response.status})`);
      }

      const parsed = v.safeParse(catalogResponseSchema, await response.json());
      if (!parsed.success) {
        throw new Error("Invalid model catalog response");
      }

      if (signal?.aborted || requestId !== requestIdRef.current) {
        return;
      }

      setModels(parsed.output.models);
      setCapabilities(parsed.output.capabilities);
      hasModelsRef.current = parsed.output.models.length > 0;
      writeCachedCatalog(parsed.output);
      setError(null);
    } catch (caughtError) {
      if (signal?.aborted || requestId !== requestIdRef.current) {
        return;
      }
      if (!hasModelsRef.current) {
        setError("Failed to load models.");
        toast.add({
          title: "Failed to load models. Please try again.",
          type: "error",
        });
      } else {
        console.warn("Failed to refresh model catalog", caughtError);
      }
    } finally {
      if (!signal?.aborted && requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (initialModels !== undefined) {
      return;
    }

    const cached = readCachedCatalog();
    if (cached) {
      setModels(cached.models);
      setCapabilities(cached.capabilities);
      hasModelsRef.current = true;
      setLoading(false);
    }

    const controller = new AbortController();
    void loadCatalog(controller.signal);
    return () => {
      controller.abort();
    };
  }, [initialModels, loadCatalog]);

  const reload = useCallback(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const value = useMemo(
    () => ({ models, capabilities, loading, error, reload }),
    [models, capabilities, loading, error, reload],
  );

  return <ModelCatalogContext value={value}>{children}</ModelCatalogContext>;
};

export const useModelPreferences = () => {
  const context = useContext(ModelPreferencesContext);
  if (!context) {
    throw new Error("useModelPreferences must be used within ModelPreferencesProvider");
  }

  return context;
};

export const useModelCatalogState = (type?: ModelType) => {
  const context = useContext(ModelCatalogContext);
  if (!context) {
    throw new Error("useModelCatalogState must be used within ModelCatalogProvider");
  }

  const filteredModels = useMemo(
    () => (type ? context.models.filter((model) => model.type === type) : context.models),
    [context.models, type],
  );

  return {
    ...context,
    models: filteredModels,
  };
};

export const useModelCatalog = (type?: ModelType) => useModelCatalogState(type).models;
