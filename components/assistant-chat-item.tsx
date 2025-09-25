import type { Message } from "@/lib/db";
import { cn } from "@/lib/utils";
import { Streamdown } from "streamdown";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Brain, Loader2 } from "lucide-react";

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

        return null;
      })}
    </div>
  );
};

export default AssistantChatItem;
