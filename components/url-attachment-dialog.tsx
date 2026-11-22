"use client";

import { useForm } from "@tanstack/react-form";
import { Globe } from "lucide-react";
import { useState } from "react";
import * as v from "valibot";
import { useSettings } from "@/components/settings-provider";
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
import { Spinner } from "@/components/ui/spinner";
import { Toggle } from "@/components/ui/toggle";
import { useIsMobile } from "@/hooks/use-mobile";
import type { ContextAttachmentData } from "@/lib/context-attachments";
import type { WebFetchMode } from "@/lib/context-url";

const urlInputSchema = v.object({
  url: v.pipe(
    v.string(),
    v.trim(),
    v.minLength(1, "Enter a webpage URL."),
    v.check((value) => {
      try {
        const parsed = new URL(value);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        return false;
      }
    }, "Enter a valid http:// or https:// URL."),
  ),
});

export const UrlAttachmentDialog = ({
  open,
  onOpenChange,
  browserRenderAvailable,
  onAttached,
  onUnauthorized,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  browserRenderAvailable: boolean;
  onAttached: (attachment: ContextAttachmentData) => void;
  onUnauthorized?: () => void;
}) => {
  const isMobile = useIsMobile();
  const { settings } = useSettings();
  const [useBrowser, setUseBrowser] = useState(false);
  const [loading, setLoading] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  const allowBrowserRender = browserRenderAvailable && settings.webFetchPolicy === "auto";

  const form = useForm({
    defaultValues: { url: "" },
    validators: { onSubmit: urlInputSchema },
    onSubmit: async ({ value }) => {
      setLoading(true);
      setRequestError(null);
      const mode: WebFetchMode =
        settings.webFetchPolicy === "zero-quota"
          ? "zero-quota"
          : useBrowser && allowBrowserRender
            ? "browser"
            : "auto";

      try {
        const response = await fetch("/api/context/url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: value.url.trim(), mode }),
        });

        if (response.status === 401) {
          onOpenChange(false);
          onUnauthorized?.();
          return;
        }

        if (!response.ok) {
          const message = (await response.text()).trim();
          setRequestError(message || "Failed to fetch webpage content.");
          return;
        }

        const data = (await response.json()) as { attachment: ContextAttachmentData };
        onAttached(data.attachment);
        form.reset();
        setUseBrowser(false);
        onOpenChange(false);
      } catch {
        setRequestError("Network error while fetching webpage.");
      } finally {
        setLoading(false);
      }
    },
  });

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !loading) {
      setRequestError(null);
    }
    onOpenChange(nextOpen);
  };

  const fields = (
    <div className="flex flex-col gap-3">
      <form.Field name="url">
        {(field) => {
          const firstError = field.state.meta.errors[0];
          const errorMessage =
            typeof firstError === "string"
              ? firstError
              : (firstError as { message?: string } | undefined)?.message;
          const displayError = errorMessage ?? requestError;

          return (
            <Field data-invalid={displayError ? "true" : undefined}>
              <FieldLabel htmlFor="context-url-input">Webpage URL</FieldLabel>
              <Input
                id="context-url-input"
                type="url"
                placeholder="https://developers.cloudflare.com/..."
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => {
                  setRequestError(null);
                  field.handleChange(event.target.value);
                }}
                aria-invalid={Boolean(displayError)}
                disabled={loading}
                autoFocus
              />
              {displayError && <FieldError>{displayError}</FieldError>}
            </Field>
          );
        }}
      </form.Field>

      {allowBrowserRender && (
        <div className="flex items-center justify-between gap-2">
          <Toggle
            size="sm"
            variant="outline"
            pressed={useBrowser}
            onPressedChange={setUseBrowser}
            disabled={loading}
          >
            <Globe />
            Browser rendering
          </Toggle>
        </div>
      )}
    </div>
  );

  const actions = (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => handleOpenChange(false)}
        disabled={loading}
      >
        Cancel
      </Button>
      <Button type="submit" disabled={loading}>
        {loading && <Spinner />}
        Attach
      </Button>
    </>
  );

  const handleFormSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    event.stopPropagation();
    void form.handleSubmit();
  };

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={handleOpenChange}>
        <DrawerContent>
          <form onSubmit={handleFormSubmit} noValidate className="flex flex-col gap-4">
            <DrawerHeader>
              <DrawerTitle>Attach webpage</DrawerTitle>
            </DrawerHeader>
            <div className="px-4">{fields}</div>
            <DrawerFooter className="flex-row justify-end">{actions}</DrawerFooter>
          </form>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleFormSubmit} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Attach webpage</DialogTitle>
          </DialogHeader>
          {fields}
          <DialogFooter>{actions}</DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
