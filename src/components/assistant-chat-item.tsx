import { isReasoningUIPart, isToolUIPart, type UIMessage } from "ai";
import {
  BookOpenIcon,
  BrainIcon,
  CheckIcon,
  ChevronRightIcon,
  CopyIcon,
  ImagePlusIcon,
  RefreshCcwIcon,
  SquareIcon,
  Volume2Icon,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import Markdown from "@/components/markdown";
import ToolCall from "@/components/tool-call";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
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
import { useSpeechSynthesis } from "@/hooks/use-speech-synthesis";
import type { ImageUrlsData } from "@/lib/db";
import { getImageEntryMetadata } from "@/lib/image-models";
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
  onUseAsReference,
}: {
  message: UIMessage;
  /** Only the live response streams; a stopped one keeps its parts' "streaming" state. */
  streaming: boolean;
  onRetry?: () => void;
  onUseAsReference?: (url: string) => void;
}) => {
  const metadata = getResponseMetadata(message);
  const imageMeta = getImageEntryMetadata(message);
  const {
    supported: ttsSupported,
    activeId: activeSpeechId,
    speak,
    stop: stopSpeech,
  } = useSpeechSynthesis();
  const isSpeaking = activeSpeechId === message.id;

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
          <img
            src={url}
            alt={`image-${imageIndex}`}
            width={512}
            height={512}
            className="rounded-md transition-all hover:brightness-75"
          />
        </ZoomableImage>
      ));
    }

    return null;
  };

  const gatewayCacheHit = metadata?.gateway?.cacheStatus === "HIT";
  const gatewayDlpAction = metadata?.gateway?.dlpAction;
  const citations = metadata?.citations ?? [];
  const imageSeed = imageMeta?.params?.seed;
  const referenceUrls = onUseAsReference
    ? message.parts.flatMap((part) =>
        part.type === "data-images" ? (part.data as ImageUrlsData).urls : [],
      )
    : [];
  const showFooter =
    !streaming &&
    Boolean(
      text ||
      onRetry ||
      referenceUrls.length > 0 ||
      gatewayCacheHit ||
      gatewayDlpAction ||
      imageMeta?.modelName ||
      imageSeed !== undefined,
    );

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

        {!streaming && citations.length > 0 && (
          <Collapsible className="group/sources flex flex-col gap-2">
            <CollapsibleTrigger
              render={
                <button
                  type="button"
                  className="inline-flex w-fit items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                />
              }
            >
              <BookOpenIcon className="size-3.5" />
              <span>Sources ({citations.length})</span>
              <ChevronRightIcon className="size-3.5 transition-transform group-data-[open]/sources:rotate-90" />
            </CollapsibleTrigger>
            <CollapsibleContent className="flex flex-wrap gap-1.5">
              {citations.map((citation) => (
                <HoverCard key={citation.id}>
                  <HoverCardTrigger
                    render={
                      <button type="button" className="inline-flex items-center">
                        <Badge variant="secondary" className="max-w-64 gap-1.5">
                          <span className="truncate">{citation.source}</span>
                          {typeof citation.score === "number" && (
                            <span className="text-muted-foreground tabular-nums">
                              {Math.round(citation.score * 100)}%
                            </span>
                          )}
                        </Badge>
                      </button>
                    }
                  />
                  <HoverCardContent className="w-80">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-medium">{citation.source}</span>
                        {typeof citation.score === "number" && (
                          <Badge variant="outline" className="tabular-nums">
                            {Math.round(citation.score * 100)}%
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{citation.excerpt}</p>
                    </div>
                  </HoverCardContent>
                </HoverCard>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}

        {showFooter && (
          <MessageFooter className="px-0">
            {text && <CopyAction text={text} />}
            {text && ttsSupported && (
              <ActionButton
                label={isSpeaking ? "Stop" : "Read aloud"}
                onClick={() => {
                  if (isSpeaking) {
                    stopSpeech();
                  } else {
                    speak(message.id, text);
                  }
                }}
              >
                {isSpeaking ? <SquareIcon /> : <Volume2Icon />}
              </ActionButton>
            )}
            {onRetry && (
              <ActionButton label="Retry" onClick={onRetry}>
                <RefreshCcwIcon />
              </ActionButton>
            )}
            {referenceUrls.map((url, index) => (
              <ActionButton
                key={url}
                label={
                  referenceUrls.length > 1
                    ? `Use image ${index + 1} as reference`
                    : "Use as reference"
                }
                onClick={() => onUseAsReference?.(url)}
              >
                <ImagePlusIcon />
              </ActionButton>
            ))}
            {imageMeta?.modelName && <Badge variant="secondary">{imageMeta.modelName}</Badge>}
            {imageSeed !== undefined && (
              <Badge variant="outline" className="tabular-nums">
                Seed {imageSeed}
              </Badge>
            )}
            {gatewayCacheHit && (
              <Tooltip>
                <TooltipTrigger render={<Badge variant="secondary">Cached</Badge>} />
                <TooltipContent>
                  Served from Cloudflare AI Gateway cache. Retry to bypass cache.
                </TooltipContent>
              </Tooltip>
            )}
            {gatewayDlpAction && (
              <Tooltip>
                <TooltipTrigger render={<Badge variant="outline">DLP: {gatewayDlpAction}</Badge>} />
                <TooltipContent>Cloudflare AI Gateway DLP policy applied.</TooltipContent>
              </Tooltip>
            )}
          </MessageFooter>
        )}
      </MessageContent>
    </Message>
  );
};

export default AssistantChatItem;
