import { expect, test } from "bun:test";
import {
  adaptImageParamsForModel,
  generateRandomSeed,
  getImageEntryMetadata,
  getImageModelProfile,
  hasAdjustableImageParams,
  sanitizeImageParams,
} from "@/lib/image-models";

test("getImageModelProfile resolves known families and falls back cleanly for unknown models", () => {
  const flux2Dev = getImageModelProfile("@cf/black-forest-labs/flux-2-dev");
  expect(flux2Dev.family).toBe("flux-2-dev");
  expect(flux2Dev.transport).toBe("multipart");
  expect(flux2Dev.maxReferenceImages).toBe(4);
  expect(flux2Dev.steps?.field).toBe("steps");
  expect(flux2Dev.highCostHint).toBeDefined();

  const flux2Klein = getImageModelProfile("@cf/black-forest-labs/flux-2-klein-4b");
  expect(flux2Klein.family).toBe("flux-2-klein");
  expect(flux2Klein.steps).toBeUndefined();
  expect(flux2Klein.maxReferenceImages).toBe(4);

  const phoenix = getImageModelProfile("@cf/leonardo/phoenix-1.0");
  expect(phoenix.steps?.field).toBe("num_steps");
  expect(phoenix.supportsNegativePrompt).toBe(true);

  const unknown = getImageModelProfile("@cf/vendor/brand-new-image-model");
  expect(unknown.family).toBe("fallback");
  expect(unknown.transport).toBe("json");
  expect(hasAdjustableImageParams(unknown)).toBe(false);

  const unknownFlux2 = getImageModelProfile("@cf/black-forest-labs/flux-2-future");
  expect(unknownFlux2.family).toBe("fallback");
  expect(unknownFlux2.transport).toBe("json");
});

test("sanitizeImageParams keeps supported fields, strips unsupported ones, and rejects invalid supported values", () => {
  const kleinResult = sanitizeImageParams("@cf/black-forest-labs/flux-2-klein-9b", {
    width: 1024,
    height: 1024,
    steps: 12,
    guidance: 7.5,
    negativePrompt: "blurry",
    seed: 42,
  });
  expect(kleinResult).toEqual({
    ok: true,
    params: { width: 1024, height: 1024, seed: 42 },
  });

  const badDimension = sanitizeImageParams("@cf/stabilityai/stable-diffusion-xl-base-1.0", {
    width: 1000,
  });
  expect(badDimension.ok).toBe(false);

  const badSteps = sanitizeImageParams("@cf/black-forest-labs/flux-1-schnell", {
    steps: 20,
  });
  expect(badSteps.ok).toBe(false);

  const fallback = sanitizeImageParams("@cf/unknown/model", {
    width: 99999,
    seed: -1,
    negativePrompt: "ignored",
  });
  expect(fallback).toEqual({ ok: true, params: {} });
});

test("generateRandomSeed and getImageEntryMetadata handle valid and malformed values", () => {
  const seed = generateRandomSeed();
  expect(Number.isInteger(seed)).toBe(true);
  expect(seed).toBeGreaterThanOrEqual(1);

  expect(
    getImageEntryMetadata({
      id: "1",
      role: "assistant",
      parts: [],
      metadata: {
        modelId: "@cf/black-forest-labs/flux-2-klein-4b",
        modelName: "flux-2-klein-4b",
        params: { width: 1024, height: 1024, seed: 123, seedLocked: true },
      },
    }),
  ).toEqual({
    modelId: "@cf/black-forest-labs/flux-2-klein-4b",
    modelName: "flux-2-klein-4b",
    params: { width: 1024, height: 1024, seed: 123, seedLocked: true },
  });

  expect(
    getImageEntryMetadata({
      id: "2",
      role: "assistant",
      parts: [],
      metadata: { params: "invalid" },
    }),
  ).toBeUndefined();
});

test("adaptImageParamsForModel retains compatible fields when switching models", () => {
  expect(
    adaptImageParamsForModel("@cf/black-forest-labs/flux-1-schnell", {
      width: 1024,
      height: 1024,
      steps: 25,
      guidance: 7.5,
      seed: 42,
      negativePrompt: "blurry",
    }),
  ).toEqual({});

  expect(
    adaptImageParamsForModel("@cf/black-forest-labs/flux-1-schnell", {
      width: 1024,
      steps: 6,
      seed: 42,
    }),
  ).toEqual({ steps: 6 });

  expect(
    adaptImageParamsForModel("@cf/stabilityai/stable-diffusion-xl-base-1.0", {
      width: 1040,
      height: 1024,
      steps: 15,
      guidance: 7.5,
      seed: 42,
      negativePrompt: "blurry",
    }),
  ).toEqual({
    height: 1024,
    steps: 15,
    guidance: 7.5,
    seed: 42,
    negativePrompt: "blurry",
  });

  expect(
    adaptImageParamsForModel("@cf/leonardo/phoenix-1.0", {
      width: 2048,
      height: 1024,
      steps: 60,
      guidance: 1.5,
      seed: 42,
    }),
  ).toEqual({
    height: 1024,
    seed: 42,
  });
});
