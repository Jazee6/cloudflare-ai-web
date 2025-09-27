import { useLocalStorage } from "@/hooks/use-local-storage";

export const useSettings = () => {
  return useLocalStorage(
    "CF_AI_SETTINGS",
    {
    },
    {
      initializeWithValue: false,
    },
  );
};
