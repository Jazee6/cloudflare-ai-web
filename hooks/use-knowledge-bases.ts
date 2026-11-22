"use client";

import { useCallback, useEffect, useState } from "react";
import * as v from "valibot";
import type { KnowledgeBaseInstance } from "@/lib/ai-search";

const instancesResponseSchema = v.object({
  instances: v.array(
    v.object({
      id: v.string(),
      name: v.string(),
    }),
  ),
});

export const useKnowledgeBases = (enabled: boolean) => {
  const [instances, setInstances] = useState<KnowledgeBaseInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(
    async (signal?: AbortSignal): Promise<boolean> => {
      if (!enabled) {
        setInstances([]);
        setLoading(false);
        setNeedsAuth(false);
        setLoaded(false);
        return false;
      }

      setLoading(true);
      try {
        const response = await fetch("/api/ai-search/instances", { signal });
        if (response.status === 401) {
          setNeedsAuth(true);
          setLoaded(false);
          setInstances([]);
          return false;
        }
        if (!response.ok) {
          setLoaded(false);
          setInstances([]);
          return false;
        }

        const parsed = v.safeParse(instancesResponseSchema, await response.json());
        if (parsed.success) {
          setInstances(parsed.output.instances);
          setNeedsAuth(false);
          setLoaded(true);
          return true;
        }
        setLoaded(false);
        return false;
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setLoaded(false);
          setInstances([]);
        }
        return false;
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [enabled],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => {
      controller.abort();
    };
  }, [load]);

  const reload = useCallback(() => load(), [load]);

  return { instances, loading, needsAuth, loaded, reload };
};
