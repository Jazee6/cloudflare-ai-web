import { type ChatStatus, generateId, type UIMessage } from "ai";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { toast } from "@/components/ui/toast";
import { useAuthRetry } from "@/hooks/use-auth-retry";
import { useScrollToBottom } from "@/hooks/use-scroll-to-bottom";
import { appendImageHistoryEntry, loadImageHistory } from "@/lib/conversation-store";
import type { ImageUrlsData, StoredImagesData, StoredMessage } from "@/lib/db";
import type { Model } from "@/lib/models";
import { getStoredModel } from "@/lib/utils";

type ImageRequestResult =
  | { ok: true; image: Blob }
  | { ok: false; unauthorized: boolean; message: string };

const requestImage = async (prompt: string, model: string): Promise<ImageRequestResult> => {
  let response: Response;
  try {
    response = await fetch("/api/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, model }),
    });
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
  return { ok: true, image: await response.blob() };
};

const getLatestPrompt = (history: StoredMessage[] | undefined) => {
  for (const entry of [...(history ?? [])].reverse()) {
    const textPart = entry.parts.find((part) => part.type === "text");
    if (textPart?.type === "text") {
      return textPart.text;
    }
  }
  return undefined;
};

/** Resolves stored image Blobs to object URLs that live as long as the history snapshot. */
const useImageHistoryDisplay = (history: StoredMessage[] | undefined) => {
  const [messages, setMessages] = useState<UIMessage[]>([]);

  useEffect(() => {
    if (!history) {
      return;
    }

    const urls: string[] = [];
    setMessages(
      history.map((entry) => ({
        ...entry,
        parts: entry.parts.map((part) => {
          if (part.type !== "data-images") {
            return part;
          }
          const entryUrls = (part.data as StoredImagesData).images.map((image) =>
            URL.createObjectURL(image),
          );
          urls.push(...entryUrls);
          return { type: "data-images", data: { urls: entryUrls } satisfies ImageUrlsData };
        }),
      })),
    );

    return () => {
      for (const url of urls) {
        URL.revokeObjectURL(url);
      }
    };
  }, [history]);

  return messages;
};

/** Drives the Image History page: prompts and generated images persist locally as they arrive. */
export const useImageGeneration = ({ models }: { models: Model[] }) => {
  const scroll = useScrollToBottom();
  const [status, setStatus] = useState<ChatStatus>("ready");
  const history = useLiveQuery(loadImageHistory);
  const messages = useImageHistoryDisplay(history);

  const generate = async (prompt: string) => {
    const selectedModel = getStoredModel(models, "CF_AI_MODEL_IMAGE");
    if (!selectedModel) {
      setStatus("error");
      toast.add({ title: "No image models are currently available", type: "error" });
      return;
    }

    setStatus("submitted");
    const result = await requestImage(prompt, selectedModel.id);
    if (!result.ok) {
      setStatus("error");
      if (result.unauthorized) {
        handleUnauthorized();
      } else {
        toast.add({ title: result.message, type: "error" });
      }
      return;
    }

    resetAuthRetry();
    try {
      await appendImageHistoryEntry({
        id: generateId(),
        role: "assistant",
        parts: [
          { type: "data-images", data: { images: [result.image] } satisfies StoredImagesData },
        ],
      });
      setStatus("ready");
    } catch {
      setStatus("error");
      toast.add({ title: "Unable to save the generated image.", type: "error" });
    }
  };

  const regenerate = async () => {
    const prompt = getLatestPrompt(history);
    if (!prompt) {
      toast.add({ title: "No prompt to regenerate", type: "error" });
      setStatus("ready");
      return;
    }
    await generate(prompt);
  };

  const { authDialog, handleUnauthorized, resetAuthRetry } = useAuthRetry(regenerate);

  const send = async (prompt: string) => {
    resetAuthRetry();
    try {
      await appendImageHistoryEntry({
        id: generateId(),
        role: "user",
        parts: [{ type: "text", text: prompt }],
      });
    } catch {
      toast.add({ title: "Unable to save the prompt to image history.", type: "error" });
      return;
    }
    scroll.scrollToBottom();
    await generate(prompt);
  };

  useEffect(() => {
    if (messages.length > 0) {
      scroll.scrollToBottom();
    }
  }, [messages.length, scroll.scrollToBottom]);

  return { messages, status, send, regenerate, authDialog, scroll };
};
