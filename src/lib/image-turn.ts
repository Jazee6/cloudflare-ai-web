import { generateId, type UIMessage } from "ai";
import type { StoredImagesData } from "@/lib/db";
import {
  adaptImageParamsForModel,
  generateRandomSeed,
  getImageEntryMetadata,
  getImageModelProfile,
  type ImageEntryMetadata,
  type ImageModelRef,
  type ImageGenerationParams,
  type NormalizedImageParams,
} from "@/lib/image-models";
import type { Model } from "@/lib/models";
import { getPersonalRequest, readPersonalProviders } from "@/lib/personal-providers";

export type ImagePartType = "data-images" | "data-reference-images";

/**
 * An image-generation turn carries image parameters in its metadata, on both the prompt and
 * the response; text responses carry Response Metadata, which never has `params`.
 */
export const isImageTurn = (message: UIMessage) =>
  getImageEntryMetadata(message)?.params !== undefined;

/** Reads the Blobs of a `data-images` or `data-reference-images` part. */
export const getImageBlobs = (message: UIMessage, type: ImagePartType): Blob[] =>
  message.parts.flatMap((part) => {
    if (part.type !== type || !("data" in part)) {
      return [];
    }
    const images = (part.data as Partial<StoredImagesData> | undefined)?.images;
    return Array.isArray(images) ? images.filter((image) => image instanceof Blob) : [];
  });

export const getPromptText = (message: UIMessage) =>
  message.parts.find((part) => part.type === "text")?.text;

/**
 * Fixes the seed a prompt is generated with. A new prompt keeps a manually entered seed;
 * a Retry rolls a new one unless the seed is locked.
 */
export const resolveImageSeed = (
  model: ImageModelRef,
  params: ImageGenerationParams,
  mode: "send" | "retry",
): ImageGenerationParams => {
  if (!getImageModelProfile(model).supportsSeed) {
    return params;
  }
  const keep =
    mode === "send" ? params.seed !== undefined : params.seedLocked && params.seed !== undefined;
  return { ...params, seed: keep ? params.seed : generateRandomSeed() };
};

export const createImagePromptMessage = ({
  text,
  model,
  params,
  referenceImages,
}: {
  text: string;
  model: Model;
  params: ImageGenerationParams;
  referenceImages: Blob[];
}): UIMessage => {
  const maxReferenceImages = getImageModelProfile(model).maxReferenceImages;
  const images = referenceImages.slice(0, maxReferenceImages);
  return {
    id: generateId(),
    role: "user",
    parts: [
      ...(images.length > 0
        ? [{ type: "data-reference-images" as const, data: { images } satisfies StoredImagesData }]
        : []),
      { type: "text", text },
    ],
    metadata: {
      modelId: model.id,
      modelName: model.name,
      params,
    } satisfies ImageEntryMetadata,
  };
};

export const createImageResponseMessage = (
  model: Model,
  params: NormalizedImageParams,
  image: Blob,
): UIMessage => ({
  id: generateId(),
  role: "assistant",
  parts: [{ type: "data-images", data: { images: [image] } satisfies StoredImagesData }],
  metadata: { modelId: model.id, modelName: model.name, params } satisfies ImageEntryMetadata,
});

export type ImageRequestResult =
  | { ok: true; image: Blob; params: NormalizedImageParams }
  | { ok: false; unauthorized: boolean; message: string };

const getBlobExtension = (blob: Blob) =>
  blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";

/** Generates one image for a prompt; the image model sees only the prompt and its Reference Images. */
export const requestImage = async ({
  prompt,
  model,
  params,
  referenceImages,
  skipCache,
}: {
  prompt: string;
  model: Model;
  params: ImageGenerationParams;
  referenceImages: Blob[];
  skipCache: boolean;
}): Promise<ImageRequestResult> => {
  const requestParams = adaptImageParamsForModel(model, params);
  const references = referenceImages.slice(0, getImageModelProfile(model).maxReferenceImages);
  const personal = getPersonalRequest(model, readPersonalProviders());
  if (model.source === "personal" && !personal) {
    return {
      ok: false,
      unauthorized: false,
      message: "This Personal Model is no longer configured. Select another model.",
    };
  }

  let response: Response;
  try {
    if (references.length > 0) {
      const form = new FormData();
      form.append("prompt", prompt);
      form.append("model", model.id);
      form.append("params", JSON.stringify(requestParams));
      if (skipCache) {
        form.append("skipCache", "true");
      }
      if (personal) {
        form.append("personal", JSON.stringify(personal));
      }
      for (const [index, blob] of references.entries()) {
        form.append("referenceImages", blob, `reference-${index}.${getBlobExtension(blob)}`);
      }
      response = await fetch("/api/image", { method: "POST", body: form });
    } else {
      response = await fetch("/api/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          model: model.id,
          params: requestParams,
          skipCache,
          ...(personal ? { personal } : {}),
        }),
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
  return { ok: true, image: await response.blob(), params: requestParams };
};
