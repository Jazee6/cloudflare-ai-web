import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Controller, useForm } from "react-hook-form";
import * as v from "valibot";
import { valibotResolver } from "@hookform/resolvers/valibot";
import { Field, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const formSchema = v.object({
  password: v.pipe(v.string(), v.minLength(1)),
});

type FormData = v.InferOutput<typeof formSchema>;

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

  const form = useForm<FormData>({
    resolver: valibotResolver(formSchema),
    defaultValues: {
      password: "",
    },
  });

  async function onSubmit(values: FormData) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: values.password }),
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
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Please enter your password to continue</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)}>
          <Controller
            control={form.control}
            name="password"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid || !!error}>
                <Input
                  aria-invalid={fieldState.invalid || !!error}
                  placeholder="password"
                  type="password"
                  {...field}
                />
                {fieldState.error && <FieldError errors={[fieldState.error]} />}
                {error && !fieldState.error && <p className="text-destructive text-sm">{error}</p>}
              </Field>
            )}
          />
          <DialogFooter className="mt-4">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AuthDialog;
