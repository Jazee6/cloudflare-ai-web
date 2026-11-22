import { createFileRoute } from "@tanstack/react-router";
import { ViewTransition } from "react";
import * as v from "valibot";
import ChatInput, { type onSendMessageProps } from "@/components/chat-input";
import ChatLayout from "@/components/chat-layout";
import ContextIndicator from "@/components/context-indicator";
import ChatList from "@/components/chat-list";
import { useModelCatalog } from "@/components/model-catalog-provider";
import { useConversation } from "@/hooks/use-conversation";

const searchSchema = v.object({ new: v.optional(v.boolean()) });

export const Route = createFileRoute("/c/$sessionId")({
  validateSearch: searchSchema,
  component: Page,
});

function Page() {
  const { sessionId } = Route.useParams();
  const isNew = Route.useSearch({ select: (search) => search.new === true });
  const models = useModelCatalog("Text Generation");
  const { messages, status, send, stop, retry, authDialog, handleUnauthorized } = useConversation({
    sessionId,
    isNew,
    models,
  });

  return (
    <ChatLayout
      authDialog={authDialog}
      bottomBar={
        <ViewTransition name="chat-input">
          <ChatInput
            models={models}
            className="mx-auto w-full max-w-3xl"
            onSendMessage={({ text, files, attachments }: onSendMessageProps) =>
              send(text, files, attachments)
            }
            onUnauthorized={handleUnauthorized}
            status={status}
            onStop={stop}
            onRetry={retry}
            addon={<ContextIndicator messages={messages} />}
          />
        </ViewTransition>
      }
    >
      <ChatList
        status={status}
        messages={messages}
        onRetry={retry}
        className="mx-auto max-w-3xl pt-16 pb-4"
      />
    </ChatLayout>
  );
}
