import { createFileRoute } from "@tanstack/react-router";
import { ImagePlus } from "lucide-react";
import { ViewTransition } from "react";
import ChatInput, { type onSendMessageProps } from "@/components/chat-input";
import ChatLayout from "@/components/chat-layout";
import ChatList from "@/components/chat-list";
import { ImageAttachmentItem } from "@/components/image-attachment-item";
import { ImageParamsPanel } from "@/components/image-params-panel";
import { useModelCatalog, useModelPreferences } from "@/components/model-catalog-provider";
import { InputGroupButton } from "@/components/ui/input-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useImageGeneration } from "@/hooks/use-image-generation";

export const Route = createFileRoute("/image")({ component: Page });

function Page() {
  const models = useModelCatalog("Text to Image");
  const { preferences } = useModelPreferences();
  const selectedModel = models.find((model) => model.id === preferences.imageModelId) ?? models[0];

  const {
    messages,
    status,
    send,
    retry,
    authDialog,
    params,
    setParams,
    profile,
    referenceImages,
    addReferenceImages,
    removeReferenceImage,
    useGeneratedImageAsReference,
  } = useImageGeneration({
    models,
    selectedModelId: selectedModel?.id,
  });

  const supportsReferenceImages = profile.maxReferenceImages > 0;

  const onPickReferenceImages = () => {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.multiple = true;
    fileInput.onchange = () => {
      const picked = Array.from(fileInput.files ?? []);
      if (picked.length > 0) {
        void addReferenceImages(picked);
      }
    };
    fileInput.click();
  };

  const referencePreviews =
    referenceImages.length > 0 ? (
      <>
        {referenceImages.map((ref) => (
          <ImageAttachmentItem
            key={ref.id}
            src={ref.url}
            alt={ref.filename}
            onRemove={() => removeReferenceImage(ref.id)}
          />
        ))}
      </>
    ) : undefined;

  return (
    <ChatLayout
      authDialog={authDialog}
      bottomBar={
        <ViewTransition name="chat-input">
          <ChatInput
            models={models}
            className="mx-auto w-full max-w-3xl"
            onSendMessage={({ text }: onSendMessageProps) => send(text)}
            status={status}
            modelKey="imageModelId"
            enableContextAttachments={false}
            onRetry={retry}
            attachmentsPreview={referencePreviews}
            onPasteFiles={
              supportsReferenceImages ? (files) => void addReferenceImages(files) : undefined
            }
            addon={
              <>
                {selectedModel && (
                  <ImageParamsPanel
                    modelId={selectedModel.id}
                    profile={profile}
                    params={params}
                    onChangeParams={setParams}
                  />
                )}
                {supportsReferenceImages && (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <InputGroupButton
                          size="sm"
                          variant={referenceImages.length > 0 ? "secondary" : "ghost"}
                          aria-label="Attach reference images"
                          onClick={onPickReferenceImages}
                        />
                      }
                    >
                      <ImagePlus />
                      <span className="hidden sm:inline">
                        Ref{referenceImages.length > 0 ? ` (${referenceImages.length})` : ""}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      Attach up to {profile.maxReferenceImages} reference images
                    </TooltipContent>
                  </Tooltip>
                )}
              </>
            }
          />
        </ViewTransition>
      }
    >
      <ChatList
        status={status}
        messages={messages}
        onRetry={retry}
        onUseAsReference={
          supportsReferenceImages ? (url) => void useGeneratedImageAsReference(url) : undefined
        }
        className="mx-auto max-w-3xl pt-16 pb-4"
      />
    </ChatLayout>
  );
}
