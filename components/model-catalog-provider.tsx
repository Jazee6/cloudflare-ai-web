"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Model, ModelType } from "@/lib/models";
import type { StoredPreferenceKey } from "@/lib/utils";

const ModelCatalogContext = createContext<Model[] | null>(null);

export const ModelPreferencesProvider = ({
  children,
  preferences,
}: {
  children: ReactNode;
  preferences: Partial<Record<StoredPreferenceKey, string>>;
}) => <ModelPreferencesContext value={preferences}>{children}</ModelPreferencesContext>;

const ModelPreferencesContext = createContext<Partial<Record<StoredPreferenceKey, string>>>({});

export const ModelCatalogProvider = ({
  children,
  models,
}: {
  children: ReactNode;
  models: Model[];
}) => <ModelCatalogContext value={models}>{children}</ModelCatalogContext>;

export const useModelPreferences = () => useContext(ModelPreferencesContext);

export const useModelCatalog = (type?: ModelType) => {
  const models = useContext(ModelCatalogContext);
  if (!models) {
    throw new Error("useModelCatalog must be used within ModelCatalogProvider");
  }

  return type ? models.filter((model) => model.type === type) : models;
};
