"use client";

import { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const LoadingIndicator = ({ className }: { className?: string }) => {
  const { pending } = useLinkStatus();

  if (pending) {
    return <Loader2 className={cn("animate-spin", className)} />;
  }
};

export default LoadingIndicator;
