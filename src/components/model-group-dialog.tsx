import { useForm } from "@tanstack/react-form";
import { useEffect } from "react";
import * as v from "valibot";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/use-mobile";
import { MAX_GROUP_NAME_LENGTH } from "@/lib/model-layout";

const groupNameSchema = v.object({
  name: v.pipe(
    v.string(),
    v.trim(),
    v.minLength(1, "Enter a group name."),
    v.maxLength(MAX_GROUP_NAME_LENGTH, `Use at most ${MAX_GROUP_NAME_LENGTH} characters.`),
  ),
});

/** Names a new Model Group or renames a custom one. */
export const ModelGroupDialog = ({
  open,
  onOpenChange,
  title,
  submitLabel,
  initialName = "",
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  submitLabel: string;
  initialName?: string;
  onSubmit: (name: string) => void;
}) => {
  const isMobile = useIsMobile();
  const form = useForm({
    defaultValues: { name: initialName },
    validators: { onSubmit: groupNameSchema },
    onSubmit: ({ value }) => {
      onSubmit(value.name.trim());
      onOpenChange(false);
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({ name: initialName });
    }
  }, [open, initialName, form]);

  const field = (
    <form.Field name="name">
      {(field) => {
        const firstError = field.state.meta.errors[0];
        const errorMessage =
          typeof firstError === "string"
            ? firstError
            : (firstError as { message?: string } | undefined)?.message;
        return (
          <Field data-invalid={errorMessage ? "true" : undefined}>
            <FieldLabel htmlFor="model-group-name">Name</FieldLabel>
            <Input
              id="model-group-name"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              aria-invalid={Boolean(errorMessage)}
              autoFocus
            />
            {errorMessage && <FieldError>{errorMessage}</FieldError>}
          </Field>
        );
      }}
    </form.Field>
  );

  const actions = (
    <>
      <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
        Cancel
      </Button>
      <Button type="submit">{submitLabel}</Button>
    </>
  );

  const handleFormSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    event.stopPropagation();
    void form.handleSubmit();
  };

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <form onSubmit={handleFormSubmit} noValidate className="flex flex-col gap-4">
            <DrawerHeader>
              <DrawerTitle>{title}</DrawerTitle>
            </DrawerHeader>
            <div className="px-4">{field}</div>
            <DrawerFooter className="flex-row justify-end">{actions}</DrawerFooter>
          </form>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={handleFormSubmit} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          {field}
          <DialogFooter>{actions}</DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
