import { type ComponentProps, lazy, Suspense } from "react";

// Streamdown, KaTeX and the highlighter are large; keep them out of the home page's chunks.
const loadMarkdown = () => import("@/components/markdown-content");
const MarkdownContent = lazy(loadMarkdown);

/** Starts loading the renderer ahead of the first message that needs it. */
export const preloadMarkdown = () => {
  void loadMarkdown();
};

/** Renders model output; shows the raw text until the renderer has loaded. */
const Markdown = (props: ComponentProps<typeof MarkdownContent>) => (
  <Suspense fallback={<div className="whitespace-pre-wrap wrap-break-word">{props.children}</div>}>
    <MarkdownContent {...props} />
  </Suspense>
);

export default Markdown;
