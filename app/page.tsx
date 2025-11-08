"use client";

import { generateId } from "ai";
import { useRouter } from "next/navigation";
import { useCallback, ViewTransition } from "react";
import ChatInput, { type onSendMessageProps } from "@/components/chat-input";
import Footer from "@/components/footer";
import { TextEffect } from "@/components/ui/text-effect";
import { db } from "@/lib/db";
import { models } from "@/lib/models";

export default function Home() {
  const router = useRouter();

  const onSendMessage = useCallback(
    async (data: onSendMessageProps) => {
      const { text, files } = data;

      const sessionId = crypto.randomUUID();
      await db.session.add({
        updatedAt: new Date(),
        name: text.slice(0, 20),
        id: sessionId,
      });
      await db.message.add({
        id: generateId(),
        parts: [
          ...(files ?? []),
          {
            type: "text",
            text,
          },
        ],
        role: "user",
        sessionId,
        createdAt: new Date(),
      });

      router.replace(`/c/${sessionId}?new`);
    },
    [router],
  );

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="flex flex-col justify-center h-full w-full space-y-4 px-4">
        <div className="font-bold text-2xl mx-auto font-mono">
          <TextEffect per="word" preset="fade-in-blur">
            How can I assist you today?
          </TextEffect>
        </div>
        <ViewTransition name="chat-input">
          <ChatInput
            models={models.filter((i) => i.type === "Text Generation")}
            className="mx-auto max-w-3xl"
            onSendMessage={onSendMessage}
          />
        </ViewTransition>
      </div>

      <Footer classname="mt-auto mb-1" />
    </div>
  );
}
