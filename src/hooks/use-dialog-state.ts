import { useState } from "react";

/**
 * Open state for a dialog that shows `data`. The data outlives closing, so the dialog keeps its
 * content while it animates out.
 */
export const useDialogState = <T>() => {
  const [state, setState] = useState<{ open: boolean; data: T | null }>({
    open: false,
    data: null,
  });

  return {
    open: state.open,
    data: state.data,
    show: (data: T) => setState({ open: true, data }),
    close: () => setState((current) => ({ ...current, open: false })),
    onOpenChange: (open: boolean) => {
      if (!open) {
        setState((current) => ({ ...current, open: false }));
      }
    },
  };
};
