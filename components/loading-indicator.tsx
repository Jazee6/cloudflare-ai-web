"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLinkStatus } from "next/dist/client/app-dir/link";

const LoadingIndicator = ({ className }: { className?: string }) => {
  const { pending } = useLinkStatus();

  if (pending) {
    return <Loader2 className={cn("animate-spin", className)} />;
  }
};

export default LoadingIndicator;
