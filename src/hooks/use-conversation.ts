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
import { createFailedResponse, isFailedResponse } from "@/lib/failed-response";
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
import { type AppError, appError, parseAppError } from "@/lib/error-codes";
import { translateErrorNow, translateNow } from "@/lib/i18n";
import {
  buildModelContext,
  encodeGeneratedImages,
  expandImageTurns,
  MODEL_CONTEXT_MAX_CHARS,
} from "@/lib/model-context";
import type { Model } from "@/lib/models";
import { readDeclaredModelPrices, resolveModelPrice } from "@/lib/model-prices";
import { getPersonalRequest, readPersonalProviders } from "@/lib/personal-providers";
import { getStoredModel, readPreferences } from "@/lib/preferences";
import { getResponseMetadata } from "@/lib/response-metadata";
import { estimateCost, recordUsage } from "@/lib/usage-ledger";

const MAX_TOAST_LENGTH = 100;

/** A failure found before a request was sent; it is only toasted, never kept as a Failed Response. */
class RequestNotSentError extends Error {
  constructor(readonly detail: AppError) {
    super(detail.message);
  }
}

const showToast = (text: string) => {
  toast.add({
    title: text.length > MAX_TOAST_LENGTH ? `${text.slice(0, MAX_TOAST_LENGTH)}...` : text,
    type: "error",
  });
};

const showError = (error: AppError) => showToast(translateErrorNow(error));

