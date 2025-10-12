import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { type Model, models } from "@/lib/models";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const getRandomId = () => {
  return Math.random().toString(36).slice(2);
};

export type StoredModelKey = "CF_AI_MODEL" | "CF_AI_MODEL_IMAGE";

export const getStoredModel = (key: StoredModelKey = "CF_AI_MODEL") =>
  models.find((m) => m.id === getStoredModelId(key)) ?? models[0];

export const getStoredModelId = (key: StoredModelKey = "CF_AI_MODEL") =>
  (localStorage.getItem(key) ?? models[0].id) as Model["id"];
