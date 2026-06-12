"use client";

import { useState, ViewTransition } from "react";
import ChatInput, { type onSendMessageProps } from "@/components/chat-input";
import ChatLayout from "@/components/chat-layout";
import ChatList from "@/components/chat-list";
import { useImage } from "@/hooks/use-image";
import { useScrollToBottom } from "@/hooks/use-scroll-to-bottom";
import { models } from "@/lib/models";

const Page = () => {
  const { chatListRef, showToBottom, scrollToBottom } = useScrollToBottom();
  const { status, sendPrompt, messages, regenerate } = useImage({
    onUnauthorized: () => setAuthDialogOpen(true),
  });
  const [authDialogOpen, setAuthDialogOpen] = useState(false);

  const onSendMessage = async ({ text }: onSendMessageProps) => {
    scrollToBottom();

    await sendPrompt(text);

    setTimeout(() => {
      scrollToBottom();
    }, 200);
  };

  return (
    <ChatLayout
      chatListRef={chatListRef}
      showToBottom={showToBottom}
      scrollToBottom={scrollToBottom}
      authDialogOpen={authDialogOpen}
      setAuthDialogOpen={setAuthDialogOpen}
      bottomBar={
        <ViewTransition name="chat-input">
          <ChatInput
            models={models.filter((i) => i.type === "Text to Image")}
            className="mx-auto max-w-3xl bg-background shadow-xl"
            onSendMessage={onSendMessage}
            status={status}
            modalKey="CF_AI_MODEL_IMAGE"
            onRetry={regenerate}
          />
        </ViewTransition>
      }
    >
      <ChatList
        status={status}
        messages={messages}
        className="pt-16 pb-60 max-w-3xl mx-auto"
      />
    </ChatLayout>
  );
};

export default Page;