/** The error behind a failed request: a serialized app error or raw upstream text. */
const toAppError = (error: Error): AppError =>
  error instanceof RequestNotSentError ? error.detail : parseAppError(error.message);

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
  // The latest failure, kept so an unanswered prompt can show why once the toast is gone.
  const [lastError, setLastError] = useState<AppError | null>(null);
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
  // A response that is shown but was never saved, so retrying it replaces nothing.
  const unsavedIdRef = useRef<string | null>(null);
  // The error behind the request that is finishing; `onError` runs just before `onFinish`.
  const requestErrorRef = useRef<Error | null>(null);
  // The model the latest chat request was sent to, for the Usage Ledger.
  const requestModelRef = useRef<Model | null>(null);

  const {
    messages,
    sendMessage,
    status: chatStatus,
    setMessages,
    stop,
    regenerate,
  } = useChat({
    id: sessionId,
    // Batches streamed chunks so fast models do not re-parse Markdown on every token.
    throttle: 50,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: async ({ messages }) => {
        const isRetry = retryRequestRef.current;
        retryRequestRef.current = false;

        const selectedModel = getStoredModel(modelsRef.current);
        if (!selectedModel) {
          throw new RequestNotSentError(appError("noChatModels"));
        }
        if (selectedModel.type !== "Text Generation") {
          throw new RequestNotSentError(appError("selectChatModel"));
        }
        requestModelRef.current = selectedModel;

        const { messages: expanded, generatedImages } = expandImageTurns(
          messages,
          selectedModel.input?.includes("image") === true,
        );
        const modelContext = buildModelContext(expanded, {
          maxMessages: settingsRef.current.contextMessageLimit,
        });
        if (!modelContext) {
          throw new RequestNotSentError(
            appError("contextLimitExceeded", { max: MODEL_CONTEXT_MAX_CHARS.toLocaleString("en") }),
          );
        }

        const preferences = readPreferences();
        const knowledgeBaseId = capabilitiesRef.current.knowledgeBase
          ? preferences.knowledgeBase?.trim() || undefined
          : undefined;
        const customInstructions = settingsRef.current.customInstructions.trim();
        const personal = getPersonalRequest(selectedModel, readPersonalProviders());
        if (selectedModel.source === "personal" && !personal) {
          throw new RequestNotSentError(appError("personalModelMissing"));
        }

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
            ...(personal ? { personal } : {}),
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
      const error = requestErrorRef.current;
      requestErrorRef.current = null;
      if (isError && error && !(error instanceof RequestNotSentError)) {
        const detail = toAppError(error);
        const unauthorized = detail.code === "unauthorized";
        if (unauthorized || (retried && !isFailedResponse(retried))) {
          // The prompt still has its response (or will be retried after signing in).
          setMessages((current) => [
            ...current.filter((candidate) => candidate.id !== message.id),
            ...(retried ? [retried] : []),
          ]);
          if (!unauthorized) {
            showError(detail);
          }
          return;
        }
        keepFailure(detail, { replaced: retried, partialId: message.id });
        return;
      }
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
        showToast(translateNow("chat.saveResponseFailed"));
      });
      recordResponseUsage(message, sessionId);
    },
    onError: (error) => {
      requestErrorRef.current = error;
      const detail = toAppError(error);
      if (detail.code === "unauthorized") {
        handleUnauthorized();
        return;
      }
      if (error instanceof RequestNotSentError) {
        setLastError(detail);
        showError(detail);
      }
    },
  });

  /** Adds a finished response to the Usage Ledger with its Estimated Cost, when it has usage. */
  const recordResponseUsage = (message: UIMessage, turnSessionId: string) => {
    const model = requestModelRef.current;
    const metadata = getResponseMetadata(message);
    const used = metadata?.totalUsage ?? metadata?.usage;
    if (!model || !used) {
      return;
    }
    const price = resolveModelPrice(model, readDeclaredModelPrices());
    recordUsage({
      id: message.id,
      sessionId: turnSessionId,
      createdAt: new Date(),
      modelId: model.id,
      modelName: metadata?.modelName ?? model.name,
      inputTokens: used.inputTokens,
      outputTokens: used.outputTokens,
      ...(price
        ? {
            cost: estimateCost(used, price, { cacheHit: metadata?.gateway?.cacheStatus === "HIT" }),
          }
        : {}),
    }).catch(() => {
      // The ledger is best effort; the response itself is already saved.
    });
  };

  /**
   * Keeps a failed request as a Failed Response in place of the response it was retried from, if
   * that was itself a Failed Response. A partially streamed response is dropped.
   */
  const keepFailure = (
    error: AppError,
    { replaced, partialId }: { replaced?: UIMessage | null; partialId?: string } = {},
  ) => {
    const failure = createFailedResponse(error);
    const turnSessionId = sessionIdRef.current;
    const save = replaced
      ? replaceConversationResponse(turnSessionId, replaced.id, failure)
      : appendConversationMessage(turnSessionId, failure);
    save.catch(() => {
      showError(error);
    });
    setMessages((current) => [
      ...current.filter((candidate) => candidate.id !== partialId && candidate.id !== replaced?.id),
      failure,
    ]);
  };

  /**
   * Generates the image for a prompt already in Conversation History and saves it, in place of
   * `replacedId` when retrying. The prompt's image model is used unless another image model is
   * selected now.
   */
  const runImageTurn = async (
    prompt: UIMessage,
    { replaced, retry = false }: { replaced?: UIMessage; retry?: boolean } = {},
  ) => {
    const replacedId = replaced?.id;
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
      const error = appError(model ? "noPromptToRetry" : "selectImageModelToRetry");
      setImageStatus("error");
      setLastError(error);
      showError(error);
      return;
    }

    setImageStatus("submitted");
    const result = await requestImage({
      prompt: text,
      model,
      params: retry ? resolveImageSeed(model, metadata.params, "retry") : metadata.params,
      referenceImages: getImageBlobs(prompt, "data-reference-images"),
      skipCache: retry || settingsRef.current.skipGatewayCache,
    });
    if (!result.ok) {
      if (!isCurrent()) {
        return;
      }
      if (result.unauthorized) {
        setImageStatus("error");
        handleUnauthorized();
      } else if (replaced && !isFailedResponse(replaced)) {
        // The prompt keeps the image it already has.
        setImageStatus("error");
        showError(result.error);
      } else {
        keepFailure(result.error, { replaced });
        setImageStatus("ready");
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
      showToast(translateNow("chat.saveImageFailed"));
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
    setLastError(null);
    const latest = messages.at(-1);
    const latestPrompt = messages.findLast((message) => message.role === "user");
    if (latestPrompt && isImageTurn(latestPrompt)) {
      return runImageTurn(latestPrompt, {
        replaced: latest?.role === "assistant" ? latest : undefined,
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
    setLastError(null);
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
          showToast(translateNow("chat.loadHistoryFailed"));
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
    setHasPendingUserMessage(false);
  }, [historyLoaded, hasPendingUserMessage, catalogLoading, models.length, navigate, sessionId]);

  const send = async (
    text: string,
    files?: FileUIPart[],
    attachments?: ContextAttachmentData[],
  ) => {
    stopGlobalSpeech();
    resetAuthRetry();
    setLastError(null);
    const message = createUserMessage(text, files, attachments);
    try {
      await appendConversationMessage(sessionId, message);
    } catch {
      showToast(translateNow("chat.saveMessageFailed"));
      return;
    }

    setActiveTurn("chat");
    await sendMessage(message);
  };

  /** Sends an image-generation prompt built by `useImageTurn`. */
  const sendImagePrompt = async (prompt: UIMessage) => {
    stopGlobalSpeech();
    resetAuthRetry();
    setLastError(null);
    try {
      await appendConversationMessage(sessionId, prompt);
    } catch {
      showToast(translateNow("chat.savePromptFailed"));
      return;
    }

    setMessages((current) => [...current, prompt]);
    await runImageTurn(prompt);
  };

  const status = activeTurn === "image" ? imageStatus : chatStatus;
  // A prompt left without a response, after a failure or an interrupted page, offers a Retry.
  const unanswered =
    historyLoaded &&
    !hasPendingUserMessage &&
    messages.at(-1)?.role === "user" &&
    status !== "submitted" &&
    status !== "streaming";

  return {
    messages,
    status,
    unansweredError: unanswered ? (lastError ?? appError("noResponse")) : null,
    send,
    sendImagePrompt,
    stop,
    retry,
    authDialog,
    handleUnauthorized,
  };
};
