"use client";

import { valibotResolver } from "@hookform/resolvers/valibot";
import type { ChatStatus, FileUIPart } from "ai";
import { ArrowUp, Earth, Paperclip, RefreshCw, Square, X } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "@/components/ui/toast";
import * as v from "valibot";
import { useModelPreferences } from "@/components/model-catalog-provider";
import ModelSelect from "@/components/model-select";
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentMedia,
} from "@/components/ui/attachment";
import { Field } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import type { Model } from "@/lib/models";
import { compressImage } from "@/lib/image-compression";
import { MAX_IMAGE_PARTS } from "@/lib/request-limits";
import type { StoredModelKey } from "@/lib/utils";
import { Toggle } from "@/components/ui/toggle";

export interface onSendMessageProps {
  text: string;
  files?: FileUIPart[];
}

const formSchema = v.object({
  input: v.pipe(v.string(), v.trim(), v.minLength(1)),
});

type FormData = v.InferOutput<typeof formSchema>;

const ChatInput = ({
  className,
  onSendMessage,
  onStop,
  onRetry,
  status = "ready",
  models,
  modelKey,
  addon,
}: {
  className?: string;
  onSendMessage: (data: onSendMessageProps) => void;
  onStop?: () => void;
  onRetry?: () => void;
  status?: ChatStatus;
  models: Model[];
  modelKey?: StoredModelKey;
  /** Extra controls shown next to the model selector. */
  addon?: ReactNode;
}) => {
  const { preferences, setPreference } = useModelPreferences();
  const selectedModelKey = modelKey ?? "CF_AI_MODEL";
  const form = useForm<FormData>({
    resolver: valibotResolver(formSchema),
    defaultValues: {
      input: "",
    },
  });
  const input = form.watch("input");
  const selectedModel =
    models.find((model) => model.id === preferences[selectedModelKey]) ?? models[0];
  const [files, setFiles] = useState<FileUIPart[]>([]);
  const searchEnabled = preferences.CF_AI_SEARCH_ENABLED === "true";

  // Stores the fallback when the remembered model has left the catalog.
  useEffect(() => {
    setPreference(selectedModelKey, selectedModel?.id);
  }, [selectedModel?.id, selectedModelKey, setPreference]);

  useEffect(() => {
    if (!selectedModel?.input?.includes("image")) {
      setFiles([]);
    }
  }, [selectedModel]);

  function onSubmit(values: FormData) {
    if (models.length === 0) {
      return;
    }

    form.resetField("input");
    setFiles([]);
    onSendMessage({
      text: values.input,
      files,
    });
  }

  const onSendClick = () => {
    switch (status) {
      case "streaming":
        onStop?.();
        break;
      case "error":
        onRetry?.();
        break;
    }
  };

  const appendFiles = (newFiles: FileUIPart[]) => {
    setFiles((currentFiles) => {
      const combinedFiles = [...currentFiles, ...newFiles];
      if (combinedFiles.length > MAX_IMAGE_PARTS) {
        toast.add({
          title: `You can only attach up to ${MAX_IMAGE_PARTS} images.`,
          type: "warning",
        });
      }
      return combinedFiles.slice(0, MAX_IMAGE_PARTS);
    });
  };

  const toFilePart = async (file: File): Promise<FileUIPart | null> => {
    const compressed = await compressImage(file);
    if (!compressed) {
      toast.add({
        title: `Unable to attach ${file.name}: unsupported or too large.`,
        type: "warning",
      });
      return null;
    }
    return { type: "file", filename: file.name, ...compressed };
  };

  const onAddFiles = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.onchange = async () => {
      const fileParts = await Promise.all(Array.from(input.files ?? []).map(toFilePart));
      appendFiles(fileParts.filter((file): file is FileUIPart => file !== null));
    };
    input.click();
  };

  const onPaste = async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const clipboardItems = event.clipboardData.items;
    const newFiles: FileUIPart[] = [];

    for (let i = 0; i < clipboardItems.length; i++) {
      const item = clipboardItems[i];
      if (item.kind === "file") {
        event.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const filePart = await toFilePart(file);
          if (filePart) {
            newFiles.push(filePart);
          }
        }
      }
    }

    if (newFiles.length > 0) {
      appendFiles(newFiles);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className={className}>
      <Controller
        control={form.control}
        name="input"
        render={({ field }) => (
          <Field>
            {/* The empty input disables only the send button, so the group keeps its normal look. */}
            <InputGroup className="rounded-md border-3 border-border transition-all focus-within:border-primary has-disabled:bg-transparent has-disabled:opacity-100 has-[[data-slot=input-group-control]:focus-visible]:border-primary has-[[data-slot=input-group-control]:focus-visible]:ring-0 dark:has-disabled:bg-input/30">
              {files.length > 0 && (
                <InputGroupAddon align="block-start" className="flex-wrap">
                  {files.map((file, index) => (
                    <Attachment
                      key={`${file.filename}-${file.url}`}
                      orientation="vertical"
                      className="w-20"
                    >
                      <AttachmentMedia variant="image">
                        <img src={file.url} alt={file.filename} />
                      </AttachmentMedia>
                      <AttachmentActions>
                        <AttachmentAction
                          type="button"
                          aria-label={`Remove ${file.filename ?? "image"}`}
                          onClick={() => {
                            setFiles((prevState) => prevState.filter((_, i) => i !== index));
                          }}
                        >
                          <X />
                        </AttachmentAction>
                      </AttachmentActions>
                    </Attachment>
                  ))}
                </InputGroupAddon>
              )}

              <InputGroupTextarea
                autoFocus
                className="max-h-[50vh] scrollbar-auto scrollbar-thumb-border scrollbar-track-transparent"
                placeholder="Text here..."
                aria-label="Message"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    form.handleSubmit(onSubmit)();
                  }
                }}
                onPaste={onPaste}
                {...field}
              />

              <InputGroupAddon align="block-end">
                <ModelSelect
                  selectedModel={selectedModel}
                  models={models}
                  onSelectModel={(model) => setPreference(selectedModelKey, model.id)}
                />

                {addon}

                {selectedModel?.input?.includes("search") && (
                  <Toggle
                    aria-label="Toggle web search"
                    pressed={searchEnabled}
                    onPressedChange={(pressed) =>
                      setPreference("CF_AI_SEARCH_ENABLED", pressed ? "true" : "false")
                    }
                  >
                    <Earth />
                    Search
                  </Toggle>
                )}

                {selectedModel?.input?.includes("image") && (
                  <InputGroupButton size="icon-sm" aria-label="Attach images" onClick={onAddFiles}>
                    <Paperclip />
                  </InputGroupButton>
                )}

                <InputGroupButton
                  size="icon-sm"
                  variant="default"
                  className="ml-auto"
                  aria-label={
                    status === "streaming" ? "Stop" : status === "error" ? "Retry" : "Send"
                  }
                  disabled={
                    models.length === 0 ||
                    status === "submitted" ||
                    (input.trim().length === 0 && status === "ready")
                  }
                  type={status === "ready" ? "submit" : "button"}
                  onClick={onSendClick}
                >
                  {status === "ready" && <ArrowUp />}
                  {status === "submitted" && <Spinner />}
                  {status === "streaming" && <Square className="fill-primary-foreground" />}
                  {status === "error" && <RefreshCw />}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </Field>
        )}
      />
    </form>
  );
};

export default ChatInput;
