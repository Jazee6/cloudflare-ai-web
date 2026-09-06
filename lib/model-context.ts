import type { UIMessage } from "ai";

export const MODEL_CONTEXT_MAX_CHARS = 64_000;
export const MODEL_CONTEXT_MAX_MESSAGES = 100;
export const MODEL_CONTEXT_MAX_IMAGES = 5;

const messageContentLength = (parts: UIMessage["parts"]): number =>
  parts.reduce((total, part) => {
    if (part.type === "file") {
      return total;
    }
    return total + (part.type === "text" ? part.text.length : JSON.stringify(part).length);
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
  if (messageContentLength(newestFirst[0].parts) > MODEL_CONTEXT_MAX_CHARS) {
    return null;
  }

  const selected: Message[] = [];
  let totalChars = 0;
  for (const message of newestFirst) {
    const messageChars = messageContentLength(message.parts);
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
