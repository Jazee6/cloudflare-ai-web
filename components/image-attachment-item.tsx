"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import ZoomableImage from "@/components/zoomable-image";

export const ImageAttachmentItem = ({
  src,
  alt,
  onRemove,
}: {
  src: string;
  alt: string;
  onRemove?: () => void;
}) => (
  <div className="group/image-attachment relative size-16 shrink-0">
    <ZoomableImage className="size-full overflow-hidden rounded-lg border bg-muted">
      <img
        src={src}
        alt={alt}
        className="size-16 cursor-zoom-in object-cover transition-all hover:brightness-90"
      />
    </ZoomableImage>
    {onRemove && (
      <Button
        type="button"
        variant="secondary"
        size="icon-xs"
        className="absolute top-1 right-1 size-5 rounded-full shadow-sm"
        aria-label={`Remove ${alt}`}
        onClick={onRemove}
      >
        <X />
      </Button>
    )}
  </div>
);
