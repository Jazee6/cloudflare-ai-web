import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type FileUIPart } from "ai";
import { useEffect, useState } from "react";
import { toast } from "@/components/ui/toast";
import { useAuthRetry } from "@/hooks/use-auth-retry";
import { useScrollToBottom } from "@/hooks/use-scroll-to-bottom";
import {
  appendConversationMessage,
  createUserMessage,
  loadConversationHistory,
} from "@/lib/conversation-store";
import { buildModelContext } from "@/lib/model-context";
import type { Model } from "@/lib/models";
import { getCookie, getStoredModel } from "@/lib/utils";

const MAX_TOAST_LENGTH = 100;

const showError = (message: string) => {
  toast.add({
    title:
      message.length > MAX_TOAST_LENGTH
        ? `${message.slice(0, MAX_TOAST_LENGTH)}...`
        : message || "Unknown error occurred. Please try again.",
    type: "error",
  });
};

/**
 * Drives one Conversation History: loads its newest messages, persists each finished
 * message, and starts the first response when the conversation was just created.
 */
export const useConversation = ({
  sessionId,
  isNew,
  models,
}: {
  sessionId: string;
  isNew: boolean;
  models: Model[];
}) => {
  const scroll = useScrollToBottom();
  const [startsWithPendingMessage] = useState(isNew);

  const { messages, sendMessage, status, setMessages, stop, regenerate } = useChat({
    id: sessionId,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ messages }) => {
        const selectedModel = getStoredModel(models, "CF_AI_MODEL");
        if (!selectedModel) {
          throw new Error("No chat models are currently available");
        }

        const modelContext = buildModelContext(messages);
        if (!modelContext) {
          throw new Error("The latest message exceeds the 64,000-character context limit.");
        }

        return {
          body: {
            messages: modelContext,
            model: selectedModel.id,
            provider: selectedModel.provider,
            search: getCookie("CF_AI_SEARCH_ENABLED") === "true",
          },
        };
      },
    }),
    onFinish: ({ message, messages, isError }) => {
      // An aborted request that produced nothing reports an assistant message that was
      // never added to the list; only persist responses the user actually saw.
      const isVisible = messages.some((candidate) => candidate.id === message.id);
      if (isError || !isVisible || message.parts.length === 0) {
        return;
      }

      resetAuthRetry();
      appendConversationMessage(sessionId, message).catch(() => {
        showError("Unable to save the response to chat history.");
      });
    },
    onError: (error) => {
      if (error.message === "Unauthorized") {
        handleUnauthorized();
        return;
      }
      showError(error.message);
    },
  });

  const { authDialog, handleUnauthorized, resetAuthRetry } = useAuthRetry(() => regenerate());

  useEffect(() => {
    let cancelled = false;
    loadConversationHistory(sessionId)
      .then((history) => {
        if (cancelled) {
          return;
        }
        setMessages(history);
        if (startsWithPendingMessage && history.at(-1)?.role === "user") {
          window.history.replaceState(null, "", location.pathname);
          void regenerate();
        }
      })
      .catch(() => {
        if (!cancelled) {
          showError("Unable to load chat history.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId, startsWithPendingMessage, setMessages, regenerate]);

  useEffect(() => {
    if (status === "streaming") {
      scroll.followIfNearBottom();
    }
  }, [status, messages, scroll.followIfNearBottom]);

  const send = async (text: string, files?: FileUIPart[]) => {
    resetAuthRetry();
    const message = createUserMessage(text, files);
    try {
      await appendConversationMessage(sessionId, message);
    } catch {
      showError("Unable to save the message to chat history.");
      return;
    }

    scroll.scrollToBottom();
    await sendMessage(message);
  };

  return { messages, status, send, stop, regenerate, authDialog, scroll };
};
