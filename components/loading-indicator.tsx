"use client";

import { useLinkStatus } from "next/link";
import { Spinner } from "@/components/ui/spinner";

const LoadingIndicator = ({ className }: { className?: string }) => {
  const { pending } = useLinkStatus();

  if (pending) {
    return <Spinner className={className} />;
  }
};

export default LoadingIndicator;
