import { type ChatStatus, generateId } from "ai";
import { useEffect, useState } from "react";
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

  useEffect(() => {
    db.message
      .where("sessionId")
      .equals("image")
      .limit(50)
      .sortBy("createdAt")
      .then((messages) =>
        setMessages(
          messages.map((m) => ({
            ...m,
            parts: m.parts.map((p) =>
              p.type === "data-images"
                ? {
                    type: "data-images",
                    data: {
                      urls: (p.data as ImagesDataPart).images.map(URL.createObjectURL),
                    },
                  }
                : p,
            ),
          })),
        ),
      );
  }, []);

  const sendPrompt = async (
    prompt: string,
    options?: {
      isRegenerate?: boolean;
    },
  ) => {
    setStatus("submitted");
    const { isRegenerate } = options ?? {};
    if (!isRegenerate) {
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
        Authorization: localStorage.getItem("CF_AI_PASSWORD") ?? "",
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
      onUnauthorized?.();
      return;
    }
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
    setMessages((prev) => [
      ...prev,
      {
        ...imagesMessage,
        parts: [
          {
            type: "data-images",
            data: {
              urls: images.map(URL.createObjectURL),
            },
          },
        ],
      },
    ]);
    await db.message.add(imagesMessage);
    setStatus("ready");
  };

  const regenerate = async () => {
    const m = messages.at(-1);
    if (m) {
      if (m.parts[0].type === "text") {
        setStatus("submitted");
        await sendPrompt(m.parts[0].text, { isRegenerate: true });
        return;
      }
    }

    toast.add({ title: "No prompt to regenerate", type: "error" });
    setStatus("ready");
  };

  return {
    status,
    sendPrompt,
    messages,
    regenerate,
  };
};
