import type { Message } from "@/lib/db";
import { cn, getRandomId } from "@/lib/utils";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createHighlighterCore } from "shiki/core";
import { createOnigurumaEngine } from "shiki/engine/oniguruma";
import rehypeShikiFromHighlighter from "@shikijs/rehype/core";
import CopyButton from "@/components/copy-button";

const highlighter = await createHighlighterCore({
  themes: [
    import("@shikijs/themes/github-light"),
    import("@shikijs/themes/github-dark"),
  ],
  langs: [import("@shikijs/langs/javascript")],
  engine: createOnigurumaEngine(() => import("shiki/wasm")),
});

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
        if (part.type === "text") {
          return (
            <div
              key={`${part.type}-${index}`}
              className="prose prose-neutral dark:prose-invert max-w-none prose-pre:scrollbar-thin
              prose-pre:whitespace-pre-wrap prose-pre:!p-0"
            >
              <Markdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[
                  [
                    rehypeShikiFromHighlighter,
                    highlighter,
                    {
                      themes: {
                        light: "github-light",
                        dark: "github-dark",
                      },
                    },
                  ],
                ]}
                components={{
                  code: ({ children }) => {
                    const id = getRandomId();

                    return (
                      <code className="relative block group rounded-md">
                        <CopyButton
                          id={id}
                          className="absolute right-0 top-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        />
                        <div id={id}>{children}</div>
                      </code>
                    );
                  },
                }}
              >
                {part.text}
              </Markdown>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
};

export default AssistantChatItem;
