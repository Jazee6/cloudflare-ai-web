import { type DynamicToolUIPart, getToolName, type ToolUIPart } from "ai";
import { WrenchIcon } from "lucide-react";
import {
  CodeBlock,
  CodeBlockContent,
  CodeBlockHeader,
  CodeBlockTitle,
} from "@/components/ui/code-block";
import {
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace";

const ToolJson = ({ title, value }: { title: string; value: unknown }) => (
  <CodeBlock size="sm">
    <CodeBlockHeader>
      <CodeBlockTitle>{title}</CodeBlockTitle>
    </CodeBlockHeader>
    <CodeBlockContent wrap className="max-h-64">
      {JSON.stringify(value, null, 2)}
    </CodeBlockContent>
  </CodeBlock>
);

const ToolLine = ({ title, status }: { title: string; status?: "running" | "error" }) => (
  <TraceLine status={status}>
    <TraceIcon>
      <WrenchIcon />
    </TraceIcon>
    <TraceTitle>{title}</TraceTitle>
  </TraceLine>
);

/** A tool is a plain line while it runs, and opens to its input and output once it settles. */
const ToolCall = ({
  part,
  streaming,
}: {
  part: ToolUIPart | DynamicToolUIPart;
  streaming: boolean;
}) => {
  const name = getToolName(part);

  if (part.state === "output-denied") {
    return <ToolLine title={`Denied ${name}`} />;
  }

  if (part.state === "output-available" || part.state === "output-error") {
    const failed = part.state === "output-error";
    return (
      <TraceCollapsible>
        <TraceCollapsibleTrigger>
          <ToolLine
            title={`${failed ? "Failed to run" : "Ran"} ${name}`}
            status={failed ? "error" : undefined}
          />
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent className="flex flex-col gap-2">
          {part.input !== undefined && <ToolJson title="Input" value={part.input} />}
          {failed ? (
            <CodeBlock size="sm" variant="destructive">
              <CodeBlockContent wrap className="max-h-64">
                {part.errorText}
              </CodeBlockContent>
            </CodeBlock>
          ) : (
            <ToolJson title="Output" value={part.output} />
          )}
        </TraceCollapsibleContent>
      </TraceCollapsible>
    );
  }

  // A tool still waiting for output after the response ended never finished.
  return (
    <ToolLine
      title={`${streaming ? "Running" : "Failed to run"} ${name}`}
      status={streaming ? "running" : "error"}
    />
  );
};

export default ToolCall;
