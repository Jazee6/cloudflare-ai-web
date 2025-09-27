import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { type Model, models } from "@/lib/models";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const getRandomId = () => {
  return Math.random().toString(36).slice(2);
};

export const getStoredModel = () =>
  models.find((m) => m.id === getStoredModelId()) ?? models[0];

export const getStoredModelId = () =>
  (localStorage.getItem("CF_AI_MODEL") ?? models[0].id) as Model["id"];
