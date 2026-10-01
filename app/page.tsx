"use client";

import { useRouter } from "next/navigation";
import { ViewTransition } from "react";
import ChatInput, { type onSendMessageProps } from "@/components/chat-input";
import Footer from "@/components/footer";
import { useModelCatalog } from "@/components/model-catalog-provider";
import { toast } from "@/components/ui/toast";
import { TextEffect } from "@/components/ui/text-effect";
import { createConversation, createUserMessage } from "@/lib/conversation-store";

export default function Home() {
  const router = useRouter();
  const models = useModelCatalog("Text Generation");

  const onSendMessage = async ({ text, files }: onSendMessageProps) => {
    try {
      const sessionId = await createConversation(createUserMessage(text, files));
      router.replace(`/c/${sessionId}?new`);
    } catch {
      toast.add({ title: "Unable to start a new chat.", type: "error" });
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="flex flex-col justify-center h-full w-full space-y-4 px-4">
        <div className="font-bold text-2xl mx-auto font-mono">
          <TextEffect per="word" preset="fade-in-blur">
            How can I assist you today?
          </TextEffect>
        </div>
        <ViewTransition name="chat-input">
          <ChatInput models={models} className="mx-auto max-w-3xl" onSendMessage={onSendMessage} />
        </ViewTransition>
      </div>

      <Footer classname="mt-auto mb-1" />
    </div>
  );
}
