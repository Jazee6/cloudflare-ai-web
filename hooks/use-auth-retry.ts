import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "@/components/ui/toast";

export interface AuthDialogState {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAuthenticated: () => void;
}

/**
 * Handles an Access Session rejection: the first 401 opens the password dialog and
 * retries once after authentication; a second consecutive 401 is reported instead.
 */
export const useAuthRetry = (retry: () => unknown) => {
  const [open, setOpen] = useState(false);
  const retriedRef = useRef(false);
  const retryRef = useRef(retry);

  useEffect(() => {
    retryRef.current = retry;
  });

  /** Clears the retry budget after a fresh user action or a successful request. */
  const resetAuthRetry = useCallback(() => {
    retriedRef.current = false;
  }, []);

  const handleUnauthorized = useCallback(() => {
    if (retriedRef.current) {
      retriedRef.current = false;
      toast.add({ title: "Authentication failed. Please try again.", type: "error" });
      return;
    }
    setOpen(true);
  }, []);

  const onAuthenticated = useCallback(() => {
    setOpen(false);
    retriedRef.current = true;
    void retryRef.current();
  }, []);

  const authDialog: AuthDialogState = { open, onOpenChange: setOpen, onAuthenticated };

  return { authDialog, handleUnauthorized, resetAuthRetry };
};
