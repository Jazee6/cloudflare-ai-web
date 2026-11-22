import { after } from "next/server";
import { getAppCapabilities, getPublicModelCatalog } from "@/lib/model-catalog";
import type { ModelCatalogResponse } from "@/lib/models";

const CACHE_CONTROL_HEADER = "public, s-maxage=3600, stale-while-revalidate=86400";

const scheduleCachePut = (task: () => Promise<void>) => {
  try {
    after(task);
  } catch {
    void task().catch((error) => {
      console.warn("Failed to populate /api/models edge cache", error);
    });
  }
};

export async function GET(request: Request) {
  const edgeCache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  const cacheKey = new Request(new URL("/api/models", request.url), { method: "GET" });

  if (edgeCache) {
    try {
      const cached = await edgeCache.match(cacheKey);
      if (cached) {
        return cached;
      }
    } catch (error) {
      console.warn("Failed to read /api/models edge cache", error);
    }
  }

  const payload: ModelCatalogResponse = {
    models: await getPublicModelCatalog(),
    capabilities: getAppCapabilities(),
  };

  const response = Response.json(payload, {
    headers: {
      "Cache-Control": payload.models.length > 0 ? CACHE_CONTROL_HEADER : "no-store",
    },
  });

  if (edgeCache && payload.models.length > 0) {
    const cachedResponse = response.clone();
    scheduleCachePut(async () => {
      await edgeCache.put(cacheKey, cachedResponse);
    });
  }

  return response;
}
