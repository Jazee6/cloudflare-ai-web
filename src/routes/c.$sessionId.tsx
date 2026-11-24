import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import * as v from "valibot";
import ChatInput, { type onSendMessageProps } from "@/components/chat-input";
import ChatLayout from "@/components/chat-layout";
import ContextIndicator from "@/components/context-indicator";
import { preloadMarkdown } from "@/components/markdown";
import ChatList from "@/components/chat-list";
import { useModelCatalog } from "@/components/model-catalog-provider";
import { useSelectedModel } from "@/components/model-layout-provider";
import { useConversation } from "@/hooks/use-conversation";
import { useImageTurn } from "@/hooks/use-image-turn";

const searchSchema = v.object({ new: v.optional(v.boolean()) });

export const Route = createFileRoute("/c/$sessionId")({
  validateSearch: searchSchema,
  // Conversations live only in the visitor's browser; the URL has nothing to index.
  head: () => ({ meta: [{ name: "robots", content: "noindex" }] }),
  component: Page,
});

function Page() {
  const { sessionId } = Route.useParams();
  const isNew = Route.useSearch({ select: (search) => search.new === true });
  const models = useModelCatalog();
  const imageTurn = useImageTurn(useSelectedModel(models));
  const {
    messages,
    status,
    unansweredError,
    send,
    sendImagePrompt,
    stop,
    retry,
    authDialog,
    handleUnauthorized,
  } = useConversation({ sessionId, isNew, models });
  const canUseAsReference = imageTurn.profile.maxReferenceImages > 0;

  useEffect(preloadMarkdown, []);

  return (
    <ChatLayout
      authDialog={authDialog}
      bottomBar={
        <ChatInput
          models={models}
          imageTurn={imageTurn}
          className="mx-auto w-full max-w-3xl [view-transition-name:chat-input]"
          onSendMessage={({ text, files, attachments, imagePrompt }: onSendMessageProps) =>
            imagePrompt ? sendImagePrompt(imagePrompt) : send(text, files, attachments)
          }
          onUnauthorized={handleUnauthorized}
          status={status}
          onStop={stop}
          onRetry={retry}
          addon={<ContextIndicator sessionId={sessionId} messages={messages} />}
        />
      }
    >
      <ChatList
        status={status}
        messages={messages}
        unansweredError={unansweredError}
        onRetry={retry}
        onUseAsReference={
          canUseAsReference
            ? (image) => void imageTurn.addReferenceImages([{ blob: image }])
            : undefined
        }
        className="mx-auto max-w-3xl pt-16 pb-4"
      />
    </ChatLayout>
  );
}
