import { type ChatStatus, generateId, type UIMessage } from "ai";
import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSettings } from "@/components/settings-provider";
import { toast } from "@/components/ui/toast";
import { useAuthRetry } from "@/hooks/use-auth-retry";
import {
  appendImageHistoryEntry,
  loadImageHistory,
  replaceImageHistoryEntry,
} from "@/lib/conversation-store";
import type {
  ImageUrlsData,
  ReferenceImageUrlsData,
  StoredImagesData,
  StoredMessage,
  StoredReferenceImagesData,
} from "@/lib/db";
import { compressImageToBlob } from "@/lib/image-compression";
import {
  generateRandomSeed,
  getImageEntryMetadata,
  getImageModelProfile,
  type ImageGenerationParams,
  MAX_REFERENCE_IMAGES,
  sanitizeImageParams,
} from "@/lib/image-models";
import type { Model } from "@/lib/models";
import { getStoredModel } from "@/lib/utils";

export interface ReferenceImageDraft {
  id: string;
  blob: Blob;
  url: string;
  filename: string;
}

type ImageRequestResult =
  { ok: true; image: Blob } | { ok: false; unauthorized: boolean; message: string };

const requestImage = async ({
  prompt,
  model,
  params,
  referenceImages,
  skipCache,
}: {
  prompt: string;
  model: string;
  params: ImageGenerationParams;
  referenceImages: Blob[];
  skipCache: boolean;
}): Promise<ImageRequestResult> => {
  let response: Response;
  try {
    if (referenceImages.length > 0) {
      const form = new FormData();
      form.append("prompt", prompt);
      form.append("model", model);
      form.append("params", JSON.stringify(params));
      if (skipCache) {
        form.append("skipCache", "true");
      }
      for (const [index, blob] of referenceImages.entries()) {
        form.append("referenceImages", blob, `reference-${index}.jpg`);
      }
      response = await fetch("/api/image", {
        method: "POST",
        body: form,
      });
    } else {
      response = await fetch("/api/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, model, params, skipCache }),
      });
    }
  } catch {
    return { ok: false, unauthorized: false, message: "Network error. Please try again." };
  }

  if (!response.ok) {
    return {
      ok: false,
      unauthorized: response.status === 401,
      message: (await response.text()) || "Image generation failed. Please try again.",
    };
  }
  return { ok: true, image: await response.blob() };
};

const getLatestUserEntry = (history: StoredMessage[] | undefined) => {
  for (const entry of [...(history ?? [])].reverse()) {
    if (entry.role === "user") {
      return entry;
    }
  }
  return undefined;
};

const getPromptText = (entry: StoredMessage | undefined) => {
  const textPart = entry?.parts.find((part) => part.type === "text");
  return textPart?.type === "text" ? textPart.text : undefined;
};

const getReferenceBlobs = (entry: StoredMessage | undefined): Blob[] => {
  if (!entry) {
    return [];
  }
  const part = entry.parts.find((candidate) => candidate.type === "data-reference-images");
  if (!part || !("data" in part)) {
    return [];
  }
  const data = part.data as Partial<StoredReferenceImagesData> | undefined;
  return Array.isArray(data?.images) ? data.images : [];
};

/** Resolves stored image Blobs to object URLs and tracks a lookup map for reuse as references. */
const useImageHistoryDisplay = (history: StoredMessage[] | undefined) => {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [imageBlobsByUrl, setImageBlobsByUrl] = useState<Map<string, Blob>>(() => new Map());

  useEffect(() => {
    if (!history) {
      return;
    }

    const urls: string[] = [];
    const blobMap = new Map<string, Blob>();
    setMessages(
      history.map((entry) => ({
        ...entry,
        parts: entry.parts.map((part) => {
          if (part.type === "data-images") {
            const entryUrls = (part.data as StoredImagesData).images.map((image) => {
              const url = URL.createObjectURL(image);
              blobMap.set(url, image);
              return url;
            });
            urls.push(...entryUrls);
            return { type: "data-images", data: { urls: entryUrls } satisfies ImageUrlsData };
          }
          if (part.type === "data-reference-images") {
            const entryUrls = (part.data as StoredReferenceImagesData).images.map((image) =>
              URL.createObjectURL(image),
            );
            urls.push(...entryUrls);
            return {
              type: "data-reference-images",
              data: { urls: entryUrls } satisfies ReferenceImageUrlsData,
            };
          }
          return part;
        }),
      })),
    );
    setImageBlobsByUrl(blobMap);

    return () => {
      for (const url of urls) {
        URL.revokeObjectURL(url);
      }
    };
  }, [history]);

  return { messages, imageBlobsByUrl };
};

