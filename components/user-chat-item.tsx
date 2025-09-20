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
    <div className={cn("bg-secondary px-2 py-1 rounded-md", className)}>
      {parts.map((part) => {
        if (part.type === "text") {
          return part.text;
        }

        return null;
      })}
    </div>
  );
};

export default UserChatItem;
