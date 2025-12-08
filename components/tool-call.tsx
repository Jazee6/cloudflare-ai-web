import type { ToolUIPart } from "ai";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertCircleIcon,
  CheckCircleIcon,
  CircleIcon,
  ClockIcon,
  Loader2,
  Wrench,
  XCircleIcon,
} from "lucide-react";
import { Streamdown } from "streamdown";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

const ToolCall = ({ part }: { part: ToolUIPart }) => {
  return (
    <Accordion type="single" collapsible>
      <AccordionItem value={part.toolCallId}>
        <AccordionTrigger>
          <div className="flex items-center w-full">
            <Wrench className="size-4 mr-2" />
            {part.type.split("-").slice(1).join(" ")}

            {part.state !== "output-available" &&
              part.state !== "output-error" && (
                <Loader2 className="size-4 ml-2 animate-spin" />
              )}

            {part.state === "input-streaming" && (
              <Badge variant="outline" className="ml-auto">
                <CircleIcon className="size-4" />
                Pending
              </Badge>
            )}

            {part.state === "input-streaming" && (
              <Badge variant="outline" className="ml-auto">
                <ClockIcon className="size-4" />
                Running
              </Badge>
            )}

            {part.state === "output-available" && (
              <Badge variant="outline" className="ml-auto">
                <CheckCircleIcon className="size-4 text-green-600" />
                Completed
              </Badge>
            )}

            {part.state === "output-error" && (
              <Badge variant="outline" className="ml-auto">
                <XCircleIcon className="size-4 text-destructive" />
                Error
              </Badge>
            )}
          </div>
        </AccordionTrigger>
        <AccordionContent>
          {part.input ? (
            <div>
              <h3 className="font-semibold font-mono">Input</h3>
              <Streamdown mode="static" className="-my-2">
                {`\`\`\`json\n${JSON.stringify(part.input, null, 2)}\n\`\`\``}
              </Streamdown>
            </div>
          ) : null}

          {part.output ? (
            <div>
              <h3 className="font-semibold font-mono">Output</h3>
              <Streamdown mode="static" className="-my-2">
                {`\`\`\`json\n${JSON.stringify(part.output, null, 2)}\n\`\`\``}
              </Streamdown>
            </div>
          ) : null}

          {part.state === "output-error" && (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{part.errorText}</AlertDescription>
            </Alert>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};

export default ToolCall;
