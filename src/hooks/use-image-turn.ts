import type { UIMessage } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "@/components/ui/toast";
import { compressImageToBlob } from "@/lib/image-compression";
import {
  getImageModelProfile,
  type ImageGenerationParams,
  type ImageModelProfile,
  MAX_REFERENCE_IMAGES,
} from "@/lib/image-models";
import { createImagePromptMessage, resolveImageSeed } from "@/lib/image-turn";
import type { Model } from "@/lib/models";

export interface ReferenceImageDraft {
  id: string;
  blob: Blob;
  url: string;
  filename: string;
}

export interface ImageTurn {
  params: ImageGenerationParams;
  setParams: (
    params: ImageGenerationParams | ((current: ImageGenerationParams) => ImageGenerationParams),
  ) => void;
  profile: ImageModelProfile;
  referenceImages: ReferenceImageDraft[];
  addReferenceImages: (sources: Array<{ blob: Blob; filename?: string }>) => Promise<void>;
  removeReferenceImage: (id: string) => void;
  /** Turns the prompt and current drafts into a prompt message, then clears the drafts. */
  takePromptMessage: (text: string, model: Model) => UIMessage;
}

export const DEFAULT_IMAGE_PARAMS: ImageGenerationParams = {
  width: 1024,
  height: 1024,
};

const revokeAll = (drafts: ReferenceImageDraft[]) => {
  for (const draft of drafts) {
    URL.revokeObjectURL(draft.url);
  }
};

/**
 * Holds the draft of the next image-generation turn: parameters and Reference Images for the
 * selected image model. Sending and persisting the turn belong to the conversation.
 */
export const useImageTurn = (selectedModel: Model | undefined): ImageTurn => {
  const [params, setParams] = useState<ImageGenerationParams>(DEFAULT_IMAGE_PARAMS);
  const [referenceImages, setReferenceImages] = useState<ReferenceImageDraft[]>([]);
  const referenceImagesRef = useRef(referenceImages);
  referenceImagesRef.current = referenceImages;

  const modelId = selectedModel?.type === "Text to Image" ? selectedModel.id : "";
  const profile = useMemo(() => getImageModelProfile(modelId), [modelId]);

  useEffect(() => () => revokeAll(referenceImagesRef.current), []);

  // Drop Reference Images when the selected model cannot use them.
  useEffect(() => {
    if (profile.maxReferenceImages === 0 && referenceImagesRef.current.length > 0) {
      revokeAll(referenceImagesRef.current);
      referenceImagesRef.current = [];
      setReferenceImages([]);
    }
  }, [profile.maxReferenceImages]);

  const addReferenceImages = useCallback(
    async (sources: Array<{ blob: Blob; filename?: string }>) => {
      if (profile.maxReferenceImages === 0) {
        toast.add({
          title: "The selected model does not support reference images.",
          type: "warning",
        });
        return;
      }

      const availableSlots = MAX_REFERENCE_IMAGES - referenceImagesRef.current.length;
      if (sources.length > availableSlots) {
        toast.add({
          title: `You can attach up to ${MAX_REFERENCE_IMAGES} reference images.`,
          type: "warning",
        });
      }

      const drafts: ReferenceImageDraft[] = [];
      for (const source of sources.slice(0, Math.max(0, availableSlots))) {
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
        setReferenceImages((current) => {
          const next = [...current, ...drafts];
          revokeAll(next.slice(MAX_REFERENCE_IMAGES));
          return next.slice(0, MAX_REFERENCE_IMAGES);
        });
      }
    },
    [profile.maxReferenceImages],
  );

  const removeReferenceImage = useCallback((id: string) => {
    setReferenceImages((current) => {
      revokeAll(current.filter((item) => item.id === id));
      return current.filter((item) => item.id !== id);
    });
  }, []);

  const takePromptMessage = (text: string, model: Model) => {
    const message = createImagePromptMessage({
      text,
      model,
      params: resolveImageSeed(model.id, params, "send"),
      referenceImages: referenceImagesRef.current.map((item) => item.blob),
    });

    revokeAll(referenceImagesRef.current);
    referenceImagesRef.current = [];
    setReferenceImages([]);
    if (params.seed !== undefined && !params.seedLocked) {
      setParams((current) => ({ ...current, seed: undefined }));
    }
    return message;
  };

  return {
    params,
    setParams,
    profile,
    referenceImages,
    addReferenceImages,
    removeReferenceImage,
    takePromptMessage,
  };
};
