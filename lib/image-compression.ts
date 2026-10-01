import type { FileUIPart, UIMessage } from "ai";
import { getImageDataUrlSize, MAX_IMAGE_BYTES } from "@/lib/request-limits";

/** Larger sources are rejected before decoding to avoid exhausting browser memory. */
export const MAX_SOURCE_IMAGE_BYTES = 40 * 1024 * 1024;

const COMPRESSED_MEDIA_TYPE = "image/jpeg";
const PASSTHROUGH_MEDIA_TYPES = new Set(["image/jpeg", "image/png"]);
const LONG_EDGE_STEPS = [1568, 1280, 1024, 768, 512];
const QUALITY_STEPS = [0.85, 0.7, 0.55];

export const fitWithinLongEdge = (width: number, height: number, maxLongEdge: number) => {
  const scale = Math.min(1, maxLongEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
};

/** Encoding attempts from best to smallest: lower quality first, then smaller dimensions. */
export const getCompressionAttempts = () =>
  LONG_EDGE_STEPS.flatMap((maxLongEdge) =>
    QUALITY_STEPS.map((quality) => ({ maxLongEdge, quality })),
  );

export const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

const encodeJpeg = async (
  bitmap: ImageBitmap,
  width: number,
  height: number,
  quality: number,
): Promise<Blob> => {
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas 2D context is unavailable");
  }
  // JPEG has no alpha channel; flatten transparency onto white instead of black.
  context.fillStyle = "#fff";
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  return canvas.convertToBlob({ type: COMPRESSED_MEDIA_TYPE, quality });
};

/**
 * Produces an image attachment no larger than MAX_IMAGE_BYTES, or null when the image
 * cannot be decoded or reduced enough. Animated images keep only their first frame.
 */
export const compressImage = async (
  source: Blob,
): Promise<{ url: string; mediaType: string } | null> => {
  if (!source.type.startsWith("image/") || source.size > MAX_SOURCE_IMAGE_BYTES) {
    return null;
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(source);
  } catch {
    return null;
  }

  try {
    const [firstAttempt] = getCompressionAttempts();
    const fitsAsIs =
      PASSTHROUGH_MEDIA_TYPES.has(source.type) &&
      source.size <= MAX_IMAGE_BYTES &&
      Math.max(bitmap.width, bitmap.height) <= firstAttempt.maxLongEdge;
    if (fitsAsIs) {
      return { url: await blobToDataUrl(source), mediaType: source.type };
    }

    for (const { maxLongEdge, quality } of getCompressionAttempts()) {
      const { width, height } = fitWithinLongEdge(bitmap.width, bitmap.height, maxLongEdge);
      const encoded = await encodeJpeg(bitmap, width, height, quality);
      if (encoded.size <= MAX_IMAGE_BYTES) {
        return { url: await blobToDataUrl(encoded), mediaType: COMPRESSED_MEDIA_TYPE };
      }
    }
    return null;
  } catch {
    return null;
  } finally {
    bitmap.close();
  }
};

const dataUrlToBlob = async (url: string) => (await fetch(url)).blob();

/**
 * Downscales image attachments that exceed the request limit, such as originals kept in
 * Conversation History from before compression existed. Images that cannot be reduced
 * are left out of the Model Context rather than failing the whole request.
 */
export const fitImagePartsWithinLimit = async <Message extends UIMessage>(
  messages: Message[],
  compress: (source: Blob) => Promise<{ url: string; mediaType: string } | null> = compressImage,
): Promise<Message[]> => {
  const fitPart = async (part: FileUIPart): Promise<FileUIPart | null> => {
    const size = getImageDataUrlSize(part.url, part.mediaType);
    if (size !== null && size <= MAX_IMAGE_BYTES) {
      return part;
    }

    try {
      const compressed = await compress(await dataUrlToBlob(part.url));
      return compressed ? { ...part, ...compressed } : null;
    } catch {
      return null;
    }
  };

  return Promise.all(
    messages.map(async (message) => {
      if (!message.parts.some((part) => part.type === "file")) {
        return message;
      }

      const parts = await Promise.all(
        message.parts.map((part) =>
          part.type === "file" && part.mediaType.startsWith("image/") ? fitPart(part) : part,
        ),
      );
      return { ...message, parts: parts.filter((part) => part !== null) };
    }),
  );
};
