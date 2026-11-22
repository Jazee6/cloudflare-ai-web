import { expect, test } from "bun:test";
import {
  createImagePromptMessage,
  createImageResponseMessage,
  getImageBlobs,
  isImageTurn,
  resolveImageSeed,
} from "@/lib/image-turn";
import type { Model } from "@/lib/models";

const model = (id: string): Model => ({
  id,
  name: id,
  brand: "Black Forest Labs",
  type: "Text to Image",
  provider: "workers-ai",
  source: "cloudflare",
});
const png = () => new Blob([new Uint8Array([1])], { type: "image/png" });

test("image turns are told apart from chat turns by their parameters", () => {
  const prompt = createImagePromptMessage({
    text: "a cat",
    model: model("@cf/black-forest-labs/flux-2-dev"),
    params: { width: 1024 },
    referenceImages: [],
  });
  expect(isImageTurn(prompt)).toBe(true);
  expect(isImageTurn(createImageResponseMessage(model("@cf/x"), {}, png()))).toBe(true);
  expect(
    isImageTurn({ id: "a", role: "assistant", parts: [], metadata: { usage: undefined } }),
  ).toBe(false);
  expect(isImageTurn({ id: "u", role: "user", parts: [{ type: "text", text: "hi" }] })).toBe(false);
});

test("prompt messages keep only as many Reference Images as the model accepts", () => {
  const withReferences = createImagePromptMessage({
    text: "a cat",
    model: model("@cf/black-forest-labs/flux-2-dev"),
    params: {},
    referenceImages: [png(), png(), png(), png(), png()],
  });
  expect(getImageBlobs(withReferences, "data-reference-images")).toHaveLength(4);

  const withoutReferences = createImagePromptMessage({
    text: "a cat",
    model: model("@cf/black-forest-labs/flux-1-schnell"),
    params: {},
    referenceImages: [png()],
  });
  expect(withoutReferences.parts).toEqual([{ type: "text", text: "a cat" }]);
});

test("a new prompt keeps a manual seed and a Retry rolls one unless locked", () => {
  const flux = "@cf/black-forest-labs/flux-2-dev";
  expect(resolveImageSeed(flux, { seed: 42 }, "send").seed).toBe(42);
  expect(resolveImageSeed(flux, {}, "send").seed).toBeNumber();
  expect(resolveImageSeed(flux, { seed: 42, seedLocked: true }, "retry").seed).toBe(42);
  expect(resolveImageSeed(flux, { seed: 42 }, "retry").seed).not.toBe(42);
  expect(resolveImageSeed("@cf/black-forest-labs/flux-1-schnell", {}, "send")).toEqual({});
});
