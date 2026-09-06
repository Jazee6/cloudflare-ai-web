"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, generateId } from "ai";
import { useLiveQuery } from "dexie-react-hooks";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState, ViewTransition } from "react";
import { toast } from "@/components/ui/toast";
import ChatInput, { type onSendMessageProps } from "@/components/chat-input";
import ChatLayout from "@/components/chat-layout";
import ChatList from "@/components/chat-list";
import { useModelCatalog } from "@/components/model-catalog-provider";
import { useScrollToBottom } from "@/hooks/use-scroll-to-bottom";
import { db, type Message } from "@/lib/db";
import { getCookie, getStoredModel } from "@/lib/utils";

const Page = () => {
  const { session_id } = useParams() as { session_id: string };
  const searchParams = useSearchParams();
  const isNew = searchParams.get("new") !== null;
  const [loaded, setLoaded] = useState(isNew);
  const { chatListRef, showToBottom, scrollToBottom } = useScrollToBottom();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const models = useModelCatalog("Text Generation");

  const initMessages = useLiveQuery(
    () => db.message.where("sessionId").equals(session_id).limit(100).sortBy("createdAt"),
    [session_id],
  );

  const { messages, sendMessage, status, setMessages, stop, regenerate } = useChat<Message>({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ messages }) => {
        const selectedModel = getStoredModel(models, "CF_AI_MODEL");
        if (!selectedModel) {
          throw new Error("No chat models are currently available");
        }
        const { id, provider } = selectedModel;

        return {
          headers: {
            Authorization: localStorage.getItem("CF_AI_PASSWORD") ?? "",
          },
          body: {
            messages: messages.slice(-10),
            model: id,
            provider,
            search: getCookie("CF_AI_SEARCH_ENABLED") === "true",
          },
        };
      },
    }),
    onFinish: ({ message, isError }) => {
      if (!isError) {
        db.message.add({
          ...message,
          sessionId: session_id,
          createdAt: new Date(),
        });
        db.session.update(session_id, {
          updatedAt: new Date(),
        });
      }
    },
    onError: async (error) => {
      if (error.message === "Unauthorized") {
        setAuthDialogOpen(true);
        return;
      }
      toast.add({
        title:
          error.message.length > 100
            ? `${error.message.slice(0, 100)}...`
            : error.message || "Unknown error occurred. Please try again.",
        type: "error",
      });
    },
  });

  useEffect(() => {
    if (initMessages && !loaded) {
      setMessages(initMessages);
      setLoaded(true);
    }
  }, [initMessages, setMessages, loaded]);

  useEffect(() => {
    if (isNew && initMessages) {
      const text = initMessages[0].parts.find((i) => i.type === "text")?.text;
      const files = initMessages[0].parts.filter((i) => i.type === "file");
      if (text) {
        sendMessage({
          text,
          files,
        });
        history.replaceState(null, "", location.pathname);
      }
    }
  }, [isNew, initMessages, sendMessage]);

  // The mutable scroll container is sampled whenever stream state changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: refs are not reactive dependencies
  useEffect(() => {
    if (status === "streaming" && chatListRef.current && messages.length) {
      if (
        chatListRef.current.scrollHeight -
          chatListRef.current.scrollTop -
          chatListRef.current.clientHeight <
        250
      ) {
        scrollToBottom();
      }
    }
  }, [status, messages, scrollToBottom]);

  const onSendMessage = async (data: onSendMessageProps) => {
    const { text, files } = data;

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
      sessionId: session_id,
      createdAt: new Date(),
    });
    await db.session.update(session_id, {
      updatedAt: new Date(),
    });

    scrollToBottom();

    await sendMessage({
      text,
      files,
    });
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
            models={models}
            className="mx-auto max-w-3xl bg-background shadow-xl"
            onSendMessage={onSendMessage}
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
