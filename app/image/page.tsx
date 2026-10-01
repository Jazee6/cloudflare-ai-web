"use client";

import { ViewTransition } from "react";
import ChatInput, { type onSendMessageProps } from "@/components/chat-input";
import ChatLayout from "@/components/chat-layout";
import ChatList from "@/components/chat-list";
import { useModelCatalog } from "@/components/model-catalog-provider";
import { useImageGeneration } from "@/hooks/use-image-generation";

const Page = () => {
  const models = useModelCatalog("Text to Image");
  const { messages, status, send, regenerate, authDialog, scroll } = useImageGeneration({
    models,
  });

  return (
    <ChatLayout
      scroll={scroll}
      authDialog={authDialog}
      bottomBar={
        <ViewTransition name="chat-input">
          <ChatInput
            models={models}
            className="mx-auto max-w-3xl bg-background shadow-xl"
            onSendMessage={({ text }: onSendMessageProps) => send(text)}
            status={status}
            modelKey="CF_AI_MODEL_IMAGE"
            onRetry={regenerate}
          />
        </ViewTransition>
      }
    >
      <ChatList status={status} messages={messages} className="pt-16 pb-60 max-w-3xl mx-auto" />
    </ChatLayout>
  );
};

export default Page;
