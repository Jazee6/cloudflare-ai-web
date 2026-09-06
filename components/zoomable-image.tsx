"use client";

import type { ReactNode } from "react";
import Zoom from "react-medium-image-zoom";
import { cn } from "@/lib/utils";

const ZoomableImage = ({ children, className }: { children: ReactNode; className?: string }) => {
  return (
    <span className={cn("block w-fit max-w-full", className)}>
      <Zoom wrapElement="span" zoomMargin={16}>
        {children}
      </Zoom>
    </span>
  );
};

export default ZoomableImage;
