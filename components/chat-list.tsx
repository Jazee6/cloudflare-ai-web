import type { Message } from "@/lib/db";
import { cn } from "@/lib/utils";
import UserChatItem from "@/components/user-chat-item";
import AssistantChatItem from "@/components/assistant-chat-item";
import { TextShimmer } from "@/components/ui/text-shimmer";
import type { ChatStatus } from "ai";
import { memo } from "react";

const ChatList = memo(
  ({
    messages,
    status,
    className,
  }: {
    messages: Message[];
    status: ChatStatus;
    className?: string;
  }) => {
    return (
      <ul className={cn("flex flex-col w-full space-y-1", className)}>
        {messages.map((message) => {
          if (message.role === "user") {
            return (
              <li
                key={message.id}
                className="self-end max-w-[90%] ani-slide-top"
              >
                <UserChatItem parts={message.parts} />
              </li>
            );
          }

          if (message.role === "assistant") {
            return (
              <li key={message.id} className="ani-slide-top">
                <AssistantChatItem parts={message.parts} status={status} />
              </li>
            );
          }

          return null;
        })}

        {status === "submitted" && (
          <li className="w-fit ani-slide-top">
            <TextShimmer duration={1}>Generating...</TextShimmer>
          </li>
        )}
      </ul>
    );
  },
);

export default ChatList;
