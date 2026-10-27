import type { ChatStatus, UIMessage } from "ai";
import { memo } from "react";
import AssistantChatItem from "@/components/assistant-chat-item";
import { MessageScrollerContent, MessageScrollerItem } from "@/components/ui/message-scroller";
import UserChatItem from "@/components/user-chat-item";
import { cn } from "@/lib/utils";

const ChatList = memo(
  ({
    messages,
    status,
    onRetry,
    className,
  }: {
    messages: UIMessage[];
    status: ChatStatus;
    /** Retries the latest response; only offered on that response. */
    onRetry?: () => void;
    className?: string;
  }) => {
    const busy = status === "submitted" || status === "streaming";

    return (
      <MessageScrollerContent aria-busy={busy} className={cn("gap-4", className)}>
        {messages.map((message, index) => {
          const isLastMessage = index === messages.length - 1;

          if (message.role === "user") {
            return (
              <MessageScrollerItem
                key={message.id}
                messageId={message.id}
                scrollAnchor
                className="ani-slide-top"
              >
                <UserChatItem parts={message.parts} />
              </MessageScrollerItem>
            );
          }

          if (message.role === "assistant") {
            return (
              <MessageScrollerItem
                key={message.id}
                messageId={message.id}
                className="ani-slide-top"
              >
                <AssistantChatItem
                  message={message}
                  streaming={busy && isLastMessage}
                  onRetry={isLastMessage && !busy ? onRetry : undefined}
                />
              </MessageScrollerItem>
            );
          }

          return null;
        })}

        {status === "submitted" && (
          <MessageScrollerItem className="ani-slide-top">
            <span className="shimmer text-sm text-muted-foreground">Generating...</span>
          </MessageScrollerItem>
        )}
      </MessageScrollerContent>
    );
  },
);

export default ChatList;
