import type { UIMessage } from "ai";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Message, MessageContent } from "@/components/ui/message";
import ZoomableImage from "@/components/zoomable-image";

const UserChatItem = ({ parts }: { parts: UIMessage["parts"] }) => {
  return (
    <Message align="end">
      <MessageContent>
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
