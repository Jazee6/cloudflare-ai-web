import { useChat } from "@ai-sdk/react";
import { type FileUIPart, type UIMessage } from "ai";
import { useEffect, useRef, useState } from "react";
import { toast } from "@/components/ui/toast";
import { useAuthRetry } from "@/hooks/use-auth-retry";
import {
  appendConversationMessage,
  createUserMessage,
  loadConversationHistory,
  replaceConversationResponse,
} from "@/lib/conversation-store";
import { createConversationTransport } from "@/lib/chat-transport";
import type { Model } from "@/lib/models";

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
  const [startsWithPendingMessage] = useState(isNew);
  // The stored response a Retry will replace once the new response succeeds.
  const retriedRef = useRef<UIMessage | null>(null);
  // A failed response that is shown but was never saved, so retrying it replaces nothing.
  const unsavedIdRef = useRef<string | null>(null);

  const { messages, sendMessage, status, setMessages, stop, regenerate } = useChat({
    id: sessionId,
    transport: createConversationTransport(sessionId, models),
    onFinish: ({ message, messages, isError }) => {
      // An aborted request that produced nothing reports an assistant message that was
      // never added to the list; only persist responses the user actually saw.
      const isVisible = messages.some((candidate) => candidate.id === message.id);
      const retried = retriedRef.current;
      retriedRef.current = null;
      if (isError || !isVisible || message.parts.length === 0) {
        if (isVisible) {
          unsavedIdRef.current = message.id;
        }
        if (retried) {
          // The Retry failed, so the stored response still stands; show it again.
          setMessages((current) => [
            ...current.filter((candidate) => candidate.id !== message.id),
            retried,
          ]);
        }
        return;
      }

      resetAuthRetry();
      const save = retried
        ? replaceConversationResponse(sessionId, retried.id, message)
        : appendConversationMessage(sessionId, message);
      save.catch(() => {
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

  /** Retries the latest response, replacing it in Conversation History only if it was saved. */
  const retry = () => {
    const latest = messages.at(-1);
    retriedRef.current =
      latest?.role === "assistant" && latest.id !== unsavedIdRef.current ? latest : null;
    return regenerate();
  };

  const { authDialog, handleUnauthorized, resetAuthRetry } = useAuthRetry(retry);

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

  const send = async (text: string, files?: FileUIPart[]) => {
    resetAuthRetry();
    const message = createUserMessage(text, files);
    try {
      await appendConversationMessage(sessionId, message);
    } catch {
      showError("Unable to save the message to chat history.");
      return;
    }

    await sendMessage(message);
  };

  return { messages, status, send, stop, retry, authDialog };
};
