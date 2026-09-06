import type { Message } from "@/lib/db";
import { cn } from "@/lib/utils";
import ZoomableImage from "@/components/zoomable-image";

const UserChatItem = ({ className, parts }: { className?: string; parts: Message["parts"] }) => {
  return (
    <div className={cn("space-y-1 flex flex-col", className)}>
      {parts.map((part, index) => {
        if (part.type === "text") {
          return (
            <div
              key={`${part.type}-${index}`}
              className="bg-secondary px-2 py-1 rounded-md self-end"
            >
              {part.text}
            </div>
          );
        }

        if (part.type === "file") {
          if (part.mediaType.startsWith("image/")) {
            return (
              <ZoomableImage key={`${part.type}-${index}`} className="self-end max-w-[50%]">
                {/* biome-ignore lint/performance/noImgElement: <data_url> */}
                <img
                  src={part.url}
                  alt={part.filename}
                  className="h-auto max-w-full rounded-md object-cover hover:brightness-75 transition-all"
                />
              </ZoomableImage>
            );
          }
        }

        return null;
      })}
    </div>
  );
};

export default UserChatItem;
