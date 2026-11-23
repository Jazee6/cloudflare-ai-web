import { appError, type ErrorCode, type ErrorParams } from "@/lib/error-codes";
import type { UIMessage } from "ai";
import * as v from "valibot";
import type { Model } from "@/lib/models";
import type { MessageKey } from "@/locales/en";

export const MAX_IMAGE_PROMPT_LENGTH = 8_000;
export const MAX_REFERENCE_IMAGES = 4;
export const MAX_NEGATIVE_PROMPT_LENGTH = 2_000;
export const MAX_SEED = 2_147_483_647;

export interface ImageAspectRatioOption {
  label: string;
  width: number;
  height: number;
}

export const IMAGE_ASPECT_RATIOS: readonly ImageAspectRatioOption[] = [
  { label: "1:1", width: 1024, height: 1024 },
  { label: "16:9", width: 1344, height: 768 },
  { label: "9:16", width: 768, height: 1344 },
  { label: "4:3", width: 1152, height: 896 },
  { label: "3:4", width: 896, height: 1152 },
];

export interface ImageDimensionSpec {
  min: number;
  max: number;
  step: number;
  defaultWidth: number;
  defaultHeight: number;
}

export interface ImageStepsSpec {
  field: "steps" | "num_steps";
  min: number;
  max: number;
  default: number;
}

export interface ImageGuidanceSpec {
  min: number;
  max: number;
  step: number;
  default: number;
}

export interface ImageModelProfile {
  family: string;
  transport: "multipart" | "json";
  maxReferenceImages: number;
  dimensions?: ImageDimensionSpec;
  /** Preset aspect ratios, for providers that take a ratio instead of a width and height. */
  aspectRatios?: readonly string[];
  steps?: ImageStepsSpec;
  guidance?: ImageGuidanceSpec;
  supportsSeed: boolean;
  supportsNegativePrompt: boolean;
  /** Message key for a warning that the model is slow or costly. */
  highCostHint?: MessageKey;
}

const FLUX_2_DEV_PROFILE: ImageModelProfile = {
  family: "flux-2-dev",
  transport: "multipart",
  maxReferenceImages: MAX_REFERENCE_IMAGES,
  dimensions: { min: 256, max: 1536, step: 16, defaultWidth: 1024, defaultHeight: 1024 },
  steps: { field: "steps", min: 4, max: 25, default: 20 },
  supportsSeed: true,
  supportsNegativePrompt: false,
  highCostHint: "imageParams.slowAndCostly",
};

const FLUX_2_KLEIN_PROFILE: ImageModelProfile = {
  family: "flux-2-klein",
  transport: "multipart",
  maxReferenceImages: MAX_REFERENCE_IMAGES,
  dimensions: { min: 256, max: 1536, step: 16, defaultWidth: 1024, defaultHeight: 1024 },
  supportsSeed: true,
  supportsNegativePrompt: false,
};

const FLUX_1_SCHNELL_PROFILE: ImageModelProfile = {
  family: "flux-1-schnell",
  transport: "json",
  maxReferenceImages: 0,
  steps: { field: "steps", min: 1, max: 8, default: 4 },
  supportsSeed: false,
  supportsNegativePrompt: false,
};

const LUCID_ORIGIN_PROFILE: ImageModelProfile = {
  family: "lucid-origin",
  transport: "json",
  maxReferenceImages: 0,
  dimensions: { min: 512, max: 1536, step: 16, defaultWidth: 1024, defaultHeight: 1024 },
  steps: { field: "num_steps", min: 1, max: 40, default: 25 },
  guidance: { min: 0, max: 10, step: 0.5, default: 4.5 },
  supportsSeed: true,
  supportsNegativePrompt: false,
};

const PHOENIX_PROFILE: ImageModelProfile = {
  family: "phoenix-1.0",
  transport: "json",
  maxReferenceImages: 0,
  dimensions: { min: 512, max: 1536, step: 16, defaultWidth: 1024, defaultHeight: 1024 },
  steps: { field: "num_steps", min: 1, max: 50, default: 25 },
  guidance: { min: 2, max: 10, step: 0.5, default: 2 },
  supportsSeed: true,
  supportsNegativePrompt: true,
};

const SDXL_PROFILE: ImageModelProfile = {
  family: "sdxl",
  transport: "json",
  maxReferenceImages: 0,
  dimensions: { min: 512, max: 1536, step: 64, defaultWidth: 1024, defaultHeight: 1024 },
  steps: { field: "num_steps", min: 1, max: 20, default: 20 },
  guidance: { min: 1, max: 20, step: 0.5, default: 7.5 },
  supportsSeed: true,
  supportsNegativePrompt: true,
};

const FALLBACK_PROFILE: ImageModelProfile = {
  family: "fallback",
  transport: "json",
  maxReferenceImages: 0,
  supportsSeed: false,
  supportsNegativePrompt: false,
};

