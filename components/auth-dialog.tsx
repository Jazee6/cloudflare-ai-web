"use client";

import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import * as v from "valibot";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

const formSchema = v.object({
  password: v.pipe(v.string(), v.minLength(1, "Password is required.")),
});

const AuthDialog = ({
  open,
  onOpenChange,
  onAuthenticated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAuthenticated: () => void;
}) => {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm({
    defaultValues: {
      password: "",
    },
    validators: {
      onSubmit: formSchema,
    },
    onSubmit: async ({ value }) => {
      setSubmitting(true);
      setError(null);
      try {
        const res = await fetch("/api/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: value.password }),
        });
        if (res.ok) {
          form.reset({ password: "" });
          onAuthenticated();
        } else if (res.status === 401) {
          setError("Incorrect password.");
        } else {
          setError("Authentication failed. Please try again.");
        }
      } catch {
        setError("Network error. Please try again.");
      } finally {
        setSubmitting(false);
      }
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Please enter your password to continue</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <form.Field name="password">
            {(field) => {
              const firstError = field.state.meta.errors[0];
              const fieldMessage =
                typeof firstError === "string"
                  ? firstError
                  : (firstError as { message?: string } | undefined)?.message;
              const displayError = fieldMessage ?? error;
              const invalid = Boolean(displayError);

              return (
                <Field data-invalid={invalid || undefined}>
                  <Input
                    aria-invalid={invalid || undefined}
                    placeholder="password"
                    type="password"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => {
                      setError(null);
                      field.handleChange(event.target.value);
                    }}
                  />
                  {displayError && <FieldError>{displayError}</FieldError>}
                </Field>
              );
            }}
          </form.Field>
          <DialogFooter className="mt-4">
            <Button type="submit" disabled={submitting}>
              {submitting && <Spinner />}
              Submit
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AuthDialog;
