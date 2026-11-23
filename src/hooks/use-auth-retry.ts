import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "@/components/ui/toast";
import { translateNow } from "@/lib/i18n";

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
  const pendingActionRef = useRef<(() => unknown) | null>(null);

  useEffect(() => {
    retryRef.current = retry;
  });

  /** Clears the retry budget after a fresh user action or a successful request. */
  const resetAuthRetry = useCallback(() => {
    retriedRef.current = false;
  }, []);

  const handleUnauthorized = useCallback((onSuccess?: () => unknown) => {
    if (onSuccess) {
      pendingActionRef.current = onSuccess;
      setOpen(true);
      return;
    }

    pendingActionRef.current = null;
    if (retriedRef.current) {
      retriedRef.current = false;
      toast.add({ title: translateNow("auth.failed"), type: "error" });
      return;
    }
    setOpen(true);
  }, []);

  const onOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen) {
      pendingActionRef.current = null;
    }
    setOpen(nextOpen);
  }, []);

  const onAuthenticated = useCallback(() => {
    setOpen(false);
    const pendingAction = pendingActionRef.current;
    pendingActionRef.current = null;
    if (pendingAction) {
      void pendingAction();
      return;
    }
    retriedRef.current = true;
    void retryRef.current();
  }, []);

  const authDialog: AuthDialogState = { open, onOpenChange, onAuthenticated };

  return { authDialog, handleUnauthorized, resetAuthRetry };
};
