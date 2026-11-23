import type { ChatStatus, UIMessage } from "ai";
import { CircleAlertIcon, RefreshCcwIcon } from "lucide-react";
import { memo } from "react";
import AssistantChatItem from "@/components/assistant-chat-item";
import { Alert, AlertAction, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { MessageScrollerContent, MessageScrollerItem } from "@/components/ui/message-scroller";
import UserChatItem from "@/components/user-chat-item";
import { cn } from "@/lib/utils";

const ChatList = memo(
  ({
    messages,
    status,
    unansweredError,
    onRetry,
    onUseAsReference,
    className,
  }: {
    messages: UIMessage[];
    status: ChatStatus;
    /** Why the latest prompt has no response; shown with a Retry until it gets one. */
    unansweredError?: string | null;
    /** Retries the latest response; only offered on that response. */
    onRetry?: () => void;
    /** Offered on every image in the conversation while the selected model takes references. */
    onUseAsReference?: (image: Blob) => void;
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
                <UserChatItem message={message} onUseAsReference={onUseAsReference} />
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
                  onUseAsReference={onUseAsReference}
                />
              </MessageScrollerItem>
            );
          }

          return null;
        })}

        {unansweredError && (
          <MessageScrollerItem className="ani-slide-top">
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle className="font-normal">{unansweredError}</AlertTitle>
              {onRetry && (
                <AlertAction>
                  <Button variant="outline" size="xs" onClick={onRetry}>
                    <RefreshCcwIcon />
                    Retry
                  </Button>
                </AlertAction>
              )}
            </Alert>
          </MessageScrollerItem>
        )}

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
