import { type ChatStatus, generateId } from "ai";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "@/components/ui/toast";
import { db, type ImagesDataPart, type Message } from "@/lib/db";
import type { Model } from "@/lib/models";
import { getStoredModel } from "@/lib/utils";

export const useImage = ({
  models,
  onUnauthorized,
}: {
  models: Model[];
  onUnauthorized?: () => void;
}) => {
  const [status, setStatus] = useState<ChatStatus>("ready");
  const [messages, setMessages] = useState<Message[]>([]);
  const retriedRef = useRef(false);
  const lastPromptRef = useRef<string | null>(null);
  const objectUrlsRef = useRef(new Set<string>());
  const loadGenerationRef = useRef(0);

  const createObjectUrl = useCallback((blob: Blob) => {
    const url = URL.createObjectURL(blob);
    objectUrlsRef.current.add(url);
    return url;
  }, []);

  const revokeObjectUrls = useCallback(() => {
    for (const url of objectUrlsRef.current) {
      URL.revokeObjectURL(url);
    }
    objectUrlsRef.current.clear();
  }, []);

  const loadMessages = useCallback(
    async (generation: number) => {
      try {
        const stored = await db.message
          .where("sessionId")
          .equals("image")
          .limit(50)
          .sortBy("createdAt");

        if (generation !== loadGenerationRef.current) {
          return;
        }
        revokeObjectUrls();
        setMessages(
          stored.map((message) => ({
            ...message,
            parts: message.parts.map((part) =>
              part.type === "data-images"
                ? {
                    type: "data-images",
                    data: {
                      urls: (part.data as ImagesDataPart).images.map(createObjectUrl),
                    },
                  }
                : part,
            ),
          })),
        );
      } catch {
        if (generation === loadGenerationRef.current) {
          toast.add({ title: "Unable to load image history.", type: "error" });
        }
      }
    },
    [createObjectUrl, revokeObjectUrls],
  );

  useEffect(() => {
    const generation = ++loadGenerationRef.current;
    void loadMessages(generation);
    return () => {
      loadGenerationRef.current++;
      revokeObjectUrls();
    };
  }, [loadMessages, revokeObjectUrls]);

  const sendPrompt = async (
    prompt: string,
    options?: {
      isRegenerate?: boolean;
    },
  ) => {
    setStatus("submitted");
    const { isRegenerate } = options ?? {};
    if (!isRegenerate) {
      retriedRef.current = false;
      const promptMessage: Message = {
        id: generateId(),
        parts: [
          {
            type: "text",
            text: prompt,
          },
        ],
        role: "user",
        sessionId: "image",
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, promptMessage]);
      await db.message.add(promptMessage);
    }
    lastPromptRef.current = prompt;

    const selectedModel = getStoredModel(models, "CF_AI_MODEL_IMAGE");
    if (!selectedModel) {
      setStatus("error");
      toast.add({
        title: "No image models are currently available",
        type: "error",
      });
      return;
    }

    const res = await fetch("/api/image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        model: selectedModel.id,
      }),
    }).catch((error: Error) => {
      setStatus("error");
      toast.add({ title: error.message, type: "error" });
      return null;
    });

    if (!res) {
      return;
    }
    if (res.status === 401) {
      if (retriedRef.current) {
        setStatus("error");
        toast.add({ title: "Authentication failed. Please try again.", type: "error" });
        retriedRef.current = false;
        return;
      }
      retriedRef.current = true;
      setStatus("error");
      onUnauthorized?.();
      return;
    }
    retriedRef.current = false;
    if (!res.ok) {
      setStatus("error");
      toast.add({ title: await res.text(), type: "error" });
      return;
    }

    const images = [await res.blob()];
    const imagesMessage: Message = {
      id: generateId(),
      parts: [
        {
          type: "data-images",
          data: {
            images,
          },
        },
      ],
      role: "assistant",
      sessionId: "image",
      createdAt: new Date(),
    };
    const urls = images.map(createObjectUrl);
    setMessages((prev) => [
      ...prev,
      {
        ...imagesMessage,
        parts: [
          {
            type: "data-images",
            data: { urls },
          },
        ],
      },
    ]);
    await db.message.add(imagesMessage);
    setStatus("ready");
  };

  const regenerate = async () => {
    // Find the most recent text prompt in the conversation
    let prompt: string | undefined;
    for (let i = messages.length - 1; i >= 0; i--) {
      const textPart = messages[i].parts.find((p) => p.type === "text");
      if (textPart && textPart.type === "text") {
        prompt = textPart.text;
        break;
      }
    }

    if (prompt) {
      retriedRef.current = false;
      await sendPrompt(prompt, { isRegenerate: true });
      return;
    }

    toast.add({ title: "No prompt to regenerate", type: "error" });
    setStatus("ready");
  };

  const retryAfterAuth = async () => {
    if (lastPromptRef.current) {
      await sendPrompt(lastPromptRef.current, { isRegenerate: true });
    }
  };

  return {
    status,
    sendPrompt,
    messages,
    regenerate,
    retryAfterAuth,
  };
};
