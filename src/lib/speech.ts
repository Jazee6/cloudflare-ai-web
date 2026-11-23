import type { MessageKey } from "@/locales/en";
export interface SpeechPreprocessOptions {
  skipCodeBlocks?: boolean;
}

/**
 * Strips Markdown formatting into clean spoken prose for Web Speech Synthesis.
 */
export const prepareTextForSpeech = (
  markdown: string,
  options: SpeechPreprocessOptions = {},
): string => {
  const skipCodeBlocks = options.skipCodeBlocks ?? true;
  let text = markdown.replace(/\r\n?/g, "\n");

  if (skipCodeBlocks) {
    text = text.replace(/```[\s\S]*?```/g, "\nCode block omitted.\n");
    text = text.replace(/~~~[\s\S]*?~~~/g, "\nCode block omitted.\n");
  } else {
    text = text.replace(/```[^\n]*\n([\s\S]*?)```/g, "\n$1\n");
    text = text.replace(/~~~[^\n]*\n([\s\S]*?)~~~/g, "\n$1\n");
  }

  // Convert Markdown images & links to readable text.
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");

  // Unwrap inline code and basic emphasis/heading/list markers.
  text = text.replace(/`([^`]*)`/g, "$1");
  text = text.replace(/^#{1,6}\s+/gm, "");
  text = text.replace(/^>\s?/gm, "");
  text = text.replace(/^[\t ]*([-*+]|\d+\.)\s+/gm, "");
  text = text.replace(/^[-*_]{3,}\s*$/gm, "");
  text = text.replace(/\*\*|~~|\*/g, "");
  text = text.replace(/(^|[^\w])_{1,2}|_{1,2}(?=[^\w]|$)/g, "$1");
  text = text.replace(/<[^>]+>/g, " ");

  return text
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
};

/**
 * Splits long speech prose into browser-safe chunks so SpeechSynthesisUtterance does not
 * silently truncate on desktop or mobile browsers.
 */
export const splitSpeechChunks = (text: string, maxChunkLength = 180): string[] => {
  const normalized = text.trim();
  if (!normalized) {
    return [];
  }

  const chunks: string[] = [];
  const paragraphs = normalized
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const paragraph of paragraphs) {
    if (paragraph.length <= maxChunkLength) {
      chunks.push(paragraph);
      continue;
    }

    const sentences = paragraph
      .split(/(?<=[。！？；.!?;])\s*/)
      .map((part) => part.trim())
      .filter(Boolean);

    let current = "";
    const flush = () => {
      if (current) {
        chunks.push(current);
        current = "";
      }
    };

    for (const sentence of sentences) {
      if (sentence.length > maxChunkLength) {
        flush();
        let remaining = sentence;
        while (remaining.length > maxChunkLength) {
          let splitAt = remaining.lastIndexOf(" ", maxChunkLength);
          if (splitAt < Math.floor(maxChunkLength / 2)) {
            splitAt = maxChunkLength;
          }
          const slice = remaining.slice(0, splitAt).trim();
          if (slice) {
            chunks.push(slice);
          }
          remaining = remaining.slice(splitAt).trim();
        }
        if (remaining) {
          current = remaining;
        }
        continue;
      }

      const candidate = current ? `${current} ${sentence}` : sentence;
      if (candidate.length <= maxChunkLength) {
        current = candidate;
      } else {
        flush();
        current = sentence;
      }
    }
    flush();
  }

  return chunks;
};

export interface BrowserSpeechRecognitionResultItem {
  transcript: string;
}

export interface BrowserSpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  [index: number]: BrowserSpeechRecognitionResultItem;
}

export interface BrowserSpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: ArrayLike<BrowserSpeechRecognitionResult>;
}

export interface BrowserSpeechRecognitionErrorEvent extends Event {
  error: string;
}

export interface BrowserSpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

export type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

export const getSpeechRecognitionConstructor = (): BrowserSpeechRecognitionConstructor | null => {
  if (typeof window === "undefined" || !window.isSecureContext) {
    return null;
  }
  const win = window as unknown as {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  };
  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
};

export const isSpeechRecognitionSupported = (): boolean =>
  getSpeechRecognitionConstructor() !== null;

export const isSpeechSynthesisSupported = (): boolean =>
  typeof window !== "undefined" &&
  "speechSynthesis" in window &&
  typeof SpeechSynthesisUtterance !== "undefined";

export const mapSpeechRecognitionError = (errorCode: string): MessageKey => {
  switch (errorCode) {
    case "not-allowed":
    case "service-not-allowed":
      return "speech.permissionDenied";
    case "audio-capture":
      return "speech.noMicrophone";
    case "network":
      return "speech.serviceUnavailable";
    case "no-speech":
      return "speech.noSpeech";
    default:
      return "speech.failed";
  }
};
