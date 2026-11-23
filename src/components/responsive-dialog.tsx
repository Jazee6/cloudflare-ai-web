import type { FormEvent, ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";

/** A form in a Dialog on desktop and a Drawer on mobile. */
export const ResponsiveFormDialog = ({
  open,
  onOpenChange,
  title,
  description,
  onSubmit,
  footer,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  onSubmit: () => void;
  footer: ReactNode;
  children: ReactNode;
}) => {
  const isMobile = useIsMobile();
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onSubmit();
  };

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <form onSubmit={handleSubmit} noValidate className="flex max-h-[85dvh] flex-col gap-4">
            <DrawerHeader>
              <DrawerTitle>{title}</DrawerTitle>
              {description && <DrawerDescription>{description}</DrawerDescription>}
            </DrawerHeader>
            <div className="-my-1 min-h-0 overflow-x-hidden overflow-y-auto px-4 py-1">
              {children}
            </div>
            <DrawerFooter className="flex-row justify-end">{footer}</DrawerFooter>
          </form>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} noValidate className="flex max-h-[80dvh] flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          <div className="-m-1 min-h-0 overflow-x-hidden overflow-y-auto p-1">{children}</div>
          <DialogFooter>{footer}</DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

/** The first message of a TanStack Form field's errors, which may be strings or issues. */
export const firstErrorMessage = (errors: unknown[]): string | undefined => {
  const first = errors[0];
  return typeof first === "string" ? first : (first as { message?: string } | undefined)?.message;
};
