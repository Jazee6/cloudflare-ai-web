"use client";

import { ChevronDown } from "lucide-react";
import { debounce } from "next/dist/server/utils";
import {
  startTransition,
  useEffect,
  useRef,
  useState,
  ViewTransition,
} from "react";
import AuthDialog from "@/components/auth-dialog";
import ChatInput, { type onSendMessageProps } from "@/components/chat-input";
import ChatList from "@/components/chat-list";
import Footer from "@/components/footer";
import { Button } from "@/components/ui/button";
import { useImage } from "@/hooks/use-image";
import { models } from "@/lib/models";

const Page = () => {
  const [showToBottom, setShowToBottom] = useState(false);
  const chatListRef = useRef<HTMLDivElement>(null);
  const { status, sendPrompt, messages, regenerate } = useImage({
    onUnauthorized: () => setAuthDialogOpen(true),
  });
  const [authDialogOpen, setAuthDialogOpen] = useState(false);

  useEffect(() => {
    const onScroll = debounce(() => {
      if (chatListRef.current) {
        if (
          chatListRef.current.scrollTop + chatListRef.current.clientHeight <
          chatListRef.current.scrollHeight - 100
        ) {
          startTransition(() => setShowToBottom(true));
        } else {
          startTransition(() => setShowToBottom(false));
        }
      }
    }, 100);
    chatListRef.current?.addEventListener("scroll", onScroll);

    return () => chatListRef.current?.removeEventListener("scroll", onScroll);
  }, []);

  const onSendMessage = async ({ text }: onSendMessageProps) => {
    chatListRef.current?.scrollTo({
      top: chatListRef.current.scrollHeight,
      behavior: "smooth",
    });

    await sendPrompt(text);

    setTimeout(() => {
      chatListRef.current?.scrollTo({
        top: chatListRef.current.scrollHeight,
        behavior: "smooth",
      });
    }, 200);
  };

  return (
    <div className="flex flex-col h-screen">
      <div
        ref={chatListRef}
        className="overflow-y-auto scrollbar px-2"
        style={{ scrollbarGutter: "stable both-edges" }}
      >
        <ChatList
          status={status}
          messages={messages}
          className="pt-16 pb-60 max-w-3xl mx-auto"
        />
      </div>

      <div className="mt-auto pb-1 space-y-1 absolute bottom-0 left-0 right-0 bg-linear-to-t from-background to-transparent px-2">
        {showToBottom && (
          <ViewTransition>
            <Button
              size="icon"
              variant="outline"
              className="rounded-full shadow-xl absolute left-1/2 -translate-x-1/2 -top-10 z-10"
              onClick={() => {
                chatListRef.current?.scrollTo({
                  top: chatListRef.current.scrollHeight,
                  behavior: "smooth",
                });
              }}
            >
              <ChevronDown />
            </Button>
          </ViewTransition>
        )}

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
        <Footer />
      </div>

      <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
    </div>
  );
};

export default Page;
