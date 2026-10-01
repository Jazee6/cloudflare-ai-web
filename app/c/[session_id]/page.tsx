"use client";

import { useParams, useSearchParams } from "next/navigation";
import { ViewTransition } from "react";
import ChatInput, { type onSendMessageProps } from "@/components/chat-input";
import ChatLayout from "@/components/chat-layout";
import ChatList from "@/components/chat-list";
import { useModelCatalog } from "@/components/model-catalog-provider";
import { useConversation } from "@/hooks/use-conversation";

const Page = () => {
  const { session_id } = useParams() as { session_id: string };
  const isNew = useSearchParams().get("new") !== null;
  const models = useModelCatalog("Text Generation");
  const { messages, status, send, stop, regenerate, authDialog, scroll } = useConversation({
    sessionId: session_id,
    isNew,
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
            onSendMessage={({ text, files }: onSendMessageProps) => send(text, files)}
            status={status}
            onStop={stop}
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
