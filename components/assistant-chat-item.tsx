import { Message } from "@/lib/db";
import { cn } from "@/lib/utils";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
            <div key={`${part.type}-${index}`} className="prose prose-neutral">
              <Markdown remarkPlugins={[remarkGfm]}>{part.text}</Markdown>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
};

export default AssistantChatItem;
