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
  langs: [
    import("@shikijs/langs/html"),
    import("@shikijs/langs/css"),
    import("@shikijs/langs/javascript"),
    import("@shikijs/langs/typescript"),
    import("@shikijs/langs/jsx"),
    import("@shikijs/langs/tsx"),
    import("@shikijs/langs/json"),

    import("@shikijs/langs/python"),
    import("@shikijs/langs/java"),
    import("@shikijs/langs/kotlin"),
    import("@shikijs/langs/c"),
    import("@shikijs/langs/cpp"),
    import("@shikijs/langs/rust"),
    import("@shikijs/langs/go"),
    import("@shikijs/langs/swift"),
    import("@shikijs/langs/dart"),

    import("@shikijs/langs/markdown"),
    import("@shikijs/langs/bash"),
    import("@shikijs/langs/makefile"),
    import("@shikijs/langs/dockerfile"),
    import("@shikijs/langs/yaml"),
    import("@shikijs/langs/dotenv"),
    import("@shikijs/langs/latex"),
    import("@shikijs/langs/sql"),
  ],
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
