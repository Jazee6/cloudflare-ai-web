"use client";

import { isReasoningUIPart, isToolUIPart, type UIMessage } from "ai";
import { BrainIcon, CheckIcon, CopyIcon, RefreshCcwIcon } from "lucide-react";
import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";
import Markdown from "@/components/markdown";
import ToolCall from "@/components/tool-call";
import { Button } from "@/components/ui/button";
import { Message, MessageContent, MessageFooter } from "@/components/ui/message";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceDescription,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace";
import ZoomableImage from "@/components/zoomable-image";
import type { ImageUrlsData } from "@/lib/db";
import { getResponseMetadata } from "@/lib/response-metadata";

/** Starts as a plain line and opens while the model thinks; the reader's own toggle wins. */
const Reasoning = ({
  text,
  running,
  seconds,
}: {
  text: string;
  running: boolean;
  seconds?: number | null;
}) => {
  const [open, setOpen] = useState<boolean>();
  const line = (
    <TraceLine status={running ? "running" : undefined}>
      <TraceIcon>{running ? <Spinner /> : <BrainIcon />}</TraceIcon>
      <TraceTitle>{running ? "Thinking" : "Thought"}</TraceTitle>
      {!running && typeof seconds === "number" && (
        <TraceDescription>for {seconds}s</TraceDescription>
      )}
    </TraceLine>
  );

  if (text.length === 0) {
    return line;
  }

  return (
    <TraceCollapsible open={open ?? running} onOpenChange={setOpen}>
      <TraceCollapsibleTrigger>{line}</TraceCollapsibleTrigger>
      <TraceCollapsibleContent>
        <Markdown isAnimating={running}>{text}</Markdown>
      </TraceCollapsibleContent>
    </TraceCollapsible>
  );
};

const ActionButton = ({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) => (
  <Tooltip>
    <TooltipTrigger
      render={<Button variant="ghost" size="icon-sm" aria-label={label} onClick={onClick} />}
    >
      {children}
    </TooltipTrigger>
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>
);

const CopyAction = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timeout = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timeout);
  }, [copied]);

  return (
    <ActionButton
      label={copied ? "Copied" : "Copy"}
      onClick={() => {
        navigator.clipboard
          .writeText(text)
          .then(() => setCopied(true))
          .catch(() => {});
      }}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </ActionButton>
  );
};

type Part = UIMessage["parts"][number];

/** Consecutive reasoning and tool parts share one Trace; everything else renders on its own. */
const groupParts = (parts: UIMessage["parts"]) => {
  const groups: { trace: boolean; parts: { part: Part; index: number }[] }[] = [];
  parts.forEach((part, index) => {
    const trace = isReasoningUIPart(part) || isToolUIPart(part);
    const last = groups.at(-1);
    if (trace && last?.trace) {
      last.parts.push({ part, index });
    } else {
      groups.push({ trace, parts: [{ part, index }] });
    }
  });
  return groups;
};

const AssistantChatItem = ({
  message,
  streaming,
  onRetry,
}: {
  message: UIMessage;
  /** Only the live response streams; a stopped one keeps its parts' "streaming" state. */
  streaming: boolean;
  onRetry?: () => void;
}) => {
  const metadata = getResponseMetadata(message);
  const reasoningIndexes = new Map<Part, number>();
  for (const part of message.parts.filter(isReasoningUIPart)) {
    reasoningIndexes.set(part, reasoningIndexes.size);
  }
  const text = message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n\n");

  const renderPart = (part: Part, index: number) => {
    const key = `${part.type}-${index}`;

    if (part.type === "text") {
      return (
        <Markdown key={key} isAnimating={streaming}>
          {part.text}
        </Markdown>
      );
    }

    if (isReasoningUIPart(part)) {
      return (
        <Reasoning
          key={key}
          text={part.text}
          running={streaming && part.state === "streaming"}
          seconds={metadata?.reasoningSeconds?.[reasoningIndexes.get(part) ?? -1]}
        />
      );
    }

    if (isToolUIPart(part)) {
      return <ToolCall key={key} part={part} streaming={streaming} />;
    }

    if (part.type === "data-images") {
      return (part.data as ImageUrlsData).urls.map((url, imageIndex) => (
        <ZoomableImage key={`${key}-${imageIndex}`}>
          <Image
            src={url}
            alt={`image-${imageIndex}`}
            width={512}
            height={512}
            className="rounded-md hover:brightness-75 transition-all"
          />
        </ZoomableImage>
      ));
    }

    return null;
  };

  return (
    <Message>
      <MessageContent>
        {groupParts(message.parts).map((group) =>
          group.trace ? (
            <Trace key={`trace-${group.parts[0].index}`}>
              {group.parts.map(({ part, index }) => renderPart(part, index))}
            </Trace>
          ) : (
            group.parts.map(({ part, index }) => renderPart(part, index))
          ),
        )}

        {!streaming && (text || onRetry) && (
          <MessageFooter className="px-0">
            {text && <CopyAction text={text} />}
            {onRetry && (
              <ActionButton label="Retry" onClick={onRetry}>
                <RefreshCcwIcon />
              </ActionButton>
            )}
          </MessageFooter>
        )}
      </MessageContent>
    </Message>
  );
};

export default AssistantChatItem;
