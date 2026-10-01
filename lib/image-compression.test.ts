import { expect, test } from "bun:test";
import type { UIMessage } from "ai";
import {
  fitImagePartsWithinLimit,
  fitWithinLongEdge,
  getCompressionAttempts,
} from "@/lib/image-compression";
import { MAX_IMAGE_BYTES } from "@/lib/request-limits";

test("fitWithinLongEdge scales the long edge down and never upscales", () => {
  expect(fitWithinLongEdge(4000, 3000, 1568)).toEqual({ width: 1568, height: 1176 });
  expect(fitWithinLongEdge(3000, 4000, 1568)).toEqual({ width: 1176, height: 1568 });
  expect(fitWithinLongEdge(800, 600, 1568)).toEqual({ width: 800, height: 600 });
  expect(fitWithinLongEdge(10_000, 1, 512)).toEqual({ width: 512, height: 1 });
});

test("compression attempts lower quality before dimensions and stop at 512px", () => {
  const attempts = getCompressionAttempts();
  expect(attempts[0]).toEqual({ maxLongEdge: 1568, quality: 0.85 });
  expect(attempts[1]).toEqual({ maxLongEdge: 1568, quality: 0.7 });
  expect(attempts.at(-1)?.maxLongEdge).toBe(512);
});

const imageMessage = (url: string): UIMessage => ({
  id: crypto.randomUUID(),
  role: "user",
  parts: [
    { type: "file", mediaType: "image/png", url },
    { type: "text", text: "describe" },
  ],
});

const smallImage = "data:image/png;base64,AQID";
const oversizedImage = `data:image/png;base64,${Buffer.alloc(MAX_IMAGE_BYTES + 1).toString("base64")}`;

test("fitImagePartsWithinLimit keeps images already within the limit", async () => {
  const messages = [imageMessage(smallImage)];
  const compress = async () => {
    throw new Error("should not compress");
  };

  expect(await fitImagePartsWithinLimit(messages, compress)).toEqual(messages);
});

test("fitImagePartsWithinLimit replaces oversized history images with compressed copies", async () => {
  const [message] = await fitImagePartsWithinLimit([imageMessage(oversizedImage)], async () => ({
    url: "data:image/jpeg;base64,AQ==",
    mediaType: "image/jpeg",
  }));

  expect(message.parts[0]).toEqual({
    type: "file",
    mediaType: "image/jpeg",
    url: "data:image/jpeg;base64,AQ==",
  });
});

test("fitImagePartsWithinLimit drops images that cannot be reduced", async () => {
  const [message] = await fitImagePartsWithinLimit(
    [imageMessage(oversizedImage)],
    async () => null,
  );

  expect(message.parts).toEqual([{ type: "text", text: "describe" }]);
});
