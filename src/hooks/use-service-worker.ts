import { useEffect } from "react";

/**
 * Registers the Service Worker in production builds (docs/adr/0010). The first visit loads its
 * assets before the worker controls the page, so they are handed over for offline use.
 */
export const useServiceWorker = () => {
  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) {
      return;
    }
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => navigator.serviceWorker.ready)
      .then((registration) => {
        const urls = performance
          .getEntriesByType("resource")
          .map((entry) => entry.name)
          .filter((name) => new URL(name).origin === location.origin);
        registration.active?.postMessage({ type: "cache-assets", urls });
      })
      .catch((error: unknown) => {
        console.warn("Failed to register the Service Worker", error);
      });
  }, []);
};
