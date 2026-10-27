"use client";

import { useParams, useSearchParams } from "next/navigation";
import { ViewTransition } from "react";
import ChatInput, { type onSendMessageProps } from "@/components/chat-input";
import ChatLayout from "@/components/chat-layout";
import ContextIndicator from "@/components/context-indicator";
import ChatList from "@/components/chat-list";
import { useModelCatalog } from "@/components/model-catalog-provider";
import { useConversation } from "@/hooks/use-conversation";

const Page = () => {
  const { session_id } = useParams() as { session_id: string };
  const isNew = useSearchParams().get("new") !== null;
  const models = useModelCatalog("Text Generation");
  const { messages, status, send, stop, retry, authDialog } = useConversation({
    sessionId: session_id,
    isNew,
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
            onSendMessage={({ text, files }: onSendMessageProps) => send(text, files)}
            status={status}
            onStop={stop}
            onRetry={retry}
            addon={<ContextIndicator messages={messages} />}
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
