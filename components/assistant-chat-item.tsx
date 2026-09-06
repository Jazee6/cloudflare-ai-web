import { Brain, Loader2 } from "lucide-react";
import Image from "next/image";
import { Fragment, type ComponentProps } from "react";
import { Streamdown } from "streamdown";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { ImagesDataPart, Message } from "@/lib/db";
import { cn } from "@/lib/utils";
import ToolCall from "@/components/tool-call";
import type { ChatStatus, ToolUIPart } from "ai";
import { cjk } from "@streamdown/cjk";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import "streamdown/styles.css";
import ZoomableImage from "@/components/zoomable-image";

const MarkdownImage = (imageProps: ComponentProps<"img"> & { node?: unknown }) => {
  const { className } = imageProps;
  const props = { ...imageProps };
  delete props.className;
  delete props.node;

  return (
    <ZoomableImage>
      <img {...props} className={cn("h-auto max-w-full rounded-md", className)} />
    </ZoomableImage>
  );
};

const streamdownComponents = { img: MarkdownImage };

const AssistantChatItem = ({
  className,
  parts,
  status,
  isLastMessage,
}: {
  className?: string;
  parts: Message["parts"];
  status: ChatStatus;
  isLastMessage?: boolean;
}) => {
  return (
    <div className={cn("", className)}>
      {parts.map((part, index) => {
        const key = `${part.type}-${index}`;

        if (part.type === "text") {
          return (
            <Streamdown
              key={key}
              // caret="circle"
              animated={{ animation: "blurIn" }}
              isAnimating={status === "streaming" && isLastMessage}
              plugins={{ cjk, code, math }}
              components={streamdownComponents}
              linkSafety={{ enabled: false }}
            >
              {part.text}
            </Streamdown>
          );
        }

        if (part.type === "reasoning") {
          return (
            <Accordion key={key}>
              <AccordionItem value={key}>
                <AccordionTrigger>
                  <div className="flex items-center">
                    <Brain className="size-4 mr-2" />
                    Reasoning
                    {part.state === "streaming" && <Loader2 className="size-4 ml-2 animate-spin" />}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <Streamdown
                    caret="circle"
                    components={streamdownComponents}
                    isAnimating={status === "streaming" && isLastMessage}
                  >
                    {part.text}
                  </Streamdown>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          );
        }

        if (part.type === "data-images") {
          return (
            <Fragment key={key}>
              {(part.data as ImagesDataPart).urls?.map((url, index) => {
                const key = `image-${index}`;

                return (
                  <ZoomableImage key={key}>
                    <Image
                      src={url}
                      alt={key}
                      width={512}
                      height={512}
                      className="rounded-md hover:brightness-75 transition-all"
                    />
                  </ZoomableImage>
                );
              })}
            </Fragment>
          );
        }

        if (part.type.startsWith("tool-")) {
          return <ToolCall key={key} part={part as ToolUIPart} />;
        }

        return null;
      })}
    </div>
  );
};

export default AssistantChatItem;
