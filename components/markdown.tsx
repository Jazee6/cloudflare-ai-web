"use client";

import { cjk } from "@streamdown/cjk";
import { math } from "@streamdown/math";
import type { ComponentProps } from "react";
import { type ExtraProps, Streamdown, useIsCodeFenceIncomplete } from "streamdown";
import "streamdown/styles.css";
import ZoomableImage from "@/components/zoomable-image";
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockLine,
  CodeBlockTitle,
} from "@/components/ui/code-block";
import { useHighlightedCode } from "@/hooks/use-highlighted-code";
import { cn } from "@/lib/utils";

const MarkdownImage = (imageProps: ComponentProps<"img"> & ExtraProps) => {
  const { className, node: _node, ...props } = imageProps;

  return (
    <ZoomableImage>
      <img {...props} className={cn("h-auto max-w-full rounded-md", className)} />
    </ZoomableImage>
  );
};

const MarkdownCodeBlock = ({ code, language }: { code: string; language: string }) => {
  // True while the closing fence has not arrived yet.
  const incomplete = useIsCodeFenceIncomplete();
  const lines = useHighlightedCode(code, language);

  return (
    <CodeBlock>
      <CodeBlockHeader>
        <CodeBlockTitle>{language || "text"}</CodeBlockTitle>
        <CodeBlockActions>
          <CodeBlockCopyButton value={code} disabled={incomplete} />
        </CodeBlockActions>
      </CodeBlockHeader>
      <CodeBlockContent>
        {lines.map((line, index) => (
          <CodeBlockLine key={index}>{line}</CodeBlockLine>
        ))}
      </CodeBlockContent>
    </CodeBlock>
  );
};

const MarkdownCode = ({
  node: _node,
  className,
  children,
  ...props
}: ComponentProps<"code"> & ExtraProps) => {
  // Streamdown marks fenced code with data-block. Everything else is inline.
  if (!("data-block" in props)) {
    return (
      <code className="rounded-sm bg-muted px-1 py-0.5 font-mono text-[0.9em]" {...props}>
        {children}
      </code>
    );
  }

  return (
    <MarkdownCodeBlock
      code={typeof children === "string" ? children : ""}
      language={/language-(\S+)/.exec(className ?? "")?.[1] ?? ""}
    />
  );
};

const plugins = { cjk, math };
const components = { img: MarkdownImage, code: MarkdownCode };

/** Renders model output; `isAnimating` must be set while it streams so open code fences are detected. */
const Markdown = ({ children, isAnimating }: { children: string; isAnimating?: boolean }) => (
  <Streamdown
    animated={{ animation: "blurIn" }}
    isAnimating={isAnimating}
    plugins={plugins}
    components={components}
    linkSafety={{ enabled: false }}
  >
    {children}
  </Streamdown>
);

export default Markdown;
