"use client";

import { valibotResolver } from "@hookform/resolvers/valibot";
import type { ChatStatus, FileUIPart } from "ai";
import { ArrowUp, Earth, Loader2, Paperclip, RefreshCw, Square, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "@/components/ui/toast";
import * as v from "valibot";
import { useModelPreferences } from "@/components/model-catalog-provider";
import ModelSelect from "@/components/model-select";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import type { Model } from "@/lib/models";
import { MAX_IMAGE_BYTES, MAX_IMAGE_PARTS } from "@/lib/request-limits";
import { cn, deleteCookie, setCookie, type StoredModelKey } from "@/lib/utils";
import { Toggle } from "@/components/ui/toggle";

export interface onSendMessageProps {
  text: string;
  files?: FileUIPart[];
}

const formSchema = v.object({
  input: v.pipe(v.string(), v.trim(), v.minLength(1)),
});

type FormData = v.InferOutput<typeof formSchema>;

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const ChatInput = ({
  className,
  onSendMessage,
  onStop,
  onRetry,
  status = "ready",
  models,
  modelKey,
}: {
  className?: string;
  onSendMessage: (data: onSendMessageProps) => void;
  onStop?: () => void;
  onRetry?: () => void;
  status?: ChatStatus;
  models: Model[];
  modelKey?: StoredModelKey;
}) => {
  const preferences = useModelPreferences();
  const selectedModelKey = modelKey ?? "CF_AI_MODEL";
  const form = useForm<FormData>({
    resolver: valibotResolver(formSchema),
    defaultValues: {
      input: "",
    },
  });
  const input = form.watch("input");
  const [selectedModel, setSelectedModel] = useState<Model | undefined>(
    () => models.find((model) => model.id === preferences[selectedModelKey]) ?? models[0],
  );
  const [files, setFiles] = useState<FileUIPart[]>([]);
  const [searchEnabled, setSearchEnabled] = useState(
    () => preferences.CF_AI_SEARCH_ENABLED === "true",
  );

  useEffect(() => {
    setSelectedModel((currentModel) => {
      const nextModel =
        models.find((model) => model.id === currentModel?.id) ??
        models.find((model) => model.id === preferences[selectedModelKey]) ??
        models[0];

      if (nextModel) {
        setCookie(selectedModelKey, nextModel.id);
      } else {
        deleteCookie(selectedModelKey);
      }
      return nextModel;
    });
  }, [models, preferences, selectedModelKey]);

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
    if (!file.type.startsWith("image/") || file.size > MAX_IMAGE_BYTES) {
      toast.add({ title: "Images must be 5 MiB or smaller.", type: "warning" });
      return null;
    }
    return {
      type: "file",
      filename: file.name,
      mediaType: file.type,
      url: await fileToBase64(file),
    };
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
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <div
        className={cn(
          "w-full border-3 rounded-md focus-within:border-primary transition-all",
          className,
        )}
      >
        <Controller
          control={form.control}
          name="input"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <Textarea
                aria-invalid={fieldState.invalid}
                autoFocus
                className="border-0 shadow-none focus-visible:ring-0 resize-none max-h-[50vh] scrollbar-auto scrollbar-thumb-border scrollbar-track-transparent rounded-b-none rounded-t"
                placeholder="Text here..."
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    form.handleSubmit(onSubmit)();
                  }
                }}
                onPaste={onPaste}
                {...field}
              />
            </Field>
          )}
        />

        <ul className="flex px-3 gap-1">
          {files.map((file, index) => {
            if (file.mediaType.startsWith("image/")) {
              return (
                <li
                  key={`${file.filename}-${file.url}`}
                  className="size-12 overflow-hidden rounded-md relative group hover:shadow transition-all"
                >
                  <button
                    type="button"
                    className="absolute group-hover:opacity-100 transition-opacity opacity-0
                     top-0 right-0 bg-black rounded-full cursor-pointer z-10"
                    onClick={() => {
                      setFiles((prevState) => prevState.filter((_, i) => i !== index));
                    }}
                  >
                    <X className="size-4 text-white" />
                  </button>
                  <img
                    src={file.url}
                    alt={file.filename}
                    className="hover:brightness-75 object-cover size-full"
                  />
                </li>
              );
            }

            return null;
          })}
        </ul>

        <div className="flex items-center p-2 space-x-1 dark:bg-input/30 rounded-b">
          <ModelSelect
            selectedModel={selectedModel}
            models={models}
            onSelectModel={(model) => {
              setSelectedModel(model);
              setCookie(selectedModelKey, model.id);
            }}
          />

          {selectedModel?.input?.includes("search") && (
            <Toggle
              aria-label="Toggle web search"
              className="data-[state=on]:border"
              pressed={searchEnabled}
              onPressedChange={(pressed) => {
                setCookie("CF_AI_SEARCH_ENABLED", pressed ? "true" : "false");
                setSearchEnabled(pressed);
              }}
            >
              <Earth />
              Search
            </Toggle>
          )}

          {selectedModel?.input?.includes("image") && (
            <Button size="icon" variant="ghost" className="relative" onClick={onAddFiles}>
              <Paperclip />
            </Button>
          )}

          <Button
            size="icon"
            className="ml-auto"
            disabled={
              models.length === 0 ||
              status === "submitted" ||
              (input.trim().length === 0 && status === "ready")
            }
            type={status === "ready" ? "submit" : "button"}
            onClick={onSendClick}
          >
            {status === "ready" && <ArrowUp />}
            {status === "submitted" && <Loader2 className="animate-spin" />}
            {status === "streaming" && <Square className="fill-primary-foreground" />}
            {status === "error" && <RefreshCw />}
          </Button>
        </div>
      </div>
    </form>
  );
};

export default ChatInput;
