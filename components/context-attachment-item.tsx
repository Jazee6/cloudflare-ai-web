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
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { useIsMobile } from "@/hooks/use-mobile";
import type { ContextAttachmentData } from "@/lib/context-attachments";

const formatChars = (count: number) =>
  count >= 1000 ? `${(count / 1000).toFixed(1)}k chars` : `${count} chars`;

const getSafeHttpUrl = (rawUrl: string | undefined): string | undefined => {
  if (!rawUrl) {
    return undefined;
  }
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed.toString()
      : undefined;
  } catch {
    return undefined;
  }
};

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

  const safeSourceUrl = getSafeHttpUrl(attachment.sourceUrl);

  const body = (
    <div className="flex flex-col gap-3 overflow-y-auto pr-1">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="secondary">{attachment.method}</Badge>
        <span>{description}</span>
        {attachment.truncated && <Badge variant="outline">Truncated</Badge>}
        {safeSourceUrl && (
          <a
            href={safeSourceUrl}
            target="_blank"
            rel="noreferrer"
            className="truncate underline underline-offset-4 hover:text-foreground"
          >
            {safeSourceUrl}
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
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent>
            <div className="flex max-h-[85dvh] flex-col gap-3">
              <DrawerHeader>
                <DrawerTitle className="truncate pr-6">{attachment.title}</DrawerTitle>
              </DrawerHeader>
              <div className="overflow-y-auto px-4 pb-6">{body}</div>
            </div>
          </DrawerContent>
        </Drawer>
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
