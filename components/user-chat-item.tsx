import type { Message } from "@/lib/db";
import { cn } from "@/lib/utils";

const UserChatItem = ({
  className,
  parts,
}: {
  className?: string;
  parts: Message["parts"];
}) => {
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
              // biome-ignore lint/performance/noImgElement: <data_url>
              <img
                key={`${part.type}-${index}`}
                src={part.url}
                alt={part.filename}
                className="hover:brightness-75 transition-all rounded-md object-cover size-full max-w-[50%] self-end"
              />
            );
          }
        }

        return null;
      })}
    </div>
  );
};

export default UserChatItem;
