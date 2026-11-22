"use client";

import { FileText, Globe, X } from "lucide-react";
import { useState } from "react";
import Markdown from "@/components/markdown";
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger,
} from "@/components/ui/attachment";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import type { ContextAttachmentData } from "@/lib/context-attachments";

const formatChars = (count: number) =>
  count >= 1000 ? `${(count / 1000).toFixed(1)}k chars` : `${count} chars`;

export const ContextAttachmentItem = ({
  attachment,
  onRemove,
  className,
}: {
  attachment: ContextAttachmentData;
  onRemove?: () => void;
  className?: string;
}) => {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const preview =
    attachment.content.length > 360
      ? `${attachment.content.slice(0, 360).trimEnd()}…`
      : attachment.content;

  const description = attachment.truncated
    ? `${formatChars(attachment.content.length)} / ${formatChars(attachment.originalChars)}`
    : formatChars(attachment.content.length);

  const body = (
    <div className="flex flex-col gap-3 overflow-y-auto pr-1">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="secondary">{attachment.method}</Badge>
        <span>{description}</span>
        {attachment.truncated && <Badge variant="outline">Truncated</Badge>}
        {attachment.sourceUrl && (
          <a
            href={attachment.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="truncate underline underline-offset-4 hover:text-foreground"
          >
            {attachment.sourceUrl}
          </a>
        )}
      </div>
      <div className="rounded-lg border bg-muted/30 p-3 text-sm">
        <Markdown>{attachment.content}</Markdown>
      </div>
    </div>
  );

  return (
    <>
      <HoverCard>
        <Attachment size="sm" className={className}>
          <HoverCardTrigger
            render={
              <AttachmentTrigger
                aria-label={`Preview ${attachment.title}`}
                onClick={() => setOpen(true)}
              />
            }
          />
          <AttachmentMedia>
            {attachment.kind === "webpage" ? <Globe /> : <FileText />}
          </AttachmentMedia>
          <AttachmentContent className="max-w-44">
            <AttachmentTitle>{attachment.title}</AttachmentTitle>
            <AttachmentDescription>{description}</AttachmentDescription>
          </AttachmentContent>
          {onRemove && (
            <AttachmentActions>
              <AttachmentAction
                type="button"
                aria-label={`Remove ${attachment.title}`}
                onClick={onRemove}
              >
                <X />
              </AttachmentAction>
            </AttachmentActions>
          )}
        </Attachment>
        <HoverCardContent className="w-80">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-xs font-medium">{attachment.title}</span>
              {attachment.truncated && <Badge variant="outline">Truncated</Badge>}
            </div>
            <p className="line-clamp-6 whitespace-pre-wrap text-xs text-muted-foreground">
              {preview}
            </p>
          </div>
        </HoverCardContent>
      </HoverCard>

      {isMobile ? (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" className="max-h-[85vh]">
            <SheetHeader>
              <SheetTitle className="truncate pr-6">{attachment.title}</SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-4 overflow-y-auto">{body}</div>
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="truncate pr-6">{attachment.title}</DialogTitle>
            </DialogHeader>
            {body}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};
