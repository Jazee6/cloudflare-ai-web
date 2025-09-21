import type { Message } from "@/lib/db";
import { cn } from "@/lib/utils";
import { Streamdown } from "streamdown";

const AssistantChatItem = ({
  className,
  parts,
}: {
  className?: string;
  parts: Message["parts"];
}) => {
  return (
    <div className={cn("", className)}>
      {parts.map((part, index) => {
        if (part.type === "text") {
          return (
            <Streamdown key={`${part.type}-${index}`}>{part.text}</Streamdown>
          );
        }

        return null;
      })}
    </div>
  );
};

export default AssistantChatItem;
