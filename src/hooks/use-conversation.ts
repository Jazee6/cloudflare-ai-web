import { useChat } from "@ai-sdk/react";
import { type ChatStatus, DefaultChatTransport, type FileUIPart, type UIMessage } from "ai";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useModelCatalogState } from "@/components/model-catalog-provider";
import { useSettings } from "@/components/settings-provider";
import { toast } from "@/components/ui/toast";
import { useAuthRetry } from "@/hooks/use-auth-retry";
import { stopGlobalSpeech } from "@/hooks/use-speech-synthesis";
import {
  appendConversationMessage,
  createUserMessage,
  loadConversationHistory,
  replaceConversationResponse,
} from "@/lib/conversation-store";
import type { ContextAttachmentData } from "@/lib/context-attachments";
import { fitImagePartsWithinLimit } from "@/lib/image-compression";
import { getImageEntryMetadata } from "@/lib/image-models";
import {
  createImageResponseMessage,
  getImageBlobs,
  getPromptText,
  isImageTurn,
  requestImage,
  resolveImageSeed,
} from "@/lib/image-turn";
import { buildModelContext, encodeGeneratedImages, expandImageTurns } from "@/lib/model-context";
import type { Model } from "@/lib/models";
import { getStoredModel, readPreferences } from "@/lib/preferences";

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
 * message, and starts the first response when the conversation was just created. A turn is
 * either a chat turn streamed from `/api/chat` or an image-generation turn from `/api/image`.
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
  const navigate = useNavigate();
  const { loading: catalogLoading, capabilities } = useModelCatalogState();
  const { settings } = useSettings();
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [hasPendingUserMessage, setHasPendingUserMessage] = useState(false);
  // Which kind of turn the shared status follows: the latest one started.
  const [activeTurn, setActiveTurn] = useState<"chat" | "image">("chat");
  const [imageStatus, setImageStatus] = useState<ChatStatus>("ready");
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;
  const startedPendingRef = useRef(false);
  const modelsRef = useRef(models);
  modelsRef.current = models;
  const capabilitiesRef = useRef(capabilities);
  capabilitiesRef.current = capabilities;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  // Marks the next transport request as a Retry so AI Gateway skips cached responses.
  const retryRequestRef = useRef(false);
  // The stored response a Retry will replace once the new response succeeds.
  const retriedRef = useRef<UIMessage | null>(null);
  // A failed response that is shown but was never saved, so retrying it replaces nothing.
  const unsavedIdRef = useRef<string | null>(null);

  const {
    messages,
    sendMessage,
    status: chatStatus,
    setMessages,
    stop,
    regenerate,
  } = useChat({
    id: sessionId,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: async ({ messages }) => {
        const isRetry = retryRequestRef.current;
        retryRequestRef.current = false;

        const selectedModel = getStoredModel(modelsRef.current);
        if (!selectedModel) {
          throw new Error("No chat models are currently available");
        }
        if (selectedModel.type !== "Text Generation") {
          throw new Error("Select a chat model to continue this response.");
        }

        const { messages: expanded, generatedImages } = expandImageTurns(
          messages,
          selectedModel.input?.includes("image") === true,
        );
        const modelContext = buildModelContext(expanded);
        if (!modelContext) {
          throw new Error("The latest message exceeds the 64,000-character context limit.");
        }

        const preferences = readPreferences();
        const knowledgeBaseId = capabilitiesRef.current.knowledgeBase
          ? preferences.knowledgeBase?.trim() || undefined
          : undefined;
        const customInstructions = settingsRef.current.customInstructions.trim();

        return {
          body: {
            messages: await fitImagePartsWithinLimit(
              await encodeGeneratedImages(modelContext, generatedImages),
            ),
            model: selectedModel.id,
            provider: selectedModel.provider,
            search: preferences.searchEnabled === true,
            skipCache: isRetry || settingsRef.current.skipGatewayCache,
            retry: isRetry,
            ...(knowledgeBaseId ? { knowledgeBaseId } : {}),
            ...(customInstructions ? { instructions: customInstructions } : {}),
          },
        };
      },
    }),
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

  /**
   * Generates the image for a prompt already in Conversation History and saves it, in place of
   * `replacedId` when retrying. The prompt's image model is used unless another image model is
   * selected now.
   */
  const runImageTurn = async (
    prompt: UIMessage,
    { replacedId, retry = false }: { replacedId?: string; retry?: boolean } = {},
  ) => {
    const turnSessionId = sessionId;
    const isCurrent = () => sessionIdRef.current === turnSessionId;
    const metadata = getImageEntryMetadata(prompt);
    const text = getPromptText(prompt);
    const selected = getStoredModel(modelsRef.current);
    const model =
      selected?.type === "Text to Image"
        ? selected
        : modelsRef.current.find(
            (candidate) => candidate.id === metadata?.modelId && candidate.type === "Text to Image",
          );

    setActiveTurn("image");
    if (!text || !metadata?.params || !model) {
      setImageStatus("error");
      showError(model ? "No prompt to retry." : "Select an image model to generate this image.");
      return;
    }

    setImageStatus("submitted");
    const result = await requestImage({
      prompt: text,
      model,
      params: retry ? resolveImageSeed(model.id, metadata.params, "retry") : metadata.params,
      referenceImages: getImageBlobs(prompt, "data-reference-images"),
      skipCache: retry || settingsRef.current.skipGatewayCache,
    });
    if (!result.ok) {
      if (!isCurrent()) {
        return;
      }
      setImageStatus("error");
      if (result.unauthorized) {
        handleUnauthorized();
      } else {
        showError(result.message);
      }
      return;
    }

    resetAuthRetry();
    const response = createImageResponseMessage(model, result.params, result.image);
    try {
      await (replacedId
        ? replaceConversationResponse(turnSessionId, replacedId, response)
        : appendConversationMessage(turnSessionId, response));
    } catch {
      showError("Unable to save the generated image.");
    }
    if (isCurrent()) {
      setMessages((current) => [
        ...current.filter((candidate) => candidate.id !== replacedId),
        response,
      ]);
      setImageStatus("ready");
    }
  };

  /** Retries the latest response, replacing it in Conversation History only if it was saved. */
  const retry = () => {
    stopGlobalSpeech();
    const latest = messages.at(-1);
    const latestPrompt = messages.findLast((message) => message.role === "user");
    if (latestPrompt && isImageTurn(latestPrompt)) {
      return runImageTurn(latestPrompt, {
        replacedId: latest?.role === "assistant" ? latest.id : undefined,
        retry: true,
      });
    }

    setActiveTurn("chat");
    retriedRef.current =
      latest?.role === "assistant" && latest.id !== unsavedIdRef.current ? latest : null;
    retryRequestRef.current = true;
    return regenerate();
  };

  const { authDialog, handleUnauthorized, resetAuthRetry } = useAuthRetry(retry);

  // `?new` is read once per load: dropping it from the URL must not reload history mid-stream.
  const readIsNew = useEffectEvent(() => isNew);

  useEffect(() => {
    let cancelled = false;
    setHistoryLoaded(false);
    setHasPendingUserMessage(false);
    setActiveTurn("chat");
    setImageStatus("ready");
    startedPendingRef.current = false;

    loadConversationHistory(sessionId)
      .then((history) => {
        if (cancelled) {
          return;
        }
        setMessages(history);
        setHasPendingUserMessage(readIsNew() && history.at(-1)?.role === "user");
        setHistoryLoaded(true);
      })
      .catch(() => {
        if (!cancelled) {
          showError("Unable to load chat history.");
        }
      });

    return () => {
      cancelled = true;
      stopGlobalSpeech();
    };
  }, [sessionId, setMessages]);

  // The first turn of a new conversation is a chat or image turn, depending on its prompt.
  const startPendingTurn = useEffectEvent(() => {
    const pending = messages.at(-1);
    if (pending && isImageTurn(pending)) {
      void runImageTurn(pending);
    } else {
      void regenerate();
    }
  });

  useEffect(() => {
    if (
      !historyLoaded ||
      !hasPendingUserMessage ||
      startedPendingRef.current ||
      catalogLoading ||
      models.length === 0
    ) {
      return;
    }

    startedPendingRef.current = true;
    // Drop `?new` so a reload does not resend. No view transition: one is still animating the
    // input from the home page, and a second would cut it short.
    void navigate({
      to: "/c/$sessionId",
      params: { sessionId },
      search: {},
      replace: true,
      viewTransition: false,
    });
    startPendingTurn();
  }, [historyLoaded, hasPendingUserMessage, catalogLoading, models.length, navigate, sessionId]);

  const send = async (
    text: string,
    files?: FileUIPart[],
    attachments?: ContextAttachmentData[],
  ) => {
    stopGlobalSpeech();
    resetAuthRetry();
    const message = createUserMessage(text, files, attachments);
    try {
      await appendConversationMessage(sessionId, message);
    } catch {
      showError("Unable to save the message to chat history.");
      return;
    }

    setActiveTurn("chat");
    await sendMessage(message);
  };

  /** Sends an image-generation prompt built by `useImageTurn`. */
  const sendImagePrompt = async (prompt: UIMessage) => {
    stopGlobalSpeech();
    resetAuthRetry();
    try {
      await appendConversationMessage(sessionId, prompt);
    } catch {
      showError("Unable to save the prompt to chat history.");
      return;
    }

    setMessages((current) => [...current, prompt]);
    await runImageTurn(prompt);
  };

  const status = activeTurn === "image" ? imageStatus : chatStatus;

  return {
    messages,
    status,
    send,
    sendImagePrompt,
    stop,
    retry,
    authDialog,
    handleUnauthorized,
  };
};