/** Sizes the OpenAI Images API accepts, by aspect ratio. */
export const OPENAI_IMAGE_SIZES: Record<string, string> = {
  "1:1": "1024x1024",
  "3:2": "1536x1024",
  "2:3": "1024x1536",
};

const OPENAI_IMAGES_PROFILE: ImageModelProfile = {
  family: "openai-images",
  transport: "json",
  maxReferenceImages: MAX_REFERENCE_IMAGES,
  aspectRatios: Object.keys(OPENAI_IMAGE_SIZES),
  supportsSeed: false,
  supportsNegativePrompt: false,
};

const GEMINI_IMAGE_PROFILE: ImageModelProfile = {
  family: "gemini",
  transport: "json",
  maxReferenceImages: MAX_REFERENCE_IMAGES,
  aspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
  supportsSeed: false,
  supportsNegativePrompt: false,
};

/** A model ID, or a model whose image protocol decides its profile (Personal Models). */
export type ImageModelRef = string | Pick<Model, "id" | "imageProtocol">;

export const getImageModelProfile = (ref: ImageModelRef): ImageModelProfile => {
  if (typeof ref !== "string" && ref.imageProtocol) {
    return ref.imageProtocol === "gemini" ? GEMINI_IMAGE_PROFILE : OPENAI_IMAGES_PROFILE;
  }
  const normalized = (typeof ref === "string" ? ref : ref.id).toLowerCase();
  if (normalized.includes("flux-2-dev")) {
    return FLUX_2_DEV_PROFILE;
  }
  if (normalized.includes("flux-2-klein")) {
    return FLUX_2_KLEIN_PROFILE;
  }
  if (normalized.includes("flux-1-schnell")) {
    return FLUX_1_SCHNELL_PROFILE;
  }
  if (normalized.includes("lucid-origin")) {
    return LUCID_ORIGIN_PROFILE;
  }
  if (normalized.includes("phoenix-1.0")) {
    return PHOENIX_PROFILE;
  }
  if (
    normalized.includes("stable-diffusion-xl-lightning") ||
    normalized.includes("stable-diffusion-xl-base-1.0") ||
    normalized.includes("dreamshaper-8-lcm")
  ) {
    return SDXL_PROFILE;
  }
  return FALLBACK_PROFILE;
};

export const hasAdjustableImageParams = (profile: ImageModelProfile): boolean =>
  Boolean(
    profile.dimensions ||
    profile.aspectRatios ||
    profile.steps ||
    profile.guidance ||
    profile.supportsSeed ||
    profile.supportsNegativePrompt,
  );

export const generateRandomSeed = (): number => {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return (buffer[0] % MAX_SEED) + 1;
};

const imageGenerationParamsSchema = v.object({
  width: v.optional(v.number()),
  height: v.optional(v.number()),
  steps: v.optional(v.number()),
  guidance: v.optional(v.number()),
  seed: v.optional(v.number()),
  seedLocked: v.optional(v.boolean()),
  negativePrompt: v.optional(v.string()),
  aspectRatio: v.optional(v.string()),
});

export type ImageGenerationParams = v.InferOutput<typeof imageGenerationParamsSchema>;

export interface NormalizedImageParams {
  width?: number;
  height?: number;
  steps?: number;
  guidance?: number;
  seed?: number;
  negativePrompt?: string;
  aspectRatio?: string;
}

const validateDimension = (
  value: number,
  spec: ImageDimensionSpec,
  label: "width" | "height",
):
  | { ok: true; value: number }
  | { ok: false; message: string; code?: ErrorCode; params?: ErrorParams } => {
  if (!Number.isInteger(value) || value < spec.min || value > spec.max) {
    return { ok: false, ...appError(`${label}Range`, { min: spec.min, max: spec.max }) };
  }
  if (value % spec.step !== 0) {
    return { ok: false, ...appError(`${label}Step`, { step: spec.step }) };
  }
  return { ok: true, value };
};

/**
 * Validates supported image generation parameters for a model and strips unsupported fields
 * so switching models or passing extra client state never sends invalid upstream fields.
 */
