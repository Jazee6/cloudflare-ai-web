import { Brain, Loader2 } from "lucide-react";
import Image from "next/image";
import { Fragment } from "react";
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
import type { ToolUIPart } from "ai";

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
        const key = `${part.type}-${index}`;

        if (part.type === "text") {
          return <Streamdown key={key}>{part.text}</Streamdown>;
        }

        if (part.type === "reasoning") {
          return (
            <Accordion key={key} type="single" collapsible>
              <AccordionItem value={key}>
                <AccordionTrigger>
                  <div className="flex items-center">
                    <Brain className="size-4 mr-2" />
                    Reasoning
                    {part.state === "streaming" && (
                      <Loader2 className="size-4 ml-2 animate-spin" />
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <Streamdown>{part.text}</Streamdown>
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
                  <Image
                    src={url}
                    alt={key}
                    key={key}
                    width={512}
                    height={512}
                    className="rounded-md hover:brightness-75 transition-all"
                  />
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
