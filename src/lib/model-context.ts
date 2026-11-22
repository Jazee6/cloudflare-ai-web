import type { FileUIPart, UIMessage } from "ai";
import { getContextAttachmentCharLength, isContextAttachmentPart } from "@/lib/context-attachments";
import { blobToDataUrl } from "@/lib/image-compression";
import { getImageBlobs } from "@/lib/image-turn";
import { MAX_IMAGE_PARTS } from "@/lib/request-limits";

export const MODEL_CONTEXT_MAX_CHARS = 64_000;
export const MODEL_CONTEXT_MAX_MESSAGES = 100;
export const MODEL_CONTEXT_MAX_IMAGES = MAX_IMAGE_PARTS;
export const GENERATED_IMAGE_PLACEHOLDER = "[generated image]";

export const getMessageContentLength = (parts: UIMessage["parts"]): number =>
  parts.reduce((total, part) => {
    if (
      part.type === "file" ||
      part.type === "data-images" ||
      part.type === "data-reference-images"
    ) {
      return total;
    }
    if (part.type === "text") {
      return total + part.text.length;
    }
    if (isContextAttachmentPart(part)) {
      return total + getContextAttachmentCharLength(part.data);
    }
    return total + JSON.stringify(part).length;
  }, 0);

/**
 * Selects a contiguous Model Context from newest to oldest without truncating messages.
 * File payloads use their own count and byte limits and are excluded from the character budget.
 */
export const buildModelContext = <Message extends UIMessage>(
  messages: Message[],
): Message[] | null => {
  if (messages.length === 0) {
    return [];
  }

  const newestFirst = [...messages].reverse();
  if (getMessageContentLength(newestFirst[0].parts) > MODEL_CONTEXT_MAX_CHARS) {
    return null;
  }

  const selected: Message[] = [];
  let totalChars = 0;
  for (const message of newestFirst) {
    const messageChars = getMessageContentLength(message.parts);
    if (totalChars + messageChars > MODEL_CONTEXT_MAX_CHARS) {
      break;
    }

    selected.push(message);
    totalChars += messageChars;
    if (selected.length === MODEL_CONTEXT_MAX_MESSAGES) {
      break;
    }
  }
  selected.reverse();

  let remainingImages = MODEL_CONTEXT_MAX_IMAGES;
  const prunedNewestFirst = [...selected].reverse().map((message) => {
    const parts = [...message.parts].reverse().filter((part) => {
      if (part.type !== "file") {
        return true;
      }
      if (remainingImages === 0) {
        return false;
      }
      remainingImages--;
      return true;
    });

    return { ...message, parts: parts.reverse() };
  });

  return prunedNewestFirst.reverse().filter((message) => message.parts.length > 0) as Message[];
};

/** Generated images carried into a Model Context, waiting to be encoded once it is selected. */
export type GeneratedImages = Map<FileUIPart, Blob>;

/**
 * Rewrites image-generation turns for a text model. Reference Images are dropped. A response's
 * generated images become a placeholder text; when the model accepts image input, the images
 * themselves ride along with the next user message, since providers do not accept images
 * from the assistant role. Every text request ends with a user message, so none are lost.
 */
export const expandImageTurns = <Message extends UIMessage>(
  messages: Message[],
  supportsImageInput: boolean,
): { messages: Message[]; generatedImages: GeneratedImages } => {
  const generatedImages: GeneratedImages = new Map();
  let carried: FileUIPart[] = [];

  const expanded = messages.map((message) => {
    const blobs = getImageBlobs(message, "data-images");
    if (message.role === "assistant" && blobs.length > 0) {
      if (supportsImageInput) {
        carried = blobs.map((blob) => {
          const part: FileUIPart = { type: "file", mediaType: blob.type || "image/png", url: "" };
          generatedImages.set(part, blob);
          return part;
        });
      }
      return {
        ...message,
        parts: [
          ...message.parts.filter((part) => part.type !== "data-images"),
          { type: "text", text: GENERATED_IMAGE_PLACEHOLDER },
        ],
      };
    }

    const hasImageParts = message.parts.some(
      (part) => part.type === "data-reference-images" || part.type === "data-images",
    );
    if (message.role !== "user" || (carried.length === 0 && !hasImageParts)) {
      return message;
    }
    const parts = [
      ...carried,
      ...message.parts.filter(
        (part) => part.type !== "data-reference-images" && part.type !== "data-images",
      ),
    ];
    carried = [];
    return { ...message, parts };
  });

  return { messages: expanded, generatedImages };
};

/** Encodes the generated images that made it into the selected Model Context as data URLs. */
export const encodeGeneratedImages = async <Message extends UIMessage>(
  messages: Message[],
  generatedImages: GeneratedImages,
): Promise<Message[]> => {
  if (generatedImages.size === 0) {
    return messages;
  }
  return Promise.all(
    messages.map(async (message) => ({
      ...message,
      parts: await Promise.all(
        message.parts.map(async (part) => {
          const blob = part.type === "file" ? generatedImages.get(part) : undefined;
          return blob ? { ...part, url: await blobToDataUrl(blob) } : part;
        }),
      ),
    })),
  );
};
