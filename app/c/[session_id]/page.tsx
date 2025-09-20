"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useParams, useSearchParams } from "next/navigation";
import { db, type Message } from "@/lib/db";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, generateId } from "ai";
import {
  unstable_ViewTransition as ViewTransition,
  useEffect,
  useState,
} from "react";
import ChatInput, { type onSendMessageProps } from "@/components/chat-input";
import Footer from "@/components/footer";
import ChatList from "@/components/chat-list";
import { getStoredModelId } from "@/components/model-select";
import { toast } from "sonner";

const Page = () => {
  const { session_id } = useParams();
  const searchParams = useSearchParams();
  const isNew = searchParams.get("new") !== null;
  const [loaded, setLoaded] = useState(isNew);

  const initMessages = useLiveQuery(
    () =>
      db.message
        .where("sessionId")
        .equals(session_id as string)
        .limit(100)
        .sortBy("createdAt"),
    [session_id as string],
  );

  const {
    messages,
    sendMessage,
    status,
    setMessages,
    stop,
    error,
    regenerate,
  } = useChat<Message>({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: () => ({
        model: getStoredModelId(),
      }),
    }),
    experimental_throttle: 100,
    onFinish: ({ message, isError }) => {
      if (!isError) {
        db.message.add({
          ...message,
          sessionId: session_id as string,
          createdAt: new Date(),
        });
        db.session.update(session_id as string, {
          updatedAt: new Date(),
        });
      }
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
      if (initMessages[0].parts[0].type === "text") {
        sendMessage({
          text: initMessages[0].parts[0].text,
        });
        history.replaceState(null, "", location.pathname);
      }
    }
  }, [isNew, initMessages, sendMessage]);

  useEffect(() => {
    if (error) {
      toast.error("Unknown error occurred. Please try again.");
    }
  }, [error]);

  const onSendMessage = async (data: onSendMessageProps) => {
    const { message } = data;

    await db.message.add({
      id: generateId(),
      parts: [
        {
          type: "text",
          text: message,
        },
      ],
      role: "user",
      sessionId: session_id as string,
      createdAt: new Date(),
    });
    await db.session.update(session_id as string, {
      updatedAt: new Date(),
    });
    sendMessage({
      text: message,
    });
  };

  return (
    <div className="flex flex-col h-screen">
      <div
        className="overflow-y-auto scrollbar px-4"
        style={{ scrollbarGutter: "stable both-edges" }}
      >
        <ChatList messages={messages} className="pt-16 pb-[50vh]" />
      </div>

      <div className="mt-auto pb-1 space-y-1 absolute bottom-0 left-0 right-0 bg-linear-to-t from-background to-transparent px-2">
        <ViewTransition name="chat-input">
          <ChatInput
            className="mx-auto max-w-3xl bg-background shadow-xl"
            onSendMessage={onSendMessage}
            status={status}
            onStop={stop}
            onRetry={regenerate}
          />
        </ViewTransition>
        <Footer />
      </div>
    </div>
  );
};

export default Page;
