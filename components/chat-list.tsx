import type { Message } from "@/lib/db";
import { cn } from "@/lib/utils";
import UserChatItem from "@/components/user-chat-item";
import AssistantChatItem from "@/components/assistant-chat-item";

const ChatList = ({
  messages,
  className,
}: {
  messages: Message[];
  className?: string;
}) => {
  return (
    <ul
      className={cn(
        "flex flex-col w-full max-w-3xl mx-auto space-y-1",
        className,
      )}
    >
      {messages.map((message) => {
        if (message.role === "user") {
          return (
            <li key={message.id} className="self-end max-w-[90%]">
              <UserChatItem parts={message.parts} />
            </li>
          );
        }

        if (message.role === "assistant") {
          return (
            <li key={message.id} className="">
              <AssistantChatItem parts={message.parts} />
            </li>
          );
        }

        return null;
      })}
    </ul>
  );
};

export default ChatList;
