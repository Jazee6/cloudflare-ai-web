"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { ChatStatus, FileUIPart } from "ai";
import {
  ArrowUp,
  Loader2,
  Paperclip,
  RefreshCw,
  Square,
  X,
} from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import ModelSelect from "@/components/model-select";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import type { Model } from "@/lib/models";
import { cn, type StoredModelKey } from "@/lib/utils";

export interface onSendMessageProps {
  text: string;
  files?: FileUIPart[];
}

const formSchema = z.object({
  input: z.string().trim().min(1),
});

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
  modalKey,
}: {
  className?: string;
  onSendMessage: (data: onSendMessageProps) => void;
  onStop?: () => void;
  onRetry?: () => void;
  status?: ChatStatus;
  models: Model[];
  modalKey?: StoredModelKey;
}) => {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      input: "",
    },
  });
  const input = form.watch("input");
  const [selectedModel, setSelectedModel] = useState<Model>();
  const [files, setFiles] = useState<FileUIPart[]>([]);

  useEffect(() => {
    if (!selectedModel?.input?.includes("image")) {
      setFiles([]);
    }
  }, [selectedModel]);

  function onSubmit(values: z.infer<typeof formSchema>) {
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

  const onAddFiles = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.onchange = async () => {
      const newFiles = await Promise.all(
        Array.from(input.files ?? []).map(async (file) => ({
          type: "file" as const,
          filename: file.name,
          mediaType: file.type,
          url: await fileToBase64(file),
        })),
      );

      setFiles((prevState) => {
        const combinedFiles = [...prevState, ...newFiles];
        if (combinedFiles.length > 5) {
          toast.warning("You can only attach up to 5 images.");
          return combinedFiles.slice(0, 5);
        }
        return combinedFiles;
      });
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
        if (file?.type.startsWith("image/")) {
          const base64 = await fileToBase64(file);
          newFiles.push({
            type: "file",
            filename: file.name,
            mediaType: file.type,
            url: base64,
          });
        }
      }
    }

    if (newFiles.length > 0) {
      setFiles((prevState) => {
        const combinedFiles = [...prevState, ...newFiles];
        if (combinedFiles.length > 5) {
          toast.warning("You can only attach up to 5 images.");
          return combinedFiles.slice(0, 5);
        }
        return combinedFiles;
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div
          className={cn(
            "w-full border-3 rounded-md focus-within:border-primary transition-all",
            className,
          )}
        >
          <FormField
            control={form.control}
            name="input"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Textarea
                    autoFocus
                    className="border-0 shadow-none focus-visible:ring-0 resize-none max-h-[50vh] scrollbar rounded-b-none rounded-t"
                    placeholder="Text here..."
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" &&
                        !event.shiftKey &&
                        !event.nativeEvent.isComposing
                      ) {
                        event.preventDefault();
                        form.handleSubmit(onSubmit)();
                      }
                    }}
                    onPaste={onPaste}
                    {...field}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <ul className="flex px-3 gap-1">
            {files.map((file, index) => {
              if (file.mediaType.startsWith("image/")) {
                return (
                  <li
                    key={`file-${file.filename}-${index}`}
                    className="size-12 overflow-hidden rounded-md relative group hover:shadow transition-all"
                  >
                    <button
                      type="button"
                      className="absolute group-hover:opacity-100 transition-opacity opacity-0
                     top-0 right-0 bg-black rounded-full cursor-pointer z-10"
                      onClick={() => {
                        setFiles((prevState) =>
                          prevState.filter((_, i) => i !== index),
                        );
                      }}
                    >
                      <X className="size-4 text-white" />
                    </button>
                    {/** biome-ignore lint/performance/noImgElement: <data_url> */}
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
              setSelectedModel={setSelectedModel}
              models={models}
              modalKey={modalKey ?? "CF_AI_MODEL"}
            />

            {selectedModel?.input?.includes("image") && (
              <Button
                size="icon"
                variant="ghost"
                className="relative"
                onClick={onAddFiles}
              >
                <Paperclip />
              </Button>
            )}

            <Button
              size="icon"
              className="ml-auto"
              disabled={
                status === "submitted" ||
                (input.trim().length === 0 && status === "ready")
              }
              type={status === "ready" ? "submit" : "button"}
              onClick={onSendClick}
            >
              {status === "ready" && <ArrowUp />}
              {status === "submitted" && <Loader2 className="animate-spin" />}
              {status === "streaming" && (
                <Square className="fill-primary-foreground" />
              )}
              {status === "error" && <RefreshCw />}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
};

export default ChatInput;