export const DEFAULT_IMAGE_PARAMS: ImageGenerationParams = {
  width: 1024,
  height: 1024,
};

/** Drives the Image History page: prompts, parameters, reference images, and generated images. */
export const useImageGeneration = ({
  models,
  selectedModelId,
}: {
  models: Model[];
  selectedModelId?: string;
}) => {
  const { settings } = useSettings();
  const [status, setStatus] = useState<ChatStatus>("ready");
  const [params, setParams] = useState<ImageGenerationParams>(DEFAULT_IMAGE_PARAMS);
  const [referenceImages, setReferenceImages] = useState<ReferenceImageDraft[]>([]);
  const referenceImagesRef = useRef(referenceImages);
  referenceImagesRef.current = referenceImages;

  const history = useLiveQuery(loadImageHistory);
  const { messages, imageBlobsByUrl } = useImageHistoryDisplay(history);

  const selectedModel = useMemo(
    () =>
      (selectedModelId ? models.find((model) => model.id === selectedModelId) : undefined) ??
      getStoredModel(models, "CF_AI_MODEL_IMAGE"),
    [models, selectedModelId],
  );
  const profile = useMemo(() => getImageModelProfile(selectedModel?.id ?? ""), [selectedModel?.id]);

  // Revoke any remaining draft object URLs on unmount.
  useEffect(() => {
    return () => {
      for (const item of referenceImagesRef.current) {
        URL.revokeObjectURL(item.url);
      }
    };
  }, []);

  // Clear reference images when switching to a model that does not support them.
  useEffect(() => {
    if (profile.maxReferenceImages === 0 && referenceImagesRef.current.length > 0) {
      for (const item of referenceImagesRef.current) {
        URL.revokeObjectURL(item.url);
      }
      setReferenceImages([]);
    }
  }, [profile.maxReferenceImages]);

  const appendCompressedReferenceBlobs = useCallback(
    async (sources: Array<{ blob: Blob; filename?: string }>) => {
      if (profile.maxReferenceImages === 0) {
        toast.add({
          title: "The selected model does not support reference images.",
          type: "warning",
        });
        return;
      }

      const availableSlots = MAX_REFERENCE_IMAGES - referenceImagesRef.current.length;
      if (availableSlots <= 0) {
        toast.add({
          title: `You can attach up to ${MAX_REFERENCE_IMAGES} reference images.`,
          type: "warning",
        });
        return;
      }

      const toProcess = sources.slice(0, availableSlots);
      if (sources.length > availableSlots) {
        toast.add({
          title: `You can attach up to ${MAX_REFERENCE_IMAGES} reference images.`,
          type: "warning",
        });
      }

      const drafts: ReferenceImageDraft[] = [];
      for (const source of toProcess) {
        const compressed = await compressImageToBlob(source.blob);
        if (!compressed) {
          toast.add({
            title: `Unable to attach ${source.filename ?? "image"}: unsupported or too large.`,
            type: "warning",
          });
          continue;
        }
        drafts.push({
          id: crypto.randomUUID(),
          blob: compressed.blob,
          url: URL.createObjectURL(compressed.blob),
          filename: source.filename ?? "reference.jpg",
        });
      }

      if (drafts.length > 0) {
        setReferenceImages((current) => [...current, ...drafts].slice(0, MAX_REFERENCE_IMAGES));
      }
    },
    [profile.maxReferenceImages],
  );

  const addReferenceImages = useCallback(
    async (files: File[]) => {
      await appendCompressedReferenceBlobs(
        files.map((file) => ({ blob: file, filename: file.name })),
      );
    },
    [appendCompressedReferenceBlobs],
  );

  const removeReferenceImage = useCallback((id: string) => {
    setReferenceImages((current) => {
      const target = current.find((item) => item.id === id);
      if (target) {
        URL.revokeObjectURL(target.url);
      }
      return current.filter((item) => item.id !== id);
    });
  }, []);

  const clearReferenceImages = useCallback(() => {
    setReferenceImages((current) => {
      for (const item of current) {
        URL.revokeObjectURL(item.url);
      }
      return [];
    });
  }, []);

  const useGeneratedImageAsReference = useCallback(
    async (url: string) => {
      const blob = imageBlobsByUrl.get(url);
      if (!blob) {
        toast.add({ title: "Unable to load this image as a reference.", type: "error" });
        return;
      }
      await appendCompressedReferenceBlobs([{ blob, filename: "generated-reference.png" }]);
    },
    [appendCompressedReferenceBlobs, imageBlobsByUrl],
  );

  const generate = async ({
    prompt,
    effectiveParams,
    refs,
    skipCache,
    replacedId,
  }: {
    prompt: string;
    effectiveParams: ImageGenerationParams;
    refs: Blob[];
    skipCache: boolean;
    replacedId?: string;
  }) => {
    if (!selectedModel) {
      setStatus("error");
      toast.add({ title: "No image models are currently available", type: "error" });
      return;
    }

    const sanitized = sanitizeImageParams(selectedModel.id, effectiveParams);
    const requestParams = sanitized.ok ? sanitized.params : {};
    const modelProfile = getImageModelProfile(selectedModel.id);
    const allowedRefs =
      modelProfile.maxReferenceImages > 0 ? refs.slice(0, modelProfile.maxReferenceImages) : [];

    setStatus("submitted");
    const result = await requestImage({
      prompt,
      model: selectedModel.id,
      params: requestParams,
      referenceImages: allowedRefs,
      skipCache,
    });
    if (!result.ok) {
      setStatus("error");
      if (result.unauthorized) {
        handleUnauthorized();
      } else {
        toast.add({ title: result.message, type: "error" });
      }
      return;
    }

    resetAuthRetry();
    const entry: UIMessage = {
      id: generateId(),
      role: "assistant",
      parts: [{ type: "data-images", data: { images: [result.image] } satisfies StoredImagesData }],
      metadata: {
        modelId: selectedModel.id,
        modelName: selectedModel.name,
        params: requestParams,
      },
    };
    try {
      await (replacedId
        ? replaceImageHistoryEntry(replacedId, entry)
        : appendImageHistoryEntry(entry));
      setStatus("ready");
    } catch {
      setStatus("error");
      toast.add({ title: "Unable to save the generated image.", type: "error" });
    }
  };

  /** Retries the latest prompt with a fresh random seed unless the seed was locked. */
  const retry = async () => {
    const latestUser = getLatestUserEntry(history);
    const prompt = getPromptText(latestUser);
    if (!prompt || !latestUser) {
      toast.add({ title: "No prompt to retry", type: "error" });
      setStatus("ready");
      return;
    }

    const modelId = selectedModel?.id ?? "";
    const modelProfile = getImageModelProfile(modelId);
    const storedMeta = getImageEntryMetadata(latestUser);
    const storedParams = storedMeta?.params ?? {};

    const nextSeed = modelProfile.supportsSeed
      ? storedParams.seedLocked && storedParams.seed !== undefined
        ? storedParams.seed
        : generateRandomSeed()
      : undefined;

    const effectiveParams: ImageGenerationParams = {
      ...storedParams,
      ...(nextSeed !== undefined ? { seed: nextSeed } : {}),
    };

    const refs = getReferenceBlobs(latestUser);
    const latest = history?.at(-1);
    await generate({
      prompt,
      effectiveParams,
      refs,
      skipCache: true,
      replacedId: latest?.role === "assistant" ? latest.id : undefined,
    });
  };

  const { authDialog, handleUnauthorized, resetAuthRetry } = useAuthRetry(retry);

  const send = async (prompt: string) => {
    if (!selectedModel) {
      toast.add({ title: "No image models are currently available", type: "error" });
      return;
    }

    resetAuthRetry();
    const modelProfile = getImageModelProfile(selectedModel.id);
    const seed = modelProfile.supportsSeed
      ? params.seedLocked && params.seed !== undefined
        ? params.seed
        : generateRandomSeed()
      : undefined;

    const effectiveParams: ImageGenerationParams = {
      ...params,
      ...(seed !== undefined ? { seed } : {}),
    };

    const refBlobs =
      modelProfile.maxReferenceImages > 0
        ? referenceImagesRef.current
            .slice(0, modelProfile.maxReferenceImages)
            .map((item) => item.blob)
        : [];

    const parts: UIMessage["parts"] = [];
    if (refBlobs.length > 0) {
      parts.push({
        type: "data-reference-images",
        data: { images: refBlobs } satisfies StoredReferenceImagesData,
      });
    }
    parts.push({ type: "text", text: prompt });

    clearReferenceImages();

    try {
      await appendImageHistoryEntry({
        id: generateId(),
        role: "user",
        parts,
        metadata: {
          modelId: selectedModel.id,
          modelName: selectedModel.name,
          params: effectiveParams,
        },
      });
    } catch {
      toast.add({ title: "Unable to save the prompt to image history.", type: "error" });
      return;
    }

    await generate({
      prompt,
      effectiveParams,
      refs: refBlobs,
      skipCache: settings.skipGatewayCache,
    });
  };

  return {
    messages,
    status,
    send,
    retry,
    authDialog,
    params,
    setParams,
    profile,
    referenceImages,
    addReferenceImages,
    removeReferenceImage,
    useGeneratedImageAsReference,
  };
};
