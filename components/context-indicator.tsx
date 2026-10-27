"use client";

import type { UIMessage } from "ai";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { InputGroupButton } from "@/components/ui/input-group";
import { Progress } from "@/components/ui/progress";
import { buildModelContext } from "@/lib/model-context";
import { getResponseMetadata } from "@/lib/response-metadata";

const formatTokens = (value: number) =>
  value < 1000 ? String(value) : `${(value / 1000).toFixed(1).replace(/\.0$/, "")}k`;

/**
 * Shows the Context Usage reported for the latest response and how much of the loaded
 * Conversation History the next Model Context includes.
 */
const ContextIndicator = ({ messages }: { messages: UIMessage[] }) => {
  if (messages.length === 0) {
    return null;
  }

  const included = buildModelContext(messages)?.length ?? 0;
  // A streaming response has no usage yet, so keep showing the last one that reported it.
  const metadata = messages
    .filter((message) => message.role === "assistant")
    .map(getResponseMetadata)
    .findLast((candidate) => candidate?.usage);
  const usage =
    metadata?.usage && metadata.contextWindow
      ? {
          ...metadata.usage,
          used: metadata.usage.inputTokens + metadata.usage.outputTokens,
          limit: metadata.contextWindow,
        }
      : undefined;
  const percent = usage ? Math.min(100, Math.round((usage.used / usage.limit) * 100)) : undefined;

  return (
    <HoverCard>
      <HoverCardTrigger
        delay={10}
        closeDelay={100}
        render={
          <InputGroupButton
            size="sm"
            variant="ghost"
            className="text-primary hover:text-primary aria-expanded:text-primary"
          />
        }
      >
        {percent === undefined ? `${included}/${messages.length} msgs` : `${percent}% context`}
      </HoverCardTrigger>
      <HoverCardContent className="flex w-64 flex-col gap-3">
        {usage && percent !== undefined && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium">Context</span>
              <span className="text-muted-foreground">
                {formatTokens(usage.used)} / {formatTokens(usage.limit)}
              </span>
            </div>
            <Progress value={percent} aria-label="Context used" />
            <div className="flex flex-col gap-1 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Input</span>
                <span>{formatTokens(usage.inputTokens)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Output</span>
                <span>{formatTokens(usage.outputTokens)}</span>
              </div>
            </div>
          </div>
        )}
        <div className="flex justify-between gap-3 text-sm">
          <span className="text-muted-foreground">Messages included</span>
          <span>
            {included} / {messages.length}
          </span>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};

export default ContextIndicator;
