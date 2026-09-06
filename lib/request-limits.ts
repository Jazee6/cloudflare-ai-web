import type { UIMessage } from "ai";

export const MAX_REQUEST_BODY_BYTES = 25 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_PARTS = 5;

export interface ReadBodyResult {
  ok: true;
  text: string;
}

export interface ReadBodyError {
  ok: false;
  status: 413;
  message: string;
}

/** Reads a request body while enforcing both declared and observed byte counts. */
export const readRequestBody = async (
  request: Request,
  maxBytes = MAX_REQUEST_BODY_BYTES,
): Promise<ReadBodyResult | ReadBodyError> => {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > maxBytes) {
    return { ok: false, status: 413, message: "Request body too large." };
  }

  const reader = request.body?.getReader();
  if (!reader) {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > maxBytes) {
      return { ok: false, status: 413, message: "Request body too large." };
    }
    return { ok: true, text };
  }

  let bytesRead = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (!value) {
      continue;
    }

    bytesRead += value.byteLength;
    if (bytesRead > maxBytes) {
      await reader.cancel();
      return { ok: false, status: 413, message: "Request body too large." };
    }
    chunks.push(value);
  }

  const decoder = new TextDecoder();
  const text =
    chunks.map((chunk) => decoder.decode(chunk, { stream: true })).join("") + decoder.decode();
  return { ok: true, text };
};

/** Returns the decoded image size, or null when the part is not a valid matching image data URL. */
export const getImageDataUrlSize = (url: string, declaredMediaType: string): number | null => {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/]*={0,2})$/i.exec(url);
  if (!match || match[1].toLowerCase() !== declaredMediaType.toLowerCase()) {
    return null;
  }

  try {
    return atob(match[2]).length;
  } catch {
    return null;
  }
};

export type ImagePartsValidation = { ok: true } | { ok: false; status: 400 | 413; message: string };

export const validateImageParts = (messages: UIMessage[]): ImagePartsValidation => {
  let imageCount = 0;
  for (const message of messages) {
    for (const part of message.parts) {
      if (part.type !== "file") {
        continue;
      }

      imageCount++;
      if (imageCount > MAX_IMAGE_PARTS) {
        return { ok: false, status: 400, message: "Too many images." };
      }
      if (!part.mediaType.startsWith("image/")) {
        return { ok: false, status: 400, message: "Only image attachments are supported." };
      }

      const imageSize = getImageDataUrlSize(part.url, part.mediaType);
      if (imageSize === null) {
        return { ok: false, status: 400, message: "Invalid image attachment." };
      }
      if (imageSize > MAX_IMAGE_BYTES) {
        return { ok: false, status: 413, message: "Image attachment is too large." };
      }
    }
  }

  return { ok: true };
};
