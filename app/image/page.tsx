"use client";

import { ViewTransition } from "react";
import ChatInput, { type onSendMessageProps } from "@/components/chat-input";
import ChatLayout from "@/components/chat-layout";
import ChatList from "@/components/chat-list";
import { useModelCatalog } from "@/components/model-catalog-provider";
import { useImageGeneration } from "@/hooks/use-image-generation";

const Page = () => {
  const models = useModelCatalog("Text to Image");
  const { messages, status, send, retry, authDialog } = useImageGeneration({
    models,
  });

  return (
    <ChatLayout
      authDialog={authDialog}
      bottomBar={
        <ViewTransition name="chat-input">
          <ChatInput
            models={models}
            className="mx-auto w-full max-w-3xl"
            onSendMessage={({ text }: onSendMessageProps) => send(text)}
            status={status}
            modelKey="CF_AI_MODEL_IMAGE"
            onRetry={retry}
          />
        </ViewTransition>
      }
    >
      <ChatList
        status={status}
        messages={messages}
        onRetry={retry}
        className="mx-auto max-w-3xl pt-16 pb-4"
      />
    </ChatLayout>
  );
};

export default Page;
