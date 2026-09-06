"use client";

import { useEffect, useState, ViewTransition } from "react";
import ChatInput, { type onSendMessageProps } from "@/components/chat-input";
import ChatLayout from "@/components/chat-layout";
import ChatList from "@/components/chat-list";
import { useModelCatalog } from "@/components/model-catalog-provider";
import { useImage } from "@/hooks/use-image";
import { useScrollToBottom } from "@/hooks/use-scroll-to-bottom";

const Page = () => {
  const { chatListRef, showToBottom, scrollToBottom } = useScrollToBottom();
  const models = useModelCatalog("Text to Image");
  const { status, sendPrompt, messages, regenerate, retryAfterAuth } = useImage({
    models,
    onUnauthorized: () => setAuthDialogOpen(true),
  });
  const [authDialogOpen, setAuthDialogOpen] = useState(false);

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages.length, scrollToBottom]);

  const onSendMessage = async ({ text }: onSendMessageProps) => {
    scrollToBottom();
    await sendPrompt(text);
  };

  return (
    <ChatLayout
      chatListRef={chatListRef}
      showToBottom={showToBottom}
      scrollToBottom={scrollToBottom}
      authDialogOpen={authDialogOpen}
      setAuthDialogOpen={setAuthDialogOpen}
      onAuthenticated={() => {
        setAuthDialogOpen(false);
        void retryAfterAuth();
      }}
      bottomBar={
        <ViewTransition name="chat-input">
          <ChatInput
            models={models}
            className="mx-auto max-w-3xl bg-background shadow-xl"
            onSendMessage={onSendMessage}
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
