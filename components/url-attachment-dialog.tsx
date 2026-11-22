"use client";

import { Globe } from "lucide-react";
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
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { Toggle } from "@/components/ui/toggle";
import { useIsMobile } from "@/hooks/use-mobile";
import type { ContextAttachmentData } from "@/lib/context-attachments";
import type { WebFetchMode } from "@/lib/context-url";

const urlInputSchema = v.pipe(
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
);

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
  const [url, setUrl] = useState("");
  const [useBrowser, setUseBrowser] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !loading) {
      setError(null);
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const validated = v.safeParse(urlInputSchema, url);
    if (!validated.success) {
      setError(validated.issues[0]?.message ?? "Invalid URL.");
      return;
    }

    setLoading(true);
    setError(null);
    const mode: WebFetchMode = useBrowser && browserRenderAvailable ? "browser" : "auto";

    try {
      const response = await fetch("/api/context/url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: validated.output, mode }),
      });

      if (response.status === 401) {
        onOpenChange(false);
        onUnauthorized?.();
        return;
      }

      if (!response.ok) {
        const message = (await response.text()).trim();
        setError(message || "Failed to fetch webpage content.");
        return;
      }

      const data = (await response.json()) as { attachment: ContextAttachmentData };
      onAttached(data.attachment);
      setUrl("");
      setUseBrowser(false);
      onOpenChange(false);
    } catch {
      setError("Network error while fetching webpage.");
    } finally {
      setLoading(false);
    }
  };

  const fields = (
    <div className="flex flex-col gap-3">
      <Field data-invalid={error ? "true" : undefined}>
        <FieldLabel htmlFor="context-url-input">Webpage URL</FieldLabel>
        <Input
          id="context-url-input"
          type="url"
          placeholder="https://developers.cloudflare.com/..."
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          disabled={loading}
          autoFocus
        />
        {error && <FieldError>{error}</FieldError>}
      </Field>

      {browserRenderAvailable && (
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

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent side="bottom">
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            <SheetHeader>
              <SheetTitle>Attach webpage</SheetTitle>
            </SheetHeader>
            <div className="px-4">{fields}</div>
            <SheetFooter className="flex-row justify-end">{actions}</SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
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
