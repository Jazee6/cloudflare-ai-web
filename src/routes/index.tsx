import { createFileRoute, useNavigate } from "@tanstack/react-router";
import AuthDialog from "@/components/auth-dialog";
import ChatInput, { type onSendMessageProps } from "@/components/chat-input";
import Footer from "@/components/footer";
import { useModelCatalog } from "@/components/model-catalog-provider";
import { useSelectedModel } from "@/components/model-layout-provider";
import { TextEffect } from "@/components/ui/text-effect";
import { toast } from "@/components/ui/toast";
import { useAuthRetry } from "@/hooks/use-auth-retry";
import { useImageTurn } from "@/hooks/use-image-turn";
import { createConversation, createUserMessage } from "@/lib/conversation-store";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const navigate = useNavigate();
  const models = useModelCatalog();
  const imageTurn = useImageTurn(useSelectedModel(models));
  const { authDialog, handleUnauthorized, resetAuthRetry } = useAuthRetry(() => {});

  const onSendMessage = async ({ text, files, attachments, imagePrompt }: onSendMessageProps) => {
    resetAuthRetry();
    try {
      const sessionId = await createConversation(
        imagePrompt ?? createUserMessage(text, files, attachments),
      );
      await navigate({
        to: "/c/$sessionId",
        params: { sessionId },
        search: { new: true },
        replace: true,
      });
    } catch {
      toast.add({ title: "Unable to start a new chat.", type: "error" });
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="flex flex-col justify-center h-full w-full gap-4 px-4">
        <div className="font-bold text-2xl mx-auto font-mono">
          <TextEffect per="word" preset="fade-in-blur">
            How can I assist you today?
          </TextEffect>
        </div>
        <ChatInput
          models={models}
          imageTurn={imageTurn}
          className="mx-auto w-full max-w-3xl [view-transition-name:chat-input]"
          onSendMessage={onSendMessage}
          onUnauthorized={handleUnauthorized}
        />
      </div>

      <Footer classname="mt-auto mb-1" />
      <AuthDialog {...authDialog} />
    </div>
  );
}