export const sanitizeImageParams = (
  model: ImageModelRef,
  rawParams: unknown,
):
  | { ok: true; params: NormalizedImageParams }
  | { ok: false; message: string; code?: ErrorCode; params?: ErrorParams } => {
  if (rawParams === undefined || rawParams === null) {
    return { ok: true, params: {} };
  }

  const parsed = v.safeParse(imageGenerationParamsSchema, rawParams);
  if (!parsed.success) {
    return { ok: false, ...appError("invalidImageGenerationParams") };
  }

  const profile = getImageModelProfile(model);
  const input = parsed.output;
  const normalized: NormalizedImageParams = {};

  if (profile.aspectRatios && input.aspectRatio !== undefined) {
    if (!profile.aspectRatios.includes(input.aspectRatio)) {
      return {
        ok: false,
        ...appError("aspectRatioOptions", { options: profile.aspectRatios.join(", ") }),
      };
    }
    normalized.aspectRatio = input.aspectRatio;
  }

  if (profile.dimensions) {
    if (input.width !== undefined) {
      const check = validateDimension(input.width, profile.dimensions, "width");
      if (!check.ok) {
        return check;
      }
      normalized.width = check.value;
    }
    if (input.height !== undefined) {
      const check = validateDimension(input.height, profile.dimensions, "height");
      if (!check.ok) {
        return check;
      }
      normalized.height = check.value;
    }
  }

  if (profile.steps && input.steps !== undefined) {
    if (
      !Number.isInteger(input.steps) ||
      input.steps < profile.steps.min ||
      input.steps > profile.steps.max
    ) {
      return {
        ok: false,
        ...appError("stepsRange", { min: profile.steps.min, max: profile.steps.max }),
      };
    }
    normalized.steps = input.steps;
  }

  if (profile.guidance && input.guidance !== undefined) {
    if (
      !Number.isFinite(input.guidance) ||
      input.guidance < profile.guidance.min ||
      input.guidance > profile.guidance.max
    ) {
      return {
        ok: false,
        ...appError("guidanceRange", {
          min: profile.guidance.min,
          max: profile.guidance.max,
        }),
      };
    }
    normalized.guidance = Math.round(input.guidance * 100) / 100;
  }

  if (profile.supportsSeed && input.seed !== undefined) {
    if (!Number.isInteger(input.seed) || input.seed < 0 || input.seed > MAX_SEED) {
      return { ok: false, ...appError("seedRange", { max: MAX_SEED }) };
    }
    normalized.seed = input.seed;
  }

  if (profile.supportsNegativePrompt && input.negativePrompt !== undefined) {
    const trimmed = input.negativePrompt.trim();
    if (trimmed.length > MAX_NEGATIVE_PROMPT_LENGTH) {
      return {
        ok: false,
        ...appError("negativePromptTooLong", { max: MAX_NEGATIVE_PROMPT_LENGTH }),
      };
    }
    if (trimmed.length > 0) {
      normalized.negativePrompt = trimmed;
    }
  }

  return { ok: true, params: normalized };
};

/**
 * Adapts client parameters when switching image models, keeping every supported field
 * that remains valid and dropping only fields that are unsupported or out of range.
 */
export const adaptImageParamsForModel = (
  model: ImageModelRef,
  rawParams: ImageGenerationParams,
): NormalizedImageParams => {
  const profile = getImageModelProfile(model);
  const adapted: NormalizedImageParams = {};

  if (profile.aspectRatios) {
    // The first ratio is the one the parameters panel shows as selected by default.
    adapted.aspectRatio =
      rawParams.aspectRatio !== undefined && profile.aspectRatios.includes(rawParams.aspectRatio)
        ? rawParams.aspectRatio
        : profile.aspectRatios[0];
  }

  if (profile.dimensions) {
    if (
      rawParams.width !== undefined &&
      validateDimension(rawParams.width, profile.dimensions, "width").ok
    ) {
      adapted.width = rawParams.width;
    }
    if (
      rawParams.height !== undefined &&
      validateDimension(rawParams.height, profile.dimensions, "height").ok
    ) {
      adapted.height = rawParams.height;
    }
  }

  if (
    profile.steps &&
    rawParams.steps !== undefined &&
    Number.isInteger(rawParams.steps) &&
    rawParams.steps >= profile.steps.min &&
    rawParams.steps <= profile.steps.max
  ) {
    adapted.steps = rawParams.steps;
  }

  if (
    profile.guidance &&
    rawParams.guidance !== undefined &&
    Number.isFinite(rawParams.guidance) &&
    rawParams.guidance >= profile.guidance.min &&
    rawParams.guidance <= profile.guidance.max
  ) {
    adapted.guidance = Math.round(rawParams.guidance * 100) / 100;
  }

  if (
    profile.supportsSeed &&
    rawParams.seed !== undefined &&
    Number.isInteger(rawParams.seed) &&
    rawParams.seed >= 0 &&
    rawParams.seed <= MAX_SEED
  ) {
    adapted.seed = rawParams.seed;
  }

  if (profile.supportsNegativePrompt && rawParams.negativePrompt !== undefined) {
    const trimmed = rawParams.negativePrompt.trim();
    if (trimmed.length > 0 && trimmed.length <= MAX_NEGATIVE_PROMPT_LENGTH) {
      adapted.negativePrompt = trimmed;
    }
  }

  return adapted;
};

const imageEntryMetadataSchema = v.object({
  modelId: v.optional(v.string()),
  modelName: v.optional(v.string()),
  params: v.optional(imageGenerationParamsSchema),
});

export type ImageEntryMetadata = v.InferOutput<typeof imageEntryMetadataSchema>;

export const getImageEntryMetadata = (message: UIMessage): ImageEntryMetadata | undefined => {
  const parsed = v.safeParse(imageEntryMetadataSchema, message.metadata);
  return parsed.success ? parsed.output : undefined;
};
