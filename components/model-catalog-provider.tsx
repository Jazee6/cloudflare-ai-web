"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Model, ModelType } from "@/lib/models";
import { deleteCookie, setCookie, type StoredPreferenceKey } from "@/lib/utils";

const ModelCatalogContext = createContext<Model[] | null>(null);

type ModelPreferenceKey = Exclude<StoredPreferenceKey, "CF_AI_THEME">;
type ModelPreferences = Partial<Record<ModelPreferenceKey, string>>;

const ModelPreferencesContext = createContext<{
  preferences: ModelPreferences;
  setPreference: (key: ModelPreferenceKey, value: string | undefined) => void;
} | null>(null);

export const ModelPreferencesProvider = ({
  children,
  preferences: initialPreferences,
}: {
  children: ReactNode;
  preferences: ModelPreferences;
}) => {
  // The layout reads cookies only on a full page load, so client navigations rely on this copy.
  const [preferences, setPreferences] = useState(initialPreferences);
  const setPreference = useCallback((key: ModelPreferenceKey, value: string | undefined) => {
    if (value === undefined) {
      deleteCookie(key);
    } else {
      setCookie(key, value);
    }
    setPreferences((current) => (current[key] === value ? current : { ...current, [key]: value }));
  }, []);
  const value = useMemo(() => ({ preferences, setPreference }), [preferences, setPreference]);

  return <ModelPreferencesContext value={value}>{children}</ModelPreferencesContext>;
};

export const ModelCatalogProvider = ({
  children,
  models,
}: {
  children: ReactNode;
  models: Model[];
}) => <ModelCatalogContext value={models}>{children}</ModelCatalogContext>;

export const useModelPreferences = () => {
  const context = useContext(ModelPreferencesContext);
  if (!context) {
    throw new Error("useModelPreferences must be used within ModelPreferencesProvider");
  }

  return context;
};

export const useModelCatalog = (type?: ModelType) => {
  const models = useContext(ModelCatalogContext);
  if (!models) {
    throw new Error("useModelCatalog must be used within ModelCatalogProvider");
  }

  return type ? models.filter((model) => model.type === type) : models;
};
