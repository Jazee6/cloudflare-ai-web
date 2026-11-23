import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useModelCatalogState, useModelPreferences } from "@/components/model-catalog-provider";
import {
  applyModelLayout,
  EMPTY_MODEL_LAYOUT,
  MODEL_LAYOUT_STORAGE_KEY,
  type ModelLayout,
  parseModelLayout,
  readModelLayout,
  writeModelLayout,
} from "@/lib/model-layout";
import type { Model } from "@/lib/models";
import { pickSelectedModel } from "@/lib/preferences";

interface ModelLayoutContextValue {
  layout: ModelLayout;
  ready: boolean;
  updateLayout: (update: (current: ModelLayout) => ModelLayout) => void;
}

const ModelLayoutContext = createContext<ModelLayoutContextValue | null>(null);

export const ModelLayoutProvider = ({ children }: { children: ReactNode }) => {
  const [layout, setLayout] = useState<ModelLayout>(EMPTY_MODEL_LAYOUT);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLayout(readModelLayout());
    setReady(true);

    const onStorage = (event: StorageEvent) => {
      if (event.key === MODEL_LAYOUT_STORAGE_KEY) {
        setLayout(parseModelLayout(event.newValue));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const updateLayout = useCallback((update: (current: ModelLayout) => ModelLayout) => {
    setLayout((current) => {
      const next = update(current);
      if (next !== current) {
        writeModelLayout(next);
      }
      return next;
    });
  }, []);

  const value = useMemo(() => ({ layout, ready, updateLayout }), [layout, ready, updateLayout]);

  return <ModelLayoutContext value={value}>{children}</ModelLayoutContext>;
};

export const useModelLayout = () => {
  const context = useContext(ModelLayoutContext);
  if (!context) {
    throw new Error("useModelLayout must be used within ModelLayoutProvider");
  }
  return context;
};

/** The Model Catalog arranged into the visitor's Model Groups. */
export const useModelGroups = ({ includeHidden = false }: { includeHidden?: boolean } = {}) => {
  const { models } = useModelCatalogState();
  const { layout } = useModelLayout();
  return useMemo(
    () => applyModelLayout(models, layout, { includeHidden }).groups,
    [models, layout, includeHidden],
  );
};

/** The one selected model, chat or image, among the visible models in `models`. */
export const useSelectedModel = (models: Model[]) => {
  const { preferences } = useModelPreferences();
  const { layout } = useModelLayout();
  return useMemo(
    () => pickSelectedModel(models, preferences.modelId, layout),
    [models, preferences.modelId, layout],
  );
};
