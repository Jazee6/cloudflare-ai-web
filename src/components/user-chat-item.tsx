import type { UIMessage } from "ai";
import { ImagePlusIcon } from "lucide-react";
import BlobImage from "@/components/blob-image";
import { ContextAttachmentItem } from "@/components/context-attachment-item";
import ActionButton from "@/components/message-action";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Message, MessageContent, MessageFooter } from "@/components/ui/message";
import { toast } from "@/components/ui/toast";
import ZoomableImage from "@/components/zoomable-image";
import { isContextAttachmentPart } from "@/lib/context-attachments";
import { getImageBlobs } from "@/lib/image-turn";
import { useI18n } from "@/hooks/use-i18n";

const loadImage = async (url: string) => (await fetch(url)).blob();

const UserChatItem = ({
  message,
  onUseAsReference,
}: {
  message: UIMessage;
  onUseAsReference?: (image: Blob) => void;
}) => {
  const { t } = useI18n();
  const { parts } = message;
  const attachments = parts.filter(isContextAttachmentPart);
  const referenceImages = getImageBlobs(message, "data-reference-images");
  const uploadedImages = parts.filter(
    (part) => part.type === "file" && part.mediaType.startsWith("image/"),
  );

  const referenceUploadedImage = (url: string) => {
    loadImage(url)
      .then((image) => onUseAsReference?.(image))
      .catch(() => {
        toast.add({ title: t("message.referenceLoadFailed"), type: "error" });
      });
  };

  return (
    <Message align="end">
      <MessageContent>
        {attachments.length > 0 && (
          <div className="flex flex-wrap justify-end gap-2 p-px">
            {attachments.map((part, index) => (
              <ContextAttachmentItem key={`${part.data.id}-${index}`} attachment={part.data} />
            ))}
          </div>
        )}

        {referenceImages.length > 0 && (
          <div className="flex flex-wrap justify-end gap-2">
            {referenceImages.map((image, index) => (
              <BlobImage
                key={index}
                zoomClassName="w-20"
                blob={image}
                alt={`reference-${index + 1}`}
                className="aspect-square w-full rounded-md object-cover transition-all hover:brightness-75"
              />
            ))}
          </div>
        )}

        {parts.map((part, index) => {
          if (part.type === "text") {
            return (
              <Bubble key={`${part.type}-${index}`} align="end" variant="secondary">
                <BubbleContent className="whitespace-pre-wrap">{part.text}</BubbleContent>
              </Bubble>
            );
          }

          if (part.type === "file" && part.mediaType.startsWith("image/")) {
            return (
              <ZoomableImage key={`${part.type}-${index}`} className="self-end max-w-[50%]">
                <img
                  src={part.url}
                  alt={part.filename}
                  className="h-auto max-w-full rounded-md object-cover hover:brightness-75 transition-all"
                />
              </ZoomableImage>
            );
          }

          return null;
        })}

        {onUseAsReference && (uploadedImages.length > 0 || referenceImages.length > 0) && (
          <MessageFooter className="px-0">
            {uploadedImages.map(
              (part, index) =>
                part.type === "file" && (
                  <ActionButton
                    key={`file-${index}`}
                    label={
                      uploadedImages.length > 1
                        ? t("message.useImageAsReference", { index: index + 1 })
                        : t("message.useAsReference")
                    }
                    onClick={() => referenceUploadedImage(part.url)}
                  >
                    <ImagePlusIcon />
                  </ActionButton>
                ),
            )}
            {referenceImages.map((image, index) => (
              <ActionButton
                key={`reference-${index}`}
                label={t("message.reuseReference", { index: index + 1 })}
                onClick={() => onUseAsReference(image)}
              >
                <ImagePlusIcon />
              </ActionButton>
            ))}
          </MessageFooter>
        )}
      </MessageContent>
    </Message>
  );
};

export default UserChatItem;
