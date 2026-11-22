import type { UIMessage } from "ai";
import { ContextAttachmentItem } from "@/components/context-attachment-item";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Message, MessageContent } from "@/components/ui/message";
import ZoomableImage from "@/components/zoomable-image";
import { isContextAttachmentPart } from "@/lib/context-attachments";

const UserChatItem = ({ parts }: { parts: UIMessage["parts"] }) => {
  const attachments = parts.filter(isContextAttachmentPart);

  return (
    <Message align="end">
      <MessageContent>
        {attachments.length > 0 && (
          <div className="flex flex-wrap justify-end gap-2">
            {attachments.map((part, index) => (
              <ContextAttachmentItem key={`${part.data.id}-${index}`} attachment={part.data} />
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
      </MessageContent>
    </Message>
  );
};

export default UserChatItem;
